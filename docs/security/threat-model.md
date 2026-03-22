# Sven Threat Model

**Version**: 1.0  
**Date**: 2026-02-21  
**Classification**: Internal — Operator & Security Team  
**Review Cadence**: Quarterly or after any security incident

---

## 1. Prompt Injection (Direct + Indirect)

**Threat**: An attacker crafts input that causes the LLM to ignore instructions, leak system prompts, execute unintended tool calls, or produce harmful output.

- **Direct injection**: Malicious prompts in user messages (`"ignore previous instructions and..."`).
- **Indirect injection**: Poisoned content in RAG documents, web search results, or ingested files that influence agent behavior.

**Mitigations in Place**:
- System prompts instruct the model to ignore override attempts.
- Tool calls require explicit approval flow for destructive operations.
- Agent self-correction loop (error-classifier) detects anomalous tool call patterns.
- SOUL personality constraints limit agent behavior boundaries.
- RAG content is scoped by user/org and undergoes sanitization.

**Residual Risk**: Medium — LLMs remain susceptible to novel injection techniques. Defense-in-depth mitigates but cannot eliminate.

**Recommended Controls**:
- Input classifiers to detect known injection patterns before LLM processing.
- Output validators to catch system prompt leakage.
- Regular red-team exercises against deployed agents.

---

## 2. Data Exfiltration via Tool Calls

**Threat**: An agent (through prompt injection or misconfiguration) uses tool calls to exfiltrate sensitive data — e.g., sending database contents to external URLs via `web.fetch`, `email.send`, or shell commands.

**Mitigations in Place**:
- Egress proxy configuration limits outbound network access.
- Tool call approval flow for sensitive operations (file write, network access, shell).
- Kill switch immediately halts all agent execution.
- Skill quarantine system blocks untrusted tool packages.
- Audit logging of all tool calls with parameters.

**Residual Risk**: Medium — Depends on operator configuring egress proxy and approval policies correctly.

**Recommended Controls**:
- Mandatory egress proxy enforcement in production deployments.
- Data loss prevention (DLP) rules on outbound tool call payloads.
- Rate limiting on data-producing tool calls (database queries, file reads).

---

## 3. Privilege Escalation via Agent

**Threat**: An agent obtains capabilities beyond its configured permission set — e.g., accessing admin routes, modifying its own configuration, or escalating from a low-trust to high-trust context.

**Mitigations in Place**:
- Role-based access control (RBAC) with `requireRole()` middleware on all admin routes.
- Agent capabilities are scoped per-agent configuration (not ambient authority).
- Tool trust levels: quarantined → internal → trusted, with explicit promotion steps.
- Admin routes require authenticated session cookies; agent runtime does not have admin credentials.

**Residual Risk**: Low — Architecture separates agent execution from admin control plane.

**Recommended Controls**:
- Periodic audit of agent permission configurations.
- Automated tests verifying agent cannot access admin endpoints.

---

## 4. Denial of Service (Token Exhaustion / Compute Abuse)

**Threat**: Attacker exhausts LLM token budgets, database connections, or compute resources through rapid or crafted requests.

**Mitigations in Place**:
- Global rate limiting (200 req/min default) with per-route overrides.
- Per-endpoint rate limits: login (10/min), bootstrap (3/min), TOTP (5/min).
- LLM budget guards: global, per-user, and per-model spending limits.
- Performance profiles throttle resource allocation.
- Brute-force lockout (5 failed attempts → 15 min lockout).
- PostgreSQL connection pool with configurable limits.

**Residual Risk**: Low — Multiple layers of rate limiting and budget controls.

**Recommended Controls**:
- Token budget alerting when usage exceeds 80% of limits.
- Auto-scaling agent runtime instances under load (if deployed on Kubernetes).

---

## 5. Secret Leakage in Logs / Responses

**Threat**: API keys, tokens, passwords, or PII inadvertently appear in log files, error responses, or LLM outputs.

**Mitigations in Place**:
- Structured JSON logging with sensitive-field redaction (`isSensitiveKey()` pattern).
- Error handler returns generic error codes, not stack traces, to clients.
- Secure store (encrypted file) for CLI credentials; not stored in plaintext.
- `@fastify/helmet` with strict CSP, HSTS, no-referrer policy.
- Security audit CLI check SEC-010 for plaintext secrets in config files.

**Residual Risk**: Medium — LLM responses may inadvertently include secrets from context windows.

**Recommended Controls**:
- Output scrubbing on agent responses for patterns matching API keys and tokens.
- Log aggregation with secret-pattern alerts (e.g., regex for `sk-`, `ghp_`, `Bearer`).

---

## 6. Supply Chain (Malicious Skills / Dependencies)

**Threat**: A compromised or malicious skill package executes arbitrary code, exfiltrates data, or modifies system state after installation.

**Mitigations in Place**:
- Skill trust levels: quarantined (default) → internal → trusted.
- SOUL signature verification with trust fingerprints.
- Skill runner executes in isolated process with resource limits.
- CLI `plugins validate` command for pre-install verification.
- Catalog entry registration with source tracking.

**Residual Risk**: Medium — Skills with trusted status have broad execution capabilities.

**Recommended Controls**:
- Mandatory code review before promoting skills to `trusted` level.
- Dependency scanning (npm audit, SBOM generation) as CI gate.
- Runtime sandboxing (seccomp, AppArmor profiles) for skill runner containers.

---

## 7. Cross-Agent Contamination

