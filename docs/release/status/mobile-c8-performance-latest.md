# Mobile C8.3 Performance Check

Generated: 2026-02-22T18:55:27.253Z
Mode: strict
Status: fail
Evidence: docs/release/evidence/mobile-c8-remaining-validation-2026-02-22.md

## Checks
- [x] cold_start_android_p95_lt_3s: samples=20, p95=608 < 3000
- [ ] cold_start_ios_p95_lt_3s: samples=0, p95=n/a < 3000
- [x] apk_size_lt_50mb: 30.2 < 50
- [ ] ipa_size_lt_50mb: n/a < 50
- [ ] background_network_sample_captured: android(samples=1, p95=0), ios(samples=0, p95=n/a), limit=50000 bytes/min
- [ ] ios_metrics_provenance_present: mobile-c8-ios-metrics-capture-latest.md missing required metadata and/or non-zero captured values

