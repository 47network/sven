#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# Sven — Multi-Node Installer
# Provisions one VM within the Sven multi-VM deployment topology.
# Run once on each VM with the appropriate --vm-role flag.
#
# Topology:
#   VM4 (platform)  — PostgreSQL, NATS, Gateway API, Agents, Bridge, Nginx
#   VM5 (ai)        — Ollama, LiteLLM, faster-whisper, Piper, Wake-word
#   VM6 (data)      — OpenSearch, RAG, SearXNG, OTEL, Prometheus, Grafana
#   VM7 (adapters)  — Channel adapters, Cloudflared tunnel
#
# Prerequisites:
#   - Debian 12 / Ubuntu 22.04+ (x86_64 or aarch64)
#   - Root or sudo access
#   - VM4: 16+ GB RAM, 8+ CPU, 200 GB disk
#   - VM5: 16+ GB RAM, 8+ CPU, 100 GB disk, NVIDIA GPU recommended
#   - VM6: 16+ GB RAM, 8+ CPU, 500 GB disk (data storage)
#   - VM7: 8+ GB RAM, 4+ CPU, 50 GB disk
#
# Usage:
#   sudo bash install-multi-node.sh --vm-role <role> [OPTIONS]
#
# Options:
#   --vm-role <role>       Required: platform | ai | data | adapters
#   --domain <fqdn>        Domain for TLS (default: sven.local)
#   --email <email>        Email for Let's Encrypt (enables auto-TLS)
#   --data-dir <path>      Data root (default: /srv/sven/prod)
#   --registry <url>       Container registry (default: ghcr.io/47network/sven)
#   --tag <version>        Image tag for app services (default: latest)
#   --skip-firewall        Skip UFW firewall setup
#   --skip-certbot         Skip Let's Encrypt (use self-signed)
#   --skip-wireguard       Skip WireGuard overlay setup
#   --non-interactive      Skip confirmation prompts
#   --dry-run              Print actions without executing
#   -h, --help             Show this help
#
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Defaults ──
VM_ROLE=""
DOMAIN="sven.local"
CERTBOT_EMAIL=""
DATA_DIR="/srv/sven/prod"
REGISTRY="ghcr.io/47network/sven"
IMAGE_TAG="latest"
SKIP_FIREWALL=false
SKIP_CERTBOT=true
SKIP_WIREGUARD=false
NON_INTERACTIVE=false
DRY_RUN=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_VERSION="1.0.0"

# ── Minimum requirements per role ──
declare -A MIN_RAM_GB=( [platform]=12 [ai]=12 [data]=12 [adapters]=6 )
declare -A MIN_CPU=(    [platform]=6  [ai]=6   [data]=6   [adapters]=4 )
declare -A MIN_DISK_GB=([platform]=100 [ai]=100 [data]=300 [adapters]=50 )
declare -A VM_IP=(      [platform]=10.74.47.8 [ai]=10.74.47.9 [data]=10.74.47.10 [adapters]=10.74.47.11 )
declare -A WG_IP=(      [platform]=10.47.0.6  [ai]=10.47.0.7  [data]=10.47.0.8   [adapters]=10.47.0.9 )
declare -A COMPOSE_FILE=([platform]=docker-compose.vm4-platform.yml [ai]=docker-compose.vm5-ai.yml [data]=docker-compose.vm6-data.yml [adapters]=docker-compose.vm7-adapters.yml)

# ── Parse arguments ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --vm-role)        VM_ROLE="$2";         shift 2 ;;
    --domain)         DOMAIN="$2";          shift 2 ;;
    --email)          CERTBOT_EMAIL="$2"; SKIP_CERTBOT=false; shift 2 ;;
    --data-dir)       DATA_DIR="$2";        shift 2 ;;
    --registry)       REGISTRY="$2";        shift 2 ;;
    --tag)            IMAGE_TAG="$2";       shift 2 ;;
    --skip-firewall)  SKIP_FIREWALL=true;   shift ;;
    --skip-certbot)   SKIP_CERTBOT=true;    shift ;;
    --skip-wireguard) SKIP_WIREGUARD=true;  shift ;;
    --non-interactive) NON_INTERACTIVE=true; shift ;;
    --dry-run)        DRY_RUN=true;         shift ;;
    -h|--help)
      head -40 "$0" | tail -35
      exit 0 ;;
    *)
      echo "ERROR: Unknown option: $1" >&2
      exit 1 ;;
  esac
