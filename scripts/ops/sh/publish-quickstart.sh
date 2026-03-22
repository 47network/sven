#!/usr/bin/env sh
set -eu

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TARGET_DIR="${1:-/opt/sven/quickstart}"

echo "Publishing quickstart assets to: $TARGET_DIR"
sudo mkdir -p "$TARGET_DIR"
sudo cp "$ROOT/deploy/quickstart/install.sh" "$TARGET_DIR/install.sh"
sudo cp "$ROOT/deploy/quickstart/install.ps1" "$TARGET_DIR/install.ps1"
sudo cp "$ROOT/deploy/quickstart/install.cmd" "$TARGET_DIR/install.cmd"
sudo cp "$ROOT/deploy/quickstart/index.html" "$TARGET_DIR/index.html"
sudo chmod 644 "$TARGET_DIR/install.sh" "$TARGET_DIR/install.ps1" "$TARGET_DIR/install.cmd" "$TARGET_DIR/index.html"

echo "Done. Verify:"
echo "  curl -I https://sven.example.com/install.sh"
echo "  curl -I https://sven.example.com/install.ps1"
