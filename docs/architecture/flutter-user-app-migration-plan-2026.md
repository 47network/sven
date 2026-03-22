# Flutter User App Migration Plan (2026)

Date: 2026-02-16
Owner: Product + Mobile + Platform
Scope: Keep Admin in Next.js/React, move user app (mobile + user web) to Flutter.

## Design Mandate (User App)

1. Sven user app visual direction is explicitly premium futuristic 2026.
2. Cinematic mode target is HUD-style (Ironman-like vibe) with readable, production-safe motion.
3. A simpler classic mode must always be available as a first-class toggle.
4. Motion intensity must be user-controlled and honor reduced-motion accessibility settings.
5. This mandate applies to both Flutter mobile and Flutter web.

## 1. Target Product Architecture

1. Admin console remains web-first:
- `apps/admin-ui` (Next.js/React) stays canonical for operations, governance, and settings.

2. User app becomes Flutter-first across surfaces:
- Add `apps/companion-user-flutter` for iOS + Android + Flutter Web.
- Existing RN app and existing Canvas web remain fallback paths until Flutter parity gates pass.

3. Backend remains the same platform:
- Keep `services/gateway-api`.
- Add/extend API contracts for user experience, preferences, and realtime flows.

4. Ingress/network stays unchanged:
- Existing ext nginx + internal ingress split remains valid.
- Flutter mobile and Flutter web talk to `https://app.example.com/v1/*`.

## 2. Why This Split

1. Keep admin delivery speed high on web.
2. Maximize user app visual quality and performance headroom on mobile + web.
3. Avoid backend rewrite risk.
4. Allow staged migration with rollback.

## 3. Non-Goals

1. No Admin rewrite to Flutter.
2. No full backend replacement.
3. No hard cutover before parity evidence.

## 4. Program Phases

## Phase 0: Foundations (1-2 weeks)

1. Create Flutter app skeleton:
- `apps/companion-user-flutter/`
- CI build jobs for Android + iOS simulators + Flutter web.

2. Define shared API contract map:
- Auth/session endpoints.
- Chat list/thread/messages.
- Approvals.
- User profile/settings.
- Realtime stream behavior and reconnect semantics.

3. Define UI preference model in backend:
- `ui.visual_mode`: `classic | cinematic`
- `ui.motion_enabled`: `true | false`
- `ui.avatar_mode`: `orb | robot | human | animal`

4. Add secure storage strategy:
- iOS Keychain / Android Keystore via Flutter plugins.

Exit gate:
- Build pipeline green.
- Auth handshake from Flutter works against staging.

## Phase 1: Core User Flows (2-4 weeks)

1. Implement login/session lifecycle:
- login, refresh, logout-all, expired session recovery.

2. Implement core conversation surfaces:
- chat list.
- chat thread.
- composer with streaming responses.
- responsive layouts for mobile and browser.

3. Implement degraded/offline UX:
- retry states.
- reconnect indicators.
- safe fallback messaging.

Exit gate:
- Core chat E2E tests pass.
- Crash-free baseline on reference devices.

## Phase 2: Premium UX Modes (2-4 weeks)

1. Build classic premium mode.
2. Build cinematic mode (futuristic 2026 HUD-style layers and enhanced visuals).
3. Add runtime toggles:
- visual mode.
- motion on/off.
- avatar mode.

4. Add performance guardrails:
- auto-fallback to classic/motion-off on low FPS or thermal pressure.

Exit gate:
- Performance budgets pass for both modes.
- Accessibility checks pass (reduced motion, contrast).

## Phase 3: Feature Parity and Operations (2-3 weeks)

1. Add approvals workflow parity.
2. Add notifications and deep-link routing.
3. Add telemetry parity:
- latency events.
- error taxonomy.
- mode usage/fallback metrics.

4. Add release hardening:
- signed artifacts.
- store metadata and privacy declarations.
- web deployment artifact checks for Flutter web bundle.

Exit gate:
- Feature parity score >= agreed threshold.
- Security and privacy checks green.

## Phase 4: Controlled Rollout (1-2 weeks)

1. Internal dogfood cohort.
2. Limited external beta cohort.
3. Progressive rollout with rollback controls.

Exit gate:
- Reliability and support metrics stable.
- Release signoff approved.

## 5. Backend/API Work Items (No Rewrite)

1. Add `GET /v1/me/ui-preferences`.
2. Add `PUT /v1/me/ui-preferences`.
3. Ensure `/v1/auth/*` behavior is SDK-safe for Flutter.
4. Publish API schema snapshots for Flutter integration.
5. Add compatibility defaults for missing preference fields.

## 6. Flutter User-App Technical Standards

1. State management:
- One canonical app state model (avoid mixed patterns).

2. Realtime:
- SSE/WebSocket strategy with deterministic reconnect and backoff.

3. Security:
- Secure token storage only.
- TLS strict validation.
- No secrets in logs.

4. Observability:
- Structured error events.
- startup/login/chat latency metrics (mobile + web clients).

## 7. Rollout and Rollback Policy

1. Keep RN app and existing Canvas web available until Flutter passes full parity gate.
2. Rollback trigger thresholds:
- crash rate spike.
- login failures.
- message delivery regressions.

3. Rollback path:
- disable Flutter rollout cohort.
- direct users to existing RN app build channel and existing Canvas web path.

## 8. Risks and Mitigations

1. Risk: parity drift.
- Mitigation: strict checklist and weekly parity review.

2. Risk: API behavior mismatch.
- Mitigation: contract tests against staging snapshots.

3. Risk: visual ambition hurts performance.
- Mitigation: motion toggle + auto-fallback policies.

## 9. Definition of Done

1. Flutter user app (mobile + web) passes parity checklist.
2. Security/privacy release checks pass.
3. Admin web remains stable with no regressions.
4. Production rollout metrics remain within SLO.

## 10. Linked Checklist

- `docs/release/checklists/flutter-user-app-checklist-2026.md`

