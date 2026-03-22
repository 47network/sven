# Host-Specific Archived Latest Artifacts

This folder holds generated `latest` status files that were valid for older host contracts or transitional runtime hosts.

Rules:
- keep top-level `docs/release/status/` for canonical active `latest` artifacts
- move host-specific or deprecated-host `latest` snapshots here instead of hand-editing them
- preserve them for audit history, but do not treat them as current operator truth

Current canonical hosts:
- static: `https://sven.systems:44747`
- runtime: `https://app.sven.systems:44747`
