#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-framework-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-framework-runtime-latest.md');

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function readUtf8(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function hasAll(source, values) {
  return values.every((value) => source.includes(value));
}

function readJson(relPath) {
  try {
    return JSON.parse(readUtf8(relPath) || '{}');
  } catch {
    return {};
  }
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

function runInGatewayApi(commandArgs) {
  if (process.platform === 'win32') {
    const cmdline = `npm exec -- ${commandArgs.join(' ')}`;
    return spawnSync('cmd.exe', ['/d', '/s', '/c', cmdline], {
      cwd: path.join(root, 'services', 'gateway-api'),
      encoding: 'utf8',
      stdio: 'pipe',
    });
  }
  return spawnSync('npm', ['exec', '--', ...commandArgs], {
    cwd: path.join(root, 'services', 'gateway-api'),
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

function run() {
  const checks = [];
  const commandRuns = [];

  const streamResumeRun = runInGatewayApi([
    'tsx',
    '--test',
    'src/__tests__/stream-resume.e2e.test.ts',
  ]);
  commandRuns.push(resultPayload(
    'stream_resume_runtime_test_check',
    'cd services/gateway-api && npm exec -- tsx --test src/__tests__/stream-resume.e2e.test.ts',
    streamResumeRun,
  ));

  const policyAndSubagentRun = runNpm([
    '--prefix',
    'services/agent-runtime',
    'run',
    'test',
    '--',
    'policy-engine-tool-bindings.test.ts',
    'subagent-config.test.ts',
    '--runInBand',
  ]);
  commandRuns.push(resultPayload(
    'guardrails_and_subagent_runtime_tests_check',
    'npm --prefix services/agent-runtime run test -- policy-engine-tool-bindings.test.ts subagent-config.test.ts --runInBand',
    policyAndSubagentRun,
  ));

  checks.push({
    id: 'framework_runtime_tests_pass',
    pass: commandRuns.every((runItem) => runItem.pass),
    detail: 'stream-resume and guardrails/subagent runtime tests pass',
  });

  const streamsRouteSource = readUtf8('services/gateway-api/src/routes/streams.ts');
  checks.push({
    id: 'resumable_streaming_surface_present',
    pass: hasAll(streamsRouteSource, [
      '/v1/streams/:id/sse',
      "request.headers['last-event-id']",
      'last_event_id',
      'parseOptionalNonNegativeInteger',
      'if (Number(ev.id) > lastEventId) sendEvent(ev)',
    ]),
    detail: 'stream route supports reconnect+resume from Last-Event-ID/last_event_id',
  });

  const promptFirewallSource = readUtf8('services/agent-runtime/src/prompt-firewall.ts');
  const policyEngineSource = readUtf8('services/agent-runtime/src/policy-engine.ts');
  checks.push({
    id: 'guardrails_surface_present',
    pass: hasAll(promptFirewallSource, [
      'class PromptFirewall',
      'async validate(',
      'validateUserMessageReferences(',
      'hasApprovedPlan(',
      'checkSystemPromptDrift(',
      'SYSTEM PROMPT DRIFT DETECTED',
    ]) && hasAll(policyEngineSource, [
      'Deny-by-default policy engine',
      'evaluateToolCall(',
      'tool_policy.by_provider',
      'checkProviderModelBindings(',
    ]),
    detail: 'prompt firewall + deny-by-default policy engine guardrails are implemented',
  });

  const replayRouteSource = readUtf8('services/gateway-api/src/routes/admin/replay.ts');
  checks.push({
    id: 'evals_replay_surface_present',
    pass: hasAll(replayRouteSource, [
      "/replay/scenario",
      "/replay/scenarios",
      "/replay/run",
      "/replay/compare",
      'Create and start a new replay run',
      'Compare two replay runs',
    ]),
    detail: 'replay/evals API surface exists for scenario suites and run comparison',
  });

  const agentsRouteSource = readUtf8('services/gateway-api/src/routes/admin/agents.ts');
  const subagentConfigSource = readUtf8('services/agent-runtime/src/subagent-config.ts');
  checks.push({
    id: 'supervisor_subagent_surface_present',
    pass: hasAll(agentsRouteSource, [
      '/agents/supervisor/orchestrate',
      '/agents/:id/spawn-session',
      'supervisor_agent_id',
      'Maximum subagent nesting depth exceeded',
    ]) && hasAll(subagentConfigSource, [
      'policy_scope?: string[]',
      'resolveSubagentConfig',
      'isScopeAllowedForSubagent',
      'resolution_error',
    ]),
    detail: 'supervisor orchestration and subagent scope resolution surfaces are implemented',
  });

  const voiceRuntimeStatus = readJson('docs/release/status/openclaw-voice-runtime-latest.json');
  checks.push({
    id: 'voice_providers_runtime_lane_pass',
    pass: String(voiceRuntimeStatus.status || '') === 'pass',
    detail: 'voice runtime lane passes with provider fallback surface (OpenAI/ElevenLabs/Piper)',
  });

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    mapped_openclaw_rows: ['11.1', '11.2', '11.3', '11.4'],
    linked_openclaw_rows: [
      { row: '11.6', artifact: 'docs/release/status/openclaw-voice-runtime-latest.json' },
    ],
    checks,
    command_runs: commandRuns,
    source_files: [
      'services/gateway-api/src/routes/streams.ts',
      'services/gateway-api/src/routes/admin/replay.ts',
      'services/gateway-api/src/routes/admin/agents.ts',
      'services/agent-runtime/src/prompt-firewall.ts',
      'services/agent-runtime/src/policy-engine.ts',
      'services/agent-runtime/src/subagent-config.ts',
      'docs/release/status/openclaw-voice-runtime-latest.json',
    ],
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw Framework Runtime Check',
      '',
      `Generated: ${payload.generated_at}`,
      `Status: ${status}`,
      '',
      `Mapped OpenClaw rows: ${payload.mapped_openclaw_rows.join(', ')}`,
      `Linked rows: ${payload.linked_openclaw_rows.map((item) => `${item.row} -> ${item.artifact}`).join(', ')}`,
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
  console.log(`openclaw-framework-runtime-check: ${status}`);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

run();
