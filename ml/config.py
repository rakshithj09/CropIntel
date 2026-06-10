"""
Configuration for ML training and inference pipeline.
"""
import os
from pathlib import Path
from typing import Dict, List

# Optional soybean Healthy-class images (e.g. Mendeley "Soybean Healthy" folder).
# Set CROPINTEL_SOYBEAN_HEALTHY_DIRS to a pathsep-separated list of folders containing images.
# If unset, a default under ~/Soybean Healthy and Diseased Images Dataset/Soybean Healthy is used when present.


def _soybean_extra_healthy_image_dirs() -> List[Path]:
    dirs: List[Path] = []
    seen: set = set()
    env_raw = os.environ.get("CROPINTEL_SOYBEAN_HEALTHY_DIRS", "")
    if env_raw.strip():
        for part in env_raw.split(os.pathsep):
            p = Path(part.strip()).expanduser()
            if p.is_dir():
                key = p.resolve()
                if key not in seen:
                    seen.add(key)
                    dirs.append(p)
    default = Path.home() / "Soybean Healthy and Diseased Images Dataset" / "Soybean Healthy"
    if default.is_dir():
        key = default.resolve()
        if key not in seen:
            dirs.append(default)
    return dirs


SOYBEAN_EXTRA_HEALTHY_IMAGE_DIRS = _soybean_extra_healthy_image_dirs()

# Base paths
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
TRAINING_DIR = BASE_DIR / "training"

# Create directories if they don't exist
DATA_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)
TRAINING_DIR.mkdir(exist_ok=True)

# Crop configurations
# Each crop uses four classes: three high-volume diseases + Healthy (see loader + supplemental/).
# Optional extra images: place folders under ml/data/<crop>/supplemental/ that match class names, or run
#   python -m ml.scripts.download_datasets --supplemental --crop <crop> [--dataset user/slug]
# If supplemental_dataset_name is set below, --supplemental uses it as the default slug.
CROPS = {
    "corn": {
        "dataset_name": "smaranjitghose/corn-or-maize-leaf-disease-dataset",
        "diseases": [
            "Common Rust",
            "Gray Leaf Spot",
            "Blight",
            "Healthy",
        ],
        "supplemental_dataset_name": None,
        "image_size": (224, 224),
    },
    "soybean": {
        "dataset_name": "sivm205/soybean-diseased-leaf-dataset",
        # Top three disease folders by count in sivm205 + Healthy (extras via soybean_healthy / Mendeley)
        "diseases": [
            "Powdery Mildew",
            "Sudden Death Syndrome",
            "Yellow Mosaic",
            "Healthy",
        ],
        "supplemental_dataset_name": None,
        "image_size": (224, 224),
    },
    "wheat": {
        "dataset_name": "kushagra3204/wheat-plant-diseases",
        # Top three mapped train folders (Yellow Rust, Brown Rust, Mildew) + Healthy; Stem Rust dropped
        "diseases": [
            "Stripe (Yellow) Rust",
            "Leaf Rust",
            "Powdery Mildew",
            "Healthy",
        ],
        "supplemental_dataset_name": None,
        "image_size": (224, 224),
    },
    "rice": {
        "dataset_name": "anshulm257/rice-disease-dataset",
        "diseases": [
            "Rice Blast",
            "Bacterial Leaf Blight",
            "Brown Spot",
            "Healthy",
        ],
        "supplemental_dataset_name": None,
        "image_size": (224, 224),
    },
}

# Training hyperparameters
TRAINING_CONFIG = {
    "batch_size": 32,
    "epochs": 60,
    "learning_rate": 0.001,
    "validation_split": 0.2,
    "test_split": 0.1,
    "image_size": (224, 224),
    "num_channels": 3,
    "augmentation": True,
}

# Model architecture (using EfficientNetB0 for good accuracy/speed balance)
MODEL_CONFIG = {
    "base_model": "EfficientNetB0",
    "include_top": False,
    "weights": "imagenet",
    "input_shape": (224, 224, 3),
    "dropout_rate": 0.5,
    "dense_units": 512,
}

# TensorFlow Lite conversion settings
TFLITE_CONFIG = {
    "optimize": True,
    "quantization": "float16",  # Options: None, "float16", "int8"
    "representative_dataset_size": 100,
}

# Confidence threshold for production inference
CONFIDENCE_THRESHOLD = 0.7

# Model versioning
MODEL_VERSION_FORMAT = "v{version}_{timestamp}"
