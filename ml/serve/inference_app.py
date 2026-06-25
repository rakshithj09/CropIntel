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
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from ml.config import CROPS
from ml.inference.postprocess import validate_image_quality, format_response

ROOT = Path(__file__).resolve().parents[2]
PREDICTION_LOG = Path(
    os.environ.get("CROPINTEL_PREDICTION_LOG", ROOT / "data" / "predictions.jsonl")
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("inference")

app = FastAPI(title="CropIntel Inference Service", docs_url=None, redoc_url=None)

_cors_origins = [
    origin.strip().rstrip("/")
    for origin in os.environ.get(
        "CROPINTEL_CORS_ORIGINS",
        "http://localhost:3050,http://127.0.0.1:3050",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# crop -> {"predictor": TFLitePredictor|None, "error": str|None, "lock": Lock}
# TFLite interpreters are not thread-safe; every predict() call takes the
# crop's lock. Run uvicorn with a single worker.
_registry: dict = {}
_registry_lock = threading.Lock()
_log_lock = threading.Lock()

# ---- Cross-crop mismatch gate -------------------------------------------------
# A leaf photographed of one crop but submitted under another (e.g. a tomato leaf
# sent to the corn model) gets force-classified into a wrong-crop disease. We
# guard against it by also scoring the image with the OTHER crop models (all are
# already in memory) and blocking when a different crop fits clearly better.
#
# Thresholds were chosen from live cross-crop probes and are env-tunable:
#  - If the selected crop is already strongly confident, skip the cross-crop pass
#    entirely (no extra compute, and a confident correct leaf can never be
#    falsely rejected).
#  - Otherwise block only when another crop is itself confident AND beats the
#    selected crop by a clear margin — so genuinely close calls stay accepted.
# All confidences below are fractions in [0, 1].
CROP_STRONG_CONF = float(os.environ.get("CROPINTEL_CROP_STRONG_CONF", "0.85"))
CROP_MISMATCH_MARGIN = float(os.environ.get("CROPINTEL_CROP_MISMATCH_MARGIN", "0.15"))
CROP_OTHER_MIN_CONF = float(os.environ.get("CROPINTEL_CROP_OTHER_MIN_CONF", "0.75"))


def _cross_crop_check(pil_image, selected_crop: str, selected_conf: float,
                      selected_nic: bool) -> dict:
    """Decide whether the image looks more like a different crop than selected.

    selected_conf is the selected crop's top-1 confidence as a fraction [0, 1].
    Returns {crop_mismatch, suggested_crop, suggested_confidence(0-100|None)}.
    """
    no_mismatch = {"crop_mismatch": False, "suggested_crop": None,
                   "suggested_confidence": None}

    # A confident, in-catalog result for the selected crop is trusted as-is.
    if selected_conf >= CROP_STRONG_CONF and not selected_nic:
        return no_mismatch

    best_crop, best_conf = None, 0.0
    for other, entry in _registry.items():
        if other == selected_crop:
            continue
        p = entry.get("predictor")
        if p is None:
            continue
        try:
            with entry["lock"]:
                r = p.predict(pil_image)
            c = float(r.get("confidence", 0.0))
        except Exception:
            log.warning("cross-crop check failed for %s", other, exc_info=True)
            continue
        if c > best_conf:
            best_conf, best_crop = c, other

    mismatch = (
        best_crop is not None
        and best_conf >= CROP_OTHER_MIN_CONF
        and (best_conf - selected_conf) >= CROP_MISMATCH_MARGIN
    )
    if not mismatch:
        return no_mismatch
    return {
        "crop_mismatch": True,
        "suggested_crop": best_crop,
        "suggested_confidence": round(best_conf * 100, 2),
    }


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

    data = await image.read()
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

    # Wrong-crop guard: only when the selected crop is unsure, see if a different
    # crop fits clearly better and, if so, block with a suggestion.
    try:
        cross = _cross_crop_check(
            pil_image, crop,
            selected_conf=float(result["confidence"]),
            selected_nic=bool(fv["not_in_catalog"]),
        )
    except Exception:
        log.exception("cross-crop gate errored for %s", crop)
        cross = {"crop_mismatch": False, "suggested_crop": None,
                 "suggested_confidence": None}
    response.update(cross)

    record.update({
        "disease": response["disease"],
        "confidence": response["confidence"],
        "entropy": fv["entropy"],
        "verification_status": fv["status"],
        "not_in_catalog": fv["not_in_catalog"],
        "crop_mismatch": cross["crop_mismatch"],
        "suggested_crop": cross["suggested_crop"],
    })
    return finish(response, 200, "ok")
