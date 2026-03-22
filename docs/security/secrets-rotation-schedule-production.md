# Production Secrets Rotation Schedule & Procedures

**Last audited:** 2026-03-20  
**Owner:** Platform Operations  
**Scope:** Multi-VM production deployment (VM4–VM7)

---

## Rotation Schedule

| Secret | VMs | Cadence | Priority | Last Rotated | Next Due |
|--------|-----|---------|----------|--------------|----------|
| `POSTGRES_PASSWORD` | VM4,5,6,7 | 90 days | CRITICAL | Initial deploy | 2026-06-20 |
| `COOKIE_SECRET` | VM4 | 90 days | CRITICAL | Initial deploy | 2026-06-20 |
| `SVEN_ADAPTER_TOKEN` | VM4,5,6,7 | 90 days | CRITICAL | Initial deploy | 2026-06-20 |
| `ADMIN_PASSWORD` | VM4 | 90 days | CRITICAL | Initial deploy | 2026-06-20 |
| `OPENSEARCH_PASSWORD` | VM4,6 | 180 days | HIGH | Initial deploy | 2026-09-20 |
| `LITELLM_MASTER_KEY` | VM5 | 180 days | HIGH | Initial deploy | 2026-09-20 |
| `SVEN_BRIDGE_SERVICE_TOKEN` | VM4 | 180 days | HIGH | Initial deploy | 2026-09-20 |
| `SVEN_METRICS_AUTH_TOKEN` | VM4,6 | 180 days | HIGH | Initial deploy | 2026-09-20 |
| `GRAFANA_ADMIN_PASSWORD` | VM6 | 180 days | MEDIUM | Initial deploy | 2026-09-20 |
| `SEARXNG_SECRET_KEY` | VM6 | 365 days | LOW | Initial deploy | 2027-03-20 |
| `DEEPLINK_SECRET` | VM4 | 365 days | LOW | Initial deploy | 2027-03-20 |
| TLS certificates | VM4 | Auto (Let's Encrypt) | AUTO | 2026-03-20 | Auto-renew |
| Internal TLS (PG, gRPC) | VM4 | 365 days | MEDIUM | Initial deploy | 2027-03-20 |

### External / User-Managed (rotate per vendor policy)

| Secret | VM | Vendor |
|--------|----|--------|
| `OPENAI_API_KEY` | VM5 | OpenAI |
| `ANTHROPIC_API_KEY` | VM5 | Anthropic |
| `GOOGLE_API_KEY` | VM5 | Google |
| `AZURE_API_KEY` | VM5 | Azure |
| `MISTRAL_API_KEY` | VM5 | Mistral |
| `HF_TOKEN` | VM5 | HuggingFace |
| `DISCORD_TOKEN` | VM7 | Discord |
| Other adapter tokens | VM7 | Per platform |

---

## Secret Locations

All production `.env` files live on the respective VMs under:
```
/srv/sven/prod/src/deploy/multi-vm/.env
```

The `SVEN_METRICS_AUTH_TOKEN` is stored separately for Prometheus:
```
VM6: /srv/sven/prod/src/deploy/multi-vm/secrets/metrics-token
```

---

## Rotation Procedures

### Pre-Rotation Checklist (all secrets)

1. Ensure a current backup exists (daily cron runs at 00:00 UTC on VM4, 00:15 on VM6).
2. Identify all services that consume the secret (see VM column above).
3. Plan for a maintenance window — most rotations require container restarts.
4. Generate the new secret value:
   ```bash
   # 64-char hex (for COOKIE_SECRET, adapter tokens)
   openssl rand -hex 32
   # 48-char hex (for metrics token)
   openssl rand -hex 24
   # Alphanumeric password (for DB, admin, Grafana)
   openssl rand -base64 24 | tr -d '/+=' | head -c 24
   ```

---

### Procedure 1: POSTGRES_PASSWORD

**Impact:** All services on all 4 VMs connect to PostgreSQL on VM4.  
**Downtime:** Brief (< 2 minutes). All services must restart atomically.

```bash
# 1. Generate new password
NEW_PG_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
echo "New PG password: $NEW_PG_PASS"

# 2. Change password in PostgreSQL (VM4)
ssh sven-platform "sudo docker exec sven-postgres psql -U sven -d sven -c \
  \"ALTER USER sven PASSWORD '\$NEW_PG_PASS';\""

# 3. Update .env on ALL VMs
for vm in sven-platform sven-ai sven-data sven-adapters; do
  ssh $vm "sudo sed -i 's|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$NEW_PG_PASS|' \
    /srv/sven/prod/src/deploy/multi-vm/.env"
done

# 4. Restart services on each VM (order: VM4 first, then others)
ssh sven-platform "cd /srv/sven/prod/src && sudo docker compose \
  -f deploy/multi-vm/docker-compose.vm4-platform.yml restart"
ssh sven-ai "cd /srv/sven/prod/src && sudo docker compose \
  -f deploy/multi-vm/docker-compose.vm5-ai.yml restart"
ssh sven-data "cd /srv/sven/prod/src && sudo docker compose \
  -f deploy/multi-vm/docker-compose.vm6-data.yml restart"
ssh sven-adapters "cd /srv/sven/prod/src && sudo docker compose \
  -f deploy/multi-vm/docker-compose.vm7-adapters.yml restart"

# 5. Verify
ssh sven-platform "sudo docker exec sven-postgres psql -U sven -d sven -c 'SELECT 1;'"
curl -sk https://sven.systems/api/health
```

---

### Procedure 2: COOKIE_SECRET

**Impact:** All active user sessions are invalidated. Users must re-login.  
**Downtime:** None (hot restart). Active sessions terminated.

```bash
# 1. Generate
NEW_COOKIE=$(openssl rand -hex 32)

# 2. Update .env on VM4
ssh sven-platform "sudo sed -i 's|^COOKIE_SECRET=.*|COOKIE_SECRET=$NEW_COOKIE|' \
  /srv/sven/prod/src/deploy/multi-vm/.env"

# 3. Restart gateway only
ssh sven-platform "cd /srv/sven/prod/src && sudo docker compose \
  -f deploy/multi-vm/docker-compose.vm4-platform.yml restart gateway-api"

# 4. Verify login works
curl -sk https://sven.systems/api/health
```

---

### Procedure 3: SVEN_ADAPTER_TOKEN

**Impact:** All adapters disconnect until restarted with new token.  
**Downtime:** Adapters offline for ~1 minute during rolling restart.

```bash
# 1. Generate
NEW_ADAPTER_TOKEN=$(openssl rand -hex 32)

# 2. Update on VM4 (gateway accepts this token)
ssh sven-platform "sudo sed -i 's|^SVEN_ADAPTER_TOKEN=.*|SVEN_ADAPTER_TOKEN=$NEW_ADAPTER_TOKEN|' \
  /srv/sven/prod/src/deploy/multi-vm/.env"
ssh sven-platform "cd /srv/sven/prod/src && sudo docker compose \
  -f deploy/multi-vm/docker-compose.vm4-platform.yml restart gateway-api"

# 3. Update on VM5, VM6, VM7
for vm in sven-ai sven-data sven-adapters; do
  ssh $vm "sudo sed -i 's|^SVEN_ADAPTER_TOKEN=.*|SVEN_ADAPTER_TOKEN=$NEW_ADAPTER_TOKEN|' \
    /srv/sven/prod/src/deploy/multi-vm/.env"
done

# 4. Restart adapter services
ssh sven-adapters "cd /srv/sven/prod/src && sudo docker compose \
  -f deploy/multi-vm/docker-compose.vm7-adapters.yml restart"
ssh sven-ai "cd /srv/sven/prod/src && sudo docker compose \
  -f deploy/multi-vm/docker-compose.vm5-ai.yml restart"
ssh sven-data "cd /srv/sven/prod/src && sudo docker compose \
  -f deploy/multi-vm/docker-compose.vm6-data.yml restart"

# 5. Verify Discord bot reconnects
ssh sven-adapters "sudo docker logs --tail 5 sven-adapter-discord 2>&1 | grep -i 'guild\|connect'"
```

---

### Procedure 4: ADMIN_PASSWORD

**Impact:** Web admin login credential changes. No service restart needed if only updating config.  
**Downtime:** None.

```bash
# 1. Generate
NEW_ADMIN_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)

# 2. Update .env on VM4
ssh sven-platform "sudo sed -i 's|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$NEW_ADMIN_PASS|' \
  /srv/sven/prod/src/deploy/multi-vm/.env"

# 3. Restart gateway
ssh sven-platform "cd /srv/sven/prod/src && sudo docker compose \
  -f deploy/multi-vm/docker-compose.vm4-platform.yml restart gateway-api"

# 4. Verify login
echo "New admin credentials: 47 / $NEW_ADMIN_PASS"
```

---

### Procedure 5: OPENSEARCH_PASSWORD

**Impact:** RAG services on VM6 and vectorDB queries from VM4 disconnect.  
**Downtime:** Brief. OpenSearch internal security must be updated.

```bash
# 1. Generate
NEW_OS_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)

# 2. Update OpenSearch internal user (VM6)
ssh sven-data "sudo docker exec sven-opensearch bash -c \
  'cd /usr/share/opensearch/plugins/opensearch-security/tools && \
   ./hash.sh -p \"$NEW_OS_PASS\"'" 
# Copy the hash output, update internal_users.yml, then run securityadmin

# 3. Update .env on VM4 and VM6
for vm in sven-platform sven-data; do
  ssh $vm "sudo sed -i 's|^OPENSEARCH_PASSWORD=.*|OPENSEARCH_PASSWORD=$NEW_OS_PASS|' \
    /srv/sven/prod/src/deploy/multi-vm/.env"
  ssh $vm "sudo sed -i 's|^OPENSEARCH_INITIAL_ADMIN_PASSWORD=.*|OPENSEARCH_INITIAL_ADMIN_PASSWORD=$NEW_OS_PASS|' \
    /srv/sven/prod/src/deploy/multi-vm/.env"
done

# 4. Restart consumers
ssh sven-data "cd /srv/sven/prod/src && sudo docker compose \
  -f deploy/multi-vm/docker-compose.vm6-data.yml restart"
ssh sven-platform "cd /srv/sven/prod/src && sudo docker compose \
  -f deploy/multi-vm/docker-compose.vm4-platform.yml restart gateway-api"
```

---

### Procedure 6: SVEN_METRICS_AUTH_TOKEN

**Impact:** Prometheus scrapes fail until token file is updated on VM6.  
**Downtime:** Metrics gap of ~30 seconds.

```bash
# 1. Generate
NEW_METRICS_TOKEN=$(openssl rand -hex 24)

# 2. Update .env on VM4 (gateway validates this token)
ssh sven-platform "sudo sed -i 's|^SVEN_METRICS_AUTH_TOKEN=.*|SVEN_METRICS_AUTH_TOKEN=$NEW_METRICS_TOKEN|' \
  /srv/sven/prod/src/deploy/multi-vm/.env"
ssh sven-platform "cd /srv/sven/prod/src && sudo docker compose \
  -f deploy/multi-vm/docker-compose.vm4-platform.yml restart gateway-api"

# 3. Update the token file on VM6
ssh sven-data "printf '%s' '$NEW_METRICS_TOKEN' | sudo tee \
  /srv/sven/prod/src/deploy/multi-vm/secrets/metrics-token > /dev/null"

# 4. Restart Prometheus (it re-reads the file on scrape, but restart to be safe)
ssh sven-data "sudo docker restart sven-prometheus"

# 5. Verify (wait 20s for scrape cycle)
sleep 20
ssh sven-data 'curl -s http://localhost:9090/api/v1/targets | \
  python3 -c "import json,sys; d=json.load(sys.stdin); \
  print(sum(1 for t in d[\"data\"][\"activeTargets\"] if t[\"health\"]==\"up\"),\"targets up\")"'
```

---

### Procedure 7: GRAFANA_ADMIN_PASSWORD

**Impact:** Grafana admin login changes. Dashboards unaffected.  
**Downtime:** None.

```bash
# 1. Generate
NEW_GRAFANA_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)

# 2. Reset via Grafana CLI inside container
ssh sven-data "sudo docker exec sven-grafana grafana cli admin reset-admin-password '$NEW_GRAFANA_PASS'"

# 3. Update .env for consistency
ssh sven-data "sudo sed -i 's|^GRAFANA_ADMIN_PASSWORD=.*|GRAFANA_ADMIN_PASSWORD=$NEW_GRAFANA_PASS|' \
  /srv/sven/prod/src/deploy/multi-vm/.env"

# 4. Verify
echo "New Grafana credentials: admin / $NEW_GRAFANA_PASS"
```

---

### Procedure 8: LITELLM_MASTER_KEY

**Impact:** All LiteLLM API calls from gateway fail until restarted with new key.  
**Downtime:** AI features offline for ~30 seconds.

```bash
# 1. Generate
NEW_LITELLM_KEY="sk-$(openssl rand -hex 24)"

# 2. Update .env on VM5
ssh sven-ai "sudo sed -i 's|^LITELLM_MASTER_KEY=.*|LITELLM_MASTER_KEY=$NEW_LITELLM_KEY|' \
  /srv/sven/prod/src/deploy/multi-vm/.env"

# 3. Update .env on VM4 (gateway references this key)
ssh sven-platform "sudo sed -i 's|^LITELLM_MASTER_KEY=.*|LITELLM_MASTER_KEY=$NEW_LITELLM_KEY|' \
  /srv/sven/prod/src/deploy/multi-vm/.env"

# 4. Restart LiteLLM then gateway
ssh sven-ai "cd /srv/sven/prod/src && sudo docker compose \
  -f deploy/multi-vm/docker-compose.vm5-ai.yml restart litellm"
ssh sven-platform "cd /srv/sven/prod/src && sudo docker compose \
  -f deploy/multi-vm/docker-compose.vm4-platform.yml restart gateway-api"

# 5. Verify
ssh sven-ai "curl -s -H 'Authorization: Bearer $NEW_LITELLM_KEY' http://localhost:4000/health | head -1"
```

---

## Post-Rotation Checklist

After every rotation:

- [ ] Verify affected services are healthy (`docker ps`, health endpoints)
- [ ] Verify Prometheus shows all 11 targets UP
- [ ] Verify Grafana dashboards load data
- [ ] Verify Discord bot responds (if adapter token rotated)
- [ ] Update the "Last Rotated" column in the schedule table above
- [ ] Record the rotation in `/srv/sven/prod/rotation-log.txt` on each affected VM
- [ ] Notify operations team via Discord `#infra-alerts` channel

---

## Emergency Rotation (Compromise Response)

If a secret is suspected compromised, follow the
[Token Compromise Runbook](../runbooks/security-token-compromise-and-key-rotation.md)
alongside these procedures. Additional steps:

1. Rotate the compromised secret immediately (no maintenance window needed).
2. Rotate all secrets that share the same value or derivation.
3. Check audit logs for unauthorized access during the exposure window.
4. Force-invalidate all sessions (`COOKIE_SECRET` rotation).
5. Review Grafana alerts for anomalous patterns during the exposure window.

---

## Audit Notes

- **Hardcoded secret fixed (2026-03-20):** `SVEN_METRICS_AUTH_TOKEN` was previously
  hardcoded in `deploy/multi-vm/prometheus-multi-vm.yml`. Moved to file-based loading
  via `http_headers.<name>.files` in Prometheus 2.54. Token now stored at
  `deploy/multi-vm/secrets/metrics-token` (git-ignored, host-only).
- **No secrets in source control:** All `.env` files are git-ignored. Example templates
  (`.env.vm*.example`) contain only placeholder values.
- **Backup scripts:** `backup-restore.sh` reads credentials dynamically from `.env`
  files — no hardcoded secrets in backup automation.
