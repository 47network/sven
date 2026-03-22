# Section J: Performance Baseline Measurement Guide

**Date**: 2026-02-18  
**Status**: Instrumentation complete, local measurements in progress  
**Scope**: Flutter mobile + web performance validation

## Overview

Performance SLOs are defined in `docs/architecture/v1-client-scope-slos-2026.md`:

- **Mobile cold start**: p95 ≤ 2.5s
- **Mobile warm start**: p95 ≤ 1.0s
- **Chat first token**: p95 ≤ 1.5s
- **Web initial route**: p95 ≤ 2.0s
- **UI action feedback**: p95 ≤ 300ms

All telemetry events are emitted via `PerformanceTracker` and logged through `Telemetry.logEvent()`.

## Mobile Performance Measurement

### Prerequisites

1. **Android Device Connected**:

   ```powershell
   adb devices -l
   ```

2. **Flutter App Running**:

   ```powershell
   cd apps/companion-user-flutter
   flutter run --release
   ```

### Capture Performance Snapshot

Execute the ADB performance collection script:

```powershell
.\scripts\ops\mobile\collect-adb-perf-snapshot.ps1 -PackageName <your.package.name>
```

This captures:

- `gfxinfo` (frame times, jank percentage)
- `meminfo` (memory usage, PSS)
- `cpuinfo` (CPU utilization)
- `top` (process stats)

Artifacts saved to: `docs/release/evidence/mobile/rc_perf_<timestamp>_<deviceid>_*.txt`

### Analyze SLO Compliance

Run the SLO check script:

```powershell
node scripts/mobile-perf-slo-check.cjs
```

This generates:

- `docs/release/status/mobile-perf-slo-latest.json` (machine-readable)
- `docs/release/status/mobile-perf-slo-latest.md` (human summary)

**Pass criteria**:

- p50 ≤ 20ms
- p90 ≤ 45ms
- p95 ≤ 60ms
- p99 ≤ 180ms
- Janky frames ≤ 25%
- Total PSS ≤ 250MB

### Extract Telemetry Events

Flutter telemetry logs are captured via `debugPrint`. Extract them from device logs:

```powershell
# Filter for telemetry events
adb logcat -s flutter:V | Select-String "TELEMETRY"
```

**Key events to collect**:

- `startup.cold_start` (latency_ms)
- `startup.chat_home_ready` (latency_ms)
- `startup.warm_resume` (latency_ms)
- `chat.stream.first_token` (latency_ms)

**Measurement procedure**:

1. Force-stop the app
2. Cold start and capture first `startup.cold_start` event
3. Navigate to chat and send message, capture `chat.stream.first_token`
4. Background the app for 30s
5. Resume and capture `startup.warm_resume`
6. Repeat 20+ times to get p95 distribution

### Calculate Percentiles

Use the collected latency samples to compute percentiles:

```powershell
# Example with PowerShell
$samples = @(2100, 1800, 2300, ...) # ms values
$sorted = $samples | Sort-Object
$p50 = $sorted[[math]::Floor($sorted.Count * 0.50)]
$p95 = $sorted[[math]::Floor($sorted.Count * 0.95)]
$p99 = $sorted[[math]::Floor($sorted.Count * 0.99)]
```

## Web Performance Measurement

### Prerequisites

1. **Flutter Web Build**:

   ```powershell
   cd apps/companion-user-flutter
   flutter build web --release
   ```

2. **Serve Locally**:

   ```powershell
   python -m http.server 8000 --directory build/web
   ```

   Or use any static server.

### Capture Browser Performance

Use Chrome DevTools Performance tab:

1. Open incognito window to avoid extensions
2. Navigate to `http://localhost:8000`
3. Open DevTools → Performance tab
4. Click Record
5. Reload page and wait for chat home to render
6. Stop recording

**Metrics to extract**:

- **FCP (First Contentful Paint)**: Time to first visible element
- **TTI (Time to Interactive)**: Time until user can interact
- **LCP (Largest Contentful Paint)**: Time to main content render

Target: **Initial route interactive p95 ≤ 2.0s**

### Extract Telemetry from Console

Flutter web also uses `debugPrint`, which appears in browser console:

1. Open DevTools → Console
2. Filter for "TELEMETRY"
3. Collect `startup.chat_home_ready` and `chat.stream.first_token` events
4. Repeat navigation 20+ times to get distribution

### Lighthouse Audit

Run automated performance audit:

```bash
npx lighthouse http://localhost:8000 --only-categories=performance --output=json --output-path=./perf-report.json
```

**Pass criteria**:

