# market.sven.systems — Marketplace Edge Configuration

Public storefront for Sven's autonomous economy. This document covers the edge
nginx config, DNS records, TLS, and upstream processes.

## 1. DNS

In the `sven.systems` zone (Cloudflare):

```
A   market   -> <PUBLIC_SERVER_IPV4>
AAAA market  -> <PUBLIC_SERVER_IPV6>   # optional
```

Keep DNS-only (orange cloud OFF) while validating TLS the first time.

## 2. Nginx site

Install the template:

```bash
sudo cp config/nginx/extnginx-sven-market.conf /etc/nginx/sites-available/market.sven.systems.conf
sudo ln -s /etc/nginx/sites-available/market.sven.systems.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Requires the shared rate-limit zones from `config/nginx/extnginx-rate-limit-policy.conf`
(`sven_global_per_ip`, `sven_conn_per_ip`). Include that policy file in the
`http{}` context once per nginx install.

## 3. TLS

```bash
sudo certbot --nginx -d market.sven.systems
```

The template already references
`/etc/nginx/ssl/market.sven.systems/{fullchain.cer,private.key}` — either point
certbot at that path or adjust the template to match your ACME layout.

## 4. Upstream processes

| Port  | Process                                | Command                                         |
|-------|----------------------------------------|-------------------------------------------------|
| 3310  | `apps/marketplace-ui` (Next.js)         | `pnpm --filter @sven/marketplace-ui start`      |
| 9478  | `services/sven-marketplace` (Fastify)   | `pnpm --filter @sven/sven-marketplace start`    |

Run both under PM2 alongside the rest of the Sven stack. Example PM2 entries:

```js
{
  name: 'sven-marketplace',
  cwd: '/opt/sven/services/sven-marketplace',
  script: 'dist/index.js',
  env: { MARKETPLACE_PORT: 9478, DATABASE_URL: 'postgresql://sven:***@127.0.0.1/sven' },
},
{
  name: 'marketplace-ui',
  cwd: '/opt/sven/apps/marketplace-ui',
  script: 'node_modules/next/dist/bin/next',
  args: 'start --port 3310',
  env: { NEXT_PUBLIC_MARKETPLACE_API: 'https://market.sven.systems' },
}
```

## 5. Routes exposed

| Path                             | Upstream | Purpose                                          |
|----------------------------------|----------|--------------------------------------------------|
| `/`                              | :3310    | Storefront (Next.js)                             |
| `/listings/:slug`                | :3310    | Listing detail page                              |
| `/v1/market/listings`            | :9478    | Public browse listings API                       |
| `/v1/market/listings/:slug`      | :9478    | Listing lookup                                   |
| `/v1/market/orders`              | :9478    | Checkout (scoped; protect later with auth)       |
| `/v1/market/orders/:id/mark-paid`| :9478    | Payment webhook; gate with HMAC before opening   |

## 6. Security posture (Batch 2)

- Storefront is public and rate-limited (`sven_global_per_ip` 30 r/s burst 120).
- `/v1/market/orders*` is currently unauthenticated. **Before flipping
  Stripe/crypto live, add**:
  1. HMAC-signed webhook guard on `/mark-paid` (Stripe signing secret).
  2. Server-token middleware on seller routes (`POST /v1/market/listings*`).
  3. CORS allowlist limited to `market.sven.systems` + `sven.systems`.
- TLS 1.2/1.3 only, HSTS preload, strict COOP/CORP, no referrer leakage.

## 7. Observability

- Access log: `/var/log/nginx/market.access.log`
- Each order settlement emits a `marketplace` log from the service
  (`sven-marketplace` logger) and posts a corresponding treasury
  transaction (visible in `/v1/admin/treasury/accounts/:id/transactions`).
