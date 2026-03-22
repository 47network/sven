# Sven Production Scale Validation Program 2026

This document defines how to validate Sven after moving beyond production v1.

The point is not to claim scale. The point is to prove it.

---

## Preconditions

Do not run this program until:

- production v1 exists and is stable
- real usage data exists
- observed bottlenecks justify scale work

---

## Reference Scale Target

Use:

- Linux node pool
- Kubernetes or Nomad
- object storage for artifacts/backups
- managed or HA Postgres
- clustered or managed NATS

---

## What Must Be Proven

### Availability

- one app instance can die without user outage
- one node can fail without full outage
- ingress still routes cleanly during rollout

### State durability

- artifacts survive pod/node movement
- backups are not node-local only
- restore works from off-node backup source

### Runtime behavior

- gateway scales horizontally
- agent runtime scales independently
- queueing remains healthy under load

### Rollout behavior

- canary rollout works
- rollback under live traffic works

---

## Test Program

### 1. Load test

Run sustained traffic against:

- login
- chat send
- tool runs
- search
- artifact preview/download

### 2. Failure injection

Test:

- gateway instance kill
- agent runtime kill
- node drain
- ingress restart

### 3. Data recovery

Test:

- Postgres restore
- artifact store restore
- NATS recovery path

### 4. Operational drills

Test:

- cert renewal
- secret rotation
- release rollout
- rollback

---

## Required Evidence

- capacity report
- failure-injection report
- rollback under load report
- HA topology diagram
- restore report

---

## Release Rule

Sven should only be marketed as production-scale ready after these tests are actually executed and captured.

---

## Related

- [production-scale-2026.md](production-scale-2026.md)
- [production-v1-rollout-plan-2026.md](production-v1-rollout-plan-2026.md)
