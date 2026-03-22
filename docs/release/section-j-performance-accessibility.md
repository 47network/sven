# Section J: Performance & Accessibility

**Date**: 2026-02-16  
**Status**: In progress (Flutter telemetry + accessibility guardrails defined)

## 1. Performance SLO instrumentation

Targets referenced from `docs/architecture/v1-client-scope-slos-2026.md`:
- Mobile cold start p95 ≤ 2.5s, warm start p95 ≤ 1.0s, first token render p95 ≤ 1.5s.
- Web initial route interactive p95 ≤ 2.0s plus sub-300ms feedback for UI actions.

### Telemetry events shipped

| Event | Trigger | Fields | SLO covered |
|-------|---------|--------|-------------|
| `startup.cold_start` | First `ChatHomePage` frame (cold boot) | `latency_ms` | Cold start SLO |
| `startup.chat_home_ready` | Same frame, emitted once per launch | `latency_ms` | Overall readiness (p95 ≈ cold latency) |
| `startup.warm_resume` | AppLifecycle resumed after paused | `latency_ms` | Warm start SLO |
| `chat.stream.first_token` | First chunk received after send | `latency_ms` | Chat stream latency SLO |

All events are emitted via `PerformanceTracker` (`apps/companion-user-flutter/lib/app/performance_tracker.dart`), which logs structured JSON through `Telemetry.logEvent`. The log stream can be scraped from device logs for p95 computation (the Flutter release pipeline already captures debugPrint output for telemetry). Warm resume timing only fires when a resume follows a pause, avoiding duplicate warm-start metrics during a cold boot.

## 2. Accessibility and guardrails

### Contrast & typography

- `SvenTokens` (`apps/companion-user-flutter/lib/app/sven_tokens.dart`) defines separate palettes for `classic` (light) and `cinematic` (dark) modes with distinct `surface` / `onSurface` pairs and gradients, ensuring primary text always uses `onSurface` on high-contrast backgrounds.
- `buildSvenTheme` (`sven_theme.dart`) delegates to Material `ColorScheme.light`/`ColorScheme.dark` and applies bespoke `TextTheme` sizes for headings/bodies so typography remains legible in both modes.

### Keyboard + semantics

- `ChatComposer` already wires `Shortcuts`/`Actions` for Cmd/Ctrl+Enter send, Esc cancel, and Ctrl+R retry plus autofocus on web, satisfying keyboard-first expectations.
- Status communication banners now wrap their contents in a `Semantics` node with `liveRegion` enabled for critical tones so screen readers announce transitions (`_StatusBanner` in `chat_thread_page.dart`).

### Motion, thermal, and battery guardrails

- The drawer exposes explicit `Motion level` (off/reduced/full) and `System reduced motion` automatically toggles `AppState.effectiveMotionLevel`, ensuring `AnimatedSwitcher` and other transitions adapt via `motion_profile.dart` (durations and curves per level).
- `state.setSystemReducedMotion` is invoked from `MediaQuery.disableAnimations`, so device thermal or battery-driven OS reduced-motion settings immediately drop animation budgets.
- Switching to `MotionLevel.off` or `reduced` throttles opacity/scale effects, keeping rendering cheap when guardrails trigger.

### Screen-reader friendly structure

- Chat bubbles, banners, and keyboard controls rely on Material semantics (buttons with textual labels, container semantics for banners). Any additional `Semantics` wrappers were intentionally limited to avoid duplication but ensure critical alerts surface to assistive tech.
- Accessibility tests can target `StatusBanner` and composer fields by asserting text/nodes exist for both `offline` and `degraded` states.

## 3. Validation & next steps

- Review telemetry logs produced by `Telemetry.logEvent` (debugPrint) to confirm latencies remain under SLOs on reference hardware (mobile emulator/staging web). The log format mirrors other release telemetry and can be parsed with existing ingestion scripts.
- Collect `chat.stream.first_token` latencies while exercising the streaming controller to prove the synthetic chat interface adheres to the 1.5s target; once backend replaces the stub, the same instrumentation will cover real SSE/stream flows.
- Continue accessibility sweep by running screen-reader + reduced-motion scenarios (Flutter's `semanticsDebugger` + `widgetTester`) to ensure `Semantics` nodes remain descriptive.

Once telemetry confirms targets and accessibility checklists pass, mark Section J complete and proceed to Section K (security & privacy).