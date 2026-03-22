#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');

const requiredIgnoreEntries = [
  '.npm_cache/',
  '.venv/',
  '.venv-1/',
  '.idea/',
  'node_modules/',
  '.node20/',
];

const requiredDockerignoreEntries = [
  '.git',
  '.npm_cache',
  '.venv',
  '.venv-1',
  '.idea',
  '.vscode',
  'node_modules',
  '.node20',
  'archive',
];

function readLines(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs
    .readFileSync(filePath, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

function hasEntry(lines, entry) {
  if (!lines) return false;
  return lines.includes(entry);
}

function run() {
  const gitignorePath = path.join(root, '.gitignore');
  const dockerignorePath = path.join(root, '.dockerignore');
  const gitignore = readLines(gitignorePath) || [];
  const dockerignore = readLines(dockerignorePath) || [];

  const checks = [];
  for (const entry of requiredIgnoreEntries) {
    checks.push({
      id: `gitignore_${entry.replace(/[^a-zA-Z0-9]+/g, '_')}`,
      pass: hasEntry(gitignore, entry),
      detail: `requires ${entry} in .gitignore`,
    });
  }
  for (const entry of requiredDockerignoreEntries) {
    checks.push({
      id: `dockerignore_${entry.replace(/[^a-zA-Z0-9]+/g, '_')}`,
      pass: hasEntry(dockerignore, entry),
      detail: `requires ${entry} in .dockerignore`,
    });
  }

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    checks,
    required_gitignore_entries: requiredIgnoreEntries,
    required_dockerignore_entries: requiredDockerignoreEntries,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'release-bundle-hygiene-latest.json');
  const outMd = path.join(outDir, 'release-bundle-hygiene-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Release Bundle Hygiene Check',
      '',
      `- Generated: ${report.generated_at}`,
      `- Status: ${status}`,
      '',
      '## Checks',
      ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
      '',
    ].join('\n'),
    'utf8'
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
