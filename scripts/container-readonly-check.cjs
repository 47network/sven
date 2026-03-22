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

function run() {
  const file = path.join(root, 'docker-compose.production.yml');
  const body = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const lines = body.split(/\r?\n/);

  const targetServices = [
    'gateway-api',
    'agent-runtime',
    'skill-runner',
    'registry-worker',
    'notification-service',
    'rag-indexer',
    'rag-notes-ingestor',
    'rag-nas-ingestor',
    'rag-git-ingestor',
  ];

  const blocks = new Map();
  let current = null;
  for (const line of lines) {
    const svc = line.match(/^  ([A-Za-z0-9_.-]+):\s*$/);
    if (svc) {
      current = svc[1];
      blocks.set(current, []);
      continue;
    }
    if (current) blocks.get(current).push(line);
  }

  const violations = [];
  for (const service of targetServices) {
    const blockLines = blocks.get(service);
    if (!blockLines) {
      violations.push(`${service}:missing_block`);
      continue;
    }
    const block = blockLines.join('\n');
    if (!/^\s{4}read_only:\s*true\s*$/m.test(block)) {
      violations.push(`${service}:read_only_missing`);
    }
    if (!/^\s{4}tmpfs:\s*$/m.test(block) || !/^\s{6}-\s+\/tmp\s*$/m.test(block)) {
      violations.push(`${service}:tmpfs_missing`);
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    status: violations.length === 0 ? 'pass' : 'fail',
    target_service_count: targetServices.length,
    target_services: targetServices,
    violations,
    file: 'docker-compose.production.yml',
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'container-readonly-latest.json');
  const outMd = path.join(outDir, 'container-readonly-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = [
    '# Container Read-only RootFS Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Summary',
    `- target_service_count: ${report.target_service_count}`,
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
