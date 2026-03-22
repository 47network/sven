# iOS C8 Finalize Input Template

Generated: 2026-02-22T18:59:29.7160329+00:00

## Recommended Command
```powershell
npm run ops:mobile:ios:c8:finalize -- -VoiceOverVerdict pass -Auditor "<auditor>" -Device "<iphone model>" -IosVersion "<ios version>" -ColdStartSamplesCsv "2800,2900,3000" -BackgroundNetworkSamplesCsv "0,0,12" -IpaSizeMb "42.1" -BuildRef "<build ref>" -Source "<testflight/xcode>" -VoiceOverNotes "Manual VoiceOver audit completed" -MetricsNotes "Captured during iOS release validation" -RunCloseout
```

## Field Values
- Auditor: <auditor>
- Device: <iphone model>
- iOS: <ios version>
- BuildRef: <build ref>
- Source: <testflight/xcode>
- ColdStartSamplesCsv: 2800,2900,3000
- BackgroundNetworkSamplesCsv: 0,0,12
- IpaSizeMb: 42.1
- UseTelemetryFiles: False
- AutoDetectIpa: False

Edit the values above (or pass explicit args) before running the command in strict closeout workflows.


