# ADR 005 — Dio + get_it for HTTP transport and dependency injection

**Date:** 2026-02-19  
**Status:** Accepted  
**Decided by:** engineering team  

---

## Context

The app used `package:http` (raw `http.Client`) throughout all services.  This worked for
the early sprints but left several gaps:

- **No retry logic.** Transient network failures (connection refused, 503) surfaced as
  errors to the user with no automatic recovery.
- **No request/response logging.** Debugging production network issues required adb log
  filtering with no structured output.
- **SSE streaming and regular requests used the same code path**, making it hard to
  tune timeouts independently.
- **Services were constructed ad-hoc** (`final _auth = AuthService()`) inside widget
  state classes, making them hard to replace in tests or swap at runtime.

---

## Decision

### 1. `dio` as the inner HTTP transport

Introduce `DioHttpClient` (`lib/app/dio_http_client.dart`), a `http.BaseClient` subclass
backed by Dio.  All existing callers of `AuthenticatedClient` continue to work unchanged
because `DioHttpClient` is a drop-in replacement for `http.Client`.

`DioHttpClient` provides:

| Feature | Detail |
|---------|--------|
| Auto-retry | `_RetryInterceptor` — 3 attempts, 1 s / 2 s / 4 s exponential back-off on connection errors and 502 / 503 / 504 responses |
| Debug logging | `_DebugLogInterceptor` — prints method, path, status code to `debugPrint`; compiled out in release mode |
| SSE awareness | `Accept: text/event-stream` requests use `ResponseType.stream` (unbuffered, no receive timeout); all other requests use `ResponseType.bytes` |
| Standard interface | Extends `http.BaseClient` so it is a drop-in for `http.Client` with zero caller changes |

Auth header injection remains in `AuthenticatedClient` as before.

### 2. `get_it` as the service locator

Introduce `service_locator.dart` (`lib/app/service_locator.dart`).

- `sl` is the global `GetIt` instance.
- `setupServiceLocator()` is called in `main()` before Firebase / Sentry init.
- All registrations are **lazy singletons** — objects are only created on first access.
- `resetServiceLocator()` is provided for tests.
- Services registered: `DioHttpClient`, `TokenStore`, `AuthService`,
  `AuthenticatedClient`, `FeatureFlagService`, `MemoryService`, `VoiceService`.

Existing service construction in `SvenUserApp._SvenUserAppState` is left unchanged for
now and will migrate to `sl<T>()` in a future sprint.

---

## Alternatives considered

| Option | Reason rejected |
|--------|----------------|
| Keep `http` + `retry` package | Already had `retry: ^3.1.2` but it was unused. Does not solve logging or SSE nuances. |
| Replace `http` entirely with `dio` | Would require rewriting `AuthenticatedClient` and all call sites. High risk, low marginal benefit over wrapper approach. |
| `riverpod` instead of `get_it` | Riverpod is the right long-term choice but requires adopting `ConsumerWidget` everywhere. Too invasive for a single sprint. `get_it` is the stepping-stone. |
| `provider` / `InheritedWidget` | Already using `ChangeNotifier` + `ListenableBuilder` which is essentially this. Does not solve the construction / singleton problem. |

---

## Consequences

**Positive:**
- All HTTP calls now retry automatically on transient failures.
- Network activity is visible in debug console without additional tooling.
- Foundation for full DI migration to `get_it` + `riverpod` in a future sprint.
- `resetServiceLocator()` makes integration tests cleaner.

**Negative / risks:**
- `DioHttpClient` adds ~30 KB to the APK (`dio` transitive dependencies).
- Two HTTP stacks (`http` interface + `dio` implementation) in the codebase until
  migration is complete.  Mitigation: the wrapper pattern keeps the surface small.
- `get_it` singleton state survives hot-restart in development; call
  `resetServiceLocator()` in tests to avoid state leakage.
