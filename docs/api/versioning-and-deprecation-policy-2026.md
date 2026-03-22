# API Versioning and Deprecation Policy (2026)

Date: 2026-02-22  
Owner: API Platform

## Versioning Strategy

1. URL-major versioning is mandatory.
- Current stable surface: `/v1/*`
- Next breaking major surface: `/v2/*`

2. OpenAPI must declare an `info.version` aligned to the released API contract.
- Canonical spec location: `docs/api/openapi.yaml`

3. Contract metadata header remains required on responses:
- `x-sven-contract-version`

## Breaking Change Policy

1. Breaking changes are allowed only in a new major URL version (`/v2`), never silently inside `/v1`.
2. Non-breaking changes (additive fields/endpoints) may ship in the same major version.
3. Each breaking release must include:
- migration notes
- compatibility impact summary
- rollout plan and rollback path

## Deprecation Policy

1. Minimum deprecation window: 90 days before removal.
2. Deprecation notice must include:
- affected endpoint/path
- replacement endpoint/path
- deprecation start date
- planned removal date (>= 90 days later)

3. Deprecation notice channels:
- release notes
- API docs changelog
- operational notice in admin/release evidence
