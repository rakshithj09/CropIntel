"""
Training script for individual crop disease classification models.
"""
import argparse
import os
from pathlib import Path
from datetime import datetime
import json
import numpy as np
import tensorflow as tf
from sklearn.utils.class_weight import compute_class_weight
from tensorflow.keras.callbacks import (
    ModelCheckpoint, EarlyStopping, ReduceLROnPlateau, CSVLogger
)

from ml.config import (
    MODELS_DIR, TRAINING_CONFIG, MODEL_VERSION_FORMAT, CROPS, MODEL_CONFIG
)
from ml.utils.data_loader import CropDatasetLoader
from ml.utils.model_builder import build_model, unfreeze_model
from ml.utils.evaluation import evaluate_model
from ml.utils.tflite_converter import convert_to_tflite


def train_crop_model(
    crop: str,
    epochs: int = None,
    fine_tune: bool = True,
    from_scratch: bool = False,
    architecture: str = "EfficientNetB0",
    phase2_lr: float = 1e-4,
    batch_size: int = None,
    streaming: bool = True,
):
    """
    Train a disease classification model for a specific crop.

    Args:
        crop: Crop name (corn, soybean, wheat, rice)
        epochs: Number of training epochs (defaults to config)
        fine_tune: Whether to run a second phase with a lower learning rate
        from_scratch: If True, do not load ImageNet weights; train EfficientNet from
            random init (early accuracy starts near chance, not ~90% transfer learning)
        streaming: Stream batches from disk via tf.data (default). The legacy
            in-RAM path (~0.6 MB/image as float32) OOMs on 10k+ image datasets.
    """
    if crop not in CROPS:
        raise ValueError(f"Unknown crop: {crop}")

    # Allow caller to override batch size (e.g. to recover from OOM)
    _orig_batch = TRAINING_CONFIG["batch_size"]
    if batch_size is not None:
        TRAINING_CONFIG["batch_size"] = batch_size
    
    print(f"\n{'='*60}")
    print(f"Training {crop.upper()} Disease Classification Model")
    print(f"Architecture: {architecture}")
    if from_scratch:
        print("(backbone: random init — no ImageNet weights)")
    print(f"{'='*60}\n")
    
    # Create version
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    version = f"v1_{timestamp}"
    model_dir = MODELS_DIR / crop / version
    model_dir.mkdir(parents=True, exist_ok=True)
    
    # Load dataset
    loader = CropDatasetLoader(crop)
    if streaming:
        print("Indexing dataset (streaming mode)...")
        paths, labels, class_names = loader.index_dataset()
        print("Creating tf.data pipelines...")
        train_gen, val_gen, y_train = loader.create_tf_datasets(paths, labels)
    else:
        print("Loading dataset (legacy in-RAM mode)...")
        images, labels, class_names = loader.load_dataset()
        print("Creating data generators...")
        train_gen, val_gen, y_train = loader.create_data_generators(images, labels)
    
    # Calculate class weights to handle imbalance (using training set).
    # A wider cap gives minority classes enough signal without letting a single
    # small class dominate training.
    train_class_weights = compute_class_weight(
        'balanced',
        classes=np.unique(y_train),
        y=y_train
    )
    train_class_weights = np.clip(train_class_weights, 0.3, 5.0)
    train_class_weight_dict = {i: weight for i, weight in enumerate(train_class_weights)}
    print(f"\nClass weights for training (capped at 5.0): {dict(zip(class_names, train_class_weights))}")
    
    # Build model
    print("Building model...")
    model = build_model(
        num_classes=len(class_names),
        crop=crop,
        from_scratch=from_scratch,
        architecture=architecture,
    )
    
    # Callbacks - using .keras format for better custom function handling
    checkpoint_path = model_dir / "checkpoint.keras"
    callbacks = [
        ModelCheckpoint(
            checkpoint_path,
            monitor='val_loss',
            save_best_only=True,
            save_weights_only=False,
            verbose=1
        ),
        EarlyStopping(
            monitor='val_loss',
            patience=20,
            restore_best_weights=True,
            verbose=1,
            min_delta=0.001  # Minimum change to qualify as improvement
        ),
        ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=5,
            min_lr=1e-7,
            verbose=1
        ),
        CSVLogger(model_dir / "training_log.csv")
    ]
    
    # Phase 1: frozen ImageNet backbone + head, or full net from random init
    if from_scratch:
        print("\nPhase 1: Training full model from random initialization...")
    else:
        print("\nPhase 1: Training with frozen base model...")
    total_epochs = epochs or TRAINING_CONFIG["epochs"]
    # Phase 1 is just a warm-up for the classifier head; keep it short so the
    # head doesn't overfit frozen-backbone features before Phase 2 fine-tuning.
    epochs_phase1 = max(1, int(total_epochs * 0.2))
    
    history1 = model.fit(
        train_gen,
        epochs=epochs_phase1,
        validation_data=val_gen,
        callbacks=callbacks,
        class_weight=train_class_weight_dict,
        verbose=1
    )
    
    # Fine-tuning: partial unfreeze (pretrained) or lower LR on full model (from scratch)
    if fine_tune:
        # Phase 2 uses fixed LR — no ReduceLROnPlateau so the optimizer can't
        # collapse to a near-zero LR before the backbone has had time to adapt.
        callbacks_phase2 = [
            ModelCheckpoint(
                checkpoint_path,
                monitor='val_loss',
                save_best_only=True,
                save_weights_only=False,
                verbose=1
            ),
            EarlyStopping(
                monitor='val_loss',
                patience=20,
                restore_best_weights=True,
                verbose=1,
                min_delta=0.001
            ),
            CSVLogger(model_dir / "training_log.csv", append=True)
        ]

        if from_scratch:
            print("\nPhase 2: Lower learning rate (full model)...")
            model.compile(
                optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
                loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.1),
                metrics=["accuracy"],
            )
        else:
            print("\nPhase 2: Fine-tuning top layers...")
            model = unfreeze_model(model, fine_tune_at=50, lr=phase2_lr)

        epochs_phase2 = total_epochs - epochs_phase1

        history2 = model.fit(
            train_gen,
            epochs=epochs_phase2,
            validation_data=val_gen,
            callbacks=callbacks_phase2,
            class_weight=train_class_weight_dict,
            verbose=1
        )
    
    # Load best model with custom objects for custom preprocessing function
    print("\nLoading best model checkpoint...")
    model = tf.keras.models.load_model(checkpoint_path)
    
    # Evaluate on test set
    print("\nEvaluating on test set...")
    X_test, y_test = loader.get_test_set()
    metrics = evaluate_model(model, X_test, y_test, class_names, crop, version)
    
    print(f"\nTest Accuracy: {metrics['accuracy']:.4f}")
    print(f"Test Precision: {metrics['precision']:.4f}")
    print(f"Test Recall: {metrics['recall']:.4f}")
    print(f"Test F1 Score: {metrics['f1_score']:.4f}")
    
    # Convert to TensorFlow Lite
    print("\nConverting to TensorFlow Lite...")
    # Use a sample of test data as representative dataset
    representative_data = X_test[:TRAINING_CONFIG["batch_size"]]
    tflite_path = convert_to_tflite(
        model, crop, version, class_names, representative_data
    )

    # Item 12: verify the .tflite actually loads and runs one inference.
    try:
        interpreter = tf.lite.Interpreter(model_path=str(tflite_path))
        interpreter.allocate_tensors()
        in_det = interpreter.get_input_details()[0]
        out_det = interpreter.get_output_details()[0]
        sample = X_test[:1].astype(in_det["dtype"])
        interpreter.set_tensor(in_det["index"], sample)
        interpreter.invoke()
        tflite_out = interpreter.get_tensor(out_det["index"])
        assert tflite_out.shape[-1] == len(class_names), (
            f"TFLite output classes {tflite_out.shape[-1]} != {len(class_names)}")
        metrics["tflite_verified"] = True
        print(f"  [TFLITE OK] {tflite_path} runs; output shape={tflite_out.shape}, "
              f"pred={class_names[int(np.argmax(tflite_out))]}")
    except Exception as e:
        metrics["tflite_verified"] = False
        print(f"  [TFLITE FAIL] could not load/run {tflite_path}: {e}")
    # Persist the updated metrics (now including tflite_verified) so the summary
    # and downstream tooling see the verification result.
    with open(model_dir / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    
    # Save label mapping
    label_map = {i: name for i, name in enumerate(class_names)}
    with open(model_dir / "label_map.json", "w") as f:
        json.dump(label_map, f, indent=2)
    
    # Save training config
    training_info = {
        "crop": crop,
        "version": version,
        "timestamp": timestamp,
        "epochs": epochs or TRAINING_CONFIG["epochs"],
        "batch_size": TRAINING_CONFIG["batch_size"],
        "image_size": list(TRAINING_CONFIG["image_size"]),
        "num_classes": len(class_names),
        "class_names": class_names,
        "model_architecture": architecture,
        "fine_tuned": fine_tune,
        "from_scratch": from_scratch,
        "backbone_weights": None if from_scratch else MODEL_CONFIG["weights"],
        "metrics": metrics
    }
    
    with open(model_dir / "training_info.json", "w") as f:
        json.dump(training_info, f, indent=2)
    
    print(f"\n{'='*60}")
    print(f"Training complete! Model saved to: {model_dir}")
    print(f"{'='*60}\n")

    # Restore original batch size if it was overridden
    TRAINING_CONFIG["batch_size"] = _orig_batch

    return model_dir


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train crop disease classification model")
    parser.add_argument("--crop", type=str, required=True, choices=list(CROPS.keys()),
                       help="Crop to train model for")
    parser.add_argument("--epochs", type=int, default=None,
                       help="Number of training epochs")
    parser.add_argument("--no-fine-tune", action="store_true",
                       help="Skip fine-tuning phase")
    parser.add_argument(
        "--from-scratch",
        action="store_true",
        help="Do not load ImageNet weights; train EfficientNet from random init (slower, accuracy rises gradually)",
    )
    parser.add_argument(
        "--no-streaming",
        action="store_true",
        help="Use the legacy in-RAM data pipeline instead of tf.data streaming",
    )

    args = parser.parse_args()

    train_crop_model(
        crop=args.crop,
        epochs=args.epochs,
        fine_tune=not args.no_fine_tune,
        from_scratch=args.from_scratch,
        streaming=not args.no_streaming,
    )
