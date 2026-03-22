# C8 Remaining Validation Template

Date: 2026-02-21
Scope: Final evidence capture for open C8 items in `docs/release/checklists/sven-production-parity-checklist-2026.md`

## Open Items to Validate

### C8.1

- [ ] Privacy policy URL published
- [ ] Terms of service URL published

Validation:

1. Deploy latest Canvas UI with `/privacy` and `/terms` pages.
2. Verify both URLs return HTTP 200 from release environment:
   - `https://app.sven.example.com/privacy`
   - `https://app.sven.example.com/terms`
3. Capture curl output in evidence.

Evidence block:

- privacy_url_status:
- terms_url_status:
- checked_at_utc:

### C8.2

- [ ] Deep link handling tested on both platforms
- [ ] Push notifications tested on both platforms
- [ ] Accessibility audit (TalkBack/VoiceOver)

Validation:

1. Deep link (Android + iOS):
   - open `sven://approvals`
   - open `sven://chat/<chatId>`
   - verify correct in-app destination on both platforms
2. Push notifications (Android + iOS):
   - app foreground delivery
   - app background delivery and tap-to-open route
   - verify token register + notification received for each platform
3. Accessibility:
   - TalkBack navigation flow (Android)
   - VoiceOver navigation flow (iOS)
   - verify chat list/thread/composer/settings/approvals controls are announced correctly

Evidence block:

- deep_link_android: pass/fail
- deep_link_ios: pass/fail
- push_android: pass/fail
- push_ios: pass/fail
- talkback_audit: pass/fail
- voiceover_audit: pass/fail
- notes:

### C8.3

- [ ] Cold start < 3s on reference devices
- [ ] APK/IPA size < 50MB
- [ ] Network usage optimized (minimal background data)

Validation:

1. Cold start timing:
   - collect >=20 samples per reference device
   - report p95 by platform
2. Artifact size:
   - signed APK size (MB)
   - signed IPA size (MB)
3. Network usage:
   - idle/background network behavior sample
   - verify no excessive background chatter under steady state

Evidence block:

- cold_start_android_p95_ms:
- cold_start_ios_p95_ms:
- apk_size_mb:
- ipa_size_mb:
- background_network_sample:
- conclusion:

## Output

When executed, save completed evidence as:

- `docs/release/evidence/mobile-c8-remaining-validation-<YYYY-MM-DD>.md`

