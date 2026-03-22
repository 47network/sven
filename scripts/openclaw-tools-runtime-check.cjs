#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-tools-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-tools-runtime-latest.md');

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function readUtf8(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function runNpm(args) {
  if (process.platform === 'win32') {
    const cmdline = `npm ${args.join(' ')}`;
    return spawnSync('cmd.exe', ['/d', '/s', '/c', cmdline], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  }
  return spawnSync('npm', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function resultPayload(id, command, result) {
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  return {
    id,
    command,
    exit_code: exitCode,
    pass: exitCode === 0,
    error: result.error ? String(result.error.message || result.error) : null,
    stdout_excerpt: String(result.stdout || '').split(/\r?\n/).slice(-25),
    stderr_excerpt: String(result.stderr || '').split(/\r?\n/).slice(-25),
  };
}

function hasAll(source, values) {
  return values.every((value) => source.includes(value));
}

function run() {
  const checks = [];
  const commandRuns = [];

  const toolsRuntimeRun = runNpm([
    '--prefix',
    'services/gateway-api',
    'run',
    'test',
    '--',
    'dynamic-tool-creation.e2e.ts',
    'browser-tools.e2e.ts',
    'search.e2e.ts',
    'cron-webhooks.e2e.test.js',
    'tunnel-status.test.ts',
    'tunnel.e2e.ts',
    'tailscale.e2e.test.js',
    '--runInBand',
  ]);
  commandRuns.push(resultPayload(
    'tools_runtime_tests_check',
    'npm --prefix services/gateway-api run test -- dynamic-tool-creation.e2e.ts browser-tools.e2e.ts search.e2e.ts cron-webhooks.e2e.test.js tunnel-status.test.ts tunnel.e2e.ts tailscale.e2e.test.js --runInBand',
    toolsRuntimeRun,
  ));

  checks.push({
    id: 'tools_runtime_tests_pass',
    pass: commandRuns.find((runItem) => runItem.id === 'tools_runtime_tests_check')?.pass === true,
    detail: 'Browser/search/dynamic-tools/cron-webhooks/tunnel runtime tests pass',
  });

  const skillRunnerSource = readUtf8('services/skill-runner/src/index.ts');
  checks.push({
    id: 'first_party_tool_surface_present',
    pass: hasAll(skillRunnerSource, [
      "case 'shell.exec'",
      "case 'ha.call_service'",
      "case 'calendar.list_events'",
      "case 'git.status'",
      "case 'web.fetch'",
      "case 'analyze.media'",
      "case 'search.web'",
      "case 'schedule.create'",
    ]),
    detail: 'Skill runner contains first-party tool handlers for browser/web/search/ha/calendar/git/media/scheduler flows',
  });

  const policySource = readUtf8('services/agent-runtime/src/policy-engine.ts');
  checks.push({
    id: 'provider_scoped_tool_binding_guard_present',
    pass: hasAll(policySource, ['tool_policy.by_provider', 'checkProviderModelBindings(']),
    detail: 'Policy engine enforces provider/model scoped tool bindings',
  });

  const agentCommandsSource = readUtf8('services/agent-runtime/src/chat-commands.ts');
  checks.push({
    id: 'chat_ops_controls_present',
    pass: hasAll(agentCommandsSource, [
      "case 'compact'",
      "case 'queue'",
      "case 'selfchat'",
      "case 'subagents'",
    ]),
    detail: 'Chat command surface includes compaction, queue controls, self-chat, and subagent ops',
  });

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    mapped_openclaw_rows: [
      '4.1',
      '4.2',
      '4.3',
      '4.4',
      '4.5',
      '4.6',
      '4.7',
      '4.8',
      '4.9',
      '4.10',
      '4.11',
      '4.12',
      '4.13',
      '4.15',
      '4.16',
      '4.17',
      '4.18',
      '4.19',
      '4.20',
      '4.21',
      '4.22',
    ],
    checks,
    command_runs: commandRuns,
    source_files: [
      'services/skill-runner/src/index.ts',
      'services/agent-runtime/src/policy-engine.ts',
      'services/agent-runtime/src/chat-commands.ts',
    ],
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw Tools Runtime Check',
      '',
      `Generated: ${payload.generated_at}`,
      `Status: ${status}`,
      '',
      `Mapped OpenClaw rows: ${payload.mapped_openclaw_rows.join(', ')}`,
      '',
      '## Checks',
      ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
      '',
      '## Command Runs',
      ...commandRuns.map((runItem) => `- ${runItem.id}: exit_code=${runItem.exit_code} (\`${runItem.command}\`)`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
  console.log(`openclaw-tools-runtime-check: ${status}`);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

run();

