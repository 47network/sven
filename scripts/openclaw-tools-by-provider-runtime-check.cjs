#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-tools-by-provider-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-tools-by-provider-runtime-latest.md');

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function readUtf8(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

function run() {
  const checks = [];

  const policyEngineSource = readUtf8('services/agent-runtime/src/policy-engine.ts') || '';
  const hasProviderModelGate = policyEngineSource.includes('checkProviderModelBindings(');
  const hasModelWildcardMatcher = policyEngineSource.includes('matchesModelBindingKey(');
  checks.push({
    id: 'policy_engine_provider_model_gate_present',
    pass: hasProviderModelGate,
    detail: hasProviderModelGate
      ? 'services/agent-runtime/src/policy-engine.ts includes checkProviderModelBindings'
      : 'missing provider/model binding gate in policy-engine',
  });
  checks.push({
    id: 'policy_engine_model_wildcard_matcher_present',
    pass: hasModelWildcardMatcher,
    detail: hasModelWildcardMatcher
      ? 'services/agent-runtime/src/policy-engine.ts includes model binding wildcard matcher'
      : 'missing model wildcard matcher in policy-engine',
  });

  const testFilePath = path.join(root, 'services', 'agent-runtime', 'src', '__tests__', 'policy-engine-tool-bindings.test.ts');
  const hasTestFile = fs.existsSync(testFilePath);
  checks.push({
    id: 'policy_engine_tool_binding_test_present',
    pass: hasTestFile,
    detail: hasTestFile
      ? 'services/agent-runtime/src/__tests__/policy-engine-tool-bindings.test.ts'
      : 'missing policy-engine tool-binding test file',
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
      'policy-engine-tool-bindings.test.ts',
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
      id: 'policy_engine_tool_binding_runtime_tests_pass',
      pass: testRunCode === 0,
      detail: result.error
        ? `spawn_error=${String(result.error.message || result.error)}`
        : `exit_code=${testRunCode}`,
    });
  } else {
    checks.push({
      id: 'policy_engine_tool_binding_runtime_tests_pass',
      pass: false,
      detail: 'skipped because test file is missing',
    });
  }

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    checks,
    test_execution: {
      command: 'npm --prefix services/agent-runtime run test -- policy-engine-tool-bindings.test.ts --runInBand',
      exit_code: testRunCode,
      stdout_excerpt: testRunStdout.split(/\r?\n/).slice(-20),
      stderr_excerpt: testRunStderr.split(/\r?\n/).slice(-20),
    },
    source: {
      policy_engine: 'services/agent-runtime/src/policy-engine.ts',
      test_file: 'services/agent-runtime/src/__tests__/policy-engine-tool-bindings.test.ts',
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw tools.byProvider Runtime Check',
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
  console.log(`openclaw-tools-by-provider-runtime-check: ${status}`);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

run();
