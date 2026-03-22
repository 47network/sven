#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

const prodDomainPatterns = [
  /https?:\/\/sven\.glyph\.47matrix\.online/gi,
  /https?:\/\/sven\.47matrix\.online/gi,
];

function walk(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'dist' || entry.name === 'node_modules') continue;
      walk(full, list);
      continue;
    }
    if (/\.(ts|tsx|js|mjs|cjs)$/i.test(entry.name)) list.push(full);
  }
  return list;
}

function rel(p) {
  return path.relative(root, p).replace(/\\/g, '/');
}

function run() {
  const runtimeRoots = [
    path.join(root, 'services'),
    path.join(root, 'apps'),
    path.join(root, 'packages'),
  ];
  const runtimeFiles = runtimeRoots.flatMap((d) => walk(d, []));
  const violations = [];

  for (const file of runtimeFiles) {
    const body = fs.readFileSync(file, 'utf8');
    for (const pat of prodDomainPatterns) {
      if (pat.test(body)) {
        violations.push(rel(file));
        break;
      }
    }
  }

  const scopedEnvContracts = [
    'config/env/dev.required.json',
    'config/env/staging.required.json',
    'config/env/prod.required.json',
  ];

  const checks = [
    {
      id: 'scoped_env_contracts_present',
      pass: scopedEnvContracts.every((p) => fs.existsSync(path.join(root, p))),
      detail: scopedEnvContracts.join(', '),
    },
    {
      id: 'no_hardcoded_production_domains_in_runtime_code',
      pass: violations.length === 0,
      detail: violations.length ? violations.join(', ') : 'none',
    },
  ];

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'config-externalization-latest.json');
  const outMd = path.join(outDir, 'config-externalization-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const lines = [
    '# Config Externalization Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
