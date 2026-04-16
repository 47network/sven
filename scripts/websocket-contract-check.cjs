#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'websocket-contract-latest.json');
const outMd = path.join(outDir, 'websocket-contract-latest.md');

const gatewayCanvasPath = path.join(root, 'services', 'gateway-api', 'src', 'routes', 'canvas.ts');
const gatewayEntityPath = path.join(root, 'services', 'gateway-api', 'src', 'routes', 'entity.ts');
const canvasRealtimePath = path.join(root, 'apps', 'canvas-ui', 'src', 'components', 'RealtimeProvider.tsx');

function runNpmTest(args) {
  if (process.platform === 'win32') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm', 'run', 'test', '--workspace', '@sven/gateway-api', '--', ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  }
  return spawnSync(
    'npm',
    ['run', 'test', '--workspace', '@sven/gateway-api', '--', ...args],
    { cwd: root, encoding: 'utf8', stdio: 'pipe' },
  );
}

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function run() {
  const checks = [];
  const requiredTests = [
    'webchat-origin-policy-contract.test.ts',
    'webchat-auth-session-contract.test.ts',
    'canvas-a2ui-schema-version-w11.contract.test.ts',
  ];

  const testRun = runNpmTest(['--runInBand', ...requiredTests]);
  const testPass = (testRun.status ?? 1) === 0;
  checks.push({
    id: 'websocket_contract_tests_pass',
    pass: testPass,
    detail: testPass
      ? `executed ${requiredTests.join(', ')}`
      : `exit=${String(testRun.status)} ${String(testRun.stderr || testRun.stdout || '').trim().slice(0, 400)}`,
  });

  const canvasSource = readText(gatewayCanvasPath);
  const entitySource = readText(gatewayEntityPath);
  const canvasUiSource = readText(canvasRealtimePath);
  checks.push({
    id: 'realtime_stream_routes_present',
    pass:
      canvasSource.includes("app.get('/v1/stream'")
      && entitySource.includes("'/v1/entity/stream'"),
    detail: '/v1/stream and /v1/entity/stream route declarations present',
  });
  checks.push({
    id: 'realtime_client_eventsource_present',
    pass: canvasUiSource.includes('EventSource') && canvasUiSource.includes('/api/v1/stream'),
    detail: 'Canvas realtime client uses EventSource /api/v1/stream',
  });

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    checks,
    required_tests: requiredTests,
    source_files: [
      'services/gateway-api/src/routes/canvas.ts',
      'services/gateway-api/src/routes/entity.ts',
      'apps/canvas-ui/src/components/RealtimeProvider.tsx',
    ],
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# WebSocket Contract Check',
      '',
      `Generated: ${payload.generated_at}`,
      `Status: ${status}`,
      '',
      '## Checks',
      ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  console.log(`websocket-contract-check: ${status}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();

