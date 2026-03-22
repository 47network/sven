#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-provider-routing-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-provider-routing-runtime-latest.md');

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function readUtf8(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

function runTests(args) {
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], { cwd: root, encoding: 'utf8' })
    : spawnSync('npm', args, { cwd: root, encoding: 'utf8' });
  return {
    exitCode: typeof result.status === 'number' ? result.status : 1,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
    error: result.error ? String(result.error.message || result.error) : null,
  };
}

function run() {
  const checks = [];
  const routerSource = readUtf8('services/agent-runtime/src/llm-router.ts') || '';

  checks.push({
    id: 'llm_router_provider_key_pool_present',
    pass: routerSource.includes('llm.providerKeys.'),
    detail: routerSource.includes('llm.providerKeys.')
      ? 'llm-router resolves provider key pools from settings'
      : 'missing provider key pool settings support',
  });
  checks.push({
    id: 'llm_router_provider_key_rotation_present',
    pass: routerSource.includes('markProviderKeyRateLimited(') && routerSource.includes('Provider key rate-limited; rotating key') && routerSource.includes('round_robin'),
    detail: routerSource.includes('markProviderKeyRateLimited(') && routerSource.includes('Provider key rate-limited; rotating key') && routerSource.includes('round_robin')
      ? 'llm-router includes key rotation and rate-limit failover handling'
      : 'missing key rotation/rate-limit failover handling',
  });
  checks.push({
    id: 'llm_router_subscription_auth_ref_present',
    pass: routerSource.includes('providerSubscriptionAuth') && routerSource.includes('token_ref'),
    detail: routerSource.includes('providerSubscriptionAuth') && routerSource.includes('token_ref')
      ? 'llm-router resolves provider subscription auth token references'
      : 'missing provider subscription auth token-ref support',
  });

  const runtimeTestFiles = [
    'services/agent-runtime/src/__tests__/llm-router.provider-keys.test.ts',
    'services/agent-runtime/src/__tests__/llm-router.litellm.test.ts',
  ];
  const gatewayTestFile = 'services/gateway-api/src/__tests__/embeddings-provider.unit.test.ts';
  const testFiles = [...runtimeTestFiles, gatewayTestFile];
  for (const file of testFiles) {
    const exists = fs.existsSync(path.join(root, file));
    checks.push({
      id: `${path.basename(file, '.test.ts')}_test_present`,
      pass: exists,
      detail: exists ? file : `missing ${file}`,
    });
  }

  let exitCode = null;
  let stdout = '';
  let stderr = '';
  let gatewayExitCode = null;
  let gatewayStdout = '';
  let gatewayStderr = '';
  if (testFiles.every((file) => fs.existsSync(path.join(root, file)))) {
    const run = runTests([
      '--prefix',
      'services/agent-runtime',
      'run',
      'test',
      '--',
      'llm-router.provider-keys.test.ts',
      'llm-router.litellm.test.ts',
      '--runInBand',
    ]);
    exitCode = run.exitCode;
    stdout = run.stdout;
    stderr = run.stderr;
    const gatewayRun = runTests([
      '--prefix',
      'services/gateway-api',
      'run',
      'test',
      '--',
      'embeddings-provider.unit.test.ts',
      '--runInBand',
    ]);
    gatewayExitCode = gatewayRun.exitCode;
    gatewayStdout = gatewayRun.stdout;
    gatewayStderr = gatewayRun.stderr;
    checks.push({
      id: 'provider_routing_runtime_tests_pass',
      pass: run.exitCode === 0 && gatewayRun.exitCode === 0,
      detail: run.error ? `spawn_error=${run.error}` : `exit_code=${run.exitCode}`,
    });
    checks.push({
      id: 'provider_routing_embeddings_tests_pass',
      pass: gatewayRun.exitCode === 0,
      detail: gatewayRun.error ? `spawn_error=${gatewayRun.error}` : `exit_code=${gatewayRun.exitCode}`,
    });
  } else {
    checks.push({
      id: 'provider_routing_runtime_tests_pass',
      pass: false,
      detail: 'skipped because required provider-routing test files are missing',
    });
    checks.push({
      id: 'provider_routing_embeddings_tests_pass',
      pass: false,
      detail: 'skipped because embeddings-provider.unit.test.ts is missing',
    });
  }

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    checks,
    test_execution: {
      command: 'npm --prefix services/agent-runtime run test -- llm-router.provider-keys.test.ts llm-router.litellm.test.ts --runInBand',
      exit_code: exitCode,
      stdout_excerpt: stdout.split(/\r?\n/).slice(-30),
      stderr_excerpt: stderr.split(/\r?\n/).slice(-30),
      secondary_command: 'npm --prefix services/gateway-api run test -- embeddings-provider.unit.test.ts --runInBand',
      secondary_exit_code: gatewayExitCode,
      secondary_stdout_excerpt: gatewayStdout.split(/\r?\n/).slice(-30),
      secondary_stderr_excerpt: gatewayStderr.split(/\r?\n/).slice(-30),
    },
    source: {
      llm_router: 'services/agent-runtime/src/llm-router.ts',
      tests: testFiles,
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw Provider Routing Runtime Check',
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
  console.log(`openclaw-provider-routing-runtime-check: ${status}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
