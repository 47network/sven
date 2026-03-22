# Sven Public Legal Pages And Data Rights 2026

This document ties Sven public legal pages to runtime routes and user rights.

---

## Canonical Public Legal Routes

In GitHub-facing release docs:

- `https://app.example.com/privacy`
- `https://app.example.com/terms`

In real deployment docs:

- `https://app.sven.systems/privacy`
- `https://app.sven.systems/terms`

These routes belong on the runtime host.

---

## Why These Routes Matter

Sven exposes public and semi-public runtime surfaces:

- community
- docs
- skills and marketplace discovery
- token-scoped shared pages

That means legal and privacy surfaces must be reachable from the same runtime domain users actually interact with.

---

## Minimum Data Rights Expectations

Public-facing documentation should make these expectations clear:

- what telemetry is collected
- what is local-only
- how a user requests export or deletion
- which routes are public vs authenticated
- which public endpoints are evidence-only

---

## Related Documents

- [telemetry-and-user-controls-2026.md](telemetry-and-user-controls-2026.md)
- [../deploy/public-route-contract-and-auth-boundaries-2026.md](../deploy/public-route-contract-and-auth-boundaries-2026.md)
- [../community/public-community-url-policy-2026.md](../community/public-community-url-policy-2026.md)
