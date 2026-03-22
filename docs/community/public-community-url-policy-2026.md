# Sven Public Community URL Policy 2026

This document defines where the Sven public community surface belongs and how it should be documented.

---

## Canonical Public Community URL

In GitHub-facing release docs:

- `https://app.example.com/community`

In real deployment docs:

- `https://app.sven.systems/community`

The community surface belongs on the runtime host, not the static installer host.

---

## Why

The community surface is public, but it is still a live application surface:

- it serves request forms
- it exposes moderated status lookups
- it depends on live runtime APIs
- it is tied to policy and approval state

That makes it part of the application host, not the installer host.

---

## Public Policy Rule

The community surface may be public only if:

- participation is identity-gated or reviewable
- moderation posture is documented
- public status endpoints do not leak private user data
- legal pages and privacy controls are reachable from the same runtime domain

---

## Related Documents

- [../deploy/public-route-contract-and-auth-boundaries-2026.md](../deploy/public-route-contract-and-auth-boundaries-2026.md)
- [../deploy/public-web-surface-routing-2026.md](../deploy/public-web-surface-routing-2026.md)
- [../runbooks/community-public-launch-and-security.md](../runbooks/community-public-launch-and-security.md)
