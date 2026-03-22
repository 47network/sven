# irc Channel Setup Guide

Date: 2026-02-21

## Scope

This guide covers baseline setup for services/adapter-irc.

## Prerequisites

- Sven core stack running (gateway-api, agent-runtime, nats, postgres).
- Channel credentials/tokens provisioned for irc.
- Secrets stored via env/config management (no plaintext in repo).

## Configuration

1. Configure channel credentials as environment variables or secret references.
2. Enable the channel adapter service in your deployment profile.
3. Ensure egress/network policy allows the irc platform endpoint.

## Bring-up

1. Start adapter-irc with the rest of services.
2. Confirm service health and logs show successful auth/registration.
3. Send a test inbound message and verify Sven response reaches the same channel.

## Validation Checklist

- Inbound message received by Sven.
- Outbound reply delivered by adapter.
- Retries/rate-limit behavior verified for transient failures.
- No secrets written to logs.

## References

- services/adapter-irc
- docs/ops/runbook-index-2026.md
- docs/developer/channel-adapter-development-guide.md
