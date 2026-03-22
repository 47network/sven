# C8.1 47matrix Ingress Remediation Runbook

Date: 2026-02-22  
Scope: Resolve legal URL publication failures for:
- `https://app.example.com/privacy`
- `https://app.example.com/terms`

## Symptom signature

- DNS resolves both public hosts to `86.122.81.64`.
- TCP/HTTP/HTTPS probes from validator host and connected Android timeout.
- C8 legal checks fail with:
  - `legal_host_tcp_80_reachable`
  - `legal_host_tcp_443_reachable`
  - `privacy_url_http_2xx_or_3xx`
  - `terms_url_http_2xx_or_3xx`

## 1) Run diagnosis on the edge host itself

Run directly on the public edge machine:

```bash
cd /opt/sven/app
sh scripts/ops/sh/diagnose-47matrix-ingress.sh example.com app.example.com
```

Expected minimum:
- listeners on `:80` and `:443` (or upstream edge LB forwarding to those)
- nginx active
- no firewall drop for public ingress ports

## 2) Verify nginx listener config

Check that active nginx config includes:
- `listen 80;`
- `listen 443 ssl;` or `listen 443 ssl http2;`
- `server_name example.com app.example.com` (or split server blocks)

Repo references:
- `config/nginx/extnginx-sven-app.conf`
- `config/nginx/sven-47matrix.conf`
- `config/nginx/sven-47matrix-behind-edge.conf`

Validate and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx --no-pager
```

## 3) Verify network exposure

On edge host:

```bash
sudo ss -ltnp | egrep ':(80|443|8088)\b'
```

If firewall is enabled, allow ingress:

```bash
# ufw example
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status verbose

# nftables example (adapt to policy)
sudo nft list ruleset | sed -n '1,200p'
```

If behind cloud/VPS security groups, verify inbound rules include `80/tcp` and `443/tcp`.

## 4) Validate externally

From a separate host:

```bash
curl -I https://app.example.com/privacy
curl -I https://app.example.com/terms
curl -I https://app.example.com/readyz
```

Expected:
- `2xx` or `3xx` for legal URLs
- `200` for `/readyz` (or configured health success code)

## 5) Refresh project evidence and gates

From this repo workspace:

```bash
npm run ops:mobile:legal:ingress-evidence
npm run mobile:legal-urls:check
npm run ops:mobile:adb:legal-urls
npm run ops:mobile:c8:closeout
```

## Exit criteria

- `mobile-legal-urls-latest.json` status = `pass`
- `mobile-legal-urls-android-latest.json` status = `pass` (or independently explained if carrier/DNS path differs)
- C8.1 checklist items can be moved from `[~]` to `[x]`

