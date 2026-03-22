#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const statusDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const allowActiveSoak = process.argv.includes('--allow-active-soak');

const allowedExact = new Set([
  'ci-gates.json',
  'latest.json',
  'latest.md',
  'production-gap-closure-checklist.md',
]);

function isAllowed(fileName) {
  if (allowedExact.has(fileName)) return true;
  if (/-latest\.(json|md)$/.test(fileName)) return true;
  if (/-next-steps\.ps1$/.test(fileName)) return true;
  if (allowActiveSoak && (/^soak-/.test(fileName) || /^c1-1-rss-soak/.test(fileName))) return true;
  return false;
}

function run() {
  if (!fs.existsSync(statusDir)) {
    console.error('Missing docs/release/status directory');
    process.exit(2);
  }

  const files = fs.readdirSync(statusDir, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name).sort();
  const violations = files.filter((name) => !isAllowed(name));

  const report = {
    generated_at: new Date().toISOString(),
    status: violations.length === 0 ? 'pass' : 'fail',
    allow_active_soak: allowActiveSoak,
    total_files: files.length,
    violations_count: violations.length,
    violations,
    policy: {
      allowed_exact: Array.from(allowedExact),
      allowed_patterns: ['*-latest.{json,md}', '*-next-steps.ps1', ...(allowActiveSoak ? ['soak-*', 'c1-1-rss-soak*'] : [])],
    },
  };

  const outJson = path.join(statusDir, 'release-status-hygiene-latest.json');
  const outMd = path.join(statusDir, 'release-status-hygiene-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Release Status Hygiene Check',
      '',
      `- Generated: ${report.generated_at}`,
      `- Status: ${report.status}`,
      `- Total files: ${report.total_files}`,
      `- Violations: ${report.violations_count}`,
      `- Allow active soak: ${allowActiveSoak ? 'yes' : 'no'}`,
      '',
      '## Violations',
      ...(violations.length ? violations.map((v) => `- ${v}`) : ['- none']),
      '',
    ].join('\n'),
    'utf8'
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && violations.length) process.exit(2);
}

run();

