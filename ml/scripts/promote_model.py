#!/usr/bin/env python3
"""
Promote, roll back, and inspect serving model versions.

The serving version per crop is pinned by ml/models/<crop>/production.json:
  {"version": "...", "previous": "...", "promoted_at": "...", "notes": "..."}
Predictors (ml/inference/versions.py) read this pointer first and fall back to
the latest complete version when it is absent — so promotion is opt-in and
fully backward-compatible.

Promotion gates (override with --force):
  * version dir is complete (weights + labels)
  * metrics.json test accuracy >= --min-accuracy (default 0.85)
  * external_eval.json exists and its gate passed
    (produce it with: python -m ml.scripts.test_external --crop <crop>
       --path ml/field_test/<crop> --save-json)

Usage:
  python -m ml.scripts.promote_model --status
  python -m ml.scripts.promote_model --crop rice --version v1_20260609_205251
  python -m ml.scripts.promote_model --crop rice --rollback

After promoting on a server: curl -X POST localhost:8000/admin/reload
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from ml.config import CROPS, MODELS_DIR  # noqa: E402
from ml.inference.versions import (  # noqa: E402
    _is_complete_model_version,
    read_production_pointer,
    resolve_version,
)


def _load_json(path: Path):
    if not path.exists():
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def _write_pointer(crop_dir: Path, version: str, previous, notes: str = "") -> None:
    pointer = {
        "version": version,
        "previous": previous,
        "promoted_at": datetime.now(timezone.utc).isoformat(),
        "notes": notes,
    }
    with open(crop_dir / "production.json", "w") as f:
        json.dump(pointer, f, indent=2)


def cmd_status() -> int:
    print(f"{'crop':<10}{'production':<26}{'resolved':<26}{'test acc':<10}{'external':<10}")
    print("-" * 82)
    for crop in CROPS:
        crop_dir = MODELS_DIR / crop
        pointer = read_production_pointer(crop_dir) or {}
        resolved = resolve_version(crop_dir) or "-"
        metrics = _load_json(crop_dir / resolved / "metrics.json") if resolved != "-" else None
        acc = f"{metrics['accuracy']:.1%}" if metrics and metrics.get("accuracy") is not None else "-"
        ext = "-"
        if metrics and metrics.get("external_accuracy") is not None:
            ext = f"{metrics['external_accuracy']:.1%}"
        print(f"{crop:<10}{pointer.get('version', '(latest)'):<26}{resolved:<26}{acc:<10}{ext:<10}")
    return 0


def cmd_promote(crop: str, version: str, min_accuracy: float, force: bool,
                notes: str) -> int:
    crop_dir = MODELS_DIR / crop
    problems = []

    if not _is_complete_model_version(crop_dir, version):
        problems.append(f"{version} is not a complete model version under {crop_dir}")
    else:
        metrics = _load_json(crop_dir / version / "metrics.json")
        if metrics is None:
            problems.append("metrics.json missing — train/evaluate before promoting")
        elif metrics.get("accuracy", 0) < min_accuracy:
            problems.append(f"test accuracy {metrics.get('accuracy'):.1%} "
                            f"below floor {min_accuracy:.0%}")

        external = _load_json(crop_dir / version / "external_eval.json")
        if external is None:
            problems.append(
                "no external_eval.json — run test_external --save-json on this "
                "version first (the in-dataset accuracy alone is not trustworthy)"
            )
        elif not external.get("gate", {}).get("passed"):
            problems.append(
                f"external gate FAILED (accuracy {external.get('external_accuracy'):.1%})"
            )

    if problems:
        for p in problems:
            print(f"  BLOCKED: {p}")
        if not force:
            print("Use --force to promote anyway.")
            return 1
        print("--force given; promoting despite the above.")

    current = (read_production_pointer(crop_dir) or {}).get("version")
    _write_pointer(crop_dir, version, previous=current, notes=notes)
    print(f"Promoted {crop} -> {version} (previous: {current or 'none'})")
    print("Reload the service: curl -X POST localhost:8000/admin/reload")
    return 0


def cmd_rollback(crop: str) -> int:
    crop_dir = MODELS_DIR / crop
    pointer = read_production_pointer(crop_dir)
    if not pointer or not pointer.get("previous"):
        print(f"No previous version recorded for {crop}; nothing to roll back to.")
        return 1
    prev = pointer["previous"]
    if not _is_complete_model_version(crop_dir, prev):
        print(f"Previous version {prev} is missing or incomplete; cannot roll back.")
        return 1
    _write_pointer(crop_dir, prev, previous=pointer.get("version"),
                   notes=f"rollback from {pointer.get('version')}")
    print(f"Rolled back {crop} -> {prev}")
    print("Reload the service: curl -X POST localhost:8000/admin/reload")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--crop", choices=list(CROPS.keys()))
    ap.add_argument("--version", help="version to promote")
    ap.add_argument("--rollback", action="store_true", help="swap back to previous version")
    ap.add_argument("--status", action="store_true", help="show serving versions")
    ap.add_argument("--min-accuracy", type=float, default=0.85,
                    help="test-accuracy floor for promotion (default 0.85)")
    ap.add_argument("--force", action="store_true", help="promote despite failed gates")
    ap.add_argument("--notes", default="", help="free-text note stored in the pointer")
    args = ap.parse_args()

    if args.status:
        return cmd_status()
    if args.rollback:
        if not args.crop:
            ap.error("--rollback requires --crop")
        return cmd_rollback(args.crop)
    if args.crop and args.version:
        return cmd_promote(args.crop, args.version, args.min_accuracy,
                           args.force, args.notes)
    ap.error("nothing to do: use --status, --crop+--version, or --crop --rollback")


if __name__ == "__main__":
    sys.exit(main())