done

# ── Validate role ──
if [[ -z "$VM_ROLE" ]]; then
  echo "ERROR: --vm-role is required (platform | ai | data | adapters)" >&2
  exit 1
fi
case "$VM_ROLE" in
  platform|ai|data|adapters) ;;
  *) echo "ERROR: Invalid --vm-role '$VM_ROLE' (must be: platform | ai | data | adapters)" >&2; exit 1 ;;
esac

# ── Logging ──
LOG_FILE="/var/log/sven-install-${VM_ROLE}.log"
log()  { printf '\033[1;36m[%s] %s\033[0m\n' "$(date -u +%H:%M:%S)" "$1" | tee -a "$LOG_FILE"; }
ok()   { printf '\033[1;32m  ✓ %s\033[0m\n' "$1" | tee -a "$LOG_FILE"; }
warn() { printf '\033[1;33m  ⚠ %s\033[0m\n' "$1" | tee -a "$LOG_FILE"; }
fail() { printf '\033[1;31m  ✗ %s\033[0m\n' "$1" | tee -a "$LOG_FILE"; exit 1; }
run()  {
  if $DRY_RUN; then
    echo "[DRY-RUN] $*" | tee -a "$LOG_FILE"
  else
    "$@" 2>&1 | tee -a "$LOG_FILE"
  fi
}

# ═══════════════════════════════════════════════════════════════════════
# Phase 1: Pre-flight
# ═══════════════════════════════════════════════════════════════════════
preflight() {
  log "Pre-flight checks for VM role: ${VM_ROLE}"

  if [[ $EUID -ne 0 ]]; then
    fail "Must run as root (use: sudo bash install-multi-node.sh --vm-role ${VM_ROLE})"
  fi

  # OS check
  if [[ ! -f /etc/os-release ]]; then
    fail "Unsupported OS — requires Debian 12+ or Ubuntu 22.04+"
  fi
  # shellcheck source=/dev/null
  source /etc/os-release
  case "$ID" in
    debian|ubuntu) ok "OS: $PRETTY_NAME" ;;
    *) warn "Untested OS: $PRETTY_NAME (Debian/Ubuntu recommended)" ;;
  esac

  # Architecture
  local arch
  arch=$(uname -m)
  if [[ "$arch" != "x86_64" && "$arch" != "aarch64" ]]; then
    fail "Unsupported architecture: $arch (requires x86_64 or aarch64)"
  fi
  ok "Architecture: $arch"

  # RAM
  local total_ram_kb total_ram_gb
  total_ram_kb=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
  total_ram_gb=$(( total_ram_kb / 1024 / 1024 ))
  if [[ $total_ram_gb -lt ${MIN_RAM_GB[$VM_ROLE]} ]]; then
    fail "Insufficient RAM: ${total_ram_gb} GB (minimum ${MIN_RAM_GB[$VM_ROLE]} GB for ${VM_ROLE})"
  fi
  ok "RAM: ${total_ram_gb} GB"

  # CPU
  local cpu_cores
  cpu_cores=$(nproc)
  if [[ $cpu_cores -lt ${MIN_CPU[$VM_ROLE]} ]]; then
    fail "Insufficient CPU: ${cpu_cores} cores (minimum ${MIN_CPU[$VM_ROLE]} for ${VM_ROLE})"
  fi
  ok "CPU: ${cpu_cores} cores"

  # Disk
  local data_parent disk_free_kb disk_free_gb
  data_parent="$(dirname "$DATA_DIR")"
  mkdir -p "$data_parent" 2>/dev/null || true
  disk_free_kb=$(df --output=avail "$data_parent" 2>/dev/null | tail -1)
  disk_free_gb=$(( disk_free_kb / 1024 / 1024 ))
  if [[ $disk_free_gb -lt ${MIN_DISK_GB[$VM_ROLE]} ]]; then
    fail "Insufficient disk: ${disk_free_gb} GB free (minimum ${MIN_DISK_GB[$VM_ROLE]} GB for ${VM_ROLE})"
  fi
  ok "Disk: ${disk_free_gb} GB free"

  # GPU check for AI role
  if [[ "$VM_ROLE" == "ai" ]]; then
    if command -v nvidia-smi >/dev/null 2>&1; then
      local gpu_info
      gpu_info=$(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null || echo "unknown")
      ok "GPU: ${gpu_info}"
    else
      warn "NVIDIA GPU not detected — Ollama/whisper will use CPU (slow)"
    fi
  fi

  # Docker check
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    ok "Docker: $(docker --version | head -1)"
    ok "Compose: $(docker compose version --short)"
  else
    warn "Docker not found — will install"
  fi
}

