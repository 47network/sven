# ADR 002 — MemoryService: SharedPreferences for Persistence

**Date:** 2026-02-19  
**Status:** Accepted  
**Deciders:** Sven core team

---

## Context

The app needs to persist:

- User facts (free-text list, ≤ ~200 items in practice)
- Custom instructions (≤ ~2 kB)
- Detected language (single string)
- Preferred language (single string)
- Memory-enabled flag (bool)
- Personality override (single string)
- Conversation summaries (one per thread, ≤ ~500 chars each)

Options considered:

| Option | Pros | Cons |
|--------|------|------|
| `SharedPreferences` | Zero setup, cross-platform, synchronous read after first load | Not a relational DB; not suited for large blobs |
| `drift` (SQLite) | Relational, queryable, typed | Code-gen, migration management, heavier setup |
| `isar` | Fast, NoSQL, no-SQL queries | Binary dependency, larger binary size |
| `hive` | Fast, NoSQL, simple API | Less maintained since Hive 2 deprecation |
| `flutter_secure_storage` | Encrypted | Slower, platform-specific backends; best for secrets only |

## Decision

**Use `SharedPreferences` for all MemoryService data.** Keys are namespaced under `sven.memory.*`.

Sensitive auth tokens use `flutter_secure_storage` separately (existing `AuthService`).

If the app adds a local message cache (offline browsing — ADR backlog), that will use `drift`, not SharedPreferences.

## Rationale

The memory data volume is small (< 50 kB total). `SharedPreferences` is:

- Available on all platforms (Android, iOS, macOS, Windows, Linux, web).
- Reads are synchronous after the first async `getInstance()` call — no latency in `buildSystemPrompt()`.
- No schema migrations required.
- Easily testable via `SharedPreferences.setMockInitialValues({})`.

## Consequences

**Positive:**

- Simple, well-tested Flutter primitive.
- Works identically in unit tests and on device.

**Negative:**

- Not encrypted at rest. If a user's device is compromised, memory facts are readable.
- Not suited for BLOBS; storing > 500 kB would be inadvisable.

**Mitigation:**

- Facts and instructions are non-secret personal preferences, not credentials.
- If we add an "encrypt memory" feature, we can migrate keys to `flutter_secure_storage` in a one-time migration in `_load()`.

---

> See also: [ADR 001](001-no-state-management-framework.md), [ADR 003](003-streaming-sse-api.md)
