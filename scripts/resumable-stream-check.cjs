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

  const resume = runJestInGateway('src/__tests__/stream-resume.e2e.test.js');
  checks.push({
    id: 'stream_resume_reconnect_and_authz_runtime_pass',
    pass: resume.code === 0,
    detail:
      resume.code === 0
        ? 'stream-resume.e2e.test.js passed'
        : `failed: ${resume.err || resume.out || `exit ${resume.code}`}`,
  });

  const retention = runJestInGateway('src/__tests__/streams.retention.test.ts');
  checks.push({
    id: 'stream_retention_expiry_policy_pass',
    pass: retention.code === 0,
    detail:
      retention.code === 0
        ? 'streams.retention.test.ts passed'
        : `failed: ${retention.err || retention.out || `exit ${retention.code}`}`,
  });

  const ownerScopeContract = runJestInGateway('src/__tests__/streams.owner-scope-contract.test.ts');
  checks.push({
    id: 'stream_owner_scope_contract_pass',
    pass: ownerScopeContract.code === 0,
    detail:
      ownerScopeContract.code === 0
        ? 'streams.owner-scope-contract.test.ts passed'
        : `failed: ${ownerScopeContract.err || ownerScopeContract.out || `exit ${ownerScopeContract.code}`}`,
  });

  const status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'resumable-stream-latest.json');
  const outMd = path.join(outDir, 'resumable-stream-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Resumable Stream Gate\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`)
      .join('\n')}\n`,
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
