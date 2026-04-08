#!/usr/bin/env sh
set -eu

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TARGET_DIR="${1:-/opt/sven/quickstart}"
TMP_ARCHIVE="$(mktemp "${TMPDIR:-/tmp}/thesven-quickstart-src.XXXXXX.tar.gz")"
trap 'rm -f "$TMP_ARCHIVE"' EXIT INT TERM

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
elif [ -w "$(dirname "$TARGET_DIR")" ] 2>/dev/null || [ -d "$TARGET_DIR" ] && [ -w "$TARGET_DIR" ]; then
  SUDO=""
else
  SUDO="sudo"
fi

echo "Publishing quickstart assets to: $TARGET_DIR"
git -C "$ROOT" archive --format=tar.gz --output="$TMP_ARCHIVE" HEAD
$SUDO mkdir -p "$TARGET_DIR"
$SUDO rm -rf "$TARGET_DIR/assets" "$TARGET_DIR/suite" "$TARGET_DIR/source"
$SUDO mkdir -p "$TARGET_DIR/source"
$SUDO cp -R "$ROOT/deploy/quickstart/." "$TARGET_DIR/"
$SUDO cp "$TMP_ARCHIVE" "$TARGET_DIR/source/thesven-src.tar.gz"
$SUDO find "$TARGET_DIR" -type d -exec chmod 755 {} \;
$SUDO find "$TARGET_DIR" -type f -exec chmod 644 {} \;

echo "Done. Verify:"
echo "  curl -I https://sven.systems/install.sh"
echo "  curl -I https://sven.systems/install.ps1"
echo "  curl -I https://sven.systems/source/thesven-src.tar.gz"
