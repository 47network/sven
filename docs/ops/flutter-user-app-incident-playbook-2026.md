# Flutter User App — Incident Playbook (2026)

Date: 2026-02-18
Owner: Mobile + Platform Operations
Scope: `apps/companion-user-flutter` — Android, iOS, Flutter Web client failures

---

## 1. Scope and Trigger Conditions

This playbook covers client-side failures originating in or impacting the Flutter user app.  
Trigger when any of the following is observed:

- Crash-free session rate drops below **99.5%** (Firebase Crashlytics / Play Vitals).
- Login failure rate rises above **5%** for >5 minutes.
- Chat send-to-delivery latency exceeds **3000 ms p95** for >10 minutes.
- SSE stream failure rate causes >50% of active clients to fall back to poll continuously.
- FCM delivery failure rate exceeds **10%** of registered tokens for >15 minutes.
- User-impacting regression confirmed after a release rollout.
- Security event: token exfiltration via client log/storage.

---

## 2. Severity Classification

| Severity | Condition | Response Time |
|---|---|---|
| **P0** | Auth completely broken, no users can log in, or data exposure confirmed | Immediate (24/7 page) |
| **P1** | Chat non-functional for >20% users, crash spike >1%, FCM dead for all users | ≤15 min during hours |
| **P2** | Degraded performance, SSE fallback to poll, cosmetic regressions | ≤2 hours, ticket + review |
| **P3** | Single-user edge case, accessibility gap, styling issue | Next sprint backlog |

---

## 3. First 10 Minutes

```text
1. Confirm scope: mobile (Android/iOS) vs web vs both?
2. Check gateway health: GET /healthz and GET /readyz
3. Check error rate on /v1/auth* and /v1/chat*
4. Check Firebase Crashlytics for new crash signatures
5. Confirm last deployment time — was this a rollout regression?
6. Open incident channel and assign commander
```

---

## 4. Auth Incident Response

### Symptom: Login failures spike

1. Check `/v1/auth/login` response codes — is it 5xx or 4xx?
2. If 5xx: backend/gateway incident — escalate to `docs/ops/incident-triage-and-degraded-mode-runbook-2026.md`.
3. If 4xx `AUTH_FAILED` / `INVALID_TOTP`: client or user issue, not outage.
4. If `SESSION_EXPIRED` flood: token TTL misconfiguration or clock skew. Check gateway config.
5. If token compromise suspected: **immediately** follow `docs/runbooks/security-token-compromise-and-key-rotation.md`.

### Containment

- If client build is confirmed to have a broken auth flow: trigger rollback.
- Rollback path: re-push prior signed APK/IPA via store rollout controls or `adb install -r <prior-apk>`.
- Reference: `docs/ops/release-rollback-runbook-2026.md`

---

## 5. Chat / SSE Incident Response

### Symptom: Messages not arriving, stream dead

1. Probe SSE endpoint directly:
   ```bash
   curl -N -H "Authorization: Bearer <valid_token>" \
     https://app.example.com/v1/stream
   ```
   - Healthy: `: heartbeat` lines every ≤15 s, `event: message` on activity.
   - Dead: connection closes immediately or no heartbeat within 20 s.

2. If SSE dead:
   - Check NATS consumer pending message lag.
   - Check internal nginx → gateway SSE worker connectivity.
   - Check gateway memory/CPU — SSE fans out per client, can exhaust resources under load.
   - 10-second poll fallback is **active automatically** in the Flutter client; users can still send/receive.

3. If SSE healthy but client not updating:
   - Device network issue — confirm WiFi vs cellular behavior.
   - Check `ChatSseService` reconnect logging: exponential backoff from 1 s → 30 s.
   - Request user to re-open the app (triggers fresh connection).

4. Restoration: once SSE confirmed healthy, clients automatically reconnect within 30 s.

---

## 6. FCM / Push Notification Incident Response

### Symptom: No push notifications delivered

