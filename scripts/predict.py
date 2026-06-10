#!/usr/bin/env python3
"""
Prediction script for CropIntel API.
Called by Next.js API route to make predictions.
"""
import os
# Suppress TensorFlow C++ and Python logs before any TF import.
# Without this, TF warnings pollute stderr and break JSON parsing in the API route.
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import sys
import json
from pathlib import Path
import numpy as np

# Add parent directory to path to import ml module
sys.path.insert(0, str(Path(__file__).parent.parent))

from PIL import Image
from ml.inference.tflite_predictor import TFLitePredictor
import tensorflow as tf
tf.get_logger().setLevel('ERROR')


def validate_image_quality(image: Image.Image):
    """
    Basic quality checks before running inference.
    Returns (is_valid, message, quality_metrics).
    """
    # Ensure we can safely analyze the image.
    if image.mode != "RGB":
        image = image.convert("RGB")

    width, height = image.size
    if width < 128 or height < 128:
        return False, "Please retake the image with the full leaf clearly visible.", {
            "width": int(width),
            "height": int(height),
            "green_ratio": 0.0,
            "sharpness": 0.0,
            "image_quality_ok": False,
        }

    arr = np.asarray(image, dtype=np.float32)
    r = arr[:, :, 0]
    g = arr[:, :, 1]
    b = arr[:, :, 2]

    # Non-plant heuristic:
    # At least a small but meaningful fraction of pixels should be green-dominant.
    green_mask = (g > 40) & (g > r * 1.05) & (g > b * 1.05)
    green_ratio = float(np.mean(green_mask))
    if green_ratio < 0.03:
        return False, "Please retake the image and include a clear plant leaf.", {
            "width": int(width),
            "height": int(height),
            "green_ratio": round(green_ratio, 4),
            "sharpness": 0.0,
            "image_quality_ok": False,
        }

    # Blur heuristic using gradient variance (higher = sharper).
    gray = 0.299 * r + 0.587 * g + 0.114 * b
    gx = np.diff(gray, axis=1)
    gy = np.diff(gray, axis=0)
    grad_energy = np.concatenate([gx.ravel(), gy.ravel()])
    sharpness = float(np.var(grad_energy))
    if sharpness < 25.0:
        return False, "Please retake the image. It appears blurry.", {
            "width": int(width),
            "height": int(height),
            "green_ratio": round(green_ratio, 4),
            "sharpness": round(sharpness, 2),
            "image_quality_ok": False,
        }

    return True, "", {
        "width": int(width),
        "height": int(height),
        "green_ratio": round(green_ratio, 4),
        "sharpness": round(sharpness, 2),
        "image_quality_ok": True,
    }


def build_farmer_verification(result: dict, quality_metrics: dict) -> dict:
    """
    Build a farmer-facing trust summary for the diagnosis.
    """
    all_predictions = result.get("all_predictions", [])
    top1 = all_predictions[0]["confidence"] if len(all_predictions) > 0 else 0.0
    top2 = all_predictions[1]["confidence"] if len(all_predictions) > 1 else 0.0
    confidence_margin = float(top1 - top2)
    meets_threshold = bool(result.get("meets_threshold", False))

    # Verification logic:
    # - verified: model confidence passes threshold and clearly beats runner-up
    # - uncertain: low confidence or ambiguous class separation
    if meets_threshold and confidence_margin >= 0.15:
        status = "verified"
        recommendation = "Diagnosis is likely reliable. Start treatment for this disease and monitor daily."
    elif quality_metrics.get("image_quality_ok", False):
        status = "uncertain"
        recommendation = (
            "Diagnosis is uncertain. Capture 2-3 more close-up leaf photos and compare top labels before treatment."
        )
    else:
        status = "retake"
        recommendation = "Retake the photo in good lighting with one leaf filling most of the frame."

    return {
        "status": status,
        "confidence_margin": round(confidence_margin * 100, 2),
        "image_quality_ok": bool(quality_metrics.get("image_quality_ok", False)),
        "recommendation": recommendation,
    }


def main():
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Usage: predict.py <image_path> <crop>"}), file=sys.stderr)
        sys.exit(1)
    
    image_path = sys.argv[1]
    crop = sys.argv[2]
    
    try:
        # Load image
        image = Image.open(image_path)

        # Validate image quality/content before inference.
        is_valid, validation_message, quality_metrics = validate_image_quality(image)
        if not is_valid:
            print(json.dumps({"error": validation_message}), file=sys.stderr)
            sys.exit(1)
        
        # Get predictor
        predictor = TFLitePredictor(crop=crop)
        
        # Make prediction
        result = predictor.predict(image)
        farmer_verification = build_farmer_verification(result, quality_metrics)
        
        # Format response
        response = {
            "success": True,
            "crop": crop,
            "disease": result["disease"],
            "confidence": round(result["confidence"] * 100, 2),
            "is_healthy": result["is_healthy"],
            "meets_threshold": result["meets_threshold"],
            "farmer_verification": farmer_verification,
            "image_quality": quality_metrics,
            "all_predictions": [
                {
                    "disease": pred["disease"],
                    "confidence": round(pred["confidence"] * 100, 2)
                }
                for pred in result["all_predictions"]
            ]
        }
        
        print(json.dumps(response))
        
    except Exception as e:
        error_response = {
            "error": str(e)
        }
        print(json.dumps(error_response), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
