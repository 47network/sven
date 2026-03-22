#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const rehearsalMaxAgeHours = Number(process.env.SVEN_KEY_ROTATION_REHEARSAL_MAX_AGE_HOURS || 720);
const expectedReleaseId = String(process.env.SVEN_RELEASE_ID || '').trim();
const expectedRunId = String(process.env.SVEN_RELEASE_RUN_ID || process.env.GITHUB_RUN_ID || '').trim();
const expectedHeadSha = String(process.env.SVEN_RELEASE_HEAD_SHA || process.env.GITHUB_SHA || '').trim();

function readJson(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function read(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function listRehearsalEvidence() {
  const dir = path.join(root, 'docs', 'release', 'evidence');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => /^key-rotation-rehearsal-\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .sort();
}

function extractField(markdown, key) {
  const rx = new RegExp(`^${key}:\\s*(.+)$`, 'im');
  const match = String(markdown || '').match(rx);
  return match ? String(match[1] || '').trim() : '';
}

function parseEvidenceMeta(fileName, body) {
  const date = extractField(body, 'Date');
  const releaseId = extractField(body, 'Release ID');
  const runId = extractField(body, 'Run ID');
  const headSha = extractField(body, 'Head SHA');
  const parsedMs = Date.parse(date);
  const hasRequiredSections = body.includes('Rotation Scope:')
    && body.includes('Secret Versions:')
    && body.includes('Staging Validation:')
    && body.includes('Propagation Verification:')
    && body.includes('Rollback Ready:')
    && body.includes('Approver:');
  return {
    fileName,
    date,
    releaseId,
    runId,
    headSha,
    hasRequiredSections,
    parsedMs: Number.isNaN(parsedMs) ? null : parsedMs,
  };
}

function ageHours(timestampMs) {
  if (typeof timestampMs !== 'number' || !Number.isFinite(timestampMs)) return null;
  return Math.max(0, (Date.now() - timestampMs) / (1000 * 60 * 60));
}

function run() {
  const runbookPath = 'docs/ops/key-rotation-and-propagation-runbook-2026.md';
  const runbook = read(runbookPath);
  const postVerify = readJson('docs/release/status/post-release-verification-latest.json');
  const dashboardSlo = readJson('docs/release/status/admin-dashboard-slo-latest.json');
  const evidenceFiles = listRehearsalEvidence();
  const evidenceMeta = evidenceFiles
    .map((fileName) => {
      const body = read(path.join('docs/release/evidence', fileName));
      return { meta: parseEvidenceMeta(fileName, body), body };
    })
    .filter((entry) => entry.meta.hasRequiredSections && entry.meta.parsedMs !== null);
  evidenceMeta.sort((a, b) => {
    if (a.meta.parsedMs !== b.meta.parsedMs) return (b.meta.parsedMs || 0) - (a.meta.parsedMs || 0);
    return a.meta.fileName.localeCompare(b.meta.fileName);
  });
  const selectedEvidence = evidenceMeta.length ? evidenceMeta[0] : null;
  const latestEvidence = selectedEvidence ? selectedEvidence.meta.fileName : '';
  const evidenceBody = selectedEvidence ? selectedEvidence.body : '';
  const evidenceAge = selectedEvidence ? ageHours(selectedEvidence.meta.parsedMs) : null;
  const evidenceFresh = typeof evidenceAge === 'number' && evidenceAge <= rehearsalMaxAgeHours;
  const identityFieldsPresent = Boolean(
    selectedEvidence
      && selectedEvidence.meta.releaseId
      && selectedEvidence.meta.runId
      && /^[a-f0-9]{7,40}$/i.test(selectedEvidence.meta.headSha || ''),
  );
  const identityMatchesExpected = !selectedEvidence
    ? false
    : (!expectedReleaseId || selectedEvidence.meta.releaseId === expectedReleaseId)
      && (!expectedRunId || selectedEvidence.meta.runId === expectedRunId)
      && (!expectedHeadSha || selectedEvidence.meta.headSha === expectedHeadSha);

  const checks = [
    {
      id: 'rotation_runbook_present',
      pass: Boolean(runbook),
      detail: runbookPath,
    },
    {
      id: 'post_verify_status_pass',
      pass: postVerify?.status === 'pass',
      detail: `post-release status=${postVerify?.status || 'missing'}`,
    },
    {
      id: 'admin_dashboard_slo_status_pass',
      pass: dashboardSlo?.status === 'pass',
      detail: `admin dashboard slo status=${dashboardSlo?.status || 'missing'}`,
    },
    {
      id: 'rotation_rehearsal_evidence_present',
      pass: Boolean(latestEvidence),
      detail: latestEvidence || 'none',
    },
    {
      id: 'rotation_rehearsal_evidence_selected_by_metadata',
      pass: Boolean(selectedEvidence),
      detail: selectedEvidence
        ? `selected=${selectedEvidence.meta.fileName}; date=${selectedEvidence.meta.date}`
        : 'no metadata-valid evidence found',
    },
    {
      id: 'rotation_rehearsal_evidence_has_required_fields',
      pass: Boolean(latestEvidence)
        && evidenceBody.includes('Rotation Scope:')
        && evidenceBody.includes('Secret Versions:')
        && evidenceBody.includes('Staging Validation:')
        && evidenceBody.includes('Propagation Verification:')
        && evidenceBody.includes('Rollback Ready:')
        && evidenceBody.includes('Approver:'),
      detail: 'expects scope/version/validation/propagation/rollback/approver fields',
    },
    {
      id: 'rotation_rehearsal_evidence_fresh',
      pass: evidenceFresh,
      detail: evidenceFresh
        ? `${(evidenceAge || 0).toFixed(2)}h <= ${rehearsalMaxAgeHours}h`
        : selectedEvidence
          ? `${(evidenceAge || 0).toFixed(2)}h > ${rehearsalMaxAgeHours}h`
          : 'no selected evidence',
    },
    {
      id: 'rotation_rehearsal_evidence_identity_fields_present',
      pass: identityFieldsPresent,
      detail: selectedEvidence
        ? `release_id=${selectedEvidence.meta.releaseId || '(missing)'}; run_id=${selectedEvidence.meta.runId || '(missing)'}; head_sha=${selectedEvidence.meta.headSha || '(missing)'}`
        : 'no selected evidence',
    },
    {
      id: 'rotation_rehearsal_evidence_identity_matches_expected',
      pass: identityMatchesExpected,
      detail: selectedEvidence
        ? `expected_release=${expectedReleaseId || '(unset)'} observed_release=${selectedEvidence.meta.releaseId || '(missing)'}; expected_run=${expectedRunId || '(unset)'} observed_run=${selectedEvidence.meta.runId || '(missing)'}; expected_sha=${expectedHeadSha || '(unset)'} observed_sha=${selectedEvidence.meta.headSha || '(missing)'}`
        : 'no selected evidence',
    },
  ];

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    latest_evidence: latestEvidence || null,
    selected_evidence: selectedEvidence
      ? {
          file: selectedEvidence.meta.fileName,
          date: selectedEvidence.meta.date,
          release_id: selectedEvidence.meta.releaseId || null,
          run_id: selectedEvidence.meta.runId || null,
          head_sha: selectedEvidence.meta.headSha || null,
        }
      : null,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'key-rotation-rehearsal-latest.json');
  const outMd = path.join(outDir, 'key-rotation-rehearsal-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Key Rotation Rehearsal Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    `Latest evidence: ${report.latest_evidence || 'none'}`,
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
