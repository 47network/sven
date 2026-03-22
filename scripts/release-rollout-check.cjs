#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const maxEvidenceAgeHours = Number(process.env.SVEN_RELEASE_ROLLOUT_EVIDENCE_MAX_AGE_HOURS || 72);
const executionEvidenceRel = String(
  process.env.SVEN_RELEASE_ROLLOUT_EXECUTION_EVIDENCE_PATH || 'docs/release/evidence/release-rollout-execution-latest.json',
).trim();

function read(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function readJson(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, ''));
}

function ageHours(timestampIso) {
  const parsed = Date.parse(String(timestampIso || ''));
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
}

function hasSha(value) {
  return /^[a-f0-9]{7,40}$/i.test(String(value || '').trim());
}

function hasNonEmpty(value) {
  return String(value || '').trim().length > 0;
}

function run() {
  const rollbackDoc = 'docs/ops/release-rollback-runbook-2026.md';
  const canaryDoc = 'docs/release/canary-rollout-strategy-2026.md';
  const rollbackBody = read(rollbackDoc);
  const canaryBody = read(canaryDoc);
  const rolloutEvidence = readJson(executionEvidenceRel);
  const rolloutEvidenceGeneratedAt = String(rolloutEvidence?.generated_at || '').trim();
  const rolloutEvidenceAge = ageHours(rolloutEvidenceGeneratedAt);
  const rolloutEvidenceRunId = String(rolloutEvidence?.run_id || rolloutEvidence?.source_run_id || '').trim();
  const rolloutEvidenceHeadSha = String(rolloutEvidence?.head_sha || '').trim();
  const rolloutEvidenceStatus = String(rolloutEvidence?.status || '').trim().toLowerCase();
  const rolloutEvidenceExitCode = Number(rolloutEvidence?.exit_code);
  const rolloutEvidenceImmutableLog = String(
    rolloutEvidence?.immutable_log_uri
    || rolloutEvidence?.immutable_log_ref
    || rolloutEvidence?.log_uri
    || rolloutEvidence?.log_ref
    || '',
  ).trim();

  const checks = [
    {
      id: 'rollback_runbook_exists',
      pass: rollbackBody.length > 0,
      detail: rollbackDoc,
    },
    {
      id: 'rollback_runbook_has_trigger_and_steps',
      pass: rollbackBody.includes('## Rollback Triggers')
        && rollbackBody.includes('## Rollback Procedure'),
      detail: 'expects trigger + procedure sections',
    },
    {
      id: 'canary_strategy_exists',
      pass: canaryBody.length > 0,
      detail: canaryDoc,
    },
    {
      id: 'canary_strategy_has_phases_and_abort_criteria',
      pass: canaryBody.includes('## Canary Phases')
        && canaryBody.includes('## Abort Criteria'),
      detail: 'expects phases + abort criteria sections',
    },
    {
      id: 'canary_strategy_has_validation_commands',
      pass: canaryBody.includes('npm run release:verify:post')
        && canaryBody.includes('npm run release:admin:dashboard:slo:auth'),
      detail: 'expects post-verify and admin SLO validation commands',
    },
    {
      id: 'release_rollout_execution_evidence_present',
      pass: Boolean(rolloutEvidence),
      detail: executionEvidenceRel,
    },
    {
      id: 'release_rollout_execution_evidence_status_pass',
      pass: rolloutEvidenceStatus === 'pass'
        || rolloutEvidenceStatus === 'success'
        || rolloutEvidenceStatus === 'passed',
      detail: rolloutEvidenceStatus || 'missing',
    },
    {
      id: 'release_rollout_execution_evidence_exit_success',
      pass: Number.isFinite(rolloutEvidenceExitCode) && rolloutEvidenceExitCode === 0,
      detail: Number.isFinite(rolloutEvidenceExitCode) ? `exit_code=${rolloutEvidenceExitCode}` : 'missing exit_code',
    },
    {
      id: 'release_rollout_execution_evidence_provenance_present',
      pass: hasNonEmpty(rolloutEvidenceRunId) && hasSha(rolloutEvidenceHeadSha),
      detail: `run_id=${rolloutEvidenceRunId || '(missing)'}; head_sha=${rolloutEvidenceHeadSha || '(missing)'}`,
    },
    {
      id: 'release_rollout_execution_evidence_immutable_log_present',
      pass: hasNonEmpty(rolloutEvidenceImmutableLog),
      detail: rolloutEvidenceImmutableLog || 'missing immutable log reference',
    },
    {
      id: 'release_rollout_execution_evidence_fresh',
      pass: typeof rolloutEvidenceAge === 'number' && rolloutEvidenceAge <= maxEvidenceAgeHours,
      detail: typeof rolloutEvidenceAge === 'number'
        ? `${rolloutEvidenceAge.toFixed(2)}h <= ${maxEvidenceAgeHours}h`
        : 'missing/invalid generated_at',
    },
  ];

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    evidence: {
      execution: executionEvidenceRel,
      max_age_hours: maxEvidenceAgeHours,
    },
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'release-rollout-latest.json');
  const outMd = path.join(outDir, 'release-rollout-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Release Rollback and Canary Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