# ═══════════════════════════════════════════════════════════════════════
# Phase 2: Install Docker Engine
# ═══════════════════════════════════════════════════════════════════════
install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    ok "Docker already installed"
    return 0
  fi

  log "Installing Docker Engine + Compose plugin"

  run apt-get update -qq
  run apt-get install -y -qq ca-certificates curl gnupg lsb-release

  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
    # shellcheck source=/dev/null
    source /etc/os-release
    curl -fsSL "https://download.docker.com/linux/${ID}/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
  fi

  # shellcheck source=/dev/null
  source /etc/os-release
  local codename
  codename="${VERSION_CODENAME:-$(lsb_release -cs 2>/dev/null || echo stable)}"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ID} ${codename} stable" \
    > /etc/apt/sources.list.d/docker.list

  run apt-get update -qq
  run apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  run systemctl enable docker
  run systemctl start docker

  # Harden Docker daemon
  mkdir -p /etc/docker
  if [[ ! -f /etc/docker/daemon.json ]]; then
    cat > /etc/docker/daemon.json <<'DAEMON_EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "10"
  },
  "no-new-privileges": true,
  "live-restore": true,
  "default-ulimits": {
    "nofile": { "Name": "nofile", "Hard": 65536, "Soft": 32768 }
  }
}
DAEMON_EOF
    run systemctl restart docker
  fi

  # NVIDIA Container Toolkit for AI role
  if [[ "$VM_ROLE" == "ai" ]] && command -v nvidia-smi >/dev/null 2>&1; then
    if ! dpkg -l nvidia-container-toolkit >/dev/null 2>&1; then
      log "Installing NVIDIA Container Toolkit for GPU passthrough"
      curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
      curl -fsSL "https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list" \
        | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
        > /etc/apt/sources.list.d/nvidia-container-toolkit.list
      run apt-get update -qq
      run apt-get install -y -qq nvidia-container-toolkit
      run nvidia-ctk runtime configure --runtime=docker
      run systemctl restart docker
      ok "NVIDIA Container Toolkit installed"
    else
      ok "NVIDIA Container Toolkit already installed"
    fi
  fi

  ok "Docker installed: $(docker --version | head -1)"
}

# ═══════════════════════════════════════════════════════════════════════
# Phase 3: Create directory structure
# ═══════════════════════════════════════════════════════════════════════
create_directories() {
  log "Creating data directory structure at ${DATA_DIR}"

  local base_dirs=("${DATA_DIR}/compose" "${DATA_DIR}/ssl" "${DATA_DIR}/backups")

  case "$VM_ROLE" in
    platform)
      base_dirs+=(
        "${DATA_DIR}/data/postgres"
        "${DATA_DIR}/data/nats"
        "${DATA_DIR}/data/nginx"
        "${DATA_DIR}/data/nginx/logs"
      )
      ;;
    ai)
      base_dirs+=(
        "${DATA_DIR}/data/ollama"
        "${DATA_DIR}/data/tts"
        "${DATA_DIR}/data/wake-word"
      )
      ;;
    data)
      base_dirs+=(
        "${DATA_DIR}/data/opensearch"
        "${DATA_DIR}/data/prometheus"
        "${DATA_DIR}/data/grafana"
        "${DATA_DIR}/data/loki"
        "${DATA_DIR}/data/loki-cold"
        "${DATA_DIR}/data/egress-proxy"
      )
      ;;
    adapters)
      base_dirs+=(
        "${DATA_DIR}/data/cloudflared"
      )
      ;;
  esac

  for dir in "${base_dirs[@]}"; do
    run mkdir -p "$dir"
  done

  # OpenSearch requires specific ownership
  if [[ "$VM_ROLE" == "data" ]]; then
    chown -R 1000:1000 "${DATA_DIR}/data/opensearch"
  fi

  # Grafana requires uid 472
  if [[ "$VM_ROLE" == "data" ]]; then
    chown -R 472:472 "${DATA_DIR}/data/grafana"
  fi

  # Prometheus requires uid 65534 (nobody)
  if [[ "$VM_ROLE" == "data" ]]; then
    chown -R 65534:65534 "${DATA_DIR}/data/prometheus"
  fi

  ok "Directory structure created"
}

