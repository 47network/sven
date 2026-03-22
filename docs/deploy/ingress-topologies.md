# Sven Ingress Topologies

This runbook defines which reverse-proxy setup to use and when.

Canonical route ownership and auth boundaries live in:

- [public-web-surface-routing-2026.md](public-web-surface-routing-2026.md)
- [public-route-contract-and-auth-boundaries-2026.md](public-route-contract-and-auth-boundaries-2026.md)

## Choose One Topology

1. Standalone Nginx (default)
- Use this when Sven host itself terminates TLS/public traffic.
- Required files:
  - `config/nginx/sven-47matrix.conf`
- External proxy files (`extnginx-*`) are not required.

2. External Nginx + Internal Sven Nginx (optional)
- Use this when you already run a separate external reverse proxy/LB.
- External Nginx does only TLS + `location /` pass-through.
- Internal Sven Nginx handles all path logic (installers, `/v1`, `/admin47`, redirects, root routing).
- Required files:
  - external: `config/nginx/extnginx-sven-installers.conf`, `config/nginx/extnginx-sven-app.conf`
  - internal: `config/nginx/sven-internal-ingress.conf`
  - optional shared limits at external layer: `config/nginx/extnginx-rate-limit-policy.conf`

Dockerized internal nginx variant:
- Internal ingress can run as a container via `sven-internal-nginx` in `docker-compose.yml`.
- Config file: `config/nginx/sven-internal-ingress.docker.conf`
- Publishes `:8088` and handles both installer host and app host routing.

3. Caddy (alternative to Nginx)
- Use this when Caddy is your ingress controller.
- Required file:
  - `config/caddy/Sven.Caddyfile`
- Configure site hostnames and optional admin allowlist inside the file.
- Full runbook: `docs/deploy/caddy-ingress.md`

4. Traefik (alternative to Nginx)
- Use this when Traefik is your ingress controller.
- Required file:
  - `config/traefik/sven-dynamic.yml`
- Configure routers/services and optional admin IP allowlist middleware.
- Full runbook: `docs/deploy/traefik-ingress.md`

## Same-Proxy Topologies (No Nginx Required)

You can also run the same proxy family at both layers:

1. Traefik -> Traefik
- External Traefik terminates TLS and forwards by host to internal Traefik.
- Internal Traefik owns app path routing and optional `/admin47` IP allowlist middleware.

2. Caddy -> Caddy
- External Caddy terminates TLS and forwards by host to internal Caddy.
- Internal Caddy owns app path routing and optional `/admin47` `remote_ip` allowlist.

In both cases, external layer should stay thin and internal layer should own path rules.

## Behavioral Contract (All Topologies)

- Static release host:
  - `example.com`
  - serves `/`, `/suite`, `/suite/*`, `/install.sh`, `/install.ps1`, `/install.cmd`
- Runtime host:
  - `app.example.com`
  - serves Canvas on `/`
  - serves public runtime routes such as `/community`, `/docs`, `/skills`, `/marketplace`, `/privacy`, `/terms`, `/shared/*`
  - serves Admin on `/admin47`
  - serves API on `/v1/*`
  - serves probes on `/healthz`, `/readyz`

## Internal Nginx Ownership

When using topology #2 (external + internal nginx), internal nginx is the source of truth for:
- installer routes and content types
- legacy redirects (for example `/canvas` to `/`)
- admin route handling and optional admin IP lockdown

External nginx should not duplicate those path rules; it should only proxy `location /` to internal ingress.

## Quick Validation

```bash
curl -I https://example.com/install.sh
curl -I https://example.com/suite
curl -I https://example.com/install.ps1
curl -I https://app.example.com/readyz
curl -I https://app.example.com/community
curl -I https://app.example.com/admin47
```

Automated checks:

```bash
sh scripts/ops/sh/smoke-47matrix-domains.sh example.com app.example.com
npm run release:edge:network:check
```

