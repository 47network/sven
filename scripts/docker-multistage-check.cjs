#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

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

function rel(p) {
  return path.relative(root, p).replace(/\\/g, '/');
}

function countFroms(body) {
  const matches = body.match(/^FROM\s+/gim);
  return matches ? matches.length : 0;
}

function run() {
  const dockerfiles = [
    ...walkDockerfiles(path.join(root, 'services')),
    ...walkDockerfiles(path.join(root, 'apps')),
  ].sort((a, b) => rel(a).localeCompare(rel(b)));

  const singleStage = [];
  for (const file of dockerfiles) {
    const body = fs.readFileSync(file, 'utf8');
    const fromCount = countFroms(body);
    if (fromCount < 2) singleStage.push(rel(file));
  }

  const report = {
    generated_at: new Date().toISOString(),
    status: singleStage.length === 0 ? 'pass' : 'fail',
    dockerfile_count: dockerfiles.length,
    single_stage_files: singleStage,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'docker-multistage-latest.json');
  const outMd = path.join(outDir, 'docker-multistage-latest.md');

  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = [
    '# Docker Multi-stage Build Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    `- dockerfile_count: ${report.dockerfile_count}`,
    `- single_stage_files: ${report.single_stage_files.length}`,
    '',
  ];
  if (report.single_stage_files.length) {
    md.push('## Single-stage Files');
    for (const file of report.single_stage_files) md.push(`- ${file}`);
    md.push('');
  }

  fs.writeFileSync(outMd, `${md.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);

  if (strict && report.status !== 'pass') process.exit(2);
}

run();
