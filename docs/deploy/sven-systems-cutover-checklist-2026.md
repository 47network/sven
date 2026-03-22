# Sven.systems Cutover Checklist 2026

This document defines the exact public cutover from the current transitional deployment topology to the canonical Sven production host split:

- `sven.systems`
- `app.sven.systems`

Use this checklist when preparing the real public deployment. Keep GitHub-facing documentation on `example.com`.

---

## Target Contract

| Host | Role | Expected ownership |
|:--|:--|:--|
| `sven.systems` | static public host | landing, suite, installer scripts |
| `app.sven.systems` | runtime ingress | canvas, community, docs, admin, API, health |
| `admin.sven.systems` | optional redirect-only alias | only if you deliberately maintain an admin alias to `https://app.sven.systems/admin47` |

Do not collapse these roles unless you intentionally want a single-host deployment. The canonical public contract is split-host.

---

## DNS Cutover

Create or update these DNS records first:

| Record | Type | Target |
|:--|:--|:--|
| `sven.systems` | `A` / `AAAA` | public edge IP for the static host |
| `app.sven.systems` | `A` / `AAAA` | public edge IP for the runtime ingress |
| `admin.sven.systems` | `CNAME` or `A` / `AAAA` | optional alias to the runtime ingress |

Rules:

- keep TTL low during cutover, for example `300`
- do not repoint GitHub/release examples away from `example.com`
- if the same edge serves both hosts, separate them by `Host` rule, not by path ambiguity

---

## TLS Cutover

Issue certificates for:

- `sven.systems`
- `app.sven.systems`
- `admin.sven.systems` only if the alias is enabled

Validation requirements:

- the static host certificate must not be reused for the runtime host if SAN coverage is missing
- HSTS should only be enabled once both hosts are stable
- certificate automation must be in place before public announcement

---

## Ingress Ownership

### Static host: `sven.systems`

This host must serve only the public release surface:

- `/`
- `/suite`
- `/suite/*`
- `/install.sh`
- `/install.ps1`
- `/install.cmd`

This host should not own:

- `/community`
- `/docs`
- `/skills`
- `/marketplace`
- `/admin47`
- `/v1/*`

### Runtime host: `app.sven.systems`

This host must own:

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

### Transitional note

The current `47matrix.online` deployment still exposes some runtime paths on the static host during transition. That is acceptable only as a temporary bridge. Do not treat it as the final public contract.

---

## Suite Runtime-Link Requirement

The public suite must open runtime surfaces on `app.sven.systems`, not on `sven.systems`.

Accepted implementation patterns:

1. default `app.*` host split
2. explicit runtime-origin override in the suite page
3. validated transitional fallback logic during migration only

The suite is correct only if:

- community CTA opens `https://app.sven.systems/community`
- Admin Control Center opens `https://app.sven.systems/admin47`
- Canvas runtime opens `https://app.sven.systems/`

---

## Pre-Cutover Verification

Before flipping public DNS, verify the edge or internal ingress directly:

```bash
curl -I https://sven.systems/
curl -I https://sven.systems/suite
curl -I https://sven.systems/install.sh
curl -I https://app.sven.systems/
curl -I https://app.sven.systems/community
curl -I https://app.sven.systems/docs
curl -I https://app.sven.systems/admin47
curl -I https://app.sven.systems/readyz
```

Browser-level proof is also required:

- open `https://sven.systems/suite`
- verify the CTA and runtime-surface links target `app.sven.systems`
- verify suite evidence cards load
- open `https://app.sven.systems/community`
- open `https://app.sven.systems/docs`
- open `https://app.sven.systems/admin47`

---

## Release-Day Sequence

1. Lower DNS TTL ahead of time.
2. Deploy the final static host content to `sven.systems`.
3. Deploy the runtime ingress for `app.sven.systems`.
4. Verify TLS on both hosts.
5. Run the HTTP checks.
6. Run the browser suite-link verification.
7. Flip public announcement and release documentation references for operator docs only.
8. Leave GitHub-facing examples generic.

---

## Rollback

Rollback is required if any of these fail:

- suite points runtime links at the wrong host
- `app.sven.systems/readyz` is not reachable
- `app.sven.systems/admin47` is not gated correctly
- installer scripts on `sven.systems` stop serving plain text

Rollback actions:

1. restore previous DNS records
2. restore previous ingress config
3. re-check `sven.systems` and `app.sven.systems` certificate bindings
4. rerun the validation matrix before another cutover attempt

---

## Related Documents

- [public-web-surface-routing-2026.md](public-web-surface-routing-2026.md)
- [public-route-contract-and-auth-boundaries-2026.md](public-route-contract-and-auth-boundaries-2026.md)
- [github-release-install-guide-2026.md](github-release-install-guide-2026.md)
- [ingress-topologies.md](ingress-topologies.md)