1. Confirm FCM service health: [Firebase Status](https://status.firebase.google.com).
2. Send test push via Firebase Console using a known-good token from the device.
3. Check gateway device token table:
   ```bash
   curl -H "Authorization: Bearer <admin_token>" \
     https://app.example.com/v1/devices
   ```
4. Look for stale tokens (last-seen >7 days) — gateway should deregister on FCM 404/410.
5. Check Android notification channel: `SVEN_MESSAGES` must be enabled in device settings.
6. Foreground notification fallback (in-app SnackBar via `PushNotificationManager.foregroundNotifications`) should be unaffected by FCM issues — in-app is SSE-driven, not FCM.

### Token rotation incident

- Re-register path: user deletes and reinstalls app → `PushNotificationManager` auto-registers new token on next launch.
- Bulk token refresh: Firebase may rotate all project tokens on key rotation. Monitor registration surge in gateway device table. No action needed if gateway handles it gracefully.

---

## 7. Performance Degradation Response

### Symptom: Low FPS, high memory, thermal throttling

1. Check `_PerformanceFallbackBanner` — if shown, auto-fallback is already active.
2. Collect ADB frame stats:
   ```powershell
   adb shell dumpsys gfxinfo com.example.sven_user_flutter framestats
   adb shell dumpsys meminfo com.example.sven_user_flutter
   ```
3. SLO baselines:
   - Cold start: ≤3000 ms p95 (mobile), ≤5000 ms p95 (web)
   - Chat interaction (send → SSE delivery): ≤1500 ms p95
   - FPS classic: ≥55 FPS | cinematic: ≥50 FPS
   - Memory ceil: ≤100 MB PSS
4. If battery state triggers fallback incorrectly:
   - `battery_plus` reports state via `Battery().onBatteryStateChanged`.
   - Fallback triggers in `PerformanceMonitor.updateBatteryState()` — check threshold config in `lib/app/performance_tracker.dart`.

### Performance regression after release

1. Compare `PerformanceTracker` telemetry events between current and prior build.
2. Key events: `app.startup.cold`, `chat.stream.first_token`, `chat.round_trip`.
3. If SLO breach confirmed: rollback if >10% users impacted.

---

## 8. Web-Specific Incidents

### Symptom: Flutter web blank or broken

1. Check browser console for Dart exceptions or CORS errors.
2. Confirm web artifact was built with `--release` and deployed correctly.
3. Check CSP headers — `connect-src` must include `https://app.example.com`.
4. SSE on web: some corporate proxies buffer SSE. Confirm `X-Accel-Buffering: no` is set in nginx.
5. Web cold start SLO: ≤5000 ms p95 — profiling via browser DevTools > Performance.

---

## 9. Rollback Procedure

```powershell
# Android: re-install prior APK directly
adb install -r <path-to-prior-app-release.apk>

# Play Store: use staged rollout controls to pause/halt and resume prior version
# TestFlight (iOS): distribute prior build to internal group

# Flutter web: re-deploy prior web artifact to hosting target
```

Full rollback runbook: `docs/ops/release-rollback-runbook-2026.md`

---

## 10. Recovery Criteria

Before clearing a P0/P1:

- [ ] Error rate back to baseline for ≥10 minutes.
- [ ] FCM delivery confirmed healthy (test push received on device).
- [ ] SSE heartbeat confirmed on at least one client.
- [ ] Login flow passing end-to-end.
- [ ] Crash rate at or below pre-incident baseline.
- [ ] Post-incident timeline drafted for 48-hour report.

---

## 11. Post-Incident Actions

1. Run full release gate checks:
   ```powershell
   npm run release:status
   flutter analyze
   flutter test
   ```
2. Update `docs/release/status/` artifacts with fresh timestamps.
3. Add root cause to incident log and link prevention backlog item.
4. If threshold tuning needed: update `docs/ops/alert-noise-thresholds-2026.md`.
5. If runbook gap found: update this file.

---

## 12. Related Runbooks

- `docs/ops/flutter-user-app-support-runbook-2026.md`
- `docs/ops/incident-triage-and-degraded-mode-runbook-2026.md`
- `docs/ops/release-rollback-runbook-2026.md`
- `docs/runbooks/security-token-compromise-and-key-rotation.md`
- `docs/ops/key-rotation-and-propagation-runbook-2026.md`
- `docs/ops/alert-noise-thresholds-2026.md`
- `docs/ops/mobile-device-farm-maestro-2026.md`

