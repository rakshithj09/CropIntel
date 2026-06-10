#!/usr/bin/env python3
"""
Head-to-head rice benchmark: our retrained EfficientNetB0 vs the pretrained
SigLIP2 model (prithivMLmods/Rice-Leaf-Disease), on the SAME held-out real test
split that our model did not train on.

This tells us how much accuracy headroom (if any) the pretrained transformer
leaves on the table — i.e. whether our lightweight 8.8MB model is "good enough"
or the 370MB SigLIP2 is meaningfully better on real images.

Caveat: SigLIP2's training data is unknown; if it was trained on this same
public dataset, its score here is optimistic. The truly neutral comparison is
on your own field photos (run both via this script's --test-dir mode).

Usage:
  python -m ml.scripts.benchmark_rice                 # held-out real test split
  python -m ml.scripts.benchmark_rice --test-dir ml/field_test/rice
"""
import argparse
import os
import sys
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import numpy as np  # noqa: E402

SIGLIP_DIR = ROOT / "ml" / "models_pretrained" / "rice_siglip2"

# SigLIP2 label -> our class name. Tungro has no equivalent (always a miss here).
SIGLIP_TO_OURS = {
    "Bacterialblight": "Bacterial Leaf Blight",
    "Blast": "Rice Blast",
    "Brownspot": "Brown Spot",
    "Healthy": "Healthy",
    "Tungro": "__tungro__",
}


def _confusion(y_true, y_pred, labels):
    idx = {l: i for i, l in enumerate(labels)}
    cm = np.zeros((len(labels), len(labels)), dtype=int)
    extra = {}  # predictions outside our label set (e.g. Tungro)
    for t, p in zip(y_true, y_pred):
        if p in idx:
            cm[idx[t]][idx[p]] += 1
        else:
            extra[p] = extra.get(p, 0) + 1
    return cm, extra


def _print_cm(cm, labels, extra=None):
    w = max(14, max(len(l) for l in labels) + 2)
    print(f"{'true/pred':>{w}}" + "".join(f"{l[:w-1]:>{w}}" for l in labels))
    for i, l in enumerate(labels):
        print(f"{l[:w-1]:>{w}}" + "".join(f"{v:>{w}}" for v in cm[i]))
    acc = cm.trace() / cm.sum() if cm.sum() else 0.0
    print(f"  accuracy = {acc:.1%}  ({cm.trace()}/{cm.sum()})")
    if extra:
        print(f"  predictions outside our catalog: {extra}")
    print("  per-class recall:")
    for i, l in enumerate(labels):
        tot = cm[i].sum()
        print(f"    {l:<24} {cm[i,i]:>4}/{tot:<4} = {(cm[i,i]/tot if tot else 0):.1%}")
    return acc


def load_test_split(crop="rice"):
    """Return (images[0,1] float, label_names) for the held-out real test split."""
    from ml.utils.data_loader import CropDatasetLoader
    loader = CropDatasetLoader(crop)
    imgs, labels, class_names = loader.load_dataset()
    loader.create_data_generators(imgs, labels)  # deterministic split (seed=42)
    X_test, y_test = loader.get_test_set()
    y_names = [class_names[int(i)] for i in y_test]
    return X_test, y_names, class_names


def load_test_dir(test_dir: Path):
    """Load a labeled folder (subdirs = true class) as ([0,1] images, names)."""
    from PIL import Image
    exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    X, names = [], []
    for sub in sorted(d for d in test_dir.iterdir() if d.is_dir()):
        for f in sub.iterdir():
            if f.suffix.lower() in exts:
                im = Image.open(f).convert("RGB").resize((224, 224))
                X.append(np.asarray(im, dtype=np.float32) / 255.0)
                names.append(sub.name)
    return np.array(X, dtype=np.float32), names, sorted(set(names))


def run_ours(X, class_names):
    """Predict with our retrained model via KerasPredictor (expects [0,1])."""
    from ml.inference.keras_predictor import KerasPredictor
    p = KerasPredictor("rice")
    preds = []
    for i in range(len(X)):
        probs = p.model.predict(X[i:i+1], verbose=0)[0]
        preds.append(p.class_names[int(np.argmax(probs))])
    return preds, p.version


def run_siglip(X):
    """Predict with SigLIP2 (expects PIL/uint8); map labels to our taxonomy."""
    import torch
    from transformers import AutoImageProcessor, AutoModelForImageClassification
    proc = AutoImageProcessor.from_pretrained(str(SIGLIP_DIR))
    model = AutoModelForImageClassification.from_pretrained(str(SIGLIP_DIR))
    model.eval()
    id2label = model.config.id2label
    from PIL import Image
    preds = []
    with torch.no_grad():
        for i in range(len(X)):
            pil = Image.fromarray((X[i] * 255).astype(np.uint8), "RGB")
            inp = proc(images=pil, return_tensors="pt")
            logits = model(**inp).logits
            raw = id2label[int(logits.argmax(-1))]
            preds.append(SIGLIP_TO_OURS.get(raw, raw))
    return preds


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--test-dir", default=None,
                    help="labeled folder (subdirs=classes); default uses held-out real test split")
    args = ap.parse_args()

    if args.test_dir:
        print(f"Loading labeled test dir: {args.test_dir}")
        X, y_true, labels = load_test_dir(Path(args.test_dir))
    else:
        print("Loading held-out REAL test split (our model never trained on these)...")
        X, y_true, labels = load_test_split("rice")
    print(f"Test set: {len(X)} images, classes={labels}\n")

    print("=" * 64)
    print("MODEL A — our retrained EfficientNetB0 (8.8MB TFLite-class)")
    print("=" * 64)
    a_pred, ver = run_ours(X, labels)
    cm_a, extra_a = _confusion(y_true, a_pred, labels)
    acc_a = _print_cm(cm_a, labels, extra_a)
    print(f"  model version: {ver}")

    print("\n" + "=" * 64)
    print("MODEL B — pretrained SigLIP2 (prithivMLmods, ~370MB)")
    print("=" * 64)
    b_pred = run_siglip(X)
    cm_b, extra_b = _confusion(y_true, b_pred, labels)
    acc_b = _print_cm(cm_b, labels, extra_b)

    print("\n" + "=" * 64)
    print(f"RESULT:  ours={acc_a:.1%}   siglip2={acc_b:.1%}   "
          f"gap={ (acc_b-acc_a)*100:+.1f} pts")
    print("=" * 64)
    print("Note: if SigLIP2 trained on this public dataset, its score is optimistic.")
    print("Re-run with --test-dir ml/field_test/rice on your own photos for a neutral test.")


if __name__ == "__main__":
    main()
