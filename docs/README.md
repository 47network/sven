# Sven Documentation

This directory contains all operational, release, security, and architectural documentation for the Sven platform.

---

## Navigation

### Architecture & Development
| Document | Description |
|:---------|:------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Full system architecture — services, data flows, integration points |
| [adapter-development.md](adapter-development.md) | Adapter protocol guide — inbound/outbound HTTP spec, env vars, new adapter checklist |
| [config.md](config.md) | Platform configuration reference — all env vars and their defaults |
| [KEY_ROTATION.md](KEY_ROTATION.md) | Key rotation procedures for all secrets and certificates |

### Deployment
| Document | Description |
|:---------|:------------|
| [deploy/deployment-ladder-2026.md](deploy/deployment-ladder-2026.md) | Recommended path from local dev to staging, production v1, and production scale |
| [deploy/setup-paths-matrix-2026.md](deploy/setup-paths-matrix-2026.md) | Master map of all supported Sven setup paths across GitHub release, operators, and platform engineering |
| [deploy/github-release-install-guide-2026.md](deploy/github-release-install-guide-2026.md) | Public-facing install path guide for GitHub users and release evaluators |
| [deploy/public-web-surface-routing-2026.md](deploy/public-web-surface-routing-2026.md) | Canonical public release host split for landing, suite, installers, and runtime surfaces |
| [deploy/public-route-contract-and-auth-boundaries-2026.md](deploy/public-route-contract-and-auth-boundaries-2026.md) | Host/route/auth matrix for public and gated runtime surfaces |
| [deploy/sven-systems-cutover-checklist-2026.md](deploy/sven-systems-cutover-checklist-2026.md) | Exact DNS, TLS, ingress, validation, and rollback checklist for the real public move to `sven.systems` and `app.sven.systems` |
| [deploy/windows-nginx-acme-renewal-2026.md](deploy/windows-nginx-acme-renewal-2026.md) | Docker-based ACME issuance and renewal workflow for the live Windows nginx edge on `44747` |
| [deploy/staging-linux-vm-2026.md](deploy/staging-linux-vm-2026.md) | Exact staging target on a Linux VM |
| [deploy/staging-execution-plan-2026.md](deploy/staging-execution-plan-2026.md) | Exact step-by-step staging build and validation sequence |
| [deploy/staging-host-bringup-checklist-2026.md](deploy/staging-host-bringup-checklist-2026.md) | Operator-ready checklist for the first real staging Linux host |
| [deploy/staging-proxmox-small-host-lan-gpu-2026.md](deploy/staging-proxmox-small-host-lan-gpu-2026.md) | Staging plan for a small Proxmox host with LAN GPU inference nodes |
| [deploy/staging-bare-metal-2026.md](deploy/staging-bare-metal-2026.md) | Staging plan for a direct bare-metal Linux host |
| [deploy/production-v1-linux-vm-2026.md](deploy/production-v1-linux-vm-2026.md) | Exact first real production target on a hardened Linux VM |
| [deploy/production-v1-rollout-plan-2026.md](deploy/production-v1-rollout-plan-2026.md) | Controlled promotion path from staging into production v1 |
| [deploy/production-scale-2026.md](deploy/production-scale-2026.md) | Multi-node scale target using orchestration |
| [deploy/production-scale-kubernetes-reference-2026.md](deploy/production-scale-kubernetes-reference-2026.md) | Reference Kubernetes package and validation path for the scale tier |
| [deploy/production-scale-cluster-bootstrap-2026.md](deploy/production-scale-cluster-bootstrap-2026.md) | Cluster bootstrap order for ingress, cert-manager, external dependencies, and first Sven apply |
| [deploy/production-scale-secrets-and-images-2026.md](deploy/production-scale-secrets-and-images-2026.md) | Environment-specific secret generation and digest pinning for scale rollout |
| [deploy/production-scale-validation-program-2026.md](deploy/production-scale-validation-program-2026.md) | Required validation program before claiming scale readiness |

