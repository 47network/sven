#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const gatewayDir = path.join(root, 'services', 'gateway-api');
const jestBin = path.join(root, 'node_modules', 'jest', 'bin', 'jest.js');

function runCmd(cwd, args) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
  return {
    code: result.status ?? -1,
    out: (result.stdout || '').trim(),
    err: (result.stderr || '').trim(),
  };
}

function runJestInGateway(testPath) {
  return runCmd(gatewayDir, [
    '--experimental-vm-modules',
    jestBin,
    '--config',
    'jest.config.cjs',
    '--runTestsByPath',
    testPath,
    '--runInBand',
  ]);
}

function run() {
  const checks = [];

  const seedDocParity = runJestInGateway('src/__tests__/seed-allowlist-baseline-contract.test.ts');
  checks.push({
    id: 'seed_doc_baseline_contract_pass',
    pass: seedDocParity.code === 0,
    detail:
      seedDocParity.code === 0
        ? 'seed-allowlist-baseline-contract.test.ts passed'
        : `failed: ${seedDocParity.err || seedDocParity.out || `exit ${seedDocParity.code}`}`,
  });

  const seedStartupInvariant = runJestInGateway('src/__tests__/seed-baseline-startup-invariant-contract.test.ts');
  checks.push({
    id: 'seed_startup_invariant_contract_pass',
    pass: seedStartupInvariant.code === 0,
    detail:
      seedStartupInvariant.code === 0
        ? 'seed-baseline-startup-invariant-contract.test.ts passed'
        : `failed: ${seedStartupInvariant.err || seedStartupInvariant.out || `exit ${seedStartupInvariant.code}`}`,
  });

  const status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'seed-baseline-latest.json');
  const outMd = path.join(outDir, 'seed-baseline-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Seed Baseline Gate\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`)
      .join('\n')}\n`,
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
