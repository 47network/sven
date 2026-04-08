#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

container="sven_release_ops_pg"
port="${SVEN_OPS_DRILL_PG_PORT:-55432}"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if docker ps -a --format '{{.Names}}' | grep -qx "$container"; then
  docker rm -f "$container" >/dev/null
fi

docker run -d \
  --name "$container" \
  -e POSTGRES_DB=sven \
  -e POSTGRES_USER=sven \
  -e POSTGRES_PASSWORD=sven \
  -p "${port}:5432" \
  pgvector/pgvector:pg16 >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$container" pg_isready -U sven -d sven >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker exec "$container" pg_isready -U sven -d sven >/dev/null

export DATABASE_URL="postgresql://sven:sven@localhost:${port}/sven"
export SVEN_MIGRATION_ID_MODE="${SVEN_MIGRATION_ID_MODE:-text}"

npm run --workspace packages/shared build
npm run --workspace services/gateway-api build
npm run --workspace services/gateway-api db:migrate

psql "postgresql://sven:sven@localhost:${port}/postgres" -c "DROP DATABASE IF EXISTS sven_copy;"
psql "postgresql://sven:sven@localhost:${port}/postgres" -c "CREATE DATABASE sven_copy TEMPLATE sven;"
DATABASE_URL="postgresql://sven:sven@localhost:${port}/sven_copy" npm run --workspace services/gateway-api db:migrate

pg_dump "postgresql://sven:sven@localhost:${port}/sven_copy" > sven_copy.sql
psql "postgresql://sven:sven@localhost:${port}/postgres" -c "DROP DATABASE IF EXISTS sven_restore;"
psql "postgresql://sven:sven@localhost:${port}/postgres" -c "CREATE DATABASE sven_restore;"
psql "postgresql://sven:sven@localhost:${port}/sven_restore" < sven_copy.sql

has_underscore_migrations="$(
  psql "postgresql://sven:sven@localhost:${port}/sven_restore" -At -c \
    "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_migrations' LIMIT 1;"
)"
has_plain_migrations="$(
  psql "postgresql://sven:sven@localhost:${port}/sven_restore" -At -c \
    "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migrations' LIMIT 1;"
)"
if [ "$has_underscore_migrations" = "1" ]; then
  export MIGRATION_HISTORY_COUNT="$(
    psql "postgresql://sven:sven@localhost:${port}/sven_restore" -At -c "SELECT COUNT(*)::text FROM public._migrations;"
  )"
elif [ "$has_plain_migrations" = "1" ]; then
  export MIGRATION_HISTORY_COUNT="$(
    psql "postgresql://sven:sven@localhost:${port}/sven_restore" -At -c "SELECT COUNT(*)::text FROM public.migrations;"
  )"
else
  export MIGRATION_HISTORY_COUNT="0"
fi
if [ "${MIGRATION_HISTORY_COUNT:-0}" -gt 0 ]; then
  export MIGRATION_HISTORY_PRESENT=true
else
  export MIGRATION_HISTORY_PRESENT=false
fi

node -e "const fs=require('fs'); fs.writeFileSync('restore-validation.json', JSON.stringify({database:'sven_restore', migration_history_count:Number(process.env.MIGRATION_HISTORY_COUNT||0), migration_history_present:String(process.env.MIGRATION_HISTORY_PRESENT)==='true'}, null, 2) + '\n');"
node -e "const fs=require('fs'); fs.writeFileSync('migration-drill-scope.json', JSON.stringify({mode:'full_series', skip_incompatible:false, id_mode:process.env.SVEN_MIGRATION_ID_MODE || 'text', max_series:null, validated_databases:['sven','sven_copy','sven_restore']}, null, 2) + '\n');"

export GITHUB_RUN_ID="${GITHUB_RUN_ID:-local-release-ops-drill-$(date +%s)}"
export GITHUB_SHA="${GITHUB_SHA:-$(git rev-parse HEAD)}"
export GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-local/thesven}"
export GITHUB_SERVER_URL="${GITHUB_SERVER_URL:-https://github.com}"
export SVEN_OPS_DRILL_PATH_CLASS="${SVEN_OPS_DRILL_PATH_CLASS:-migration_backup_restore_change}"

node scripts/release-ops-drill-status.cjs --strict
