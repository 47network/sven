# Pattern Module Integration Plan

> 18 clean-room modules → 5 services → production integration.
> Status: **Modules compiled & deployed. Awaiting service-level wiring.**

---

## Current State

All 18 modules live in `packages/shared/src/`, compiled clean, deployed to all
5 services as `@sven/shared` dist files. **No service currently imports or uses
them.** This plan covers wiring each module into the correct service code.

---

## Integration Waves

Work is broken into 6 waves ordered by dependency and blast radius.
Each wave is a self-contained unit that can be deployed independently.

---

### Wave 1 — Foundation (Task ID + Feature Flags + Proxy Detect)

**Why first:** These are read-only/additive, zero risk of breaking existing flows.

#### 1.1 `task-id` → agent-runtime, skill-runner, workflow-executor

**File:** `services/agent-runtime/src/index.ts`
**What:** Replace `uuidv7()` calls for run tracking with `generateTaskId('task')`.
```ts
import { generateTaskId } from '@sven/shared';
// Replace: const runId = uuidv7();
// With:    const runId = generateTaskId('task');
```
**Also wire into:**
- `services/skill-runner/src/index.ts` — tool run IDs: `generateTaskId('tool')`
- `services/workflow-executor/src/index.ts` — workflow step IDs: `generateTaskId('wf')`

**Test:** IDs appear in logs as `task-XXXX`, `tool-XXXX`, `wf-XXXX`.

#### 1.2 `feature-flags` → gateway-api, agent-runtime

**File:** `services/gateway-api/src/index.ts` (bootstrap)
**What:** Create a singleton `FeatureFlagRegistry`, seed it with env vars + DB.
```ts
import { FeatureFlagRegistry } from '@sven/shared';

const featureFlags = new FeatureFlagRegistry();
// Register known flags:
featureFlags.register('buddy.enhanced_digest', { type: 'boolean', default: false });
featureFlags.register('prompt_guard.enabled', { type: 'boolean', default: false });
featureFlags.register('anti_distillation.enabled', { type: 'percentage', default: 0 });
featureFlags.register('client_attestation.enabled', { type: 'boolean', default: false });
featureFlags.register('memory_extractor.auto_dream', { type: 'boolean', default: false });
// ... load overrides from DB
```
**Also wire into:**
- `services/agent-runtime/src/index.ts` — gate new features behind flags
- Pass registry to subsystems that need it

**Test:** Set `FEATURE_FLAG_BUDDY_ENHANCED_DIGEST=true`, verify flag evaluates.

#### 1.3 `proxy-detect` → gateway-api

**File:** `services/gateway-api/src/index.ts` (early middleware)
**What:** Add `ProxyDetector` as first middleware to extract real client IP.
```ts
import { ProxyDetector } from '@sven/shared';

const proxyDetector = new ProxyDetector({
  trustedProxies: ['10.47.47.0/24', '127.0.0.1'],
});

fastify.addHook('onRequest', async (request) => {
  const info = proxyDetector.detect(request.headers);
  request.realIp = info.clientIp;
  request.proxyInfo = info;
});
```
**Test:** Logs show real client IP instead of proxy IP.

---

### Wave 2 — Security Layer (Permissions + Attestation + Prompt Guard)

**Why second:** Security modules protect all subsequent feature integrations.

#### 2.1 `permission-hierarchy` + `permission-hooks` → gateway-api, agent-runtime

**File:** `services/gateway-api/src/routes/*.ts` (route guards)
**What:** Wrap existing `requireRole()` / policy checks with `PermissionHierarchy`.
```ts
import { PermissionHierarchy, PermissionHooks } from '@sven/shared';

const permEngine = new PermissionHierarchy();
const permHooks = new PermissionHooks(permEngine, {
  onDeny: async (subject, resource, action, reason) => {
    logger.warn({ subject, resource, action, reason }, 'permission denied');
    // Write to audit log table
  },
});

// In route handler:
const allowed = await permHooks.check({
  subject: { userId, roles, orgId },
  resource: 'tool:web_search',
  action: 'execute',
});
```
**Agent-runtime integration:**
- `services/agent-runtime/src/index.ts` — check before tool execution
- Wrap existing `policyEngine.evaluate()` calls
- Add audit trail for denied tool calls

**Test:** Denied tool calls appear in audit log with full context.

