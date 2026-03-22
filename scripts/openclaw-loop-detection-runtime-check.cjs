#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-loop-detection-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-loop-detection-runtime-latest.md');

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function readUtf8(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

function run() {
  const checks = [];
  const source = readUtf8('services/agent-runtime/src/self-correction.ts') || '';
  checks.push({
    id: 'self_correction_loop_tracker_present',
    pass: source.includes('retryTracker') && source.includes('infinite loop'),
    detail: source.includes('retryTracker') && source.includes('infinite loop')
      ? 'self-correction runtime includes retry tracker + infinite-loop detection path'
      : 'missing retry tracker/infinite-loop detection path',
  });
  checks.push({
    id: 'self_correction_identical_retry_guard_present',
    pass: source.includes('identical_retry_detected') && source.includes('identical tool call'),
    detail: source.includes('identical_retry_detected') && source.includes('identical tool call')
      ? 'self-correction runtime guards identical retry signatures'
      : 'missing identical retry signature guard',
  });
  checks.push({
    id: 'self_correction_fanout_cap_present',
    pass: source.includes('fan-out capped') && source.includes('max_dispatch'),
    detail: source.includes('fan-out capped') && source.includes('max_dispatch')
      ? 'self-correction runtime caps strategy retry fan-out'
      : 'missing strategy retry fan-out cap',
  });

  const testFile = 'services/agent-runtime/src/__tests__/self-correction.test.ts';
  const hasTest = fs.existsSync(path.join(root, testFile));
  checks.push({
    id: 'self_correction_runtime_test_present',
    pass: hasTest,
    detail: hasTest ? testFile : `missing ${testFile}`,
  });

  let exitCode = null;
  let stdout = '';
  let stderr = '';
  if (hasTest) {
    const args = [
      '--prefix',
      'services/agent-runtime',
      'run',
      'test',
      '--',
      'self-correction.test.ts',
      '--runInBand',
    ];
    const result = process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], { cwd: root, encoding: 'utf8' })
      : spawnSync('npm', args, { cwd: root, encoding: 'utf8' });
    exitCode = typeof result.status === 'number' ? result.status : 1;
    stdout = String(result.stdout || '');
    stderr = String(result.stderr || '');
    checks.push({
      id: 'self_correction_loop_detection_tests_pass',
      pass: exitCode === 0,
      detail: result.error ? `spawn_error=${String(result.error.message || result.error)}` : `exit_code=${exitCode}`,
    });
  } else {
    checks.push({
      id: 'self_correction_loop_detection_tests_pass',
      pass: false,
      detail: 'skipped because self-correction.test.ts is missing',
    });
  }

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    checks,
    test_execution: {
      command: 'npm --prefix services/agent-runtime run test -- self-correction.test.ts --runInBand',
      exit_code: exitCode,
      stdout_excerpt: stdout.split(/\r?\n/).slice(-35),
      stderr_excerpt: stderr.split(/\r?\n/).slice(-35),
    },
    source: {
      runtime: 'services/agent-runtime/src/self-correction.ts',
      test_file: testFile,
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw Loop Detection Runtime Check',
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
  console.log(`openclaw-loop-detection-runtime-check: ${status}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
