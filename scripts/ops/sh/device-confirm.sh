#!/usr/bin/env sh
set -eu

MODE="${MODE:-login}" # login | session
GATEWAY_URL="${GATEWAY_URL:-http://localhost:3000}"
USER_CODE="${USER_CODE:-}"
USERNAME="${USERNAME:-47}"
PASSWORD="${PASSWORD:-change-me-in-production}"

DB_CONTAINER="${DB_CONTAINER:-sven_v010-postgres-1}"
DB_NAME="${DB_NAME:-sven}"
DB_USER="${DB_USER:-sven}"
USER_ID="${USER_ID:-}"

if [ -z "$USER_CODE" ]; then
  echo "USER_CODE is required. Example: USER_CODE=ABCD-1234 ./device-confirm.sh" >&2
  exit 2
fi

if [ "$MODE" = "login" ]; then
  COOKIE_JAR="$(mktemp)"
  trap 'rm -f "$COOKIE_JAR"' EXIT INT TERM

  curl -fsS -c "$COOKIE_JAR" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" \
    "$GATEWAY_URL/v1/auth/login" >/dev/null

  curl -fsS -b "$COOKIE_JAR" \
    -H 'Content-Type: application/json' \
    -d "{\"user_code\":\"$USER_CODE\"}" \
    "$GATEWAY_URL/v1/auth/device/confirm"
  exit 0
fi

if [ -z "$USER_ID" ]; then
  USER_ID="$(docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT id FROM users WHERE role='admin' ORDER BY created_at ASC LIMIT 1;" | tr -d '\r\n')"
fi
if [ -z "$USER_ID" ]; then
  echo "No admin user found and USER_ID not provided." >&2
  exit 1
fi

SESSION_ID="$(node -e "console.log(require('node:crypto').randomUUID())")"
INSERT_SQL="INSERT INTO sessions (id, user_id, status, created_at, expires_at) VALUES ('${SESSION_ID}', '${USER_ID}', 'active', NOW(), NOW() + INTERVAL '8 hours');"
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "$INSERT_SQL" >/dev/null

curl -fsS \
  -H "Cookie: sven_session=${SESSION_ID}" \
  -H 'Content-Type: application/json' \
  -d "{\"user_code\":\"$USER_CODE\"}" \
  "$GATEWAY_URL/v1/auth/device/confirm"
