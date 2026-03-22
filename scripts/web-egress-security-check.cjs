#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const jestBin = path.join(root, 'node_modules', 'jest', 'bin', 'jest.js');

function runJestSkillRunner(testPath) {
  const result = spawnSync(
    process.execPath,
    [
      jestBin,
      '--config',
      path.join('services', 'skill-runner', 'jest.config.cjs'),
      '--runInBand',
      '--runTestsByPath',
      path.join('services', 'skill-runner', '__tests__', testPath),
    ],
    { cwd: root, encoding: 'utf8' },
  );
  return {
    code: result.status ?? -1,
    out: (result.stdout || '').trim(),
    err: (result.stderr || '').trim(),
  };
}

function run() {
  const checks = [];

  const egressPolicy = runJestSkillRunner('egress-policy.test.ts');
  checks.push({
    id: 'web_egress_allowlist_policy_tests_pass',
    pass: egressPolicy.code === 0,
    detail:
      egressPolicy.code === 0
        ? 'egress-policy.test.ts passed'
        : `failed: ${egressPolicy.err || egressPolicy.out || `exit ${egressPolicy.code}`}`,
  });

  const webEgressConfig = runJestSkillRunner('web-egress-config.test.ts');
  checks.push({
    id: 'web_egress_config_guard_branch_tests_pass',
    pass: webEgressConfig.code === 0,
    detail:
      webEgressConfig.code === 0
        ? 'web-egress-config.test.ts passed'
        : `failed: ${webEgressConfig.err || webEgressConfig.out || `exit ${webEgressConfig.code}`}`,
  });

  const status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'web-egress-security-latest.json');
  const outMd = path.join(outDir, 'web-egress-security-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Web Egress Security Gate\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`)
      .join('\n')}\n`,
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
