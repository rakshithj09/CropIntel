#!/bin/zsh
# Rice 3-class retrain (2026-06-11): Brown Spot + Rice Blast merged into
# "Blast or Brown Spot" via config label_aliases (they're visually inseparable
# on white-bg field leaves; see [[rice-data-lever-exhausted]]). Waits for the
# tomato fix to finish (one model at a time on 8 GB), then train -> eval on the
# merged holdout -> gated promote.
cd "$(dirname "$0")/../.." || exit 1
PY="${PY:-python}"

echo "=== RICE MERGE waiting for tomato fix $(date)"
while ! grep -q "TOMATO FIX done" ml/logs/tomato_fix_queue.log 2>/dev/null; do
  sleep 60
done
echo "=== RICE MERGE start $(date)"

$PY -m ml.training.train_crop --crop rice --epochs 40 > ml/logs/rice_merge.log 2>&1
echo "=== rice retrain done (exit $?) $(date)"
$PY -m ml.scripts.test_external --crop rice --path ml/field_test/rice_holdout_merged --save-json \
  > ml/logs/rice_merge_external.log 2>&1
echo "=== rice merged-holdout eval done (exit $?) $(date)"

ver=$($PY - << 'PYEOF'
from pathlib import Path
from ml.inference.versions import resolve_version
print(resolve_version(Path("ml/models/rice")) or "")
PYEOF
)
[ -n "$ver" ] && $PY -m ml.scripts.promote_model --crop rice --version "$ver" 2>&1 | sed 's/^/  /'
$PY -m ml.scripts.promote_model --status 2>&1 | tee ml/logs/rice_merge_status.txt
echo "=== RICE MERGE done $(date)"
