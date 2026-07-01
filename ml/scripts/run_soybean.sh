#!/bin/zsh
cd "$(dirname "$0")/../.." || exit 1
"${PY:-python}" -m ml.training.train_crop --crop soybean --epochs 50 > ml/logs/soybean_vaishali.log 2>&1
