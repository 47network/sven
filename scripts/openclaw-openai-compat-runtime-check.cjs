#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-openai-compat-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-openai-compat-runtime-latest.md');

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
  const routeSource = readUtf8('services/gateway-api/src/routes/openai-compat.ts') || '';
  checks.push({
    id: 'openai_compat_chat_completions_route_present',
    pass: routeSource.includes("app.post('/v1/chat/completions'"),
    detail: routeSource.includes("app.post('/v1/chat/completions'")
      ? 'openai-compat route exposes /v1/chat/completions'
      : 'missing /v1/chat/completions route',
  });
  checks.push({
    id: 'openai_compat_responses_route_present',
    pass: routeSource.includes("app.post('/v1/responses'"),
    detail: routeSource.includes("app.post('/v1/responses'")
      ? 'openai-compat route exposes /v1/responses'
      : 'missing /v1/responses route',
  });
  checks.push({
    id: 'openai_compat_models_route_present',
    pass: routeSource.includes("app.get('/v1/models'"),
    detail: routeSource.includes("app.get('/v1/models'")
      ? 'openai-compat route exposes /v1/models'
      : 'missing /v1/models route',
  });

  const testFile = 'services/gateway-api/src/__tests__/openai-compat.e2e.ts';
  checks.push({
    id: 'openai_compat_test_present',
    pass: fs.existsSync(path.join(root, testFile)),
    detail: fs.existsSync(path.join(root, testFile)) ? testFile : `missing ${testFile}`,
  });

  let exitCode = null;
  let stdout = '';
  let stderr = '';
  if (fs.existsSync(path.join(root, testFile))) {
    const run = runTests([
      '--prefix',
      'services/gateway-api',
      'run',
      'test',
      '--',
      'openai-compat.e2e.ts',
      '--runInBand',
    ]);
    exitCode = run.exitCode;
    stdout = run.stdout;
    stderr = run.stderr;
    checks.push({
      id: 'openai_compat_runtime_tests_pass',
      pass: run.exitCode === 0,
      detail: run.error ? `spawn_error=${run.error}` : `exit_code=${run.exitCode}`,
    });
  } else {
    checks.push({
      id: 'openai_compat_runtime_tests_pass',
      pass: false,
      detail: 'skipped because openai-compat.e2e.ts is missing',
    });
  }

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    checks,
    test_execution: {
      command: 'npm --prefix services/gateway-api run test -- openai-compat.e2e.ts --runInBand',
      exit_code: exitCode,
      stdout_excerpt: stdout.split(/\r?\n/).slice(-40),
      stderr_excerpt: stderr.split(/\r?\n/).slice(-40),
    },
    source: {
      route_file: 'services/gateway-api/src/routes/openai-compat.ts',
      test_file: testFile,
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw OpenAI-Compat Runtime Check',
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
  console.log(`openclaw-openai-compat-runtime-check: ${status}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
