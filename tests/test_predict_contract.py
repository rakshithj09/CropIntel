"""Inference service contract tests.

Lock the JSON response shape that app/api/predict/route.ts consumes, including
the error-message strings it string-matches. Tests that need real model weights
are marked needs_model and skip automatically (e.g. in CI, where ml/models/ is
not committed).
"""
import io

import pytest

pytest.importorskip("fastapi")
from fastapi.testclient import TestClient  # noqa: E402

from tests.conftest import crops_with_models  # noqa: E402

RESPONSE_KEYS = {
    "success", "crop", "disease", "confidence", "is_healthy", "meets_threshold",
    "not_in_catalog", "catalog_message", "known_diseases", "farmer_verification",
    "image_quality", "all_predictions",
}
VERIFICATION_KEYS = {
    "status", "confidence_margin", "image_quality_ok", "entropy",
    "not_in_catalog", "recommendation",
}


@pytest.fixture(scope="module")
def client():
    from ml.serve.inference_app import app
    with TestClient(app) as c:  # context manager triggers startup (model loading)
        yield c


def _png_bytes(image) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def test_healthz(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_unknown_crop_rejected(client, green_leaf_image):
    r = client.post("/predict", data={"crop": "banana"},
                    files={"image": ("leaf.png", _png_bytes(green_leaf_image), "image/png")})
    assert r.status_code == 400
    assert "Unknown crop" in r.json()["error"]


@pytest.mark.needs_model
@pytest.mark.parametrize("crop", crops_with_models() or ["__none__"])
def test_predict_contract(client, green_leaf_image, crop):
    if crop == "__none__":
        pytest.skip("no trained models available")
    r = client.post("/predict", data={"crop": crop},
                    files={"image": ("leaf.png", _png_bytes(green_leaf_image), "image/png")})
    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) == RESPONSE_KEYS
    assert body["success"] is True
    assert body["crop"] == crop
    # confidence is a 0-100 percentage, not a 0-1 probability
    assert 0.0 <= body["confidence"] <= 100.0
    assert set(body["farmer_verification"].keys()) == VERIFICATION_KEYS
    confs = [p["confidence"] for p in body["all_predictions"]]
    assert confs == sorted(confs, reverse=True)
    assert body["disease"] in body["known_diseases"]


@pytest.mark.needs_model
def test_tiny_image_maps_to_retake_message(client, tiny_image):
    crops = crops_with_models()
    if not crops:
        pytest.skip("no trained models available")
    r = client.post("/predict", data={"crop": crops[0]},
                    files={"image": ("leaf.png", _png_bytes(tiny_image), "image/png")})
    assert r.status_code == 400
    # exact string matched by route.ts
    assert r.json()["error"] == "Please retake the image with the full leaf clearly visible."


def test_missing_model_returns_503(client, green_leaf_image, monkeypatch):
    from ml.serve import inference_app
    import threading
    monkeypatch.setitem(
        inference_app._registry, "corn",
        {"predictor": None, "error": "boom", "lock": threading.Lock()},
    )
    r = client.post("/predict", data={"crop": "corn"},
                    files={"image": ("leaf.png", _png_bytes(green_leaf_image), "image/png")})
    assert r.status_code == 503
    # phrase matched by route.ts's model-not-ready branch
    assert "no trained models found" in r.json()["error"].lower()
