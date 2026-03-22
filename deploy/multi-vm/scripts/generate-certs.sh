#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# Sven — TLS / mTLS Certificate Generator
# Generates certificates for:
#   1. Nginx TLS termination (external-facing)
#   2. PostgreSQL SSL (inter-VM encrypted connections)
#   3. gRPC mTLS (bridge-47dynamics ↔ 47Dynamics API-Go)
#
# Usage:
#   sudo bash generate-certs.sh [OPTIONS]
#
# Options:
#   --output-dir <path>     Output directory (default: /srv/sven/prod/ssl)
#   --domain <fqdn>         Domain for server certs (default: sven.local)
#   --ca-cn <name>          CA common name (default: Sven Internal CA)
#   --days <n>              Certificate validity (default: 3650)
#   --grpc-only             Generate only gRPC mTLS certs
#   --nginx-only            Generate only nginx TLS cert
#   --pg-only               Generate only PostgreSQL SSL cert
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

OUTPUT_DIR="/srv/sven/prod/ssl"
DOMAIN="sven.local"
CA_CN="Sven Internal CA"
DAYS=3650
GRPC_ONLY=false
NGINX_ONLY=false
PG_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output-dir) OUTPUT_DIR="$2";  shift 2 ;;
    --domain)     DOMAIN="$2";      shift 2 ;;
    --ca-cn)      CA_CN="$2";       shift 2 ;;
    --days)       DAYS="$2";        shift 2 ;;
    --grpc-only)  GRPC_ONLY=true;   shift ;;
    --nginx-only) NGINX_ONLY=true;  shift ;;
    --pg-only)    PG_ONLY=true;     shift ;;
    -h|--help)    head -20 "$0" | tail -15; exit 0 ;;
    *)            echo "ERROR: Unknown option: $1" >&2; exit 1 ;;
  esac
done

log()  { printf '\033[1;36m[%s] %s\033[0m\n' "$(date -u +%H:%M:%S)" "$1"; }
ok()   { printf '\033[1;32m  ✓ %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33m  ⚠ %s\033[0m\n' "$1"; }
fail() { printf '\033[1;31m  ✗ %s\033[0m\n' "$1"; exit 1; }

# VM IPs for SAN entries
VM4_IP="10.74.47.8"
VM5_IP="10.74.47.9"
VM6_IP="10.74.47.10"
VM7_IP="10.74.47.11"
VM1_IP="10.47.47.5"

# ═══════════════════════════════════════════════════════════════
# Internal CA (shared root for all internal certs)
# ═══════════════════════════════════════════════════════════════
generate_ca() {
  local ca_dir="${OUTPUT_DIR}/ca"

  if [[ -f "${ca_dir}/ca.crt" && -f "${ca_dir}/ca.key" ]]; then
    warn "CA already exists at ${ca_dir} — reusing"
    return 0
  fi

  log "Generating internal CA"
  mkdir -p "$ca_dir"

  openssl genrsa -out "${ca_dir}/ca.key" 4096
  chmod 600 "${ca_dir}/ca.key"

  openssl req -x509 -new -nodes \
    -key "${ca_dir}/ca.key" \
    -sha256 \
    -days "$DAYS" \
    -out "${ca_dir}/ca.crt" \
    -subj "/CN=${CA_CN}/O=47Network/C=US"

  ok "CA created: ${ca_dir}/ca.crt"
}

# Helper: generate key + CSR + sign with CA
sign_cert() {
  local name="$1"
  local cn="$2"
  local san_file="$3"
  local out_dir="$4"
  local ca_dir="${OUTPUT_DIR}/ca"

  mkdir -p "$out_dir"

  # Generate private key
  openssl genrsa -out "${out_dir}/${name}.key" 2048
  chmod 600 "${out_dir}/${name}.key"

  # Generate CSR
  openssl req -new \
    -key "${out_dir}/${name}.key" \
    -out "${out_dir}/${name}.csr" \
    -subj "/CN=${cn}/O=47Network/C=US"

  # Sign with CA
  openssl x509 -req \
    -in "${out_dir}/${name}.csr" \
    -CA "${ca_dir}/ca.crt" \
    -CAkey "${ca_dir}/ca.key" \
    -CAcreateserial \
    -out "${out_dir}/${name}.crt" \
    -days "$DAYS" \
    -sha256 \
    -extfile "$san_file"

  # Clean up CSR
  rm -f "${out_dir}/${name}.csr"

  ok "${name}: ${out_dir}/${name}.crt"
}