- Performance score ≥ 85
- FCP ≤ 1.8s
- LCP ≤ 2.5s
- TTI ≤ 3.8s

## FPS Budget Validation

### Mobile FPS Profiling

Use Flutter DevTools:

1. Run app in profile mode:

   ```bash
   flutter run --profile
   ```

2. Open DevTools:

   ```bash
   flutter pub global activate devtools
   flutter pub global run devtools
   ```

3. Connect to running app
4. Navigate to Performance tab
5. Record while navigating screens
6. Check frame rendering timings

**Targets**:

- **Cinematic mode**: ≥ 50 FPS (20ms per frame)
- **Classic mode**: ≥ 55 FPS (18ms per frame)

### Web FPS Profiling

Use Chrome DevTools:

1. Performance tab → Record
2. Navigate through app
3. Stop recording
4. Check Frames section for dropped frames

**Target**: No significant frame drops (< 5% janky frames)

## Accessibility Validation

### Contrast Checks

Use automated tools:

1. **Chrome DevTools Lighthouse**:

   ```bash
   npx lighthouse http://localhost:8000 --only-categories=accessibility
   ```

2. **Manual spot checks** with contrast checker:
   - Text on surfaces: ≥ 4.5:1 (WCAG AA)
   - Large text (≥18px): ≥ 3:1
   - UI components: ≥ 3:1

### Screen Reader Testing

**Mobile**:

- iOS: Enable VoiceOver (Settings → Accessibility)
- Android: Enable TalkBack (Settings → Accessibility)

**Tests**:

- [ ] Status banners announce changes
- [ ] Chat bubbles have descriptive semantics
- [ ] Buttons are labeled
- [ ] Navigation is logical

**Web**:

- Use NVDA (Windows) or VoiceOver (macOS)
- Navigate with Tab key
- Verify all interactive elements are reachable

### Reduced Motion Testing

1. **iOS**: Settings → Accessibility → Motion → Reduce Motion
2. **Android**: Settings → Accessibility → Remove animations
3. **Web**: Browser DevTools → Rendering → Emulate CSS prefers-reduced-motion

Verify:

- [ ] App respects OS setting
- [ ] Motion level auto-switches to off/reduced
- [ ] Core functionality remains intact

## Evidence Collection

### Artifacts to Generate

1. **Mobile Performance Report**:
   - `docs/release/evidence/mobile/rc_perf_<timestamp>_summary.md`
   - Include gfxinfo/meminfo analysis
   - Attach `mobile-perf-slo-latest.json`

2. **Web Performance Report**:
   - `docs/release/evidence/web/lighthouse-report-<timestamp>.json`
   - Browser DevTools screenshots
   - Telemetry event samples

3. **Telemetry Samples**:
   - `docs/release/evidence/telemetry/cold_start_samples.txt`
   - `docs/release/evidence/telemetry/first_token_samples.txt`
   - Include p50/p95/p99 calculations

4. **Accessibility Audit**:
   - `docs/release/evidence/accessibility/contrast-audit-<timestamp>.md`
   - Screen reader test notes
   - Reduced motion validation notes

5. **FPS Profiling**:
   - `docs/release/evidence/performance/fps-cinematic-<timestamp>.md`
   - `docs/release/evidence/performance/fps-classic-<timestamp>.md`
   - DevTools screenshots/exports

## Baseline Reference Device Specs

**Mobile**:

- **iPhone 12**: A14 Bionic, 4GB RAM, iOS 15+
- **Pixel 5**: Snapdragon 765G, 8GB RAM, Android 11+

**Web**:

- **Desktop**: Chrome 100+, 1920x1080, 8GB RAM
- **Mobile Web**: Chrome Android, 375x667 viewport

## Next Steps

Once all measurements are complete:

1. ✅ Verify all SLOs pass on reference devices
2. ✅ Generate evidence artifacts in `docs/release/evidence/`
3. ✅ Update Section J status in checklist
4. ✅ Mark Section J as complete if all gates pass

## Troubleshooting

### High Frame Times

- Check for expensive operations in build methods
- Profile with Flutter DevTools
- Verify motion level is respected
- Test on lower-end device

### Poor Web Performance

- Check bundle size (`flutter build web --analyze-size`)
- Enable web renderers (CanvasKit vs HTML)
- Test on slower connection (throttle network)

### Telemetry Events Not Appearing

- Verify `Telemetry.logEvent()` calls are present
- Check log level in release builds
- Ensure debugPrint is not stripped in release

---

**Status**: Instrumentation complete, awaiting device measurement runs  
**Blockers**: None (all tooling in place)  
**Next Action**: Execute measurement runs and collect evidence
