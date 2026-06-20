#!/usr/bin/env python3
"""
Test a trained CropIntel model on EXTERNAL images (outside the training datasets).

This is the real-world readiness check. In-dataset test accuracy overstates field
performance; this script tells you how the model behaves on images it has never
seen from a different distribution.

Two modes:
  1. LABELED EVAL — point at a directory with one subfolder per true class
     (subfolder names are matched to the model's class names, case/space/underscore
     insensitive). Produces a confusion matrix, per-class recall, accuracy, and an
     out-of-distribution (OOD) confidence report.
  2. UNLABELED PREDICT — point at a directory of loose images (or a single image).
     Produces top-2 predictions + confidence + a "below threshold / uncertain" flag.

Usage:
  python -m ml.scripts.test_external --crop corn --path /some/photo.jpg
  python -m ml.scripts.test_external --crop corn --path /folder/of/images
  python -m ml.scripts.test_external --crop corn --path /labeled_root   # subfolders=classes
  python -m ml.scripts.test_external --crop rice --path ./imgs --backend tflite

Labeled layout example:
  labeled_root/
    Healthy/        img1.jpg ...
    Common Rust/    ...
    Blight/         ...
    Gray Leaf Spot/ ...
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

from ml.config import CROPS, CONFIDENCE_THRESHOLD  # noqa: E402

IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# Acceptance gate for the "production-ready" stamp (see docs/DEPLOYMENT.md):
# a model passes when external accuracy meets GATE_MIN_ACCURACY and every
# evaluated class's recall meets GATE_MIN_CLASS_RECALL.
GATE_MIN_ACCURACY = 0.85
GATE_MIN_CLASS_RECALL = 0.60


def _norm(s: str) -> str:
    """Normalize a class/folder name for matching."""
    return s.lower().replace("_", " ").replace("-", " ").strip()


def _list_images(folder: Path):
    return sorted(p for p in folder.rglob("*")
                  if p.is_file() and p.suffix.lower() in IMG_EXTS)


def _load_predictor(crop: str, backend: str, version: str = None):
    if backend == "keras":
        from ml.inference.keras_predictor import KerasPredictor
        return KerasPredictor(crop, version=version)
    else:
        from ml.inference.tflite_predictor import TFLitePredictor
        return TFLitePredictor(crop, version=version)


def _predict_one(predictor, img_path: Path):
    """Return (sorted_all_predictions, top_disease, top_conf) via the production path."""
    image = Image.open(img_path)
    result = predictor.predict(image)
    return result["all_predictions"], result["disease"], result["confidence"]


def _print_confusion(cm, class_names):
    col_w = max(14, max(len(n) for n in class_names) + 2)
    corner = "true\\pred"
    print("\n" + f"{corner:>{col_w}}" + "".join(f"{n[:col_w-1]:>{col_w}}" for n in class_names))
    for i, row in enumerate(cm):
        print(f"{class_names[i][:col_w-1]:>{col_w}}" + "".join(f"{v:>{col_w}}" for v in row))


def run_labeled(predictor, root: Path):
    """Eval against subfolders named by true class."""
    class_names = predictor.class_names
    norm_to_idx = {_norm(c): i for i, c in enumerate(class_names)}

    subdirs = [d for d in root.iterdir() if d.is_dir()]
    matched = [(d, norm_to_idx[_norm(d.name)]) for d in subdirs if _norm(d.name) in norm_to_idx]
    unmatched = [d.name for d in subdirs if _norm(d.name) not in norm_to_idx]
    if not matched:
        print(f"  No subfolders matched model classes {class_names}.")
        print(f"  Found subfolders: {[d.name for d in subdirs]}")
        print("  (Falling back to unlabeled prediction.)")
        return run_unlabeled(predictor, root, recursive=True)

    if unmatched:
        print(f"  [note] ignoring subfolders not matching a class: {unmatched}")

    n = len(class_names)
    cm = np.zeros((n, n), dtype=int)
    confs, below = [], 0
    total = 0
    for folder, true_idx in matched:
        for img in _list_images(folder):
            try:
                allp, top, conf = _predict_one(predictor, img)
            except Exception as e:
                print(f"  [skip] {img.name}: {e}")
                continue
            pred_idx = class_names.index(top)
            cm[true_idx][pred_idx] += 1
            confs.append(conf)
            below += int(conf < CONFIDENCE_THRESHOLD)
            total += 1

    if total == 0:
        print("  No readable images found.")
        return None

    _print_confusion(cm, class_names)
    per_class = {}
    print("\nPer-class recall (true class correctly predicted):")
    for i, name in enumerate(class_names):
        tot = cm[i].sum()
        rec = cm[i, i] / tot if tot else 0.0
        marker = "   <-- WEAK (<0.6)" if (tot and rec < 0.6) else ""
        print(f"  {name:<26} {cm[i,i]:>4}/{tot:<4} = {rec:6.1%}{marker}")
        if tot:
            per_class[name] = {"correct": int(cm[i, i]), "total": int(tot),
                               "recall": round(rec, 4)}
    acc = cm.trace() / cm.sum()
    confs = np.array(confs)
    print(f"\nOverall external accuracy : {acc:.1%}  ({cm.trace()}/{cm.sum()})")
    print(f"Mean confidence           : {confs.mean():.1%}")
    print(f"Below threshold ({CONFIDENCE_THRESHOLD:.2f})    : {below}/{total} = {below/total:.1%}")

    gate_passed = bool(acc >= GATE_MIN_ACCURACY
                       and all(c["recall"] >= GATE_MIN_CLASS_RECALL for c in per_class.values()))
    verdict = "PASS" if gate_passed else "FAIL"
    print(f"\nProduction gate (acc>={GATE_MIN_ACCURACY:.0%}, "
          f"class recall>={GATE_MIN_CLASS_RECALL:.0%}): {verdict}")
    print("\nReading the result:")
    print("  * accuracy here ~ in-dataset test acc  -> generalizes well")
    print("  * accuracy here << test acc            -> domain shift / shortcut learning")
    print("  * high accuracy BUT low mean confidence-> shaky; rely on threshold + top-2")

    return {
        "external_accuracy": round(float(acc), 4),
        "total_images": int(total),
        "correct": int(cm.trace()),
        "per_class": per_class,
        "mean_confidence": round(float(confs.mean()), 4),
        "below_threshold_rate": round(below / total, 4),
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "confusion_matrix": cm.tolist(),
        "class_names": class_names,
        "gate": {
            "passed": gate_passed,
            "min_accuracy": GATE_MIN_ACCURACY,
            "min_class_recall": GATE_MIN_CLASS_RECALL,
        },
    }


def run_unlabeled(predictor, path: Path, recursive: bool = False):
    class_names = predictor.class_names
    if path.is_file():
        images = [path]
    elif recursive:
        images = sorted(p for p in path.rglob("*") if p.suffix.lower() in IMG_EXTS)
    else:
        images = _list_images(path)
    if not images:
        print(f"  No images found at {path}")
        return

    confs, below = [], 0
    print(f"\n{'image':<40}{'prediction':<22}{'conf':<8}{'2nd guess':<22}{'flag'}")
    print("-" * 100)
    for img in images:
        try:
            allp, top, conf = _predict_one(predictor, img)
        except Exception as e:
            print(f"  [skip] {img.name}: {e}")
            continue
        second = allp[1] if len(allp) > 1 else {"disease": "-", "confidence": 0.0}
        flag = "UNCERTAIN" if conf < CONFIDENCE_THRESHOLD else ""
        confs.append(conf)
        below += int(conf < CONFIDENCE_THRESHOLD)
        print(f"{img.name[:38]:<40}{top:<22}{conf:<8.1%}"
              f"{second['disease']+' '+format(second['confidence'],'.0%'):<22}{flag}")
    if confs:
        confs = np.array(confs)
        print("-" * 100)
        print(f"images={len(confs)}  mean_conf={confs.mean():.1%}  "
              f"uncertain(<{CONFIDENCE_THRESHOLD:.2f})={below} ({below/len(confs):.0%})")
        print("Tip: many UNCERTAIN flags on real photos = the model is out of its "
              "training distribution; collect field images to retrain/augment.")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--crop", required=True, choices=list(CROPS.keys()))
    ap.add_argument("--path", required=True, help="image file, folder of images, or labeled root")
    ap.add_argument("--backend", default="keras", choices=["keras", "tflite"],
                    help="keras = full model (most accurate); tflite = mobile model")
    ap.add_argument("--version", default=None, help="model version (default: latest)")
    ap.add_argument("--save-json", action="store_true",
                    help="write external_eval.json into the model version dir "
                         "(labeled mode only); used by the promotion gate")
    args = ap.parse_args()

    path = Path(args.path).expanduser()
    if not path.exists():
        print(f"Path not found: {path}")
        return 2

    print(f"\nLoading {args.crop} model ({args.backend}) ...")
    predictor = _load_predictor(args.crop, args.backend, args.version)
    print(f"  version : {predictor.version}")
    print(f"  classes : {predictor.class_names}")
    print(f"  threshold: {CONFIDENCE_THRESHOLD}")

    # Decide mode: labeled (subfolders match classes) vs unlabeled
    results = None
    if path.is_dir():
        subdirs = [d for d in path.iterdir() if d.is_dir()]
        norm_classes = {_norm(c) for c in predictor.class_names}
        if any(_norm(d.name) in norm_classes for d in subdirs):
            print("\nMode: LABELED EVAL (subfolders matched to classes)")
            results = run_labeled(predictor, path)
        else:
            print("\nMode: UNLABELED PREDICT (loose images)")
            run_unlabeled(predictor, path, recursive=bool(subdirs))
    else:
        print("\nMode: SINGLE IMAGE")
        run_unlabeled(predictor, path)

    if args.save_json:
        if results is None:
            print("\n[save-json] nothing to save (labeled eval did not run)")
        else:
            out_path = predictor.model_dir / predictor.version / "external_eval.json"
            payload = {
                "crop": args.crop,
                "model_version": predictor.version,
                "backend": args.backend,
                "eval_path": str(path),
                "evaluated_at": datetime.now(timezone.utc).isoformat(),
                **results,
            }
            with open(out_path, "w") as f:
                json.dump(payload, f, indent=2)
            print(f"\n[save-json] wrote {out_path}")
            from ml.utils.evaluation import update_metrics_with_external
            if update_metrics_with_external(args.crop, predictor.version):
                print(f"[save-json] updated metrics.json with external_accuracy")
    return 0


if __name__ == "__main__":
    sys.exit(main())
