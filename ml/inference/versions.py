"""
Model version resolution shared by all predictors.

A crop's serving version is chosen in this order:
  1. ml/models/<crop>/production.json — pointer file written by
     ml/scripts/promote_model.py: {"version": ..., "previous": ..., ...}.
     Ignored (with a warning) if it names an incomplete/missing version.
  2. Latest complete version by _version_rank (today's behavior).
"""
import json
import sys
from pathlib import Path
from typing import Optional


def _is_complete_model_version(crop_dir: Path, version_name: str) -> bool:
    """Weights + class names; skips empty dirs and runs stopped before metadata export."""
    vd = crop_dir / version_name
    if not vd.is_dir():
        return False
    has_weights = (
        (vd / "model.tflite").exists()
        or (vd / "checkpoint.keras").exists()
        or (vd / "model.onnx").exists()
    )
    has_labels = (vd / "metadata.json").exists() or (vd / "label_map.json").exists()
    return has_weights and has_labels


def _version_rank(crop_dir: Path, version_name: str) -> tuple:
    """
    Prefer fully finished exports (TFLite + evaluated metrics), then lexical version id
    (timestamp suffix) so incomplete re-runs do not beat a good checkpoint.
    ONNX pretrained models rank below trained TFLite/Keras models but above incomplete runs.
    """
    vd = crop_dir / version_name
    has_tflite  = (vd / "model.tflite").exists()
    has_metrics = (vd / "metrics.json").exists()
    has_onnx    = (vd / "model.onnx").exists()
    # (has_tflite, has_metrics, has_onnx, version_name)
    # Fully trained TFLite+metrics > trained TFLite > pretrained ONNX > bare checkpoint
    return (has_tflite and has_metrics, has_tflite, has_onnx, version_name)


def _iter_usable_versions(crop_dir: Path) -> list:
    if not crop_dir.is_dir():
        return []
    return [
        d.name
        for d in crop_dir.iterdir()
        if d.is_dir() and _is_complete_model_version(crop_dir, d.name)
    ]


def read_production_pointer(crop_dir: Path) -> Optional[dict]:
    """Parsed production.json for a crop dir, or None if absent/unreadable."""
    path = crop_dir / "production.json"
    if not path.exists():
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def resolve_version(crop_dir: Path) -> Optional[str]:
    """Serving version for a crop: production pointer first, else latest complete."""
    pointer = read_production_pointer(crop_dir)
    if pointer:
        pinned = pointer.get("version")
        if pinned and _is_complete_model_version(crop_dir, pinned):
            return pinned
        print(f"[versions] production.json in {crop_dir} names unusable version "
              f"{pinned!r}; falling back to latest", file=sys.stderr)

    versions = sorted(
        _iter_usable_versions(crop_dir),
        key=lambda n: _version_rank(crop_dir, n),
    )
    return versions[-1] if versions else None