# ═══════════════════════════════════════════════════════════════════════
# Phase 4: Copy compose and config files
# ═══════════════════════════════════════════════════════════════════════
copy_configs() {
  log "Copying configuration files"

  local compose_src="${SCRIPT_DIR}/../${COMPOSE_FILE[$VM_ROLE]}"
  local env_src

  case "$VM_ROLE" in
    platform) env_src="${SCRIPT_DIR}/../.env.vm4.example" ;;
    ai)       env_src="${SCRIPT_DIR}/../.env.vm5.example" ;;
    data)     env_src="${SCRIPT_DIR}/../.env.vm6.example" ;;
    adapters) env_src="${SCRIPT_DIR}/../.env.vm7.example" ;;
  esac

  # Copy compose file
  if [[ -f "$compose_src" ]]; then
    cp "$compose_src" "${DATA_DIR}/compose/docker-compose.yml"
    ok "Compose file copied"
  else
    fail "Compose file not found: ${compose_src}"
  fi

  # Copy env template (only if no existing .env)
  local env_dest="${DATA_DIR}/compose/.env"
  if [[ -f "$env_dest" ]]; then
    warn "Existing .env found — preserving (not overwriting)"
  elif [[ -f "$env_src" ]]; then
    cp "$env_src" "$env_dest"
    chmod 600 "$env_dest"
    ok "Environment template copied to ${env_dest}"
    warn "You MUST edit ${env_dest} and replace all placeholder values before starting services"
  else
    warn "Environment template not found: ${env_src} — create .env manually"
  fi

  # Copy nginx configs for platform role
  if [[ "$VM_ROLE" == "platform" ]]; then
    local nginx_src="${SCRIPT_DIR}/../nginx"
    if [[ -d "$nginx_src" ]]; then
      cp "${nginx_src}/nginx.multi-vm.conf" "${DATA_DIR}/data/nginx/nginx.conf"
      cp "${nginx_src}/sven-internal-ingress.multi-vm.conf" "${DATA_DIR}/data/nginx/sven-internal-ingress.conf"
      ok "Nginx configs copied"
    else
      warn "Nginx config directory not found — configure manually"
    fi
  fi
}

# ═══════════════════════════════════════════════════════════════════════
# Phase 5: Generate secrets (platform role only)
# ═══════════════════════════════════════════════════════════════════════
generate_secrets() {
  if [[ "$VM_ROLE" != "platform" ]]; then
    return 0
  fi

  local env_file="${DATA_DIR}/compose/.env"
  if grep -q 'replace-with-' "$env_file" 2>/dev/null; then
    log "Generating secrets for platform .env"

    gen_pass() { tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32 || true; }

    local pg_pass nats_token adapter_token bridge_token grafana_pass
    local opensearch_pass litellm_key searxng_secret
    pg_pass=$(gen_pass)
    nats_token=$(gen_pass)
    adapter_token=$(gen_pass)
    bridge_token=$(gen_pass)
    grafana_pass=$(gen_pass)
    opensearch_pass="$(gen_pass)!Aa1"
    litellm_key="sk-$(gen_pass)"
    searxng_secret=$(gen_pass)

    # Replace placeholders in .env
    sed -i \
      -e "s/replace-with-production-postgres-password/${pg_pass}/g" \
      -e "s/replace-with-production-adapter-token/${adapter_token}/g" \
      -e "s/replace-with-production-bridge-token/${bridge_token}/g" \
      -e "s/replace-with-production-grafana-password/${grafana_pass}/g" \
      "$env_file"

    chmod 600 "$env_file"
    ok "Secrets generated — record these values for other VMs"

    # Output cross-VM secrets for copying to other VMs
    cat <<SECRETS_INFO

╔══════════════════════════════════════════════════════════════╗
║  CROSS-VM SECRETS — COPY THESE TO OTHER VM ENV FILES        ║
╠══════════════════════════════════════════════════════════════╣
║  POSTGRES_PASSWORD=${pg_pass}
║  SVEN_ADAPTER_TOKEN=${adapter_token}
║  OPENSEARCH_INITIAL_ADMIN_PASSWORD=${opensearch_pass}
║  LITELLM_MASTER_KEY=${litellm_key}
║  SEARXNG_SECRET_KEY=${searxng_secret}
║  GRAFANA_ADMIN_PASSWORD=${grafana_pass}
╚══════════════════════════════════════════════════════════════╝

SECRETS_INFO
  else
    ok "Secrets already configured"
  fi
}

