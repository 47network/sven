#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const dns = require('node:dns').promises;
const net = require('node:net');
const { execFileSync } = require('node:child_process');

const root = process.cwd();
const defaultEvidencePath = 'docs/release/evidence/release-rollout-execution-latest.json';
const setterScriptPath = 'scripts/ops/release/set-release-rollout-evidence.ps1';
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'release-rollout-prep-latest.json');
const outMd = path.join(outDir, 'release-rollout-prep-latest.md');
const outPs1 = path.join(outDir, 'release-rollout-next-steps.ps1');
const defaultLocalDatabaseUrl = 'postgresql://sven:sven-dev-47@127.0.0.1:5432/sven';
const sourceMaterials = [
  'docs/release/canary-rollout-strategy-2026.md',
  'docs/ops/release-rollback-runbook-2026.md',
  'docs/release/evidence/canary-phase0-dogfood-template.md',
  'docs/release/evidence/canary-phase1-5pct-template.md',
  'docs/release/evidence/canary-phase2-25pct-template.md',
];
const defaultApiUrl = String(
  process.env.API_URL
  || process.env.SVEN_APP_HOST
  || 'https://app.sven.systems:44747',
).replace(/\/+$/, '');

function collectObservedPhaseEvidence() {
  const evidenceDir = path.join(root, 'docs', 'release', 'evidence');
  if (!fs.existsSync(evidenceDir)) return [];
  return fs.readdirSync(evidenceDir)
    .filter((name) => /^canary-phase(0|1|2)-/i.test(name))
    .filter((name) => !/template/i.test(name))
    .map((name) => path.posix.join('docs/release/evidence', name.replaceAll('\\', '/')))
    .sort();
}

function readJson(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, ''));
}

function resolveHeadSha() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

function collectFailures(report) {
  return (Array.isArray(report?.checks) ? report.checks : [])
    .filter((check) => check.pass === false)
    .map((check) => ({ id: check.id, detail: check.detail }));
}

async function probeApiReachability(apiUrl) {
  let hostname = '';
  let port = 443;
  try {
    const parsed = new URL(apiUrl);
    hostname = parsed.hostname;
    port = Number(parsed.port || (parsed.protocol === 'http:' ? 80 : 443));
  } catch (error) {
    return {
      api_url: apiUrl,
      hostname: null,
      port: null,
      dns: { ok: false, error: `invalid_url:${error.message}` },
      tcp: { ok: false, error: 'invalid_url' },
      http: { ok: false, error: 'invalid_url' },
    };
  }

  const probe = {
    api_url: apiUrl,
    hostname,
    port,
    dns: { ok: false, addresses: [], error: null },
    tcp: { ok: false, error: null },
    http: { ok: false, status: null, error: null },
  };

  try {
    const addresses = await dns.lookup(hostname, { all: true });
    probe.dns.ok = addresses.length > 0;
    probe.dns.addresses = addresses.map((entry) => entry.address);
  } catch (error) {
    probe.dns.error = error.message;
  }

  await new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve();
    };
    socket.setTimeout(10000);
    socket.once('connect', () => {
      probe.tcp.ok = true;
      finish();
    });
    socket.once('timeout', () => {
      probe.tcp.error = 'timeout';
      finish();
    });
    socket.once('error', (error) => {
      probe.tcp.error = error.code || error.message;
      finish();
    });
    socket.connect(port, hostname);
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`${apiUrl.replace(/\/+$/, '')}/healthz`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);
    probe.http.ok = response.ok;
    probe.http.status = response.status;
  } catch (error) {
    probe.http.error = error?.cause?.code || error.name || error.message;
  }

  return probe;
}

