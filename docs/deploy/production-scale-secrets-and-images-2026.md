# Sven Production-Scale Secrets And Image Pinning 2026

This runbook defines how to generate environment-specific Kubernetes secrets and how to pin Sven scale deployments to exact image digests.

Use this with:

- [production-scale-kubernetes-reference-2026.md](production-scale-kubernetes-reference-2026.md)
- `deploy/k8s/production-scale/overlays/staging`
- `deploy/k8s/production-scale/overlays/prod`

---

## Rule

Do not run scale overlays from floating tags alone.

For real cluster deployment:

1. generate environment-specific secrets
2. create the registry pull secret in the target namespace
3. replace tag placeholders with exact immutable digests before rollout

---

## Environment Secret Files

Examples:

- `deploy/k8s/production-scale/examples/staging-app-secrets.example.yaml`
- `deploy/k8s/production-scale/examples/prod-app-secrets.example.yaml`
- `deploy/k8s/production-scale/examples/staging-registry-pull-secret.example.yaml`
- `deploy/k8s/production-scale/examples/prod-registry-pull-secret.example.yaml`

These files are templates only. Do not commit real values to this repository.

---

## Generate App Secrets

Recommended approach:

1. copy the example file for the target environment
2. replace placeholders from your secret manager
3. store the real manifest in a private infra repo

Staging:

```bash
cp deploy/k8s/production-scale/examples/staging-app-secrets.example.yaml private/staging-app-secrets.yaml
```

Production:

```bash
cp deploy/k8s/production-scale/examples/prod-app-secrets.example.yaml private/prod-app-secrets.yaml
```

---

## Generate Registry Pull Secret

If using a private registry such as private GHCR:

```bash
kubectl create secret docker-registry sven-registry \
  --namespace sven-staging \
  --docker-server=ghcr.io \
  --docker-username=YOUR_USER \
  --docker-password=YOUR_TOKEN \
  --docker-email=ops@sven.systems \
  --dry-run=client -o yaml > private/staging-registry-pull-secret.yaml
```

Production:

```bash
kubectl create secret docker-registry sven-registry \
  --namespace sven \
  --docker-server=ghcr.io \
  --docker-username=YOUR_USER \
  --docker-password=YOUR_TOKEN \
  --docker-email=ops@sven.systems \
  --dry-run=client -o yaml > private/prod-registry-pull-secret.yaml
```

---

## Pin Images By Digest

Before real rollout, replace floating tags in the overlay `images:` blocks with immutable digests.

Example:

```yaml
images:
  - name: ghcr.io/47network/thesven-gateway-api
    digest: sha256:REPLACE_WITH_REAL_DIGEST
  - name: ghcr.io/47network/thesven-agent-runtime
    digest: sha256:REPLACE_WITH_REAL_DIGEST
  - name: ghcr.io/47network/thesven-canvas-ui
    digest: sha256:REPLACE_WITH_REAL_DIGEST
  - name: ghcr.io/47network/thesven-admin-ui
    digest: sha256:REPLACE_WITH_REAL_DIGEST
```

Do this in:

- `deploy/k8s/production-scale/overlays/staging/kustomization.yaml`
- `deploy/k8s/production-scale/overlays/prod/kustomization.yaml`

Tag-based examples remain in-repo so the package is readable. Real rollout should use digests.

---

## Apply Order

Staging:

```bash
kubectl apply -f private/staging-registry-pull-secret.yaml
kubectl apply -f private/staging-app-secrets.yaml
kubectl apply -k deploy/k8s/production-scale/overlays/staging
```

Production:

```bash
kubectl apply -f private/prod-registry-pull-secret.yaml
kubectl apply -f private/prod-app-secrets.yaml
kubectl apply -k deploy/k8s/production-scale/overlays/prod
```

---

## Verification

Render checks:

```bash
kubectl kustomize deploy/k8s/production-scale/overlays/staging > /dev/null
kubectl kustomize deploy/k8s/production-scale/overlays/prod > /dev/null
```

Then use:

```bash
sh scripts/ops/sh/production-scale-k8s-verify.sh
```