#### 2.2 `client-attestation` → gateway-api ↔ all services

**File:** `services/gateway-api/src/index.ts` (outbound middleware)
**What:** Sign all inter-service requests with HMAC.
```ts
import { ClientAttestor } from '@sven/shared';

const attestor = ClientAttestor.fromEnv(); // reads SVEN_ATTESTATION_SECRET

// Outbound: sign requests to agent-runtime, skill-runner, etc.
// Inbound: verify x-sven-attest-* headers on internal routes
```
**All services:** Add `attestor.verify()` to NATS message handlers + HTTP endpoints.

**Env:** Add `SVEN_ATTESTATION_SECRET` to `.env` (≥32 chars).

**Test:** Unsigned requests rejected with 401. Signed requests pass.

#### 2.3 `prompt-guard` → agent-runtime

**File:** `services/agent-runtime/src/index.ts` (message processing loop)
**What:** Scan user input before LLM call, scan output before delivery.
```ts
import { PromptGuard } from '@sven/shared';

const promptGuard = new PromptGuard();
// Register system prompt content (fingerprinted, never stored raw)
promptGuard.registerProtectedContent(systemPrompt);

// Pre-LLM:
const inputScan = promptGuard.scanInput(userMessage);
if (inputScan.severity === 'high') {
  // Log, potentially block or warn
}

// Post-LLM:
const outputScan = promptGuard.scanOutput(llmResponse);
if (outputScan.leaked) {
  // Redact or regenerate
}
```
**Gate behind:** `featureFlags.isEnabled('prompt_guard.enabled')`

**Test:** Send known prompt injection patterns, verify detection logged.

---

### Wave 3 — Execution Engine (Tool Executor + Query Chain + Coordinator)

**Why third:** Once security is in place, upgrade the execution pipeline.

#### 3.1 `tool-executor` → skill-runner

**File:** `services/skill-runner/src/index.ts` (tool execution)
**What:** Replace sequential tool execution with `executeToolBatch()`.
```ts
import { executeToolBatch } from '@sven/shared';

// Current: tools run one at a time
// New: classify tools as concurrent-safe or exclusive, batch execute
const results = await executeToolBatch(toolCalls, {
  classify: (tool) => tool.meta?.exclusive ? 'exclusive' : 'concurrent',
  execute: (tool) => runSingleTool(tool),
  onError: 'cancel-siblings',
});
```
**Test:** Multiple `web_search` calls run in parallel. File writes run exclusively.

#### 3.2 `query-chain` → agent-runtime, skill-runner

**File:** `services/agent-runtime/src/index.ts` (per-turn)
**What:** Track query depth per conversation turn.
```ts
import { QueryChain } from '@sven/shared';

const chain = new QueryChain({ maxDepth: 10, maxBreadth: 50, maxDurationMs: 300_000 });

// Before each LLM call:
const ticket = chain.push({ type: 'llm-call', model });
if (chain.getStatus().circuitOpen) {
  // Break — too deep or too long
}
// After:
chain.pop(ticket);
```
**Test:** Recursive tool calls terminate gracefully at depth 10.

#### 3.3 `coordinator` → agent-runtime (multi-agent), workflow-executor

**File:** `services/agent-runtime/src/index.ts` (subagent dispatch)
**What:** Replace ad-hoc subagent fan-out with `Coordinator.dispatch()`.
```ts
import { Coordinator } from '@sven/shared';

const coord = new Coordinator({ maxConcurrent: 3, scratchpad: new Map() });

// For /prose parallel steps or subagent fan-out:
const results = await coord.dispatch([
  { id: 'research', task: researchPrompt },
  { id: 'code', task: codePrompt },
], { timeout: 60_000 });
```
**Test:** Multi-agent workflows show parallel execution with shared scratchpad.

---

### Wave 4 — Knowledge & Memory (Skill Loader + Memory Extractor + File History)

#### 4.1 `skill-loader` → skill-runner, agent-runtime

**File:** `services/skill-runner/src/index.ts` (initialization)
**What:** Load skills from `skills/` directory using the standard loader.
```ts
import { loadSkills } from '@sven/shared';

const skills = await loadSkills({
  directories: ['skills/'],
  sources: ['system', 'org', 'workspace'],
});
// Expose as tool definitions for LLM
```
Currently skill-runner has its own tool resolution. This standardizes it.