# ═══════════════════════════════════════════════════════════════════════
# Phase 6: TLS certificates
# ═══════════════════════════════════════════════════════════════════════
setup_tls() {
  # Only platform role needs external TLS
  if [[ "$VM_ROLE" != "platform" ]]; then
    return 0
  fi

  log "Setting up TLS certificates"

  local ssl_dir="${DATA_DIR}/ssl"

  if $SKIP_CERTBOT; then
    if [[ -f "${ssl_dir}/server.crt" && -f "${ssl_dir}/server.key" ]]; then
      ok "Existing TLS certificates found"
      return 0
    fi

    log "Generating self-signed TLS certificate for ${DOMAIN}"
    run openssl req -x509 -nodes -days 3650 \
      -newkey rsa:4096 \
      -keyout "${ssl_dir}/server.key" \
      -out "${ssl_dir}/server.crt" \
      -subj "/CN=${DOMAIN}/O=Sven/C=US" \
      -addext "subjectAltName=DNS:${DOMAIN},DNS:*.${DOMAIN},IP:127.0.0.1,IP:${VM_IP[$VM_ROLE]}"

    chmod 644 "${ssl_dir}/server.crt"
    chmod 600 "${ssl_dir}/server.key"
    ok "Self-signed TLS certificate generated"
  else
    if ! command -v certbot >/dev/null 2>&1; then
      run apt-get install -y -qq certbot
    fi

    docker stop sven-nginx 2>/dev/null || true

    run certbot certonly --standalone \
      -d "$DOMAIN" \
      --email "$CERTBOT_EMAIL" \
      --agree-tos \
      --non-interactive

    cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "${ssl_dir}/server.crt"
    cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" "${ssl_dir}/server.key"
    chmod 644 "${ssl_dir}/server.crt"
    chmod 600 "${ssl_dir}/server.key"

    # Auto-renewal hook
    mkdir -p /etc/letsencrypt/renewal-hooks/deploy
    cat > "/etc/letsencrypt/renewal-hooks/deploy/sven.sh" <<HOOK_EOF
#!/bin/bash
cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "${ssl_dir}/server.crt"
cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" "${ssl_dir}/server.key"
chmod 644 "${ssl_dir}/server.crt"
chmod 600 "${ssl_dir}/server.key"
docker exec sven-nginx nginx -s reload 2>/dev/null || true
HOOK_EOF
    chmod 755 "/etc/letsencrypt/renewal-hooks/deploy/sven.sh"
    ok "Let's Encrypt TLS certificate installed with auto-renewal"
  fi
}

