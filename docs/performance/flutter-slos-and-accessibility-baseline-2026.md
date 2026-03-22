# Flutter User App - Performance SLOs and Accessibility Baseline (2026)

Date: 2026-02-18  
Version: 0.1.0  
Status: DRAFT - Baselines defined, validation pending

## Executive Summary

This document defines Service Level Objectives (SLOs) for the Flutter user app and accessibility compliance targets. These must be validated on reference devices before production release.

---

## Performance SLOs

### 1. Startup Latency (Mobile)

**Metric:** Time from app launch to chat home screen interactive

**Target SLO:**
- **Cold start:** ≤ 3000ms (p95)
- **Warm resume:** ≤ 800ms (p95)

**Reference devices:**
- iOS: iPhone 12 (or equivalent mid-range 2020 device)
- Android: Pixel 5 (or equivalent mid-range 2020 device)

**Measurement:**
- Instrumented in `PerformanceTracker.markHomeReady()`
- Telemetry event: `startup.cold_start`, `startup.warm_resume`

**Current status:** ⚠️ **NOT MEASURED**  
**Action required:** Run app on reference devices, collect 30 samples, validate p95 < target

---

### 2. Startup Latency (Web)

**Metric:** Time from page load to chat home screen interactive

**Target SLO:**
- **First load (cold):** ≤ 5000ms (p95)
- **Cached load:** ≤ 2000ms (p95)

**Reference environment:**
- Browser: Chrome 120+ or Safari 17+
- Network: 10 Mbps broadband (simulated)
- Device: Desktop (Intel i5 or M1 equivalent)

**Measurement:**
- Instrumented in `PerformanceTracker.markHomeReady()`
- Web-specific: measure `DOMContentLoaded` → interactive

**Current status:** ⚠️ **NOT MEASURED**  
**Action required:** Lighthouse CI run, validate performance score > 90

---

### 3. Chat Interaction Latency

**Metric:** Time from send button press to first assistant token displayed

**Target SLO:**
- **Time-to-first-token:** ≤ 1500ms (p95)
- **Streaming token rate:** ≥ 10 tokens/sec (p50)

**Measurement:**
- Instrumented in `PerformanceTracker.logChatFirstToken()`
- Telemetry event: `chat.stream.first_token`

**Current status:** ⚠️ **NOT MEASURED**  
**Action required:** E2E test with real backend, collect 50 samples

---

### 4. FPS Budget (Classic Mode)

**Metric:** Frame render time consistency

**Target SLO:**
- **Sustained FPS:** ≥ 55 FPS (p95 of frames)
- **Jank budget:** < 5% of frames exceed 16.67ms

**Scenarios:**
- Scrolling chat list (20 threads)
- Scrolling chat thread (100 messages)
- Typing in composer with live suggestions

**Measurement:**
- Flutter DevTools performance overlay
- `flutter run --profile` on reference devices

**Current status:** ⚠️ **NOT VALIDATED**  
**Action required:** Profile mode test, record frame times

---

### 5. FPS Budget (Cinematic Mode)

**Metric:** Frame render time consistency with visual effects

**Target SLO:**
- **Sustained FPS:** ≥ 50 FPS (p95 of frames)
- **Jank budget:** < 10% of frames exceed 20ms
- **Effects toggle:** Auto-fallback to reduced/off if <45 FPS for 3 seconds

**Visual effects enabled:**
- Glass blur (backdrop filter)
- Glow shadows
- Animated transitions (full motion level)

**Measurement:**
- Flutter DevTools performance overlay
- `flutter run --profile` on reference devices

**Current status:** ⚠️ **NOT VALIDATED**  
**Action required:** Profile mode test with cinematic mode, validate auto-fallback

---

### 6. Thermal and Battery Guardrails

**Policy:** Auto-fallback to preserve device health

**Thermal trigger:**
- If device temperature reaches "critical" (iOS: `ProcessInfo.ThermalState.critical`, Android: `THERMAL_STATUS_CRITICAL`)
- Action: Force `motion_level = off`, disable glass blur

**Battery trigger:**
- If battery level < 20% and not charging
- Action: Force `visual_mode = classic`, `motion_level = off`

**Implementation:**
- Monitor via `flutter_battery` + platform channels
- Emit telemetry event: `performance.auto_fallback`

**Current status:** ⚠️ **NOT IMPLEMENTED**  
**Action required:** Implement thermal/battery monitoring, add auto-fallback logic

---

## Accessibility Compliance

### WCAG 2.1 Level AA Targets

| Criterion | Requirement | Status | Notes |
|-----------|-------------|--------|-------|
| **1.1.1 Non-text Content** | All images have alt text | ⚠️ TBD | Review image widgets, add semanticLabel |
| **1.3.1 Info and Relationships** | Semantic structure | ⚠️ TBD | Review Semantics widgets for buttons/headers |
| **1.4.3 Contrast (Minimum)** | 4.5:1 for normal text, 3:1 for large | ⚠️ TBD | Run contrast checker on both modes |
| **1.4.11 Non-text Contrast** | 3:1 for UI components | ⚠️ TBD | Validate button/input borders |
| **2.1.1 Keyboard** | All functionality via keyboard | ✅ PASS* | Flutter web keyboard nav works |
| **2.2.2 Pause, Stop, Hide** | Auto-updating content controllable | ✅ PASS | Streaming can be cancelled |
| **2.4.7 Focus Visible** | Keyboard focus indicator visible | ⚠️ TBD | Validate focus rings in both modes |
| **3.2.2 On Input** | No unexpected context changes | ✅ PASS | Form inputs behave predictably |
| **4.1.2 Name, Role, Value** | Assistive tech compatibility | ⚠️ TBD | Test with TalkBack/VoiceOver |
| **ARIA Landmarks** | Proper navigation structure | ⚠️ TBD | Web only: validate HTML semantics |

