#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const maxEvidenceAgeHours = Number(process.env.SVEN_MOBILE_EVIDENCE_MAX_AGE_HOURS || 168);

function read(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function fieldValue(md, label) {
  const pattern = new RegExp(`^\\s*${label}\\s*:\\s*(.+)\\s*$`, 'im');
  const m = md.match(pattern);
  return m ? String(m[1] || '').trim() : '';
}

function isPass(v) {
  return String(v || '').toLowerCase() === 'pass';
}

function meaningful(v) {
  if (!v) return false;
  return !/^(pending|tbd|todo|n\/a|na|none|unknown|-)$/.test(String(v).toLowerCase());
}

function relPath(fullPath) {
  return path.relative(root, fullPath).replace(/\\/g, '/');
}

function resolveDeviceFarmEvidencePath() {
  const override = String(process.env.SVEN_MOBILE_DEVICE_FARM_RESULTS_EVIDENCE_PATH || '').trim();
  if (override) {
    return path.isAbsolute(override) ? override : path.join(root, override);
  }
  const latestPath = path.join(root, 'docs', 'release', 'evidence', 'mobile-device-farm-results-latest.md');
  if (fs.existsSync(latestPath)) return latestPath;
  const evidenceDir = path.join(root, 'docs', 'release', 'evidence');
  if (!fs.existsSync(evidenceDir)) return null;
  const candidates = fs.readdirSync(evidenceDir)
    .filter((name) => /^mobile-device-farm-results-\d{4}-\d{2}-\d{2}\.md$/i.test(name))
    .sort()
    .reverse();
  if (!candidates.length) return null;
  return path.join(evidenceDir, candidates[0]);
}

function parseEvidenceTimestamp(markdown, stat) {
  const match = markdown.match(/^\s*date\s*:\s*(.+)\s*$/im);
  if (match && match[1]) {
    const parsed = Date.parse(String(match[1]).trim());
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return stat?.mtime?.toISOString?.() || null;
}

function ageHours(isoTimestamp) {
  if (!isoTimestamp) return null;
  const parsed = Date.parse(isoTimestamp);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
}

function run() {
  const evidenceFullPath = resolveDeviceFarmEvidencePath();
  const evidencePath = evidenceFullPath ? relPath(evidenceFullPath) : 'missing';
  const evidence = evidenceFullPath ? read(evidencePath) : '';
  const evidenceStat = evidenceFullPath && fs.existsSync(evidenceFullPath) ? fs.statSync(evidenceFullPath) : null;
  const evidenceTimestamp = parseEvidenceTimestamp(evidence, evidenceStat);
  const evidenceAge = ageHours(evidenceTimestamp);
  const evidenceFresh = typeof evidenceAge === 'number' && evidenceAge <= maxEvidenceAgeHours;

  const android = fieldValue(evidence, 'android_job_status');
  const ios = fieldValue(evidence, 'ios_job_status');
  const runUrl = fieldValue(evidence, 'workflow_run_url');
  const sha = fieldValue(evidence, 'commit_sha');

  const checks = [
    { id: 'device_farm_results_evidence_present', pass: Boolean(evidence), detail: evidencePath },
    {
      id: 'device_farm_results_evidence_fresh',
      pass: evidenceFresh,
      detail: evidenceFresh
        ? `${evidenceAge.toFixed(2)}h <= ${maxEvidenceAgeHours}h`
        : evidenceTimestamp
          ? `${(evidenceAge || 0).toFixed(2)}h > ${maxEvidenceAgeHours}h`
          : 'missing/invalid evidence timestamp',
    },
    { id: 'android_device_farm_job_pass', pass: isPass(android), detail: android || 'missing' },
    { id: 'ios_device_farm_job_pass', pass: isPass(ios), detail: ios || 'missing' },
    { id: 'workflow_run_url_present', pass: meaningful(runUrl), detail: runUrl || 'missing' },
    { id: 'commit_sha_present', pass: /^[0-9a-f]{7,40}$/i.test(sha), detail: sha || 'missing' },
  ];

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    checks,
    evidence: {
      path: evidencePath,
      timestamp: evidenceTimestamp,
      age_hours: typeof evidenceAge === 'number' ? Number(evidenceAge.toFixed(2)) : null,
      max_age_hours: maxEvidenceAgeHours,
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'mobile-device-farm-latest.json');
  const outMd = path.join(outDir, 'mobile-device-farm-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Mobile Device Farm Results Check\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8'
  );
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
