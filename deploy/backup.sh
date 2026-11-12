#!/usr/bin/env sh
# Nightly backup of the Dokploy deployment: a database dump plus an archive of
# the uploaded files, kept for $KEEP_DAYS days. Run on the VPS as root.
# See docs/deploy-dokploy.md ("Backups") for installing it as a cron job.
#
#   sh /srv/eithm/backup.sh
set -eu

DATA_DIR="${DATA_DIR:-/srv/eithm}"
BACKUP_DIR="${BACKUP_DIR:-$DATA_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"

# The database container Dokploy started from docker-compose.dokploy.yml.
# Found automatically; set DB_CONTAINER if other Dokploy apps also run a
# postgres:17-alpine service named "db".
DB_CONTAINER="${DB_CONTAINER:-$(docker ps --filter 'label=com.docker.compose.service=db' \
  --filter 'ancestor=postgres:17-alpine' --format '{{.Names}}' | head -n 1)}"
if [ -z "$DB_CONTAINER" ]; then
  echo "No running postgres:17-alpine 'db' container found." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "Dumping database from $DB_CONTAINER..."
docker exec "$DB_CONTAINER" pg_dump -U portal -d portal --format=custom \
  > "$BACKUP_DIR/db_$STAMP.dump"

echo "Archiving uploads..."
tar -czf "$BACKUP_DIR/uploads_$STAMP.tar.gz" -C "$DATA_DIR" uploads

find "$BACKUP_DIR" -type f \( -name 'db_*.dump' -o -name 'uploads_*.tar.gz' \) \
  -mtime +"$KEEP_DAYS" -delete

echo "Backup written to $BACKUP_DIR ($STAMP)."
