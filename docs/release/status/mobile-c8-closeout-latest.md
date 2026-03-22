# Mobile C8 Closeout Summary

Generated: 2026-02-22T18:53:36.5675448+00:00
- legal_urls: fail
- legal_urls_android_probe: fail
- legal_urls_matrix: fail
- accessibility: fail
- c8_performance: fail
- legal_ingress_capture: present
- legal_phone_path_probe: present
- android_network_dns_diagnostic: present
- legal_bundle_status: present
- legal_matrix_status: present
- ios_finalize_status: present
- pending_inputs_status: present
- c8_index_status: present
- c8_next_actions_status: present
- c8_pack_status: present
- c8_index_blocked_areas: 7
- c8_index_stale_sources: 0
- pending_source_freshness: stale=0

## Failed Checks
- [primary] legal_host_tcp_443_reachable: app.sven.example.com:443 error=timeout
- [primary] legal_host_tcp_80_reachable: app.sven.example.com:80 error=timeout
- [primary] privacy_url_http_2xx_or_3xx: https://app.sven.example.com/privacy -> error=timeout (HEAD) [head=timeout; get=timeout]
- [primary] terms_url_http_2xx_or_3xx: https://app.sven.example.com/terms -> error=timeout (HEAD) [head=timeout; get=timeout]
- [primary] voiceover_artifact_present: docs/release/evidence/accessibility/voiceover-audit-2026-02-21.md (requires "Verdict: pass")
- [primary] cold_start_ios_p95_lt_3s: samples=0, p95=n/a < 3000
- [primary] ipa_size_lt_50mb: n/a < 50
- [primary] background_network_sample_captured: android(samples=1, p95=0), ios(samples=0, p95=n/a), limit=50000 bytes/min
- [primary] ios_metrics_provenance_present: mobile-c8-ios-metrics-capture-latest.md missing required metadata and/or non-zero captured values
- [android_probe] android_base_url_http_2xx_or_3xx: https://app.sven.example.com -> error=timeout
- [android_probe] android_privacy_url_http_2xx_or_3xx: https://app.sven.example.com/privacy -> error=timeout
- [android_probe] android_terms_url_http_2xx_or_3xx: https://app.sven.example.com/terms -> error=timeout
- [matrix] app.sven.example.com: host=app.sven.example.com host_check=fail adb_check=fail
- [matrix] sven.example.com: host=sven.example.com host_check=fail adb_check=fail

## Suggested Commands
- SVEN_LEGAL_BASE_URL=https://app.sven.example.com npm run mobile:legal-urls:check
- npm run ops:mobile:c8:legal:bundle
- npm run ops:sh:diagnose:47matrix
- npm run ops:mobile:legal:ingress-evidence
- docs/ops/47matrix-ingress-remediation-c8-1.md
- npm run ops:mobile:adb:legal-urls
- npm run ops:mobile:c8:legal:matrix
- npm run ops:mobile:ios:voiceover:set-verdict -- -Verdict pass -Auditor "<name>" -Device "<iphone model>" -IosVersion "<version>" -Notes "<notes>"
- npm run ops:mobile:ios:c8:finalize -- -VoiceOverVerdict pass -Auditor "<name>" -Device "<iphone model>" -IosVersion "<version>" -UseTelemetryFiles -AutoDetectIpa -ColdStartSamplesCsv "2800,2900,3000" -BackgroundNetworkSamplesCsv "0,0,12" -IpaSizeMb "42.1" -BuildRef "<build>" -Source "<testflight/xcode>" -VoiceOverNotes "<notes>" -MetricsNotes "<notes>" -RunCloseout
- npm run ops:mobile:ios:c8:set-metrics -- -UseTelemetryFiles -AutoDetectIpa -ColdStartSamplesCsv "2800,2900,3000" -BackgroundNetworkSamplesCsv "0,0,12" -IpaSizeMb "42.1" -Device "<iphone model>" -IosVersion "<version>" -BuildRef "<build>" -Source "<testflight/xcode>" -Notes "<notes>"
- npm run mobile:c8:evidence:refresh && npm run mobile:c8:performance:check
- docs/release/status/mobile-c8-index-latest.md
- docs/release/status/mobile-c8-pack-latest.md

## C8 Index Snapshot
- index_status: blocked
- blocked_area: legal_host
- blocked_area: legal_android
- blocked_area: legal_matrix
- blocked_area: accessibility
- blocked_area: performance
- blocked_area: ios_finalize
- blocked_area: closeout
- stale_source: none

## Source Status Freshness
- [fresh] mobile_legal_urls_host: generated=2026-02-22T18:54:07.036Z age=1.3m
- [fresh] mobile_legal_urls_android: generated=2026-02-22T20:54:44.7276052+02:00 age=0.7m
- [fresh] mobile_c8_legal_matrix: generated=2026-02-22T18:53:43.4061636+00:00 age=1.7m
- [fresh] mobile_accessibility: generated=2026-02-22T18:55:25.354Z age=0m
- [fresh] mobile_c8_performance: generated=2026-02-22T18:55:27.253Z age=0m
- [fresh] mobile_ios_c8_finalize: generated=2026-02-22T17:37:11.6864666+00:00 age=78.3m

## Linked Artifacts
- ingress_capture_latest: docs/release/evidence/legal-ingress-diagnose-latest.md
- legal_phone_path_probe_latest: docs/release/evidence/legal-phone-network-path-probe-latest.md
- android_network_dns_diagnostic_latest: docs/release/evidence/android-network-dns-diagnostic-latest.md
- legal_bundle_status_latest: docs/release/status/mobile-c8-legal-bundle-latest.md
- legal_matrix_status_latest: docs/release/status/mobile-c8-legal-matrix-latest.md
- ios_finalize_status_latest: docs/release/status/mobile-ios-c8-finalize-latest.md
- pending_inputs_status_latest: docs/release/status/mobile-c8-pending-latest.md
- c8_index_status_latest: docs/release/status/mobile-c8-index-latest.md
- c8_next_actions_latest: docs/release/status/mobile-c8-next-actions-latest.md
- c8_pack_latest: docs/release/status/mobile-c8-pack-latest.md


