# ADR 001 — No State-Management Framework

**Date:** 2026-02-19  
**Status:** Accepted  
**Deciders:** Sven core team

---

## Context

Flutter state management has a wide ecosystem: `riverpod`, `flutter_bloc`, `provider`, `get_it + get`, `mobx`, etc. Each adds a dependency, a learning curve, and a specific mental model.

The Sven companion app began as a rapid prototype with a single developer. The primary data flows are:

- `MemoryService` (user facts, instructions, language) — a single `ChangeNotifier`
- `AppState` (theme, color-blind mode, reduce-transparency) — a single `ChangeNotifier`
- `ChatService` (messages per thread) — async streams from SSE
- `AuthService` (user session) — simple `ValueNotifier<User?>`

All of these fit naturally into Flutter's built-in `ChangeNotifier` + `ListenableBuilder` / `AnimatedBuilder` pattern.

## Decision

**We will NOT adopt a third-party state-management framework.** Instead we use:

| Pattern | Use case |
|---------|----------|
| `ChangeNotifier` + `ListenableBuilder` | Service-layer state shared across the widget tree (Memory, AppState) |
| `StatefulWidget` + `setState` | Ephemeral widget-local state (animations, text fields, toggles) |
| `StreamBuilder` | SSE / real-time data from the API (chat messages) |
| `FutureBuilder` | One-shot async operations (load conversation list) |
| Service singletons injected via constructor | Dependency injection (no `get_it` needed at this scale) |

## Consequences

**Positive:**

- Zero extra dependencies.
- No boilerplate code-gen or build-runner steps.
- Any Flutter developer with standard knowledge can read the code.
- Easier to unit-test: services are plain Dart classes.

**Negative:**

- As the app grows, deep widget trees may require passing services down many layers or switching to `InheritedWidget` providers.
- No built-in code-gen for immutable state snapshots (mitigated by using `copyWith` patterns manually).

**Mitigation / Revisit trigger:** If a feature requires >3 levels of prop-drilling for a service, or if we add a second developer unfamiliar with the current structure, revisit `riverpod` which requires minimal boilerplate.

---

> See also: [ADR 002](002-memory-service-persistence.md), [ADR 003](003-streaming-sse-api.md)
