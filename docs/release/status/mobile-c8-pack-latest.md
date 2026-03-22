# Mobile C8 Review Pack

Generated: 2026-02-22T19:01:51.4857334+00:00
Status: fail

## Core Artifacts
- closeout: docs/release/status/mobile-c8-closeout-latest.md
- index: docs/release/status/mobile-c8-index-latest.md
- next_actions: docs/release/status/mobile-c8-next-actions-latest.md
- pending: docs/release/status/mobile-c8-pending-latest.md
- legal_bundle: docs/release/status/mobile-c8-legal-bundle-latest.md
- legal_matrix: docs/release/status/mobile-c8-legal-matrix-latest.md

## Status Summary
- closeout: fail
- index: blocked
- next_actions: blocked
- pending: blocked

## Top Failed Checks
- [primary] legal_host_tcp_443_reachable: app.sven.example.com:443 error=timeout
- [primary] legal_host_tcp_80_reachable: app.sven.example.com:80 error=timeout
- [primary] privacy_url_http_2xx_or_3xx: https://app.sven.example.com/privacy -> error=timeout (HEAD) [head=timeout; get=timeout]
- [primary] terms_url_http_2xx_or_3xx: https://app.sven.example.com/terms -> error=timeout (HEAD) [head=timeout; get=timeout]
- [primary] voiceover_artifact_present: docs/release/evidence/accessibility/voiceover-audit-2026-02-21.md (requires "Verdict: pass")
- [primary] cold_start_ios_p95_lt_3s: samples=0, p95=n/a < 3000
- [primary] ipa_size_lt_50mb: n/a < 50
- [primary] background_network_sample_captured: android(samples=1, p95=0), ios(samples=0, p95=n/a), limit=50000 bytes/min

## Top Next Actions
1. [c8_1_legal_android_probe] npm run ops:mobile:adb:legal-urls
2. [c8_1_legal_host] npm run ops:mobile:c8:legal:bundle
3. [c8_1_legal_matrix] npm run ops:mobile:c8:legal:matrix
4. [c8_2_voiceover_verdict] npm run ops:mobile:ios:voiceover:set-verdict -- -Verdict pass -Auditor "<name>" -Device "<iphone model>" -IosVersion "<version>" -Notes "<notes>"
5. [c8_3_ios_metrics] npm run ops:mobile:ios:c8:set-metrics -- -UseTelemetryFiles -AutoDetectIpa -ColdStartSamplesCsv "2800,2900,3000" -BackgroundNetworkSamplesCsv "0,0,12" -IpaSizeMb "42.1" -Device "<iphone model>" -IosVersion "<version>" -BuildRef "<build>" -Source "<testflight/xcode>" -Notes "<notes>"
6. [c8_ios_template] npm run ops:mobile:ios:c8:template

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



