"""
Model building utilities for crop disease classification.
"""
from tensorflow import keras
from tensorflow.keras import layers, applications
from typing import Optional

from ml.config import MODEL_CONFIG, CROPS


def build_model(
    num_classes: int,
    crop: str,
    *,
    from_scratch: bool = False,
    architecture: str = "EfficientNetB0",
) -> keras.Model:
    """
    Build a transfer learning model for crop disease classification.

    Args:
        num_classes: Number of disease classes (including healthy)
        crop: Crop name for logging
        from_scratch: If True, ImageNet weights are not loaded.
        architecture: Backbone name — any keras.applications class, e.g.
            'EfficientNetB0', 'MobileNetV2', 'ResNet50V2'.

    Returns:
        Compiled Keras model
    """
    config = MODEL_CONFIG

    weights: Optional[str] = None if from_scratch else config["weights"]

    # Load base model dynamically by architecture name
    if not hasattr(applications, architecture):
        raise ValueError(f"Unknown architecture '{architecture}'. "
                         f"Must be a keras.applications class name.")
    base_model = getattr(applications, architecture)(
        include_top=config["include_top"],
        weights=weights,
        input_shape=config["input_shape"]
    )

    if from_scratch or weights is None:
        # Random backbone: must train all layers; forward must follow global training mode
        # so batch norm / dropout behave correctly.
        base_model.trainable = True
    else:
        # Freeze base model initially (will unfreeze later in fine-tuning)
        base_model.trainable = False
    
    # Build model
    inputs = keras.Input(shape=config["input_shape"])

    # TF 2.21+ EfficientNet models include a built-in Rescaling(1/255) layer that
    # expects [0, 255] input. All other architectures (MobileNetV2, ResNet50V2, …)
    # have no built-in input scaling; their preprocess_input maps [0, 255] → [-1, 1],
    # so we replicate that directly. In both branches the data pipeline delivers [0, 1]
    # and the model contains the full normalisation.
    if architecture.lower().startswith("efficientnet"):
        # [0,1] → [0,255] so EfficientNet's internal Rescaling(1/255) gives [0,1].
        x = layers.Rescaling(scale=255.0, offset=0.0, name="input_rescaling")(inputs)
    else:
        # [0,1] → [-1,1] — equivalent to mobilenet_v2/resnet_v2 preprocess_input.
        x = layers.Rescaling(scale=2.0, offset=-1.0, name="input_rescaling")(inputs)
    
    # Base model: frozen pretrained stacks use inference BN; trainable backbone follows fit/predict mode.
    if base_model.trainable:
        x = base_model(x)
    else:
        x = base_model(x, training=False)
    
    # Global average pooling
    x = layers.GlobalAveragePooling2D()(x)

    l2 = keras.regularizers.l2(0.0001)

    # Single dense head — no BN to avoid instability when switching Phase 1→2.
    # The backbone already has batch normalisation; adding more BN here causes
    # running-stat drift that hurts validation after the backbone is unfrozen.
    x = layers.Dense(256, activation='relu', kernel_regularizer=l2)(x)
    x = layers.Dropout(0.4)(x)

    # Output layer
    outputs = layers.Dense(num_classes, activation='softmax')(x)
    
    model = keras.Model(inputs, outputs, name=f"{crop}_disease_classifier")
    
    # Phase 1 (frozen backbone): moderate LR for classifier head convergence.
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.0001),
        loss=keras.losses.CategoricalCrossentropy(label_smoothing=0.1),
        metrics=['accuracy']
    )

    return model


def unfreeze_model(model: keras.Model, fine_tune_at: int = 50, lr: float = 1e-4):
    """
    Unfreeze top layers of base model for fine-tuning.

    Args:
        model: Keras model
        fine_tune_at: Number of layers from top to unfreeze
        lr: Learning rate for the fine-tuning optimizer
    """
    base_model = model.layers[2]  # Input -> Rescaling -> backbone (index consistent across architectures)

    # Unfreeze top layers
    base_model.trainable = True
    for layer in base_model.layers[:-fine_tune_at]:
        layer.trainable = False

    # Phase 2: compile with caller-specified LR (no ReduceLROnPlateau collapse)
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=lr),
        loss=keras.losses.CategoricalCrossentropy(label_smoothing=0.1),
        metrics=['accuracy']
    )

    return model
