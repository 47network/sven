# External Nginx + Internal Ingress Options

Use this doc only when an external Nginx already fronts your domains and handles certificates.
If not, use standalone Nginx setup:
- `docs/deploy/nginx-47matrix-domains.md`

Canonical host/route ownership lives in:

- `docs/deploy/public-web-surface-routing-2026.md`
- `docs/deploy/public-route-contract-and-auth-boundaries-2026.md`

This supports external-nginx deployments with two internal layouts for Sven:

## Option A: Edge Nginx -> Internal Nginx (recommended if your team is already Nginx-first)

- Edge Nginx: TLS termination + host routing for all your domains.
- Internal Nginx (Sven-specific): HTTP only, routes to Sven services.

Use:

- `config/nginx/sven-47matrix-behind-edge.conf`
- or Dockerized internal ingress:
  - `docker-compose.yml` service `sven-internal-nginx`
  - `config/nginx/sven-internal-ingress.docker.conf`

Recommended edge routes:

- `example.com` -> `http://<sven_host>:8088`
- `app.example.com` -> `http://<sven_host>:8088`

## Option B: External Nginx -> Internal Traefik (for label/dynamic routing workflows)

- Edge Nginx: TLS termination + host routing.
- Internal Traefik: HTTP only (`entryPoint web`) for Sven host/path routing.

Use:

- `config/traefik/sven-47matrix.dynamic.yml`

### Important

- Do not bind both internal Nginx and internal Traefik to the same internal port for the same routes.
- Choose one internal ingress per route group.

## External Nginx example snippet

```nginx
server {
  listen 443 ssl http2;
  server_name example.com;
  ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

  location / {
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_pass http://<SVEN_INTERNAL_IP>:8088; # internal nginx OR traefik entrypoint
  }
}

server {
  listen 443 ssl http2;
  server_name app.example.com;
  ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

  location / {
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_pass http://<SVEN_INTERNAL_IP>:8088; # internal nginx OR traefik entrypoint
  }
}
```

### 192.168.7.x example

If Sven host is `192.168.7.20` and internal ingress listens on `8088`:

```nginx
proxy_pass http://192.168.7.20:8088;
```

Apply that for both:

- `server_name example.com;`
- `server_name app.example.com;`

For the thin external pattern:

- both hosts proxy with `location /` to `http://<SVEN_INTERNAL_IP>:8088`
- internal ingress owns installers and all path routing

## Recommendation for your case

Given you already run a central edge Nginx and cert lifecycle there:

1. Keep certificates only at edge Nginx.
2. Run Sven behind it with internal Nginx first (`sven-47matrix-behind-edge.conf`).
3. Keep Traefik template available for future migration or service-specific dynamic routing.

Canonical external-nginx config split for this repo:

- `config/nginx/extnginx-sven-installers.conf`
- `config/nginx/extnginx-sven-app.conf`
