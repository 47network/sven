# Sven Production-Scale Cluster Bootstrap

This directory contains bootstrap examples for the Sven production-scale tier.

These files are examples, not turnkey cluster installers.

Use them with:

- `docs/deploy/production-scale-cluster-bootstrap-2026.md`
- `docs/deploy/production-scale-kubernetes-reference-2026.md`

## Included

- `cluster-issuer-letsencrypt-production.example.yaml`
- `cluster-issuer-letsencrypt-staging.example.yaml`

## Purpose

Bootstrap order at the scale tier is:

1. Kubernetes cluster exists
2. ingress controller exists
3. `metrics-server` exists
4. `cert-manager` exists
5. cluster issuer exists
6. external Postgres/NATS/OpenSearch/object storage contracts are ready
7. Sven namespaces and secrets are applied
8. Sven overlays are applied

Do not treat these examples as a substitute for your actual infrastructure repository.
