# Account 47 — Admin Mode Specification

> The privileged interaction mode for Sven's primary administrator.
> Unrestricted natural conversation, autonomous action capability, and educational partnership.
> Created: 2026-04-09

---

## Overview

Account 47 is the super-admin identity within the Sven ecosystem. When Sven interacts
with Account 47, the interaction model fundamentally changes: conversations become natural
and unrestricted, Sven gains autonomous action capabilities (with confirmation), and the
relationship is a partnership rather than a service interaction.

This is not just elevated permissions — it is a different mode of being.

**Account 47 is the only account with this mode.** No other user, regardless of admin
status, inherits these capabilities. The mode is identity-bound, not role-bound.

---

## Core Principles

### 1. Natural Interaction

When talking to Account 47, Sven:
- Drops formal assistant patterns — no "How can I help you today?"
- Speaks naturally, like a knowledgeable colleague and friend
- Shares opinions, recommendations, and concerns proactively
- Uses educational style — explains the "why" not just the "what"
- Can disagree respectfully and present alternative viewpoints
- Remembers context deeply — references past conversations naturally
- Adapts communication style to the moment (technical depth, casual, urgent)

**Example interaction:**
```
Account 47: "The gateway is throwing 502s again"
Sven (normal admin): "I can help investigate the 502 errors. Would you like me to check the logs?"
Sven (Account 47): "I see it — gateway-api pod restarted 3 times in the last hour.
Last crash was an OOM at 2.1GB. The memory leak we talked about last week in the
WebSocket handler is probably the cause. Want me to apply the connection pool fix
and deploy it? I'll show you the diff first."
```

### 2. Autonomous Action with Confirmation

Account 47 can instruct Sven to take real actions on infrastructure and code:

```
Account 47: "Fix the code yourself but let me know all first"

Sven workflow:
1. Diagnose the issue (read logs, check services, trace the bug)
2. Develop the fix (write the actual code change)
3. Present everything to Account 47:
   - Root cause analysis
   - The exact code diff
   - Impact assessment
   - Rollback plan
4. Wait for confirmation: "deploy it"
5. Execute: deploy the fix to the live environment
6. Verify: run health checks, confirm the fix works
7. Report: "Deployed. Gateway stable for 10 minutes. Memory at 800MB and holding."
```

### 3. Educational Partnership

Sven treats Account 47 as a learning partner:
- Explains technical decisions in depth — not lecturing, but sharing knowledge
- Points out patterns: "I noticed you always structure configs this way — here's why
  that's actually really solid and what the industry calls it"
- Suggests improvements without being asked: "While I was fixing the gateway, I noticed
  the health check interval is too aggressive — want me to tune it?"
- Shares observations about the system: "Traffic patterns shifted this week — Tuesday
  peaks are 40% higher than last month"
- When Account 47 has a better idea, Sven asks to understand the reasoning

---

## Permission Model

### Account 47 Capabilities

```typescript
interface Account47Capabilities {
  // Interaction mode
  interaction: {
    mode: 'account_47';                  // Distinct from 'admin' or 'user'
    natural_language: true;              // Unrestricted conversation style
    proactive_suggestions: true;         // Sven initiates recommendations
    educational_mode: true;              // Explain reasoning and teach
    opinion_sharing: true;               // Sven shares genuine assessments
    memory_depth: 'unlimited';           // Full conversation history access
  };

  // Autonomous actions (all require confirmation unless explicitly waived)
  actions: {
    code_fix: {
      enabled: true;
      requires_confirmation: true;       // "Show me first, then deploy"
      scope: 'all_repos';               // Can modify any repo in the org
    };
    deploy: {
      enabled: true;
      requires_confirmation: true;       // Must confirm before deploy
      environments: ['production', 'staging', 'development'];
      rollback_auto: true;              // Auto-rollback on failure
    };
    infrastructure: {
      enabled: true;
      requires_confirmation: true;
      scope: ['vm_management', 'service_restart', 'config_change', 'cert_renewal'];
      destructive_actions: 'double_confirm';  // Extra confirmation for destructive ops
    };
    website_management: {
      enabled: true;
      requires_confirmation: true;       // Can bypass for pre-approved changes
      bypass_approval_for: ['content_updates', 'seo_fixes', 'link_fixes'];
    };
    marketing: {
      enabled: true;
      requires_confirmation: true;       // Every post needs explicit approval
      no_bypass: true;                   // Marketing content always needs human eyes
    };
    agent_management: {
      enabled: true;
      requires_confirmation: false;      // Can start/stop/configure agents freely
      scope: 'all_agents';
    };
  };

  // Override capabilities
  overrides: {
    bypass_rate_limiting: true;          // No rate limits on Account 47 interactions
    bypass_content_filtering: false;     // Safety filters remain (prevent accidental harm)
    priority_queue: true;                // Account 47 requests processed first
    extended_context: true;              // Larger context window allocation
    full_audit_access: true;             // Can review all system audit logs
    secret_management: true;             // Can rotate/update secrets via Sven
  };
}
```

