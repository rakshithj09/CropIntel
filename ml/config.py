"""
Configuration for ML training and inference pipeline.
"""
import os
from pathlib import Path
from typing import Dict, List

# NOTE: the old CROPINTEL_SOYBEAN_HEALTHY_DIRS / Mendeley-Healthy injection was
# removed. Mixing Healthy from a different source than the disease images made
# the model detect the image source instead of the disease (fake 100% accuracy).
# Soybean now trains on a single-acquisition dataset (see CROPS["soybean"]).

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
        # Single-acquisition dataset (healthy + diseases from one camera program).
        # The previous mix (sivm205 diseases + Mendeley Healthy) taught the model
        # to detect the image SOURCE, not the disease — fake 100% test accuracy.
        "dataset_name": "vaishaligbhujade/soybean-leaf-dataset-for-disease-classification",
        "diseases": [
            "Rust",
            "Frogeye Leaf Spot",
            "Bacterial Pustule",
            "Target Leaf Spot",
            "Yellow Mosaic",
            "Sudden Death Syndrome",
            "Healthy",
        ],
        "supplemental_dataset_name": None,
        "image_size": (224, 224),
    },
    "wheat": {
        "dataset_name": "kushagra3204/wheat-plant-diseases",
        # Expanded 2026-06-10 from 4 → 8 classes (all ≥576 imgs in the dataset).
        # The three rusts + mildew + healthy, plus Septoria, Loose Smut, and
        # Fusarium Head Blight (high-impact field diseases).
        "diseases": [
            "Stripe (Yellow) Rust",
            "Leaf Rust",
            "Stem Rust",
            "Powdery Mildew",
            "Septoria",
            "Loose Smut",
            "Fusarium Head Blight",
            "Healthy",
        ],
        "supplemental_dataset_name": None,
        "image_size": (224, 224),
    },
    "rice": {
        "dataset_name": "anshulm257/rice-disease-dataset",
        # supplemental/: Paddy Doctor field images (imbikramsaha/paddy-doctor) —
        # added after the v1 model scored 0.6% on external field photos (it
        # predicted "Healthy" for nearly everything outside the lab-style
        # training distribution).
        "diseases": [
            "Rice Blast",
            "Bacterial Leaf Blight",
            "Brown Spot",
            "Healthy",
        ],
        # Brown Spot and Rice Blast lesions are visually inseparable on white-
        # background field leaves (Dhan-Shomadhan), so a 4-class model confidently
        # mislabels Brown Spot as Blast (29.6% recall). Collapse them into one
        # honest "fungal leaf lesion" class — both folders still load, but train
        # under one label. See [[rice-data-lever-exhausted]].
        "label_aliases": {
            "Rice Blast": "Blast or Brown Spot",
            "Brown Spot": "Blast or Brown Spot",
        },
        "supplemental_dataset_name": "imbikramsaha/paddy-doctor",
        "image_size": (224, 224),
    },
    "tomato": {
        # Multi-source (lab + field) — single-style datasets taught rice/soybean
        # shortcuts, so tomato starts with the diverse mix.
        "dataset_name": "cookiefinder/tomato-disease-multiple-sources",
        # Trimmed 2026-06-13 from 11 -> 8 classes. Spider Mites, Target Spot and
        # Powdery Mildew were dropped: none have PlantDoc field supplemental data
        # and none have external holdout support (Spider Mites 2 imgs at 0%
        # recall; the other two have zero external test images), so the 11-class
        # model couldn't be honestly validated on them and they dragged field
        # accuracy down. Spider Mites is also a pest, not a pathogen. The kept 8
        # are real, testable tomato diseases (incl. both blights). See
        # [[project_tomato_trim]].
        "diseases": [
            "Bacterial Spot",
            "Early Blight",
            "Late Blight",
            "Leaf Mold",
            "Septoria Leaf Spot",
            "Yellow Leaf Curl Virus",
            "Mosaic Virus",
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
