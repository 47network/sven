# Mobile Telemetry Samples (C8.3)

Use plain numeric lines (milliseconds or bytes/minute depending on file).

Files consumed by C8.3 gate:

- `cold_start_android_samples.txt` (ms)
- `cold_start_ios_samples.txt` (ms)
- `background_network_android_samples.txt` (bytes/min)
- `background_network_ios_samples.txt` (bytes/min)

Commands:

- Android cold-start telemetry capture:
  - `npm run ops:mobile:adb:startup-telemetry`
- Android background network capture:
  - `npm run ops:mobile:adb:network-idle`
- iOS metrics ingestion (from manual run/App Store artifact data):
  - `npm run ops:mobile:ios:c8:set-metrics -- -ColdStartSamplesCsv "2900,2950,2980" -BackgroundNetworkSamplesCsv "0,120,80" -IpaSizeMb "49.2"`
- Refresh evidence + run gate:
  - `npm run mobile:c8:evidence:refresh`
  - `npm run mobile:c8:performance:check`
