#!/bin/zsh
# Resume of run_overnight_queue.sh after the laptop crash on Jun 10 ~23:19.
# Rice train + external eval already completed (see overnight_queue.log).
# Tomato crashed mid-fine-tune (no resume support -> retrain from scratch),
# wheat never started. One at a time — 8 GB RAM machine.
cd /Users/homeportal/CropIntel
PY=/Users/homeportal/CropIntel/.conda-py311/bin/python

echo "=== RESUME QUEUE start $(date)"

echo "=== tomato train start $(date)"
$PY -m ml.training.train_crop --crop tomato --epochs 40 > ml/logs/tomato_v1.log 2>&1
echo "=== tomato train done (exit $?) $(date)"

echo "=== wheat 8-class retrain start $(date)"
$PY -m ml.training.train_crop --crop wheat --epochs 40 > ml/logs/wheat_8class.log 2>&1
echo "=== wheat retrain done (exit $?) $(date)"

echo "=== wheat external eval $(date)"
$PY -m ml.scripts.test_external --crop wheat --path ml/field_test/wheat --save-json \
  > ml/logs/wheat_8class_external.log 2>&1
echo "=== wheat external eval done (exit $?) $(date)"

echo "=== RESUME QUEUE done $(date)"
