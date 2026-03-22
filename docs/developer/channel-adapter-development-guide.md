# Channel Adapter Development Guide

Date: 2026-02-21

## Overview

Channel adapters connect Sven to external messaging surfaces (for example Discord, Telegram, WhatsApp, Matrix). Adapters should normalize inbound events and emit outbound delivery with consistent contracts.

## Responsibilities

- map external platform events into Sven message envelopes
- enforce authentication/verification for webhooks or bot events
- handle retries and idempotency for outbound sends
- emit structured logs and metrics for delivery outcomes

## Development Workflow

1. Identify the existing adapter package under `services/` and copy its structure.
2. Implement inbound handler:
   - validate platform signatures/tokens
   - normalize user/channel identifiers
   - forward messages to gateway/runtime contracts
3. Implement outbound sender:
   - map Sven messages to platform-specific payloads
   - handle rate limits and transient failures
4. Add config wiring for tokens, endpoints, and feature flags.

## Testing Guidance

- Unit test event normalization and payload mapping.
- Integration test happy path plus auth/rate-limit failure paths.
- Add smoke validation in release evidence for end-to-end round trip.

## Operational Requirements

- No secrets in code or logs.
- Backoff and retry must avoid duplicate user-visible sends.
- Adapter failures must not crash gateway process.

## Related Docs

- `docs/api/openapi.yaml`
- `docs/ops/runbook-index-2026.md`
- `docs/release/checklists/sven-production-parity-checklist-2026.md`
