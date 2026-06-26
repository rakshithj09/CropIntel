#!/usr/bin/env python3
"""
Download pre-packaged CropIntel model bundles without Kaggle.

Maintainers can publish a .zip of ml/models/ (corn/, rice/, soybean/, wheat/) via
GitHub Releases, S3, Google Drive direct link, etc. Contributors set CROPINTEL_MODELS_URL
or pass --url once after clone.

Expected zip layouts (any of):
  - Top-level: corn/, soybean/, wheat/, rice/
  - models/corn/...
  - ml/models/corn/...
"""
from __future__ import annotations

import argparse
import shutil
import sys
import tempfile
import time
import zipfile
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from ml.config import CROPS, MODELS_DIR


def _find_models_root(extracted: Path) -> Path | None:
    """Locate folder that directly contains crop names as subdirs."""
    crops = set(CROPS.keys())

    def has_crop_children(p: Path) -> bool:
        if not p.is_dir():
            return False
        subs = {d.name for d in p.iterdir() if d.is_dir()}
        return bool(subs & crops)

    # Include `extracted` itself: rglob("*") yields only descendants, so a
    # top-level layout (crop folders at the zip root) would otherwise be missed
    # — the extraction dir is the only one whose children are crop names.
    candidates: list[Path] = []
    for p in (extracted, *extracted.rglob("*")):
        if p.is_dir() and has_crop_children(p):
            candidates.append(p)
    if not candidates:
        return None
    return min(candidates, key=lambda p: len(p.parts))


def merge_models_tree(src: Path, dest: Path) -> None:
    """Copy crop/version trees from src into dest (dest is MODELS_DIR)."""
    dest.mkdir(parents=True, exist_ok=True)
    # "crop_id" is the optional wrong-crop gate model (not a disease crop, so it
    # isn't in CROPS) — install it too when the bundle carries it.
    for crop in (*CROPS, "crop_id"):
        src_crop = src / crop
        if not src_crop.is_dir():
            continue
        dst_crop = dest / crop
        dst_crop.mkdir(parents=True, exist_ok=True)
        for ver in src_crop.iterdir():
            if not ver.is_dir():
                # crop-root files, e.g. production.json (serving-version pointer)
                shutil.copy2(ver, dst_crop / ver.name)
                continue
            dst_ver = dst_crop / ver.name
            if dst_ver.exists():
                shutil.rmtree(dst_ver)
            shutil.copytree(ver, dst_ver)
        print(f"  ✓ Installed models for {crop}")


def _download(url: str, attempts: int = 4) -> bytes:
    """Download with retries — a single truncated/blipped fetch must not crash
    the whole Space. Validates the payload is a real (non-empty) zip."""
    req = Request(url, headers={"User-Agent": "CropIntel-fetch-models/1.0"})
    last = None
    for i in range(1, attempts + 1):
        try:
            with urlopen(req, timeout=180) as resp:
                data = resp.read()
            # zip files start with 'PK'; guard against truncated/HTML error bodies.
            if len(data) > 1000 and data[:2] == b"PK":
                return data
            last = f"suspect payload ({len(data)} bytes, magic={data[:2]!r})"
        except (HTTPError, URLError) as e:
            last = getattr(e, "reason", str(e))
        print(f"  download attempt {i}/{attempts} failed: {last}", file=sys.stderr)
        if i < attempts:
            time.sleep(3 * i)
    print(f"Download failed after {attempts} attempts: {last}", file=sys.stderr)
    sys.exit(1)


def fetch_and_extract(url: str, dest: Path) -> None:
    print(f"Downloading models from URL…\n  {url}")
    if url.lower().split("?")[0].endswith((".tar.gz", ".tgz")):
        print("Tar archives are not supported yet; use a .zip of ml/models/.", file=sys.stderr)
        sys.exit(1)
    data = _download(url)

    suffix = ".zip"
    with tempfile.TemporaryDirectory() as tmp:
        zpath = Path(tmp) / f"models{suffix}"
        zpath.write_bytes(data)
        extract_root = Path(tmp) / "out"
        extract_root.mkdir()
        with zipfile.ZipFile(zpath) as zf:
            zf.extractall(extract_root)

        models_root = _find_models_root(extract_root)
        if models_root is None:
            print(
                "Archive layout not recognized. Expected zip to contain crop folders "
                f"{list(CROPS.keys())} (or models/ or ml/models/ wrapping them).",
                file=sys.stderr,
            )
            sys.exit(1)

        merge_models_tree(models_root, dest)

    print(f"\nModels installed under {dest.resolve()}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download pre-built CropIntel models (no Kaggle required)."
    )
    parser.add_argument(
        "--url",
        type=str,
        default=None,
        help="Direct HTTPS URL to a .zip of models (or set CROPINTEL_MODELS_URL).",
    )
    parser.add_argument(
        "--dest",
        type=Path,
        default=None,
        help=f"Output directory (default: {MODELS_DIR})",
    )
    args = parser.parse_args()
    import os

    url = args.url or os.environ.get("CROPINTEL_MODELS_URL", "").strip()
    if not url:
        print(
            "No URL provided.\n\n"
            "  python -m ml.scripts.fetch_models --url 'https://…/cropintel-models.zip'\n"
            "  or:  export CROPINTEL_MODELS_URL='https://…'\n\n"
            "Ask a maintainer for a release link, or train locally with Kaggle data "
            "(see ml/README.md).",
            file=sys.stderr,
        )
        sys.exit(1)

    dest = args.dest or MODELS_DIR
    fetch_and_extract(url, dest)


if __name__ == "__main__":
    main()
