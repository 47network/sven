# ADR 003 — Server-Sent Events (SSE) for Streaming Chat Responses

**Date:** 2026-02-19  
**Status:** Accepted  
**Deciders:** Sven core team

---

## Context

Chat responses from large language models are generated token-by-token over several seconds. We need to display tokens to the user as they arrive rather than waiting for the full response.

Options considered:

| Option | Latency to first token | Complexity | Binary size |
|--------|----------------------|------------|-------------|
| **SSE (HTTP chunked, text/event-stream)** | Minimal | Low | Zero (standard `http` package) |
| WebSocket | Minimal | Medium | Adds `web_socket_channel` |
| GraphQL Subscriptions | Minimal | High | Adds `graphql_flutter` + schema |
| Long-polling | ~1–2 s per poll | Low | Zero |
| Full response (standard REST) | Full wait | Lowest | Zero |

The backend already exposes `POST /v1/chat/stream` that returns `text/event-stream`.

## Decision

**Use SSE via `http.Client` with a chunked-response reader** (`StreamedResponse.stream`).

The implementation in `ChatService._streamResponse()`:

1. Sends a `POST` with `Accept: text/event-stream`.
2. Reads `StreamedResponse.stream` as a `Stream<List<int>>`.
3. Decodes UTF-8, splits on `\n\n`, parses `data:` lines as JSON.
4. Emits `ChatMessageChunk` events to the UI's `StreamBuilder`.

Reconnect logic (Sprint 27): on network loss, backs off by connection type (WiFi=1s, Mobile=3s, Other=5s) and drains the offline queue on reconnect.

## Rationale

- SSE is a unidirectional server-push protocol — exactly what LLM streaming needs.
- Works over standard HTTP/1.1 and HTTP/2 without special infrastructure.
- No extra packages: `dart:async` + the existing `http` package handle it completely.
- Simpler than WebSockets (no upgrade handshake, no ping/pong, stateless reconnects).

## Consequences

**Positive:**

- Token-streaming with zero added dependencies.
- Reconnect is a simple HTTP re-request.
- Works through corporate HTTP proxies (unlike raw WebSockets sometimes).

**Negative:**

- SSE is server→client only; client input still POSTs via regular requests.
- HTTP/1.1 connection-per-stream may be a concern on platforms with connection limits.
  - Mitigated: we only open one SSE stream at a time (one active chat thread).
- Long-lived connections may be cut by some mobile OS aggressive battery savers.
  - Mitigated: the offline queue + reconnect logic in Sprint 27.

---

> See also: [ADR 001](001-no-state-management-framework.md), [ADR 002](002-memory-service-persistence.md)