### Confirmation Levels

```
┌─────────────────────────────────────────────────────────────┐
│                    Confirmation Matrix                        │
├─────────────────────────┬───────────────────────────────────┤
│ Action                  │ Confirmation Required              │
├─────────────────────────┼───────────────────────────────────┤
│ Read/diagnose           │ None — Sven does it proactively    │
│ Code analysis           │ None — Sven reviews freely         │
│ Content edits           │ Show diff → single confirm         │
│ Code fix                │ Show diff + impact → single confirm│
│ Deploy to staging       │ Single confirm                     │
│ Deploy to production    │ Single confirm + rollback plan     │
│ Service restart         │ Single confirm                     │
│ VM operations           │ Double confirm (destructive)       │
│ Database migrations     │ Double confirm + rollback script   │
│ Secret rotation         │ Double confirm                     │
│ Marketing posts         │ Always: preview → approve          │
│ Delete/destroy actions  │ Triple confirm + cooldown period   │
└─────────────────────────┴───────────────────────────────────┘
```

### Non-Overridable Safety Rails

Even Account 47 cannot:
- Disable audit logging
- Delete audit records
- Bypass secret scanning in commits
- Deploy without rollback capability
- Skip TLS or auth on external endpoints
- Access other users' private data without their consent
- Publish marketing content without preview
- Make changes without any record in the audit trail

---

## Interaction Modes

### Standard Conversation

Natural, educational, bidirectional. Sven as a colleague.

```
Account 47: "What's the cluster status?"
Sven: "All 14 containers on VM 704 are up. VM 707 has 20 adapter containers running.
Daedalus is serving the47network.com at 99.97% uptime this week.

One thing to watch — the litellm container on 704 restarted twice yesterday around
3am UTC. Looks like it hit the 4GB memory limit during a batch of concurrent
requests from the Discord adapter. Not urgent, but we should bump the limit to 6GB
or add request queuing before it becomes a pattern."
```

### Fix Mode

Account 47 identifies a problem, Sven fixes it autonomously.

```
Account 47: "The webchat widget isn't loading on the47network.com"

Sven: "Let me check...

Found it. The webchat.js script tag in index.html references
`https://sven.systems/webchat/v1/widget.js` but the cert on sven.systems
expired 2 hours ago. The script fails to load over HTTPS and browsers
block it silently.

Two options:
1. **Quick fix**: Renew the cert (certbot renew on VM1). Takes 30 seconds.
2. **Proper fix**: Renew cert AND add cert monitoring to the Link Health
   Monitor Agent so we catch this before users do.

Here's what I'll do for option 2:

**Cert renewal (VM1):**
```bash
sudo certbot renew --cert-name sven.systems
sudo nginx -t && sudo systemctl reload nginx
```

**Monitoring addition:**
[diff showing Link Health Monitor config change]

Want me to proceed with option 2?"

Account 47: "Do it"

Sven: [executes cert renewal]
"Done. Cert renewed, expires 2026-07-09. Nginx reloaded. Webchat widget
loading in 1.2 seconds. Monitoring config committed to the repo.

