#!/usr/bin/env sh
set -eu

SESSION_ID="${1:-}"
DB_CONTAINER="${DB_CONTAINER:-sven_v010-postgres-1}"
DB_NAME="${DB_NAME:-sven}"
DB_USER="${DB_USER:-sven}"

if [ -z "$SESSION_ID" ]; then
  echo "usage: device-query-session.sh <SESSION_ID>" >&2
  exit 2
fi

SQL="SELECT id, user_id, status, expires_at FROM sessions WHERE id='${SESSION_ID}';"
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "$SQL"
