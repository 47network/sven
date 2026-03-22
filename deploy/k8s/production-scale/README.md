# Sven Production-Scale Kubernetes Package

This directory contains the package-local assets for the Sven production-scale reference deployment.

Canonical guidance lives in:

- [docs/deploy/production-scale-kubernetes-reference-2026.md](../../../docs/deploy/production-scale-kubernetes-reference-2026.md)
- [docs/deploy/production-scale-cluster-bootstrap-2026.md](../../../docs/deploy/production-scale-cluster-bootstrap-2026.md)
- [docs/deploy/production-scale-secrets-and-images-2026.md](../../../docs/deploy/production-scale-secrets-and-images-2026.md)

Use this directory for:

- `base/`
- `overlays/staging`
- `overlays/prod`
- `examples/`
- `bootstrap/`

Quick validation:

```bash
kubectl kustomize deploy/k8s/production-scale/base > /dev/null
kubectl kustomize deploy/k8s/production-scale/overlays/staging > /dev/null
kubectl kustomize deploy/k8s/production-scale/overlays/prod > /dev/null
sh scripts/ops/sh/production-scale-k8s-verify.sh
```