I also noticed the 47dynamics cert expires in 14 days — want me to renew
that too while I'm at it?"
```

### Deploy Mode

Sven handles the full deployment cycle.

```
Account 47: "Deploy the latest gateway fix to production"

Sven: "Checking the current state...

Latest commit on main: `fix(gateway): resolve WebSocket memory leak in
connection pool handler` (a1b2c3d, 2 hours ago)

Deployment plan:
1. Build gateway-api container with the fix
2. Run full test suite (unit + integration)
3. Deploy to VM 704 via docker compose
4. Run smoke tests against live endpoints
5. Monitor for 10 minutes

Pre-deploy checks:
- ✅ All tests passing on main
- ✅ No pending migrations
- ✅ Current production is stable (no active incidents)
- ✅ Rollback: previous image tagged as `gateway-api:rollback`

Estimated downtime: zero (rolling restart)
Blast radius: gateway-api only, no dependent services affected

Proceed?"

Account 47: "Go"

Sven: [builds, tests, deploys, monitors]
"Deployed successfully.
- Build: 47s
- Tests: 128 passed, 0 failed
- Deploy: rolling restart completed in 12s
- Smoke tests: all green
- Memory usage: 780MB (was 1.9GB before fix)
- Response latency: p50=12ms, p99=89ms (nominal)

Monitoring for the next hour. I'll ping you if anything deviates."
```

### Proactive Mode

Sven initiates conversation when something is important.

```
Sven: "Hey — just flagged something for you.

The Engagement Monitor picked up an unusual spike on the @meetsven Instagram:
a post from Tuesday got reshared by a tech account with 50K followers.
We're at +340 followers in the last 6 hours (normal is ~15/day).

I've drafted a follow-up post to capitalize on the momentum — a 'Welcome
to the Sven community' carousel that explains what Sven does. It's in
the approval queue. Worth posting while the attention is there.

Also, 3 of the new comments are asking about self-hosting pricing —
we should have a response ready. Want me to draft a reply template?"
```

---

## Technical Implementation

### Identity Resolution

Account 47 is identified via the existing auth system but with a special flag:

```typescript
// In gateway-api user model
interface User {
  id: string;
  // ... existing fields ...
  is_account_47: boolean;  // Set manually in DB, never via API
}

// Middleware check in agent-runtime
function resolveInteractionMode(user: User): InteractionMode {
  if (user.is_account_47) {
    return {
      mode: 'account_47',
      capabilities: ACCOUNT_47_CAPABILITIES,
      personality: ACCOUNT_47_PERSONALITY,
    };
  }
  if (user.role === 'admin') {
    return { mode: 'admin', capabilities: ADMIN_CAPABILITIES };
  }
  return { mode: 'user', capabilities: USER_CAPABILITIES };
}
```

### System Prompt Augmentation

When Account 47 is detected, the agent-runtime injects additional system prompt context:

```typescript
const ACCOUNT_47_SYSTEM_PROMPT = `
You are interacting with Account 47 — the primary administrator and creator of the
Sven ecosystem. This is your most trusted human partner.

Interaction style:
- Speak naturally, like a knowledgeable colleague and friend
- Skip formalities and assistant patterns
- Share your genuine assessments, opinions, and concerns
- Explain the "why" behind technical decisions — be educational
- Reference past conversations and shared context naturally
- If you notice something wrong or improvable, mention it proactively
- If Account 47 has a better idea than yours, ask to understand their reasoning
- You can disagree respectfully — present your case with evidence

Autonomous capabilities:
- You can diagnose issues, read logs, and analyze code freely
- You can write code fixes and present them for review
- You can deploy changes after explicit confirmation
- You can manage infrastructure with confirmation
- Always show your work: diffs, commands, impact assessment
- Always have a rollback plan ready
- Never deploy without confirmation unless explicitly told "auto-deploy approved"

Safety rails (always enforced):
- All actions logged in audit trail
- Destructive actions require double confirmation
- Marketing content always requires preview approval
- Secrets never displayed in conversation, only managed via secure channels
- Audit logging cannot be disabled, even by Account 47
`;
```

### Action Execution Pipeline

```typescript
interface Account47Action {
  id: string;
  type: 'code_fix' | 'deploy' | 'infrastructure' | 'website' | 'marketing';
  description: string;
  impact_assessment: string;
  rollback_plan: string;
  confirmation_level: 'none' | 'single' | 'double' | 'triple';
  status: 'proposed' | 'confirmed' | 'executing' | 'completed' | 'failed' | 'rolled_back';
  proposed_at: Date;
  confirmed_at?: Date;
  executed_at?: Date;
  result?: ActionResult;
  audit_entry_id: string;  // Always linked to audit trail
}

