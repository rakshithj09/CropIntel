"""
CropIntel inference service.

Persistent FastAPI app that loads every crop's model once at startup and serves
predictions over localhost HTTP — replaces the old subprocess-per-request flow
(scripts/predict.py is kept as a debugging CLI). The Next.js API route
(app/api/predict/route.ts) forwards multipart uploads here.

Run:
  python -m uvicorn ml.serve.inference_app:app --host 127.0.0.1 --port 8000

Endpoints:
  POST /predict       multipart form (image, crop) -> prediction JSON
  GET  /healthz       liveness (always 200 once the process is up)
  GET  /readyz        readiness: 200 if all configured crops loaded, else 503
  GET  /models        per-crop version/classes/backend for ops debugging
  POST /admin/reload  re-resolve production pointers and reload predictors

Environment:
  CROPINTEL_BACKEND=tflite      force TFLite models (recommended in prod: ~9 MB
                                per crop in memory instead of ~41 MB Keras)
  CROPINTEL_PREDICTION_LOG      JSONL audit log path (default: data/predictions.jsonl)
  CROPINTEL_ADMIN_TOKEN         if set, /admin/reload requires X-Admin-Token header
"""
import hashlib
import io
import json
import logging
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image

from ml.config import CROPS
from ml.inference.postprocess import validate_image_quality, format_response

ROOT = Path(__file__).resolve().parents[2]
MAX_UPLOAD_BYTES = int(os.environ.get("CROPINTEL_MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
PREDICTION_LOG = Path(
    os.environ.get("CROPINTEL_PREDICTION_LOG", ROOT / "data" / "predictions.jsonl")
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("inference")

app = FastAPI(title="CropIntel Inference Service", docs_url=None, redoc_url=None)

# crop -> {"predictor": TFLitePredictor|None, "error": str|None, "lock": Lock}
# TFLite interpreters are not thread-safe; every predict() call takes the
# crop's lock. Run uvicorn with a single worker.
_registry: dict = {}
_registry_lock = threading.Lock()
_log_lock = threading.Lock()


def _load_crop(crop: str) -> dict:
    from ml.inference.tflite_predictor import TFLitePredictor
    entry = {"predictor": None, "error": None, "lock": threading.Lock()}
    try:
        entry["predictor"] = TFLitePredictor(crop)
        p = entry["predictor"]
        backend = "tflite" if not getattr(p, "use_keras", False) else "keras"
        log.info("loaded %s %s (%s): %s", crop, p.version, backend, p.class_names)
    except Exception as e:
        entry["error"] = str(e)
        log.warning("could not load model for %s: %s", crop, e)
    return entry


def _load_all() -> None:
    with _registry_lock:
        for crop in CROPS:
            _registry[crop] = _load_crop(crop)


def _audit(record: dict) -> None:
    """Append one JSON line per request; failures must never break a response."""
    try:
        PREDICTION_LOG.parent.mkdir(parents=True, exist_ok=True)
        with _log_lock, open(PREDICTION_LOG, "a") as f:
            f.write(json.dumps(record) + "\n")
    except OSError as e:
        log.error("audit log write failed: %s", e)


def _has_valid_image_signature(data: bytes, content_type: str) -> bool:
    if content_type == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/webp":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    return False


@app.on_event("startup")
def startup() -> None:
    _load_all()


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/readyz")
def readyz():
    crops = {}
    all_loaded = True
    for crop, entry in _registry.items():
        p = entry["predictor"]
        if p is not None:
            crops[crop] = {"loaded": True, "version": p.version}
        else:
            crops[crop] = {"loaded": False, "error": entry["error"]}
            all_loaded = False
    status = 200 if all_loaded and crops else 503
    return JSONResponse({"ready": status == 200, "crops": crops}, status_code=status)


@app.get("/models")
def models():
    out = {}
    for crop, entry in _registry.items():
        p = entry["predictor"]
        if p is None:
            out[crop] = {"loaded": False, "error": entry["error"]}
        else:
            out[crop] = {
                "loaded": True,
                "version": p.version,
                "backend": "keras" if getattr(p, "use_keras", False) else "tflite",
                "classes": p.class_names,
            }
    return out


@app.post("/admin/reload")
def admin_reload(request: Request):
    expected = os.environ.get("CROPINTEL_ADMIN_TOKEN")
    if expected and request.headers.get("X-Admin-Token") != expected:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    _load_all()
    return models()


@app.post("/predict")
async def predict(image: UploadFile = File(...), crop: str = Form(...)):
    started = time.monotonic()
    crop = crop.strip().lower()
    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "crop": crop,
        "outcome": "error",
        "model_version": None,
        "disease": None,
        "confidence": None,
        "entropy": None,
        "verification_status": None,
        "not_in_catalog": None,
        "image_sha256": None,
        "image_quality": None,
        "latency_ms": None,
    }

    def finish(payload: dict, status: int, outcome: str):
        record["outcome"] = outcome
        record["latency_ms"] = round((time.monotonic() - started) * 1000, 1)
        _audit(record)
        return JSONResponse(payload, status_code=status)

    if crop not in CROPS:
        return finish({"error": f"Unknown crop: {crop}"}, 400, "bad_crop")

    entry = _registry.get(crop)
    if entry is None or entry["predictor"] is None:
        # Message matches route.ts's "no trained models found" mapping.
        return finish({"error": f"No trained models found for {crop}"}, 503, "no_model")

    content_type = (image.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        return finish({"error": "Upload a JPEG, PNG, or WebP crop photo."}, 400, "bad_type")

    data = await image.read(MAX_UPLOAD_BYTES + 1)
    if not data or len(data) > MAX_UPLOAD_BYTES:
        return finish({"error": "Upload an image smaller than 10MB."}, 400, "bad_size")
    if not _has_valid_image_signature(data, content_type):
        return finish({"error": "Upload a valid JPEG, PNG, or WebP crop photo."}, 400, "bad_signature")

    record["image_sha256"] = hashlib.sha256(data).hexdigest()
    try:
        pil_image = Image.open(io.BytesIO(data))
        pil_image.load()
    except Exception:
        return finish(
            {"error": "Please retake the image with the full leaf clearly visible."},
            400, "unreadable_image",
        )

    is_valid, message, quality_metrics = validate_image_quality(pil_image)
    record["image_quality"] = quality_metrics
    if not is_valid:
        return finish({"error": message}, 400, "retake")

    predictor = entry["predictor"]
    record["model_version"] = predictor.version
    try:
        with entry["lock"]:
            result = predictor.predict(pil_image)
    except Exception as e:
        log.exception("inference failed for %s", crop)
        record["error"] = str(e)
        return finish({"error": "Prediction failed. Please try again later."}, 500, "error")

    response = format_response(
        result, quality_metrics, crop=crop,
        known_diseases=getattr(predictor, "class_names", []),
    )
    fv = response["farmer_verification"]
    record.update({
        "disease": response["disease"],
        "confidence": response["confidence"],
        "entropy": fv["entropy"],
        "verification_status": fv["status"],
        "not_in_catalog": fv["not_in_catalog"],
    })
    return finish(response, 200, "ok")
