#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# Sven — Multi-VM Backup & Restore
# Per-VM backup/restore covering PostgreSQL, NATS, OpenSearch,
# Ollama models, configuration, and TLS certificates.
#
# Run on the specific VM whose data you want to back up.
#
# Usage:
#   sudo bash backup-restore.sh backup  [OPTIONS]
#   sudo bash backup-restore.sh restore [OPTIONS]
#   sudo bash backup-restore.sh list    [OPTIONS]
#   sudo bash backup-restore.sh verify  <backup-name>
#   sudo bash backup-restore.sh status
#
# Options:
#   --vm-role <role>        VM role: platform | ai | data | adapters
#   --data-dir <path>       Data directory (default: /srv/sven/prod)
#   --backup-dir <path>     Backup directory (default: /srv/sven/prod/backups)
#   --components <list>     Comma-separated list of components (default: all for role)
#   --backup-name <name>    Restore from specific backup
#   --retention <days>      Backup retention in days (default: 30)
#   --force                 Skip confirmation prompt
#   --dry-run               Show plan without executing
#
# Components per role:
#   platform: postgres,nats,config,tls
#   ai:       ollama,config
#   data:     opensearch,config
#   adapters: config
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

VM_ROLE=""
DATA_DIR="/srv/sven/prod"
BACKUP_DIR=""
COMPONENTS=""
BACKUP_NAME=""
RETENTION_DAYS=30
FORCE=false
DRY_RUN=false

# Default components per role
declare -A ROLE_COMPONENTS=(
  [platform]="postgres,nats,config,tls"
  [ai]="ollama,config"
  [data]="opensearch,config"
  [adapters]="config"
)

COMMAND="${1:-}"
shift || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --vm-role)      VM_ROLE="$2";         shift 2 ;;
    --data-dir)     DATA_DIR="$2";        shift 2 ;;
    --backup-dir)   BACKUP_DIR="$2";      shift 2 ;;
    --components)   COMPONENTS="$2";      shift 2 ;;
    --backup-name)  BACKUP_NAME="$2";     shift 2 ;;
    --retention)    RETENTION_DAYS="$2";   shift 2 ;;
    --force)        FORCE=true;           shift ;;
    --dry-run)      DRY_RUN=true;         shift ;;
    -h|--help)      head -35 "$0" | tail -30; exit 0 ;;
    *)              echo "ERROR: Unknown option: $1" >&2; exit 1 ;;
  esac
done

# Validate inputs
if [[ -z "$COMMAND" ]]; then
  echo "ERROR: Command required (backup | restore | list | verify | status)" >&2
  exit 1
fi

if [[ -z "$VM_ROLE" ]]; then
  echo "ERROR: --vm-role is required (platform | ai | data | adapters)" >&2
  exit 1
fi

case "$VM_ROLE" in
  platform|ai|data|adapters) ;;
  *) echo "ERROR: Invalid --vm-role '$VM_ROLE'" >&2; exit 1 ;;
esac

if [[ -z "$COMPONENTS" ]]; then
  COMPONENTS="${ROLE_COMPONENTS[$VM_ROLE]}"
fi

if [[ -z "$BACKUP_DIR" ]]; then
  BACKUP_DIR="${DATA_DIR}/backups"
fi

COMPOSE_DIR="${DATA_DIR}/compose"
ENV_FILE="${COMPOSE_DIR}/.env"
LOG_FILE="/var/log/sven-backup-${VM_ROLE}-$(date +%Y%m%d_%H%M%S).log"

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

has_component() {
  echo "$COMPONENTS" | grep -q "$1"
}

