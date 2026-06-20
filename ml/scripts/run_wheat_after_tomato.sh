#!/bin/zsh
# Waits for the tomato run (in run_overnight_queue.sh) to finish, then trains
# the 8-class wheat model and runs its external eval. Launched detached so it
# survives the agent session.
cd /Users/homeportal/CropIntel
PY=/Users/homeportal/CropIntel/.conda-py311/bin/python

while ! grep -q "tomato train done" ml/logs/overnight_queue.log 2>/dev/null; do
  sleep 30
done
echo "=== wheat 8-class retrain start $(date)"
$PY -m ml.training.train_crop --crop wheat --epochs 40 > ml/logs/wheat_8class.log 2>&1
echo "=== wheat retrain done (exit $?) $(date)"
$PY -m ml.scripts.test_external --crop wheat --path ml/field_test/wheat --save-json \
  > ml/logs/wheat_8class_external.log 2>&1
echo "=== wheat external eval done (exit $?) $(date)"
