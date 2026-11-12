#!/usr/bin/env sh
# Nightly backup of the uploaded files, kept for $KEEP_DAYS days. Run on the
# VPS as root. The database is a separate Dokploy PostgreSQL service and is
# backed up by Dokploy itself (its Backups tab).
# See docs/deploy-dokploy.md ("Backups") for installing this as a cron job.
#
#   sh /srv/eithm/backup.sh
set -eu

DATA_DIR="${DATA_DIR:-/srv/eithm}"
BACKUP_DIR="${BACKUP_DIR:-$DATA_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"

mkdir -p "$BACKUP_DIR"

echo "Archiving uploads..."
tar -czf "$BACKUP_DIR/uploads_$STAMP.tar.gz" -C "$DATA_DIR" uploads

find "$BACKUP_DIR" -type f -name 'uploads_*.tar.gz' -mtime +"$KEEP_DAYS" -delete

echo "Backup written to $BACKUP_DIR/uploads_$STAMP.tar.gz"
