# Runtime Security Baseline

Minimum patched Node: 20.19.5
Current repo engine line: 20.x

## Patch Policy

- Runtime nodes must be patched to the latest stable patch release in the declared engine line.
- Security patch cadence: weekly review, emergency patch within 24h for high/critical advisories.
- Base container images are rebuilt on every security patch uplift and re-signed in release CI.

## Node 22 Uplift Plan

- Track dependency compatibility for Node 22 in CI canary jobs.
- Keep Node 20.x production baseline until canary + parity suites are stable on Node 22.
- Promote Node 22 only after strict parity, release, and soak gates remain green across two consecutive runs.

## CVE Rationale

- CVE-2024-22017
- CVE-2024-36138
- CVE-2025-23084

Baseline rationale:

- These CVEs and related Node runtime advisories require explicit patch-floor governance for production deployments.
- Sven enforces runtime patch governance through artifact-backed checks and release gating.

## Compensating Controls (Node 20.x)

- Non-root containers, signed images, and provenance-bound CI gates.
- Strict policy engine defaults (deny by default for guarded tool scopes).
- Runtime audit chain and traceability artifacts for privileged execution paths.
- Network egress controls and explicit allowlists for tool execution surfaces.
