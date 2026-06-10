#!/usr/bin/env python3
"""
Overnight autonomous training orchestrator for CropIntel.

Trains all 4 crops sequentially with automatic retry logic,
architecture switching, disk management, and comprehensive logging.

Usage:
    python -m ml.scripts.overnight_orchestrator
"""
import json
import os
import shutil
import signal
import subprocess
import sys
import time
import traceback
from datetime import datetime
from pathlib import Path

# Must be before any TF imports
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from ml.config import CROPS, DATA_DIR, MODELS_DIR, TRAINING_CONFIG  # noqa: E402
from ml.training.train_crop import train_crop_model  # noqa: E402
from ml.scripts.sanity_check import sanity_check_crop  # noqa: E402

# Item 10: gate every full run behind a 3-epoch sanity check. A crop whose
# predictions collapse to a single class is skipped (logged) rather than burning
# 50 epochs. Toggle with RUN_SANITY=0; SANITY_ONLY=1 stops after the checks.
RUN_SANITY = os.environ.get("RUN_SANITY", "1") != "0"
SANITY_ONLY = os.environ.get("SANITY_ONLY", "0") == "1"
SANITY_EPOCHS = int(os.environ.get("SANITY_EPOCHS", "3"))

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
EPOCHS = 50
VAL_ACCURACY_THRESHOLD = 0.60
MIN_DISK_GB = 5.0

# Retry sequence: (architecture, phase2_lr)
# Phase 2 uses a FIXED 1e-4 LR (item 6) — no ReduceLROnPlateau. Fallback
# architectures keep the same LR; only the backbone changes.
RETRY_SEQUENCE = [
    ("EfficientNetB0", 1e-4),
    ("MobileNetV2",    1e-4),
    ("ResNet50V2",     1e-4),
]

LOG_DIR = ROOT / "ml" / "logs"
RUN_LOG   = LOG_DIR / "overnight_run.log"
SUMMARY   = LOG_DIR / "overnight_summary.txt"
ZIP_OUT   = ROOT / "cropintel-models.zip"

LOG_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
_log_file = open(RUN_LOG, "a", buffering=1)

def log(msg: str, level: str = "INFO") -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] [{level}] {msg}"
    print(line, flush=True)
    _log_file.write(line + "\n")

# ---------------------------------------------------------------------------
# Disk management
# ---------------------------------------------------------------------------
def free_gb() -> float:
    return shutil.disk_usage("/").free / (1024 ** 3)


def ensure_disk_space() -> float:
    gb = free_gb()
    log(f"Disk free: {gb:.1f} GB")
    if gb < MIN_DISK_GB:
        log("Low disk — removing extracted zip files ...", "WARN")
        for zp in (ROOT / "ml" / "data").rglob("*.zip"):
            size_gb = zp.stat().st_size / (1024 ** 3)
            log(f"  Deleting {zp.name} ({size_gb:.2f} GB)")
            zp.unlink()
        gb = free_gb()
        log(f"Disk after cleanup: {gb:.1f} GB")
    if gb < MIN_DISK_GB:
        log(f"Still below {MIN_DISK_GB} GB — training may hit OOM.", "WARN")
    return gb

# ---------------------------------------------------------------------------
# Data verification / pre-training setup
# ---------------------------------------------------------------------------
def count_images(folder: Path) -> int:
    if not folder.is_dir():
        return 0
    exts = ("*.jpg", "*.JPG", "*.jpeg", "*.JPEG", "*.png", "*.PNG")
    return sum(len(list(folder.rglob(e))) for e in exts)


def verify_crop_data(crop: str) -> bool:
    base = DATA_DIR / crop
    total = count_images(base)
    log(f"  {crop}: {total} images in {base}")
    if total == 0:
        log(f"  {crop}: NO DATA FOUND — skipping", "ERROR")
        return False
    return True


def pre_training_setup(crop: str) -> None:
    """Pre-training data preparation steps per crop."""
    if crop == "soybean":
        # Ensure supplemental Healthy images are available via standard path.
        sup_healthy = DATA_DIR / "soybean" / "supplemental" / "Healthy"
        if sup_healthy.is_dir():
            n = count_images(sup_healthy)
            log(f"  soybean: supplemental/Healthy has {n} images — OK")
        else:
            log("  soybean: supplemental/Healthy not found — will rely on base dataset", "WARN")

    if crop == "rice":
        for d in [
            DATA_DIR / "rice" / "Rice_Leaf_AUG",
            DATA_DIR / "rice" / "supplemental" / "LabelledRice",
            DATA_DIR / "rice" / "supplemental" / "RiceDiseaseDataset",
        ]:
            if d.is_dir():
                log(f"  rice: found {d.name} ({count_images(d)} images)")

    if crop == "wheat":
        sup = DATA_DIR / "wheat" / "supplemental"
        if sup.is_dir():
            log(f"  wheat: supplemental has {count_images(sup)} images")
        else:
            log("  wheat: no supplemental data — using base dataset only", "WARN")