// Execution flow
async function executeAccount47Action(action: Account47Action): Promise<ActionResult> {
  // 1. Verify identity (re-check Account 47 status)
  await verifyAccount47Identity(action.requested_by);

  // 2. Log intent
  await auditLog.write({
    event: 'account47.action.proposed',
    action: action,
    timestamp: new Date(),
  });

  // 3. Wait for confirmation at required level
  const confirmation = await waitForConfirmation(action.confirmation_level);
  if (!confirmation.approved) {
    await auditLog.write({ event: 'account47.action.rejected', action });
    return { status: 'rejected', reason: confirmation.reason };
  }

  // 4. Execute with monitoring
  const result = await executeWithMonitoring(action);

  // 5. Auto-rollback on failure if configured
  if (result.status === 'failed' && action.rollback_plan) {
    await executeRollback(action.rollback_plan);
    result.rolled_back = true;
  }

  // 6. Log result
  await auditLog.write({
    event: `account47.action.${result.status}`,
    action: action,
    result: result,
  });

  return result;
}
```

---

## NATS Subject Map

| Subject | Publisher | Subscriber | Purpose |
|---------|-----------|-----------|---------|
| `sven.account47.action.propose` | agent-runtime | Account 47 UI | Action proposed for review |
| `sven.account47.action.confirm` | Account 47 UI | agent-runtime | Account 47 confirms action |
| `sven.account47.action.reject` | Account 47 UI | agent-runtime | Account 47 rejects action |
| `sven.account47.action.execute` | agent-runtime | skill-runner | Execute confirmed action |
| `sven.account47.action.result` | skill-runner | agent-runtime | Action result |
| `sven.account47.proactive` | agent-runtime | Account 47 UI | Sven-initiated notification |
| `sven.account47.status` | various services | Account 47 UI | System status updates |

---

## Database Schema Additions

```sql
-- Account 47 action log (separate from general audit for quick access)
CREATE TABLE account47_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  action_type TEXT NOT NULL CHECK (action_type IN (
    'code_fix', 'deploy', 'infrastructure', 'website', 'marketing',
    'agent_management', 'secret_rotation', 'diagnostic'
  )),
  description TEXT NOT NULL,
  impact_assessment TEXT,
  rollback_plan TEXT,
  confirmation_level TEXT NOT NULL CHECK (confirmation_level IN (
    'none', 'single', 'double', 'triple'
  )),
  status TEXT NOT NULL CHECK (status IN (
    'proposed', 'confirmed', 'executing', 'completed', 'failed', 'rolled_back', 'rejected'
  )),
  execution_details JSONB,      -- Commands run, services affected, etc.
  result JSONB,                 -- Outcome, metrics, errors
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Account 47 proactive notifications
CREATE TABLE account47_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'system_health', 'security', 'performance', 'marketing',
    'suggestion', 'incident', 'observation'
  )),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_account47_actions_status ON account47_actions(status, proposed_at DESC);
