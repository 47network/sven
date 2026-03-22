# Local Testing Quick Reference

**Date**: 2026-02-18  
**Scope**: Testing Flutter user app on local machine (Sven)

This guide provides quick commands for local validation of remaining checklist items.

---

## Prerequisites

- [ ] Android device connected via USB (or emulator running)
- [ ] ADB installed and in PATH
- [ ] Flutter SDK installed
- [ ] Node.js/npm available
- [ ] Git repository at `x:\47network\apps\openclaw-sven\sven_v0.1.0`

---

## Section B: Visual Polish Validation

### Quick Visual Inspection

1. **Start Flutter App**:

   ```powershell
   cd x:\47network\apps\openclaw-sven\sven_v0.1.0\apps\companion-user-flutter
   flutter run --release
   ```

2. **Test Cinematic Mode**:
   - Open app, verify it starts in cinematic (HUD) mode
   - Navigate through: Home → Chat → Settings
   - Check: Glow effects, depth layering, glass overlays
   - Screenshots: Save to `docs/release/evidence/screenshots/cinematic/`

3. **Switch to Classic Mode**:
   - Open settings drawer
   - Toggle to classic mode
   - Navigate through same screens
   - Check: Clean, professional appearance
   - Screenshots: Save to `docs/release/evidence/screenshots/classic/`

4. **Test Motion Levels**:
   - Settings → Motion Level → Off (no animations)
   - Settings → Motion Level → Reduced (subtle transitions)
   - Settings → Motion Level → Full (full effects)
   - Verify transitions behave correctly

5. **Document Findings**:
   - Fill out checklist: `docs/release/evidence/visual-polish-validation-checklist.md`
   - Note any visual issues or polish gaps
   - Mark items as pass/fail

---

## Section J: Performance Measurements

### Mobile Performance (Android)

1. **Check Device Connection**:

   ```powershell
   adb devices -l
   ```

   Should show connected device.

2. **Ensure App is Running**:

   ```powershell
   cd x:\47network\apps\openclaw-sven\sven_v0.1.0\apps\companion-user-flutter
   flutter run --release
   ```

3. **Capture Performance Snapshot**:

   ```powershell
   cd x:\47network\apps\openclaw-sven\sven_v0.1.0
   .\scripts\ops\mobile\collect-adb-perf-snapshot.ps1 -PackageName host.exp.exponent
   ```

   (Replace package name if different)

   **Output**: Files in `docs/release/evidence/mobile/rc_perf_<timestamp>_*.txt`

4. **Run SLO Check**:

   ```powershell
   node scripts/mobile-perf-slo-check.cjs
   ```

   **Output**:
   - `docs/release/status/mobile-perf-slo-latest.json`
   - `docs/release/status/mobile-perf-slo-latest.md`

5. **Collect Telemetry Events**:

   ```powershell
   # Filter for telemetry in logcat
   adb logcat -s flutter:V | Select-String "TELEMETRY" > telemetry_capture.txt
   ```

   Perform test actions:
   - Force-stop app, cold start (capture `startup.cold_start`)
   - Send chat message (capture `chat.stream.first_token`)
   - Background app 30s, resume (capture `startup.warm_resume`)

   Repeat 20+ times for statistical significance.

6. **Calculate Percentiles**:
   Extract latency_ms values from telemetry_capture.txt and compute:
   - p50, p95, p99 for cold start
   - p50, p95, p99 for first token
   - p50, p95, p99 for warm resume

   Compare against SLOs:
   - Cold start p95 ≤ 2500ms ✅/❌
   - Warm resume p95 ≤ 1000ms ✅/❌
   - First token p95 ≤ 1500ms ✅/❌

### Web Performance

1. **Build Web Release**:

   ```powershell
   cd x:\47network\apps\openclaw-sven\sven_v0.1.0\apps\companion-user-flutter
   flutter build web --release
   ```

2. **Serve Locally**:

   ```powershell
   python -m http.server 8000 --directory build\web
   ```

   Or use any static file server.

3. **Run Lighthouse Audit**:

   ```powershell
   npx lighthouse http://localhost:8000 --only-categories=performance,accessibility --output=json --output-path=docs/release/evidence/web/lighthouse-report.json
   ```

4. **Check Results**:
   - Performance score ≥ 85 ✅/❌
   - FCP ≤ 1.8s ✅/❌
   - LCP ≤ 2.5s ✅/❌
   - Accessibility score ≥ 90 ✅/❌

### FPS Profiling

1. **Run in Profile Mode**:

   ```powershell
   cd x:\47network\apps\openclaw-sven\sven_v0.1.0\apps\companion-user-flutter
   flutter run --profile
   ```

2. **Open DevTools**:

   ```powershell
   flutter pub global activate devtools
   flutter pub global run devtools
   ```

   Opens browser at <http://localhost:9100>

3. **Connect and Profile**:
   - DevTools → Connect to running app
   - Performance tab → Record
   - Navigate screens, trigger animations
   - Stop recording, check frame rendering

4. **Verify FPS Targets**:
   - Cinematic mode: ≥ 50 FPS (≤ 20ms per frame) ✅/❌
   - Classic mode: ≥ 55 FPS (≤ 18ms per frame) ✅/❌

### Accessibility Checks

1. **Screen Reader Testing (if available)**:
   - **Android**: Settings → Accessibility → TalkBack (enable)
   - **iOS**: Settings → Accessibility → VoiceOver (enable)
   - Navigate app with screen reader, verify announcements

