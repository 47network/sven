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

function fieldValue(md, label) {
  const pattern = new RegExp(`^\\s*${label}\\s*:\\s*(.+)\\s*$`, 'im');
  const m = md.match(pattern);
  return m ? String(m[1] || '').trim() : '';
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

function run() {
  const evidenceLatest = 'docs/release/evidence/mobile-crash-anr-latest.md';
  const evidencePath = resolveEvidencePath(evidenceLatest, /^mobile-crash-anr-\d{4}-\d{2}-\d{2}\.md$/i) || 'missing';
  const evidence = read(evidencePath);
  const evidenceDate = parseEvidenceDate(evidence);
  const evidenceAge = ageHours(evidenceDate);

  const crashFree = num(fieldValue(evidence, 'crash_free_sessions_pct'));
  const anrFree = num(fieldValue(evidence, 'anr_free_sessions_pct'));
  const sampleSize = num(fieldValue(evidence, 'sample_size_sessions'));
  const targetCrashFree = num(fieldValue(evidence, 'target_crash_free_sessions_pct'));
  const targetAnrFree = num(fieldValue(evidence, 'target_anr_free_sessions_pct'));
  const source = fieldValue(evidence, 'source');
  const evidenceHeadSha = fieldValue(evidence, 'head_sha');
  const evidenceRef = fieldValue(evidence, 'ref') || fieldValue(evidence, 'source_ref');

  const checks = [
    {
      id: 'mobile_crash_anr_evidence_present',
      pass: Boolean(evidence),
      detail: evidencePath,
    },
    {
      id: 'metrics_fields_present',
      pass: crashFree !== null && anrFree !== null && sampleSize !== null && Boolean(source),
      detail: 'crash/anr/sample/source fields',
    },
    {
      id: 'targets_fields_present',
      pass: targetCrashFree !== null && targetAnrFree !== null,
      detail: 'target crash/anr fields',
    },
    {
      id: 'crash_free_target_met',
      pass: crashFree !== null && targetCrashFree !== null && crashFree >= targetCrashFree,
      detail: crashFree !== null && targetCrashFree !== null ? `${crashFree} >= ${targetCrashFree}` : 'missing',
    },
    {
      id: 'anr_free_target_met',
      pass: anrFree !== null && targetAnrFree !== null && anrFree >= targetAnrFree,
      detail: anrFree !== null && targetAnrFree !== null ? `${anrFree} >= ${targetAnrFree}` : 'missing',
    },
    {
      id: 'sample_size_sufficient',
      pass: sampleSize !== null && sampleSize >= 1000,
      detail: sampleSize !== null ? `${sampleSize} >= 1000` : 'missing',
    },
    {
      id: 'mobile_crash_anr_evidence_fresh',
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
      id: 'mobile_crash_anr_evidence_release_sha_match',
      pass: strict ? (!targetSha || (Boolean(evidenceHeadSha) && evidenceHeadSha === targetSha)) : true,
      detail: targetSha ? `target=${targetSha} evidence=${evidenceHeadSha || '(missing)'}` : 'target sha not provided',
    },
    {
      id: 'mobile_crash_anr_evidence_release_ref_match',
      pass: strict ? (!targetRef || (Boolean(evidenceRef) && evidenceRef === targetRef)) : true,
      detail: targetRef ? `target=${targetRef} evidence=${evidenceRef || '(missing)'}` : 'target ref not provided',
    },
  ];

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    metrics: {
      crash_free_sessions_pct: crashFree,
      anr_free_sessions_pct: anrFree,
      sample_size_sessions: sampleSize,
      source: source || null,
      target_crash_free_sessions_pct: targetCrashFree,
      target_anr_free_sessions_pct: targetAnrFree,
    },
    provenance: {
      evidence_path: evidencePath,
      target_ref: targetRef,
      target_sha: targetSha,
      max_evidence_age_hours: maxEvidenceAgeHours,
    },
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'mobile-crash-anr-latest.json');
  const outMd = path.join(outDir, 'mobile-crash-anr-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Mobile Crash/ANR Gate\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8'
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
