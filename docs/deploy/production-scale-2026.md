# Sven Production Scale 2026

This document defines the scaled deployment target for Sven after production v1 is proven.

Do not start here by default. Move here after the single-node Linux production contract is stable and measured.

---

## When To Move Here

Production scale is justified when:

- you need higher availability than one host can provide
- maintenance windows must not cause user-facing downtime
- one node cannot handle agent/runtime/search load
- you need cleaner isolation between workloads
- you have operator maturity for cluster operations

---

## Recommended Platform

Preferred:

- Kubernetes on Linux nodes

Acceptable:

- Nomad on Linux nodes

Not recommended as the first scale step:

- custom hand-managed multi-VM scripts without orchestration

Reference package:

- [production-scale-kubernetes-reference-2026.md](production-scale-kubernetes-reference-2026.md)
- [production-scale-cluster-bootstrap-2026.md](production-scale-cluster-bootstrap-2026.md)
- `deploy/k8s/production-scale/`

---

## Reference Topology

```text
Users
  |
  v
Managed DNS
  |
  v
Ingress / Load Balancer
  |
  +--> admin-ui replicas
  +--> canvas-ui replicas
  +--> gateway-api replicas

gateway-api replicas <--> NATS cluster
gateway-api replicas <--> Postgres HA / managed Postgres
gateway-api replicas <--> OpenSearch cluster
gateway-api replicas <--> object storage

agent-runtime replicas <--> NATS cluster
agent-runtime replicas <--> provider layer

observability stack collects:
  metrics
  logs
  traces
  alerting
```

---

## Recommended Split

| Layer | Recommendation |
|:--|:--|
| Ingress | managed LB + ingress controller |
| UI | stateless replicated pods/services |
| Gateway | stateless replicated pods/services |
| Agent runtime | horizontally scalable worker pool |
| NATS | clustered or managed |
| Postgres | managed HA or dedicated replicated service |
| OpenSearch | dedicated cluster with storage class |
| Artifacts/backups | S3-compatible object storage |

---

## Data Strategy At Scale

Use:

- managed Postgres if possible
- object storage for artifacts and backups
- persistent volumes only where truly required

Avoid:

- node-local artifact storage as the primary source of truth
- single-node Postgres while claiming HA
- mixing stateless and stateful assumptions

---

## Operational Requirements

You need all of the following before calling this production scale:

- infra-as-code
- secret management
- cluster monitoring
- workload dashboards
- alert routing
- backup verification
- restore environment
- node upgrade procedure
- incident runbooks

---

## Rollout Model

Recommended:

- blue/green or progressive canary for gateway and UI
- worker rollouts separated from ingress rollouts
- schema migrations gated and backward compatible

Never:

- deploy schema-breaking code and migrations in one blind step
- couple cluster bootstrap with release deploy

---

## Scale Validation Matrix

Production-scale testing should include:

1. node failure
2. pod restart churn
3. ingress failover
4. database failover
5. NATS partition/failure scenario
6. artifact storage outage behavior
7. rollback under live traffic
8. load test with real user paths

---

## Minimum Success Criteria

- no single UI or gateway instance is critical
- storage is durable beyond a single node
- alerting is actionable
- rollback is faster than the defined incident threshold
- SLOs are measured, not assumed

---

## Recommendation For Sven

The correct sequence is:

1. prove staging on Linux
2. prove production v1 on Linux
3. run real load and availability measurements
4. then design the cluster shape based on measured bottlenecks

If you skip the first two, production-scale architecture becomes guesswork.

---

## Related

- [deployment-ladder-2026.md](deployment-ladder-2026.md)
- [production-v1-linux-vm-2026.md](production-v1-linux-vm-2026.md)
- [production-scale-kubernetes-reference-2026.md](production-scale-kubernetes-reference-2026.md)
- [observability-standards-2026.md](../architecture/observability-standards-2026.md)
- [performance-capacity-targets-2026.md](../performance/performance-capacity-targets-2026.md)