# ═══════════════════════════════════════════════════════════════
# Nginx TLS (external-facing server cert)
# ═══════════════════════════════════════════════════════════════
generate_nginx_cert() {
  log "Generating Nginx TLS certificate"

  local nginx_dir="${OUTPUT_DIR}/nginx"
  local san_file
  san_file=$(mktemp)

  cat > "$san_file" <<SAN_EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${DOMAIN}
DNS.2 = *.${DOMAIN}
DNS.3 = localhost
IP.1 = 127.0.0.1
IP.2 = ${VM4_IP}
SAN_EOF

  sign_cert "server" "$DOMAIN" "$san_file" "$nginx_dir"
  rm -f "$san_file"

  # Copy CA cert for client verification
  cp "${OUTPUT_DIR}/ca/ca.crt" "${nginx_dir}/ca.crt"
  ok "Nginx TLS cert ready at ${nginx_dir}/"
}

# ═══════════════════════════════════════════════════════════════
# PostgreSQL SSL (inter-VM encrypted connections)
# ═══════════════════════════════════════════════════════════════
generate_pg_cert() {
  log "Generating PostgreSQL SSL certificate"

  local pg_dir="${OUTPUT_DIR}/postgres"
  local san_file
  san_file=$(mktemp)

  cat > "$san_file" <<SAN_EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = sven-postgres
DNS.2 = localhost
IP.1 = 127.0.0.1
IP.2 = ${VM4_IP}
SAN_EOF

  sign_cert "server" "sven-postgres" "$san_file" "$pg_dir"
  rm -f "$san_file"

  cp "${OUTPUT_DIR}/ca/ca.crt" "${pg_dir}/ca.crt"

  # PostgreSQL requires specific ownership (uid 999 for postgres:16-alpine)
  chown 999:999 "${pg_dir}/server.key" "${pg_dir}/server.crt" 2>/dev/null || true
  ok "PostgreSQL SSL cert ready at ${pg_dir}/"
}

# ═══════════════════════════════════════════════════════════════
# gRPC mTLS (bridge-47dynamics ↔ 47Dynamics API-Go)
# ═══════════════════════════════════════════════════════════════
generate_grpc_certs() {
  log "Generating gRPC mTLS certificates"

  local grpc_dir="${OUTPUT_DIR}/grpc"

  # Server cert (bridge-47dynamics on VM4)
  local server_san
  server_san=$(mktemp)
  cat > "$server_san" <<SAN_EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = bridge-47dynamics
DNS.2 = sven-bridge-47dynamics
DNS.3 = localhost
IP.1 = 127.0.0.1
IP.2 = ${VM4_IP}
SAN_EOF

  sign_cert "server" "sven-grpc-server" "$server_san" "$grpc_dir"
  rm -f "$server_san"

  # Client cert (47Dynamics API-Go on VM1)
  local client_san
  client_san=$(mktemp)
  cat > "$client_san" <<SAN_EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
extendedKeyUsage = clientAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = api-go
DNS.2 = 47dynamics-api-go
DNS.3 = localhost
IP.1 = 127.0.0.1
IP.2 = ${VM1_IP}
SAN_EOF

  sign_cert "client" "47dynamics-grpc-client" "$client_san" "$grpc_dir"
  rm -f "$client_san"

  # CA cert for both sides to verify each other
  cp "${OUTPUT_DIR}/ca/ca.crt" "${grpc_dir}/ca.crt"

  ok "gRPC mTLS certs ready at ${grpc_dir}/"
  echo ""
  echo "  Deploy to Sven VM4 (bridge-47dynamics):"
  echo "    ${grpc_dir}/server.crt → SVEN_BRIDGE_TLS_CERT"
  echo "    ${grpc_dir}/server.key → SVEN_BRIDGE_TLS_KEY"
  echo "    ${grpc_dir}/ca.crt     → SVEN_BRIDGE_TLS_CA"
  echo ""
  echo "  Deploy to 47Dynamics VM1 (api-go):"
  echo "    ${grpc_dir}/client.crt → SVEN_BRIDGE_TLS_CERT"
  echo "    ${grpc_dir}/client.key → SVEN_BRIDGE_TLS_KEY"
  echo "    ${grpc_dir}/ca.crt     → SVEN_BRIDGE_TLS_CA"
}

# ═══════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════
main() {
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  Sven Certificate Generator"
  echo "═══════════════════════════════════════════════════════════"
  echo ""

  mkdir -p "$OUTPUT_DIR"

  # Determine what to generate
  local gen_all=true
  if $GRPC_ONLY || $NGINX_ONLY || $PG_ONLY; then
    gen_all=false
  fi

  # Always need CA first
  generate_ca

  if $gen_all || $NGINX_ONLY; then
    generate_nginx_cert
  fi

  if $gen_all || $PG_ONLY; then
    generate_pg_cert
  fi

  if $gen_all || $GRPC_ONLY; then
    generate_grpc_certs
  fi

  echo ""
  log "All certificates generated in: ${OUTPUT_DIR}"
  echo ""
  echo "Directory structure:"
  find "$OUTPUT_DIR" -type f -name '*.crt' -o -name '*.key' | sort | while read -r f; do
    echo "  $f"
  done
  echo ""
}

main
