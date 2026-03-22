# Mobile C8 Next Actions

Generated: 2026-02-22T19:01:50.7991053+00:00
Status: blocked
BlockedAreas: 7
StaleSources: 0

## Ordered Actions
1. [c8_1_legal_android_probe] https://app.sven.example.com/privacy -> error=timeout
   step: From connected phone path rerun: npm run ops:mobile:adb:legal-urls
   run: npm run ops:mobile:adb:legal-urls
2. [c8_1_legal_host] https://app.sven.example.com/privacy -> error=timeout (HEAD) [head=timeout; get=timeout]
   step: Run edge remediation + rerun: npm run ops:mobile:c8:legal:bundle
   run: npm run ops:mobile:c8:legal:bundle
3. [c8_1_legal_matrix] status=fail; app.sven.example.com:host=fail,adb=fail; sven.example.com:host=fail,adb=fail
   step: Re-run dual-host checks after edge remediation: npm run ops:mobile:c8:legal:matrix
   run: npm run ops:mobile:c8:legal:matrix
4. [c8_2_voiceover_verdict] docs/release/evidence/accessibility/voiceover-audit-2026-02-21.md (requires "Verdict: pass")
   step: After manual iOS audit run: npm run ops:mobile:ios:voiceover:set-verdict -- -Verdict pass -Auditor "<name>" -Device "<iphone model>" -IosVersion "<version>" -Notes "<notes>"
   run: npm run ops:mobile:ios:voiceover:set-verdict -- -Verdict pass -Auditor "<name>" -Device "<iphone model>" -IosVersion "<version>" -Notes "<notes>"
5. [c8_3_ios_metrics] mobile-c8-ios-metrics-capture-latest.md missing required metadata and/or non-zero captured values
   step: Capture iOS metrics + provenance: npm run ops:mobile:ios:c8:set-metrics -- -UseTelemetryFiles -AutoDetectIpa -ColdStartSamplesCsv "2800,2900,3000" -BackgroundNetworkSamplesCsv "0,0,12" -IpaSizeMb "42.1" -Device "<iphone model>" -IosVersion "<version>" -BuildRef "<build>" -Source "<testflight/xcode>" -Notes "<notes>"
   run: npm run ops:mobile:ios:c8:set-metrics -- -UseTelemetryFiles -AutoDetectIpa -ColdStartSamplesCsv "2800,2900,3000" -BackgroundNetworkSamplesCsv "0,0,12" -IpaSizeMb "42.1" -Device "<iphone model>" -IosVersion "<version>" -BuildRef "<build>" -Source "<testflight/xcode>" -Notes "<notes>"
6. [c8_ios_template] Generate a pre-filled iOS finalize command template before manual iOS closure.
   step: Generate template: npm run ops:mobile:ios:c8:template
   run: npm run ops:mobile:ios:c8:template
7. [c8_ios_finalize_input_check] Refresh-only: awaiting manual iOS VoiceOver and iOS metrics inputs. (missing_inputs=device,ios_version,build_ref,source,cold_start_samples_csv,background_network_samples_csv,ipa_size_mb_or_ipa_artifact_path)
   step: Populate finalize inputs: npm run ops:mobile:ios:c8:finalize -- -VoiceOverVerdict pass -Auditor "<name>" -Device "<iphone model>" -IosVersion "<version>" -UseTelemetryFiles -AutoDetectIpa -ColdStartSamplesCsv "2800,2900,3000" -BackgroundNetworkSamplesCsv "0,0,12" -IpaSizeMb "42.1" -BuildRef "<build>" -Source "<testflight/xcode>" -VoiceOverNotes "<notes>" -MetricsNotes "<notes>" -RunCloseout
   run: npm run ops:mobile:ios:c8:finalize -- -VoiceOverVerdict pass -Auditor "<name>" -Device "<iphone model>" -IosVersion "<version>" -UseTelemetryFiles -AutoDetectIpa -ColdStartSamplesCsv "2800,2900,3000" -BackgroundNetworkSamplesCsv "0,0,12" -IpaSizeMb "42.1" -BuildRef "<build>" -Source "<testflight/xcode>" -VoiceOverNotes "<notes>" -MetricsNotes "<notes>" -RunCloseout



