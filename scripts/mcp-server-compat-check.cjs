#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const withLive = process.argv.includes('--with-live') || process.env.MCP_SERVER_COMPAT_WITH_LIVE === '1';
const gatewayDir = path.join(root, 'services', 'gateway-api');
const jestBin = path.join(root, 'node_modules', 'jest', 'bin', 'jest.js');

function runCmd(cwd, args) {
  const r = spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
  return {
    code: r.status ?? -1,
    out: (r.stdout || '').trim(),
    err: (r.stderr || '').trim(),
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
  ]);
}

function run() {
  const checks = [];
  let skippedChecks = 0;

  if (strict && !withLive) {
    checks.push({
      id: 'mcp_server_live_mode_required_in_strict',
      pass: false,
      detail: 'strict mode requires --with-live (or MCP_SERVER_COMPAT_WITH_LIVE=1)',
    });
  }

  const routeTest = runJestInGateway('src/__tests__/mcp-server-route.test.ts');
  checks.push({
    id: 'mcp_server_route_tests_pass',
    pass: routeTest.code === 0,
    detail:
      routeTest.code === 0
        ? 'mcp-server-route.test.ts passed'
        : `failed: ${routeTest.err || routeTest.out || `exit ${routeTest.code}`}`,
  });

  if (!withLive) {
    checks.push({
      id: 'mcp_server_live_e2e_tests_pass',
      pass: true,
      detail: 'skipped (enable with --with-live or MCP_SERVER_COMPAT_WITH_LIVE=1)',
    });
    skippedChecks += 1;
    checks.push({
      id: 'mcp_server_http_smoke_pass',
      pass: true,
      detail: 'skipped (enable with --with-live or MCP_SERVER_COMPAT_WITH_LIVE=1)',
    });
    skippedChecks += 1;
  } else {
    const token = String(process.env.TEST_MCP_SERVER_TOKEN || process.env.SVEN_MCP_SERVER_TOKEN || '').trim();
    if (!token) {
      checks.push({
        id: 'mcp_server_live_e2e_tests_pass',
        pass: false,
        detail: 'missing TEST_MCP_SERVER_TOKEN (or SVEN_MCP_SERVER_TOKEN) for live compatibility run',
      });
      checks.push({
        id: 'mcp_server_http_smoke_pass',
        pass: false,
        detail: 'missing TEST_MCP_SERVER_TOKEN (or SVEN_MCP_SERVER_TOKEN) for live HTTP smoke',
      });
    } else {
      const liveE2e = runJestInGateway('src/__tests__/mcp.e2e.ts');
      checks.push({
        id: 'mcp_server_live_e2e_tests_pass',
        pass: liveE2e.code === 0,
        detail:
          liveE2e.code === 0
            ? 'mcp.e2e.ts passed'
            : `failed: ${liveE2e.err || liveE2e.out || `exit ${liveE2e.code}`}`,
      });

      const smoke = runCmd(root, [path.join('scripts', 'mcp-server-http-smoke.cjs'), '--strict']);
      checks.push({
        id: 'mcp_server_http_smoke_pass',
        pass: smoke.code === 0,
        detail:
          smoke.code === 0
            ? 'mcp-server-http-smoke.cjs passed'
            : `failed: ${smoke.err || smoke.out || `exit ${smoke.code}`}`,
      });
    }
  }

  const status = checks.some((c) => !c.pass) ? 'fail' : skippedChecks > 0 ? 'pass_with_skips' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    schema_version: 1,
    status,
    live_checks_executed: Boolean(withLive),
    skipped_checks: skippedChecks,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'mcp-server-compat-latest.json');
  const outMd = path.join(outDir, 'mcp-server-compat-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# MCP Server Compatibility Gate\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8',
  );
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
  if (status === 'fail') process.exit(1);
}

run();
