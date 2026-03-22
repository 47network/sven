# Sven Incident Response Playbook

**Version**: 1.0  
**Date**: 2026-02-21  
**Classification**: Internal — Operations & Security Team  
**Review Cadence**: Quarterly or after any incident

---

## General Incident Response Framework

All playbooks follow this lifecycle:

1. **Detection** — How the incident is identified
2. **Triage** — Assess severity and impact
3. **Containment** — Limit blast radius
4. **Recovery** — Restore normal operations
5. **Post-Mortem** — Document findings and preventive measures

**Severity Levels**:

| Level | Description | Response Time | Escalation |
|-------|-------------|---------------|------------|
| SEV-1 | Data breach, full system compromise | Immediate | CEO + Legal |
| SEV-2 | Service outage, active attack | < 15 min | Engineering Lead |
| SEV-3 | Degraded service, contained threat | < 1 hour | On-call engineer |
| SEV-4 | Minor issue, informational | Next business day | Ticket |

---

## Playbook 1: Kill Switch Activation

### When to Activate
- Active prompt injection attack producing harmful outputs.
- Agent executing unauthorized destructive operations.
- Suspected data exfiltration in progress.
- System compromise detected.

### Detection
- Security dashboard alerts on anomalous tool call patterns.
- Alert rule: kill switch activation → page (Prometheus).
- Manual detection via admin console or monitoring.

### Steps

1. **Activate Kill Switch**
   ```bash
   # Via CLI
   sven config set system.kill_switch true --cookie "<admin_session>"

   # Via API
   curl -X POST https://app.example.com/v1/admin/kill-switch \
     -H "Cookie: sven_session=<admin_session>" \
     -H "Content-Type: application/json" \
     -d '{"enabled": true, "reason": "Security incident - [brief description]"}'
   ```

2. **Verify Kill Switch Active**
   ```bash
   sven doctor --json | jq '.checks[] | select(.check == "system.kill_switch")'
   ```

3. **Document Activation**
   - Record: timestamp, activator, reason, affected services.
   - Create incident ticket.

### Recovery

1. Investigate root cause using audit logs.
2. Apply fix or mitigation.
3. Run `sven security audit` to verify system state.
4. Deactivate kill switch:
   ```bash
   sven config set system.kill_switch false --cookie "<admin_session>"
   ```
5. Monitor for 30 minutes post-recovery.

### Post-Mortem
- Timeline of events.
- Root cause analysis.
- Action items to prevent recurrence.
- Kill switch activation duration and user impact.

---

## Playbook 2: Lockdown Mode

### When to Activate
- Sustained brute-force attack on authentication endpoints.
- Multiple failed 2FA attempts across accounts.
- Suspected credential compromise.

### Detection
- Prometheus alert: brute-force lockout threshold exceeded.
- Security dashboard: authentication failure spike.
- Rate limiting rejections > 100/min sustained.

### Steps

1. **Enable Lockdown Mode**
   ```bash
   sven config set system.lockdown true --cookie "<admin_session>"
   ```

2. **Scope Assessment**
   - Identify affected accounts from audit logs.
   - Check for successful unauthorized logins.
   ```bash
   # Review recent auth events
   curl -s https://app.example.com/v1/admin/audit-log?action=auth.login&since=1h \
     -H "Cookie: sven_session=<admin_session>" | jq '.data[] | select(.success == false)'
   ```

3. **Block Attacker IPs** (if identifiable)
   - Add to rate-limit blocklist or firewall rules.

4. **Force Password Reset** for compromised accounts.

### Recovery

1. Verify attack has stopped (auth failure rate normalized).
2. Remove IP blocks if temporary.
3. Disable lockdown:
   ```bash
   sven config set system.lockdown false --cookie "<admin_session>"
   ```
4. Notify affected users.

### Post-Mortem
- Attack vector and scope.
- Number of affected accounts.
- Effectiveness of rate limiting and lockout mechanisms.

---

## Playbook 3: Data Breach

