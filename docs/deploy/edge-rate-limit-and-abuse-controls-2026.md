# Edge Rate Limit and Abuse Controls (2026)

## Rate Limit Controls
- Nginx shared limits are defined in `config/nginx/extnginx-rate-limit-policy.conf`.
- Baseline controls:
  - Global per-IP request rate (`sven_global_per_ip`).
  - Auth-path hardened per-IP rate (`sven_auth_per_ip`).
  - Per-IP connection cap (`sven_conn_per_ip`).

## Integration
1. Include `config/nginx/extnginx-rate-limit-policy.conf` from `http {}` in the edge Nginx main config.
2. Apply `limit_conn sven_conn_per_ip` at `server {}` level for both Sven domains.
3. Apply `limit_req zone=sven_global_per_ip` to general app/install paths.
4. Apply `limit_req zone=sven_auth_per_ip` to `/v1/auth/*` paths.

## Abuse Response
- If abuse threshold is exceeded:
  - reduce burst values,
  - tighten auth rate,
  - block offending IP ranges upstream if needed.
- Record incident window and mitigations in release evidence/runbook updates.

## Validation
- Run: `npm run release:edge:network:check`
- Ensure `docs/release/status/edge-network-delivery-latest.json` reports `status=pass`.
