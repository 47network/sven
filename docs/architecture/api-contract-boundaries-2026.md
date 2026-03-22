# API Contract Boundaries (2026)

Date: 2026-02-13

## Contract Metadata

- Version: `2026-02-13.v1`
- Response header: `x-sven-contract-version`
- Public endpoint: `GET /v1/contracts/version`

## Client -> API Domains

1. Chat domain
- Send/read messages and timeline events.
- Streaming and completion status semantics.

2. Auth domain
- Device flow start/poll.
- Session introspection and logout/revocation.

3. Approvals domain
- Pending approvals list.
- Approve/deny actions.

4. Admin domain
- User/chat/channel management.
- Governance/policy/model controls.
- Operational stats and incidents.

5. System health domain
- Health/readiness endpoints.
- Basic service status for client gating.

## Source of Route Truth

- Admin route source: `services/gateway-api/src/routes/admin/`
- Auth/chat/approvals APIs consumed by companion apps.

## Contract Rules

- Backward-compatible additive changes only in minor releases.
- Breaking response schema changes require versioned endpoint or explicit migration window.
- Error envelope shape must be stable across clients.
- Idempotent write actions where retries are expected (network/mobile scenarios).

## Required Test Coverage

- Contract test per critical domain:
- Chat send/read
- Device auth start/poll
- Approvals list/vote
- Key admin write paths
- Health/readiness checks

## Current Gaps To Close

- Generate typed client contracts from API schemas and consume in all clients.
- Add explicit schema version markers for high-risk admin endpoints.
