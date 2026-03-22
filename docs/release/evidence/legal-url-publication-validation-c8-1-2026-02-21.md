# Evidence: Legal URL Publication Validation (C8.1)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C8.1`

## Scope

- Items:
  - `Privacy policy URL published`
  - `Terms of service URL published`

## Implementation

- Added reproducible publication check:
  - `scripts/mobile-legal-urls-check.cjs`
  - npm command: `npm run mobile:legal-urls:check`
  - Updated (2026-02-22): protocol-aware requester (`http`/`https`) + dual-method timeout detail (`HEAD` and `GET`) in failure output
  - Updated (2026-02-22): host-scoped status outputs emitted on every run:
    - `docs/release/status/mobile-legal-urls-<host>-latest.json`
    - `docs/release/status/mobile-legal-urls-<host>-latest.md`
    - keeps `mobile-legal-urls-latest.*` as compatibility alias
  - Supports base override for remote validation hosts:
    - `SVEN_LEGAL_BASE_URL=https://app.sven.example.com npm run mobile:legal-urls:check`
- Target URLs validated by the check:
  - `https://app.sven.example.com/privacy`
  - `https://app.sven.example.com/terms`
- Added connected-Android validation helper:
  - `scripts/ops/mobile/check-legal-urls-from-adb.ps1`
  - npm command: `npm run ops:mobile:adb:legal-urls`
  - Updated (2026-02-22): host-scoped Android outputs emitted on every run:
    - `docs/release/status/mobile-legal-urls-android-<host>-latest.json`
    - `docs/release/status/mobile-legal-urls-android-<host>-latest.md`
    - keeps `mobile-legal-urls-android-latest.*` as compatibility alias
- Added ingress diagnose evidence capture helper:
  - `scripts/ops/mobile/capture-47matrix-ingress-diagnose.ps1`
  - npm command: `npm run ops:mobile:legal:ingress-evidence`

## Validation

- Command run:
  - `node scripts/mobile-legal-urls-check.cjs`
  - `npm run ops:sh:diagnose:47matrix`
- Status artifacts:
  - `docs/release/status/mobile-legal-urls-latest.json`
  - `docs/release/status/mobile-legal-urls-latest.md`
  - `docs/release/status/mobile-legal-urls-android-latest.json`
  - `docs/release/status/mobile-legal-urls-android-latest.md`
  - `docs/release/evidence/legal-ingress-diagnose-latest.md`
- Current result (2026-02-21):
  - `Status: fail`
  - DNS check: pass (`app.sven.example.com -> 86.122.81.64`)
  - TCP checks: fail (`app.sven.example.com:443 -> timeout`, `app.sven.example.com:80 -> timeout`)
  - `/privacy` -> timeout
  - `/terms` -> timeout

## Latest strict closeout rerun (2026-02-22T16:54Z)

- `mobile:legal-urls:check` still fails with network timeouts from validator host:
  - `/privacy` -> `error=timeout (HEAD) [head=timeout; get=timeout]`
  - `/terms` -> `error=timeout (HEAD) [head=timeout; get=timeout]`
- Connected Android probe still fails with timeout for base/privacy/terms.
- Dual-host matrix remains failed on both host and Android path.

## Dual-host matrix rerun (2026-02-22T16:57Z)

- Command:
  - `npm run ops:mobile:c8:legal:matrix`
- Result:
  - both hosts still fail on host path and Android probe.
- Artifacts now include stable per-host snapshots generated directly by check scripts:
  - `docs/release/status/mobile-legal-urls-app.sven.example.com-latest.*`
  - `docs/release/status/mobile-legal-urls-sven.example.com-latest.*`
  - `docs/release/status/mobile-legal-urls-android-app.sven.example.com-latest.*`
  - `docs/release/status/mobile-legal-urls-android-sven.example.com-latest.*`

## Matrix/bundle reliability update (2026-02-22T16:59Z)

