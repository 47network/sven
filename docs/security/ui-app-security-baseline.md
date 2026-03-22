# UI App Security Baseline

Date: 2026-02-13  
Applies to: mobile (`apps/companion-mobile`), web (`apps/admin-ui`, `apps/canvas-ui`), desktop (Tauri), CLI (`packages/cli`)

## 1. Authentication and Session Security

- Use device flow / OAuth-style delegated tokens only.
- Never embed long-lived admin tokens in shipped clients.
- Enforce token expiry and refresh; support explicit revocation.
- Store secrets only in platform secure stores:
  - Mobile: Keychain/Keystore
  - Desktop: OS credential vault via Tauri secure plugins
  - CLI: OS keychain if available; otherwise encrypted local store

## 2. Transport and Network Controls

- HTTPS only for all production endpoints.
- Reject invalid TLS certificates.
- Enforce strict origin/host allowlists in clients and backend CORS policies.
- Disable cleartext fallback in production clients.

## 3. Authorization and Privilege Boundaries

- Server-side RBAC is authoritative; client UI flags are not security controls.
- Scope tokens by capability (chat, approvals, admin, automation).
- Require step-up auth for high-risk actions (policy changes, secret ops, destructive commands).

## 4. Input/Output and Content Safety

- Validate and sanitize all user-supplied content before rendering.
- Block dangerous markdown/HTML script vectors in web/desktop renderers.
- Strip secrets from logs, telemetry, and crash reports.
- Apply output guards for tool invocation and shell execution previews.

## 5. Platform-Specific Hardening

### Mobile
- Minimize runtime permissions; request on-demand only.
- Protect screenshots on sensitive views where feasible.
- Use certificate pinning where operationally acceptable.

### Web
- Strict CSP and trusted types where possible.
- HttpOnly + Secure + SameSite cookies for admin sessions.
- CSRF protection for state-changing endpoints.

### Desktop (Tauri)
- Disable unrestricted shell execution by default.
- Restrict filesystem and network scopes in `tauri.conf`.
- Lock window/webview navigation to approved origins.

### CLI
- Safe-by-default command behavior with explicit confirm flags for destructive actions.
- Redact tokens in stdout/stderr by default.
- Isolated profile/config directories per environment.

## 6. Supply Chain and Release Security

- Pin dependency versions; review high-risk updates.
- Require SBOM + provenance artifacts for release builds.
- Sign desktop and mobile binaries; verify signatures in CI.
- Gate release on vulnerability thresholds and policy exceptions.

## 7. Operational Controls

- Security event audit trail for auth, approvals, policy changes, and admin actions.
- Alert on abnormal token usage, repeated auth failures, and privilege escalation attempts.
- Incident runbooks must include token revocation and forced session invalidation.

## 8. Mandatory CI Gates for UI Clients

- Static analysis/lint + dependency vulnerability scan.
- Secrets scan on source + artifacts.
- Build reproducibility check for release candidates.
- Security smoke tests on auth/session flows.

