# C2.2 Egress Proxy Allowlist Enforcement (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Changes

- Replaced permissive squid policy with explicit allowlist policy:
  - `services/egress-proxy/squid.conf`
  - Removed `http_access allow all`
  - Added:
    - `acl allowed_domains dstdomain "/etc/squid/allowlist.txt"`
    - `http_access allow allowed_domains`
    - `http_access deny all`
    - safe port + CONNECT restrictions

- Added default allowlist file:
  - `services/egress-proxy/allowlist.txt`

- Mounted allowlist into proxy container:
  - `docker-compose.yml`
  - `./services/egress-proxy/allowlist.txt:/etc/squid/allowlist.txt:ro`

## Verification

- Static config checks confirm deny-by-default and allowlist mount wiring.

## Notes

- Runtime proxy behavior depends on deployed allowlist contents; expand `allowlist.txt` only with explicitly approved domains.
