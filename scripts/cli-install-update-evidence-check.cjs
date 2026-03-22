#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const maxEvidenceAgeHours = Number(process.env.SVEN_CLI_INSTALL_UPDATE_EVIDENCE_MAX_AGE_HOURS || 168);
const targetSha = String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || process.env.SVEN_TARGET_SHA || '').trim();
const evidenceRel = String(
  process.env.SVEN_CLI_INSTALL_UPDATE_EVIDENCE || 'docs/release/evidence/cli-install-update-host-matrix-2026-03-09.md',
).trim();
const evidencePath = path.join(root, evidenceRel);
const outDir = path.join(root, 'docs', 'release', 'status');

function ageHours(timestampIso) {
  if (!timestampIso) return null;
  const parsed = Date.parse(timestampIso);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
}

function parseField(markdown, label) {
  const match = markdown.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'));
  return match ? String(match[1]).trim() : '';
}

function hasSection(markdown, sectionName) {
  return new RegExp(`^##\\s+${sectionName}\\s*$`, 'im').test(markdown);
}

function hasPassedCheck(markdown, label) {
  return new RegExp(`^-\\s+${label}:\\s*pass\\b`, 'im').test(markdown);
}

function writeOutputs(report) {
  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'cli-install-update-evidence-latest.json');
  const outMd = path.join(outDir, 'cli-install-update-evidence-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# CLI Install/Update Evidence Check',
      '',
      `Generated: ${report.generated_at}`,
      `Status: ${report.status}`,
      `Evidence: ${report.evidence_path}`,
      '',
      '## Checks',
      ...report.checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
      '',
    ].join('\n'),
    'utf8',
  );
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
}

function run() {
  const checks = [];
  if (!fs.existsSync(evidencePath)) {
    checks.push({
      id: 'cli_install_update_evidence_present',
      pass: false,
      detail: `${evidenceRel} missing`,
    });
    const report = {
      generated_at: new Date().toISOString(),
      status: 'fail',
      evidence_path: evidenceRel,
      checks,
    };
    writeOutputs(report);
    if (strict) process.exit(2);
    return;
  }

  const markdown = fs.readFileSync(evidencePath, 'utf8');
  const status = parseField(markdown, 'Status').toLowerCase();
  const generatedAt = parseField(markdown, 'Generated');
  const headSha = parseField(markdown, 'Head SHA');
  const evidenceAgeHours = ageHours(generatedAt);

  checks.push({
    id: 'cli_install_update_evidence_present',
    pass: true,
    detail: evidenceRel,
  });
  checks.push({
    id: 'cli_install_update_evidence_status_pass',
    pass: status === 'pass',
    detail: status ? `status=${status}` : 'missing Status field',
  });
  checks.push({
    id: 'cli_install_update_evidence_fresh',
    pass: typeof evidenceAgeHours === 'number' && evidenceAgeHours <= maxEvidenceAgeHours,
    detail:
      typeof evidenceAgeHours === 'number'
        ? `age=${evidenceAgeHours.toFixed(2)}h (max ${maxEvidenceAgeHours}h)`
        : 'missing/invalid Generated timestamp',
  });
  checks.push({
    id: 'cli_install_update_evidence_target_sha_match',
    pass: !targetSha || (Boolean(headSha) && headSha === targetSha),
    detail: targetSha ? `head_sha=${headSha || 'missing'} target_sha=${targetSha}` : `head_sha=${headSha || 'n/a'}`,
  });

  for (const host of ['systemd', 'launchd', 'pm2']) {
    checks.push({
      id: `cli_install_update_host_section:${host}`,
      pass: hasSection(markdown, host),
      detail: hasSection(markdown, host) ? 'present' : 'missing section',
    });
    checks.push({
      id: `cli_install_update_host_install:${host}`,
      pass: hasPassedCheck(markdown, `${host} install`),
      detail: hasPassedCheck(markdown, `${host} install`) ? 'pass' : 'missing pass record',
    });
    checks.push({
      id: `cli_install_update_host_update:${host}`,
      pass: hasPassedCheck(markdown, `${host} update`),
      detail: hasPassedCheck(markdown, `${host} update`) ? 'pass' : 'missing pass record',
    });
    checks.push({
      id: `cli_install_update_host_healthz:${host}`,
      pass: hasPassedCheck(markdown, `${host} post_install_healthz`),
      detail: hasPassedCheck(markdown, `${host} post_install_healthz`) ? 'pass' : 'missing pass record',
    });
  }

  const report = {
    generated_at: new Date().toISOString(),
    status: checks.some((check) => !check.pass) ? 'fail' : 'pass',
    evidence_path: evidenceRel,
    expected_target_sha: targetSha || null,
    checks,
  };
  writeOutputs(report);
  if (strict && report.status !== 'pass') process.exit(2);
}

run();
