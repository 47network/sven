# Sven Public Web Surface Routing 2026

This document defines the public release-facing web surface for Sven.

It exists to keep the release suite, install docs, ingress docs, and shipped reverse-proxy configs aligned.

---

## Canonical Audience Split

Two documentation modes are intentional:

### Public release / GitHub docs

Use generic hostnames:

- `example.com`
- `app.example.com`

These are examples only. They describe the release shape, not a specific live deployment.

### Operator / deployment docs

Use real deployment hostnames:

- `sven.systems`
- `app.sven.systems`
- `admin.sven.systems` only if an operator deliberately separates admin onto a dedicated host

Concrete `47matrix.online` and `glyph` files in this repo are deployment examples, not the public release contract.

---

## Canonical Public Host Split

The public release model is a split-host topology:

| Host | Ownership | Primary purpose |
|:--|:--|:--|
| `example.com` | static public surface | release landing, installer entrypoints, suite |
| `app.example.com` | Sven runtime ingress | canvas runtime, public app routes, admin, API |

This is the contract that GitHub-facing docs should describe by default.

---

## Route Ownership

### Static public host: `example.com`

These routes belong on the static landing host:

- `/`
- `/suite`
- `/suite/platform`
- `/suite/features`
- `/suite/security`
- `/suite/docs`
- `/suite/enterprise`
- `/suite/roadmap`
- `/install.sh`
- `/install.ps1`
- `/install.cmd`

This host is allowed to be thin and static.

### Runtime host: `app.example.com`

These routes belong on the runtime ingress:

- `/`
- `/login`
- `/community`
- `/docs`
- `/skills`
- `/marketplace`
- `/privacy`
- `/terms`
- `/shared/*`
- `/admin47`
- `/v1/*`
- `/healthz`
- `/readyz`

---

## Why This Split Exists

The static host and runtime host do different jobs:

- the static host is safe to expose as a release landing surface
- the runtime host carries live application logic, auth, API traffic, and operator surfaces

This prevents the release website from being coupled to the application root.

---

## Nginx / Caddy / Traefik Rule

All ingress runbooks should preserve the same ownership model:

- `example.com` serves the static release surface
- `app.example.com` serves Sven runtime paths

Proxy family choice can change. Route ownership should not.

---

## Quick Validation

```bash
curl -I https://example.com/
curl -I https://example.com/suite
curl -I https://example.com/install.sh
curl -I https://app.example.com/
curl -I https://app.example.com/community
curl -I https://app.example.com/docs
curl -I https://app.example.com/admin47
curl -I https://app.example.com/readyz
```

---

## Related Documents

- [public-route-contract-and-auth-boundaries-2026.md](public-route-contract-and-auth-boundaries-2026.md)
- [sven-systems-cutover-checklist-2026.md](sven-systems-cutover-checklist-2026.md)
- [quickstart-installers.md](quickstart-installers.md)
- [github-release-install-guide-2026.md](github-release-install-guide-2026.md)
- [ingress-topologies.md](ingress-topologies.md)
