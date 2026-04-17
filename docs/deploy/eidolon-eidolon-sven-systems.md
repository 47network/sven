# eidolon.sven.systems — Agent City Edge Configuration

Premium 3D live view of Sven's autonomous economy: buildings for services,
listings and revenue pipelines; citizens for working agents; an event ticker
driven by NATS. Read-only surface over the treasury, marketplace, and
infra-manager. This document covers DNS, edge nginx, TLS and upstream
processes.

## 1. DNS

In the `sven.systems` zone (Cloudflare):

```
A   eidolon   -> <PUBLIC_SERVER_IPV4>
AAAA eidolon  -> <PUBLIC_SERVER_IPV6>   # optional
```

Keep DNS-only (orange cloud OFF) while validating TLS the first time. Leave it
DNS-only permanently if you need SSE to pass through without Cloudflare
buffering/long-idle disconnects.

## 2. Nginx site

Install the template:

```bash
sudo cp config/nginx/extnginx-sven-eidolon.conf /etc/nginx/sites-available/eidolon.sven.systems.conf
sudo ln -s /etc/nginx/sites-available/eidolon.sven.systems.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Requires the shared rate-limit zones from `config/nginx/extnginx-rate-limit-policy.conf`
(`sven_global_per_ip`, `sven_conn_per_ip`). Include that policy file in the
`http{}` context once per nginx install.

The `/v1/eidolon/events` location is configured for long-lived SSE streams:
`proxy_buffering off`, `chunked_transfer_encoding off` and 24 h read/send
timeouts. Do **not** duplicate those directives on the catch-all `/` block.

## 3. TLS

```bash
sudo certbot --nginx -d eidolon.sven.systems
```

The template already references
`/etc/nginx/ssl/eidolon.sven.systems/{fullchain.cer,private.key}` — either
point certbot at that path or adjust the template to match your ACME layout.

## 4. Upstream processes

| Port  | Process                                | Command                                       |
|-------|----------------------------------------|-----------------------------------------------|
| 3311  | `apps/eidolon-ui` (Next.js)             | `pnpm --filter @sven/eidolon-ui start`        |
| 9479  | `services/sven-eidolon` (Fastify + SSE) | `pnpm --filter @sven/sven-eidolon start`      |

Run both under PM2 alongside the rest of the Sven stack. Example PM2 entries:

```js
{
  name: 'sven-eidolon',
  cwd: '/opt/sven/services/sven-eidolon',
  script: 'dist/index.js',
  env: {
    EIDOLON_PORT: 9479,
    DATABASE_URL: 'postgresql://sven:***@127.0.0.1/sven',
    NATS_URL: 'nats://127.0.0.1:4222', // optional; service degrades gracefully
  },
},
{
  name: 'eidolon-ui',
  cwd: '/opt/sven/apps/eidolon-ui',
  script: 'node_modules/next/dist/bin/next',
  args: 'start --port 3311',
  env: { NEXT_PUBLIC_EIDOLON_API: 'https://eidolon.sven.systems' },
}
```

## 5. Routes exposed

| Path                       | Upstream | Purpose                                                    |
|----------------------------|----------|------------------------------------------------------------|
| `/`                        | :3311    | 3D city (Next.js + react-three-fiber)                      |
| `/v1/eidolon/snapshot`     | :9479    | JSON snapshot: buildings, citizens, treasury, infra        |
| `/v1/eidolon/events`       | :9479    | Server-Sent Events stream of live agent/economy events     |

The service is strictly **read-only**. It aggregates state from existing
Sven tables (`marketplace_listings`, `revenue_service_endpoints`,
`infra_nodes`, `treasury_accounts`) and forwards a whitelisted subset of NATS
subjects through the SSE fan-out. No mutation endpoints are exposed at the
edge.

## 6. Security posture (Batch 3)

- All traffic TLS 1.2/1.3 only, HSTS preload, strict COOP/CORP, no referrer
  leakage.
- Rate-limited via `sven_global_per_ip` (30 r/s, burst 120 for `/`, burst 60
  for the JSON API, burst 30 for SSE).
- `orgId` values from clients are validated server-side (regex
  `^[a-zA-Z0-9_-]{1,64}$`).
- The event bus sanitises NATS payloads before fan-out: scalar-only, 12 keys
  max, 80-char truncation, key-name regex. No secrets leak into the city feed.
- NATS subjects are allow-listed in `services/sven-eidolon/src/event-bus.ts`;
  only eight subjects translate into UI events.

## 7. Observability

- Access log: `/var/log/nginx/eidolon.access.log`
- Heartbeats every 15 s on `/v1/eidolon/events` keep intermediaries from
  dropping idle streams and provide a cheap liveness check.
- The health endpoint is `GET /health` on port 9479 (internal only).