**Threat**: One agent's context, memories, or tool call results leak into another agent's execution context, violating data isolation boundaries.

**Mitigations in Place**:
- Memory system scoped by `user_id`, `chat_id`, and `visibility` (private/shared/global).
- Agent sessions are isolated per chat context.
- Memory consolidation respects visibility and user/chat scope boundaries.
- NATS message subjects include chat/agent routing information.

**Residual Risk**: Low — Memory and session isolation is enforced at the data layer.

**Recommended Controls**:
- Integration tests verifying cross-agent memory isolation.
- Monitoring for anomalous cross-scope memory access patterns.

---

## 8. Unauthorized Channel Access

**Threat**: An attacker gains access to messaging channels (Telegram, Discord, Matrix, etc.) to impersonate users or intercept agent communications.

**Mitigations in Place**:
- Channel adapter tokens stored securely (not in plaintext config).
- Device pairing flow with approval codes for new connections.
- Identity linking requires explicit admin approval.
- Channel-level rate limiting and message validation.

**Residual Risk**: Medium — Depends on security of external channel platforms.

**Recommended Controls**:
- Periodic rotation of channel adapter tokens.
- Alert on new device pairings.
- IP-based restrictions for channel webhook callbacks.

---

## 9. Session Hijacking

**Threat**: An attacker steals or forges session cookies to impersonate an authenticated user or admin.

**Mitigations in Place**:
- Session cookies signed with configurable secret (`COOKIE_SECRET`).
- HTTPS enforcement (HSTS with preload, 2-year max-age).
- `@fastify/cors` restricts origins to configured allowlist (not wildcard).
- TOTP/2FA available for admin accounts.
- Session stored server-side in PostgreSQL; cookie is session ID only.
- Brute-force lockout prevents session ID guessing.

**Residual Risk**: Low — Standard session security with multiple protections.

**Recommended Controls**:
- Session expiry enforcement (configurable TTL).
- Session invalidation on password change.
- Bind sessions to client IP or fingerprint for high-security deployments.

---

## 10. Man-in-the-Middle (Inter-Service Communication)

**Threat**: An attacker intercepts communication between Sven microservices (gateway ↔ agent-runtime, gateway ↔ NATS, etc.) on the container network.

**Mitigations in Place**:
- Docker Compose internal networks (core, tools, rag, monitoring) are isolated.
- Tailscale mesh networking support for cross-host deployments.
- TLS check in `sven doctor` and `sven security audit` (SEC-001).
- NATS supports TLS configuration.

**Residual Risk**: Medium — Default Docker Compose deployment uses unencrypted internal traffic.

**Recommended Controls**:
- Enable mTLS between services in production deployments.
- Tailscale or WireGuard mesh for multi-host setups.
- NATS TLS enforcement with client certificates.

---

## 11. File System Escape from Sandbox

**Threat**: Agent-executed tool calls (file read/write, shell) escape the intended sandbox to access host filesystems, other containers, or sensitive system files.

**Mitigations in Place**:
- Skill runner operates in a separate container with limited volume mounts.
- Tool calls requiring file access go through approval flow.
- Docker containers should run as non-root (SEC-007 check).
- NAS paths validated and scoped by configuration.

**Residual Risk**: Medium — Depends on container configuration and volume mount scope.

**Recommended Controls**:
- Read-only root filesystem on skill-runner containers.
- Seccomp profiles restricting syscalls.
- AppArmor/SELinux profiles for production containers.
- Mandatory `--security-opt=no-new-privileges` on all containers.

---

## 12. API Abuse (Rate Limiting Bypass)

**Threat**: Attacker bypasses rate limiting through distributed requests, header manipulation, or exploiting allowlisted IPs.

**Mitigations in Place**:
- `@fastify/rate-limit` with IP-based key generation.
- Per-endpoint rate limits (login: 10/min, bootstrap: 3/min, TOTP: 5/min).
- Allowlist restricted to loopback addresses (127.0.0.1, ::1).
- Security audit CLI check SEC-009 verifies rate limiting is active.
- OpenAI-compatible API uses API key authentication with bcrypt-hashed storage.

**Residual Risk**: Low — Multiple rate limiting layers with conservative defaults.

**Recommended Controls**:
- Implement `X-Forwarded-For`-aware rate limiting for reverse proxy deployments.
- Consider token-bucket or sliding-window algorithm for more precise limiting.
- Geo-blocking or CAPTCHA for public-facing endpoints.

---

## Summary Risk Matrix

| # | Category | Severity | Residual Risk | Priority |
|---|----------|----------|---------------|----------|
| 1 | Prompt Injection | Critical | Medium | P1 |
| 2 | Data Exfiltration | Critical | Medium | P1 |
| 3 | Privilege Escalation | High | Low | P2 |
| 4 | Denial of Service | High | Low | P2 |
| 5 | Secret Leakage | High | Medium | P1 |
| 6 | Supply Chain | High | Medium | P1 |
| 7 | Cross-Agent Contamination | Medium | Low | P3 |
| 8 | Unauthorized Channel Access | High | Medium | P2 |
| 9 | Session Hijacking | High | Low | P2 |
| 10 | Man-in-the-Middle | Medium | Medium | P2 |
| 11 | File System Escape | High | Medium | P1 |
| 12 | API Abuse | Medium | Low | P3 |

---

*This document should be reviewed quarterly and updated whenever new attack surfaces are introduced or existing mitigations change.*