- `scripts/ops/mobile/mobile-c8-legal-host-matrix.ps1` now consumes host-scoped status files directly instead of copying from shared `latest` aliases.
- This removes alias-copy coupling and makes matrix evidence atomic per host.
- Validation run:
  - `npm run ops:mobile:c8:legal:matrix`
  - `npm run ops:mobile:c8:legal:bundle`
- Outcome:
  - script behavior correct and artifacts consistent;
  - legal checks still fail due unchanged external ingress timeout conditions.

## Latest alias-preservation update (2026-02-22T17:12Z)

- Matrix mode now sets `SVEN_LEGAL_WRITE_LATEST_ALIAS=0` for per-host probe runs.
- Effect:
  - shared `mobile-legal-urls-latest.*` and `mobile-legal-urls-android-latest.*` remain pinned to the primary host check context;
  - matrix runs emit/update only host-scoped snapshots.
- Validation:
  - primary check run with base `https://app.sven.example.com`
  - matrix run completed
  - verified shared alias files still target `https://app.sven.example.com`

## Atomic write safeguard (2026-02-22T17:09Z)

- `scripts/mobile-legal-urls-check.cjs` now writes JSON/MD artifacts using atomic temp-file+rename semantics.
- Purpose:
  - prevent partial/corrupt `mobile-legal-urls-*.json` on interrupted writes or concurrent execution windows.
- Validation:
  - strict single-host run + matrix run completed;
  - parsed `mobile-legal-urls-latest.json` cleanly after runs (no trailing corruption).

### Additional network diagnostics (2026-02-22)

- DNS resolves from validation host:
  - `app.sven.example.com -> 86.122.81.64`
- TCP/HTTPS connectivity from this host to `86.122.81.64:443` times out.
- ICMP ping to `86.122.81.64` also timed out in this environment.
- WSL path check (`curl` from Linux userspace) also timed out to `/privacy` and `/terms`.
- Interpretation: this blocker is currently host/network reachability, not missing route code in this repository.

### Connected Android device verification (2026-02-22)

- Device: `SM-A515F` (`Android 13`, adb id `R58N94KML7J`)
- Commands:
  - `adb shell "curl -I -m 15 https://app.sven.example.com/privacy"`
  - `adb shell "curl -I -m 15 https://app.sven.example.com/terms"`
- Results:
  - `/privacy` -> `curl: (28) Connection timed out after 15001 milliseconds`
  - `/terms` -> `curl: (28) Connection timed out after 15001 milliseconds`
- Interpretation:
  - Timeout reproduces on physical Android device network path as well, which further supports infrastructure reachability/TLS edge path as the blocker.

### Shared host reachability probe (2026-02-22)

- Additional commands from connected Android device:
  - `adb shell "curl -I -m 12 https://sven.example.com/"`
  - `adb shell "curl -I -m 12 https://app.sven.example.com/"`
  - `adb shell "ping -c 1 -W 2 86.122.81.64"`
- Results:
  - Both HTTPS probes timed out.
  - ICMP probe had 100% packet loss.
- Interpretation:
  - Issue appears to affect shared public ingress path, not only `/privacy` and `/terms` endpoints.

### HTTP fallback and transport probe (2026-02-22)

- Additional commands from connected Android device:
  - `adb shell "curl -I -m 12 http://app.sven.example.com/privacy"`
  - `adb shell "curl -I -m 12 http://app.sven.example.com/terms"`
  - `adb shell "curl -I -m 12 http://sven.example.com/"`
- Results:
  - All HTTP probes also timed out (no redirect response observed).
- Cellular-path attempt:
  - `adb shell "svc wifi disable; svc data enable; ...; curl ...; svc wifi enable"`
  - Result during that attempt: `curl: (6) Could not resolve host: app.sven.example.com`
  - Wi-Fi state was restored after the test (`Wi-Fi is enabled`).
