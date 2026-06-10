#!/bin/zsh
# Launch the local drag-and-drop model-compare tool.
#   ./compare.sh
# Then open http://localhost:8050
cd "$(dirname "$0")"
PY=.conda-py311/bin/python
# Flask is required (one-time): $PY -m pip install flask
exec "$PY" -m ml.serve.compare_app
