# Sven Production-Scale Kubernetes Reference 2026

This document defines the reference Kubernetes package for Sven at the production-scale tier.

It is a reference package, not a claim that scale is already proven.

---

## Purpose

Use this package when all of the following are true:

- Linux staging is proven
- production v1 is proven
- measured load and availability requirements justify multi-node orchestration

Bootstrap order is defined separately in:

- [production-scale-cluster-bootstrap-2026.md](production-scale-cluster-bootstrap-2026.md)

---

## Package Location

The reference package lives at:

```text
deploy/k8s/production-scale/
```

Key files:

- `deploy/k8s/production-scale/base/kustomization.yaml`
- `deploy/k8s/production-scale/base/gateway-api.yaml`
- `deploy/k8s/production-scale/base/agent-runtime.yaml`
- `deploy/k8s/production-scale/base/canvas-ui.yaml`
- `deploy/k8s/production-scale/base/admin-ui.yaml`
- `deploy/k8s/production-scale/base/ingress.yaml`
- `deploy/k8s/production-scale/overlays/staging/kustomization.yaml`
- `deploy/k8s/production-scale/overlays/prod/kustomization.yaml`
- `deploy/k8s/production-scale/examples/secrets.example.yaml`
- `deploy/k8s/production-scale/examples/staging-app-secrets.example.yaml`
- `deploy/k8s/production-scale/examples/prod-app-secrets.example.yaml`
- `deploy/k8s/production-scale/examples/staging-registry-pull-secret.example.yaml`
- `deploy/k8s/production-scale/examples/prod-registry-pull-secret.example.yaml`
- `scripts/ops/sh/production-scale-k8s-verify.sh`

---

## Design Rules

The package assumes:

- `Postgres` is external
- `NATS` is external
- `OpenSearch` is external
- artifacts and backups live in S3-compatible object storage
- ingress controller and TLS issuer already exist in the cluster

This is intentional. At scale, Sven should replicate stateless services and consume durable external state layers.

---

## Workloads Included

| Workload | Type | Notes |
|:--|:--|:--|
| `gateway-api` | Deployment + Service + HPA + PDB | horizontally scalable ingress-facing API |
| `agent-runtime` | Deployment + HPA + PDB | scalable worker layer |
| `canvas-ui` | Deployment + Service + HPA | public user interface |
| `admin-ui` | Deployment + Service | operator interface |
| `Ingress` | Ingress | public/admin host routing |

---

## Render And Validate

Render validation:

```bash
kubectl kustomize deploy/k8s/production-scale/base > /dev/null
kubectl kustomize deploy/k8s/production-scale/overlays/staging > /dev/null
kubectl kustomize deploy/k8s/production-scale/overlays/prod > /dev/null
```

Reference verification script:

```bash
sh scripts/ops/sh/production-scale-k8s-verify.sh
```

If the current `kubectl` context points at a reachable Kubernetes API, the script also performs a cluster-facing dry-run.

---

## Secrets Handling

Do not apply the example secret file directly in a shared repo.

Instead:

1. copy `deploy/k8s/production-scale/examples/secrets.example.yaml`
2. replace placeholders
3. store the real secret manifest in a private infra repository or generate it from your secret manager

See:

- [production-scale-secrets-and-images-2026.md](production-scale-secrets-and-images-2026.md)

---

## Promotion Rule

This package is considered ready only when:

- manifests validate
- images exist for the referenced release
- external dependencies exist
- the scale validation program is executed against a real cluster

Related:

- [production-scale-2026.md](production-scale-2026.md)
- [production-scale-validation-program-2026.md](production-scale-validation-program-2026.md)
- [production-scale-cluster-bootstrap-2026.md](production-scale-cluster-bootstrap-2026.md)
- [deployment-ladder-2026.md](deployment-ladder-2026.md)
