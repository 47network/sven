# Traefik Ingress Setup

Use this only if Traefik is your ingress controller.

If you are not using Traefik:
- standalone Nginx: `docs/deploy/nginx-47matrix-domains.md`
- external+internal split: `docs/deploy/ingress-topologies.md`

Canonical host/route ownership lives in:

- `docs/deploy/public-web-surface-routing-2026.md`
- `docs/deploy/public-route-contract-and-auth-boundaries-2026.md`

You can run:
- Traefik only (single layer), or
- Traefik -> Traefik (external thin TLS proxy + internal app-routing proxy).

## Config File

- `config/traefik/sven-dynamic.yml`

This file defines:
- host/path routers for installer/app/API/admin
- services for gateway/admin/canvas
- optional admin IP allowlist middleware

## Apply

Load dynamic config according to your Traefik deployment mode.
Typical file-provider setup:

```bash
sudo cp config/traefik/sven-dynamic.yml /etc/traefik/dynamic/sven-dynamic.yml
sudo systemctl reload traefik
```

## Verify

```bash
curl -I https://example.com/install.sh
curl -I https://app.example.com/readyz
curl -I https://app.example.com/admin47
```