# ═══════════════════════════════════════════════════════════════════════
# Phase 7: Firewall
# ═══════════════════════════════════════════════════════════════════════
setup_firewall() {
  if $SKIP_FIREWALL; then
    warn "Firewall setup skipped (--skip-firewall)"
    return 0
  fi

  log "Configuring UFW firewall for ${VM_ROLE}"

  if ! command -v ufw >/dev/null 2>&1; then
    run apt-get install -y -qq ufw
  fi

  run ufw --force reset
  run ufw default deny incoming
  run ufw default allow outgoing

  # Common: SSH
  run ufw allow 22/tcp comment 'sven: SSH'

  # WireGuard
  if ! $SKIP_WIREGUARD; then
    run ufw allow 51820/udp comment 'sven: WireGuard'
  fi

  # Per-role ports
  case "$VM_ROLE" in
    platform)
      run ufw allow 80/tcp  comment 'sven: HTTP redirect'
      run ufw allow 443/tcp comment 'sven: HTTPS'
      # Allow Sven VMs to reach PostgreSQL and NATS
      for ip in "${VM_IP[@]}"; do
        run ufw allow from "$ip" to any port 5432  proto tcp comment "sven: PostgreSQL from $ip"
        run ufw allow from "$ip" to any port 4222  proto tcp comment "sven: NATS from $ip"
        run ufw allow from "$ip" to any port 3000  proto tcp comment "sven: Gateway from $ip"
        run ufw allow from "$ip" to any port 8088  proto tcp comment "sven: Internal ingress from $ip"
      done
      # 47Dynamics bridge
      run ufw allow from 10.47.47.5 to any port 4020 proto tcp comment 'sven: gRPC bridge from 47dynamics'
      ;;
    ai)
      # Only platform VM needs access to AI services
      run ufw allow from "${VM_IP[platform]}" to any port 11434 proto tcp comment 'sven: Ollama from platform'
      run ufw allow from "${VM_IP[platform]}" to any port 4000  proto tcp comment 'sven: LiteLLM from platform'
      run ufw allow from "${VM_IP[data]}"     to any port 11434 proto tcp comment 'sven: Ollama from data (embeddings)'
      ;;
    data)
      # Platform & adapters need OpenSearch; platform needs monitoring
      run ufw allow from "${VM_IP[platform]}" to any port 9200 proto tcp comment 'sven: OpenSearch from platform'
      run ufw allow from "${VM_IP[platform]}" to any port 4318 proto tcp comment 'sven: OTEL from platform'
      run ufw allow from "${VM_IP[ai]}"       to any port 4318 proto tcp comment 'sven: OTEL from ai'
      run ufw allow from "${VM_IP[adapters]}" to any port 4318 proto tcp comment 'sven: OTEL from adapters'
      # Grafana (exposed via platform nginx proxy, but also direct for ops)
      run ufw allow from "${VM_IP[platform]}" to any port 9091 proto tcp comment 'sven: Grafana from platform'
      ;;
    adapters)
      # Cloudflare Tunnel handles inbound — no exposed ports needed
      # Docker internal traffic
      run ufw allow in on docker0 comment 'sven: Docker bridge'
      ;;
  esac

  run ufw --force enable
  ok "Firewall configured for ${VM_ROLE}"
}