*Assumes Flutter framework default behavior; manual testing required

---

### Reduced Motion Compliance

**Requirement:** Honor `prefers-reduced-motion` OS setting

**Implementation:**
- ✅ `MediaQuery.of(context).disableAnimations` detected
- ✅ Auto-force `motion_level = reduced` when OS requests
- ✅ User can manually override to `off`

**Verification:**
- [ ] iOS: Settings > Accessibility > Motion > Reduce Motion
- [ ] Android: Settings > Accessibility > Remove animations
- [ ] Web: `prefers-reduced-motion: reduce` media query

---

### Screen Reader Support

**Critical flows to test:**

| Flow | Platform | Tool | Status |
|------|----------|------|--------|
| Login | iOS | VoiceOver | ⚠️ NOT TESTED |
| Login | Android | TalkBack | ⚠️ NOT TESTED |
| Login | Web | NVDA/JAWS | ⚠️ NOT TESTED |
| Chat list navigation | iOS | VoiceOver | ⚠️ NOT TESTED |
| Chat thread reading | iOS | VoiceOver | ⚠️ NOT TESTED |
| Composer + send | Android | TalkBack | ⚠️ NOT TESTED |
| Settings drawer | iOS | VoiceOver | ⚠️ NOT TESTED |

**Minimum pass criteria:**
- All interactive elements announced
- Button labels are descriptive (not just "button")
- Navigation order is logical
- Loading/streaming states announced

---

### Color Blindness Support

**Requirement:** Don't rely on color alone to convey information

**Checks:**
- [ ] Success/error states have icons, not just color
- [ ] Links are underlined or have distinct styling beyond color
- [ ] Charts/graphs use patterns or labels (not implemented yet)

**Tools:**
- Chrome DevTools: Rendering > Emulate vision deficiencies
- Sim Daltonism (macOS)

---

### Font Scaling Support

**Requirement:** Support OS-level font size adjustments

**Implementation:**
- Flutter respects `MediaQuery.textScaleFactor` by default
- Layout should not break at 1.5x scale

**Verification:**
- [ ] iOS: Settings > Display & Brightness > Text Size
- [ ] Android: Settings > Display > Font size
- [ ] Test at 1.0x, 1.3x, 1.5x scales

---

## Performance Validation Checklist

Use this checklist before marking Section J complete:

### Mobile Performance

- [ ] Cold start latency measured on iPhone 12 (iOS): p95 ≤ 3000ms
- [ ] Cold start latency measured on Pixel 5 (Android): p95 ≤ 3000ms
- [ ] Warm resume latency measured: p95 ≤ 800ms
- [ ] Chat first-token latency measured: p95 ≤ 1500ms
- [ ] FPS in classic mode: ≥ 55 FPS sustained
- [ ] FPS in cinematic mode: ≥ 50 FPS sustained
- [ ] Auto-fallback triggered at <45 FPS for 3 seconds
- [ ] Thermal fallback tested (simulated critical temp)
- [ ] Battery fallback tested (<20% battery)

### Web Performance

- [ ] Lighthouse performance score ≥ 90
- [ ] First load ≤ 5000ms (p95)
- [ ] Cached load ≤ 2000ms (p95)
- [ ] Responsive layout tested: 320px (mobile), 768px (tablet), 1920px (desktop)

### Accessibility

- [ ] Contrast ratio checked in classic mode: all pass 4.5:1
- [ ] Contrast ratio checked in cinematic mode: all pass 4.5:1
- [ ] VoiceOver tested on iOS (login + chat flows)
- [ ] TalkBack tested on Android (login + chat flows)
- [ ] Screen reader tested on web (NVDA or JAWS)
- [ ] Reduced motion verified: iOS, Android, Web
- [ ] Font scaling tested: 1.0x, 1.3x, 1.5x
- [ ] Keyboard navigation tested on web (tab order, focus rings)
- [ ] Color blindness simulation reviewed

---

## Tooling and Automation

### Performance Profiling Script

```bash
# Run in profile mode on connected device
flutter run --profile --dart-define=SVEN_API_BASE=https://app.example.com

# Open DevTools for FPS monitoring
flutter pub global activate devtools
flutter pub global run devtools
```

### Lighthouse CI (Web)

```yaml
# .github/workflows/flutter-user-app-ci.yml
- name: Lighthouse CI
  run: |
    flutter build web --release
    npx @lhci/cli@latest autorun --upload.target=temporary-public-storage
```

### Accessibility Audit (Web)

```bash
# Install axe-core CLI
npm install -g @axe-core/cli

# Run audit
axe build/web/index.html --exit
```

---

## SLO Monitoring (Production)

Once app is deployed, monitor SLOs via telemetry:

| Metric | Event | Alert Threshold |
|--------|-------|-----------------|
| Cold start p95 | `startup.cold_start` | > 3500ms |
| Warm resume p95 | `startup.warm_resume` | > 1000ms |
| Chat first-token p95 | `chat.stream.first_token` | > 2000ms |
| Auto-fallback rate | `performance.auto_fallback` | > 5% of sessions |

**Action on SLO breach:** File incident, investigate regressions, rollback if critical

---

## Sign-off

**Performance validation:** ⚠️ **BLOCKED** - Baselines defined, measurements pending  
**Accessibility validation:** ⚠️ **BLOCKED** - Manual testing required  
**Production release:** **BLOCKED** until all checkboxes above are complete

**Next steps:**
1. Run performance profiling on reference devices
2. Conduct manual accessibility testing with AT tools
3. Record results in evidence files
4. Update Section J checklist items to [x] complete

---

Date: 2026-02-18  
Document owner: Mobile + Platform team

