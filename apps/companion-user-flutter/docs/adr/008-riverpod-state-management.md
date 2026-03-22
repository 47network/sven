# ADR 008 — Riverpod as State Management Layer

**Date:** 2026-02-20  
**Status:** Accepted  
**Supersedes:** [ADR 001 — No State Management Framework](001-no-state-management-framework.md)

---

## Context

ADR 001 (Sprint ~1) deferred adopting a state management framework because the app was small, all state could be held in one `AppState extends ChangeNotifier`, and adding a framework prematurely would add ceremony without benefit.

By Sprint 40 the picture has changed:

| Factor | Then | Now |
|--------|------|-----|
| Dart files | ~10 | ~69 |
| LOC | ~2 000 | ~17 000+ |
| Services holding mutable state | 1 (`AppState`) | 6+ (`MemoryService`, `AppLockService`, `ProjectService`, `TutorialService`, `VoiceService`, …) |
| Widget test count | 0 | 81 |
| Dependency injection | manual ctor params | `get_it` (Sprint 32) |
| Constructor drilling depth | 2 | 4–6 levels |

Services are currently passed as 4–6 level constructor chains (e.g. `_AppShell` → `_ChatPanelSection` → route builder → page → sub-widget).  There is no way to access `MemoryService` from a deeply-nested widget without threads of constructor params.

A reactive layer is now justified.

---

## Decision

Adopt **`flutter_riverpod 2.6.1`** as the state-management / DI layer.

`flutter_bloc` was considered but rejected:

- **Bloc** requires creating `Bloc`/`Cubit` wrappers around every existing `ChangeNotifier` service — ~6 new files minimum before any widget benefits.  The existing services are well-tested and correct; their internal logic does not need to change.
- **Riverpod** provides `ChangeNotifierProvider<T>` which wraps any existing `ChangeNotifier` service with zero migration effort.  Services stay as-is; the provider is a thin adapter.
- Riverpod's compile-time safety, `ref.watch`/`ref.read` discipline, and testability are all superior to raw provider_package `ChangeNotifierProvider`.
- Riverpod coexists cleanly with `get_it` (used for pure-service singletons) — see Bridge Providers below.

---

## Architecture

### Provider graph

```
main.dart
  └─ ProviderScope (root — no overrides)
       └─ SvenUserApp (ConsumerStatefulWidget)
            └─ ProviderScope (inner — overrides instance-owned services)
                 overrides:
                   appStateProvider      → _state       (AppState)
                   memoryServiceProvider → _memoryService (MemoryService)
                   appLockServiceProvider→ _lockService   (AppLockService)
                   projectServiceProvider→ _projectService (ProjectService)
                   tutorialServiceProvider→_tutorialService(TutorialService)
                   voiceServiceProvider  → _voiceService  (VoiceService)
                 └─ MaterialApp.router / all pages
```

### Why two nested ProviderScopes?

The services listed above are created inside `_SvenUserAppState.initState()`, not at `main()` time.  A root `ProviderScope` is required for `ProviderContainer` to exist; the inner `ProviderScope` overrides the providers with the already-created instances.  This is an idiomatic Riverpod 2.x pattern for dependency injection of lifecycle-owned objects.

### Bridge providers (get_it → Riverpod)

Services already registered in `setupServiceLocator()` are exposed via plain `Provider<T>` that calls `sl<T>()`:

```dart
final authServiceProvider    = Provider<AuthService>((ref) => sl<AuthService>());
final messagesRepositoryProvider = Provider<MessagesRepository>((ref) => sl<MessagesRepository>());
final featureFlagServiceProvider = Provider<FeatureFlagService>((ref) => FeatureFlagService.instance);
```

These do not need overrides — they pull the well-known singleton on first access.

---

## Migration strategy (incremental, non-breaking)

| Stage | Sprint | Scope |
|-------|--------|-------|
| 1 — Infrastructure | 40 (this ADR) | `ProviderScope`, `providers.dart`, `SvenUserApp` → `ConsumerStatefulWidget`, `MemoryPage` → `ConsumerStatefulWidget` (demo) |
| 2 — Chat pages | future | `ChatThreadPage`, `ChatHomePage` → `ConsumerStatefulWidget`; pass services via `ref` not ctor |
| 3 — Settings pages | future | `PrivacyPage`, `_LanguageTile`, etc. |
| 4 — App-level refactor | future | Remove constructor drilling from `_AppShell`; retire get_it for ChangeNotifier services |
| 5 — Full get_it retirement | future | All singletons as `Provider`/`AsyncNotifier`; remove `service_locator.dart` |

The migration is strictly additive at each stage.  No existing tests are broken; each stage increases test coverage.

---

## Consequences

**Positive**

- Deep widgets can call `ref.watch(memoryServiceProvider)` or `ref.read(authServiceProvider)` with no prop drilling.
- `ProviderScope` in tests can override any provider with a fake instance — better isolation than `resetServiceLocator()`.
- `ref.watch` on a `ChangeNotifierProvider` automatically triggers rebuilds; `ListenableBuilder` boilerplate is removed.
- `flutter_riverpod` is well-maintained (pub.dev top-500, Google-backed contributor ecosystem).

**Negative / Trade-offs**

- Every widget using a provider must extend `ConsumerWidget`/`ConsumerStatefulWidget` or use `Consumer` — a mechanical but mandatory change.
- Two nested `ProviderScope`s is slightly unusual; future stage 4 will collapse them by moving service creation to providers.
- Package adds ~0.0 MB to APK (tree-shaken; verified: APK stays at 33.2 MB).

---

## Files changed (Sprint 40)

| File | Change |
|------|--------|
| `pubspec.yaml` | `flutter_riverpod: ^2.6.1` |
| `lib/app/providers.dart` | NEW — all provider definitions |
| `lib/main.dart` | `runApp(ProviderScope(child: SentryWidget(...)))` |
| `lib/app/sven_user_app.dart` | `SvenUserApp` → `ConsumerStatefulWidget`; inner `ProviderScope` with overrides in `build()` |
| `lib/features/memory/memory_page.dart` | `MemoryPage` → `ConsumerStatefulWidget`; `ref.watch(memoryServiceProvider)` replaces `ListenableBuilder` + ctor param |
| `test/widget_screen_test.dart` | `_wrapMemoryPage` helper using `ProviderScope.overrideWith` |
| `test/golden_test.dart` | Same override pattern for MemoryPage goldens |