2. **Contrast Checks** (manual spot check):
   - Use browser DevTools or contrast checker tool
   - Verify text on surfaces ≥ 4.5:1
   - Verify large text ≥ 3:1
   - Verify UI components ≥ 3:1

3. **Reduced Motion**:
   - **Android**: Settings → Accessibility → Remove animations
   - **iOS**: Settings → Accessibility → Motion → Reduce Motion
   - Verify app respects OS setting

---

## Section L: Rollback Testing (Local Simulation)

### Test Feature Flag Rollback

1. **Simulate Feature Flag Toggle**:
   If you have local feature flag system:

   ```powershell
   # Disable Flutter client flag
   curl -X PUT http://localhost:3001/v1/admin/feature-flags/flutter_user_app \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"enabled": false, "traffic_pct": 0}'
   ```

2. **Verify Fallback**:
   - App should detect flag is off
   - User directed to legacy client or maintenance message

3. **Restore Flag**:

   ```powershell
   curl -X PUT http://localhost:3001/v1/admin/feature-flags/flutter_user_app \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"enabled": true, "traffic_pct": 100}'
   ```

### Test Database Rollback (Safe)

⚠️ **Only test on local/dev database, never production**

1. **Check Current Migration**:

   ```powershell
   cd x:\47network\apps\openclaw-sven\sven_v0.1.0
   npm run db:version --workspace services/gateway-api
   ```

2. **Rollback One Migration** (if safe):

   ```powershell
   npm run db:migrate:down --workspace services/gateway-api
   ```

3. **Verify Schema**:
   - Check that rolled-back tables/columns are removed
   - Test legacy queries work

4. **Roll Forward**:

   ```powershell
   npm run db:migrate --workspace services/gateway-api
   ```

---

## Smoke Tests

### Run Post-Release Verification

```powershell
cd x:\47network\apps\openclaw-sven\sven_v0.1.0
npm run release:verify:post
```

**Checks**:

- Auth endpoints responsive
- Chat endpoints responsive
- Health checks green
- No elevated error rates

### Run Admin Dashboard SLO Check

```powershell
npm run release:admin:dashboard:slo:auth
```

**Checks**:

- Admin auth SLOs met
- Dashboard queries functional

---

## Evidence Collection

### Create Evidence Directory Structure

```powershell
cd x:\47network\apps\openclaw-sven\sven_v0.1.0
New-Item -ItemType Directory -Path "docs\release\evidence\screenshots\cinematic" -Force
New-Item -ItemType Directory -Path "docs\release\evidence\screenshots\classic" -Force
New-Item -ItemType Directory -Path "docs\release\evidence\performance" -Force
New-Item -ItemType Directory -Path "docs\release\evidence\telemetry" -Force
New-Item -ItemType Directory -Path "docs\release\evidence\web" -Force
New-Item -ItemType Directory -Path "docs\release\evidence\accessibility" -Force
```

### Save Evidence Files

After each test, save artifacts:

- Screenshots → `docs/release/evidence/screenshots/`
- Performance reports → `docs/release/evidence/performance/`
- Telemetry samples → `docs/release/evidence/telemetry/`
- Lighthouse reports → `docs/release/evidence/web/`
- Accessibility notes → `docs/release/evidence/accessibility/`

---

## Checklist Summary

Use this checklist to track local testing progress:

### Section B: Visual Polish

- [ ] Cinematic mode tested and screenshots captured
- [ ] Classic mode tested and screenshots captured
- [ ] Motion levels (off/reduced/full) tested
- [ ] Contrast and readability verified
- [ ] Checklist filled: `visual-polish-validation-checklist.md`

### Section J: Performance

- [ ] Mobile perf snapshot captured
- [ ] SLO check run and results reviewed
- [ ] Telemetry events collected (20+ samples each)
- [ ] Percentiles calculated and compared to SLOs
- [ ] Web Lighthouse audit run
- [ ] FPS profiling done (cinematic and classic)
- [ ] Accessibility spot checks completed

### Section L: Rollback (if applicable locally)

- [ ] Feature flag rollback simulated
- [ ] Database rollback tested (dev only)
- [ ] Smoke tests run post-rollback

---

## Quick Command Reference

| Task | Command |
|------|---------|
| Run Flutter app | `cd apps/companion-user-flutter; flutter run --release` |
| Check ADB devices | `adb devices -l` |
| Capture perf snapshot | `.\scripts\ops\mobile\collect-adb-perf-snapshot.ps1` |
| Run SLO check | `node scripts/mobile-perf-slo-check.cjs` |
| Build web | `cd apps/companion-user-flutter; flutter build web --release` |
| Lighthouse audit | `npx lighthouse http://localhost:8000 --only-categories=performance,accessibility` |
| Run smoke tests | `npm run release:verify:post` |
| Check migration version | `npm run db:version --workspace services/gateway-api` |

---

## Next Steps After Local Testing

1. **Document Findings**:
   - Fill out all evidence checklists
   - Note any issues or gaps
   - Mark pass/fail for each criteria

2. **Update Checklist**:
   - Update `docs/release/checklists/flutter-user-app-checklist-2026.md`
   - Mark Section B and J items as complete (if passed)

3. **Prepare for Section L**:
   - Use evidence templates to plan canary rollout
   - Identify internal test cohort for dogfood

4. **Prepare for Section M**:
   - Collect all evidence artifacts
   - Schedule signoff meetings with stakeholders
   - Draft final cutover approval document

---

**Support**: For issues or questions, refer to:

- `docs/release/status/flutter-release-status-2026-02-18.md`
- `docs/release/checklists/flutter-user-app-checklist-2026.md`
- Section-specific evidence guides in `docs/release/evidence/`
