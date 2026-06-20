"""
Shared pre/post-processing for prediction endpoints.

Single source of truth for image quality validation, out-of-catalog detection,
the farmer-facing verification summary, and the response JSON shape. Used by
both the CLI (scripts/predict.py) and the inference service
(ml/serve/inference_app.py). The Next.js API route string-matches the
user-facing error messages below — change them only together with
app/api/predict/route.ts.
"""
import numpy as np
from PIL import Image


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


def _softmax_entropy(probs) -> float:
    """Normalized entropy in [0,1]; ~1 means the model spreads probability evenly
    across classes (doesn't recognize any one disease) — an out-of-catalog signal."""
    p = np.asarray([max(float(x), 1e-12) for x in probs], dtype=np.float64)
    p = p / p.sum()
    ent = -np.sum(p * np.log(p))
    max_ent = np.log(len(p)) if len(p) > 1 else 1.0
    return float(ent / max_ent) if max_ent > 0 else 0.0


def build_farmer_verification(result: dict, quality_metrics: dict,
                              crop: str = "", known_diseases=None) -> dict:
    """
    Build a farmer-facing trust summary for the diagnosis.

    Adds an explicit "not in our catalog" state: when the image is a usable leaf
    photo but the model cannot confidently match ANY known disease (low top-1
    confidence and/or a near-uniform probability spread), we say so instead of
    forcing a misleading label.
    """
    known_diseases = known_diseases or []
    all_predictions = result.get("all_predictions", [])
    top1 = all_predictions[0]["confidence"] if len(all_predictions) > 0 else 0.0
    top2 = all_predictions[1]["confidence"] if len(all_predictions) > 1 else 0.0
    confidence_margin = float(top1 - top2)
    meets_threshold = bool(result.get("meets_threshold", False))
    quality_ok = bool(quality_metrics.get("image_quality_ok", False))

    entropy = _softmax_entropy([p["confidence"] for p in all_predictions])
    disease_list = ", ".join(d for d in known_diseases if d.lower() != "healthy")

    not_in_catalog = False
    catalog_message = ""

    if not quality_ok:
        status = "retake"
        recommendation = "Retake the photo in good lighting with one leaf filling most of the frame."
    elif meets_threshold and confidence_margin >= 0.15:
        status = "verified"
        recommendation = "Diagnosis is likely reliable. Start treatment for this disease and monitor daily."
    elif meets_threshold and confidence_margin < 0.15:
        # Confident-ish, but the top two known classes are close together.
        second = all_predictions[1]["disease"] if len(all_predictions) > 1 else ""
        status = "uncertain"
        recommendation = (
            f"The top two labels are close ({all_predictions[0]['disease']} vs {second}). "
            "Capture 2-3 more close-up leaf photos and compare before treating."
        )
    else:
        # Usable leaf photo, but no known disease scores confidently → likely a
        # disease outside our catalog (or healthy / very early / atypical).
        status = "unknown"
        not_in_catalog = True
        catalog_message = (
            f"This leaf doesn't clearly match any {crop or 'crop'} condition we currently detect"
            + (f" ({disease_list})" if disease_list else "")
            + ". It may be a disease we don't cover yet, a healthy leaf, or an early/atypical "
            "case. Treat the top guess with caution and consider an agricultural expert."
        )
        recommendation = catalog_message

    return {
        "status": status,
        "confidence_margin": round(confidence_margin * 100, 2),
        "image_quality_ok": quality_ok,
        "entropy": round(entropy, 3),
        "not_in_catalog": not_in_catalog,
        "recommendation": recommendation,
    }


def format_response(result: dict, quality_metrics: dict, crop: str,
                    known_diseases=None) -> dict:
    """Assemble the prediction response consumed by app/api/predict/route.ts."""
    known_diseases = list(known_diseases or [])
    farmer_verification = build_farmer_verification(
        result, quality_metrics, crop=crop, known_diseases=known_diseases
    )
    return {
        "success": True,
        "crop": crop,
        "disease": result["disease"],
        "confidence": round(result["confidence"] * 100, 2),
        "is_healthy": result["is_healthy"],
        "meets_threshold": result["meets_threshold"],
        "not_in_catalog": farmer_verification["not_in_catalog"],
        "catalog_message": farmer_verification["recommendation"] if farmer_verification["not_in_catalog"] else "",
        "known_diseases": known_diseases,
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
