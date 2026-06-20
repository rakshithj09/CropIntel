#!/usr/bin/env python3
"""
Fetch the Auburn Soybean Disease Image Dataset (ASDID) from Zenodo.

ASDID (Zenodo record 7304859, Dryad doi:10.5061/dryad.41ns1rnj3) is ~9,981
field images where healthy and diseased leaves come from ONE acquisition
program — unlike the previous soybean training data, whose Healthy class came
from a different source than the disease classes (the model learned to detect
the source, not the disease).

The class zips are full-resolution (2.8–8.4 GB each, ~35 GB total), far more
than training needs. To stay within limited disk space this script processes
one class at a time: download zip -> resize images straight out of the zip
(max side RESIZE_MAX px, JPEG quality 85) into the output folder -> delete
the zip. Peak transient disk usage is one zip (max 8.4 GB).

Usage:
  python -m ml.scripts.fetch_asdid                  # all default classes
  python -m ml.scripts.fetch_asdid --classes healthy frogeye
  python -m ml.scripts.fetch_asdid --out ml/data/soybean/data
"""
import argparse
import io
import subprocess
import sys
import zipfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ZENODO_URL = "https://zenodo.org/records/7304859/files/{name}.zip?download=1"
IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
RESIZE_MAX = 600  # px, longest side; training uses 224 so this keeps headroom

# zip name on Zenodo -> class folder name used in ml/config.py CROPS["soybean"].
# ASDID (Auburn, USA) is fully disjoint from the vaishaligbhujade training set
# (India) — the default classes are the ones overlapping our trained labels,
# fetched as the soybean EXTERNAL test set (ml/field_test/soybean).
DEFAULT_CLASSES = {
    "healthy": "Healthy",
    "frogeye": "Frogeye Leaf Spot",
    "target_spot": "Target Leaf Spot",
    "soybean_rust": "Rust",
    # available but not fetched by default:
    # "bacterial_blight": "Bacterial Blight",   # NOT bacterial pustule!
    # "cercospora_leaf_blight": "Cercospora Leaf Blight",
    # "downey_mildew": "Downy Mildew",
    # "potassium_deficiency": "Potassium Deficiency",
}


def process_zip(zip_path: Path, out_dir: Path) -> int:
    """Resize every image in the zip into out_dir; returns count written."""
    out_dir.mkdir(parents=True, exist_ok=True)
    written = 0
    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            name = Path(info.filename)
            if info.is_dir() or name.suffix.lower() not in IMG_EXTS:
                continue
            if name.name.startswith("._") or "__MACOSX" in info.filename:
                continue
            out_path = out_dir / f"{name.stem}.jpg"
            if out_path.exists():
                continue
            try:
                img = Image.open(io.BytesIO(zf.read(info))).convert("RGB")
            except Exception as e:
                print(f"  [skip] {info.filename}: {e}")
                continue
            if max(img.size) > RESIZE_MAX:
                img.thumbnail((RESIZE_MAX, RESIZE_MAX), Image.LANCZOS)
            img.save(out_path, "JPEG", quality=85)
            written += 1
    return written


def fetch_class(zip_name: str, class_dir: Path, tmp_dir: Path) -> int:
    zip_path = tmp_dir / f"{zip_name}.zip"
    url = ZENODO_URL.format(name=zip_name)
    print(f"\n=== {zip_name} -> {class_dir}")
    print(f"  downloading {url}")
    subprocess.run(
        ["curl", "-L", "--fail", "--retry", "3", "-C", "-", "-o", str(zip_path), url],
        check=True,
    )
    try:
        n = process_zip(zip_path, class_dir)
        print(f"  wrote {n} images")
    finally:
        zip_path.unlink(missing_ok=True)
    return n


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(ROOT / "ml" / "data" / "soybean_asdid"),
                    help="output root; one subfolder per class")
    ap.add_argument("--classes", nargs="*", default=list(DEFAULT_CLASSES.keys()),
                    help=f"zip names to fetch (default: {list(DEFAULT_CLASSES.keys())})")
    ap.add_argument("--tmp", default="/tmp/asdid", help="scratch dir for zips")
    args = ap.parse_args()

    out_root = Path(args.out)
    tmp_dir = Path(args.tmp)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    total = 0
    for zip_name in args.classes:
        class_name = DEFAULT_CLASSES.get(zip_name, zip_name)
        total += fetch_class(zip_name, out_root / class_name, tmp_dir)
    print(f"\nDone. {total} images under {out_root}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
