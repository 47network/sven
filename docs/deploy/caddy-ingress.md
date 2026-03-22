# Caddy Ingress Setup

Use this only if Caddy is your ingress controller.

If you are not using Caddy:
- standalone Nginx: `docs/deploy/nginx-47matrix-domains.md`
- external+internal split: `docs/deploy/ingress-topologies.md`

Canonical host/route ownership lives in:

- `docs/deploy/public-web-surface-routing-2026.md`
- `docs/deploy/public-route-contract-and-auth-boundaries-2026.md`

You can run:
- Caddy only (single layer), or
- Caddy -> Caddy (external thin TLS proxy + internal app-routing proxy).

## Config File

- `config/caddy/Sven.Caddyfile`

This file defines:
- installer host and app host routing
- API/admin/canvas path routing
- optional admin IP/CIDR lockdown block

## Apply

```bash
sudo cp config/caddy/Sven.Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## Verify

```bash
curl -I https://example.com/install.sh
curl -I https://app.example.com/readyz
curl -I https://app.example.com/admin47
```

