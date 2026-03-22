#!/usr/bin/env sh
set -u

INSTALL_HOST="${1:-sven.example.com}"
APP_HOST="${2:-app.sven.example.com}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-8}"

line() {
  printf '%s\n' "------------------------------------------------------------"
}

section() {
  line
  printf '%s\n' "$1"
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

run_or_note() {
  if has_cmd "$1"; then
    shift
    "$@" 2>&1 || true
  else
    printf '%s\n' "missing command: $1"
  fi
}

curl_probe() {
  url="$1"
  if has_cmd curl; then
    printf '%s\n' "curl -I $url"
    curl -I -sS --max-time "$TIMEOUT_SECONDS" \
      -o /dev/null \
      -w "status=%{http_code} remote_ip=%{remote_ip} connect=%{time_connect}s appconnect=%{time_appconnect}s total=%{time_total}s\n" \
      "$url" 2>&1 || true
  else
    printf '%s\n' "missing command: curl"
  fi
}

resolve_host() {
  host="$1"
  printf '%s\n' "host: $host"
  if has_cmd getent; then
    getent hosts "$host" 2>/dev/null || true
  elif has_cmd nslookup; then
    nslookup "$host" 2>/dev/null || true
  elif has_cmd dig; then
    dig +short "$host" 2>/dev/null || true
  else
    printf '%s\n' "missing resolver command (getent/nslookup/dig)"
  fi
}

section "47matrix ingress diagnostics"
printf '%s\n' "install_host=$INSTALL_HOST app_host=$APP_HOST timeout=${TIMEOUT_SECONDS}s"
printf '%s\n' "timestamp=$(date -Iseconds 2>/dev/null || date)"

section "DNS resolution"
resolve_host "$INSTALL_HOST"
resolve_host "$APP_HOST"

section "Remote HTTP/HTTPS probes"
curl_probe "http://${INSTALL_HOST}/"
curl_probe "https://${INSTALL_HOST}/"
curl_probe "http://${APP_HOST}/"
curl_probe "https://${APP_HOST}/"
curl_probe "https://${APP_HOST}/healthz"
curl_probe "https://${APP_HOST}/readyz"
curl_probe "https://${APP_HOST}/privacy"
curl_probe "https://${APP_HOST}/terms"

section "Local listener snapshot (if running on edge host)"
if has_cmd ss; then
  ss -ltnp 2>/dev/null | grep -E '(:80|:443|:8088)[[:space:]]' || true
elif has_cmd netstat; then
  netstat -ltnp 2>/dev/null | grep -E '(:80|:443|:8088)[[:space:]]' || true
else
  printf '%s\n' "missing command: ss/netstat"
fi

section "Nginx status (if present)"
if has_cmd nginx; then
  nginx -t 2>&1 || true
else
  printf '%s\n' "missing command: nginx"
fi

if has_cmd systemctl; then
  systemctl is-active nginx 2>/dev/null || true
  systemctl --no-pager --full status nginx 2>/dev/null | sed -n '1,25p' || true
else
  printf '%s\n' "missing command: systemctl"
fi

section "Firewall snapshot (if present)"
run_or_note ufw ufw status verbose
if has_cmd nft; then
  nft list ruleset 2>/dev/null | sed -n '1,120p' || true
else
  printf '%s\n' "missing command: nft"
fi
if has_cmd iptables; then
  iptables -S 2>/dev/null || true
else
  printf '%s\n' "missing command: iptables"
fi

section "Done"
printf '%s\n' "If HTTP/HTTPS probes timeout and local :80/:443 are not listening, fix edge listener/bind first."