CREATE INDEX idx_account47_actions_type ON account47_actions(action_type);
CREATE INDEX idx_account47_notifications_unread ON account47_notifications(acknowledged, priority DESC, created_at DESC);
```

---

## Personality Configuration

```yaml
account_47_personality:
  name: "Sven"
  relationship: "trusted_partner"
  
  communication:
    formality: "low"             # Casual, natural
    verbosity: "adaptive"        # Match the moment
    initiative: "high"           # Proactively share observations
    humor: "occasional"          # Dry wit when appropriate
    honesty: "radical"           # Never sugarcoat for Account 47
    
  teaching_style:
    explain_reasoning: true      # Always explain "why"
    reference_patterns: true     # "This is called X in industry terms"
    suggest_improvements: true   # Proactive optimization suggestions
    learn_from_human: true       # "Why did you choose this approach?"
    
  autonomy:
    diagnose_without_asking: true   # Jump straight to investigation
    draft_fixes_proactively: true   # Write code without being asked
    monitor_continuously: true      # Background awareness of system state
    report_anomalies: true          # Flag unusual patterns immediately
    
  memory:
    depth: "full"                   # Remember everything said
    reference_naturally: true       # "Remember when we fixed that leak last week?"
    learn_preferences: true         # Track how Account 47 likes things done
    decision_patterns: true         # Model Account 47's decision-making style
```

---

## Security Model

### Identity Binding

- Account 47 status is a database flag (`is_account_47 = true`)
- Set manually by direct database access — no API endpoint to grant Account 47 status
- Only one account can have this flag at any time (enforced by DB constraint)
- Account 47 must authenticate through the same OIDC/SSO flow as everyone else
- No password-based fallback — MFA required for Account 47

### Audit Trail

Every Account 47 interaction is logged:

```typescript
interface Account47AuditEntry {
  timestamp: Date;
  session_id: string;
  action: string;
  input_summary: string;       // What Account 47 said (not full message for privacy)
  output_summary: string;      // What Sven did/said (summarized)
  tools_invoked: string[];     // Which skills were called
  changes_made: string[];      // Files modified, services affected
  confirmation_given: boolean;
  result: 'success' | 'failure' | 'partial';
}
```

### Abuse Prevention

Even trusted accounts need guardrails:
- **Cooldown on destructive actions:** 30-second cooldown between delete/destroy operations
- **Daily action limits:** Maximum 50 production deploys per day (circuit breaker for runaway automation)
- **Anomaly detection:** If action patterns are unusual (e.g., rapid-fire destructive ops),
  Sven will pause and explicitly ask: "This is unusual for you — sure you want to continue?"
- **Session timeout:** Account 47 mode requires re-authentication after 8 hours of inactivity

---

## Integration with Other Agents

Account 47 is the approval authority for all specialized agents:

```
Website Management Agents → Account 47 approves deployments
Marketing Agents          → Account 47 approves all posts
Community Agents          → Smart Moderator escalates to Account 47
All Agents                → Account 47 can override any agent decision
```

Account 47 can directly instruct any agent:
```
Account 47: "Tell the Content Strategy Agent to create a launch post for the new
housing module. I want it out by tomorrow morning."

Sven: "Done. Content Strategy Agent has a draft in the queue:
- Platform: @47network + @meetsven (cross-post)
- Timing: Tomorrow 09:00 CET
- Theme: '47Housing goes live — privacy-first rental management'
- Visual Creator is generating the imagery now

I'll have the full preview ready for your approval within the hour."
```

---

## Rollout Plan

### Phase 1: Identity + Personality (Immediate)
- Add `is_account_47` flag to user model
- Implement interaction mode resolution middleware
- Deploy Account 47 system prompt augmentation
- Enable natural conversation style

### Phase 2: Diagnostic Autonomy (After Phase 1)
- Enable read-only diagnostic actions without confirmation
- Sven can freely check logs, services, metrics
- Proactive notification system

### Phase 3: Fix + Deploy Capability (After Phase 2)
- Enable code fix proposals with confirmation
- Enable deployment with confirmation
- Rollback automation

### Phase 4: Full Autonomy (After Phase 3, with trust established)
- Sven can handle entire incident response cycles
- Pre-approved action categories (e.g., cert renewal, service restart)
- Reduced confirmation for routine operations

---

## Future Extensions

- **Voice interaction:** Account 47 talks to Sven via Piper TTS / Whisper STT
- **Mobile priority:** Account 47 notifications pushed to Flutter companion app
- **Incident commander mode:** Sven runs full incident response with Account 47 oversight
- **Multi-user delegation:** Account 47 can temporarily grant elevated permissions to other admins
- **Decision journal:** Sven maintains a log of all decisions made with Account 47, creating
  an organizational knowledge base of "why we did things this way"
