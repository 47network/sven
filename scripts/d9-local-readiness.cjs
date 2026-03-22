#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const D9_LOCAL_SCOPE_LABEL = 'local_diagnostic_readiness_only';
const latestStatusPath = path.join(outDir, 'latest.json');
const checklistSyncReportPath = path.join(outDir, 'checklist-sync-diff-latest.json');
const canonicalParityChecklistRel = 'docs/parity/Sven_Parity_Checklist.md';
const canonicalReleaseChecklistRel = 'docs/release/checklists/sven-production-parity-checklist-2026.md';

function runStep(step, cmd, args, extraEnv = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
  return {
    step,
    command: [cmd, ...args].join(' '),
    status: typeof result.status === 'number' ? result.status : 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function quoteArg(arg) {
  const s = String(arg);
  if (/[\s"]/u.test(s)) return `"${s.replace(/"/g, '\\"')}"`;
  return s;
}

function runNpmStep(step, npmArgs, extraEnv = {}) {
  if (process.platform === 'win32') {
    const cmdline = ['npm', ...npmArgs].map(quoteArg).join(' ');
    return runStep(step, 'cmd.exe', ['/d', '/s', '/c', cmdline], extraEnv);
  }
  return runStep(step, 'npm', npmArgs, extraEnv);
}

function createRunId() {
  const fromEnv = String(process.env.SVEN_D9_LOCAL_READINESS_RUN_ID || '').trim();
  if (fromEnv) return fromEnv;
  const stamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `d9-local-${stamp}-${random}`;
}

function evaluateReleaseStatusSemantics() {
  const base = {
    step: 'release_status_semantics',
    command: 'validate docs/release/status/latest.json d9-local semantic fields',
    status: 0,
    stdout: '',
    stderr: '',
  };
  if (!fs.existsSync(latestStatusPath)) {
    return {
      ...base,
      status: 2,
      stderr: 'missing docs/release/status/latest.json',
    };
  }
  let latest;
  try {
    latest = JSON.parse(fs.readFileSync(latestStatusPath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (err) {
    return {
      ...base,
      status: 2,
      stderr: `invalid latest.json: ${String(err && err.message ? err.message : err)}`,
    };
  }

  const d9CiGate = latest?.d9_keycloak_interop?.ci_gate === true;
  const d9LocalSelfcheckPass = String(latest?.d9_keycloak_interop?.local_selfcheck_status || '').toLowerCase() === 'pass';
  const d9LocalSelfcheckValidated =
    String(latest?.d9_keycloak_interop?.local_selfcheck_validation_status || '').toLowerCase() === 'valid';
  const blockers = [];
  if (!d9CiGate) blockers.push(`d9_keycloak_interop.ci_gate=${String(latest?.d9_keycloak_interop?.ci_gate)}`);
  if (!d9LocalSelfcheckPass) blockers.push(`d9_keycloak_interop.local_selfcheck_status=${String(latest?.d9_keycloak_interop?.local_selfcheck_status || '(missing)')}`);
  if (!d9LocalSelfcheckValidated) blockers.push(`d9_keycloak_interop.local_selfcheck_validation_status=${String(latest?.d9_keycloak_interop?.local_selfcheck_validation_status || '(missing)')}`);
  return {
    ...base,
    status: blockers.length > 0 ? 2 : 0,
    stdout:
      blockers.length > 0
        ? ''
        : 'semantics pass (d9_ci_gate=true, d9_local_selfcheck_status=pass, d9_local_selfcheck_validation_status=valid)',
    stderr: blockers.length > 0 ? `semantic blockers: ${blockers.join('; ')}` : '',
  };
}

function evaluateChecklistSyncEffectiveness() {
  const base = {
    step: 'checklist_sync_effective',
    command: 'validate checklist-sync canonical targets and non-missing diagnostics',
    status: 0,
    stdout: '',
    stderr: '',
  };
  if (!fs.existsSync(checklistSyncReportPath)) {
    return {
      ...base,
      status: 2,
      stderr: 'missing docs/release/status/checklist-sync-diff-latest.json',
    };
  }
  let report;
  try {
    report = JSON.parse(fs.readFileSync(checklistSyncReportPath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (err) {
    return {
      ...base,
      status: 2,
      stderr: `invalid checklist-sync report: ${String(err && err.message ? err.message : err)}`,
    };
  }
  const statusValue = String(report?.status || '').toLowerCase();
  const mainChecklist = String(report?.files?.main_checklist || '').replace(/\\/g, '/');
  const releaseChecklist = String(report?.files?.release_checklist || '').replace(/\\/g, '/');
  const missingCount = Number(report?.summary?.missing);
  const blockers = [];
  if (statusValue !== 'pass') blockers.push(`status=${statusValue || '(missing)'}`);
  if (mainChecklist !== canonicalParityChecklistRel) {
    blockers.push(`main_checklist=${mainChecklist || '(missing)'}`);
  }
  if (releaseChecklist !== canonicalReleaseChecklistRel) {
    blockers.push(`release_checklist=${releaseChecklist || '(missing)'}`);
  }
  if (!Number.isFinite(missingCount) || missingCount !== 0) {
    blockers.push(`summary.missing=${String(report?.summary?.missing)}`);
  }
  return {
    ...base,
    status: blockers.length > 0 ? 2 : 0,
    stdout:
      blockers.length > 0
        ? ''
        : `checklist-sync effective (main=${mainChecklist}, release=${releaseChecklist}, missing=${missingCount})`,
    stderr: blockers.length > 0 ? `checklist-sync blockers: ${blockers.join('; ')}` : '',
  };
}

function writeReport(status, steps, selfcheckExecuted, meta = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const d9LocalScopeStatus =
    status === 'pass'
      ? 'local_scope_pass'
      : status === 'incomplete'
      ? 'local_scope_incomplete'
      : 'local_scope_fail';
  const report = {
    type: 'd9_local_readiness',
    generated_at_utc: new Date().toISOString(),
    run_id: String(meta.runId || ''),
    phase: String(meta.phase || ''),
    status,
    d9_local_scope_status: d9LocalScopeStatus,
    scope: {
      label: D9_LOCAL_SCOPE_LABEL,
      ci_backed: false,
      production_readiness_claim_allowed: false,
      note: 'D9 local readiness is a local diagnostic scope artifact, not a production release-readiness signal.',
    },
    selfcheck_executed: selfcheckExecuted === true,
    steps,
  };
  const jsonPath = path.join(outDir, 'd9-local-readiness-latest.json');
  const mdPath = path.join(outDir, 'd9-local-readiness-latest.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const md = [
    '# D9 Local Readiness',
    '',
    `- Generated: ${report.generated_at_utc}`,
    `- Status: ${status.toUpperCase()}`,
    `- Scope: ${D9_LOCAL_SCOPE_LABEL}`,
    `- Scope Status: ${d9LocalScopeStatus}`,
    '- Production Readiness Claim Allowed: false',
    `- Selfcheck Executed: ${report.selfcheck_executed ? 'true' : 'false'}`,
    '',
    '## Steps',
    '',
    ...steps.map((s) => `- ${s.step}: status=${s.status}`),
    '',
  ];
  fs.writeFileSync(mdPath, `${md.join('\n')}\n`, 'utf8');
  console.log(`wrote: ${path.relative(root, jsonPath)}`);
  console.log(`wrote: ${path.relative(root, mdPath)}`);
}

function main() {
  const steps = [];
  let selfcheckExecuted = false;
  const runId = createRunId();
  const scriptArgs = process.argv.slice(2);
  const skipSelfcheck = scriptArgs.includes('--skip-selfcheck');
  const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
  const devEnvironment = nodeEnv === 'development';
  const debugSkipAllowed =
    devEnvironment
    && (
      scriptArgs.includes('--debug')
      || scriptArgs.includes('--allow-debug-skip-selfcheck')
      || String(process.env.SVEN_D9_ALLOW_SKIP_SELFCHECK || '').trim() === '1'
    );

  if (skipSelfcheck) {
    steps.push({
      step: 'd9_selfcheck_local',
      command: 'npm run release:sso:keycloak:interop:selfcheck:local -- --strict',
      status: 2,
      stdout: 'skipped (--skip-selfcheck)',
      stderr: '',
    });
    if (!debugSkipAllowed) {
      steps.push({
        step: 'skip_selfcheck_policy',
        command: 'enforce_debug_only_skip_selfcheck',
        status: 2,
        stdout: '',
        stderr: '--skip-selfcheck is dev-only; require NODE_ENV=development plus --debug/--allow-debug-skip-selfcheck or SVEN_D9_ALLOW_SKIP_SELFCHECK=1',
      });
      writeReport('fail', steps, selfcheckExecuted, { runId, phase: 'skip_blocked' });
      process.exit(1);
    }
    steps.push({
      step: 'skip_selfcheck_policy',
      command: 'block_release_signoff_on_skipped_selfcheck',
      status: 2,
      stdout: 'debug skip accepted for diagnostics-only execution',
      stderr: 'release-signoff blocked: selfcheck skipped',
    });
    writeReport('incomplete', steps, selfcheckExecuted, { runId, phase: 'skip_debug_incomplete' });
    process.exit(1);
  }

  if (!skipSelfcheck) {
    selfcheckExecuted = true;
    const selfcheck = runNpmStep('d9_selfcheck_local', ['run', 'release:sso:keycloak:interop:selfcheck:local', '--', '--strict']);
    steps.push(selfcheck);
    if (selfcheck.status !== 0) {
      writeReport('fail', steps, selfcheckExecuted, { runId, phase: 'selfcheck_failed' });
      process.exit(1);
    }
  }

  const status = runNpmStep('release_status_refresh', ['run', 'release:status', '--', '--strict']);
  steps.push(status);
  const semanticStatus = evaluateReleaseStatusSemantics();
  steps.push(semanticStatus);
  if (semanticStatus.status !== 0) {
    writeReport('fail', steps, selfcheckExecuted, { runId, phase: 'release_status_semantics_failed' });
    process.exit(1);
  }

  const ciRequiredChecks = runNpmStep('ci_required_checks_pass', ['run', 'release:ci:required:check:local', '--', '--strict']);
  steps.push(ciRequiredChecks);

  const ciGatesRefresh = runNpmStep('ci_gates_refresh_local', ['run', 'release:ci:gates:refresh:local']);
  steps.push(ciGatesRefresh);
  if (ciGatesRefresh.status !== 0) {
    writeReport('fail', steps, selfcheckExecuted, { runId, phase: 'ci_gates_refresh_failed' });
    process.exit(1);
  }

  const checklist = runNpmStep('checklist_sync', ['run', 'release:checklist:update']);
  steps.push(checklist);
  if (checklist.status !== 0) {
    writeReport('fail', steps, selfcheckExecuted, { runId, phase: 'checklist_sync_failed' });
    process.exit(1);
  }
  const checklistSyncEffectiveness = evaluateChecklistSyncEffectiveness();
  steps.push(checklistSyncEffectiveness);
  if (checklistSyncEffectiveness.status !== 0) {
    writeReport('fail', steps, selfcheckExecuted, { runId, phase: 'checklist_sync_effective_failed' });
    process.exit(1);
  }

  writeReport('pass', steps, selfcheckExecuted, { runId, phase: 'completed_local_scope' });
  process.exit(0);
}

main();
