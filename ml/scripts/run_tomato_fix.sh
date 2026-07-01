#!/bin/zsh
# Tomato field-generalization fix (2026-06-11): PlantDoc field photos folded
# into training (upweighted x8) for the high-volume classes; disjoint holdout
# at ml/field_test/tomato_holdout. Retrain -> holdout eval -> gated promote.
cd "$(dirname "$0")/../.." || exit 1
PY="${PY:-python}"

echo "=== TOMATO FIX start $(date)"

# disjointness guard: no holdout image may appear in the training fold
$PY - << 'PYEOF' || { echo "ABORT: holdout/train contamination"; exit 1; }
from pathlib import Path
def strip(n):
    if n.startswith("pdocfield_"):
        return n.split("_",2)[-1]
    return n
sup=Path("ml/data/tomato/supplemental"); hold=Path("ml/field_test/tomato_holdout")
bad=0
for cdir in hold.iterdir():
    if not cdir.is_dir(): continue
    c=cdir.name
    tr={strip(f.name) for f in (sup/c).glob('*')} if (sup/c).is_dir() else set()
    ho={f.name for f in cdir.iterdir() if f.is_file()}
    ov=tr&ho
    print(f"  {'[LEAK]' if ov else '[ok]'} tomato/{c}: holdout {len(ho)}{' OVERLAP '+str(len(ov)) if ov else ' disjoint'}")
    bad+=bool(ov)
import sys; sys.exit(1 if bad else 0)
PYEOF

echo "=== tomato retrain start $(date)"
$PY -m ml.training.train_crop --crop tomato --epochs 40 > ml/logs/tomato_fix.log 2>&1
echo "=== tomato retrain done (exit $?) $(date)"
$PY -m ml.scripts.test_external --crop tomato --path ml/field_test/tomato_holdout --save-json \
  > ml/logs/tomato_fix_external.log 2>&1
echo "=== tomato holdout eval done (exit $?) $(date)"

# gated promote (blocked automatically if it fails the gate)
ver=$($PY - << 'PYEOF'
from pathlib import Path
from ml.inference.versions import resolve_version
print(resolve_version(Path("ml/models/tomato")) or "")
PYEOF
)
[ -n "$ver" ] && $PY -m ml.scripts.promote_model --crop tomato --version "$ver" 2>&1 | sed 's/^/  /'
$PY -m ml.scripts.promote_model --status 2>&1 | tee ml/logs/tomato_fix_status.txt
echo "=== TOMATO FIX done $(date)"
