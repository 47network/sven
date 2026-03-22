# Sven GitHub Release Install Guide 2026

This guide exists for public release users.

It answers:

- how do I try Sven from release assets?
- which setup path should I choose first?
- where do I go next if I want a real deployment?

This guide keeps domains generic on purpose.

---

## Start Here

If you are discovering Sven from GitHub, use one of these paths:

| Goal | Path | Primary doc |
|:--|:--|:--|
| Try Sven quickly | quickstart installer | [quickstart-installers.md](quickstart-installers.md) |
| Develop locally | local dev stack | [README](../../README.md) |
| Run a serious staging environment | Linux staging | [staging-execution-plan-2026.md](staging-execution-plan-2026.md) |
| Understand all options | setup matrix | [setup-paths-matrix-2026.md](setup-paths-matrix-2026.md) |

---

## Option 1: Quickstart Installer

Use this when:

- you want the fastest first install
- you are evaluating Sven rather than operating it formally

Guide:

- [quickstart-installers.md](quickstart-installers.md)

Reference public hostnames:

- `https://example.com`
- `https://app.example.com`

Important release caveat:

- the quickstart installers default to `SVEN_BRANCH=main`
- release users should override `SVEN_BRANCH` to a release tag or exact commit when reproducibility matters
- maintainers should align release references with [../../RELEASE.md](../../RELEASE.md)

---

## Option 2: Local Development

Use this when:

- you want to modify code
- you want hot-reload and local debugging

Start from:

- [README](../../README.md)
- [release/LOCAL_TESTING_GUIDE.md](../release/LOCAL_TESTING_GUIDE.md)

---

## Option 3: Real Staging Deployment

Use this when:

- you want a Linux-hosted validation environment
- you want to test backups, restore, ingress, and release gates

Start from:

- [staging-linux-vm-2026.md](staging-linux-vm-2026.md)
- [staging-execution-plan-2026.md](staging-execution-plan-2026.md)
- [staging-host-bringup-checklist-2026.md](staging-host-bringup-checklist-2026.md)

If your infra differs:

- Proxmox small host + LAN GPU:
  - [staging-proxmox-small-host-lan-gpu-2026.md](staging-proxmox-small-host-lan-gpu-2026.md)
- Bare metal:
  - [staging-bare-metal-2026.md](staging-bare-metal-2026.md)

---

## Option 4: Production And Scale

Use these only after staging is proven.

Production v1:

- [production-v1-linux-vm-2026.md](production-v1-linux-vm-2026.md)
- [production-v1-rollout-plan-2026.md](production-v1-rollout-plan-2026.md)

Production scale:

- [production-scale-2026.md](production-scale-2026.md)
- [production-scale-kubernetes-reference-2026.md](production-scale-kubernetes-reference-2026.md)

---

## Important Domain Rule

This public guide uses generic hostnames such as:

- `example.com`
- `app.example.com`

Actual deployment runbooks may use real domains such as:

- `sven.systems`
- `app.sven.systems`

That is intentional.

---

## Recommended Reading Order

1. [README](../../README.md)
2. [setup-paths-matrix-2026.md](setup-paths-matrix-2026.md)
3. one concrete install path from this list

