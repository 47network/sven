#!/usr/bin/env sh
set -eu

if [ "$#" -lt 4 ]; then
  echo "Usage: $0 <api-key> <platform:android|ios> <app-binary> <flow-file>"
  exit 1
fi

API_KEY="$1"
PLATFORM="$2"
APP_BINARY="$3"
FLOW_FILE="$4"

if [ ! -f "$APP_BINARY" ]; then
  echo "App binary not found: $APP_BINARY"
  exit 1
fi

if [ ! -f "$FLOW_FILE" ]; then
  echo "Flow file not found: $FLOW_FILE"
  exit 1
fi

if ! command -v maestro >/dev/null 2>&1; then
  echo "maestro CLI not found in PATH."
  exit 1
fi

RUN_NAME="sven-${PLATFORM}-${GITHUB_RUN_ID:-local}-$(date +%Y%m%d%H%M%S)"

echo "Running Maestro Cloud: $RUN_NAME"
maestro cloud \
  --apiKey "$API_KEY" \
  --name "$RUN_NAME" \
  "$APP_BINARY" \
  "$FLOW_FILE"
