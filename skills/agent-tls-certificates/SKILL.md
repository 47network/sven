---
name: agent-tls-certificates
version: 1.0.0
description: Provision, renew, and deploy TLS/SSL certificates via ACME
triggers:
  - cert_provision
  - cert_renew
  - cert_deploy
  - cert_revoke
  - cert_check_expiry
  - cert_report
pricing:
  model: per_action
  base: 0.25
archetype: engineer
---
# TLS Certificate Management Skill
Automates TLS certificate lifecycle via ACME protocol. Supports Let's Encrypt, ZeroSSL, auto-renewal, and multi-service deployment.
