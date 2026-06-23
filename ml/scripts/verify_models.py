#!/usr/bin/env python3
"""Fail fast when the deployed inference service has no usable model files."""
from __future__ import annotations

import sys

from ml.config import CROPS, MODELS_DIR
from ml.inference.versions import resolve_version


def main() -> None:
    missing: list[str] = []
    for crop in CROPS:
        model_dir = MODELS_DIR / crop
        version = resolve_version(model_dir)
        if not version:
            missing.append(crop)
            continue

        version_dir = model_dir / version
        if not (version_dir / "model.tflite").exists() and not (
            version_dir / "checkpoint.keras"
        ).exists():
            missing.append(crop)

    if missing:
        print(
            "Missing trained model files for: "
            + ", ".join(missing)
            + f"\nExpected models under {MODELS_DIR} or set CROPINTEL_MODELS_URL.",
            file=sys.stderr,
        )
        sys.exit(1)

    print("Verified trained model files for: " + ", ".join(CROPS.keys()))


if __name__ == "__main__":
    main()