# ---------------------------------------------------------------------------
# Latest metrics helper
# ---------------------------------------------------------------------------
def latest_metrics(crop: str):
    """Return (val_accuracy, version_name, metrics_dict) from the most recent metrics.json."""
    crop_dir = MODELS_DIR / crop
    if not crop_dir.is_dir():
        return None, None, {}
    versions = sorted(
        [v for v in crop_dir.iterdir() if v.is_dir()],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    for v in versions:
        mp = v / "metrics.json"
        if mp.exists():
            try:
                m = json.loads(mp.read_text())
                return m.get("accuracy", 0.0), v.name, m
            except Exception:
                continue
    return None, None, {}

# ---------------------------------------------------------------------------
# Single training attempt
# ---------------------------------------------------------------------------
def attempt(crop: str, arch: str, lr: float, batch_size: int) -> float | str:
    """
    Run one training attempt.
    Returns val_accuracy (float) or an error tag string.
    """
    log(f"  → attempt: {crop} | arch={arch} | phase2_lr={lr} | batch={batch_size}")
    try:
        import tensorflow as tf  # already imported but re-resolves cleanly
        model_dir = train_crop_model(
            crop=crop,
            epochs=EPOCHS,
            fine_tune=True,
            from_scratch=False,
            architecture=arch,
            phase2_lr=lr,
            batch_size=batch_size,
        )
        mp = model_dir / "metrics.json"
        if not mp.exists():
            log(f"  metrics.json missing after training {crop}", "ERROR")
            return "NO_METRICS"
        m = json.loads(mp.read_text())
        acc = m.get("accuracy", 0.0)
        log(f"  ✓ {crop}/{arch} finished — test_accuracy={acc:.4f}")
        return acc

    except Exception as exc:
        msg = str(exc)
        tb  = traceback.format_exc()
        log(f"  ✗ {crop}/{arch} raised {type(exc).__name__}: {msg}", "ERROR")
        _log_file.write(tb + "\n")

        # OOM detection
        oom_signals = ("ResourceExhausted", "OOM", "out of memory",
                       "cannot allocate", "RESOURCE_EXHAUSTED")
        if any(s.lower() in msg.lower() for s in oom_signals) or any(
            s.lower() in tb.lower() for s in oom_signals
        ):
            return "OOM"
        if isinstance(exc, FileNotFoundError):
            return "FILENOTFOUND"
        return "ERROR"

# ---------------------------------------------------------------------------
# Per-crop orchestration
# ---------------------------------------------------------------------------
results: dict = {}
sanity_results: dict = {}

def run_crop(crop: str) -> None:
    log(f"\n{'='*60}")
    log(f"CROP: {crop.upper()}")
    log(f"{'='*60}")

    ensure_disk_space()

    if not verify_crop_data(crop):
        results[crop] = {"status": "skipped_no_data", "architecture": None,
                         "val_accuracy": None, "retries": 0}
        return

    pre_training_setup(crop)

    # Item 10: 3-epoch sanity check; skip the crop entirely if it mode-collapses.
    if RUN_SANITY:
        log(f"  Running {SANITY_EPOCHS}-epoch sanity check for {crop} ...")
        try:
            sr = sanity_check_crop(crop, epochs=SANITY_EPOCHS)
        except Exception as e:
            sr = {"status": "ERROR", "error": str(e), "collapsed": None,
                  "val_accuracy": None}
            log(f"  Sanity check raised {type(e).__name__}: {e}", "ERROR")
        sanity_results[crop] = sr
        log(f"  Sanity: status={sr.get('status')} "
            f"val_acc={sr.get('val_accuracy')} collapsed={sr.get('collapsed')}")
        if sr.get("collapsed"):
            log(f"  SKIPPING {crop} — sanity check shows mode collapse "
                f"(dominant pred {sr.get('dominant_pred_share')}).", "WARN")
            results[crop] = {"status": "skipped_sanity_collapse", "architecture": None,
                             "val_accuracy": sr.get("val_accuracy"), "retries": 0}
            return

    if SANITY_ONLY:
        log(f"  SANITY_ONLY set — skipping full training for {crop}.")
        results[crop] = {"status": "sanity_only", "architecture": None,
                         "val_accuracy": (sanity_results.get(crop) or {}).get("val_accuracy"),
                         "retries": 0}
        return

    best_acc   = 0.0
    best_arch  = None
    batch_size = 32
    retries    = 0

    for arch, lr in RETRY_SEQUENCE:
        log(f"\n  Attempt {retries + 1}/4 — {arch}, lr={lr}, batch={batch_size}")

        result = attempt(crop, arch, lr, batch_size)

        # OOM: halve batch and retry same attempt (once)
        if result == "OOM":
            log(f"  OOM detected — halving batch size to {batch_size // 2} and retrying")
            batch_size = max(8, batch_size // 2)
            result = attempt(crop, arch, lr, batch_size)

        if isinstance(result, str):
            # Non-recoverable error for this attempt
            log(f"  Attempt failed ({result}), moving to next", "WARN")
            retries += 1
            continue

        # result is a float accuracy
        if result > best_acc:
            best_acc  = result
            best_arch = arch

        if result >= VAL_ACCURACY_THRESHOLD:
            log(f"  ✓ THRESHOLD MET: {crop}/{arch} val_accuracy={result:.4f}")
            results[crop] = {
                "status": "success",
                "architecture": arch,
                "val_accuracy": result,
                "retries": retries,
                "phase2_lr": lr,
            }
            return

        log(f"  Below threshold ({result:.4f} < {VAL_ACCURACY_THRESHOLD}) — trying next")
        retries += 1

    # All attempts exhausted
    status = "best_below_threshold" if best_acc > 0 else "all_failed"
    log(f"  All attempts done. Best: {best_arch} @ {best_acc:.4f} — status={status}", "WARN")
    results[crop] = {
        "status": status,
        "architecture": best_arch,
        "val_accuracy": best_acc if best_acc > 0 else None,
        "retries": retries,
        "phase2_lr": None,
    }

# ---------------------------------------------------------------------------
# Packaging
# ---------------------------------------------------------------------------
def package_models() -> bool:
    log(f"\n{'='*60}")
    log("PACKAGING MODELS")
    log(f"{'='*60}")
    try:
        r = subprocess.run(
            [sys.executable, "-m", "ml.scripts.package_models", "-o", str(ZIP_OUT)],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=300,
        )
        if ZIP_OUT.exists() and ZIP_OUT.stat().st_size > 1024 * 1024:
            log(f"  Package OK: {ZIP_OUT} ({ZIP_OUT.stat().st_size / (1024**2):.1f} MB)")
            return True
        log(f"  Package may be missing/small. stdout={r.stdout!r} stderr={r.stderr!r}", "WARN")
        return False
    except Exception as e:
        log(f"  Packaging error: {e}", "ERROR")
        return False

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
def write_summary(pkg_ok: bool) -> None:
    gb = free_gb()
    lines = [
        "=" * 60,
        "OVERNIGHT TRAINING SUMMARY",
        f"Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "=" * 60,
        "",
    ]
    for crop, r in results.items():
        acc_str = f"{r['val_accuracy']:.4f}" if r["val_accuracy"] is not None else "N/A"
        lines += [
            f"{crop.upper()}:",
            f"  Status      : {r['status']}",
            f"  Architecture: {r['architecture']}",
            f"  Val Accuracy: {acc_str}",
            f"  Retries     : {r['retries']}",
        ]
        _, ver, m = latest_metrics(crop)
        if ver and m:
            lines.append("  Per-class F1:")
            for cls, cm in m.get("per_class", {}).items():
                lines.append(
                    f"    {cls:30s} p={cm['precision']:.3f}  r={cm['recall']:.3f}  f1={cm['f1_score']:.3f}"
                )
            cm_raw = m.get("confusion_matrix")
            if cm_raw:
                lines.append("  Confusion matrix:")
                for row in cm_raw:
                    lines.append(f"    {row}")
        lines.append("")

    lines += [
        f"Disk space remaining : {gb:.1f} GB",
        f"Model package        : {ZIP_OUT} ({'OK' if pkg_ok else 'MISSING/FAILED'})",
        "",
    ]

    text = "\n".join(lines)
    print(text, flush=True)
    SUMMARY.write_text(text)
    log(f"Summary written to {SUMMARY}")

# ---------------------------------------------------------------------------
# Training summary (item 15) — concise, decision-oriented
# ---------------------------------------------------------------------------
TRAIN_SUMMARY = LOG_DIR / "training_summary.txt"

def write_training_summary(pkg_ok: bool) -> None:
    lines = [
        "=" * 60,
        "CROPINTEL TRAINING SUMMARY",
        f"Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "=" * 60,
        "",
        "FINAL VAL ACCURACY PER CROP:",
    ]
    for crop, r in results.items():
        acc = f"{r['val_accuracy']:.4f}" if r.get("val_accuracy") is not None else "N/A"
        lines.append(f"  {crop:<10} {acc:>8}   ({r['status']}, arch={r.get('architecture')})")

    lines += ["", "UNDERPERFORMING CLASSES (recall < 0.6):"]
    any_weak = False
    for crop in results:
        _, ver, m = latest_metrics(crop)
        if not (ver and m):
            continue
        for cls, cm in m.get("per_class", {}).items():
            if cm.get("recall", 1.0) < 0.6:
                any_weak = True
                lines.append(f"  {crop}/{cls:<28} recall={cm['recall']:.3f} "
                             f"precision={cm['precision']:.3f} f1={cm['f1_score']:.3f}")
    if not any_weak:
        lines.append("  (none — all classes recall >= 0.6)")

    lines += ["", "SANITY CHECK RESULTS:"]
    if sanity_results:
        for crop, sr in sanity_results.items():
            lines.append(f"  {crop:<10} {sr.get('status'):<10} "
                         f"val_acc={sr.get('val_accuracy')} collapsed={sr.get('collapsed')}")
        failed = [c for c, sr in sanity_results.items()
                  if sr.get("collapsed") or sr.get("status") in ("ERROR", "COLLAPSED")]
        lines.append(f"  Crops that FAILED sanity check: {failed or 'none'}")
    else:
        lines.append("  (sanity checks not run)")

    lines += [
        "",
        "TFLITE VERIFICATION:",
    ]
    for crop in results:
        _, ver, m = latest_metrics(crop)
        tv = m.get("tflite_verified") if (ver and m) else None
        lines.append(f"  {crop:<10} tflite_verified={tv}")

    lines += [
        "",
        f"MODEL PACKAGE: {ZIP_OUT} "
        f"({'CREATED ' + str(round(ZIP_OUT.stat().st_size/(1024**2),1)) + ' MB' if pkg_ok and ZIP_OUT.exists() else 'NOT CREATED'})",
        "",
    ]
    text = "\n".join(lines)
    print(text, flush=True)
    TRAIN_SUMMARY.write_text(text)
    log(f"Training summary written to {TRAIN_SUMMARY}")

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    log("=" * 60)
    log("OVERNIGHT TRAINING ORCHESTRATOR STARTED")
    log(f"Root: {ROOT}")
    log(f"Epochs per crop: {EPOCHS}")
    log(f"Val accuracy threshold: {VAL_ACCURACY_THRESHOLD}")
    log("=" * 60)

    # Kill any existing training processes
    try:
        r = subprocess.run(
            ["pgrep", "-f", "train_all_crops|train_crop_model|overnight_orchestrator"],
            capture_output=True, text=True
        )
        pids = [int(p) for p in r.stdout.split() if p.strip().isdigit()
                and int(p) != os.getpid()]
        for pid in pids:
            log(f"Killing existing training process PID {pid}")
            try:
                os.kill(pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        if pids:
            time.sleep(3)
    except Exception as e:
        log(f"Could not scan/kill existing processes: {e}", "WARN")

    crops = list(CROPS.keys())  # corn, soybean, wheat, rice
    # Allow skipping already-completed or failed crops via env var SKIP_CROPS
    skip = set(os.environ.get("SKIP_CROPS", "").split(","))
    for crop in crops:
        if crop in skip:
            log(f"Skipping {crop} (SKIP_CROPS)")
            results[crop] = {"status": "skipped_by_user", "architecture": None,
                             "val_accuracy": None, "retries": 0}
            continue
        try:
            run_crop(crop)
        except KeyboardInterrupt:
            log("KeyboardInterrupt — stopping.", "ERROR")
            break
        except Exception as e:
            log(f"Unhandled exception for {crop}: {e}", "ERROR")
            _log_file.write(traceback.format_exc() + "\n")
            results[crop] = {"status": "unhandled_exception", "architecture": None,
                             "val_accuracy": None, "retries": 0}

    # In SANITY_ONLY mode there are no trained models to package.
    pkg_ok = False if SANITY_ONLY else package_models()
    write_summary(pkg_ok)
    write_training_summary(pkg_ok)
    log("ORCHESTRATOR FINISHED")


if __name__ == "__main__":
    main()
