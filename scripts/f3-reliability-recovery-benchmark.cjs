#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require('node:child_process');
const { writeFileSync, mkdirSync } = require('node:fs');
const { dirname } = require('node:path');

function argValue(name, fallback = '') {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function nowMs() {
  return Date.now();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const OUTPUT_JSON = argValue(
  '--output-json',
  'docs/release/status/f3-reliability-recovery-benchmark-latest.json',
);
const OUTPUT_MD = argValue(
  '--output-md',
  'docs/release/status/f3-reliability-recovery-benchmark-latest.md',
);
const DETECT_TARGET_SEC = toNumber(
  argValue('--detect-target-sec', process.env.F3_DETECT_TARGET_SEC || '60'),
  60,
);
const RECOVER_TARGET_SEC = toNumber(
  argValue('--recover-target-sec', process.env.F3_RECOVER_TARGET_SEC || '300'),
  300,
);
const DEFAULT_POLL_MS = toNumber(
  argValue('--poll-ms', process.env.F3_POLL_MS || '1000'),
  1000,
);
const STRICT = process.argv.includes('--strict');
const OPENCLAW_MANUAL_BASELINE = toNumber(
  argValue('--openclaw-manual-baseline', process.env.F3_OPENCLAW_MANUAL_BASELINE || ''),
  NaN,
);
const AGENT0_MANUAL_BASELINE = toNumber(
  argValue('--agent0-manual-baseline', process.env.F3_AGENT0_MANUAL_BASELINE || ''),
  NaN,
);
const EVIDENCE_MODE = String(argValue('--evidence-mode', process.env.F3_EVIDENCE_MODE || '')).trim();
const SOURCE_RUN_ID = String(argValue('--source-run-id', process.env.F3_SOURCE_RUN_ID || process.env.GITHUB_RUN_ID || '')).trim();
const HEAD_SHA = String(argValue('--head-sha', process.env.F3_HEAD_SHA || process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '')).trim();
const TARGET_ENVIRONMENT = String(argValue('--target-environment', process.env.F3_TARGET_ENVIRONMENT || process.env.NODE_ENV || '')).trim();
const CREDENTIAL_SOURCE_MODE = String(
  argValue('--credential-source-mode', process.env.F3_CREDENTIAL_SOURCE_MODE || ''),
).trim();
const COMPETITOR_EVIDENCE_JSON = String(
  argValue('--competitor-evidence-json', process.env.F3_COMPETITOR_EVIDENCE_JSON || ''),
).trim();

const SCENARIOS = [
  {
    id: 'broken_channel_credential',
    title: 'Broken Channel Credential',
    prefix: 'F3_CHANNEL',
    p1: true,
  },
  {
    id: 'unavailable_model_provider',
    title: 'Unavailable Model Provider',
    prefix: 'F3_MODEL',
    p1: true,
  },
  {
    id: 'tool_timeout_loop',
    title: 'Tool Timeout Loop',
    prefix: 'F3_TOOL_TIMEOUT',
    p1: true,
  },
  {
    id: 'invalid_policy_configuration',
    title: 'Invalid Policy Configuration',
    prefix: 'F3_POLICY',
    p1: true,
  },
];

function runCommand(label, command) {
  if (!command) return { ok: false, output: `${label} command missing` };
  try {
    const out = execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, output: String(out || '').trim() };
  } catch (err) {
    const stderr = err && typeof err === 'object' && 'stderr' in err
      ? String(err.stderr || '').trim()
      : String(err);
    return { ok: false, output: stderr };
  }
}

async function waitForSuccess(command, timeoutSec, pollMs) {
  const startedAt = nowMs();
  const deadline = startedAt + timeoutSec * 1000;
  let attempts = 0;
  let lastOutput = '';
  while (nowMs() <= deadline) {
    attempts += 1;
    const probe = runCommand('probe', command);
    lastOutput = probe.output;
    if (probe.ok) {
      return {
        ok: true,
        duration_ms: nowMs() - startedAt,
        attempts,
        last_output: lastOutput,
      };
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(pollMs);
  }
  return {
    ok: false,
    duration_ms: nowMs() - startedAt,
    attempts,
    last_output: lastOutput,
  };
}

function getScenarioContract(prefix) {
  return {
    induce_cmd: process.env[`${prefix}_INDUCE_CMD`] || '',
    detect_cmd: process.env[`${prefix}_DETECT_CMD`] || '',
    recover_cmd: process.env[`${prefix}_RECOVER_CMD`] || '',
    verify_recovered_cmd: process.env[`${prefix}_VERIFY_RECOVERED_CMD`] || '',
    detect_timeout_sec: toNumber(process.env[`${prefix}_DETECT_TIMEOUT_SEC`] || DETECT_TARGET_SEC, DETECT_TARGET_SEC),
    recover_timeout_sec: toNumber(process.env[`${prefix}_RECOVER_TIMEOUT_SEC`] || RECOVER_TARGET_SEC, RECOVER_TARGET_SEC),
    poll_ms: toNumber(process.env[`${prefix}_POLL_MS`] || DEFAULT_POLL_MS, DEFAULT_POLL_MS),
    manual_interventions: toNumber(process.env[`${prefix}_MANUAL_INTERVENTIONS`] || '0', 0),
  };
}

function safeParseJson(value) {
  try {
    return JSON.parse(String(value || ''));
  } catch {
    return null;
  }
}

function parseCompetitorEvidence() {
  const parsed = safeParseJson(COMPETITOR_EVIDENCE_JSON);
  if (!parsed || typeof parsed !== 'object') return null;
  const openclaw = parsed.openclaw && typeof parsed.openclaw === 'object' ? parsed.openclaw : null;
  const agent0 = parsed.agent0 && typeof parsed.agent0 === 'object' ? parsed.agent0 : null;
  const openclawManual = Number(openclaw?.manual_interventions);
  const agent0Manual = Number(agent0?.manual_interventions);
  if (!Number.isFinite(openclawManual) || !Number.isFinite(agent0Manual)) return null;
  const hasRunLink =
    String(openclaw?.source_run_id || '').trim() &&
    String(openclaw?.head_sha || '').trim() &&
    String(agent0?.source_run_id || '').trim() &&
    String(agent0?.head_sha || '').trim();
  if (!hasRunLink) return null;
  return {
    openclaw_manual_interventions: openclawManual,
    agent0_manual_interventions: agent0Manual,
    openclaw_source_run_id: String(openclaw.source_run_id),
    openclaw_head_sha: String(openclaw.head_sha),
    agent0_source_run_id: String(agent0.source_run_id),
    agent0_head_sha: String(agent0.head_sha),
  };
}

async function runScenario(scenario) {
  const contract = getScenarioContract(scenario.prefix);
  const required = ['induce_cmd', 'detect_cmd', 'recover_cmd', 'verify_recovered_cmd'];
  const missing = required.filter((key) => !contract[key]);
  if (missing.length > 0) {
    return {
      id: scenario.id,
      title: scenario.title,
      status: 'skipped',
      started_at: nowIso(),
      finished_at: nowIso(),
      reason: `Missing env vars: ${missing.map((m) => `${scenario.prefix}_${m.replace(/_cmd$/, '').toUpperCase()}_CMD`).join(', ')}`,
      contract,
    };
  }

  const startedAt = nowIso();
  const induce = runCommand('induce', contract.induce_cmd);
  if (!induce.ok) {
    return {
      id: scenario.id,
      title: scenario.title,
      status: 'failed',
      started_at: startedAt,
      finished_at: nowIso(),
      reason: `Induce failed: ${induce.output}`,
      contract,
    };
  }

  const detected = await waitForSuccess(contract.detect_cmd, contract.detect_timeout_sec, contract.poll_ms);
  const detectionWithinTarget = detected.ok && detected.duration_ms <= DETECT_TARGET_SEC * 1000;

  const recoveryStart = nowMs();
  const recover = runCommand('recover', contract.recover_cmd);
  if (!recover.ok) {
    return {
      id: scenario.id,
      title: scenario.title,
      status: 'failed',
      started_at: startedAt,
      finished_at: nowIso(),
      reason: `Recover command failed: ${recover.output}`,
      mttd_ms: detected.duration_ms,
      detected: detected.ok,
      contract,
    };
  }

  const recovered = await waitForSuccess(
    contract.verify_recovered_cmd,
    contract.recover_timeout_sec,
    contract.poll_ms,
  );
  const mttrMs = nowMs() - recoveryStart;
  const recoveryWithinTarget = recovered.ok && mttrMs <= RECOVER_TARGET_SEC * 1000;

  const passed = detected.ok && recovered.ok && detectionWithinTarget && recoveryWithinTarget;
  return {
    id: scenario.id,
    title: scenario.title,
    status: passed ? 'passed' : 'failed',
    started_at: startedAt,
    finished_at: nowIso(),
    detected: detected.ok,
    recovered: recovered.ok,
    mttd_ms: detected.duration_ms,
    mttr_ms: mttrMs,
    detect_target_ms: DETECT_TARGET_SEC * 1000,
    recover_target_ms: RECOVER_TARGET_SEC * 1000,
    detect_within_target: detectionWithinTarget,
    recover_within_target: recoveryWithinTarget,
    detect_attempts: detected.attempts,
    recover_attempts: recovered.attempts,
    manual_interventions: contract.manual_interventions,
    reason: passed
      ? ''
      : `detected=${detected.ok}, recovered=${recovered.ok}, detect_within_target=${detectionWithinTarget}, recover_within_target=${recoveryWithinTarget}`,
    contract,
  };
}

function writeOutputs(payload) {
  mkdirSync(dirname(OUTPUT_JSON), { recursive: true });
  mkdirSync(dirname(OUTPUT_MD), { recursive: true });
  writeFileSync(OUTPUT_JSON, JSON.stringify(payload, null, 2), 'utf8');

  const lines = [];
  lines.push('# F3 Reliability + Recovery Benchmark');
  lines.push('');
  lines.push(`Generated: ${payload.generated_at}`);
  lines.push(`Status: ${payload.status}`);
  lines.push(`Evidence mode: ${payload.provenance?.evidence_mode || 'n/a'}`);
  lines.push(`Source run id: ${payload.provenance?.source_run_id || 'n/a'}`);
  lines.push(`Head SHA: ${payload.provenance?.head_sha || 'n/a'}`);
  lines.push(`Baseline source: ${payload.provenance?.baseline_source || 'n/a'}`);
  lines.push(`MTTD target: <= ${payload.targets.detect_sec}s`);
  lines.push(`MTTR target: <= ${payload.targets.recover_sec}s`);
  lines.push('');
  lines.push('## Summary');
  lines.push(`- Total scenarios: ${payload.summary.total}`);
  lines.push(`- Passed: ${payload.summary.passed}`);
  lines.push(`- Failed: ${payload.summary.failed}`);
  lines.push(`- Skipped: ${payload.summary.skipped}`);
  lines.push(`- Avg MTTD (ms): ${payload.summary.avg_mttd_ms}`);
  lines.push(`- Avg MTTR (ms): ${payload.summary.avg_mttr_ms}`);
  lines.push(`- Total manual interventions: ${payload.summary.manual_interventions}`);
  lines.push(`- Manual interventions vs OpenClaw baseline: ${payload.summary.manual_vs_openclaw == null ? 'n/a' : payload.summary.manual_vs_openclaw}`);
  lines.push(`- Manual interventions vs Agent Zero baseline: ${payload.summary.manual_vs_agent0 == null ? 'n/a' : payload.summary.manual_vs_agent0}`);
  lines.push(`- Competitor manual-intervention criterion: ${payload.summary.competitor_manual_criterion_pass == null ? 'n/a' : payload.summary.competitor_manual_criterion_pass}`);
  lines.push('');
  lines.push('## Scenario Results');
  for (const s of payload.scenarios) {
    lines.push(`- ${s.id}: ${s.status}`);
    if (s.status !== 'skipped') {
      lines.push(`  - MTTD(ms): ${s.mttd_ms}`);
      lines.push(`  - MTTR(ms): ${s.mttr_ms}`);
      lines.push(`  - Within targets: detect=${s.detect_within_target} recover=${s.recover_within_target}`);
      lines.push(`  - Manual interventions: ${s.manual_interventions}`);
    }
    if (s.reason) lines.push(`  - Reason: ${s.reason}`);
  }
  lines.push('');
  lines.push('## Env Contract Per Scenario Prefix');
  lines.push('- `<PREFIX>_INDUCE_CMD`');
  lines.push('- `<PREFIX>_DETECT_CMD`');
  lines.push('- `<PREFIX>_RECOVER_CMD`');
  lines.push('- `<PREFIX>_VERIFY_RECOVERED_CMD`');
  lines.push('- Optional: `<PREFIX>_DETECT_TIMEOUT_SEC`, `<PREFIX>_RECOVER_TIMEOUT_SEC`, `<PREFIX>_POLL_MS`, `<PREFIX>_MANUAL_INTERVENTIONS`');
  lines.push('- Global optional: `F3_OPENCLAW_MANUAL_BASELINE`, `F3_AGENT0_MANUAL_BASELINE`');
  lines.push('- Prefixes: `F3_CHANNEL`, `F3_MODEL`, `F3_TOOL_TIMEOUT`, `F3_POLICY`');

  writeFileSync(OUTPUT_MD, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  const competitorEvidence = parseCompetitorEvidence();
  const baselineSource = competitorEvidence
    ? 'competitor_evidence'
    : (Number.isFinite(OPENCLAW_MANUAL_BASELINE) || Number.isFinite(AGENT0_MANUAL_BASELINE))
      ? 'manual_env_reference'
      : 'none';

  const scenarios = [];
  for (const scenario of SCENARIOS) {
    // eslint-disable-next-line no-await-in-loop
    scenarios.push(await runScenario(scenario));
  }

  const passed = scenarios.filter((s) => s.status === 'passed').length;
  const failed = scenarios.filter((s) => s.status === 'failed').length;
  const skipped = scenarios.filter((s) => s.status === 'skipped').length;
  const measured = scenarios.filter((s) => s.status !== 'skipped');
  const mttdValues = measured.map((s) => s.mttd_ms || 0);
  const mttrValues = measured.map((s) => s.mttr_ms || 0);
  const manualInterventions = measured.reduce((acc, s) => acc + Number(s.manual_interventions || 0), 0);

  const summary = {
    total: scenarios.length,
    passed,
    failed,
    skipped,
    avg_mttd_ms: mttdValues.length
      ? Math.round(mttdValues.reduce((a, b) => a + b, 0) / mttdValues.length)
      : 0,
    avg_mttr_ms: mttrValues.length
      ? Math.round(mttrValues.reduce((a, b) => a + b, 0) / mttrValues.length)
      : 0,
    manual_interventions: manualInterventions,
    manual_vs_openclaw: competitorEvidence
      ? manualInterventions - competitorEvidence.openclaw_manual_interventions
      : null,
    manual_vs_agent0: competitorEvidence
      ? manualInterventions - competitorEvidence.agent0_manual_interventions
      : null,
    competitor_manual_criterion_pass: competitorEvidence
      ? manualInterventions < competitorEvidence.openclaw_manual_interventions
        && manualInterventions < competitorEvidence.agent0_manual_interventions
        : null,
  };

  const allMeasuredWithinDetectTarget = measured.every((s) => Number(s.mttd_ms || 0) <= DETECT_TARGET_SEC * 1000);
  const allP1WithinRecoveryTarget = measured.every((s) => Number(s.mttr_ms || 0) <= RECOVER_TARGET_SEC * 1000);
  const status = failed > 0
    ? 'fail'
    : skipped > 0
      ? 'inconclusive'
      : allMeasuredWithinDetectTarget && allP1WithinRecoveryTarget
        ? 'pass'
        : 'fail';

  const payload = {
    generated_at: nowIso(),
    status,
    targets: {
      detect_sec: DETECT_TARGET_SEC,
      recover_sec: RECOVER_TARGET_SEC,
    },
    summary,
    baselines: {
      source: baselineSource,
      openclaw_manual_interventions: competitorEvidence
        ? competitorEvidence.openclaw_manual_interventions
        : (Number.isFinite(OPENCLAW_MANUAL_BASELINE) ? OPENCLAW_MANUAL_BASELINE : null),
      agent0_manual_interventions: competitorEvidence
        ? competitorEvidence.agent0_manual_interventions
        : (Number.isFinite(AGENT0_MANUAL_BASELINE) ? AGENT0_MANUAL_BASELINE : null),
      competitor_evidence: competitorEvidence,
    },
    criteria: {
      mttd_target_pass: allMeasuredWithinDetectTarget,
      mttr_target_pass: allP1WithinRecoveryTarget,
      competitor_manual_interventions_pass: summary.competitor_manual_criterion_pass,
    },
    scenarios,
  };

  const provenance = {
    evidence_mode: EVIDENCE_MODE || null,
    source_run_id: SOURCE_RUN_ID || null,
    head_sha: HEAD_SHA || null,
    baseline_source: baselineSource,
    target_environment: TARGET_ENVIRONMENT || null,
    credential_source_mode: CREDENTIAL_SOURCE_MODE || null,
  };
  payload.provenance = provenance;

  const strictIssues = [];
  const shaOk = /^[a-f0-9]{7,40}$/i.test(String(provenance.head_sha || ''));
  if (STRICT) {
    if (!provenance.evidence_mode) strictIssues.push('missing provenance.evidence_mode');
    if (!provenance.source_run_id) strictIssues.push('missing provenance.source_run_id');
    if (!shaOk) strictIssues.push('missing/invalid provenance.head_sha');
    if (!provenance.target_environment) strictIssues.push('missing provenance.target_environment');
    if (!provenance.credential_source_mode) strictIssues.push('missing provenance.credential_source_mode');
    if (provenance.baseline_source !== 'competitor_evidence') {
      strictIssues.push('baseline_source must be competitor_evidence in strict mode');
    }
    if (String(provenance.credential_source_mode).includes('auto')) {
      strictIssues.push('credential_source_mode must not be auto in strict mode');
    }
  }
  payload.strict_validation = {
    enabled: STRICT,
    pass: strictIssues.length === 0,
    issues: strictIssues,
  };
  if (STRICT && strictIssues.length > 0) {
    payload.status = 'fail';
  }

  writeOutputs(payload);
  console.log(
    `f3-reliability-recovery-benchmark: ${payload.status} (passed=${passed} failed=${failed} skipped=${skipped})`,
  );
  if (STRICT && strictIssues.length > 0) process.exit(2);
  if (payload.status === 'fail') process.exit(1);
}

main().catch((err) => {
  console.error('f3-reliability-recovery-benchmark fatal:', err);
  process.exit(1);
});
