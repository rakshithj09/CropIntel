#!/bin/zsh
# Sequential training queue: rice (fix the 0.6%-external model with Paddy Doctor
# field data), then tomato (new crop). One at a time — 8 GB RAM machine.
cd "$(dirname "$0")/../.." || exit 1
PY="${PY:-python}"

echo "=== rice retrain start $(date)"
$PY -m ml.training.train_crop --crop rice --epochs 40 > ml/logs/rice_paddy.log 2>&1
echo "=== rice retrain done (exit $?) $(date)"

echo "=== rice external eval $(date)"
$PY -m ml.scripts.test_external --crop rice --path ml/field_test/rice --save-json \
  > ml/logs/rice_paddy_external.log 2>&1
echo "=== rice external eval done (exit $?)"

echo "=== tomato train start $(date)"
$PY -m ml.training.train_crop --crop tomato --epochs 40 > ml/logs/tomato_v1.log 2>&1
echo "=== tomato train done (exit $?) $(date)"

echo "=== wheat 8-class retrain start $(date)"
$PY -m ml.training.train_crop --crop wheat --epochs 40 > ml/logs/wheat_8class.log 2>&1
echo "=== wheat retrain done (exit $?) $(date)"

echo "=== wheat external eval $(date)"
$PY -m ml.scripts.test_external --crop wheat --path ml/field_test/wheat --save-json \
  > ml/logs/wheat_8class_external.log 2>&1
echo "=== wheat external eval done (exit $?)"
