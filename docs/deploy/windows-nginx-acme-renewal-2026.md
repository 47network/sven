# Windows Nginx ACME Renewal 2026

This runbook defines the certificate renewal path for the live Windows nginx edge that serves:

- `sven.systems:44747`
- `app.sven.systems:44747`
- `admin.sven.systems:44747`

It uses Dockerized Certbot with HTTP-01 challenges on port `80`.

---

## Preconditions

- public DNS for all three hosts points at the edge IP
- WAN port `80` forwards to this machine
- nginx is already serving `/.well-known/acme-challenge/*` from:
  - `deploy/nginx/windows/acme-challenge`
- WAN port `44747` forwards to this machine for TLS traffic

---

## Runtime Paths

| Purpose | Path |
|:--|:--|
| nginx root | `deploy/nginx/windows` |
| ACME webroot | `deploy/nginx/windows/acme-challenge` |
| local certbot state | `deploy/nginx/windows/certbot` |
| live nginx cert target | `deploy/nginx/windows/certs/sven.systems` |

`deploy/nginx/windows/certbot` is local operational state and is ignored from git.

---

## Renewal Command

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ops/admin/renew-sven-systems-certs.ps1
```

What it does:

1. runs Dockerized Certbot against:
   - `sven.systems`
   - `app.sven.systems`
   - `admin.sven.systems`
2. keeps the current certificate if it is not close to expiry
3. copies the latest issued `fullchain` and `privkey` into:
   - `deploy/nginx/windows/certs/sven.systems`
4. restarts the repo-backed nginx edge

---

## Dry Run

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ops/admin/renew-sven-systems-certs.ps1 -DryRun
```

Use this before changing renewal automation or after edge/path adjustments.

---

## Validation

After renewal:

```powershell
curl.exe -k -I https://sven.systems:44747/
curl.exe -k -I https://sven.systems:44747/suite
curl.exe -k -I https://app.sven.systems:44747/readyz
curl.exe -k -I https://app.sven.systems:44747/community
curl.exe -k -I https://admin.sven.systems:44747/
```

Browser validation is also required:

- `https://sven.systems:44747/suite`
- verify suite runtime links target `https://app.sven.systems:44747`
- verify suite evidence cards still load

---

## Failure Modes

### HTTP-01 challenge fails

Check:

- public DNS still points to the edge IP
- port `80` is still forwarded to this machine
- nginx challenge path is still reachable publicly

### Cert issued but nginx still serves old host/cert

Check:

- files exist under `deploy/nginx/windows/certs/sven.systems`
- nginx restart succeeded
- the correct generated config is active

### Accidental repo contamination

Do not commit:

- `deploy/nginx/windows/certbot`
- `deploy/nginx/windows/certs`

These are ignored on purpose.

---

## Related Documents

- [sven-systems-cutover-checklist-2026.md](sven-systems-cutover-checklist-2026.md)
- [public-web-surface-routing-2026.md](public-web-surface-routing-2026.md)
