#!/usr/bin/env sh
set -eu

ENV_FILE="${SVEN_PROD_ENV_FILE:-/srv/sven/prod/env/.env.production}"

docker compose \
  --env-file "$ENV_FILE" \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  -f docker-compose.production.linux-vm.yml \
  up -d