### Release & Parity
| Document | Description |
|:---------|:------------|
| [release/LOCAL_TESTING_GUIDE.md](release/LOCAL_TESTING_GUIDE.md) | End-to-end local test procedure |
| [release/README.md](release/README.md) | Entry point for canonical release docs, active status dashboards, and archive boundaries |
| [release/section-i-parity-assessment.md](release/section-i-parity-assessment.md) | Feature parity assessment |
| [release/section-j-performance-accessibility.md](release/section-j-performance-accessibility.md) | SLOs, performance results, accessibility |
| [release/section-k-security-privacy.md](release/section-k-security-privacy.md) | Security and privacy assessment |
| [release/historical-artifacts-and-evidence-policy-2026.md](release/historical-artifacts-and-evidence-policy-2026.md) | Policy for interpreting historical evidence, generated artifacts, and archive directories |
| [release/checklists/](release/checklists/) | Production readiness checklists |

### Live Status Dashboards
| Document | Description |
|:---------|:------------|
| [release/status/competitor-capability-proof-latest.md](release/status/competitor-capability-proof-latest.md) | Machine-verified row-level parity proof across tracked competitors |
| [release/status/competitor-delta-sheet-latest.md](release/status/competitor-delta-sheet-latest.md) | Ranked competitor coverage scoreboard (row + wave lanes) |
| [release/status/parity-checklist-verify-latest.md](release/status/parity-checklist-verify-latest.md) | Strict parity checklist gate results (Ecosystem Readiness + Capability Proof) |
| [release/status/community-ecosystem-readiness-latest.md](release/status/community-ecosystem-readiness-latest.md) | Public community ecosystem readiness and policy posture |
| [release/status/community-doc-agents-latest.md](release/status/community-doc-agents-latest.md) | Runtime-backed Doc-Agent Verification Feed status |
| [release/status/ci-billing-readiness-latest.md](release/status/ci-billing-readiness-latest.md) | GitHub Actions billing readiness and hard blocker diagnostics |
| [release/status/README.md](release/status/README.md) | Interpretation guide for current `latest` dashboards versus archived generated status files |

### Parity Comparisons
| Document | Description |
|:---------|:------------|
| [parity/Sven_vs_OpenClaw_Feature_Comparison.md](parity/Sven_vs_OpenClaw_Feature_Comparison.md) | Sven vs chat bridge platform |
| [parity/sven-vs-agent-zero-feature-comparison.md](parity/sven-vs-agent-zero-feature-comparison.md) | Sven vs single-user AI CLI |
| [parity/Sven_Parity_Checklist.md](parity/Sven_Parity_Checklist.md) | Combined parity checklist |

### Deployment & Handoff
| Document | Description |
|:---------|:------------|
| [deploy/development-machine-handoff-2026.md](deploy/development-machine-handoff-2026.md) | Branch inventory, merge order, and machine migration rules |

### Ops Runbooks
| Document | Description |
|:---------|:------------|
| [ops/runbook-index-2026.md](ops/runbook-index-2026.md) | Index of all operational runbooks |
| [runbooks/community-public-launch-and-security.md](runbooks/community-public-launch-and-security.md) | Public community launch + security posture checklist |
| [runbooks/community-accounts-separate-db.md](runbooks/community-accounts-separate-db.md) | Separate community DB model and admin bridge setup |
| [runbooks/community-doc-agents-verification.md](runbooks/community-doc-agents-verification.md) | Runtime-backed community documentation verification and publish flow |
| [runbooks/github-actions-billing-unblock.md](runbooks/github-actions-billing-unblock.md) | How to clear Actions billing blocks and validate CI provenance |

### Security
| Document | Description |
|:---------|:------------|
| [security/threat-model.md](security/threat-model.md) | Threat model and attack surface |
| [security/incident-response-playbook.md](security/incident-response-playbook.md) | Incident triage and escalation |
| [security/ui-app-security-baseline.md](security/ui-app-security-baseline.md) | Frontend security baseline |
| [privacy/public-legal-pages-and-data-rights-2026.md](privacy/public-legal-pages-and-data-rights-2026.md) | Public legal route and user-rights contract for runtime surfaces |

### Enterprise & Community
| Document | Description |
|:---------|:------------|
| [enterprise/README.md](enterprise/README.md) | Enterprise/governance entrypoint for deployment, evidence, and policy posture |
| [community/public-community-url-policy-2026.md](community/public-community-url-policy-2026.md) | Canonical public community URL and runtime-host ownership policy |

---

## Contributing to Docs

- All documentation is Markdown.
- File names use lowercase kebab-case.
- Link to other docs using relative paths.
- Keep prose concise — prefer tables and lists over long paragraphs.
- Update the relevant doc whenever a feature changes.
- For major new features, add an entry to [CHANGELOG.md](../CHANGELOG.md).
