#!/usr/bin/env sh
set -eu

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
NODE_MODE="${NODE_MODE:-auto}"
NODE_VERSION="${NODE_VERSION:-20.24.1}"
SKIP_INSTALL="${SKIP_INSTALL:-0}"

cd "$ROOT"

if [ "$NODE_MODE" = "nvm" ] || [ "$NODE_MODE" = "auto" ]; then
  if command -v nvm >/dev/null 2>&1; then
    nvm install "$NODE_VERSION"
    nvm use "$NODE_VERSION"
  elif [ "$NODE_MODE" = "nvm" ]; then
    echo "nvm requested but not found" >&2
    exit 2
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required in PATH for mobile-start-expo.sh" >&2
  exit 2
fi

cd "$ROOT/apps/companion-mobile"
if [ "$SKIP_INSTALL" != "1" ]; then
  npm install
fi

npx expo start --tunnel -c
