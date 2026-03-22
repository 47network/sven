#!/usr/bin/env sh
set -eu

ENV_FILE="${SVEN_STAGE_ENV_FILE:-/srv/sven/staging/env/.env.staging}"

docker compose \
  --env-file "$ENV_FILE" \
  -f docker-compose.yml \
  -f docker-compose.staging.yml \
  -f docker-compose.staging.linux-vm.yml \
  up -d
