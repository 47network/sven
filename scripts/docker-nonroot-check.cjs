#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

function rel(p) {
  return path.relative(root, p).replace(/\\/g, '/');
}

function walkDockerfiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      walkDockerfiles(full, files);
      continue;
    }
    if (entry.name === 'Dockerfile' || entry.name.startsWith('Dockerfile.')) files.push(full);
  }
  return files;
}

function extractRuntimeStage(body) {
  const lines = body.split(/\r?\n/);
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^FROM\s+/i.test(lines[i])) start = i;
  }
  return lines.slice(start).join('\n');
}

function runtimeUser(runtimeStageBody) {
  const matches = runtimeStageBody.match(/^USER\s+([^\s#]+)\s*$/gim) || [];
  if (!matches.length) return null;
  const last = matches[matches.length - 1];
  const user = last.replace(/^USER\s+/i, '').trim();
  return user;
}

function isRootUser(user) {
  if (!user) return true;
  const normalized = user.toLowerCase();
  if (normalized === 'root' || normalized === '0' || normalized === '0:0') return true;
  return false;
}

function run() {
  const dockerfiles = [
    ...walkDockerfiles(path.join(root, 'services')),
    ...walkDockerfiles(path.join(root, 'apps')),
  ].sort((a, b) => rel(a).localeCompare(rel(b)));

  const violations = [];
  const details = [];

  for (const file of dockerfiles) {
    const body = fs.readFileSync(file, 'utf8');
    const runtime = extractRuntimeStage(body);
    const user = runtimeUser(runtime);
    const violation = !user || isRootUser(user);
    details.push({ file: rel(file), runtime_user: user || '(missing)' });
    if (violation) violations.push(rel(file));
  }

  const report = {
    generated_at: new Date().toISOString(),
    status: violations.length === 0 ? 'pass' : 'fail',
    dockerfile_count: dockerfiles.length,
    violations,
    runtime_users: details,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'docker-nonroot-latest.json');
  const outMd = path.join(outDir, 'docker-nonroot-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = [
    '# Docker Non-Root Runtime Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    `- dockerfile_count: ${report.dockerfile_count}`,
    `- violations: ${report.violations.length}`,
    '',
  ];

  if (report.violations.length) {
    md.push('## Violations');
    for (const v of report.violations) md.push(`- ${v}`);
    md.push('');
  }

  fs.writeFileSync(outMd, `${md.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
  if (strict && report.status !== 'pass') process.exit(2);
}

run();
