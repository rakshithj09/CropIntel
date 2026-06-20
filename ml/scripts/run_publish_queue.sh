#!/bin/zsh
# Publish-readiness retrain queue (2026-06-11).
#  - rice:    composition shortcut fix (white-bg Dhan-Shomadhan disease folded
#             into training; disjoint 30% holdout at ml/field_test/rice_holdout)
#  - soybean: ASDID field data folded into 3 classes; disjoint 30% holdout
# One model at a time (8 GB RAM). Each train -> holdout external eval.
cd /Users/homeportal/CropIntel
PY=/Users/homeportal/CropIntel/.conda-py311/bin/python

echo "=== PUBLISH QUEUE start $(date)"

# --- disjointness guard: abort if any holdout image leaked into training ---
$PY - << 'PYEOF' || { echo "ABORT: holdout/train contamination"; exit 1; }
from pathlib import Path
def strip(n):
    for p in ("dhanwb_0_","dhanwb_1_","dhanwb_2_","asdid_"):
        if n.startswith(p): return n[len(p):]
    return n
bad = 0
for crop, sup, hold, cls in [
    ("rice","ml/data/rice/supplemental","ml/field_test/rice_holdout",
        ["Bacterial Leaf Blight","Brown Spot","Rice Blast"]),
    ("soybean","ml/data/soybean/supplemental","ml/field_test/soybean_holdout",
        ["Frogeye Leaf Spot","Healthy","Target Leaf Spot"]),
]:
    for c in cls:
        sd, hd = Path(sup)/c, Path(hold)/c
        if not hd.is_dir(): continue
        tr = {strip(f.name) for f in sd.glob('*') if f.is_file()}
        ho = {f.name for f in hd.iterdir() if f.is_file()}
        ov = tr & ho
        if ov:
            print(f"  [LEAK] {crop}/{c}: {len(ov)} overlapping"); bad += 1
        else:
            print(f"  [ok] {crop}/{c}: train n/a holdout {len(ho)} disjoint")
import sys; sys.exit(1 if bad else 0)
PYEOF

echo "=== rice retrain start $(date)"
$PY -m ml.training.train_crop --crop rice --epochs 40 > ml/logs/rice_fix.log 2>&1
echo "=== rice retrain done (exit $?) $(date)"
$PY -m ml.scripts.test_external --crop rice --path ml/field_test/rice_holdout --save-json \
  > ml/logs/rice_fix_external.log 2>&1
echo "=== rice holdout eval done (exit $?) $(date)"

echo "=== soybean retrain start $(date)"
$PY -m ml.training.train_crop --crop soybean --epochs 40 > ml/logs/soybean_fix.log 2>&1
echo "=== soybean retrain done (exit $?) $(date)"
$PY -m ml.scripts.test_external --crop soybean --path ml/field_test/soybean_holdout --save-json \
  > ml/logs/soybean_fix_external.log 2>&1
echo "=== soybean holdout eval done (exit $?) $(date)"

echo "=== PUBLISH QUEUE done $(date)"
