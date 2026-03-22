#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-litellm-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-litellm-runtime-latest.md');

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function readUtf8(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

function run() {
  const checks = [];
  const routerSource = readUtf8('services/agent-runtime/src/llm-router.ts') || '';
  const hasLiteLlmToggle = routerSource.includes("llm.litellm.enabled");
  const hasLiteLlmEndpointRouting = routerSource.includes('/v1/chat/completions');
  const hasVirtualKeySupport = routerSource.includes('litellm_virtual_keys');

  checks.push({
    id: 'llm_router_litellm_toggle_present',
    pass: hasLiteLlmToggle,
    detail: hasLiteLlmToggle ? 'llm-router reads llm.litellm.enabled setting' : 'missing llm.litellm.enabled setting read',
  });
  checks.push({
    id: 'llm_router_litellm_endpoint_routing_present',
    pass: hasLiteLlmEndpointRouting,
    detail: hasLiteLlmEndpointRouting ? 'llm-router composes LiteLLM /v1/chat/completions calls' : 'missing LiteLLM endpoint routing',
  });
  checks.push({
    id: 'llm_router_virtual_key_support_present',
    pass: hasVirtualKeySupport,
    detail: hasVirtualKeySupport ? 'llm-router resolves litellm_virtual_keys' : 'missing litellm virtual key support',
  });

  const testFile = 'services/agent-runtime/src/__tests__/llm-router.litellm.test.ts';
  const hasTestFile = fs.existsSync(path.join(root, testFile));
  checks.push({
    id: 'litellm_runtime_test_present',
    pass: hasTestFile,
    detail: hasTestFile ? testFile : `missing ${testFile}`,
  });

  let testRunCode = null;
  let testRunStdout = '';
  let testRunStderr = '';
  if (hasTestFile) {
    const npmArgs = [
      '--prefix',
      'services/agent-runtime',
      'run',
      'test',
      '--',
      'llm-router.litellm.test.ts',
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
      id: 'litellm_runtime_tests_pass',
      pass: testRunCode === 0,
      detail: result.error ? `spawn_error=${String(result.error.message || result.error)}` : `exit_code=${testRunCode}`,
    });
  } else {
    checks.push({
      id: 'litellm_runtime_tests_pass',
      pass: false,
      detail: 'skipped because llm-router.litellm.test.ts is missing',
    });
  }

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    checks,
    test_execution: {
      command: 'npm --prefix services/agent-runtime run test -- llm-router.litellm.test.ts --runInBand',
      exit_code: testRunCode,
      stdout_excerpt: testRunStdout.split(/\r?\n/).slice(-30),
      stderr_excerpt: testRunStderr.split(/\r?\n/).slice(-30),
    },
    source: {
      llm_router: 'services/agent-runtime/src/llm-router.ts',
      test_file: testFile,
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw LiteLLM Runtime Check',
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
  console.log(`openclaw-litellm-runtime-check: ${status}`);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

run();
