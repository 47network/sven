skill: agent-ssl-certificates
name: Agent SSL Certificates
version: 1.0.0
description: >
  Autonomous SSL/TLS certificate lifecycle management. Issues, renews, monitors
  expiry, and alerts on certificate health across Sven's infrastructure.

triggers:
  - ssl_issue_cert
  - ssl_renew_cert
  - ssl_check_expiry
  - ssl_revoke_cert
  - ssl_verify_chain
  - ssl_report

intents:
  - issue new SSL certificates for domains
  - auto-renew certificates before expiry
  - monitor certificate expiry and chain validity
  - revoke compromised certificates
  - generate certificate health reports

outputs:
  - SSL certificate records
  - renewal logs with status tracking
  - expiry alerts and health checks
  - certificate portfolio reports
