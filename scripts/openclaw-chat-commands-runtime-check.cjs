#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-chat-commands-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-chat-commands-runtime-latest.md');

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function readUtf8(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

function run() {
  const checks = [];

  const commandSource = readUtf8('services/agent-runtime/src/chat-commands.ts') || '';
  const hasSkillCommand = commandSource.includes("case 'skill'");
  const hasModelCommand = commandSource.includes("case 'model'");
  const hasProseCommand = commandSource.includes("case 'prose'");
  const hasDirectiveSupport = commandSource.includes('viaDirective') && commandSource.includes('sven:');

  checks.push({
    id: 'chat_commands_skill_handler_present',
    pass: hasSkillCommand,
    detail: hasSkillCommand ? 'chat-commands includes /skill handler' : 'missing /skill handler',
  });
  checks.push({
    id: 'chat_commands_model_handler_present',
    pass: hasModelCommand,
    detail: hasModelCommand ? 'chat-commands includes /model handler' : 'missing /model handler',
  });
  checks.push({
    id: 'chat_commands_prose_handler_present',
    pass: hasProseCommand,
    detail: hasProseCommand ? 'chat-commands includes /prose handler' : 'missing /prose handler',
  });
  checks.push({
    id: 'chat_commands_directive_support_present',
    pass: hasDirectiveSupport,
    detail: hasDirectiveSupport ? 'chat-commands includes inline directive parsing support' : 'missing inline directive parsing support',
  });

  const testFiles = [
    'services/agent-runtime/src/__tests__/skill-command.test.ts',
    'services/agent-runtime/src/__tests__/model-command.test.ts',
    'services/agent-runtime/src/__tests__/ops-commands.test.ts',
    'services/agent-runtime/src/__tests__/directives.test.ts',
  ];
  for (const file of testFiles) {
    const exists = fs.existsSync(path.join(root, file));
    checks.push({
      id: `${path.basename(file, '.test.ts')}_test_present`,
      pass: exists,
      detail: exists ? file : `missing ${file}`,
    });
  }

  let testRunCode = null;
  let testRunStdout = '';
  let testRunStderr = '';
  const canRunTests = testFiles.every((file) => fs.existsSync(path.join(root, file)));
  if (canRunTests) {
    const npmArgs = [
      '--prefix',
      'services/agent-runtime',
      'run',
      'test',
      '--',
      'skill-command.test.ts',
      'model-command.test.ts',
      'ops-commands.test.ts',
      'directives.test.ts',
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
      id: 'chat_commands_runtime_tests_pass',
      pass: testRunCode === 0,
      detail: result.error ? `spawn_error=${String(result.error.message || result.error)}` : `exit_code=${testRunCode}`,
    });
  } else {
    checks.push({
      id: 'chat_commands_runtime_tests_pass',
      pass: false,
      detail: 'skipped because one or more required test files are missing',
    });
  }

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    checks,
    test_execution: {
      command: 'npm --prefix services/agent-runtime run test -- skill-command.test.ts model-command.test.ts ops-commands.test.ts directives.test.ts --runInBand',
      exit_code: testRunCode,
      stdout_excerpt: testRunStdout.split(/\r?\n/).slice(-30),
      stderr_excerpt: testRunStderr.split(/\r?\n/).slice(-30),
    },
    source: {
      chat_commands: 'services/agent-runtime/src/chat-commands.ts',
      tests: testFiles,
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw Chat Commands Runtime Check',
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
  console.log(`openclaw-chat-commands-runtime-check: ${status}`);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

run();
