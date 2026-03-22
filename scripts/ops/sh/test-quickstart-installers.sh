#!/usr/bin/env sh
set -eu

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required for quickstart installer smoke checks."
  exit 1
fi

PORT="${QUICKSTART_SMOKE_PORT:-18088}"
CONTAINER_NAME="sven-quickstart-smoke-$$"

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "Starting isolated quickstart-static container for smoke checks..."
docker run -d --rm \
  --name "$CONTAINER_NAME" \
  -p "$PORT:80" \
  -v "$ROOT/deploy/quickstart:/usr/share/nginx/html:ro" \
  -v "$ROOT/config/nginx/quickstart-static.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx:alpine >/dev/null

echo "Waiting for quickstart endpoint..."
i=0
until curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 40 ]; then
    echo "quickstart-static did not become ready in time."
    exit 1
  fi
  sleep 1
done

assert_installer_plain() {
  path="$1"
  headers="$(curl -fsSI "http://127.0.0.1:${PORT}$path")"
  status="$(printf '%s\n' "$headers" | sed -n '1s/.* \([0-9][0-9][0-9]\).*/\1/p')"
  ctype="$(printf '%s\n' "$headers" | awk 'BEGIN{IGNORECASE=1} /^Content-Type:/{print tolower($0); exit}')"
  printf '%s\n' "$headers" | grep -qi '^Content-Type: text/plain' || {
    echo "Unexpected Content-Type for $path: ${ctype:-missing}"
    exit 1
  }
  if [ "$status" != "200" ]; then
    echo "Unexpected status for $path: ${status:-unknown}"
    exit 1
  fi
  echo "ok: $path -> $status, $ctype"
}

echo "Checking installer endpoints..."
assert_installer_plain "/install.sh"
assert_installer_plain "/install.ps1"
assert_installer_plain "/install.cmd"

echo "Quickstart installer smoke checks passed."
