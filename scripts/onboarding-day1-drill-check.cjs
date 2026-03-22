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

function readJson(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function readText(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
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

function run() {
  const onboarding = readJson('docs/release/status/onboarding-readiness-latest.json');
  const edge = readJson('docs/release/status/edge-network-delivery-latest.json');
  const edgeContinuous = readJson('docs/release/status/edge-network-continuous-latest.json');
  const postVerify = readJson('docs/release/status/post-release-verification-latest.json');
  const evidenceLatest = 'docs/release/evidence/onboarding-day1-drill-latest.md';
  const evidencePath =
    resolveEvidencePath(evidenceLatest, /^onboarding-day1-drill-\d{4}-\d{2}-\d{2}\.md$/i) || 'missing';
  const evidenceText = readText(evidencePath);
  const evidenceDate = parseEvidenceDate(evidenceText);
  const evidenceAge = ageHours(evidenceDate);
  const evidenceHeadSha = fieldValue(evidenceText, 'head_sha');
  const evidenceRef = fieldValue(evidenceText, 'ref') || fieldValue(evidenceText, 'source_ref');

  const checks = [
    { id: 'onboarding_readiness_pass', pass: onboarding?.status === 'pass', detail: onboarding?.status || 'missing' },
    { id: 'edge_delivery_pass', pass: edge?.status === 'pass', detail: edge?.status || 'missing' },
    { id: 'edge_continuous_pass', pass: edgeContinuous?.status === 'pass', detail: edgeContinuous?.status || 'missing' },
    { id: 'post_release_verify_pass', pass: postVerify?.status === 'pass', detail: postVerify?.status || 'missing' },
    { id: 'onboarding_day1_evidence_present', pass: exists(evidencePath), detail: evidencePath },
    {
      id: 'onboarding_day1_evidence_fresh',
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
      id: 'onboarding_day1_evidence_release_sha_match',
      pass: strict ? (!targetSha || (Boolean(evidenceHeadSha) && evidenceHeadSha === targetSha)) : true,
      detail: targetSha ? `target=${targetSha} evidence=${evidenceHeadSha || '(missing)'}` : 'target sha not provided',
    },
    {
      id: 'onboarding_day1_evidence_release_ref_match',
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
  const outJson = path.join(outDir, 'onboarding-day1-drill-latest.json');
  const outMd = path.join(outDir, 'onboarding-day1-drill-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Onboarding Day-1 Drill Check\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8'
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