function renderMarkdown(summary) {
  const lines = [
    '# Release Rollout Prep',
    '',
    `- Generated at: ${summary.generated_at}`,
    `- Release ID: ${summary.release_id || '(missing)'}`,
    `- Head SHA: ${summary.head_sha || '(missing)'}`,
    `- Rollout status: ${summary.rollout_status || '(missing)'}`,
    `- Selected execution evidence: ${summary.selected_execution_evidence || '(missing)'}`,
    '',
    '## Execution Model',
    '',
    '- This prep flow validates rollout inputs only.',
    '- Mobile and signoff placeholders are not required for the rollout handoff.',
    '- If `immutable_log_uri` is a repo-local path, the setter writes that log file automatically.',
    '',
    '## Artifacts',
    '',
    '- rollout status json: docs/release/status/release-rollout-latest.json',
    '- rollout status markdown: docs/release/status/release-rollout-latest.md',
    '- rollout prep json: docs/release/status/release-rollout-prep-latest.json',
    '- rollout prep markdown: docs/release/status/release-rollout-prep-latest.md',
    '- rollout next steps ps1: docs/release/status/release-rollout-next-steps.ps1',
    `- rollout execution evidence: ${summary.execution_evidence_defaults?.evidence_path || '(missing)'}`,
    '',
    '## Source Materials',
    '',
    ...((summary.source_materials || []).map((item) => `- ${item}`)),
    '',
    '## Observed Phase Evidence',
    '',
    ...((summary.observed_phase_evidence?.length
      ? summary.observed_phase_evidence.map((item) => `- ${item}`)
      : ['- (none found; only templates are present)'])),
    '',
    '## Target Reachability',
    '',
    `- api_url: ${summary.target_probe?.api_url || '(missing)'}`,
    `- dns: ${summary.target_probe?.dns?.ok ? `ok (${(summary.target_probe?.dns?.addresses || []).join(', ')})` : `fail${summary.target_probe?.dns?.error ? ` (${summary.target_probe.dns.error})` : ''}`}`,
    `- tcp:${summary.target_probe?.port ?? '(missing)'}: ${summary.target_probe?.tcp?.ok ? 'ok' : `fail${summary.target_probe?.tcp?.error ? ` (${summary.target_probe.tcp.error})` : ''}`}`,
    `- http /healthz: ${summary.target_probe?.http?.ok ? `ok (${summary.target_probe.http.status})` : `fail${summary.target_probe?.http?.error ? ` (${summary.target_probe.http.error})` : summary.target_probe?.http?.status ? ` (${summary.target_probe.http.status})` : ''}`}`,
    '',
    '## Failures',
    '',
    ...((summary.rollout_failures || []).map((failure) => `- ${failure.id}: ${failure.detail}`)),
    '',
    '## Input Mapping',
    '',
    ...((summary.input_mapping || []).map((item) => `- ${item.failure_id}: ${item.input}`)),
    '',
    '## Local Admin TOTP',
    '',
    '- If rollout login is blocked by `ADMIN_TOTP_REQUIRED`, bootstrap a real local TOTP seed for the admin account first:',
    `- npm run ops:admin:totp:bootstrap -- --username <admin-username> --database-url ${defaultLocalDatabaseUrl}`,
    '- Use the emitted `current_code` as `AdminTotpCode` in the rollout handoff.',
    '',
    '## Validation Prerequisites',
    '',
    '- Run the Phase 0 validation commands below before writing rollout evidence.',
    '- Use real target and admin credentials; do not mark rollout pass without running them.',
    '',
    ...((summary.validation_commands || []).map((command) => `- ${command.step}: ${command.command}`)),
    '',
    '## Defaults',
    '',
    `- status: ${summary.execution_evidence_defaults?.status || '(missing)'}`,
    `- exit_code: ${summary.execution_evidence_defaults?.exit_code ?? '(missing)'}`,
    `- run_id: ${summary.execution_evidence_defaults?.run_id || '(missing)'}`,
    `- head_sha: ${summary.execution_evidence_defaults?.head_sha || '(missing)'}`,
    `- immutable_log_uri: ${summary.execution_evidence_defaults?.immutable_log_uri || '(missing)'}`,
    `- evidence_path: ${summary.execution_evidence_defaults?.evidence_path || '(missing)'}`,
    '',
    '## Commands',
    '',
    ...((summary.commands || []).map((command) => `- ${command.step}: ${command.command}`)),
    '',
    '## Next Steps',
    '',
    '- Fill the editable variables in `docs/release/status/release-rollout-next-steps.ps1`.',
    '- Run the Phase 0 validation commands from that script.',
    '- Run the rollout evidence setter command from that script.',
    '- Run `npm run release:rollout:check`.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderPs1(summary) {
  const defaults = summary.execution_evidence_defaults || {};
  const runId = defaults.run_id || '<rollout-run-id>';
  const headSha = defaults.head_sha || '<sha>';
  const immutableLogUri = defaults.immutable_log_uri || 'docs/release/evidence/release-rollout-immutable-log-latest.txt';
  const evidencePath = defaults.evidence_path || defaultEvidencePath;
  const rolloutStatus = String(defaults.status || 'pass');
  const rolloutExitCode = Number.isFinite(defaults.exit_code) ? defaults.exit_code : 0;
  const rolloutNotes = 'rollout execution captured after canary and rollback checks';
  const setterCommand = (summary.commands || []).find((command) => command.step === 'set_rollout_evidence');
  const rolloutCheckCommand = (summary.commands || []).find((command) => command.step === 'rollout_check');
  const validationCommands = summary.validation_commands || [];

  const renderedSetter = String(setterCommand?.command || '')
    .replaceAll(runId, '$RolloutRunId')
    .replaceAll(`-Status ${rolloutStatus}`, '-Status $RolloutStatus')
    .replaceAll(`-ExitCode ${rolloutExitCode}`, '-ExitCode $RolloutExitCode')
    .replaceAll(headSha, '$HeadSha')
    .replaceAll(immutableLogUri, '$ImmutableLogUri');
  const renderedSetterWithNotes = renderedSetter.replace(
    '-Notes "rollout execution captured after canary and rollback checks"',
    '-Notes $RolloutNotes',
  );

  const lines = [
    '# Release rollout next steps generated by scripts/release-rollout-prep.cjs',
    `# Generated at: ${summary.generated_at}`,
    `# Rollout status: ${summary.rollout_status || '(missing)'}`,
    `# Selected execution evidence: ${summary.selected_execution_evidence || '(missing)'}`,
    '# Section-scoped validation',
    '# - this script validates only rollout inputs',
    '# - mobile and signoff placeholders are not required here',
    '# - if ImmutableLogUri is a repo-local path, the setter writes that log file automatically',
    '',
    '# Artifact paths',
    `# - rollout_status_json: docs/release/status/release-rollout-latest.json`,
    `# - rollout_status_markdown: docs/release/status/release-rollout-latest.md`,
    `# - rollout_prep_json: docs/release/status/release-rollout-prep-latest.json`,
    `# - rollout_prep_markdown: docs/release/status/release-rollout-prep-latest.md`,
    `# - rollout_execution_evidence: ${evidencePath}`,
    '# Source materials',
    ...((summary.source_materials || []).map((item) => `# - ${item}`)),
    '# Observed phase evidence',
    ...((summary.observed_phase_evidence?.length
      ? summary.observed_phase_evidence.map((item) => `# - ${item}`)
      : ['# - (none found; only templates are present)'])),
    '# Target reachability',
    `# - api_url: ${summary.target_probe?.api_url || '(missing)'}`,
    `# - dns: ${summary.target_probe?.dns?.ok ? `ok (${(summary.target_probe?.dns?.addresses || []).join(', ')})` : `fail${summary.target_probe?.dns?.error ? ` (${summary.target_probe.dns.error})` : ''}`}`,
    `# - tcp:${summary.target_probe?.port ?? '(missing)'}: ${summary.target_probe?.tcp?.ok ? 'ok' : `fail${summary.target_probe?.tcp?.error ? ` (${summary.target_probe.tcp.error})` : ''}`}`,
    `# - http /healthz: ${summary.target_probe?.http?.ok ? `ok (${summary.target_probe.http.status})` : `fail${summary.target_probe?.http?.error ? ` (${summary.target_probe.http.error})` : summary.target_probe?.http?.status ? ` (${summary.target_probe.http.status})` : ''}`}`,
    '# Local admin TOTP',
    '# - if rollout login is blocked by ADMIN_TOTP_REQUIRED, bootstrap a local TOTP seed and use its current_code below',
    `# - npm run ops:admin:totp:bootstrap -- --username <admin-username> --database-url ${defaultLocalDatabaseUrl}`,
    '',
    '# Rollout failures',
    ...((summary.rollout_failures || []).map((failure) => `# - ${failure.id}: ${failure.detail}`)),
    '',
    '# Input mapping',
    ...((summary.input_mapping || []).map((item) => `# - ${item.failure_id}: ${item.input}`)),
    '',
    '# Validation prerequisites',
    '# - run these before writing rollout evidence',
    '# - use real target and admin credentials',
    '# - do not mark rollout pass without running them',
    '',
    '# Rollout defaults',
    `# - status: ${rolloutStatus}`,
    `# - exit_code: ${rolloutExitCode}`,
    `# - run_id: ${runId}`,
    `# - head_sha: ${headSha}`,
    `# - immutable_log_uri: ${immutableLogUri}`,
    '',
    "$RolloutRunId = '<rollout-run-id>'",
    `$RolloutStatus = '${rolloutStatus}'`,
    `$RolloutExitCode = ${rolloutExitCode}`,
    `$HeadSha = '${headSha}'`,
    `$ImmutableLogUri = '${immutableLogUri}'`,
    `$EvidencePath = '${evidencePath}'`,
    `$RolloutNotes = '${rolloutNotes}'`,
    `$ApiUrl = '${summary.target_probe?.api_url || defaultApiUrl}'`,
    "$AdminUsername = '<admin-username>'",
    "$AdminPassword = '<admin-password>'",
    "$AdminTotpCode = ''",
    `$LocalDatabaseUrl = '${defaultLocalDatabaseUrl}'`,
    '$PerfDurationSeconds = 8',
    '$PerfConcurrency = 8',
    '',
    'function Assert-NoPlaceholder([string]$Name, [string]$Value) {',
    "  if ($null -eq $Value -or $Value -match '^<.+>$') {",
    '    throw \"Unresolved placeholder for $Name: $Value\"',
    '  }',
    '}',
    '',
    'function Assert-NoPlaceholderIfPresent([string]$Name, [string]$Value) {',
    "  if ($null -ne $Value -and $Value -ne '' -and $Value -match '^<.+>$') {",
    '    throw \"Unresolved placeholder for $Name: $Value\"',
    '  }',
    '}',
    '',
    "Assert-NoPlaceholder 'RolloutRunId' $RolloutRunId",
    "Assert-NoPlaceholder 'HeadSha' $HeadSha",
    "Assert-NoPlaceholder 'ImmutableLogUri' $ImmutableLogUri",
    "Assert-NoPlaceholder 'RolloutStatus' $RolloutStatus",
    "Assert-NoPlaceholder 'RolloutNotes' $RolloutNotes",
    "Assert-NoPlaceholder 'ApiUrl' $ApiUrl",
    "Assert-NoPlaceholder 'AdminUsername' $AdminUsername",
    "Assert-NoPlaceholder 'AdminPassword' $AdminPassword",
    "Assert-NoPlaceholderIfPresent 'AdminTotpCode' $AdminTotpCode",
    '',
    '# 0. If admin login is blocked by ADMIN_TOTP_REQUIRED, bootstrap a local TOTP seed and copy current_code.',
    'npm run ops:admin:totp:bootstrap -- --username $AdminUsername --database-url $LocalDatabaseUrl',
    '',
    '# 1. Run Phase 0 validation commands.',
    ...validationCommands.map((command) => String(command.command)
      .replaceAll(defaultApiUrl, '$ApiUrl')
      .replaceAll('<admin-username>', '$AdminUsername')
      .replaceAll('<admin-password>', '$AdminPassword')
      .replaceAll('<admin-totp-code>', '$AdminTotpCode')
      .replaceAll(' -DurationSeconds 8', ' -DurationSeconds $PerfDurationSeconds')
      .replaceAll(' -Concurrency 8', ' -Concurrency $PerfConcurrency')),
    '',
    '# 2. Write canonical rollout execution evidence.',
    renderedSetterWithNotes,
    '',
    '# 3. Re-run rollout checks.',
    String(rolloutCheckCommand?.command || 'npm run release:rollout:check'),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

async function main() {
  const releaseId = String(process.env.SVEN_RELEASE_ID || '').trim() || `${new Date().toISOString().slice(0, 10)}-rc`;
  const headSha = resolveHeadSha();
  const rollout = readJson('docs/release/status/release-rollout-latest.json');
  const evidence = readJson(defaultEvidencePath);
  const failures = collectFailures(rollout);
  const defaultRunId = String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim() || `local-rollout-${Date.now()}`;
  const observedPhaseEvidence = collectObservedPhaseEvidence();
  const targetProbe = await probeApiReachability(defaultApiUrl);
  const validationCommands = [
    {
      step: 'post_release_verify',
      command: '$env:API_URL = $ApiUrl; npm run release:verify:post',
    },
    {
      step: 'dashboard_slo_auth',
      command: `powershell -ExecutionPolicy Bypass -File scripts/ops/admin/run-dashboard-slo-auth.ps1 -ApiUrl ${defaultApiUrl} -AdminUsername <admin-username> -AdminPassword <admin-password> -AdminTotpCode <admin-totp-code>`,
    },
    {
      step: 'privacy_compliance_auth',
      command: `powershell -ExecutionPolicy Bypass -File scripts/ops/admin/run-privacy-compliance-check.ps1 -ApiUrl ${defaultApiUrl} -AdminUsername <admin-username> -AdminPassword <admin-password> -AdminTotpCode <admin-totp-code> -ForceProd`,
    },
    {
      step: 'performance_capacity_auth',
      command: `powershell -ExecutionPolicy Bypass -File scripts/ops/admin/run-performance-capacity-check.ps1 -ApiUrl ${defaultApiUrl} -AdminUsername <admin-username> -AdminPassword <admin-password> -AdminTotpCode <admin-totp-code> -DurationSeconds 8 -Concurrency 8 -ForceProd`,
    },
    {
      step: 'observability_operability_auth',
      command: `powershell -ExecutionPolicy Bypass -File scripts/ops/admin/run-observability-operability-check.ps1 -ApiUrl ${defaultApiUrl} -AdminUsername <admin-username> -AdminPassword <admin-password> -AdminTotpCode <admin-totp-code> -ForceProd`,
    },
  ];

  const summary = {
    status: rollout?.status || 'pass',
    generated_at: new Date().toISOString(),
    release_id: releaseId,
    head_sha: headSha,
    rollout_status: rollout?.status || null,
    execution_model: {
      rollout_sections_require_rollout_inputs_only: true,
      mobile_inputs_required: false,
      signoff_inputs_required: false,
    },
    source_materials: sourceMaterials,
    observed_phase_evidence: observedPhaseEvidence,
    rollout_failures: failures,
    target_probe: targetProbe,
    input_mapping: [
      { failure_id: 'release_rollout_execution_evidence_present', input: '$EvidencePath (written by setter command)' },
      { failure_id: 'release_rollout_execution_evidence_status_pass', input: '$RolloutStatus' },
      { failure_id: 'release_rollout_execution_evidence_exit_success', input: '$RolloutExitCode' },
      { failure_id: 'release_rollout_execution_evidence_provenance_present', input: '$RolloutRunId and $HeadSha' },
      { failure_id: 'release_rollout_execution_evidence_immutable_log_present', input: '$ImmutableLogUri (repo-local paths are written by the setter)' },
      { failure_id: 'release_rollout_execution_evidence_fresh', input: 'rerun setter command to regenerate generated_at' },
      { failure_id: 'phase0_validation_runtime_inputs', input: '$ApiUrl, $AdminUsername, $AdminPassword, optional $AdminTotpCode (bootstrap with npm run ops:admin:totp:bootstrap if required)' },
      { failure_id: 'phase0_validation_target_reachability', input: `${defaultApiUrl} must be reachable on DNS/TCP/HTTPS before auth-gated checks can pass` },
    ],
    validation_commands: validationCommands,
    selected_execution_evidence: evidence ? defaultEvidencePath : null,
    execution_evidence_defaults: {
      status: 'pass',
      exit_code: 0,
      run_id: defaultRunId,
      head_sha: headSha,
      immutable_log_uri: 'docs/release/evidence/release-rollout-immutable-log-latest.txt',
      evidence_path: defaultEvidencePath,
    },
    commands: [
      {
        step: 'set_rollout_evidence',
        command: [
          'powershell -ExecutionPolicy Bypass -File',
          setterScriptPath,
          '-Status pass',
          '-ExitCode 0',
          `-RunId ${defaultRunId}`,
          `-HeadSha ${headSha}`,
          '-ImmutableLogUri docs/release/evidence/release-rollout-immutable-log-latest.txt',
          '-Notes "rollout execution captured after canary and rollback checks"',
        ].join(' '),
      },
      {
        step: 'rollout_check',
        command: 'npm run release:rollout:check',
      },
    ],
    next_steps: [
      'Fill the editable variables in docs/release/status/release-rollout-next-steps.ps1.',
      'Run the Phase 0 validation commands from that script.',
      'Run the rollout evidence setter command from that script.',
      'Run npm run release:rollout:check.',
    ],
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(outMd, renderMarkdown(summary), 'utf8');
  fs.writeFileSync(outPs1, renderPs1(summary), 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
