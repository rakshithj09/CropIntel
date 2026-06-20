#!/usr/bin/env python3
"""
Prediction CLI for CropIntel.

Thin wrapper around ml.inference.postprocess — the same logic the inference
service (ml/serve/inference_app.py) uses. Kept for debugging and as a fallback;
production traffic goes through the service.
"""
import os
# Suppress TensorFlow C++ and Python logs before any TF import.
# Without this, TF warnings pollute stderr and break JSON parsing in the API route.
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import sys
import json
from pathlib import Path

# Add parent directory to path to import ml module
sys.path.insert(0, str(Path(__file__).parent.parent))

from PIL import Image
from ml.inference.postprocess import validate_image_quality, format_response
from ml.inference.tflite_predictor import TFLitePredictor
import tensorflow as tf
tf.get_logger().setLevel('ERROR')


def main():
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Usage: predict.py <image_path> <crop>"}), file=sys.stderr)
        sys.exit(1)

    image_path = sys.argv[1]
    crop = sys.argv[2]

    try:
        image = Image.open(image_path)

        # Validate image quality/content before inference.
        is_valid, validation_message, quality_metrics = validate_image_quality(image)
        if not is_valid:
            print(json.dumps({"error": validation_message}), file=sys.stderr)
            sys.exit(1)

        predictor = TFLitePredictor(crop=crop)
        result = predictor.predict(image)
        response = format_response(
            result, quality_metrics, crop=crop,
            known_diseases=getattr(predictor, "class_names", []),
        )
        print(json.dumps(response))

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