- Interpretation:
  - Reachability issue is upstream of app routing and currently reproducible across protocol variants from this device path.

### Raw TCP probe matrix (2026-02-22)

- Connected Android device (toybox netcat):
  - `adb shell "sh -c 'for p in 80 443 8088; do echo | toybox nc -w 5 86.122.81.64 $p; echo exit:$?; done'"`
  - Result: exit code `1` for ports `80`, `443`, and `8088`.
- Validation host (PowerShell TcpClient, 5s timeout):
  - `80 -> timeout_or_blocked`
  - `443 -> timeout_or_blocked`
  - `8088 -> timeout_or_blocked`
- Interpretation:
  - Transport-level connectivity to the public IP is blocked/timing out across all tested web ports from both host and connected Android device.

### Consolidated ingress diagnostic run (2026-02-22)

- Command:
  - `npm run ops:sh:diagnose:47matrix`
- Key output:
  - DNS resolves both hosts to `86.122.81.64`
  - All HTTP/HTTPS probes returned timeout (`status=000`)
  - Local listener snapshot in this environment shows `*:8088` only, no `:80`/`:443`
  - Nginx/firewall tooling not present in this environment (`nginx`, `ufw`, `nft`, `iptables` missing)
- Interpretation:
  - Current failure signature is consistent with edge listener/bind/firewall exposure gap on public ingress rather than missing legal page routes.

### Control vs target connectivity verification (2026-02-22)

- Goal:
  - Verify whether failures are specific to Sven public ingress or general outbound connectivity.
- Host control checks:
  - `Invoke-WebRequest -Method Head https://example.com` -> `200`
  - `Test-NetConnection example.com:443` -> `True`
  - `Test-NetConnection app.sven.example.com:443` -> `False` (TCP connect failed)
- Connected Android control check:
  - `adb shell "curl -I -m 15 https://example.com"` -> `HTTP/1.1 200 OK`
- Target checks (same run window):
  - `npm run ops:mobile:c8:legal:matrix` -> both `app.sven.example.com` and `sven.example.com` failed for host and Android probes.
- Interpretation:
  - General external internet access is working from both host and device.
  - Reachability failure is specific to Sven public ingress endpoints, consistent with external edge/network exposure issue.

## Result

- Validation tooling is in place, but live publication cannot be confirmed from this environment yet.
- Checklist items remain unchecked pending successful HTTP verification.
- Remediation runbook for edge host execution:
  - `docs/ops/47matrix-ingress-remediation-c8-1.md`

### Latest ingress capture artifact

- Timestamp: 2026-02-22T20:47:54.7371576+02:00
- Exit code: 0
- Artifact: `docs/release/evidence/legal-ingress-diagnose-20260222-204754.md`
- Latest alias: `docs/release/evidence/legal-ingress-diagnose-latest.md`
### Connected phone network-path differential probe (2026-02-22)

- Artifact:
  - `docs/release/evidence/legal-phone-network-path-probe-20260222-205445.md`
  - alias: `docs/release/evidence/legal-phone-network-path-probe-latest.md`
- Device:
  - `R58N94KML7J`
- Results:
  - Wi-Fi path (`https://app.sven.example.com[/privacy]`) timed out (`curl: (28)`).
  - Cellular-path attempt returned DNS failure (`curl: (6) Could not resolve host`).
- Interpretation:
  - Confirms path-level failure persists on phone-side probes and remains outside repo route logic.

### Legal bundle automation update (2026-02-22T17:47Z)

- `scripts/ops/mobile/mobile-c8-legal-bundle.ps1` now invokes `ops:mobile:adb:legal-path-probe` as a standard bundle step.
- Bundle outputs now include:
  - step: `ops_mobile_adb_legal_path_probe`
  - artifact: `docs/release/evidence/legal-phone-network-path-probe-latest.md`
- Validation:
  - `npm run ops:mobile:c8:legal:bundle` recorded the new step as `pass` while strict bundle result remained `fail` due unresolved ingress host/matrix checks.

