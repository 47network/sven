# Sven Public Route Contract And Auth Boundaries 2026

This is the canonical route-boundary document for Sven public surfaces.

It answers:

- which host owns which route
- which routes are public
- which routes are auth-gated
- which service is expected to serve them

---

## Canonical Release Hostnames

GitHub-facing docs use:

- `example.com`
- `app.example.com`

Deployment-specific docs may substitute real hostnames such as `sven.systems` and `app.sven.systems`.

---

## Route Matrix

| Host | Route | Public or gated | Owner | Notes |
|:--|:--|:--|:--|:--|
| `example.com` | `/` | public | static release host | landing + install entry |
| `example.com` | `/suite` | public | static release host | suite home |
| `example.com` | `/suite/*` | public | static release host | platform/features/security/docs/enterprise/roadmap |
| `example.com` | `/install.sh` | public | static release host | Unix installer |
| `example.com` | `/install.ps1` | public | static release host | PowerShell installer |
| `example.com` | `/install.cmd` | public | static release host | CMD installer |
| `app.example.com` | `/` | gated by runtime session | canvas runtime | main user surface |
| `app.example.com` | `/login` | public | canvas runtime | auth entry |
| `app.example.com` | `/community` | public | canvas runtime | verified community surface |
| `app.example.com` | `/docs` | public | canvas runtime | public docs landing |
| `app.example.com` | `/skills` | public | canvas runtime | public discovery surface |
| `app.example.com` | `/marketplace` | public | canvas runtime | public discovery surface |
| `app.example.com` | `/privacy` | public | canvas runtime | legal page |
| `app.example.com` | `/terms` | public | canvas runtime | legal page |
| `app.example.com` | `/shared/*` | public by token | canvas runtime | controlled shared transcript/artifact surface |
| `app.example.com` | `/admin47` | gated | admin runtime | operator/admin surface |
| `app.example.com` | `/v1/public/community/*` | public | gateway-api | public community evidence endpoints |
| `app.example.com` | `/v1/*` | gated unless explicitly public | gateway-api | API contract |
| `app.example.com` | `/healthz` | public | gateway-api | liveness |
| `app.example.com` | `/readyz` | public | gateway-api | readiness |

---

## Auth Boundary Rule

Three categories exist:

### Public static

- installer host root
- suite pages
- installer scripts

### Public runtime

- `/login`
- `/community`
- `/docs`
- `/skills`
- `/marketplace`
- `/privacy`
- `/terms`
- token-scoped `/shared/*`
- public community API endpoints

### Auth-gated runtime

- canvas root and authenticated user flows
- `/admin47`
- non-public `/v1/*`

---

## Reverse Proxy Rule

Reverse proxies may differ. Route ownership must stay stable.

Examples:

- Nginx
- Caddy
- Traefik
- external edge proxy + internal app proxy

The proxy family is not the contract. The route matrix is.

---

## Release Validation

A release-facing ingress setup is only considered correct if:

- `https://example.com/` serves the landing surface
- `https://example.com/suite` serves the suite
- `https://example.com/install.sh` serves the installer
- `https://app.example.com/community` is public
- `https://app.example.com/docs` is public
- `https://app.example.com/admin47` is gated
- `https://app.example.com/readyz` is reachable

---

## Related Documents

- [public-web-surface-routing-2026.md](public-web-surface-routing-2026.md)
- [ingress-topologies.md](ingress-topologies.md)
- [quickstart-installers.md](quickstart-installers.md)
