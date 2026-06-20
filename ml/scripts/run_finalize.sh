#!/bin/zsh
# Runs after run_publish_queue.sh completes: tomato external eval, gated
# promotion of every crop that passes (gate-protected, no --force), package,
# and a summary. Launched detached; waits on the queue's done marker.
cd /Users/homeportal/CropIntel
PY=/Users/homeportal/CropIntel/.conda-py311/bin/python
SUM=ml/logs/publish_summary.txt

echo "=== FINALIZE waiting for publish queue $(date)"
while ! grep -q "PUBLISH QUEUE done" ml/logs/publish_queue.log 2>/dev/null; do
  sleep 60
done
echo "=== FINALIZE start $(date)"

# Tomato external eval (set already built + deduped at ml/field_test/tomato)
$PY -m ml.scripts.test_external --crop tomato --path ml/field_test/tomato --save-json \
  > ml/logs/tomato_external.log 2>&1
echo "=== tomato external eval done (exit $?) $(date)"

# Attempt gated promotion of the newest version of each crop (gate blocks fails)
for crop in corn wheat rice soybean tomato; do
  ver=$($PY - "$crop" << 'PYEOF'
import sys
from pathlib import Path
from ml.inference.versions import resolve_version
crop = sys.argv[1]
v = resolve_version(Path("ml/models")/crop)
print(v or "")
PYEOF
)
  if [ -n "$ver" ]; then
    echo "--- promote $crop $ver ---"
    $PY -m ml.scripts.promote_model --crop "$crop" --version "$ver" 2>&1 | sed 's/^/    /'
  fi
done

echo "" ; echo "=== FINAL STATUS ===" | tee $SUM
$PY -m ml.scripts.promote_model --status 2>&1 | tee -a $SUM

# Package promoted models (tflite) for shipping
$PY -m ml.scripts.package_models --tflite-only -o cropintel-models.zip 2>&1 | tail -5 | tee -a $SUM
echo "=== FINALIZE done $(date)" | tee -a $SUM
