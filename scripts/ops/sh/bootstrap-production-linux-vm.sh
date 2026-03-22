#!/usr/bin/env sh
set -eu

ROOT_DIR="${SVEN_PROD_ROOT:-/srv/sven/prod}"
ENV_TEMPLATE="${1:-config/env/.env.production.linux-vm.example}"
ENV_TARGET="${SVEN_PROD_ENV_FILE:-$ROOT_DIR/env/.env.production}"

mkdir -p \
  "$ROOT_DIR/app" \
  "$ROOT_DIR/compose" \
  "$ROOT_DIR/env" \
  "$ROOT_DIR/backups" \
  "$ROOT_DIR/logs" \
  "$ROOT_DIR/data/postgres" \
  "$ROOT_DIR/data/postgres-wal" \
  "$ROOT_DIR/data/nats" \
  "$ROOT_DIR/data/opensearch" \
  "$ROOT_DIR/data/artifacts" \
  "$ROOT_DIR/data/nas" \
  "$ROOT_DIR/data/integrations" \
  "$ROOT_DIR/data/tts" \
  "$ROOT_DIR/data/wake-word" \
  "$ROOT_DIR/data/git" \
  "$ROOT_DIR/data/browser-profile" \
  "$ROOT_DIR/data/ollama" \
  "$ROOT_DIR/data/prometheus" \
  "$ROOT_DIR/data/grafana" \
  "$ROOT_DIR/data/loki" \
  "$ROOT_DIR/data/loki-archive" \
  "$ROOT_DIR/data/searxng" \
  "$ROOT_DIR/data/tunnel"

if [ ! -f "$ENV_TARGET" ]; then
  cp "$ENV_TEMPLATE" "$ENV_TARGET"
  echo "Created production env template at $ENV_TARGET"
else
  echo "Production env already exists at $ENV_TARGET"
fi

echo "Production Linux VM directories are ready under $ROOT_DIR"