**Test:** Skills auto-discovered from `skills/` directory with YAML frontmatter.

#### 4.2 `memory-extractor` → agent-runtime (background worker)

**File:** `services/agent-runtime/src/index.ts` (post-session)
**What:** After a conversation ends (inactivity timeout), run memory extraction.
```ts
import { MemoryExtractor } from '@sven/shared';

const memExtractor = new MemoryExtractor();

// In the buddy scheduler or a new background worker:
async function consolidateMemories(pool, chatId) {
  const transcript = await loadRecentTranscript(pool, chatId);
  const memories = memExtractor.extract(transcript, chatId);
  for (const mem of memories) {
    await memExtractor.ingest(mem);
  }
  // Periodic "dream" consolidation (merge, decay, prune)
  memExtractor.consolidate();
}
```
**Gate behind:** `featureFlags.isEnabled('memory_extractor.auto_dream')`

Current memory system: `startMemoryMaintenance()` does exponential decay.
New system adds: pattern extraction, category classification, confidence scoring.

**Test:** After conversation, new memories appear with categories and confidence.

#### 4.3 `file-history` → skill-runner

**File:** `services/skill-runner/src/index.ts` (file write tools)
**What:** Track file modifications for undo capability.
```ts
import { FileHistoryManager } from '@sven/shared';

const fileHistory = new FileHistoryManager();

// Before writing a file:
const before = await readFile(path);
// After writing:
fileHistory.recordChange(path, before, after, { toolName, runId });

// For /undo command:
const snapshot = fileHistory.getSnapshots(path);
await fileHistory.rollback(path);
```
**Test:** `/undo` command restores previous file version.

---

### Wave 5 — Response Protection (Anti-Distillation + Stealth Commit)

#### 5.1 `anti-distillation` → agent-runtime

**File:** `services/agent-runtime/src/index.ts` (post-LLM response)
**What:** Watermark responses to detect unauthorized training/scraping.
```ts
import { AntiDistillation } from '@sven/shared';

const antiDistill = AntiDistillation.fromEnv();

// After LLM response, before canvas emit:
const watermarked = antiDistill.watermark(response, {
  orgId, chatId, timestamp: Date.now(),
});
canvasEmitter.emit({ ...event, text: watermarked });
```
**Gate behind:** `featureFlags.isEnabledForSubject('anti_distillation.enabled', orgId)`

**Test:** Response contains invisible watermark. `detectWatermark()` extracts payload.

#### 5.2 `stealth-commit` → skill-runner

**File:** `services/skill-runner/src/index.ts` (git commit handler)
**What:** Format autonomous commits as clean Conventional Commits.
```ts
import { StealthCommitter } from '@sven/shared';

const committer = StealthCommitter.fromEnv();

// When agent auto-commits:
const message = committer.formatMessage({
  type: 'feat',
  scope: 'api',
  summary: 'add user search endpoint',
});
const args = committer.buildCommitArgs(message);
// Execute: git commit ...args
```
**Test:** Commits appear as human-authored, no AI markers, valid Conventional Commits.

---

### Wave 6 — Background & Lifecycle (Background Session + Heartbeat)

#### 6.1 `background-session` → agent-runtime, notification-service

**File:** `services/agent-runtime/src/index.ts`
**What:** Long-running tasks submitted to background session manager.
```ts
import { BackgroundSessionManager } from '@sven/shared';

const bgSessions = new BackgroundSessionManager({ maxConcurrent: 4 });

// For memory consolidation, large digest generation:
const taskId = bgSessions.submit(async (signal) => {
  await consolidateMemories(pool, chatId);
}, { timeout: 120_000 });

// Track progress:
bgSessions.onProgress(taskId, (pct) => {
  logger.info({ taskId, pct }, 'consolidation progress');
});
```
**Test:** Long tasks run without blocking message processing. Progress tracked.

#### 6.2 `adapter/heartbeat` → all channel adapters

**File:** `services/agent-runtime/src/index.ts` (adapter connections)
**What:** Replace ad-hoc reconnection with `HeartbeatManager`.
```ts
import { HeartbeatManager } from '@sven/shared';

const heartbeat = new HeartbeatManager({
  interval: 30_000,
  timeout: 5_000,
  maxRetries: 10,
  onStateChange: (state) => {
    logger.info({ state }, 'adapter connection state');
  },
});

// When adapter connects:
heartbeat.start(async () => {
  const ok = await adapter.ping();
  return ok;
});
```
**Test:** Adapter disconnects trigger exponential backoff reconnection.

