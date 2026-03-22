#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const maxEvidenceAgeHours = Number(process.env.SVEN_COMPLIANCE_SIGNOFF_EVIDENCE_MAX_AGE_HOURS || 72);
const executionEvidenceRel = String(
  process.env.SVEN_COMPLIANCE_SIGNOFF_EXECUTION_EVIDENCE_PATH || 'docs/release/evidence/compliance-signoff-execution-latest.json',
).trim();

function read(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function readJson(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, 'utf8')) : null;
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

function resolveLatestComplianceSignoff() {
  const explicit = String(process.env.SVEN_COMPLIANCE_SIGNOFF_DOC_PATH || '').trim();
  if (explicit) return explicit;
  const signoffDir = path.join(root, 'docs', 'release', 'signoffs');
  if (!fs.existsSync(signoffDir)) return null;
  const matches = fs.readdirSync(signoffDir)
    .filter((name) => /^compliance-signoff-.*\.md$/i.test(name))
    .sort((a, b) => a.localeCompare(b))
    .reverse();
  if (!matches.length) return null;
  return path.join('docs', 'release', 'signoffs', matches[0]).replace(/\\/g, '/');
}

function run() {
  const signoffPath = resolveLatestComplianceSignoff();
  const signoff = signoffPath ? read(signoffPath) : '';
  const privacyStatus = readJson('docs/release/status/privacy-compliance-latest.json');
  const executionEvidence = readJson(executionEvidenceRel);
  const executionEvidenceGeneratedAt = String(executionEvidence?.generated_at || '').trim();
  const executionEvidenceAge = ageHours(executionEvidenceGeneratedAt);
  const executionEvidenceStatus = String(executionEvidence?.status || '').trim().toLowerCase();
  const executionEvidenceExitCode = Number(executionEvidence?.exit_code);
  const executionEvidenceRunId = String(executionEvidence?.run_id || executionEvidence?.source_run_id || '').trim();
  const executionEvidenceHeadSha = String(executionEvidence?.head_sha || '').trim();
  const executionEvidenceImmutableLog = String(
    executionEvidence?.immutable_log_uri
    || executionEvidence?.immutable_log_ref
    || executionEvidence?.log_uri
    || executionEvidence?.log_ref
    || '',
  ).trim();

  const checks = [
    { id: 'privacy_compliance_status_pass', pass: privacyStatus?.status === 'pass', detail: privacyStatus?.status || 'missing' },
    { id: 'compliance_signoff_doc_present', pass: Boolean(signoff), detail: signoffPath || 'missing' },
    {
      id: 'compliance_signoff_has_approvals',
      pass: signoff.includes('Engineering: approved')
        && signoff.includes('Security: approved')
        && signoff.includes('Operations: approved'),
      detail: 'expects engineering/security/operations approvals',
    },
    {
      id: 'compliance_signoff_execution_evidence_present',
      pass: Boolean(executionEvidence),
      detail: executionEvidenceRel,
    },
    {
      id: 'compliance_signoff_execution_evidence_status_pass',
      pass: executionEvidenceStatus === 'pass'
        || executionEvidenceStatus === 'success'
        || executionEvidenceStatus === 'passed',
      detail: executionEvidenceStatus || 'missing',
    },
    {
      id: 'compliance_signoff_execution_evidence_exit_success',
      pass: Number.isFinite(executionEvidenceExitCode) && executionEvidenceExitCode === 0,
      detail: Number.isFinite(executionEvidenceExitCode) ? `exit_code=${executionEvidenceExitCode}` : 'missing exit_code',
    },
    {
      id: 'compliance_signoff_execution_evidence_provenance_present',
      pass: hasNonEmpty(executionEvidenceRunId) && hasSha(executionEvidenceHeadSha),
      detail: `run_id=${executionEvidenceRunId || '(missing)'}; head_sha=${executionEvidenceHeadSha || '(missing)'}`,
    },
    {
      id: 'compliance_signoff_execution_evidence_immutable_log_present',
      pass: hasNonEmpty(executionEvidenceImmutableLog),
      detail: executionEvidenceImmutableLog || 'missing immutable log reference',
    },
    {
      id: 'compliance_signoff_execution_evidence_fresh',
      pass: typeof executionEvidenceAge === 'number' && executionEvidenceAge <= maxEvidenceAgeHours,
      detail: typeof executionEvidenceAge === 'number'
        ? `${executionEvidenceAge.toFixed(2)}h <= ${maxEvidenceAgeHours}h`
        : 'missing/invalid generated_at',
    },
  ];

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    evidence: {
      signoff_doc: signoffPath || null,
      execution: executionEvidenceRel,
      max_age_hours: maxEvidenceAgeHours,
    },
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'compliance-signoff-latest.json');
  const outMd = path.join(outDir, 'compliance-signoff-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Compliance Sign-Off Check\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8'
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
