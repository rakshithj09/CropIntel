#!/bin/zsh
cd /Users/homeportal/CropIntel
/Users/homeportal/CropIntel/.conda-py311/bin/python -m ml.training.train_crop --crop soybean --epochs 50 > ml/logs/soybean_vaishali.log 2>&1