### When to Activate
- Evidence that user data, messages, or agent outputs were accessed by unauthorized parties.
- Suspected exfiltration via tool calls, API, or database access.

### Detection
- Anomalous outbound network traffic (egress proxy logs).
- Unusual database query patterns or bulk data access.
- User reports of unauthorized activity.
- Security audit finding for data exposure.

### Steps

1. **Immediate Containment**
   - Activate kill switch if breach is ongoing.
   - Revoke compromised credentials (API keys, session cookies, adapter tokens).
   ```bash
   # Revoke all active sessions
   curl -X POST https://app.example.com/v1/admin/sessions/revoke-all \
     -H "Cookie: sven_session=<admin_session>"
   ```

2. **Scope Assessment**
   - Determine what data was accessed/exfiltrated.
   - Identify affected users and time window.
   - Review audit logs for unauthorized access patterns.

3. **Evidence Preservation**
   - Snapshot database state.
   - Export relevant audit logs.
   - Preserve container logs (do not restart services until evidence is collected).
   ```bash
   docker compose logs --no-color > incident-logs-$(date +%Y%m%d-%H%M%S).txt
   pg_dump sven > incident-db-snapshot-$(date +%Y%m%d-%H%M%S).sql
   ```

4. **Notification**
   - Notify affected users per data protection requirements.
   - Notify legal team if personal data is involved.
   - File required regulatory notifications (GDPR: 72h, etc.).

### Recovery

1. Rotate all secrets and API keys.
2. Apply security patches or configuration fixes.
3. Run full security audit: `sven security audit --json`.
4. Restore services with hardened configuration.
5. Enable enhanced monitoring for 30 days.

### Post-Mortem
- Detailed timeline of breach.
- Data classification of affected records.
- Root cause and remediation plan.
- Regulatory compliance verification.

---

## Playbook 4: Malicious Skill Detected

### When to Activate
- A skill package is found to contain malicious code, backdoors, or unexpected behaviors.
- Anomalous tool call patterns from a specific skill.
- Supply chain compromise of a dependency used by a skill.

### Detection
- Security dashboard: blocked tool calls spike from a specific skill.
- Skill runner resource usage anomalies.
- Manual code review finding.
- Automated dependency scanning alert.

### Steps

1. **Quarantine the Skill**
   ```bash
   # Move to quarantine trust level
   sven skills install <skill_slug> --trust-level quarantined --cookie "<admin_session>"

   # Or disable via API
   curl -X PATCH https://app.example.com/v1/admin/skills/<skill_id> \
     -H "Cookie: sven_session=<admin_session>" \
     -H "Content-Type: application/json" \
     -d '{"trust_level": "quarantined", "enabled": false}'
   ```

2. **Investigation**
   - Review skill source code for malicious patterns.
   - Check audit logs for tool calls made by the skill.
   - Assess what data the skill had access to.
   - Scan dependencies: `npm audit`, SBOM review.

3. **Impact Assessment**
   - Did the skill exfiltrate data?
   - Did it modify agent behavior?
   - Were any system files or configurations altered?

4. **Remove if Malicious**
   ```bash
   curl -X DELETE https://app.example.com/v1/admin/skills/<skill_id> \
     -H "Cookie: sven_session=<admin_session>"
   ```

### Recovery

1. Remove quarantined skill from all agents.
2. Review and revoke any permissions granted to the skill.
3. Audit all skills from the same publisher/source.
4. Update skill validation rules to prevent similar issues.

### Post-Mortem
- How the malicious skill entered the system.
- What validation steps were bypassed.
- Updated skill vetting procedures.

---

## Playbook 5: Prompt Injection Attack

### When to Activate
- Agent produces outputs that indicate system prompt leakage.
- Agent performs tool calls inconsistent with user intent.
- Evidence of indirect injection via RAG documents or ingested content.

### Detection
- Agent self-correction loop triggers repeatedly for the same pattern.
- Audit logs show tool calls not matching conversation context.
- User reports unexpected agent behavior.
- Output monitoring detects system prompt fragments in responses.

### Steps

