# Security Runbook: Token Compromise and Key Rotation

Date: 2026-02-13  
Owner: Security + Platform Operations  
Scope: Gateway auth tokens, desktop/mobile/web client tokens, API signing keys, webhook secrets, adapter tokens.

## 1. Trigger Conditions

- Suspected or confirmed token exfiltration from client, CI, logs, or storage.
- Unauthorized API calls associated with a known session or service token.
- Secret scanning alert for production credentials.
- Third-party key compromise notice affecting Sven integrations.

## 2. Severity and Initial Response

Within 15 minutes:

1. Open a `SEV-1` incident and assign commander.
2. Freeze risky admin actions (model routing changes, webhook changes, adapter credential updates).
3. Snapshot current auth/session state and preserve logs for forensics.
4. Enable heightened alerting for auth/approval endpoints.

## 3. Containment Checklist

1. Revoke compromised token(s) immediately.
2. Invalidate active sessions for impacted user(s) or service principals.
3. Rotate associated secrets in this order:
   1. Gateway auth signing/verification material.
   2. Adapter/API integration tokens.
   3. Webhook secrets and callback tokens.
   4. CI and deployment credentials.
4. Force re-authentication on mobile, web, desktop, and CLI clients.
5. Block suspicious IPs and user agents at edge and gateway rate-limit layers.

## 4. Rotation Procedure (Execution)

1. Generate replacement secret in approved secret manager (no local file copies).
2. Update environment-scoped secrets (`staging`, then `production`) with least-privilege values.
3. Roll out gateway with zero-downtime deployment.
4. Validate:
   - New auth flows succeed.
   - Old tokens fail.
   - Session refresh uses new key material.
5. Restart affected adapters/workers that cache credentials.
6. Run smoke checks:
   - `npm run ops:sh:smoke:47matrix`
   - `npm run release:status`

## 5. Recovery Validation

- Auth endpoints healthy and error rates normalized.
- No unauthorized approvals/actions after containment timestamp.
- Audit trail confirms revocation + rotation completion.
- Security baseline workflows green for current commit.

## 6. Communication

1. Internal update every 30 minutes until contained.
2. User-facing advisory if user-impacting compromise is confirmed.
3. Post-incident report within 48 hours with:
   - root cause,
   - blast radius,
   - timeline,
   - remediation and prevention actions.

## 7. Prevention Follow-ups

- Add regression test for the compromise vector.
- Tighten secret scanning patterns if detection lagged.
- Rotate all shared credentials touched during incident handling.
- Update threat model and this runbook with new indicators.
