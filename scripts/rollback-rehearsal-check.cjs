#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const targetRef = String(process.env.GITHUB_REF || process.env.CI_COMMIT_REF_NAME || '').trim() || null;
const targetSha = String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim() || null;
const maxEvidenceAgeHours = Number(process.env.SVEN_EVIDENCE_MAX_AGE_HOURS || 168);

function read(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function resolveEvidencePath(latestRel, datedPattern) {
  if (exists(latestRel)) return latestRel;
  const evidenceDirRel = 'docs/release/evidence';
  const evidenceDir = path.join(root, evidenceDirRel);
  if (!fs.existsSync(evidenceDir)) return null;
  const candidates = fs.readdirSync(evidenceDir)
    .filter((name) => datedPattern.test(name))
    .sort()
    .reverse();
  if (!candidates.length) return null;
  return `${evidenceDirRel}/${candidates[0]}`;
}

function parseEvidenceDate(text) {
  const patterns = [
    /^\s*date\s*:\s*(\d{4}-\d{2}-\d{2})\s*$/im,
    /^\s*Generated\s*:\s*(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/im,
    /\((\d{4}-\d{2}-\d{2})\)/,
  ];
  for (const p of patterns) {
    const m = String(text || '').match(p);
    if (!m) continue;
    const d = new Date(`${m[1]}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function ageHours(date) {
  if (!(date instanceof Date)) return null;
  return (Date.now() - date.getTime()) / 36e5;
}

function fieldValue(md, label) {
  const pattern = new RegExp(`^\\s*${label}\\s*:\\s*(.+)\\s*$`, 'im');
  const m = String(md || '').match(pattern);
  return m ? String(m[1] || '').trim() : '';
}

function readJson(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, 'utf8')) : null;
}

function run() {
  const runbook = read('docs/ops/release-rollback-runbook-2026.md');
  const post = readJson('docs/release/status/post-release-verification-latest.json');
  const dashboard = readJson('docs/release/status/admin-dashboard-slo-latest.json');
  const evidenceLatest = 'docs/release/evidence/rollback-rehearsal-latest.md';
  const evidencePath =
    resolveEvidencePath(evidenceLatest, /^rollback-rehearsal-\d{4}-\d{2}-\d{2}\.md$/i) || 'missing';
  const evidence = read(evidencePath);
  const evidenceDate = parseEvidenceDate(evidence);
  const evidenceAge = ageHours(evidenceDate);
  const evidenceHeadSha = fieldValue(evidence, 'head_sha');
  const evidenceRef = fieldValue(evidence, 'ref') || fieldValue(evidence, 'source_ref');

  const checks = [
    { id: 'rollback_runbook_present', pass: Boolean(runbook), detail: 'docs/ops/release-rollback-runbook-2026.md' },
    { id: 'post_release_verify_pass', pass: post?.status === 'pass', detail: post?.status || 'missing' },
    { id: 'admin_dashboard_slo_pass', pass: dashboard?.status === 'pass', detail: dashboard?.status || 'missing' },
    { id: 'rollback_rehearsal_evidence_present', pass: Boolean(evidence), detail: evidencePath },
    {
      id: 'rollback_rehearsal_evidence_has_required_fields',
      pass: evidence.includes('Rehearsal Scope:')
        && evidence.includes('Rollback Trigger Simulated:')
        && evidence.includes('Execution Steps:')
        && evidence.includes('Post-Rollback Validation:')
        && evidence.includes('Decision:')
        && evidence.includes('Approver:'),
      detail: 'expects scope/trigger/steps/validation/decision/approver',
    },
    {
      id: 'rollback_rehearsal_evidence_fresh',
      pass: strict ? typeof evidenceAge === 'number' && evidenceAge <= maxEvidenceAgeHours : true,
      detail: typeof evidenceAge === 'number'
        ? strict
          ? `${evidenceAge.toFixed(2)}h <= ${maxEvidenceAgeHours}h`
          : `advisory: ${evidenceAge.toFixed(2)}h (strict threshold ${maxEvidenceAgeHours}h)`
        : strict
        ? 'missing evidence date'
        : 'advisory: missing evidence date',
    },
    {
      id: 'rollback_rehearsal_evidence_release_sha_match',
      pass: strict ? (!targetSha || (Boolean(evidenceHeadSha) && evidenceHeadSha === targetSha)) : true,
      detail: targetSha ? `target=${targetSha} evidence=${evidenceHeadSha || '(missing)'}` : 'target sha not provided',
    },
    {
      id: 'rollback_rehearsal_evidence_release_ref_match',
      pass: strict ? (!targetRef || (Boolean(evidenceRef) && evidenceRef === targetRef)) : true,
      detail: targetRef ? `target=${targetRef} evidence=${evidenceRef || '(missing)'}` : 'target ref not provided',
    },
  ];

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    provenance: {
      evidence_path: evidencePath,
      target_ref: targetRef,
      target_sha: targetSha,
      max_evidence_age_hours: maxEvidenceAgeHours,
    },
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'rollback-rehearsal-latest.json');
  const outMd = path.join(outDir, 'rollback-rehearsal-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Rollback Rehearsal Check\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8'
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
