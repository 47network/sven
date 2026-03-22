#!/usr/bin/env sh
set -eu

INSTALL_HOST="${1:-sven.example.com}"
APP_HOST="${2:-app.sven.example.com}"
INSTALL_BASE="https://${INSTALL_HOST}"
APP_BASE="https://${APP_HOST}"

require_header_prefix() {
  url="$1"
  header="$2"
  expected_prefix="$3"
  headers="$(curl -fsSI "$url")"
  line="$(printf '%s\n' "$headers" | awk -v h="$header" 'BEGIN{IGNORECASE=1} index(tolower($0), tolower(h ":"))==1 {print; exit}')"
  if [ -z "$line" ]; then
    echo "Missing header ${header} on ${url}"
    exit 1
  fi
  value="$(printf '%s\n' "$line" | sed -E "s/^[^:]+:[[:space:]]*//I")"
  lower_value="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  lower_expected="$(printf '%s' "$expected_prefix" | tr '[:upper:]' '[:lower:]')"
  case "$lower_value" in
    "$lower_expected"*) : ;;
    *)
      echo "Unexpected ${header} on ${url}: ${value} (expected prefix: ${expected_prefix})"
      exit 1
      ;;
  esac
}

require_200() {
  url="$1"
  code="$(curl -fsS -o /dev/null -w '%{http_code}' "$url")"
  if [ "$code" != "200" ]; then
    echo "Unexpected HTTP status for ${url}: ${code}"
    exit 1
  fi
}

echo "Smoke check install host: ${INSTALL_BASE}"
require_200 "${INSTALL_BASE}/"
require_200 "${INSTALL_BASE}/install.sh"
require_200 "${INSTALL_BASE}/install.ps1"
require_200 "${INSTALL_BASE}/install.cmd"
require_header_prefix "${INSTALL_BASE}/install.sh" "Content-Type" "text/plain"
require_header_prefix "${INSTALL_BASE}/install.ps1" "Content-Type" "text/plain"
require_header_prefix "${INSTALL_BASE}/install.cmd" "Content-Type" "text/plain"

echo "Smoke check app host: ${APP_BASE}"
require_200 "${APP_BASE}/healthz"
require_200 "${APP_BASE}/readyz"

echo "47matrix domain smoke checks passed."
