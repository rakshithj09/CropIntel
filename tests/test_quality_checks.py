"""Image quality validation — message strings are part of the API contract:
app/api/predict/route.ts string-matches them to map errors to HTTP 400."""
from ml.inference.postprocess import validate_image_quality


def test_good_image_passes(green_leaf_image):
    ok, message, metrics = validate_image_quality(green_leaf_image)
    assert ok
    assert message == ""
    assert metrics["image_quality_ok"] is True
    assert metrics["width"] == 256
    assert metrics["green_ratio"] > 0.03
    assert metrics["sharpness"] >= 25.0


def test_tiny_image_rejected(tiny_image):
    ok, message, metrics = validate_image_quality(tiny_image)
    assert not ok
    assert message == "Please retake the image with the full leaf clearly visible."
    assert metrics["image_quality_ok"] is False


def test_non_plant_image_rejected(gray_image):
    ok, message, metrics = validate_image_quality(gray_image)
    assert not ok
    assert message == "Please retake the image and include a clear plant leaf."
    assert metrics["green_ratio"] < 0.03


def test_blurry_image_rejected(blurry_image):
    ok, message, metrics = validate_image_quality(blurry_image)
    assert not ok
    assert message == "Please retake the image. It appears blurry."
    assert metrics["sharpness"] < 25.0


def test_rgba_image_handled(green_leaf_image):
    rgba = green_leaf_image.convert("RGBA")
    ok, _, _ = validate_image_quality(rgba)
    assert ok
