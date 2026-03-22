# Sven Production-Scale Cluster Bootstrap 2026

This runbook defines the bootstrap order for the first real Sven cluster.

It exists to prevent a common failure mode: applying Sven workloads before the cluster prerequisites are actually ready.

Use this with:

- [production-scale-kubernetes-reference-2026.md](production-scale-kubernetes-reference-2026.md)
- [production-scale-secrets-and-images-2026.md](production-scale-secrets-and-images-2026.md)

---

## Scope

This runbook covers:

- ingress controller
- `cert-manager`
- TLS issuer
- HPA prerequisite services
- external dependency contracts
- Sven namespace and secret bootstrap

It does not replace your cloud-provider or cluster-provisioning runbooks.

---

## Target Domain Model

For real Sven deployment:

- public: `https://sven.systems`
- admin: `https://admin.sven.systems`
- staging public: `https://staging.sven.systems`
- staging admin: `https://admin.staging.sven.systems`

GitHub release docs can remain generic. Cluster bootstrap should reflect the real deployment domains.

---

## Preconditions

Do not start Sven workload rollout until all of these are true:

1. Kubernetes cluster is provisioned
2. DNS records exist for the target hostnames
3. load balancer or ingress entrypoint exists
4. outbound access to ACME endpoints exists
5. external stateful dependencies are provisioned

---

## Phase 1: Cluster Baseline

Required baseline components:

- Kubernetes cluster on Linux nodes
- CNI working
- storage class configured
- `kubectl` admin access

Required add-ons:

- ingress controller
- `metrics-server`
- `cert-manager`

Recommended:

- external-dns
- sealed-secrets or external-secrets
- Prometheus stack

---

## Phase 2: Ingress Controller

Recommended default:

- `ingress-nginx`

Requirements:

- public load balancer or public ingress IP
- ingress class name known in advance
- admin/public hostnames routed to the ingress entrypoint

Bootstrap rule:

- do not apply Sven ingress before the ingress controller is healthy

Verification:

```bash
kubectl get pods -n ingress-nginx
kubectl get svc -n ingress-nginx
kubectl get ingressclass
```

---

## Phase 3: Metrics Server

HorizontalPodAutoscaler in the Sven scale package depends on metrics availability.

Verification:

```bash
kubectl get deployment -n kube-system metrics-server
kubectl top nodes
```

If `kubectl top` does not work, the HPA package is not actually ready.

---

## Phase 4: Cert-Manager And Cluster Issuer

Install `cert-manager` before applying Sven ingress.

Reference examples:

- `deploy/k8s/production-scale/bootstrap/README.md`
- `deploy/k8s/production-scale/bootstrap/cluster-issuer-letsencrypt-production.example.yaml`
- `deploy/k8s/production-scale/bootstrap/cluster-issuer-letsencrypt-staging.example.yaml`

Verification:

```bash
kubectl get pods -n cert-manager
kubectl get clusterissuer
```

Cluster issuer names expected by Sven examples:

- staging: `letsencrypt-staging`
- production: `letsencrypt-production`

---

## Phase 5: External Dependency Contracts

At the scale tier, these must exist before Sven rollout:

### Postgres

Contract:

- HA or managed Postgres
- reachable from cluster network
- dedicated database/user per environment
- backup and restore owned outside Sven app rollout

Required values:

- `DATABASE_URL`
- `COMMUNITY_DATABASE_URL`

### NATS

Contract:

- clustered or managed NATS
- JetStream enabled
- reachable from cluster network

Required value:

- `NATS_URL`

### OpenSearch

Contract:

- managed or clustered OpenSearch
- credentials provisioned
- index storage durable

Required values:

- `OPENSEARCH_URL`
- `OPENSEARCH_USER`
- `OPENSEARCH_PASSWORD`

### Object Storage

Contract:

- S3-compatible storage for artifacts and backups
- credentials provisioned outside app image

Required values:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `BACKUP_S3_BUCKET`
- `BACKUP_S3_REGION`
- `BACKUP_S3_ENDPOINT`

### Inference

Choose one:

- in-cluster inference endpoint
- external inference endpoint

Current reference package assumes an internal DNS name in config and should be patched if using an external provider path.

---

## Phase 6: Namespace And Secret Bootstrap

Apply in this order:

1. registry pull secret
2. app secret manifest
3. scale overlay

Examples:

- `deploy/k8s/production-scale/examples/staging-registry-pull-secret.example.yaml`
- `deploy/k8s/production-scale/examples/staging-app-secrets.example.yaml`
- `deploy/k8s/production-scale/examples/prod-registry-pull-secret.example.yaml`
- `deploy/k8s/production-scale/examples/prod-app-secrets.example.yaml`

---

## Phase 7: Render Validation

Run before cluster apply:

```bash
kubectl kustomize deploy/k8s/production-scale/base > /dev/null
kubectl kustomize deploy/k8s/production-scale/overlays/staging > /dev/null
kubectl kustomize deploy/k8s/production-scale/overlays/prod > /dev/null
```

Then run:

```bash
sh scripts/ops/sh/production-scale-k8s-verify.sh
```

---

## Phase 8: Apply Order

### Staging-Scale

```bash
kubectl apply -f private/staging-registry-pull-secret.yaml
kubectl apply -f private/staging-app-secrets.yaml
kubectl apply -k deploy/k8s/production-scale/overlays/staging
```

### Production-Scale

```bash
kubectl apply -f private/prod-registry-pull-secret.yaml
kubectl apply -f private/prod-app-secrets.yaml
kubectl apply -k deploy/k8s/production-scale/overlays/prod
```

---

## Phase 9: Post-Apply Checks

Required:

```bash
kubectl get pods -n sven-staging
kubectl get ingress -n sven-staging
kubectl get hpa -n sven-staging
kubectl get pods -n sven
kubectl get ingress -n sven
kubectl get hpa -n sven
```

Public checks:

```bash
curl -I https://staging.sven.systems/login
curl -I https://admin.staging.sven.systems/login
curl -I https://sven.systems/login
curl -I https://admin.sven.systems/login
```

---

## Promotion Rule

Do not call the scale tier ready because manifests render.

It is only ready when:

- bootstrap prerequisites are healthy
- overlays apply cleanly
- certificates issue successfully
- external dependencies are reachable
- the validation program is executed against the live cluster
