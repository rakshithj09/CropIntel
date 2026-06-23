#!/usr/bin/env bash
#
# Deploy the current branch to a Hugging Face Space as the all-in-one CropIntel
# app (Next.js UI + Python inference together, public on app_port 3050).
#
# Why this is not a plain `git push`:
#   - HF rejects non-LFS binary files and scans the FULL history, so we push a
#     single-commit orphan branch with the training-artifact PNGs dropped.
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

git commit -q -m "CropIntel — HF Space deploy (all-in-one app)"
git push --force "$URL" "${DEPLOY_BRANCH}:main"
echo "Deployed ${SRC_BRANCH} -> https://huggingface.co/spaces/${REPO} (main)"
