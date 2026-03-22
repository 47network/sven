#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-discovery-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-discovery-runtime-latest.md');

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function readUtf8(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

function run() {
  const checks = [];
  const discoverySource = readUtf8('services/gateway-api/src/services/DiscoveryService.ts') || '';
  const hasMdns = discoverySource.includes('multicast-dns');
  const hasWideArea = discoverySource.includes('wideAreaDomains');
  const hasAutoPeer = discoverySource.includes('natsLeafAutoPeer');

  checks.push({
    id: 'discovery_service_mdns_support_present',
    pass: hasMdns,
    detail: hasMdns ? 'DiscoveryService includes mDNS transport integration' : 'missing mDNS transport integration',
  });
  checks.push({
    id: 'discovery_service_wide_area_support_present',
    pass: hasWideArea,
    detail: hasWideArea ? 'DiscoveryService includes wide-area DNS-SD domains support' : 'missing wide-area DNS-SD support',
  });
  checks.push({
    id: 'discovery_service_nats_auto_peer_support_present',
    pass: hasAutoPeer,
    detail: hasAutoPeer ? 'DiscoveryService includes NATS leaf auto-peer candidate handling' : 'missing NATS leaf auto-peer handling',
  });

  const testFile = 'services/gateway-api/src/__tests__/discovery.test.ts';
  const hasTestFile = fs.existsSync(path.join(root, testFile));
  checks.push({
    id: 'discovery_runtime_test_present',
    pass: hasTestFile,
    detail: hasTestFile ? testFile : `missing ${testFile}`,
  });

  let testRunCode = null;
  let testRunStdout = '';
  let testRunStderr = '';
  if (hasTestFile) {
    const npmArgs = [
      '--prefix',
      'services/gateway-api',
      'run',
      'test',
      '--',
      'discovery.test.ts',
      '--runInBand',
    ];
    const result = process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', `npm ${npmArgs.join(' ')}`], {
        cwd: root,
        encoding: 'utf8',
      })
      : spawnSync('npm', npmArgs, {
        cwd: root,
        encoding: 'utf8',
      });
    testRunCode = typeof result.status === 'number' ? result.status : 1;
    testRunStdout = String(result.stdout || '');
    testRunStderr = String(result.stderr || '');
    checks.push({
      id: 'discovery_runtime_tests_pass',
      pass: testRunCode === 0,
      detail: result.error ? `spawn_error=${String(result.error.message || result.error)}` : `exit_code=${testRunCode}`,
    });
  } else {
    checks.push({
      id: 'discovery_runtime_tests_pass',
      pass: false,
      detail: 'skipped because discovery.test.ts is missing',
    });
  }

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    checks,
    test_execution: {
      command: 'npm --prefix services/gateway-api run test -- discovery.test.ts --runInBand',
      exit_code: testRunCode,
      stdout_excerpt: testRunStdout.split(/\r?\n/).slice(-30),
      stderr_excerpt: testRunStderr.split(/\r?\n/).slice(-30),
    },
    source: {
      discovery_service: 'services/gateway-api/src/services/DiscoveryService.ts',
      test_file: testFile,
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw Discovery Runtime Check',
      '',
      `Generated: ${payload.generated_at}`,
      `Status: ${status}`,
      '',
      '## Checks',
      ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
      '',
      '## Test Command',
      `- \`${payload.test_execution.command}\``,
      `- exit_code: ${String(payload.test_execution.exit_code)}`,
      '',
      '## Output (tail)',
      ...payload.test_execution.stdout_excerpt.map((line) => `- ${line}`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
  console.log(`openclaw-discovery-runtime-check: ${status}`);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

run();
