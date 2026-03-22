#!/usr/bin/env sh
set -eu

PUBLIC_URL="${SVEN_PUBLIC_BASE_URL:-https://staging.sven.systems}"
ADMIN_URL="${SVEN_ADMIN_BASE_URL:-https://admin.staging.sven.systems}"

docker compose ps
curl -fsS http://127.0.0.1:3000/healthz
curl -I "$PUBLIC_URL/login"
curl -I "$PUBLIC_URL/skills"
curl -I "$PUBLIC_URL/search"
curl -I "$PUBLIC_URL/community"
if [ -n "${ADMIN_URL:-}" ]; then
  curl -I "$ADMIN_URL/login"
fi
