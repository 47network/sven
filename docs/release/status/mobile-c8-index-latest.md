# Mobile C8 Status Index

Generated: 2026-02-22T19:01:50.1365127+00:00
Status: blocked

## Summary
- legal_host: fail
- legal_android: fail
- legal_matrix: fail
- accessibility: fail
- performance: fail
- ios_finalize: fail
- closeout: fail
- next_actions: blocked
- pack: fail

## Blocked Areas
- legal_host
- legal_android
- legal_matrix
- accessibility
- performance
- ios_finalize
- closeout

## Stale Sources
- none

## Top Failed Checks
- [primary] legal_host_tcp_443_reachable: app.sven.example.com:443 error=timeout
- [primary] legal_host_tcp_80_reachable: app.sven.example.com:80 error=timeout
- [primary] privacy_url_http_2xx_or_3xx: https://app.sven.example.com/privacy -> error=timeout (HEAD) [head=timeout; get=timeout]
- [primary] terms_url_http_2xx_or_3xx: https://app.sven.example.com/terms -> error=timeout (HEAD) [head=timeout; get=timeout]
- [primary] voiceover_artifact_present: docs/release/evidence/accessibility/voiceover-audit-2026-02-21.md (requires "Verdict: pass")
- [primary] cold_start_ios_p95_lt_3s: samples=0, p95=n/a < 3000
- [primary] ipa_size_lt_50mb: n/a < 50
- [primary] background_network_sample_captured: android(samples=1, p95=0), ios(samples=0, p95=n/a), limit=50000 bytes/min

## Suggested Commands
- SVEN_LEGAL_BASE_URL=https://app.sven.example.com npm run mobile:legal-urls:check
- npm run ops:mobile:c8:legal:bundle
- npm run ops:sh:diagnose:47matrix
- npm run ops:mobile:legal:ingress-evidence
- docs/ops/47matrix-ingress-remediation-c8-1.md
- npm run ops:mobile:adb:legal-urls

## Top Next Actions
- [c8_1_legal_android_probe] npm run ops:mobile:adb:legal-urls
- [c8_1_legal_host] npm run ops:mobile:c8:legal:bundle
- [c8_1_legal_matrix] npm run ops:mobile:c8:legal:matrix
- [c8_2_voiceover_verdict] npm run ops:mobile:ios:voiceover:set-verdict -- -Verdict pass -Auditor "<name>" -Device "<iphone model>" -IosVersion "<version>" -Notes "<notes>"
- [c8_3_ios_metrics] npm run ops:mobile:ios:c8:set-metrics -- -UseTelemetryFiles -AutoDetectIpa -ColdStartSamplesCsv "2800,2900,3000" -BackgroundNetworkSamplesCsv "0,0,12" -IpaSizeMb "42.1" -Device "<iphone model>" -IosVersion "<version>" -BuildRef "<build>" -Source "<testflight/xcode>" -Notes "<notes>"

## Source Freshness
- [fresh] legal_host: generated=2026-02-22T18:54:07.036Z age=7.7m
- [fresh] legal_android: generated=2026-02-22T20:54:44.7276052+02:00 age=7.1m
- [fresh] legal_matrix: generated=2026-02-22T18:53:43.4061636+00:00 age=8.1m
- [fresh] accessibility: generated=2026-02-22T18:55:25.354Z age=6.4m
- [fresh] performance: generated=2026-02-22T18:55:27.253Z age=6.4m
- [fresh] ios_finalize: generated=2026-02-22T17:37:11.6864666+00:00 age=84.6m
- [fresh] closeout: generated=2026-02-22T18:55:30.4811934+00:00 age=6.3m
- [fresh] pending: generated=2026-02-22T19:01:49.4079141+00:00 age=0m
- [fresh] next_actions: generated=2026-02-22T19:00:30.8099243+00:00 age=1.3m
- [fresh] pack: generated=2026-02-22T19:00:31.5640832+00:00 age=1.3m
- [fresh] legal_bundle: generated=2026-02-22T18:53:43.5242539+00:00 age=8.1m

## Artifacts
- legal_host: docs/release/status/mobile-legal-urls-latest.json
- legal_android: docs/release/status/mobile-legal-urls-android-latest.json
- legal_matrix: docs/release/status/mobile-c8-legal-matrix-latest.json
- accessibility: docs/release/status/mobile-accessibility-latest.json
- performance: docs/release/status/mobile-c8-performance-latest.json
- ios_finalize: docs/release/status/mobile-ios-c8-finalize-latest.json
- closeout: docs/release/status/mobile-c8-closeout-latest.json
- pending: docs/release/status/mobile-c8-pending-latest.json
- next_actions: docs/release/status/mobile-c8-next-actions-latest.json
- pack: docs/release/status/mobile-c8-pack-latest.json
- legal_bundle: docs/release/status/mobile-c8-legal-bundle-latest.json



