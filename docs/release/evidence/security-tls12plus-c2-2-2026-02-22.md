# C2.2 TLS 1.2+ Enforcement (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Changes

- Added explicit TLS minimum protocol and modern cipher baseline on external nginx edge configs:
  - `config/nginx/extnginx-sven-app.conf`
  - `config/nginx/extnginx-sven-installers.conf`

Configured directives:

- `ssl_protocols TLSv1.2 TLSv1.3;`
- `ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';`
- `ssl_prefer_server_ciphers off;`

## Validation

- Verified all nginx configs with `listen 443 ssl` now include TLS 1.2+ protocol enforcement:
  - local check command returned no missing files.

## Notes

- Existing `config/nginx/sven-47matrix.conf` already enforced `ssl_protocols TLSv1.2 TLSv1.3`; this update aligns the remaining edge configs.
