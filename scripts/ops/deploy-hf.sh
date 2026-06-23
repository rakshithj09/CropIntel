#!/usr/bin/env bash
#
# Deploy the current branch to a Hugging Face Space as the CropIntel inference
# backend (for a Vercel/other frontend that points INFERENCE_URL at it).
#
# Why this is not a plain `git push`:
#   - HF rejects non-LFS binary files and scans the FULL history, so we push a
#     single-commit orphan branch with the training-artifact PNGs dropped.
#   - The Space serves the inference API publicly on app_port 8000 (the README
#     YAML is rewritten to 8000 for the deploy only; main keeps 3050).
#
# Usage:
#   HF_TOKEN=hf_xxxxx scripts/ops/deploy-hf.sh <hf-user>/<space-name>
#   # …or, after `huggingface-cli login` (stored git credentials):
#   scripts/ops/deploy-hf.sh <hf-user>/<space-name>
#
set -euo pipefail

REPO="${1:?usage: deploy-hf.sh <hf-user>/<space-name>}"
SRC_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
DEPLOY_BRANCH="hf-deploy-tmp"

# Root-level training/doc artifacts — not needed to build or run the app, and
# HF would reject them as non-LFS binaries.
ARTIFACTS="training_plots.png combined_training_plots_0-40.png ml_architecture.png \
rice_training_plot.png soybean_training_plot.png corn_training_plot.png"

if [ -n "${HF_TOKEN:-}" ]; then
  URL="https://user:${HF_TOKEN}@huggingface.co/spaces/${REPO}"
else
  URL="https://huggingface.co/spaces/${REPO}"
fi

cleanup() {
  git checkout -f "$SRC_BRANCH" >/dev/null 2>&1 || true
  git branch -D "$DEPLOY_BRANCH" >/dev/null 2>&1 || true
}
trap cleanup EXIT

git branch -D "$DEPLOY_BRANCH" 2>/dev/null || true
git checkout -q --orphan "$DEPLOY_BRANCH"
git add -A
# shellcheck disable=SC2086
git rm -q --cached $ARTIFACTS >/dev/null 2>&1 || true

# Backend mode: expose the inference API as the Space's public port.
python3 - <<'PY'
import re
p = "README.md"
s = open(p).read()
s = re.sub(r'app_port:\s*\d+', 'app_port: 8000', s, count=1)
open(p, "w").write(s)
PY
git add README.md

git commit -q -m "CropIntel — HF Space (inference backend, app_port 8000)"
git push --force "$URL" "${DEPLOY_BRANCH}:main"
echo "Deployed ${SRC_BRANCH} -> https://huggingface.co/spaces/${REPO} (main, backend mode)"
