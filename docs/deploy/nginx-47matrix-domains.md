# 47matrix Domain Split with Nginx

This is the default setup when Nginx on Sven host is the public ingress.
If you already operate an external proxy tier, use `docs/deploy/ingress-topologies.md` instead.

Canonical public route ownership lives in:

- `docs/deploy/public-web-surface-routing-2026.md`
- `docs/deploy/public-route-contract-and-auth-boundaries-2026.md`

This runbook sets up the chosen split:

- One-liners: `example.com`
- Release suite: `example.com/suite`
- App/UI/API: `app.example.com`

## 1) DNS Records

In your `47matrix.online` DNS zone:

- `A  sven         -> <PUBLIC_SERVER_IPV4>`
- `A  sven.glyph   -> <PUBLIC_SERVER_IPV4>`
- Optional IPv6:
  - `AAAA sven       -> <PUBLIC_SERVER_IPV6>`
  - `AAAA sven.glyph -> <PUBLIC_SERVER_IPV6>`

If you use a CDN/proxy mode, start with DNS-only while validating TLS and origin routing.

## 2) Nginx Config

Use this file as the base template:

- `config/nginx/sven-47matrix.conf`

If and only if you already have an external Nginx that terminates TLS and forwards internally, use:

- `config/nginx/sven-47matrix-behind-edge.conf`
- `docs/deploy/edge-nginx-and-traefik-options.md`

Install on host:

```bash
sudo cp config/nginx/sven-47matrix.conf /etc/nginx/sites-available/sven-47matrix.conf
sudo ln -s /etc/nginx/sites-available/sven-47matrix.conf /etc/nginx/sites-enabled/sven-47matrix.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 3) TLS Certificates (Certbot)

```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d app.example.com
```

Certbot will patch certificate paths in Nginx blocks automatically if the config is valid.

If certificates are already managed by your edge Nginx, skip this section for the internal Sven ingress and run HTTP-only internally.

## 4) Expected Local Upstreams

By default, the Nginx template assumes:

- Gateway API: `127.0.0.1:3000`
- Admin UI: `127.0.0.1:3002` (optional)
- Canvas UI: `127.0.0.1:3003` (optional)

If you deploy Admin/Canvas on different ports or containers, update upstream blocks in the Nginx file.

## 5) Static Release Host Layout

`example.com` serves static installers from:

- `/opt/sven/quickstart/install.sh`
- `/opt/sven/quickstart/install.ps1`
- `/opt/sven/quickstart/install.cmd`
- `/opt/sven/quickstart/index.html`
- `/opt/sven/quickstart/suite/*`

Source files in this repo:

- `deploy/quickstart/install.sh`
- `deploy/quickstart/install.ps1`
- `deploy/quickstart/install.cmd`
- `deploy/quickstart/suite/*`
- `docs/deploy/quickstart-installers.md`

Recommended one-liners:

```sh
curl -fsSL https://example.com/install.sh | sh
```

```powershell
iwr -useb https://example.com/install.ps1 | iex
```

```cmd
curl -fsSL https://example.com/install.cmd -o install.cmd && install.cmd && del install.cmd
```

## 6) Verification

```bash
curl -I https://example.com/install.sh
curl -I https://example.com/install.ps1
curl -I https://example.com/suite
curl -I https://app.example.com/healthz
curl -I https://app.example.com/readyz
curl -I https://app.example.com/community
```

Shell ops shortcut:

```sh
sh scripts/ops/sh/ops.sh ingress smoke-47matrix
```

## 7) Security Notes

- Keep only `80/443` publicly exposed on the reverse proxy host.
- Restrict direct public access to backend app ports.
- Rotate installer scripts via atomic file replacement in `/opt/sven/quickstart`.

## 8) Availability Guard (recommended)

Install the compose boot unit so upstreams are reasserted after restart:

```bash
sh scripts/ops/sh/ops.sh ingress install-systemd-core /opt/sven/app
```

