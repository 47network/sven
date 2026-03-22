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

function extractTimestampIso(value) {
  if (!value || typeof value !== 'object') return null;
  const keys = ['generated_at', 'at_utc', 'validated_at', 'updated_at', 'created_at', 'timestamp'];
  for (const key of keys) {
    const raw = value[key];
    if (!raw) continue;
    const parsed = Date.parse(String(raw));
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return null;
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
  if (!date) return null;
  const parsed = date instanceof Date ? date.getTime() : Date.parse(String(date));
  if (Number.isNaN(parsed)) return null;
  return (Date.now() - parsed) / 36e5;
}

function fieldValue(md, label) {
  const pattern = new RegExp(`^\\s*${label}\\s*:\\s*(.+)\\s*$`, 'im');
  const m = String(md || '').match(pattern);
  return m ? String(m[1] || '').trim() : '';
}

function run() {
  const installer = readJson('docs/release/status/quickstart-installer-runtime-latest.json');
  const parity = readJson('docs/release/status/desktop-tauri-parity-check-latest.json');
  const ui = readJson('docs/release/status/ui-e2e-latest.json');
  const capabilities = readJson('docs/release/status/desktop-capability-review-latest.json');
  const evidenceLatest = 'docs/release/evidence/desktop-fresh-machine-drill-latest.md';
  const evidencePath =
    resolveEvidencePath(evidenceLatest, /^desktop-fresh-machine-drill-\d{4}-\d{2}-\d{2}\.md$/i) || 'missing';
  const evidenceText = readText(evidencePath);
  const evidenceDate = parseEvidenceDate(evidenceText);
  const evidenceAge = ageHours(evidenceDate);
  const evidenceHeadSha = fieldValue(evidenceText, 'head_sha');
  const evidenceRef = fieldValue(evidenceText, 'ref') || fieldValue(evidenceText, 'source_ref');
  const uiTimestamp = extractTimestampIso(ui);
  const uiAge = ageHours(uiTimestamp);
  const uiRunId = String(ui?.provenance?.run_id || ui?.run_id || ui?.source_run_id || '').trim();
  const uiHeadSha = String(ui?.provenance?.head_sha || ui?.head_sha || '').trim();
  const uiRef = String(ui?.provenance?.ref || ui?.ref || '').trim();

  const desktopSuite = Array.isArray(ui?.suites)
    ? ui.suites.find((s) => s.project === 'desktop-tauri-web')
    : null;

  const checks = [
    { id: 'installer_runtime_pass', pass: installer?.status === 'pass', detail: installer?.status || 'missing' },
    { id: 'desktop_parity_pass', pass: parity?.status === 'pass', detail: parity?.status || 'missing' },
    { id: 'desktop_ui_flow_suite_pass', pass: ui?.status === 'pass' && desktopSuite?.failed === 0, detail: ui?.status || 'missing' },
    {
      id: 'desktop_ui_e2e_status_fresh',
      pass: strict ? typeof uiAge === 'number' && uiAge <= maxEvidenceAgeHours : true,
      detail: typeof uiAge === 'number'
        ? strict
          ? `${uiAge.toFixed(2)}h <= ${maxEvidenceAgeHours}h`
          : `advisory: ${uiAge.toFixed(2)}h (strict threshold ${maxEvidenceAgeHours}h)`
        : strict
        ? 'missing ui-e2e generated_at'
        : 'advisory: missing ui-e2e generated_at',
    },
    {
      id: 'desktop_ui_e2e_provenance_present',
      pass: Boolean(uiRunId) && /^[a-f0-9]{7,40}$/i.test(uiHeadSha),
      detail: `run_id=${uiRunId || '(missing)'}; head_sha=${uiHeadSha || '(missing)'}`,
    },
    {
      id: 'desktop_ui_e2e_release_sha_match',
      pass: strict ? (!targetSha || (Boolean(uiHeadSha) && uiHeadSha === targetSha)) : true,
      detail: targetSha ? `target=${targetSha} ui=${uiHeadSha || '(missing)'}` : 'target sha not provided',
    },
    {
      id: 'desktop_ui_e2e_release_ref_match',
      pass: strict ? (!targetRef || (Boolean(uiRef) && uiRef === targetRef)) : true,
      detail: targetRef ? `target=${targetRef} ui=${uiRef || '(missing)'}` : 'target ref not provided',
    },
    { id: 'desktop_capability_review_pass', pass: capabilities?.status === 'pass', detail: capabilities?.status || 'missing' },
    { id: 'desktop_drill_evidence_present', pass: exists(evidencePath), detail: evidencePath },
    {
      id: 'desktop_drill_evidence_fresh',
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
      id: 'desktop_drill_evidence_release_sha_match',
      pass: strict ? (!targetSha || (Boolean(evidenceHeadSha) && evidenceHeadSha === targetSha)) : true,
      detail: targetSha ? `target=${targetSha} evidence=${evidenceHeadSha || '(missing)'}` : 'target sha not provided',
    },
    {
      id: 'desktop_drill_evidence_release_ref_match',
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
  const outJson = path.join(outDir, 'desktop-fresh-machine-latest.json');
  const outMd = path.join(outDir, 'desktop-fresh-machine-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Desktop Fresh-Machine Check\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8'
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
