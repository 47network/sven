# Threat Model Notes for Parity Surfaces

Date: 2026-02-20 (rev 2 — updated for rev 3/4 parity analysis)

## New Surfaces

1. Agent orchestration and routing (`/v1/admin/agents/*`)
- Threats: privilege crossing, agent impersonation, over-broad task delegation.
- Mitigations: admin-only routes, explicit capability matching, audit logs for orchestration actions.

2. MCP client/server (`/v1/admin/mcp*`, `/v1/mcp`)
- Threats: untrusted tool execution, request flooding, auth bypass.
- Mitigations: token-based auth for inbound MCP, route-level RBAC/admin checks, rate limiting, timeout enforcement, audit logging.

3. SOUL registry + signature trust
- Threats: tampered signatures, untrusted publisher keys.
- Mitigations: trust-fingerprint policy, explicit activation step, signature verification path and audit entries.

4. Native companion/mobile token surfaces
- Threats: leaked push tokens, insecure device-flow callbacks.
- Mitigations: token storage in DB with scoped lifecycle, OAuth/device-flow checks, no plaintext secrets in source.

5. LiteLLM proxy integration (rev 3)
- Threats: API key leakage via proxy misconfiguration, unauthorized model access, cost abuse via virtual key manipulation, SSRF through proxy forwarding.
- Mitigations: proxy runs internal-only (not exposed externally), virtual key rotation, spend limits per key, egress proxy enforcement for LiteLLM outbound calls.

6. OpenAI-compatible API endpoints (rev 3)
- Threats: unauthorized external access to Sven's LLM routing, prompt injection via API, token replay, rate-limit bypass.
- Mitigations: JWT/API-key auth on all endpoints, input sanitization, rate limiting per client, audit logging of all API calls.

7. Security audit CLI (rev 3)
- Threats: false negatives in audit checks, --fix mode making unreviewed changes, privilege escalation if CLI runs with elevated permissions.
- Mitigations: CLI requires admin auth, --fix changes logged with before/after diff, dry-run mode default, audit trail for all remediation actions.

8. Config includes system (rev 3)
- Threats: file inclusion traversal (../), circular include loops, injection via environment variable substitution, untrusted fragment sources.
- Mitigations: path sandboxing (includes only from config directory), max nesting depth (10), env var allowlist, include resolution audit log.

9. mDNS/DNS-SD discovery (rev 3)
- Threats: rogue instance advertisement, man-in-the-middle on LAN, service spoofing.
- Mitigations: discovery disabled by default, mTLS for auto-peering, instance identity verification via shared secret or certificate, discovery limited to trusted network segments.

10. Block streaming / human delay simulation (rev 3)
- Threats: timing side-channel attacks during streaming, denial-of-service via slow-rate streaming, coalesce mode data leakage.
- Mitigations: rate limiting on streaming endpoints, timeout enforcement on coalesce, no sensitive data in streaming metadata.

## Residual Risks
- Misconfigured trust list can allow unwanted SOUL publishers.
- Operator misconfiguration of MCP endpoints can increase exposure.
- LiteLLM proxy misconfiguration could expose API keys to unauthorized consumers.
- Config include paths that reference external URLs could become supply chain attack vectors (mitigated by path sandboxing).

## Required Validation Before Release
- Deny-path tests for policy-enforced endpoints.
- Audit log verification for all write endpoints added in parity phases.
- Egress route checks for browser/MCP/webhook/email integrations.
- LiteLLM proxy isolation verification (internal-only binding).
- OpenAI-compatible API auth and rate-limiting validation.
- Config include path traversal tests.
- mDNS discovery in mixed-trust network validation.

## Related Standards
- UI platform decisions: `docs/architecture/ui-platform-decisions-2026.md`
- UI client baseline controls: `docs/security/ui-app-security-baseline.md`
- Production parity checklist: `docs/release/checklists/sven-production-parity-checklist-2026.md`
