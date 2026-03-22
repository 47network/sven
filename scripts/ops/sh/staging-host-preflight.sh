#!/usr/bin/env sh
set -eu

ROOT_DIR="${SVEN_STAGE_ROOT:-/srv/sven/staging}"
ENV_FILE="${SVEN_STAGE_ENV_FILE:-$ROOT_DIR/env/.env.staging}"

echo "== Host identity =="
hostname
uname -a

echo "== Disk / memory =="
df -h
free -h

echo "== Docker =="
docker version >/dev/null
docker compose version

echo "== Firewall =="
if command -v ufw >/dev/null 2>&1; then
  sudo ufw status verbose || true
fi

echo "== Runtime layout =="
find "$ROOT_DIR" -maxdepth 2 -type d | sort

echo "== Env file =="
test -f "$ENV_FILE"
grep -E '^(SVEN_PUBLIC_BASE_URL|SVEN_ADMIN_BASE_URL|SVEN_STAGE_ROOT|SVEN_STAGE_ARTIFACTS_DIR|OLLAMA_URL)=' "$ENV_FILE"

echo "== Compose render =="
docker compose \
  --env-file "$ENV_FILE" \
  -f docker-compose.yml \
  -f docker-compose.staging.yml \
  -f docker-compose.staging.linux-vm.yml \
  config >/dev/null

echo "Staging host preflight passed"