### Closeout suggestion update (2026-02-22T17:59Z)

- `scripts/ops/mobile/mobile-c8-closeout.ps1` now detects failed Android control probe (`android_control_url_http_2xx_or_3xx`) and emits targeted network/DNS remediation suggestions before re-running Android legal probes.
- Validation:
  - `npm run ops:mobile:c8:closeout` output now includes:
    - `adb shell "svc wifi enable; svc data disable"; adb shell "cmd wifi status"; adb shell "getprop net.dns1"`
    - `npm run ops:mobile:adb:legal-urls`

### Android DNS diagnostic helper (2026-02-22T20:04+02:00)

- Added reusable diagnostic script:
  - `scripts/ops/mobile/capture-android-network-dns-diagnostic.ps1`
  - npm command: `npm run ops:mobile:adb:network-dns-diagnostic`
- Latest diagnostic artifact:
  - `docs/release/evidence/android-network-dns-diagnostic-20260222-205524.md`
  - alias: `docs/release/evidence/android-network-dns-diagnostic-latest.md`

### Closeout DNS diagnostic integration (2026-02-22T18:13Z)

- `scripts/ops/mobile/mobile-c8-closeout.ps1` now auto-runs:
  - `ops:mobile:adb:network-dns-diagnostic`
- Closeout summary now includes:
  - `android_network_dns_diagnostic: present|missing`
  - linked artifact `android_network_dns_diagnostic_latest`
- Validation:
  - `npm run ops:mobile:c8:closeout` generated:
    - `docs/release/evidence/legal-phone-network-path-probe-20260222-205445.md`
    - `docs/release/evidence/android-network-dns-diagnostic-20260222-205524.md`

### Legal bundle DNS diagnostic integration (2026-02-22T18:11Z)

- `scripts/ops/mobile/mobile-c8-legal-bundle.ps1` now invokes:
  - `ops:mobile:adb:network-dns-diagnostic`
- Bundle outputs now include:
  - step: `ops_mobile_adb_network_dns_diagnostic`
  - artifact: `docs/release/evidence/android-network-dns-diagnostic-latest.md`

### Android control probe update (2026-02-22T19:57+02:00)

- `scripts/ops/mobile/check-legal-urls-from-adb.ps1` now includes:
  - `android_control_url_http_2xx_or_3xx` -> `https://example.com`
- Purpose:
  - distinguish global phone DNS/network failure from Sven-host-specific ingress failure.
- Current result snapshot:
  - `android_control_url_http_2xx_or_3xx: https://example.com -> status=200`
  - `android_base_url_http_2xx_or_3xx: https://app.sven.example.com -> error=timeout`
  - `android_privacy_url_http_2xx_or_3xx: https://app.sven.example.com/privacy -> error=timeout`
  - `android_terms_url_http_2xx_or_3xx: https://app.sven.example.com/terms -> error=timeout`
- Artifact:
  - `docs/release/status/mobile-legal-urls-android-latest.md`

### Latest strict closeout snapshot (2026-02-22T18:53Z)

- Command:
  - `npm run ops:mobile:c8:closeout`
- Summary:
  - `legal_urls: fail`
  - `legal_urls_android_probe: fail`
  - `legal_urls_matrix: fail`
  - `legal_phone_path_probe: present`
  - `android_network_dns_diagnostic: present`
- Interpretation:
  - Control endpoint on device remains reachable while Sven legal URLs continue timing out, reinforcing an ingress-path-specific blocker.

### Phone path probe output cleanup (2026-02-22T20:46+02:00)

- Updated `scripts/ops/mobile/capture-legal-phone-network-path-probe.ps1` to capture adb output via `Start-Process` redirection.
- Latest probe artifact now records clean curl-only outcomes (timeout/DNS), without PowerShell `NativeCommandError` wrapper lines.