---

## Buddy System Enhancement Plan

### Current State
- Basic daily/weekly digest with metrics (pending approvals, errors, improvements)
- Toggle on/off, proactivity level, digest time
- No personality, no visual companion, no learning

### Enhancement Tiers

#### Tier 1 — Smart Digest (Wave 4 dependency: memory-extractor)
```
What changes:
- Memory-driven digest: "You've been working on the API refactor for 3 days.
  Based on your patterns, you usually take breaks after long focused sessions."
- Pattern detection: "I noticed 5 similar errors in the web adapter this week.
  Want me to create an improvement ticket?"
- Proactive suggestions based on extracted preferences/conventions
```

#### Tier 2 — Personality Engine (new module)
```
What to build:
- Mood states: idle, thinking, listening, speaking, happy, concerned
- Personality traits configurable per org (formal ↔ casual, verbose ↔ terse)
- Context-aware greetings (morning/evening, after long absence)
- Celebration messages on milestones (100th chat, first workflow, etc.)
- Streak tracking: "You've been coding for 5 days straight!"
```

#### Tier 3 — Visual Companion (companion-desktop-tauri)
```
What to build:
- Animated avatar in the desktop companion
- Species/theme system (not hex-encoded like Claude Code — use config)
- Stats display: XP, level, streaks, achievements
- Community: buddy profiles in admin-ui
- Hat/accessory system earned through usage milestones
```

### Claude Code Comparison
| Feature | Claude Code | Sven (Current) | Sven (Enhanced) |
|---------|------------|----------------|-----------------|
| Species/pets | ✅ hex-encoded | ❌ | ✅ Tier 3 |
| Stats/levels | ✅ | ❌ | ✅ Tier 3 |
| Hats/accessories | ✅ | ❌ | ✅ Tier 3 |
| Smart digest | ❌ | ✅ basic | ✅ Tier 1 (memory-driven) |
| Proactivity | ❌ | ✅ | ✅ enhanced |
| Learning | ❌ | ❌ | ✅ Tier 1 (memory-extractor) |
| Improvement proposals | ❌ | ✅ | ✅ enhanced |
| Desktop companion | ❌ | ✅ Tauri app | ✅ Tier 3 (animated) |
| Mobile companion | ❌ | ✅ Flutter app | ✅ Tier 3 |

**Sven advantage:** Buddy is integrated with real operational data (tool runs,
errors, approvals, workflows). Claude Code's buddy is cosmetic only.

---

## Feature Flag Mapping (from Claude Code leak)

Map each Claude Code feature to what Sven already has or should build:

| Claude Code Flag | Sven Equivalent | Status |
|-----------------|----------------|--------|
| KAIROS (persistent AI) | Agent-runtime sessions | ✅ Built |
| PROACTIVE (background agents) | Buddy scheduler + background-session | ✅ Module ready |
| COORDINATOR_MODE | coordinator.ts | ✅ Module ready |
| BG_SESSIONS | background-session.ts | ✅ Module ready |
| BUDDY (pet system) | Buddy system + companion apps | ✅ Basic, enhance in Tier 2-3 |
| TOKEN_BUDGET | token-budget.ts | ✅ Module ready |
| EXTRACT_MEMORIES | memory-extractor.ts | ✅ Module ready |
| REACTIVE_COMPACT | CompactionService | ✅ Built |
| CONTEXT_COLLAPSE | CompactionService | ✅ Built |
| HISTORY_SNIP | CompactionService | ✅ Built |
| FORK_SUBAGENT | coordinator.ts | ✅ Module ready |
| SKILL_SEARCH | skill-loader.ts | ✅ Module ready |
| VOICE_MODE | /voice command | ✅ Built |
| WEB_BROWSER | Playwright in skill-runner | ✅ Built |
| WORKFLOW_SCRIPTS | Prose workflow engine | ✅ Built (40+ commands) |
| BRIDGE_MODE | companion-desktop-tauri | ✅ Built |
| DAEMON | PM2/systemd services | ✅ Built |
| MONITOR_TOOL | Prometheus/Grafana stack | ✅ Built |
| SELF_HOSTED | docker-compose deployment | ✅ Built |
| ULTRAPLAN | Prose planner | ✅ Built |
| TEMPLATES | Prose templates | ✅ Built |
| CHICAGO_MCP | MCP integration | ✅ Built |

