#!/bin/sh
# Nightly backup of model weights/pointers and the prediction audit log.
# Cron example (see docs/DEPLOYMENT.md):
#   0 3 * * * /opt/cropintel/scripts/ops/backup.sh /opt/cropintel /var/backups/cropintel
set -eu

APP_DIR="${1:-/opt/cropintel}"
BACKUP_DIR="${2:-/var/backups/cropintel}"
KEEP=7

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"

tar czf "$BACKUP_DIR/cropintel-$STAMP.tar.gz" \
  -C "$APP_DIR" \
  ml/models \
  $( [ -f "$APP_DIR/data/predictions.jsonl" ] && echo data/predictions.jsonl )

# Keep only the newest $KEEP backups.
ls -1t "$BACKUP_DIR"/cropintel-*.tar.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm --

echo "backup written: $BACKUP_DIR/cropintel-$STAMP.tar.gz"
