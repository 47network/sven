#!/usr/bin/env sh
set -eu

KUSTOMIZE_DIR="${1:-deploy/k8s/production-scale/base}"
PUBLIC_URL="${SVEN_PUBLIC_BASE_URL:-https://sven.systems}"
ADMIN_URL="${SVEN_ADMIN_BASE_URL:-https://admin.sven.systems}"

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required to validate the production-scale package"
  exit 1
fi

kubectl kustomize "$KUSTOMIZE_DIR" >/dev/null
echo "Kustomize render passed for $KUSTOMIZE_DIR"

if kubectl version --request-timeout=5s >/dev/null 2>&1; then
  kubectl apply --dry-run=client --validate=false -k "$KUSTOMIZE_DIR" >/dev/null
  echo "Cluster-facing dry-run passed for $KUSTOMIZE_DIR"
else
  echo "Skipping cluster-facing dry-run because current kubectl context is not a reachable Kubernetes API"
fi

curl -I "$PUBLIC_URL/login"
curl -I "$PUBLIC_URL/skills"
curl -I "$PUBLIC_URL/community"
if [ -n "${ADMIN_URL:-}" ]; then
  curl -I "$ADMIN_URL/login"
fi
