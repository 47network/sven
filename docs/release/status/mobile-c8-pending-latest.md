# Mobile C8 Pending Inputs

Generated: 2026-02-22T19:01:49.4079141+00:00
Status: blocked

## Pending Items
- [pending] c8_1_legal_host: https://app.sven.example.com/privacy -> error=timeout (HEAD) [head=timeout; get=timeout]
  next: Run edge remediation + rerun: npm run ops:mobile:c8:legal:bundle
- [pending] c8_1_legal_android_probe: https://app.sven.example.com/privacy -> error=timeout
  next: From connected phone path rerun: npm run ops:mobile:adb:legal-urls
- [pending] c8_1_legal_matrix: status=fail; app.sven.example.com:host=fail,adb=fail; sven.example.com:host=fail,adb=fail
  next: Re-run dual-host checks after edge remediation: npm run ops:mobile:c8:legal:matrix
- [pending] c8_2_voiceover_verdict: docs/release/evidence/accessibility/voiceover-audit-2026-02-21.md (requires "Verdict: pass")
  next: After manual iOS audit run: npm run ops:mobile:ios:voiceover:set-verdict -- -Verdict pass -Auditor "<name>" -Device "<iphone model>" -IosVersion "<version>" -Notes "<notes>"
- [pending] c8_3_ios_metrics: mobile-c8-ios-metrics-capture-latest.md missing required metadata and/or non-zero captured values
  next: Capture iOS metrics + provenance: npm run ops:mobile:ios:c8:set-metrics -- -UseTelemetryFiles -AutoDetectIpa -ColdStartSamplesCsv "2800,2900,3000" -BackgroundNetworkSamplesCsv "0,0,12" -IpaSizeMb "42.1" -Device "<iphone model>" -IosVersion "<version>" -BuildRef "<build>" -Source "<testflight/xcode>" -Notes "<notes>"
- [pending] c8_ios_finalize_input_check: Refresh-only: awaiting manual iOS VoiceOver and iOS metrics inputs. (missing_inputs=device,ios_version,build_ref,source,cold_start_samples_csv,background_network_samples_csv,ipa_size_mb_or_ipa_artifact_path)
  next: Populate finalize inputs: npm run ops:mobile:ios:c8:finalize -- -VoiceOverVerdict pass -Auditor "<name>" -Device "<iphone model>" -IosVersion "<version>" -UseTelemetryFiles -AutoDetectIpa -ColdStartSamplesCsv "2800,2900,3000" -BackgroundNetworkSamplesCsv "0,0,12" -IpaSizeMb "42.1" -BuildRef "<build>" -Source "<testflight/xcode>" -VoiceOverNotes "<notes>" -MetricsNotes "<notes>" -RunCloseout

## Source Status Freshness
- [fresh] mobile_legal_urls_host: generated=2026-02-22T18:54:07.036Z age=7.7m
- [fresh] mobile_legal_urls_android: generated=2026-02-22T20:54:44.7276052+02:00 age=7.1m
- [fresh] mobile_c8_legal_matrix: generated=2026-02-22T18:53:43.4061636+00:00 age=8.1m
- [fresh] mobile_accessibility: generated=2026-02-22T18:55:25.354Z age=6.4m
- [fresh] mobile_c8_performance: generated=2026-02-22T18:55:27.253Z age=6.4m
- [fresh] mobile_ios_c8_finalize: generated=2026-02-22T17:37:11.6864666+00:00 age=84.6m


