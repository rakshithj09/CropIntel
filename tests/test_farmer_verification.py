"""Out-of-catalog detection and the farmer-facing verification summary."""
import math

from ml.inference.postprocess import _softmax_entropy, build_farmer_verification

GOOD_QUALITY = {"image_quality_ok": True}
BAD_QUALITY = {"image_quality_ok": False}


def _result(predictions, meets_threshold):
    return {
        "all_predictions": [
            {"disease": d, "confidence": c} for d, c in predictions
        ],
        "meets_threshold": meets_threshold,
    }


def test_entropy_uniform_is_one():
    assert math.isclose(_softmax_entropy([0.25, 0.25, 0.25, 0.25]), 1.0, abs_tol=1e-9)


def test_entropy_onehot_is_zero():
    assert _softmax_entropy([1.0, 0.0, 0.0, 0.0]) < 0.01


def test_verified_status():
    fv = build_farmer_verification(
        _result([("Common Rust", 0.95), ("Blight", 0.03)], True), GOOD_QUALITY
    )
    assert fv["status"] == "verified"
    assert not fv["not_in_catalog"]


def test_uncertain_when_margin_small():
    fv = build_farmer_verification(
        _result([("Common Rust", 0.48), ("Blight", 0.40)], True), GOOD_QUALITY
    )
    assert fv["status"] == "uncertain"
    assert "Common Rust" in fv["recommendation"]
    assert not fv["not_in_catalog"]


def test_unknown_flags_out_of_catalog():
    fv = build_farmer_verification(
        _result([("Common Rust", 0.30), ("Blight", 0.28)], False), GOOD_QUALITY,
        crop="corn", known_diseases=["Common Rust", "Blight", "Healthy"],
    )
    assert fv["status"] == "unknown"
    assert fv["not_in_catalog"]
    assert "corn" in fv["recommendation"]
    # healthy is excluded from the disease list shown to the farmer
    assert "Healthy" not in fv["recommendation"]


def test_retake_when_quality_bad():
    fv = build_farmer_verification(
        _result([("Common Rust", 0.95), ("Blight", 0.03)], True), BAD_QUALITY
    )
    assert fv["status"] == "retake"