**Sven has prior art or modules ready for 22/32 Claude Code features.**
The remaining 10 are either internal-only (TORCH, ABLATION_BASE, DUMP_SYS_PROMPT)
or infrastructure-specific (CCR_AUTO, BYOC_RUNNER, UDS_INBOX).

---

## Execution Order & Dependencies

```
Wave 1 (Foundation)          Wave 2 (Security)           Wave 3 (Execution)
├─ task-id ──────────────┐   ├─ permission-hierarchy ──┐  ├─ tool-executor
├─ feature-flags ────────┤   ├─ permission-hooks ──────┤  ├─ query-chain
└─ proxy-detect          │   ├─ client-attestation     │  └─ coordinator
                         │   └─ prompt-guard           │
                         ▼                             ▼
                    Wave 4 (Knowledge)            Wave 5 (Protection)
                    ├─ skill-loader               ├─ anti-distillation
                    ├─ memory-extractor           └─ stealth-commit
                    └─ file-history
                         │
                         ▼
                    Wave 6 (Lifecycle)
                    ├─ background-session
                    └─ adapter/heartbeat
```

---

## Per-Wave Checklist

### For each module integration:
- [ ] Read the current service code where integration happens
- [ ] Import the module
- [ ] Initialize in the service bootstrap (singleton or per-request)
- [ ] Wire into the correct processing stage
- [ ] Gate behind feature flag if risky
- [ ] Add structured log events for observability
- [ ] Test: happy path works
- [ ] Test: feature flag off = old behavior
- [ ] Test: error in module doesn't crash service
- [ ] Deploy to VM8 and verify

### For each wave:
- [ ] All modules in wave integrated
- [ ] All services rebuilt and deployed
- [ ] Logs show module activity
- [ ] No regressions in existing functionality
- [ ] Feature flags documented in .env.example

---

## Risk Assessment

| Wave | Risk | Mitigation |
|------|------|-----------|
| 1 | Low — additive only | Feature flags default off |
| 2 | Medium — security changes | Gate behind flags, fallback to existing policy engine |
| 3 | Medium — execution changes | Run old + new in parallel, compare results |
| 4 | Low — background workers | No user-facing impact if disabled |
| 5 | Low — post-processing | Gate behind percentage rollout |
| 6 | Low — lifecycle management | Enhances existing reconnection logic |

---

## Environment Variables (New)

```bash
# Wave 1
# (none — feature flags read from DB + existing env)

# Wave 2
SVEN_ATTESTATION_SECRET=       # ≥32 chars, HMAC signing key

# Wave 5
SVEN_FINGERPRINT_SECRET=       # Anti-distillation signing key
SVEN_WATERMARK_ENABLED=false   # Master watermark switch
SVEN_COMMIT_AUTHOR_NAME=Sven
SVEN_COMMIT_AUTHOR_EMAIL=sven@sven.systems
```

---

## Estimated Effort

| Wave | Modules | Services Touched | Complexity |
|------|---------|-----------------|------------|
| 1 | 3 | 4 | Simple — import + init |
| 2 | 4 | 3 | Medium — middleware + guards |
| 3 | 3 | 3 | Medium — execution pipeline |
| 4 | 3 | 2 | Medium — workers + loaders |
| 5 | 2 | 2 | Simple — post-processing |
| 6 | 2 | 2 | Simple — lifecycle hooks |

**Total: 18 modules, 36 integration points across 5 services.**

Each wave is ~1 focused session. Full integration: ~6 sessions.

---

## Success Criteria

When all waves are complete:
1. Every service imports and actively uses its assigned modules
2. Feature flags control rollout of each module
3. Structured logs show module activity (task IDs, permission checks, etc.)
4. Buddy system enhanced with memory-driven insights
5. No regressions — all existing 40+ commands work unchanged
6. Inter-service requests are HMAC-signed and verified
7. Prompt injection attempts are detected and logged
8. Tool executions use concurrent batching where safe
9. File modifications are tracked with undo capability
10. Response watermarks are present for opted-in organizations
