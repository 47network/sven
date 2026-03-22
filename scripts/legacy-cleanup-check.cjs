#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function filesystemFilesUnder(relPath) {
  const abs = path.join(root, relPath);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  const stack = [abs];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        out.push(path.relative(root, full).replace(/\\/g, '/'));
      }
    }
  }
  return out;
}

function runElectronDeprecationCheck() {
  const run = spawnSync('node', ['scripts/electron-deprecation-check.cjs'], {
    cwd: root,
    encoding: 'utf8',
  });
  const reportPath = path.join(root, 'docs', 'release', 'status', 'electron-deprecation-check-latest.json');
  let report = null;
  if (fs.existsSync(reportPath)) {
    report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  }
  return {
    pass: run.status === 0 && report?.status === 'pass',
    detail: run.status === 0
      ? `electron deprecation status=${report?.status || 'missing'}`
      : `exit=${run.status}`,
  };
}

function run() {
  const runbookIndexPath = 'docs/ops/runbook-index-2026.md';
  const runbookIndex = exists(runbookIndexPath)
    ? fs.readFileSync(path.join(root, runbookIndexPath), 'utf8')
    : '';
  const electronLegacyPath = 'apps/companion-desktop';
  const legacyFiles = filesystemFilesUnder(electronLegacyPath);
  const electronDeprecation = runElectronDeprecationCheck();

  const checks = [
    {
      id: 'electron_deprecation_guard_passes',
      pass: electronDeprecation.pass,
      detail: electronDeprecation.detail,
    },
    {
      id: 'legacy_electron_runtime_removed',
      pass: legacyFiles.length === 0,
      detail: legacyFiles.length > 0
        ? `legacy files remain (${legacyFiles.length})`
        : `${electronLegacyPath} removed`,
    },
    {
      id: 'canonical_runbook_index_present',
      pass: Boolean(runbookIndex),
      detail: runbookIndexPath,
    },
    {
      id: 'runbook_index_covers_release_security_and_incident',
      pass: runbookIndex.includes('release-rollback-runbook-2026.md')
        && runbookIndex.includes('security-token-compromise-and-key-rotation.md')
        && runbookIndex.includes('incident-triage-and-degraded-mode-runbook-2026.md'),
      detail: 'expects release rollback + security token compromise + incident triage runbooks',
    },
  ];

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'legacy-cleanup-latest.json');
  const outMd = path.join(outDir, 'legacy-cleanup-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Legacy Cleanup Check',
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
