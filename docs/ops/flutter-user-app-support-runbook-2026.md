# Flutter User App — Support Runbook (2026)

Date: 2026-02-18
Owner: Mobile + Platform Operations
Scope: `apps/companion-user-flutter` — iOS, Android, Flutter Web

---

## 1. App Identity

| Field | Value |
|---|---|
| Package (Android) | `com.example.sven_user_flutter` |
| Bundle ID (iOS) | `com.example.svenUserFlutter` |
| Gateway base URL | `https://app.example.com` |
| SSE stream endpoint | `GET /v1/stream` |
| FCM project | Firebase project configured via `google-services.json` / `GoogleService-Info.plist` |

---

## 2. Daily Health Checks

```powershell
# Gateway reachability
curl -s https://app.example.com/healthz
curl -s https://app.example.com/readyz

# Release status snapshot
npm run release:status
```

Watch for:
- `5xx` rate above 8% on `/v1/chat*` or `/v1/auth*`
- SSE stream disconnecting more than once per 30-second window per client
- FCM delivery failures in Firebase Console > Cloud Messaging

---

## 3. User-Reported Issue Triage Tree

### "I can't log in"

1. Confirm gateway auth is healthy: `GET /v1/auth/login` returns non-5xx.
2. Check whether the device clock is skewed (token expiry validation).
3. Check `flutter_secure_storage` isn't corrupted — user may need to clear app data.
4. Check network: confirm device can reach `app.example.com` (not hairpin NAT on LAN).
5. If `TOTP_INVALID` errors in gateway logs — user OTP secret may be desynced; trigger re-enrollment.

### "Messages aren't appearing / chat is stuck"

1. Check SSE stream: `curl -N -H "Authorization: Bearer <token>" https://app.example.com/v1/stream`
2. Confirm heartbeat (`: heartbeat`) arrives every ≤15 s.
3. If no heartbeat → gateway SSE worker issue — check internal nginx + NATS consumer lag.
4. Fallback poll (10 s) should keep chat functional even if SSE is dead. If poll also fails → auth token expired.
5. Check `ChatSseService` reconnect backoff: starts at 1 s, caps at 30 s. Sustained failure = backend issue, not client.

### "Notifications aren't working"

1. Open device **Settings > Notifications > Sven** — confirm permission is granted.
2. In-app: **Settings > Notifications** — confirm FCM status shows "Enabled" with a valid token.
3. Send test push via Firebase Console using the token shown in app (long-press to copy).
4. Check `PushNotificationManager` registration in gateway device table: `GET /v1/devices`.
5. Background/cold-start taps: confirm `sven://chat/{chatId}` deep link resolves (Android intent filter, iOS URL scheme).

### "App is slow / battery draining"

1. Battery auto-fallback should have already triggered — confirm `_PerformanceFallbackBanner` is visible.
2. Check motion level: Settings > Motion → set to `off` or `reduced`.
3. If slow on cinematic: switch to `classic` mode in Settings > Appearance.
4. Collect ADB metrics if device is accessible:
   ```powershell
   adb shell dumpsys meminfo com.example.sven_user_flutter
   adb shell dumpsys gfxinfo com.example.sven_user_flutter framestats
   ```
5. SLO targets:
   - Cold start: ≤3000 ms p95
   - Chat interaction latency: ≤1500 ms p95
   - FPS classic: ≥55 FPS | cinematic: ≥50 FPS

### "App crashes on open"

1. Collect crash via ADB: `adb logcat -d -s flutter`
2. Check Firebase Crashlytics dashboard for symbolicated stack.
3. Common causes:
   - `flutter_secure_storage` migration failure after update → clear app storage and reinstall.
   - Firebase init race on cold start → check `main.dart` `WidgetsFlutterBinding.ensureInitialized()` ordering.
   - Null token on authenticated route → session restore failure; force re-login.
4. Rollback path: push prior APK/IPA build if store rollout is active — see `docs/ops/release-rollback-runbook-2026.md`.

---

## 4. ADB Diagnostic Commands (Android)

```powershell
# Live filtered log
adb logcat flutter:D *:S

# Full log capture
adb logcat -d > device_support_log.txt

# Memory snapshot
adb shell dumpsys meminfo com.example.sven_user_flutter

# Frame stats (jank detection)
adb shell dumpsys gfxinfo com.example.sven_user_flutter framestats reset

# Clear app data (last resort)
adb shell pm clear com.example.sven_user_flutter
```

---

## 5. Flutter Web Triage

1. Open browser DevTools > Console — look for Dart/Flutter exceptions.
2. Check network tab for failed `/v1/*` requests.
3. Confirm CORS headers: `Access-Control-Allow-Origin` must include the web origin.
4. SSE on web uses `http.Client.send()` streaming — if browser blocks: check for mixed-content or CSP issues.
5. SLO: first contentful paint ≤5000 ms p95.

---

## 6. FCM Token Management

```powershell
# Retrieve all registered device tokens (admin auth required)
curl -H "Authorization: Bearer <admin_token>" https://app.example.com/v1/devices

# Send test push to a specific token
# Use Firebase Console > Cloud Messaging > Send test message
```

Token lifecycle:
- Tokens rotate on install/reinstall or FCM refresh.
- On rotation: app automatically re-registers via `PushNotificationManager`.
- Stale tokens silently fail on FCM send → gateway should handle `404/410` from FCM and deregister.

---

## 7. Escalation Path

| Condition | Action |
|---|---|
| Auth/chat/approvals 5xx for >2 min | P0 — see `docs/ops/incident-triage-and-degraded-mode-runbook-2026.md` |
| Token compromise suspected | P0 — see `docs/runbooks/security-token-compromise-and-key-rotation.md` |
| SSE stream dead, poll fallback active | P1 — NATS consumer health check |
| Crash rate spike post-deploy | P1 — rollback via `docs/ops/release-rollback-runbook-2026.md` |
| Performance SLO missed | P2 — file backlog item, check auto-fallback activation |

---

## 8. Deployment Reference

| Channel | Artifact | Deploy command |
|---|---|---|
| Android debug (dev) | `build/app/outputs/flutter-apk/app-debug.apk` | `adb install -r app-debug.apk` |
| Android release | `build/app/outputs/flutter-apk/app-release.apk` | Store rollout or `adb install` |
| Flutter web | `build/web/` | Deploy to hosting (nginx or CDN) |
| iOS | Xcode archive / IPA | TestFlight or `xcrun simctl` |

Build commands:
```powershell
flutter build apk --debug
flutter build apk --release
flutter build web --release
flutter build ios --release --no-codesign
```

---

## 9. Related Runbooks

- `docs/ops/incident-triage-and-degraded-mode-runbook-2026.md`
- `docs/ops/release-rollback-runbook-2026.md`
- `docs/runbooks/security-token-compromise-and-key-rotation.md`
- `docs/ops/mobile-device-farm-maestro-2026.md`
- `docs/ops/mobile-release-closeout-runbook-2026.md`
- `docs/release/LOCAL_TESTING_GUIDE.md`

