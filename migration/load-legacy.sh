#!/usr/bin/env sh
# Copies the two legacy databases into this stack's Postgres, as the
# databases legacy_up (University Portal) and legacy_gcr (GCR), so
# `npm run db:import-legacy` can read them. Run on the host, with all three
# stacks' database containers running:
#
#   sh migration/load-legacy.sh
#
# Container names/credentials default to the legacy compose files; override
# with the environment variables below. The dumps land in migration/dumps/
# (git-ignored: they hold personal data).
set -eu

UP_CONTAINER="${UP_CONTAINER:-attendance_db}"
UP_USER="${UP_USER:-postgres}"
UP_DB="${UP_DB:-attendance_db}"
GCR_CONTAINER="${GCR_CONTAINER:-gcr-postgres}"
GCR_USER="${GCR_USER:-gcr}"
GCR_DB="${GCR_DB:-gcr_dev}"
TARGET_CONTAINER="${TARGET_CONTAINER:-portal-postgres}"
TARGET_USER="${TARGET_USER:-portal}"

cd "$(dirname "$0")"
mkdir -p dumps

echo "Dumping $UP_DB from $UP_CONTAINER..."
docker exec "$UP_CONTAINER" pg_dump -U "$UP_USER" -d "$UP_DB" --no-owner --no-privileges > dumps/legacy_up.sql
echo "Dumping $GCR_DB from $GCR_CONTAINER..."
docker exec "$GCR_CONTAINER" pg_dump -U "$GCR_USER" -d "$GCR_DB" --no-owner --no-privileges > dumps/legacy_gcr.sql

for name in legacy_up legacy_gcr; do
  echo "Restoring $name into $TARGET_CONTAINER..."
  docker exec "$TARGET_CONTAINER" psql -q -U "$TARGET_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS $name WITH (FORCE);" \
    -c "CREATE DATABASE $name OWNER $TARGET_USER;"
  # transaction_timeout etc. from a newer pg_dump are harmless on restore.
  docker exec -i "$TARGET_CONTAINER" psql -q -U "$TARGET_USER" -d "$name" -v ON_ERROR_STOP=0 < "dumps/$name.sql" > /dev/null
done

echo "Done. Next: docker compose exec server npm run db:import-legacy"
