#!/usr/bin/env python3
"""
Zip ml/models/ for sharing (GitHub Release, Drive, etc.).

By default this now packages only the LATEST version per crop (not every
historical training run), which keeps release archives small.

  # latest version per crop, all files (default):
  python -m ml.scripts.package_models -o cropintel-models.zip

  # production/mobile: only the .tflite + label_map.json of the latest version:
  python -m ml.scripts.package_models --tflite-only -o cropintel-models-mobile.zip

  # everything, every version (the old behaviour):
  python -m ml.scripts.package_models --all-versions -o cropintel-models-full.zip
"""
import argparse
import zipfile
from pathlib import Path

from ml.config import CROPS, MODELS_DIR
from ml.inference.versions import resolve_version


def _serving_version_dir(crop_dir: Path):
    """The version predictors would serve: production.json pointer, else latest."""
    version = resolve_version(crop_dir)
    return crop_dir / version if version else None


def main() -> None:
    parser = argparse.ArgumentParser(description="Zip trained models for release.")
    parser.add_argument("-o", "--output", type=Path, default=Path("cropintel-models.zip"),
                        help="Output .zip path")
    parser.add_argument("--all-versions", action="store_true",
                        help="Include every version per crop (large). Default: latest only.")
    parser.add_argument("--tflite-only", action="store_true",
                        help="Include only model.tflite + label_map.json (smallest, mobile).")
    args = parser.parse_args()

    if not MODELS_DIR.is_dir():
        raise SystemExit(f"No models directory: {MODELS_DIR}")

    missing = [c for c in CROPS if not (MODELS_DIR / c).is_dir()]
    if missing:
        print(f"Warning: no folder for crops: {missing}")

    keep_names = {"model.tflite", "label_map.json"}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    n_files = 0
    with zipfile.ZipFile(args.output, "w", zipfile.ZIP_DEFLATED) as zf:
        for crop in CROPS:
            crop_dir = MODELS_DIR / crop
            if not crop_dir.is_dir():
                continue
            if args.all_versions:
                version_dirs = [d for d in crop_dir.iterdir() if d.is_dir()]
            else:
                serving = _serving_version_dir(crop_dir)
                version_dirs = [serving] if serving else []
            for vdir in version_dirs:
                for path in vdir.rglob("*"):
                    if not path.is_file():
                        continue
                    if args.tflite_only and path.name not in keep_names:
                        continue
                    zf.write(path, path.relative_to(MODELS_DIR))
                    n_files += 1
            # Ship the production pointer so deployed servers pin the same version.
            pointer = crop_dir / "production.json"
            if pointer.exists():
                zf.write(pointer, pointer.relative_to(MODELS_DIR))
                n_files += 1
            if version_dirs:
                print(f"  {crop}: packaged {version_dirs[-1].name if version_dirs else '-'}")

    size_mb = args.output.stat().st_size / (1024 ** 2)
    print(f"Wrote {args.output.resolve()} ({n_files} files, {size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
