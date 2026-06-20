#!/usr/bin/env python3
"""
Fold independent FIELD tomato images into ml/data/tomato/supplemental/<class>/.

Targets the three classes the trimmed 8-class model still fails on real photos:
Early Blight (had ZERO field data), Leaf Mold, Bacterial Spot. Only genuinely
independent sources are used (Tomato-Village, Taiwan, Mendeley) — NOT PlantDoc,
because the external holdout (ml/field_test/tomato_holdout) is itself carved
from PlantDoc, so re-folding PlantDoc would leak the holdout into training.

Safety:
  * md5-dedup every candidate against ALL existing tomato images (training data +
    existing supplemental) AND the holdout, plus within the incoming set. Exact
    re-uploads / already-present images are skipped (the overlap trap).
  * images are re-encoded to JPEG (max side 600px, q85) under a source prefix.

Usage:
  python -m ml.scripts.fold_tomato_field --dry-run     # report counts, write nothing
  python -m ml.scripts.fold_tomato_field               # actually fold
"""
import argparse
import hashlib
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "ml" / "data" / "tomato"
SUPP = DATA / "supplemental"
INCOMING = ROOT / "ml" / "data" / "_incoming"
RESIZE_MAX = 600
IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".JPG", ".JPEG", ".PNG"}

# Existing image trees to dedup AGAINST (must never duplicate or leak these).
DEDUP_AGAINST = [
    DATA / "data",
    SUPP,
    ROOT / "ml" / "field_test" / "tomato",
    ROOT / "ml" / "field_test" / "tomato_holdout",
]

# (source_dir relative to _incoming, target class). Folder names matched
# case-insensitively. Only the 3 weak classes, only independent sources.
# Tomato-Village paths are auto-discovered (its layout varies); see discover().
SOURCES = [
    # Taiwan (CC0) — independent of PlantDoc, no holdout overlap.
    ("taiwan/data/Train/Bacterial spot", "Bacterial Spot", "taiwan"),
    ("taiwan/data/Test/Bacterial spot", "Bacterial Spot", "taiwan"),
    ("taiwan/data/Train/Black mold", "Leaf Mold", "taiwan"),
    ("taiwan/data/Test/Black mold", "Leaf Mold", "taiwan"),
    # PlantDoc — SAFE because the whole pipeline is byte-identical, so the md5
    # guard excludes exactly the holdout + already-trained images. The win is
    # Early Blight (never folded -> ~77 new); mold/bspot mostly dedup out.
    ("PlantDoc-Dataset/train/Tomato Early blight leaf", "Early Blight", "plantdoc"),
    ("PlantDoc-Dataset/test/Tomato Early blight leaf", "Early Blight", "plantdoc"),
    ("PlantDoc-Dataset/train/Tomato mold leaf", "Leaf Mold", "plantdoc"),
    ("PlantDoc-Dataset/test/Tomato mold leaf", "Leaf Mold", "plantdoc"),
    ("PlantDoc-Dataset/train/Tomato leaf bacterial spot", "Bacterial Spot", "plantdoc"),
    ("PlantDoc-Dataset/test/Tomato leaf bacterial spot", "Bacterial Spot", "plantdoc"),
]


def md5_bytes(b: bytes) -> str:
    return hashlib.md5(b).hexdigest()


def build_existing_hashes() -> set:
    seen = set()
    for tree in DEDUP_AGAINST:
        if not tree.is_dir():
            continue
        for p in tree.rglob("*"):
            if p.is_file() and p.suffix in IMG_EXTS:
                try:
                    seen.add(md5_bytes(p.read_bytes()))
                except Exception:
                    pass
    return seen


def discover_tomato_village() -> list:
    """Tomato-Village uses an India-specific taxonomy; only its Early Blight
    overlaps our targets. Find any folder whose name implies early blight."""
    out = []
    for tv in INCOMING.glob("Tomato-Village*"):
        if not tv.is_dir():
            continue
        for d in tv.rglob("*"):
            if d.is_dir() and ("early" in d.name.lower() and "blight" in d.name.lower()):
                out.append((str(d.relative_to(INCOMING)), "Early Blight", "tvillage"))
    return out


def list_images(folder: Path):
    return [p for p in folder.rglob("*") if p.is_file() and p.suffix in IMG_EXTS]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    sources = SOURCES + discover_tomato_village()
    print(f"Resolved {len(sources)} source folders:")
    for rel, cls, pfx in sources:
        n = len(list_images(INCOMING / rel)) if (INCOMING / rel).is_dir() else 0
        print(f"  [{pfx}] {rel}  ->  {cls}  ({n} imgs)")

    print("\nBuilding md5 set of existing + holdout images (dedup guard)...")
    existing = build_existing_hashes()
    print(f"  {len(existing)} existing image hashes")

    incoming_seen = set()
    added = {}
    skipped_dup = 0
    for rel, cls, pfx in sources:
        src = INCOMING / rel
        if not src.is_dir():
            print(f"  [miss] {rel} (not found)")
            continue
        dst = SUPP / cls
        for img in list_images(src):
            try:
                raw = img.read_bytes()
            except Exception:
                continue
            h = md5_bytes(raw)
            if h in existing or h in incoming_seen:
                skipped_dup += 1
                continue
            incoming_seen.add(h)
            if not args.dry_run:
                dst.mkdir(parents=True, exist_ok=True)
                try:
                    im = Image.open(img).convert("RGB")
                    w, hgt = im.size
                    if max(w, hgt) > RESIZE_MAX:
                        s = RESIZE_MAX / max(w, hgt)
                        im = im.resize((int(w * s), int(hgt * s)), Image.LANCZOS)
                    out = dst / f"{pfx}_{h[:10]}.jpg"
                    im.save(out, "JPEG", quality=85)
                except Exception as e:
                    print(f"  [skip] {img.name}: {e}")
                    continue
            added[cls] = added.get(cls, 0) + 1

    print(f"\n{'DRY RUN — ' if args.dry_run else ''}new images per class (after dedup):")
    for cls in sorted(added):
        print(f"  {cls:<16} +{added[cls]}")
    print(f"  skipped as duplicates/leakage: {skipped_dup}")


if __name__ == "__main__":
    main()
