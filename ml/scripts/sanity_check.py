"""
3-epoch sanity check per crop (item 10).

For each crop:
  * load data (triggers folder-map verify, corrupt-skip, split-dist, coupling asserts)
  * train 3 epochs with a frozen backbone
  * predict on the full validation set
  * print confusion matrix + per-class accuracy
  * detect mode-collapse (predictions concentrated on a single class)

Returns a structured result so the orchestrator can SKIP collapsed crops instead
of wasting a 50-epoch run on them.

Usage:
    python -m ml.scripts.sanity_check                 # all crops
    python -m ml.scripts.sanity_check --crop soybean  # one crop
"""
import argparse
import os
import sys
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import numpy as np  # noqa: E402
from sklearn.metrics import confusion_matrix  # noqa: E402

from ml.config import CROPS  # noqa: E402
from ml.utils.data_loader import CropDatasetLoader  # noqa: E402
from ml.utils.model_builder import build_model  # noqa: E402

# Predictions are considered "collapsed" if a single predicted class accounts for
# more than this fraction of the validation set.
COLLAPSE_THRESHOLD = 0.90


def _print_confusion_matrix(cm: np.ndarray, class_names: list) -> float:
    col_w = max(14, max(len(n) for n in class_names) + 2)
    corner = "true\\pred"
    header = f"{corner:>{col_w}}" + "".join(f"{n[:col_w-1]:>{col_w}}" for n in class_names)
    print("\n" + "=" * len(header))
    print("CONFUSION MATRIX  (rows = true class, cols = predicted class)")
    print("=" * len(header))
    print(header)
    for i, row in enumerate(cm):
        lbl = class_names[i][: col_w - 1]
        print(f"{lbl:>{col_w}}" + "".join(f"{v:>{col_w}}" for v in row))
    print("\nPer-class recall:")
    for i, name in enumerate(class_names):
        total = cm[i].sum()
        correct = cm[i, i]
        pct = correct / total if total > 0 else 0.0
        print(f"  {name:<30}  {correct:>4}/{total:<4}  =  {pct:.1%}")
    overall = cm.diagonal().sum() / cm.sum() if cm.sum() else 0.0
    print(f"\nOverall val accuracy: {overall:.4f}  ({cm.diagonal().sum()}/{cm.sum()})")
    return overall


def sanity_check_crop(crop: str, epochs: int = 3) -> dict:
    """Run a short sanity check for one crop. Returns a result dict."""
    print(f"\n{'#'*70}")
    print(f"# SANITY CHECK — {crop.upper()}  ({epochs} epochs, frozen backbone)")
    print(f"{'#'*70}\n")

    result = {
        "crop": crop, "status": "unknown", "val_accuracy": None,
        "collapsed": None, "dominant_pred_share": None, "n_pred_classes": None,
        "class_names": None, "error": None,
    }
    try:
        loader = CropDatasetLoader(crop)
        images, labels, class_names = loader.load_dataset()
        result["class_names"] = class_names

        train_gen, val_gen, y_train = loader.create_data_generators(images, labels)

        num_classes = len(class_names)
        print(f"\nBuilding EfficientNetB0 model ({num_classes} classes) ...")
        model = build_model(num_classes=num_classes, crop=crop, architecture="EfficientNetB0")

        print(f"\nTraining {epochs} epochs (frozen backbone) ...")
        model.fit(train_gen, epochs=epochs, validation_data=val_gen, verbose=2)

        # Predict on the full validation set
        X_val, y_val_cat = val_gen.x, val_gen.y
        y_val = np.argmax(y_val_cat, axis=1)
        y_pred = np.argmax(model.predict(X_val, verbose=0, batch_size=32), axis=1)

        cm = confusion_matrix(y_val, y_pred, labels=list(range(num_classes)))
        overall = _print_confusion_matrix(cm, class_names)

        # Collapse detection
        pred_unique, pred_counts = np.unique(y_pred, return_counts=True)
        dominant_share = float(pred_counts.max() / pred_counts.sum())
        n_pred_classes = int(len(pred_unique))
        collapsed = (n_pred_classes == 1) or (dominant_share > COLLAPSE_THRESHOLD)

        result.update({
            "val_accuracy": float(overall),
            "collapsed": collapsed,
            "dominant_pred_share": dominant_share,
            "n_pred_classes": n_pred_classes,
        })

        print(f"\nPredicted-class spread: {n_pred_classes}/{num_classes} classes used, "
              f"dominant class = {dominant_share:.1%} of predictions")
        if collapsed:
            result["status"] = "COLLAPSED"
            print("✗  MODE COLLAPSE detected — model predicts one class for "
                  f"{dominant_share:.0%} of val. This crop would waste a full run.")
        elif overall >= 0.45:
            result["status"] = "PASS"
            print("✓  PASS — clean label spread, no collapse, reasonable accuracy.")
        else:
            result["status"] = "WEAK"
            print("⚠  WEAK — no collapse but accuracy < 45% at epoch 3 (still trainable).")
    except Exception as e:
        import traceback
        result["status"] = "ERROR"
        result["error"] = str(e)
        print(f"✗  ERROR during sanity check for {crop}: {e}")
        traceback.print_exc()
    return result


def main(crop: str = None, epochs: int = 3) -> int:
    crops = [crop] if crop else list(CROPS.keys())
    results = [sanity_check_crop(c, epochs=epochs) for c in crops]

    print(f"\n\n{'='*70}")
    print("SANITY CHECK SUMMARY")
    print(f"{'='*70}")
    print(f"{'crop':<10}{'status':<12}{'val_acc':<10}{'pred_classes':<14}{'dom_share':<10}")
    for r in results:
        va = f"{r['val_accuracy']:.3f}" if r["val_accuracy"] is not None else "—"
        npc = f"{r['n_pred_classes']}" if r["n_pred_classes"] is not None else "—"
        ds = f"{r['dominant_pred_share']:.0%}" if r["dominant_pred_share"] is not None else "—"
        print(f"{r['crop']:<10}{r['status']:<12}{va:<10}{npc:<14}{ds:<10}")
    print()
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--crop", default=None, choices=list(CROPS.keys()),
                        help="Crop to sanity-check (default: all crops)")
    parser.add_argument("--epochs", type=int, default=3)
    args = parser.parse_args()
    sys.exit(main(args.crop, args.epochs))
