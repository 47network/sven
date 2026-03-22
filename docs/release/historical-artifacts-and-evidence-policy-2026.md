# Sven Historical Artifacts And Evidence Policy 2026

This document defines how to interpret generated evidence, archived posts, and historical release artifacts in this repository.

---

## Why This Policy Exists

Sven keeps both:

- canonical current-facing documentation
- generated historical evidence and archived verification output

Those serve different purposes.

Historical artifacts may preserve earlier assumptions about:

- hostnames
- route placement
- rollout shape
- temporary validation environments

They should not override the current release/deployment contract.

---

## Source-Of-Truth Order

When documents disagree, treat them in this order:

1. current contract docs:
   - [../deploy/public-web-surface-routing-2026.md](../deploy/public-web-surface-routing-2026.md)
   - [../deploy/public-route-contract-and-auth-boundaries-2026.md](../deploy/public-route-contract-and-auth-boundaries-2026.md)
   - [../deploy/setup-paths-matrix-2026.md](../deploy/setup-paths-matrix-2026.md)
2. current deployment runbooks
3. current status dashboards in `docs/release/status/`
4. historical evidence in `docs/release/evidence/`
5. archived/generated community posts in `docs/community/posts/`

---

## Rules

- historical evidence is preserved for auditability
- historical evidence may contain stale URLs or topology notes
- historical evidence should not be treated as the current operator contract
- generated “latest” artifacts are evidence outputs, not replacement runbooks
- archived generated status files should live under `docs/release/status/archive/`, not beside canonical active dashboards

---

## Directory Guidance

### `docs/release/evidence/`

Use this for:

- dated proof artifacts
- investigative notes
- benchmark captures
- temporary remediation evidence

Do not treat it as the first-stop operator guide.

### `docs/release/status/`

Use this for:

- active generated dashboards
- current `latest` release gates
- current runtime or soak state inputs consumed by automation

Top-level `status/` should stay as the current working dashboard surface.

### `docs/release/status/archive/`

Use this for:

- superseded `latest` outputs
- old host-contract snapshots
- transitional generated artifacts kept only for audit history

### `docs/community/posts/`

Use this for:

- generated community verification summaries
- published doc-agent posts
- timeline/audit history

Do not treat it as the canonical public URL contract.

---

## Related Documents

- [../deploy/public-web-surface-routing-2026.md](../deploy/public-web-surface-routing-2026.md)
- [../deploy/public-route-contract-and-auth-boundaries-2026.md](../deploy/public-route-contract-and-auth-boundaries-2026.md)
- [../community/public-community-url-policy-2026.md](../community/public-community-url-policy-2026.md)