# ═══════════════════════════════════════════════════════════════════════
# Phase 8: Kernel tuning
# ═══════════════════════════════════════════════════════════════════════
tune_kernel() {
  log "Applying kernel tuning for ${VM_ROLE}"

  local sysctl_file="/etc/sysctl.d/99-sven.conf"
  if [[ -f "$sysctl_file" ]]; then
    ok "Kernel tuning already applied"
    return 0
  fi

  cat > "$sysctl_file" <<'SYSCTL_EOF'
# Sven production kernel tuning
# Network
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15
# Memory
vm.swappiness = 10
vm.overcommit_memory = 1
vm.dirty_ratio = 40
vm.dirty_background_ratio = 10
# File descriptors
fs.file-max = 2097152
fs.inotify.max_user_watches = 524288
fs.inotify.max_user_instances = 512
# WireGuard / IP forwarding
net.ipv4.ip_forward = 1
SYSCTL_EOF

  # OpenSearch requires vm.max_map_count
  if [[ "$VM_ROLE" == "data" ]]; then
    echo "vm.max_map_count = 262144" >> "$sysctl_file"
  fi

  run sysctl --system
  ok "Kernel parameters applied"

  # Increase open file limits
  if ! grep -q 'sven' /etc/security/limits.d/*.conf 2>/dev/null; then
    cat > /etc/security/limits.d/99-sven.conf <<'LIMITS_EOF'
# Sven production file descriptor limits
* soft nofile 65536
* hard nofile 65536
root soft nofile 65536
root hard nofile 65536
LIMITS_EOF
    ok "File descriptor limits configured"
  fi
}

# ═══════════════════════════════════════════════════════════════════════
# Phase 9: Pull images and start services
# ═══════════════════════════════════════════════════════════════════════
deploy_services() {
  local compose_dir="${DATA_DIR}/compose"
  local env_file="${compose_dir}/.env"

  if [[ ! -f "$env_file" ]]; then
    fail ".env file not found at ${env_file} — cannot deploy"
  fi

  # Check for remaining placeholders
  if grep -q 'replace-with-' "$env_file"; then
    fail ".env still contains placeholder values — edit ${env_file} before deploying"
  fi

  log "Pulling container images (this may take several minutes)"
  run docker compose -f "${compose_dir}/docker-compose.yml" --env-file "$env_file" pull

  log "Starting Sven ${VM_ROLE} services"
  run docker compose -f "${compose_dir}/docker-compose.yml" --env-file "$env_file" up -d

  # Wait for services to become healthy
  log "Waiting for services to become healthy (up to 120s)"
  local timeout=120
  local elapsed=0
  while [[ $elapsed -lt $timeout ]]; do
    local unhealthy
    unhealthy=$(docker compose -f "${compose_dir}/docker-compose.yml" --env-file "$env_file" ps --format json 2>/dev/null \
      | grep -c '"Health":"starting"' 2>/dev/null || echo "0")
    if [[ "$unhealthy" == "0" ]]; then
      break
    fi
    sleep 5
    elapsed=$((elapsed + 5))
  done

  docker compose -f "${compose_dir}/docker-compose.yml" --env-file "$env_file" ps
  ok "Services deployed"
}

# ═══════════════════════════════════════════════════════════════════════
# Phase 10: Create systemd service for auto-start
# ═══════════════════════════════════════════════════════════════════════
create_systemd_service() {
  log "Creating systemd service for auto-start"

  local compose_dir="${DATA_DIR}/compose"
  local service_file="/etc/systemd/system/sven-${VM_ROLE}.service"

  if [[ -f "$service_file" ]]; then
    ok "Systemd service already exists"
    return 0
  fi

  cat > "$service_file" <<SERVICE_EOF
[Unit]
Description=Sven ${VM_ROLE} services
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${compose_dir}
ExecStart=/usr/bin/docker compose --env-file ${compose_dir}/.env up -d --remove-orphans
ExecStop=/usr/bin/docker compose --env-file ${compose_dir}/.env down
TimeoutStartSec=300
TimeoutStopSec=120

[Install]
WantedBy=multi-user.target
SERVICE_EOF

  run systemctl daemon-reload
  run systemctl enable "sven-${VM_ROLE}.service"
  ok "Systemd service created and enabled: sven-${VM_ROLE}"
}

# ═══════════════════════════════════════════════════════════════════════
# Confirmation
# ═══════════════════════════════════════════════════════════════════════
confirm() {
  if $NON_INTERACTIVE; then
    return 0
  fi

  cat <<CONFIRM

┌────────────────────────────────────────────────────────────┐
│  Sven Multi-Node Installer v${INSTALL_VERSION}                        │
├────────────────────────────────────────────────────────────┤
│  VM Role:      ${VM_ROLE}
│  VM IP:        ${VM_IP[$VM_ROLE]}
│  WireGuard IP: ${WG_IP[$VM_ROLE]}
│  Domain:       ${DOMAIN}
│  Data Dir:     ${DATA_DIR}
│  Registry:     ${REGISTRY}
│  Image Tag:    ${IMAGE_TAG}
│  Compose File: ${COMPOSE_FILE[$VM_ROLE]}
│  Dry Run:      ${DRY_RUN}
└────────────────────────────────────────────────────────────┘

CONFIRM

  read -r -p "Proceed with installation? [y/N] " response
  case "$response" in
    [yY][eE][sS]|[yY]) ;;
    *) echo "Aborted."; exit 0 ;;
  esac
}

# ═══════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════
main() {
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  Sven Multi-Node Installer — ${VM_ROLE} (v${INSTALL_VERSION})"
  echo "═══════════════════════════════════════════════════════════"
  echo ""

  preflight
  confirm
  install_docker
  create_directories
  copy_configs
  generate_secrets
  setup_tls
  setup_firewall
  tune_kernel
  deploy_services
  create_systemd_service

  echo ""
  log "Installation complete for VM role: ${VM_ROLE}"
  echo ""
  cat <<DONE
╔══════════════════════════════════════════════════════════════╗
║  Sven ${VM_ROLE} deployment complete!                        
║                                                              
║  Data directory:    ${DATA_DIR}
║  Compose file:      ${DATA_DIR}/compose/docker-compose.yml
║  Environment file:  ${DATA_DIR}/compose/.env
║  Systemd service:   sven-${VM_ROLE}
║  Logs:              ${LOG_FILE}
║                                                              
║  Manage services:                                            
║    systemctl start sven-${VM_ROLE}
║    systemctl stop sven-${VM_ROLE}
║    docker compose -f ${DATA_DIR}/compose/docker-compose.yml logs -f
║                                                              
║  Next steps:                                                 
║    1. Edit ${DATA_DIR}/compose/.env with production values
║    2. Copy cross-VM secrets to other VM env files
║    3. Install WireGuard: deploy/multi-vm/wireguard/README.md
║    4. Verify: docker compose ps
╚══════════════════════════════════════════════════════════════╝
DONE
}

main
