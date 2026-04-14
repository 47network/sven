export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'explain_pipeline': {
      return {
        result: {
          title: 'Sven Self-Healing Pipeline v9 — Complete Workflow',
          overview: 'A production-grade self-healing system with 33 safety features. The pipeline detects issues, proposes fixes, requires admin approval, applies changes on isolated branches, verifies with build+test, and auto-reverts on failure.',
          workflow: [
            {
              step: 1,
              name: 'Detection',
              description: 'Issues are detected via three paths:',
              paths: [
                'Proactive diagnostics loop (runs every 15s degraded / 60s healthy) — tsc --noEmit across all services',
                'Runtime log scanning — Docker logs checked for crash patterns (OOM, uncaught exceptions, ECONNREFUSED, SIGKILL)',
                'Manual scan via sven.ops.code_scan — triggered by admin or Sven himself',
              ],
            },
            {
              step: 2,
              name: 'Analysis',
              description: 'Sven analyzes the error, determines the root cause, and generates a fix with file diffs.',
              tools: ['sven.ops.code_scan', 'sven.ops.logs', 'sven.ops.health'],
            },
            {
              step: 3,
              name: 'Fix Proposal',
              description: 'sven.ops.code_fix creates an approval record with the unified diff. The fix is NOT applied yet.',
              safety: 'Admin must /approve the fix before any code changes. This is the human-in-the-loop gate.',
            },
            {
              step: 4,
              name: 'Approval & Execution',
              description: 'Admin approves via /approve command. The pipeline then:',
              substeps: [
                'Claims approval atomically (CAS — prevents double-execution)',
                'Checks fix deduplication (SHA-256 of diff — prevents identical fixes within 24h)',
                'Checks file quarantine (files failing 3+ times in 24h are blocked)',
                'Checks system resources (RAM/disk — defers if critically low)',
                'Creates pre-heal git checkpoint tag (sven-checkpoint/<timestamp>)',
                'Checks fix rate limit (max 3 per file per 30min)',
                'Applies fix on sven-heal/<timestamp> branch (isolation)',
              ],
            },
            {
              step: 5,
              name: 'Verification',
              description: 'After applying the fix:',
              checks: [
                'tsc --noEmit — TypeScript compilation must pass',
                'Jest tests — affected service tests must pass',
                'If either fails → auto-revert, quarantine file, record failure',
              ],
            },
            {
              step: 6,
              name: 'Merge & Deploy Chain',
              description: 'On success:',
              actions: [
                'Fix branch merged to main',
                'Dedup hash recorded (prevents re-application)',
                'Deploy approval automatically created (fix→deploy chaining)',
                'NATS heal.event.code_fix published for cross-service awareness',
              ],
            },
            {
              step: 7,
              name: 'Deployment',
              description: 'Admin approves deploy. Pipeline executes:',
              substeps: [
                'Pre-deploy build gate (tsc --noEmit on all services)',
                'Container image snapshot (for rollback)',
                'docker compose up -d --build on target service',
                'Docker health check polling',
                'HTTP /healthz probe',
                'Smoke tests (4 endpoints: healthz, readyz, API root, auth rejection)',
                '2-minute watch window (15s probes, 2 failures → rollback)',
                'Automatic rollback on any failure stage',
              ],
            },
          ],
        },
      };
    }

    case 'diagnose_workflow': {
      return {
        result: {
          title: 'How to Diagnose Issues — Step by Step',
          steps: [
            {
              step: 1,
              action: 'Check service health',
              tool: 'sven.ops.health',
              description: 'Returns Docker container status, HTTP health probes, resource usage. Start here to identify which service is unhealthy.',
            },
            {
              step: 2,
              action: 'Check container logs',
              tool: 'sven.ops.logs',
              inputs: { service: 'gateway-api', lines: 100 },
              description: 'Read recent logs for the unhealthy service. Look for error patterns, stack traces, connection failures.',
            },
            {
              step: 3,
              action: 'Run code scan',
              tool: 'sven.ops.code_scan',
              description: 'Runs tsc --noEmit + npm audit across all services. Reports TypeScript errors, lint issues, and dependency vulnerabilities.',
            },
            {
              step: 4,
              action: 'Check infrastructure',
              tool: 'sven.ops.infra',
              description: 'Returns full VM topology, Docker container inventory, network configuration, resource limits.',
            },
            {
              step: 5,
              action: 'Review heal history',
              tool: 'sven.ops.heal_history',
              description: 'Check recent heal attempts, success/failure rates, quarantined files, circuit breaker status, telemetry counters.',
            },
            {
              step: 6,
              action: 'Propose fix',
              tool: 'sven.ops.code_fix',
              description: 'Once you understand the issue, propose a code fix. Provide file path and unified diff. Creates an approval for admin review.',
            },
          ],
          importantNotes: [
            'Always diagnose BEFORE proposing a fix — understand the root cause first',
            'Check heal_history to see if this issue was already attempted (dedup check)',
            'If a file is quarantined, mention this to admin — they can clear it via heal_history with clear_quarantine',
            'Never skip the approval step — the human-in-the-loop gate is a safety requirement',
          ],
        },
      };
    }

    case 'list_tools': {
      return {
        result: {
          title: 'All Self-Healing / Ops Tools',
          tools: [
            { name: 'sven.ops.code_scan', purpose: 'Scan codebase for TypeScript errors, lint issues, dependency vulnerabilities', inputs: 'none (scans all services)' },
            { name: 'sven.ops.code_fix', purpose: 'Propose a code fix with file diffs — creates approval record for admin review', inputs: '{ file_path, description, diff }' },
            { name: 'sven.ops.deploy', purpose: 'Deploy a service with full health check pipeline (build gate, smoke tests, watch window, auto-rollback)', inputs: '{ service }' },
            { name: 'sven.ops.rollback', purpose: 'Revert recent changes with dry-run preview, depth guard (max 5), build verification', inputs: '{ depth?, dry_run? }' },
            { name: 'sven.ops.heal_history', purpose: 'Introspect heal audit trail — stats, approvals, CB status, telemetry, quarantined files, phase durations', inputs: '{ action: "stats"|"approvals"|"quarantine"|"clear_quarantine" }' },
            { name: 'sven.ops.health', purpose: 'Check service health — Docker status, HTTP probes, resource usage', inputs: '{ service? }' },
            { name: 'sven.ops.infra', purpose: 'Full infrastructure topology — VMs, Docker containers, network, resources', inputs: 'none' },
            { name: 'sven.ops.logs', purpose: 'Read container logs for a service', inputs: '{ service, lines? }' },
            { name: 'sven.ops.config', purpose: 'View and propose config/settings changes', inputs: '{ action }' },
            { name: 'sven.ops.deep_scan', purpose: 'Deep SAST security scan — 15+ vulnerability patterns across 12 categories', inputs: 'none' },
            { name: 'sven.ops.pentest', purpose: 'Live penetration testing against own APIs — OWASP Top 10, auth bypass, headers, CORS', inputs: '{ target? }' },
          ],
        },
      };
    }

    case 'tool_usage': {
      const toolName = (input.tool_name as string) || '';
      const guides: Record<string, object> = {
        code_scan: {
          tool: 'sven.ops.code_scan',
          whenToUse: 'When you suspect TypeScript errors, after making code changes, or periodically to check codebase health',
          howToCall: 'Just invoke with no special inputs — it scans all services automatically',
          whatItReturns: 'Array of findings: { file, line, severity, message, service }',
          nextSteps: 'For each finding, decide if you can fix it → call sven.ops.code_fix with the fix diff',
          caveats: [
            'Runs tsc --noEmit which can take 30-60 seconds per service',
            'Also runs npm audit for dependency vulnerabilities',
            'Results may include pre-existing issues — focus on new/relevant ones',
          ],
        },
        code_fix: {
          tool: 'sven.ops.code_fix',
          whenToUse: 'After diagnosing an issue via code_scan or logs, when you have a concrete fix',
          howToCall: 'Provide: file_path (relative to service), description (what the fix does and why), diff (unified diff format)',
          whatItReturns: 'Approval ID — the fix is queued for admin review, NOT applied yet',
          nextSteps: 'Wait for admin to /approve. The pipeline handles the rest (branch, apply, verify, merge, deploy chain)',
          caveats: [
            'Fix deduplication: identical diffs within 24h are rejected',
            'File quarantine: files with 3+ failures in 24h are blocked — ask admin to clear',
            'Rate limit: max 3 fixes per file per 30 minutes',
            'Impact estimation: the pipeline calculates blast radius (lines, files, services, risk score)',
          ],
        },
        deploy: {
          tool: 'sven.ops.deploy',
          whenToUse: 'After a code fix is merged, or when admin requests a service restart/rebuild',
          howToCall: 'Provide: { service: "gateway-api" } (or other service name)',
          whatItReturns: 'Deploy result with health check status, smoke test results',
          pipeline: [
            '1. Resource guard (RAM/disk check)',
            '2. Pre-deploy build gate (tsc --noEmit)',
            '3. Container image snapshot (for rollback)',
            '4. docker compose up -d --build',
            '5. Docker health check polling',
            '6. HTTP /healthz probe',
            '7. 4 smoke tests (healthz, readyz, root, auth)',
            '8. 2-minute watch window (15s probes)',
            '9. Auto-rollback on any failure',
          ],
          caveats: [
            'Deploy requires its own approval (created automatically by fix→deploy chaining)',
            'Self-restart awareness: if deploying skill-runner, it restarts others first, then delays self-restart',
            '10-minute pipeline timeout prevents mutex starvation',
          ],
        },
        rollback: {
          tool: 'sven.ops.rollback',
          whenToUse: 'When a deployed fix causes issues that the auto-rollback did not catch',
          howToCall: 'Provide: { depth: 1, dry_run: true } for preview, then { depth: 1 } for real rollback',
          whatItReturns: 'Rollback result — git revert applied, build verified',
          caveats: [
            'Max depth: 5 (cannot revert more than 5 commits)',
            'Always do dry_run first to preview what will be reverted',
            'Build verification runs after revert — if build fails, revert is aborted',
            'Rollback creates its own deploy approval (rollback→deploy chaining)',
          ],
        },
        heal_history: {
          tool: 'sven.ops.heal_history',
          whenToUse: 'To understand recent heal activity, check success rates, identify problematic files, monitor circuit breaker',
          howToCall: 'Provide action: "stats" (overview), "approvals" (recent), "quarantine" (blocked files), "clear_quarantine" (unblock file)',
          whatItReturns: {
            stats: 'Per-tool success/fail/revert counts, circuit breaker status, telemetry counters',
            approvals: 'Recent approval records with status, timestamps, diffs',
            quarantine: 'List of quarantined files with failure counts and timestamps',
          },
          caveats: [
            'Circuit breaker: 3-state (closed/open/half-open). Auto-decays by 1 failure per 10min idle',
            'Telemetry: 15+ counters flushed to ops_audit_log every 10min',
            'Phase durations: mean/p95/max for build_verify, test_verify, code_fix, deploy',
          ],
        },
      };

      const guide = guides[toolName];
      if (!guide) {
        return {
          result: {
            error: `Unknown tool "${toolName}". Available: ${Object.keys(guides).join(', ')}`,
            hint: 'Pass tool_name without the "sven.ops." prefix (e.g. tool_name: "code_scan")',
          },
        };
      }
      return { result: guide };
    }

    case 'safety_features': {
      return {
        result: {
          title: 'All 33 Self-Healing Safety Features',
          features: [
            { id: 1, name: 'File Quarantine', description: 'Files failing 3+ heal attempts in 24h are auto-blocked' },
            { id: 2, name: 'Resource Guard', description: 'RAM/disk checks before builds/deploys — defers if critically low' },
            { id: 3, name: 'Pre-Heal Git Tags', description: 'sven-checkpoint/<timestamp> created before every operation' },
            { id: 4, name: 'Fix Deduplication', description: 'SHA-256 hashing prevents identical fixes within 24h' },
            { id: 5, name: 'Heal Confidence Scoring', description: 'Per-file historical success/failure rates → HIGH/MEDIUM/LOW confidence' },
            { id: 6, name: 'Auto-Severity Classification', description: 'CRITICAL (auth/security), HIGH (shared/contracts), MEDIUM (service), LOW (tests/docs)' },
            { id: 7, name: 'Git Stash Protection', description: 'Uncommitted manual work auto-stashed before heal and restored after' },
            { id: 8, name: 'Concurrent Heal Mutex', description: 'Promise-based sequential execution — one heal at a time' },
            { id: 9, name: 'Rate Limiter', description: 'Max 3 fixes per file per 30 minutes (storm guard)' },
            { id: 10, name: 'Dry-Run Simulation', description: 'Apply fix on temp branch, run build+test, discard — preview without merging' },
            { id: 11, name: 'Branch Isolation', description: 'Every fix on dedicated sven-heal/<timestamp> branch with auto-rollback' },
            { id: 12, name: 'Cross-Service Impact Guard', description: 'Changes to packages/shared or contracts/ trigger full build across ALL services' },
            { id: 13, name: 'Build Verification', description: 'tsc --noEmit must pass before merge' },
            { id: 14, name: 'Test Verification', description: 'Jest tests for affected services must pass; failures auto-revert' },
            { id: 15, name: 'Unified Diff Preview', description: 'Every approval stores full unified diff for review' },
            { id: 16, name: 'Fix→Deploy Chaining', description: 'Successful code fix auto-creates deploy approval' },
            { id: 17, name: 'NATS Heal Events', description: 'heal.event.code_fix, deploy, escalation, proactive_detection published' },
            { id: 18, name: 'Persistent Circuit Breaker', description: '3-state (closed/open/half-open), survives restarts via ops_audit_log hydration' },
            { id: 19, name: 'Heal Telemetry', description: '15+ counters: fixes applied/reverted/deduped, deploys, CB trips, resource blocks' },
            { id: 20, name: 'Heal History Introspection', description: 'Full audit log with stats, approvals, CB status, quarantined files' },
            { id: 21, name: 'Manual Rollback', description: 'sven.ops.rollback with dry-run, depth guard (max 5), build verification' },
            { id: 22, name: 'Proactive Heal Detection', description: 'Diagnostics loop runs tsc --noEmit and publishes NATS events on errors' },
            { id: 23, name: 'Runtime Log Scanning', description: 'Docker logs scanned for crash patterns (OOM, ECONNREFUSED, SIGKILL, heap)' },
            { id: 24, name: 'Stale Approval Escalation', description: 'Critical approvals pending >1h trigger NATS events + chat reminders' },
            { id: 25, name: 'Adaptive Self-Diagnostics', description: 'Loop runs 15s degraded / 60s healthy checking 10+ health dimensions' },
            { id: 26, name: 'Subscriber Crash Recovery', description: 'NATS approval subscriber auto-restarts with linear backoff (max 5 retries)' },
            { id: 27, name: 'Heal Duration Tracking', description: 'Phase timing (mean/p95/max) for build, test, code_fix, deploy' },
            { id: 28, name: 'Checkpoint Tag Cleanup', description: 'Diagnostics prune sven-checkpoint/* tags older than 7 days' },
            { id: 29, name: 'Circuit Breaker Auto-Decay', description: '1 failure decays per 10min idle — CB does not stay open forever' },
            { id: 30, name: 'Dependency Vulnerability Scanning', description: 'npm audit every 20min, high/critical CVEs trigger proactive events' },
            { id: 31, name: 'Pipeline Timeout', description: '10-minute max per operation prevents mutex starvation' },
            { id: 32, name: 'Fix Impact Estimation', description: 'Lines added/removed, files changed, services affected, 0-100 risk score' },
            { id: 33, name: 'Persistent Telemetry Snapshots', description: 'Counters flushed to ops_audit_log every 10min, survive restarts' },
          ],
        },
      };
    }

    case 'troubleshoot': {
      const symptom = (input.symptom as string) || '';
      const lower = symptom.toLowerCase();

      // Match symptom to diagnostic path
      if (lower.includes('typescript') || lower.includes('tsc') || lower.includes('type error') || lower.includes('compile')) {
        return {
          result: {
            diagnosis: 'TypeScript Compilation Error',
            steps: [
              '1. Run sven.ops.code_scan to get full error list',
              '2. Read the affected file(s) to understand context',
              '3. Propose fix via sven.ops.code_fix with the corrected code diff',
              '4. Wait for admin approval',
              '5. Pipeline will verify fix compiles cleanly before merging',
            ],
            tips: 'Check if the file is quarantined (sven.ops.heal_history action: quarantine). If so, ask admin to clear quarantine first.',
          },
        };
      }

      if (lower.includes('container') || lower.includes('crash') || lower.includes('restart') || lower.includes('oom') || lower.includes('down')) {
        return {
          result: {
            diagnosis: 'Container Crash / Health Issue',
            steps: [
              '1. Run sven.ops.health to check container status',
              '2. Run sven.ops.logs for the affected service (look for crash patterns)',
              '3. Check if it is an OOM — resource limits may need adjustment (config change, not code fix)',
              '4. If code issue → sven.ops.code_scan, then code_fix',
              '5. If config issue → sven.ops.config to propose adjustment',
              '6. Deploy fix via sven.ops.deploy',
            ],
            tips: 'Runtime log scanning also catches these automatically — check if a proactive detection event was already published.',
          },
        };
      }

      if (lower.includes('deploy') || lower.includes('rollback') || lower.includes('failed deploy')) {
        return {
          result: {
            diagnosis: 'Deployment Failure',
            steps: [
              '1. The deploy pipeline has auto-rollback — check if it already rolled back (sven.ops.heal_history)',
              '2. Run sven.ops.logs for the service to understand what went wrong post-deploy',
              '3. If auto-rollback did not trigger, use sven.ops.rollback with dry_run first',
              '4. Fix the underlying issue, then re-deploy',
            ],
            tips: 'Deploy failures are recorded in telemetry. Check circuit breaker status — too many failures may have tripped it.',
          },
        };
      }

      if (lower.includes('circuit breaker') || lower.includes('blocked') || lower.includes('quarantine')) {
        return {
          result: {
            diagnosis: 'Heal Pipeline Blocked',
            steps: [
              '1. Run sven.ops.heal_history with action "stats" to check CB state and telemetry',
              '2. If circuit breaker is OPEN: wait for auto-decay (1 failure/10min idle) or ask admin to manually reset',
              '3. If file is quarantined: run heal_history with action "quarantine" to see which files',
              '4. Ask admin to clear quarantine for specific files if the underlying issue is resolved',
              '5. Check rate limiter — if hitting 3 fixes/file/30min, back off and investigate root cause',
            ],
            tips: 'The CB auto-decays and the diagnostics loop keeps running. Most blocks resolve themselves within 30-60 minutes.',
          },
        };
      }

      // Generic fallback
      return {
        result: {
          diagnosis: 'General Issue — Follow Standard Diagnostic Flow',
          steps: [
            '1. sven.ops.health — check all service health',
            '2. sven.ops.logs — read logs for affected service',
            '3. sven.ops.code_scan — check for code errors',
            '4. sven.ops.infra — verify infrastructure status',
            '5. sven.ops.heal_history — check recent heal activity and CB status',
            '6. Based on findings: sven.ops.code_fix → approval → deploy',
          ],
          tips: 'Provide a more specific symptom description for targeted guidance. Example: "typescript error in trading.ts", "gateway-api container crashing", "deploy failed".',
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Use: explain_pipeline, diagnose_workflow, list_tools, tool_usage, safety_features, troubleshoot` };
  }
}
