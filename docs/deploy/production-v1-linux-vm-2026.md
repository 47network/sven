# Sven Production v1 On A Linux VM 2026

This is the recommended first real production topology for Sven.

Production v1 is intentionally conservative: one hardened Linux VM, containers, persistent storage, backups, monitoring, and strict ingress policy.

That is the lowest-complexity deployment that still counts as proper production.

---

## Target Outcome

Production v1 must support:

- real users
- real data durability
- real rollback and recovery
- real observability
- clean upgrade path to multi-node later

---

## Recommended Host

| Item | Recommendation |
|:--|:--|
| OS | Ubuntu Server 24.04 LTS or Debian 12 |
| CPU | 12-16 vCPU |
| RAM | 32 GB |
| Disk | 500 GB NVMe minimum |
| Storage split | OS disk + app/data disk preferred |
| Backup target | off-host object storage or backup server |

If local inference is enabled heavily, increase RAM and CPU accordingly.

---

## Production v1 Topology

```text
Internet
  |
  v
Nginx/Caddy (TLS, WAF-lite, rate limits)
  |
  +--> admin-ui
  +--> canvas-ui
  +--> gateway-api

gateway-api <--> NATS
gateway-api <--> Postgres
gateway-api <--> OpenSearch
gateway-api <--> SearXNG / LiteLLM / Ollama
gateway-api <--> artifact storage volume

agent-runtime <--> NATS
agent-runtime <--> Postgres
agent-runtime <--> provider layer
```

All internal services stay private to the host network.

---

## Required Production Controls

### Host

- automatic security updates policy
- time sync enabled
- disk monitoring
- firewall enabled
- SSH restricted to admin source ranges or VPN

### Containers

- pinned images where possible
- restart policy
- explicit resource limits
- explicit persistent volumes
- health checks on core services

### Data

- nightly backups minimum
- transaction-safe Postgres dump or snapshot strategy
- backup verification
- restore drill schedule

### Security

- unique secrets for production
- TLS certificates with automated renewal
- no direct public database access
- no default passwords
- operator audit trail retained

### Observability

- service health dashboards
- log aggregation
- alerting for core failures
- backup job alerts
- disk and memory alerts

---

## Suggested Host Paths

```text
/srv/sven/prod/
  compose/
  env/
  data/
    postgres/
    nats/
    opensearch/
    artifacts/
  backups/
  logs/
```

---

## Minimum DNS Layout

- `sven.systems` -> canvas/public app
- `admin.sven.systems` -> admin UI
- optional `api.sven.systems` -> gateway direct exposure if split is desired

You can also front both UIs and API behind one domain with path routing, but domain separation is cleaner operationally.

---

## Release Procedure For Production v1

1. build signed release artifacts
2. validate staging
3. take pre-deploy backup
4. deploy containers on production VM
5. run migrations
6. run post-deploy smoke
7. monitor canary window
8. close release evidence

Rollback must be documented before first production cutover.

---

## Production v1 Acceptance Checklist

- Linux VM hardened
- public ingress stable on TLS
- browser QA passes against production host
- mobile app can authenticate against production host
- backup and restore verified
- rollback rehearsal documented and current
- storage growth and alerting configured
- secrets inventory complete
- on-call operator path documented

---

## When Production v1 Is No Longer Enough

Move beyond production v1 when one or more are true:

- downtime during host maintenance is unacceptable
- one host is not enough for workload or memory
- independent scaling of gateway/runtime/search is required
- SLOs require HA for ingress, database, or message bus
- operator team is ready for orchestration complexity

---

## Related

- [deployment-ladder-2026.md](deployment-ladder-2026.md)
- [staging-linux-vm-2026.md](staging-linux-vm-2026.md)
- [production-scale-2026.md](production-scale-2026.md)
- [ingress-topologies.md](ingress-topologies.md)
- [edge-nginx-and-traefik-options.md](edge-nginx-and-traefik-options.md)