# ═══════════════════════════════════════════════════════════════
#  BACKUP
# ═══════════════════════════════════════════════════════════════
cmd_backup() {
  log "Starting Sven ${VM_ROLE} backup (components: ${COMPONENTS})"

  local ts
  ts=$(date +%Y%m%d_%H%M%S)
  local snap_dir="${BACKUP_DIR}/${VM_ROLE}-${ts}"
  mkdir -p "$snap_dir"

  local components_ok=0
  local components_fail=0

  # ── PostgreSQL (platform only) ──
  if has_component "postgres"; then
    log "Backing up PostgreSQL (pgvector)..."
    if docker exec sven-postgres pg_dumpall -U sven 2>/dev/null | gzip > "${snap_dir}/postgres.sql.gz"; then
      sha256sum "${snap_dir}/postgres.sql.gz" > "${snap_dir}/postgres.sql.gz.sha256"
      ok "PostgreSQL: $(du -h "${snap_dir}/postgres.sql.gz" | cut -f1)"
      components_ok=$((components_ok + 1))
    else
      fail "PostgreSQL backup failed"
      components_fail=$((components_fail + 1))
    fi
  fi

  # ── NATS JetStream (platform only) ──
  if has_component "nats"; then
    log "Backing up NATS JetStream streams..."
    # Check Docker volume first, fall back to data dir
    local nats_vol
    nats_vol=$(docker volume inspect multi-vm_natsdata --format '{{.Mountpoint}}' 2>/dev/null || true)
    local nats_data="${nats_vol:-${DATA_DIR}/data/nats}"
    if [[ -d "$nats_data" ]]; then
      run tar czf "${snap_dir}/nats-jetstream.tar.gz" -C "$nats_data" .
      if [[ -f "${snap_dir}/nats-jetstream.tar.gz" ]]; then
        sha256sum "${snap_dir}/nats-jetstream.tar.gz" > "${snap_dir}/nats-jetstream.tar.gz.sha256"
      fi
      ok "NATS JetStream: $(du -h "${snap_dir}/nats-jetstream.tar.gz" 2>/dev/null | cut -f1 || echo 'dry-run')"
      components_ok=$((components_ok + 1))
    else
      warn "NATS data directory not found — skipping"
    fi
  fi

  # ── OpenSearch (data only) ──
  if has_component "opensearch"; then
    log "Backing up OpenSearch indices..."
    local os_data="${DATA_DIR}/data/opensearch"
    if [[ -d "$os_data" ]]; then
      # Create snapshot via API for consistency
      local os_url="http://127.0.0.1:9200"
      local os_pass
      os_pass=$(grep OPENSEARCH_INITIAL_ADMIN_PASSWORD "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "")

      if [[ -n "$os_pass" ]]; then
        # Register filesystem snapshot repo
        curl -sS -u "admin:${os_pass}" -X PUT "${os_url}/_snapshot/sven_backup" \
          -H 'Content-Type: application/json' \
          -d "{\"type\":\"fs\",\"settings\":{\"location\":\"/usr/share/opensearch/snapshots\"}}" \
          >/dev/null 2>&1 || true

        # Create snapshot
        local snap_name="snap-${ts}"
        curl -sS -u "admin:${os_pass}" -X PUT "${os_url}/_snapshot/sven_backup/${snap_name}?wait_for_completion=true" \
          >/dev/null 2>&1 || true

        ok "OpenSearch snapshot '${snap_name}' created"
      fi

      # Also tar the data directory as a fallback
      run tar czf "${snap_dir}/opensearch.tar.gz" -C "$os_data" .
      sha256sum "${snap_dir}/opensearch.tar.gz" > "${snap_dir}/opensearch.tar.gz.sha256"
      ok "OpenSearch: $(du -h "${snap_dir}/opensearch.tar.gz" | cut -f1)"
      components_ok=$((components_ok + 1))
    else
      warn "OpenSearch data directory not found — skipping"
    fi
  fi

  # ── Ollama models (ai only) ──
  if has_component "ollama"; then
    log "Backing up Ollama models..."
    local ollama_data="${DATA_DIR}/data/ollama"
    if [[ -d "$ollama_data" ]]; then
      # List installed models for manifest
      docker exec sven-ollama ollama list > "${snap_dir}/ollama-models.txt" 2>/dev/null || true
      # Tar model blobs (can be large)
      run tar czf "${snap_dir}/ollama.tar.gz" -C "$ollama_data" .
      sha256sum "${snap_dir}/ollama.tar.gz" > "${snap_dir}/ollama.tar.gz.sha256"
      ok "Ollama models: $(du -h "${snap_dir}/ollama.tar.gz" | cut -f1)"
      components_ok=$((components_ok + 1))
    else
      warn "Ollama data directory not found — skipping"
    fi
  fi

  # ── Configuration (all roles) ──
  if has_component "config"; then
    log "Backing up configuration..."
    local cfg_dir="${snap_dir}/config"
    mkdir -p "$cfg_dir"

    # .env (contains secrets — protect file permissions)
    if [[ -f "$ENV_FILE" ]]; then
      cp "$ENV_FILE" "${cfg_dir}/env.bak"
      chmod 600 "${cfg_dir}/env.bak"
    fi

    # Compose file
    if [[ -f "${COMPOSE_DIR}/docker-compose.yml" ]]; then
      cp "${COMPOSE_DIR}/docker-compose.yml" "${cfg_dir}/docker-compose.yml"
    fi

    # Running image digests for reproducibility
    docker ps --format '{{.Names}}\t{{.Image}}' > "${cfg_dir}/running-images.txt" 2>/dev/null || true

    tar czf "${snap_dir}/config.tar.gz" -C "${snap_dir}" config
    rm -rf "$cfg_dir"
    ok "Configuration backed up"
    components_ok=$((components_ok + 1))
  fi

  # ── TLS certificates (platform only) ──
  if has_component "tls"; then
    log "Backing up TLS certificates..."
    local ssl_dir="${DATA_DIR}/src/deploy/multi-vm/ssl"
    # Fall back to legacy path
    [[ -d "$ssl_dir" ]] || ssl_dir="${DATA_DIR}/ssl"
    if [[ -d "$ssl_dir" ]]; then
      run tar czf "${snap_dir}/tls.tar.gz" -C "$ssl_dir" .
      if [[ -f "${snap_dir}/tls.tar.gz" ]]; then
        sha256sum "${snap_dir}/tls.tar.gz" > "${snap_dir}/tls.tar.gz.sha256"
      fi
      ok "TLS certificates backed up"
      components_ok=$((components_ok + 1))
    fi
  fi

  # ── Manifest ──
  cat > "${snap_dir}/manifest.json" <<MANIFEST_EOF
{
  "name": "${VM_ROLE}-${ts}",
  "createdAt": "$(date -u +%FT%TZ)",
  "vmRole": "${VM_ROLE}",
  "dataDir": "${DATA_DIR}",
  "components": "${COMPONENTS}",
  "componentsOk": ${components_ok},
  "componentsFail": ${components_fail},
  "hostname": "$(hostname)",
  "dockerVersion": "$(docker --version 2>/dev/null | head -c 60 || echo 'unknown')"
}
MANIFEST_EOF

  echo ""
  log "Backup complete: ${snap_dir}"
  log "  Components: ${components_ok} OK, ${components_fail} failed"
  log "  Total size: $(du -sh "$snap_dir" | cut -f1)"

  # ── Prune old backups ──
  log "Pruning backups older than ${RETENTION_DAYS} days..."
  local pruned=0
  for dir in "${BACKUP_DIR}"/"${VM_ROLE}"-[0-9]*; do
    if [[ ! -d "$dir" || ! -f "${dir}/manifest.json" ]]; then
      continue
    fi
    local age
    age=$(( ($(date +%s) - $(stat -c %Y "$dir")) / 86400 ))
    if [[ "$age" -gt "$RETENTION_DAYS" ]]; then
      rm -rf "$dir"
      pruned=$((pruned + 1))
    fi
  done
  if [[ $pruned -gt 0 ]]; then
    ok "Pruned ${pruned} old backup(s)"
  fi
}

# ═══════════════════════════════════════════════════════════════
#  RESTORE
# ═══════════════════════════════════════════════════════════════
cmd_restore() {
  log "Starting Sven ${VM_ROLE} restore"

  # Locate backup
  local snap_dir=""
  if [[ -n "$BACKUP_NAME" ]]; then
    snap_dir="${BACKUP_DIR}/${BACKUP_NAME}"
  else
    snap_dir=$(ls -1dt "${BACKUP_DIR}/${VM_ROLE}"-[0-9]* 2>/dev/null | head -1 || true)
  fi

  if [[ -z "$snap_dir" || ! -d "$snap_dir" ]]; then
    fail "No backup found. Use --backup-name or ensure backups exist in ${BACKUP_DIR}"
  fi

  log "Restoring from: $(basename "$snap_dir")"

  if ! $FORCE; then
    echo ""
    echo "WARNING: This will overwrite current data on ${VM_ROLE}."
    read -r -p "Continue? [y/N] " response
    case "$response" in
      [yY][eE][sS]|[yY]) ;;
      *) echo "Aborted."; exit 0 ;;
    esac
  fi

  # Verify checksums
  local checksum_errors=0
  for sha_file in "${snap_dir}"/*.sha256; do
    if [[ -f "$sha_file" ]]; then
      if ! (cd "${snap_dir}" && sha256sum -c "$(basename "$sha_file")" >/dev/null 2>&1); then
        fail "Checksum verification failed: $(basename "$sha_file")"
        checksum_errors=$((checksum_errors + 1))
      fi
    fi
  done

  if [[ $checksum_errors -gt 0 ]]; then
    fail "Aborting restore — ${checksum_errors} checksum error(s)"
  fi

  # Stop services before restore
  log "Stopping services..."
  if [[ -f "${COMPOSE_DIR}/docker-compose.yml" ]]; then
    docker compose -f "${COMPOSE_DIR}/docker-compose.yml" --env-file "$ENV_FILE" down 2>/dev/null || true
  fi

  # ── PostgreSQL ──
  if has_component "postgres" && [[ -f "${snap_dir}/postgres.sql.gz" ]]; then
    log "Restoring PostgreSQL..."
    # Start just postgres
    docker compose -f "${COMPOSE_DIR}/docker-compose.yml" --env-file "$ENV_FILE" up -d postgres
    sleep 10

    gunzip -c "${snap_dir}/postgres.sql.gz" | docker exec -i sven-postgres psql -U sven -d sven 2>/dev/null
    ok "PostgreSQL restored"
  fi

  # ── NATS JetStream ──
  if has_component "nats" && [[ -f "${snap_dir}/nats-jetstream.tar.gz" ]]; then
    log "Restoring NATS JetStream..."
    local nats_data="${DATA_DIR}/data/nats"
    rm -rf "${nats_data:?}/"*
    run tar xzf "${snap_dir}/nats-jetstream.tar.gz" -C "$nats_data"
    ok "NATS JetStream restored"
  fi

  # ── OpenSearch ──
  if has_component "opensearch" && [[ -f "${snap_dir}/opensearch.tar.gz" ]]; then
    log "Restoring OpenSearch..."
    local os_data="${DATA_DIR}/data/opensearch"
    rm -rf "${os_data:?}/"*
    run tar xzf "${snap_dir}/opensearch.tar.gz" -C "$os_data"
    chown -R 1000:1000 "$os_data"
    ok "OpenSearch restored"
  fi

  # ── Ollama ──
  if has_component "ollama" && [[ -f "${snap_dir}/ollama.tar.gz" ]]; then
    log "Restoring Ollama models..."
    local ollama_data="${DATA_DIR}/data/ollama"
    rm -rf "${ollama_data:?}/"*
    run tar xzf "${snap_dir}/ollama.tar.gz" -C "$ollama_data"
    ok "Ollama models restored"
  fi

  # ── Configuration ──
  if has_component "config" && [[ -f "${snap_dir}/config.tar.gz" ]]; then
    log "Restoring configuration..."
    local tmp_cfg
    tmp_cfg=$(mktemp -d)
    tar xzf "${snap_dir}/config.tar.gz" -C "$tmp_cfg"

    if [[ -f "${tmp_cfg}/config/env.bak" ]]; then
      cp "${tmp_cfg}/config/env.bak" "$ENV_FILE"
      chmod 600 "$ENV_FILE"
    fi
    if [[ -f "${tmp_cfg}/config/docker-compose.yml" ]]; then
      cp "${tmp_cfg}/config/docker-compose.yml" "${COMPOSE_DIR}/docker-compose.yml"
    fi
    rm -rf "$tmp_cfg"
    ok "Configuration restored"
  fi

  # ── TLS ──
  if has_component "tls" && [[ -f "${snap_dir}/tls.tar.gz" ]]; then
    log "Restoring TLS certificates..."
    local ssl_dir="${DATA_DIR}/ssl"
    mkdir -p "$ssl_dir"
    run tar xzf "${snap_dir}/tls.tar.gz" -C "$ssl_dir"
    ok "TLS certificates restored"
  fi

  # Start all services
  log "Starting services..."
  docker compose -f "${COMPOSE_DIR}/docker-compose.yml" --env-file "$ENV_FILE" up -d

  echo ""
  log "Restore complete from: $(basename "$snap_dir")"
}

# ═══════════════════════════════════════════════════════════════
#  LIST
# ═══════════════════════════════════════════════════════════════
cmd_list() {
  echo ""
  echo "Sven backups for ${VM_ROLE} in ${BACKUP_DIR}:"
  echo "────────────────────────────────────────────────────────────"
  printf "%-30s %-20s %-10s %-15s\n" "NAME" "CREATED" "STATUS" "SIZE"
  echo "────────────────────────────────────────────────────────────"

  local count=0
  for dir in "${BACKUP_DIR}"/"${VM_ROLE}"-[0-9]* "${BACKUP_DIR}"/[0-9]*; do
    if [[ ! -d "$dir" || ! -f "${dir}/manifest.json" ]]; then
      continue
    fi

    local name created status size
    name=$(basename "$dir")
    created=$(grep -o '"createdAt":"[^"]*"' "${dir}/manifest.json" 2>/dev/null | cut -d'"' -f4 | cut -c1-19 || echo "unknown")
    local ok_count fail_count
    ok_count=$(grep -o '"componentsOk":[0-9]*' "${dir}/manifest.json" 2>/dev/null | cut -d: -f2 || echo "0")
    fail_count=$(grep -o '"componentsFail":[0-9]*' "${dir}/manifest.json" 2>/dev/null | cut -d: -f2 || echo "0")
    if [[ "$fail_count" == "0" ]]; then
      status="OK"
    else
      status="PARTIAL"
    fi
    size=$(du -sh "$dir" 2>/dev/null | cut -f1 || echo "?")

    printf "%-30s %-20s %-10s %-15s\n" "$name" "$created" "$status" "$size"
    count=$((count + 1))
  done

  if [[ $count -eq 0 ]]; then
    echo "  (no backups found)"
  fi
  echo ""
}

# ═══════════════════════════════════════════════════════════════
#  VERIFY
# ═══════════════════════════════════════════════════════════════
cmd_verify() {
  if [[ -z "$BACKUP_NAME" ]]; then
    BACKUP_NAME=$(ls -1dt "${BACKUP_DIR}/${VM_ROLE}"-[0-9]* 2>/dev/null | head -1 || true)
    BACKUP_NAME=$(basename "$BACKUP_NAME" 2>/dev/null || true)
  fi

  local snap_dir="${BACKUP_DIR}/${BACKUP_NAME}"
  if [[ ! -d "$snap_dir" ]]; then
    fail "Backup not found: ${BACKUP_NAME}"
  fi

  log "Verifying backup: ${BACKUP_NAME}"

  local errors=0
  for sha_file in "${snap_dir}"/*.sha256; do
    if [[ -f "$sha_file" ]]; then
      local target
      target=$(basename "$sha_file" .sha256)
      if (cd "${snap_dir}" && sha256sum -c "$(basename "$sha_file")" >/dev/null 2>&1); then
        ok "${target}: checksum valid"
      else
        fail "${target}: CHECKSUM MISMATCH"
        errors=$((errors + 1))
      fi
    fi
  done

  if [[ -f "${snap_dir}/manifest.json" ]]; then
    ok "Manifest present"
    cat "${snap_dir}/manifest.json"
  else
    warn "No manifest.json found"
  fi

  if [[ $errors -eq 0 ]]; then
    echo ""
    ok "Backup integrity verified"
  else
    echo ""
    fail "${errors} checksum error(s) detected"
  fi
}

# ═══════════════════════════════════════════════════════════════
#  STATUS
# ═══════════════════════════════════════════════════════════════
cmd_status() {
  echo ""
  echo "Sven Backup Status — ${VM_ROLE}"
  echo "────────────────────────────────────────────────────────────"
  echo "Data directory:   ${DATA_DIR}"
  echo "Backup directory: ${BACKUP_DIR}"
  echo "Retention:        ${RETENTION_DAYS} days"

  local latest
  latest=$(ls -1dt "${BACKUP_DIR}/${VM_ROLE}"-[0-9]* 2>/dev/null | head -1 || true)
  if [[ -n "$latest" ]]; then
    echo "Latest backup:    $(basename "$latest")"
    echo "Latest size:      $(du -sh "$latest" 2>/dev/null | cut -f1)"
    local age
    age=$(( ($(date +%s) - $(stat -c %Y "$latest")) / 3600 ))
    echo "Latest age:       ${age} hours"
    if [[ $age -gt 48 ]]; then
      warn "No backup in the last 48 hours"
    fi
  else
    warn "No backups found"
  fi

  local total
  total=$(ls -1d "${BACKUP_DIR}/${VM_ROLE}"-[0-9]* 2>/dev/null | wc -l || echo "0")
  echo "Total backups:    ${total}"
  echo "Total size:       $(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1 || echo '0')"
  echo ""
}

# ═══════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════
mkdir -p "$BACKUP_DIR"

case "$COMMAND" in
  backup)  cmd_backup ;;
  restore) cmd_restore ;;
  list)    cmd_list ;;
  verify)  cmd_verify ;;
  status)  cmd_status ;;
  *)
    echo "ERROR: Unknown command '${COMMAND}' (backup | restore | list | verify | status)" >&2
    exit 1 ;;
esac
