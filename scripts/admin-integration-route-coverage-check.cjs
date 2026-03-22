#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');

const testsDir = path.join(root, 'services', 'gateway-api', 'src', '__tests__');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'admin-integration-route-coverage-latest.json');
const outMd = path.join(outDir, 'admin-integration-route-coverage-latest.md');

const ROUTE_MODULES = [
  { id: 'ha', routeTs: '../routes/admin/ha.ts', routeJs: '../routes/admin/ha.js' },
  { id: 'calendar', routeTs: '../routes/admin/calendar.ts', routeJs: '../routes/admin/calendar.js' },
  { id: 'git', routeTs: '../routes/admin/git.ts', routeJs: '../routes/admin/git.js' },
  { id: 'nas', routeTs: '../routes/admin/nas.ts', routeJs: '../routes/admin/nas.js' },
  { id: 'web', routeTs: '../routes/admin/web.ts', routeJs: '../routes/admin/web.js' },
];

function check(id, pass, detail) {
  return { id, status: pass ? 'pass' : 'fail', detail };
}

function collectTestFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.test\.(ts|js)$/.test(entry.name))
    .map((entry) => path.join(dir, entry.name));
}

function routeCoverage(files, routeTs, routeJs) {
  const matched = [];
  const matchedContract = [];
  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    if (source.includes(routeTs) || source.includes(routeJs)) {
      matched.push(path.relative(root, filePath));
      if (/\.contract\.test\.(ts|js)$/i.test(filePath)) {
        matchedContract.push(path.relative(root, filePath));
      }
    }
  }
  return { matched, matchedContract };
}

function main() {
  const checks = [];
  const testFiles = collectTestFiles(testsDir);
  checks.push(
    check(
      'gateway_test_directory_present',
      testFiles.length > 0,
      testFiles.length > 0
        ? `discovered ${testFiles.length} test files in ${path.relative(root, testsDir)}`
        : `no *.test.ts/js files found under ${path.relative(root, testsDir)}`,
    ),
  );

  const coverage = {};
  for (const route of ROUTE_MODULES) {
    const result = routeCoverage(testFiles, route.routeTs, route.routeJs);
    coverage[route.id] = result;
    checks.push(
      check(
        `admin_${route.id}_route_has_test_reference`,
        result.matched.length > 0,
        result.matched.length > 0
          ? `references found: ${result.matched.join(', ')}`
          : `missing test reference for ${route.routeTs} or ${route.routeJs}`,
      ),
    );
    checks.push(
      check(
        `admin_${route.id}_route_has_contract_test`,
        result.matchedContract.length > 0,
        result.matchedContract.length > 0
          ? `contract coverage: ${result.matchedContract.join(', ')}`
          : `no *.contract.test.* references ${route.routeTs} or ${route.routeJs}`,
      ),
    );
  }

  const failed = checks.filter((item) => item.status !== 'pass');
  const status = {
    generated_at: new Date().toISOString(),
    status: failed.length === 0 ? 'pass' : 'fail',
    route_coverage: coverage,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

  const lines = [
    '# Admin Integration Route Coverage Check',
    '',
    `Status: ${status.status}`,
    `Generated: ${status.generated_at}`,
    '',
    '## Checks',
    '',
    ...checks.map((item) => `- ${item.id}: ${item.status} (${item.detail})`),
    '',
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(JSON.stringify(status, null, 2));
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);

  if (strict && failed.length > 0) {
    process.exit(2);
  }
}

main();
