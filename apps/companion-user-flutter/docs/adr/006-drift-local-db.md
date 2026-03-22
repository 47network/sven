# ADR 006 — Drift + SQLite for Local Chat Cache

**Date:** 2026-02-20  
**Status:** Accepted  
**Sprint:** 35  
**Deciders:** Sven engineering team

---

## Context

Sven had no persistent local storage for chat data.  Every time the user
opened the app all threads and message histories were re-fetched from the
gateway.  This caused three problems:

1. **Blank screen on bad connections** — the chat list showed a spinner
   until the first API response arrived.
2. **No offline browsing** — any network interruption (underground, airplane,
   weak signal) made past conversations completely inaccessible.
3. **Redundant network traffic** — messages the user already read were
   fetched again on every cold start.

A local SQLite database addressed all three.

---

## Decision

Use **[drift](https://drift.simonbinder.eu/) 2.31.0** (formerly Moor) with
**drift_flutter 0.2.7** as the Flutter-aware executor.

### Schema (v1)

```
db_chat_threads
  id TEXT PK
  title TEXT
  last_message TEXT
  updated_at INTEGER  (epoch ms)
  unread_count INTEGER
  type TEXT
  channel TEXT?
  message_count INTEGER
  is_pinned BOOL
  is_archived BOOL
  tag TEXT?

db_chat_messages
  id TEXT PK
  chat_id TEXT
  role TEXT
  content TEXT
  timestamp INTEGER  (epoch ms)
  status TEXT
  sender_name TEXT?
  content_type TEXT
  is_edited BOOL
```

### Architecture

```
ChatService  ──────────────────────────────┐
     │  network fetch success              │ write-through
     │                                     ▼
     │                             MessagesRepository
     │  network fetch failure              │
     └─────────────────────────────────────┘
              read from SQLite (offline fallback)
```

`MessagesRepository` is a thin adapter layer.  It:

- Converts `ChatThreadSummary` / `ChatMessage` (domain) ↔ `DbChatThread` /
  `DbChatMessage` (drift row types).
- Exposes simple `cacheThreads`, `cachedThreads`, `cacheMessages`,
  `cachedMessages`, `removeThread`, `removeMessages` methods.
- Never leaks drift types beyond its own package boundary.

`ChatService` now accepts `MessagesRepository?` as an optional constructor
argument.  When non-null:

- `listChats` → persists page 0 threads after each successful fetch; falls
  back to cached threads on any exception.
- `listMessages` → persists all fetched messages; falls back to cached
  messages on any exception.
- `sendMessage` → persists the returned assistant message.
- `deleteChat` → removes thread + its messages from the local DB.

`AppDatabase` and `MessagesRepository` are registered as **lazy singletons**
in the GetIt service locator (steps 0a and 0b, before the transport layer).

---

## Alternatives Considered

### isar

Isar is schema-code-free and very fast, but its query DSL deviates from
standard SQL, it requires native binaries for all platforms, and community
support is shrinking as the author moves focus to ObjectBox.  drift is
significantly better documented and battle-tested.

### Hive / SharedPreferences (manual JSON)

Already in use for user preferences.  Suitable for small key/value config but
not for relational chat data with arbitrary ordering and filtering.

### full drift code generation (drift_dev)

`drift_dev >=2.28.2` requires `build >=3.0.0` which conflicts with
`freezed >=2.2.0 <3.0.0` that pins `build ^2.3.1`.  Until the project
upgrades to freezed 3.x (or drift releases a version compatible with
build 2.x) `drift_dev` cannot be installed alongside `freezed`.

**Workaround:** `database.g.dart` is hand-authored and committed.  It
mirrors the output drift_dev would produce for schema v1 and must be kept
in sync manually if the schema changes.  A CI lint step (`grep
'GENERATED CODE'` on the file) ensures it is not accidentally wiped.

---

## Consequences

### Positive

- Chat list loads instantly from SQLite on cold start (zero network latency).
- Users can read any previously-fetched conversation with the phone in
  airplane mode.
- Reduced gateway load — first page of threads is only re-fetched when
  something changes (not on every resume).
- Foundation for full offline queue (Sprint 36 candidate): queued messages
  can be stored in a new `offline_queue` table and drained on reconnect.

### Negative / Risks

- +~2MB APK from sqlite3_flutter_libs native libs.
- `database.g.dart` must be manually updated for every schema migration.
- Schema migrations (drift `MigrationStrategy`) need to be written by hand
  when new columns or tables are added — no static analysis support without
  drift_dev.
- Thread cache is write-through on page 0 only; deeper pagination pages are
  additive upserts but old threads beyond the fetch window are not evicted.
  A future sprint should add a TTL-based eviction policy.

---

## Related ADRs

- [ADR 005](005-dio-getit-service-locator.md) — DioHttpClient + GetIt service
  locator (AppDatabase registered as step 0 in the same registry).
