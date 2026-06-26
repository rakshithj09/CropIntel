"""
Train the crop-ID classifier: "which of the 5 crops is this leaf?"

This is the durable replacement for the heuristic wrong-crop gate (see
docs/CROP_ID_GATE.md). Crops are far more visually separable than diseases
within a crop, so a small transfer-learned model should reach very high
accuracy and remove the cross-crop false-accepts/rejects the heuristic can't.

Data: reuses the existing per-crop image folders — every image under
ml/data/<crop>/** is implicitly labeled by <crop>. No new data needed.

NOTE: requires the ML training environment (TensorFlow). It will NOT run in the
repo's Py3.14 inference venv. Run it where the per-crop trainer runs.

Usage:
  python scripts/train_crop_id.py --epochs 8 --out ml/models/crop_id
"""
import argparse
import json
from datetime import datetime
from pathlib import Path

import tensorflow as tf

from ml.config import CROPS, DATA_DIR, MODEL_CONFIG
from ml.utils.model_builder import build_model, unfreeze_model
from ml.utils.tflite_converter import convert_to_tflite

CROP_NAMES = list(CROPS.keys())  # stable label order: corn, soybean, wheat, rice, tomato
IMG_SIZE = MODEL_CONFIG["input_shape"][:2]


def make_datasets(val_split: float, batch: int, seed: int):
    """Label = crop folder name. image_dataset_from_directory recurses into each
    crop's nested disease subfolders, so every leaf image is labeled by its crop.

    IMPORTANT: deliver [0, 1] floats and DO NOT use brightness augmentation —
    ImageDataGenerator(brightness_range) zeroes [0,1] float images (see
    feedback_imagedatagen_brightness_bug). The model carries its own rescaling.
    """
    common = dict(directory=str(DATA_DIR), labels="inferred", label_mode="int",
                  class_names=CROP_NAMES, image_size=IMG_SIZE, batch_size=batch, seed=seed)
    train = tf.keras.utils.image_dataset_from_directory(
        validation_split=val_split, subset="training", **common)
    val = tf.keras.utils.image_dataset_from_directory(
        validation_split=val_split, subset="validation", **common)
    norm = tf.keras.layers.Rescaling(1.0 / 255)
    aug = tf.keras.Sequential([
        tf.keras.layers.RandomFlip("horizontal"),
        tf.keras.layers.RandomRotation(0.1),
        tf.keras.layers.RandomZoom(0.1),
    ])
    AUTOTUNE = tf.data.AUTOTUNE
    train = train.map(lambda x, y: (aug(norm(x), training=True), y), AUTOTUNE).prefetch(AUTOTUNE)
    val = val.map(lambda x, y: (norm(x), y), AUTOTUNE).prefetch(AUTOTUNE)
    return train, val


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=8)
    ap.add_argument("--fine-tune-epochs", type=int, default=4)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--val-split", type=float, default=0.2)
    ap.add_argument("--seed", type=int, default=1337)
    ap.add_argument("--out", default="ml/models/crop_id")
    a = ap.parse_args()

    train, val = make_datasets(a.val_split, a.batch, a.seed)

    model = build_model(num_classes=len(CROP_NAMES), crop="crop_id")
    model.compile(optimizer="adam",
                  loss=tf.keras.losses.SparseCategoricalCrossentropy(),
                  metrics=["accuracy"])
    model.fit(train, validation_data=val, epochs=a.epochs)

    # Fine-tune the backbone for a few more epochs.
    unfreeze_model(model)
    model.fit(train, validation_data=val, epochs=a.fine_tune_epochs)

    version = "v1_" + datetime.now().strftime("%Y%m%d_%H%M%S")
    out = Path(a.out) / version
    out.mkdir(parents=True, exist_ok=True)
    model.save(out / "checkpoint.keras")
    convert_to_tflite(model, out / "model.tflite")
    json.dump({"class_names": CROP_NAMES, "input_shape": list(MODEL_CONFIG["input_shape"])},
              open(out / "metadata.json", "w"), indent=2)
    # production pointer
    json.dump({"version": version}, open(Path(a.out) / "production.json", "w"), indent=2)
    val_acc = model.evaluate(val, return_dict=True).get("accuracy")
    print(f"crop-ID model saved to {out}  val_accuracy={val_acc}")
    print("Next: load it in inference_app and gate /predict on argmax != selected_crop; "
          "then re-tune with scripts/cross_crop_sweep.py.")


if __name__ == "__main__":
    main()