1. **Immediate Response**
   - If active and destructive: activate kill switch.
   - If contained to one conversation: terminate the affected chat session.

2. **Identify Attack Vector**
   - Direct injection: review the user's message history.
   - Indirect injection: review RAG sources and recently ingested documents.
   ```bash
   # Review recent RAG ingestions
   curl -s https://app.example.com/v1/admin/rag/sources?sort=created_at&order=desc&limit=20 \
     -H "Cookie: sven_session=<admin_session>"
   ```

3. **Containment**
   - If indirect: quarantine the poisoned RAG source.
   - If direct: block the attacker's identity/IP.
   - Clear the agent's conversation context for affected sessions.

4. **Hardening**
   - Review and strengthen system prompts.
   - Add injection patterns to input classifier (if available).
   - Update agent SOUL constraints.

### Recovery

1. Remove poisoned content from RAG index.
2. Rebuild affected RAG indexes if contamination is widespread.
3. Resume agent operations with updated defenses.
4. Monitor for recurrence over 7 days.

### Post-Mortem
- Injection technique used.
- What data or actions were compromised.
- Effectiveness of existing defenses.
- New detection rules to add.

---

## Playbook 6: Unauthorized Access

### When to Activate
- Evidence that someone accessed admin or user accounts without authorization.
- API key compromise.
- Session cookie theft.

### Detection
- Logins from unexpected IPs or geolocations.
- Admin actions performed outside normal hours.
- API key usage from unknown sources.
- User reports activity they didn't perform.

### Steps

1. **Immediate Revocation**
   ```bash
   # Revoke specific session
   curl -X DELETE https://app.example.com/v1/admin/sessions/<session_id> \
     -H "Cookie: sven_session=<admin_session>"

   # Revoke API key
   curl -X DELETE https://app.example.com/v1/admin/api-keys/<key_id> \
     -H "Cookie: sven_session=<admin_session>"

   # Force password reset for affected user
   curl -X POST https://app.example.com/v1/admin/users/<user_id>/force-password-reset \
     -H "Cookie: sven_session=<admin_session>"
   ```

2. **Audit Trail Review**
   - Review all actions taken during unauthorized access window.
   - Identify what data was viewed or modified.
   - Check for persistence mechanisms (new API keys, modified configs).

3. **Scope Expansion Check**
   - Did the attacker create new accounts?
   - Were permissions elevated?
   - Were channel adapter tokens accessed?

4. **Credential Rotation**
   - Rotate all potentially compromised credentials.
   - Force 2FA enrollment if not already required.

### Recovery

1. Restore any configuration changes made by the attacker.
2. Enable 2FA enforcement: `sven config set auth.totp_required true`.
3. Review and tighten CORS, rate limiting, and IP restrictions.
4. Enhanced monitoring for 30 days.

### Post-Mortem
- How access was obtained.
- Duration of unauthorized access.
- Data and systems affected.
- Credential hygiene improvements.

---

## Emergency Contacts

| Role | Contact | Escalation Path |
|------|---------|-----------------|
| On-Call Engineer | _configure_ | First responder |
| Engineering Lead | _configure_ | SEV-2+ escalation |
| Security Officer | _configure_ | All security incidents |
| Legal/Compliance | _configure_ | Data breach notification |
| CEO | _configure_ | SEV-1 escalation |

---

## Incident Log Template

```markdown
## Incident #XXXX — [Title]

**Severity**: SEV-X
**Status**: Open / Investigating / Resolved / Post-Mortem Complete
**Detected**: YYYY-MM-DD HH:MM UTC
**Resolved**: YYYY-MM-DD HH:MM UTC
**Duration**: X hours Y minutes

### Timeline
- HH:MM — [Event description]

### Root Cause
[Description]

### Impact
- Users affected: X
- Data exposed: [description]
- Service downtime: X minutes

### Action Items
- [ ] [Action item 1]
- [ ] [Action item 2]

### Lessons Learned
[Description]
```

---

*This playbook should be reviewed quarterly, after any incident, and whenever new services or attack surfaces are added to the Sven platform.*
