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

function parseServiceBlocks(yaml) {
  const lines = yaml.split(/\r?\n/);
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
  return blocks;
}

function run() {
  const file = path.join(root, 'docker-compose.production.yml');
  const body = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const blocks = parseServiceBlocks(body);

  const targetServices = [
    'egress-proxy',
    'nats',
    'postgres',
    'gateway-api',
    'otel-collector',
    'prometheus',
    'grafana',
    'ollama',
    'rag-git-ingestor',
    'rag-notes-ingestor',
    'searxng',
    'agent-runtime',
    'notification-service',
    'piper',
    'opensearch',
    'rag-indexer',
    'rag-nas-ingestor',
    'registry-worker',
    'skill-runner',
    'sven-internal-nginx',
    'wake-word',
    'faster-whisper',
    'workflow-executor',
  ];

  const violations = [];
  for (const svc of targetServices) {
    const blockLines = blocks.get(svc);
    if (!blockLines) {
      violations.push(`${svc}:missing_block`);
      continue;
    }
    const block = blockLines.join('\n');
    if (!/^\s{4}deploy:\s*$/m.test(block)) violations.push(`${svc}:deploy_missing`);
    if (!/^\s{6}resources:\s*$/m.test(block)) violations.push(`${svc}:resources_missing`);
    if (!/^\s{8}limits:\s*$/m.test(block)) violations.push(`${svc}:limits_missing`);
    if (!/^\s{10}cpus:\s*"?[0-9.]+"?\s*$/m.test(block)) violations.push(`${svc}:cpus_missing`);
    if (!/^\s{10}memory:\s*[0-9]+[MG]i?\s*$/m.test(block)) violations.push(`${svc}:memory_missing`);
  }

  const report = {
    generated_at: new Date().toISOString(),
    status: violations.length === 0 ? 'pass' : 'fail',
    file: 'docker-compose.production.yml',
    target_service_count: targetServices.length,
    violations,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'container-resource-limits-latest.json');
  const outMd = path.join(outDir, 'container-resource-limits-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const md = [
    '# Container Resource Limits Check',
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
