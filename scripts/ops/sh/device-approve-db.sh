#!/usr/bin/env sh
set -eu

USER_CODE="${1:-}"
USER_ID="${2:-}"
DB_CONTAINER="${DB_CONTAINER:-sven_v010-postgres-1}"
DB_NAME="${DB_NAME:-sven}"
DB_USER="${DB_USER:-sven}"

if [ -z "$USER_CODE" ] || [ -z "$USER_ID" ]; then
  echo "usage: device-approve-db.sh <USER_CODE> <USER_ID>" >&2
  exit 2
fi

SQL="UPDATE device_codes SET status='approved', user_id='${USER_ID}', approved_at=NOW() WHERE user_code='${USER_CODE}' AND status='pending' AND expires_at > NOW() RETURNING id;"
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "$SQL"
