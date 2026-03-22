# Section K: Security & Privacy

**Date**: 2026-02-16  
**Status**: In progress (initial security controls applied)

## 1. Guiding security baseline

We follow the UI App Security Baseline (`docs/security/ui-app-security-baseline.md`, 2026-02-13) that covers authentication/session safety, transport policies, authorization scope, content safety, platform hardening, supply-chain controls, and operational runbooks. That document is the authoritative source for all UI clients (mobile, desktop, web, CLI) and is enforced by the `security-baseline.yml` workflow which runs:

- Static analysis and vulnerability scans
- `scripts/security-plaintext-secrets-check.cjs` for detecting hard-coded credentials
- Build reproducibility and signed artifact verification gates

## 2. Client-level controls implemented in Flutter

- **Token storage** – `apps/companion-user-flutter/lib/features/auth/token_store.dart` writes access/refresh tokens into `flutter_secure_storage` on mobile/desktop and falls back to `SharedPreferences` on web only because the Web platform lacks a native secure store. On every logout/refresh we delete both keys, and no other part of the app prints or persists tokens in logs or user-visible state.
- **TLS-enforced endpoints** – `apps/companion-user-flutter/lib/features/auth/auth_service.dart` sources `_apiBase` from a compile-time environment defaulting to `https://app.sven.example.com`. There are no unsafe HTTP fallbacks, and the security workflow ensures all deployment environments pin TLS certificates and reject invalid cert chains.
- **Secrets hygiene** – In addition to the `security-plaintext-secrets-check.cjs` script the pipeline runs, we keep runtime configuration in environment variables (via `String.fromEnvironment`) and never embed admin or long-lived tokens in the Flutter asset bundle.
- **Telemetry + logging** – `Telemetry.logEvent` outputs structured JSON via `debugPrint` and only includes semantic metrics (latency, status flags) without sensitive payloads. Crash or log reports from Flutter never surface token strings.
- **Privacy disclosures** – Telemetry events emitted (startup, chat latency) contain only anonymous latency metrics and mode labels; they are documented for stakeholders so the privacy policy can describe what the Flutter client collects.

## 3. Operational safeguards

- The team maintains the `security-token-compromise-and-key-rotation.md` runbook to respond to token/user compromise scenarios, covering containment, rotation precedence, smoke checks, and communications.
- Security-phase evidence (phase1/phase2/phase3, `docs/release/evidence/security-baseline-phase*-2026-02-13.md`) documents the verification of controls against the baseline, including HTTPS enforcement, CSP/CORS hardening, dependency review, and vulnerability remediation.
- A security sign-off for the release candidate exists in `docs/release/signoffs/security-signoff-2026-02-14-rc.md` (approved by hantz).

## 4. Next validation steps (remaining Section K bullets)

### 4.1 API auth headers & token lifecycle audit

- Capture a request/response trace for `/v1/auth/login`, `/v1/auth/refresh`, and `/v1/auth/logout` from both Flutter mobile and Flutter web clients (network profiler or `curl` with the same headers). Validate the `Authorization: Bearer` header is set as expected, refresh rotates the session id, and the body includes the `access_token`/`refresh_token` fields we store via `TokenStore`.
- Confirm the backend logs (or telemetry) show corresponding audit entries for these flows and that invalid tokens lead to the `SESSION_EXPIRED` code documented in `services/gateway-api/src/routes/auth.ts`.

### 4.2 Privacy policy alignment

- Review the published privacy disclosure (e.g., `docs/release/privacy/privacy-policy-2026.md` if it exists or the latest `privacy` entry in the release notes) to ensure it mentions `startup.*` and `chat.stream.first_token` telemetry events. If the policy needs updating, document the new analytics fields and submit the revision alongside the release.
- Re-run the `Telemetry.logEvent` data exporter used by operations to confirm no additional PII fields (tokens, user text) were added since the last policy revision.

### 4.3 Mobile signing & provenance

- Confirm the Android/iOS release binaries are signed with the gating certificates referenced in `docs/architecture/release-signing-strategy-2026.md` (if present) or the release pipeline variables (look for `ANDROID_KEYSTORE_PATH`, `IOS_KEYCHAIN` in the CI workflow). Archive the signing metadata/artifact hashes in `docs/release/status/release-artifacts-latest.json`.
- Verify the release pipeline publishes the digest (SHA256) for each signed binary and include that digest in the release evidence bucket so compliance can cross-check it later.

### 4.4 Web build integrity

- After building the Flutter web bundle, capture the artifact hash(es) (`sha256sum` of `build/web/main.dart.js`, `main.dart.js.map`, and `flutter_service_worker.js`) and store them alongside `docs/release/status/release-artifacts-latest.json`.
- Confirm the CDN deployment references those hashes and that the HTTP headers (e.g., `Content-Security-Policy`, `Strict-Transport-Security`) align with the security baseline.

Once these validations pass we can mark all Section K checklist bullets complete and move to Section L (Rollout & Operations).

Once these validations pass we can mark all Section K checklist bullets complete and move to Section L (Rollout & Operations).
