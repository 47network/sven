# C2.3 Docker Digest Pinning Baseline (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Requirement

Docker base images pinned to immutable digest (`@sha256:...`), no floating tags.

## Audit Summary

Current status: **not yet compliant**.

Findings from local scan:

- Service Dockerfiles use tag pins (example: `FROM node:20-slim`) rather than digests.
- Compose uses floating `latest` tags in at least:
  - `ubuntu/squid:latest`
  - `cloudflare/cloudflared:latest`

## Conclusion

Row remains in progress until all Docker `FROM` and compose `image:` entries are migrated to digest-pinned references and revalidated.

## 2026-02-22 Local Strict Gate Added

Implemented local digest-pinning gate script:

- `scripts/container-digest-pinning-check.cjs`
- npm command: `npm run release:container:digest-pinning:check`

Latest strict output:

- Status: **fail**
- Totals: `references=49`, `pinned=0`, `unpinned=49`, `latest_tag=7`
- Artifacts:
  - `docs/release/status/security-docker-digest-pinning-latest.json`
  - `docs/release/status/security-docker-digest-pinning-latest.md`

This makes C2.3 digest-pinning progress measurable and repeatable locally while migration to `@sha256` references is executed.

## 2026-02-22 Remediation Complete

Applied digest pinning across:

- `docker-compose.yml` runtime `image:` entries (including all previous `:latest` usages)
- All repository Dockerfile `FROM` base-image references used by services

Pinned base digests used:

- `node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687` (`node:20-slim`)
- `node@sha256:be08b7dfa11af5daa0757d12160117e02587f28a746f4cbffe20b46896e50608` (`node:20-bullseye-slim`)
- `node@sha256:09e2b3d9726018aecf269bd35325f46bf75046a643a66d28360ec71132750ec8` (`node:20-alpine`)
- `python@sha256:0b23cfb7425d065008b778022a17b1551c82f8b4866ee5a7a200084b7e2eafbf` (`python:3.11-slim`)

Validation:

- `node scripts/container-digest-pinning-check.cjs --strict` -> **pass**
- Latest totals:
  - `references=49`
  - `pinned=49`
  - `unpinned=0`
  - `latest_tag=0`

Artifacts:

- `docs/release/status/security-docker-digest-pinning-latest.json`
- `docs/release/status/security-docker-digest-pinning-latest.md`
