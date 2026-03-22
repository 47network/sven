#!/usr/bin/env sh
set -eu

DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="${1:-/opt/sven/quickstart}"
INSTALL_HOST="${2:-sven.example.com}"
APP_HOST="${3:-app.sven.example.com}"

echo "Publishing quickstart assets..."
sh "$DIR/publish-quickstart.sh" "$TARGET_DIR"

echo "Running 47matrix domain smoke checks..."
sh "$DIR/smoke-47matrix-domains.sh" "$INSTALL_HOST" "$APP_HOST"

echo "Quickstart publish + smoke complete."
