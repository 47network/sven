#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-core-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-core-runtime-latest.md');

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function readUtf8(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function readJson(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch {
    return null;
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

  const websocketRun = runNpm(['run', '-s', 'release:websocket:contract:check']);
  commandRuns.push(resultPayload(
    'websocket_contract_check',
    'npm run -s release:websocket:contract:check',
    websocketRun,
  ));

  const cliRun = runNpm(['run', 'test:cli:e2e']);
  commandRuns.push(resultPayload(
    'cli_e2e_check',
    'npm run test:cli:e2e',
    cliRun,
  ));

  const routingRun = runNpm([
    '--prefix',
    'services/agent-runtime',
    'run',
    'test',
    '--',
    'subagent-config.test.ts',
    '--runInBand',
  ]);
  commandRuns.push(resultPayload(
    'multi_agent_routing_check',
    'npm --prefix services/agent-runtime run test -- subagent-config.test.ts --runInBand',
    routingRun,
  ));

  const gatewayRuntimeRun = runNpm([
    '--prefix',
    'services/gateway-api',
    'run',
    'test',
    '--',
    'sessions.e2e.ts',
    'message-queue.runtime.e2e.ts',
    'config-includes.test.ts',
    'logger-redaction.unit.test.ts',
    'streaming-pacing.unit.test.ts',
    'correlation.unit.test.ts',
    'workflow-run-telemetry-coherence-contract.test.ts',
    'openai-compat.e2e.ts',
    'upload-validation.test.ts',
    'voice-continuous-conversation.e2e.ts',
    'entity-typing-indicator.unit.test.ts',
    '--runInBand',
  ]);
  commandRuns.push(resultPayload(
    'gateway_core_runtime_check',
    'npm --prefix services/gateway-api run test -- sessions.e2e.ts message-queue.runtime.e2e.ts config-includes.test.ts logger-redaction.unit.test.ts streaming-pacing.unit.test.ts correlation.unit.test.ts workflow-run-telemetry-coherence-contract.test.ts openai-compat.e2e.ts upload-validation.test.ts voice-continuous-conversation.e2e.ts entity-typing-indicator.unit.test.ts --runInBand',
    gatewayRuntimeRun,
  ));

  checks.push({
    id: 'websocket_contract_runtime_pass',
    pass: commandRuns.find((runItem) => runItem.id === 'websocket_contract_check')?.pass === true,
    detail: 'WebSocket/control-plane contract lane executes and passes',
  });
  checks.push({
    id: 'cli_surface_runtime_pass',
    pass: commandRuns.find((runItem) => runItem.id === 'cli_e2e_check')?.pass === true,
    detail: 'CLI e2e suite validates command surface, wizard, profile handling, and strict mode',
  });
  checks.push({
    id: 'multi_agent_routing_runtime_pass',
    pass: commandRuns.find((runItem) => runItem.id === 'multi_agent_routing_check')?.pass === true,
    detail: 'Subagent config/runtime routing checks pass',
  });
  checks.push({
    id: 'gateway_core_runtime_pass',
    pass: commandRuns.find((runItem) => runItem.id === 'gateway_core_runtime_check')?.pass === true,
    detail: 'Session/message queue/config/logging/streaming/openai-shape/media-validation/typing-indicator/telemetry tests pass',
  });

  const websocketStatus = readJson('docs/release/status/websocket-contract-latest.json');
  checks.push({
    id: 'websocket_status_artifact_pass',
    pass: String(websocketStatus?.status || '').toLowerCase() === 'pass',
    detail: 'websocket-contract-latest.json reports pass',
  });

  const gatewayConfigSource = readUtf8('services/gateway-api/src/config.ts');
  checks.push({
    id: 'config_include_env_substitution_present',
    pass:
      gatewayConfigSource.includes('MAX_CONFIG_INCLUDE_DEPTH = 10')
      && gatewayConfigSource.includes('loadConfigWithIncludes(')
      && gatewayConfigSource.includes('substituteEnvVars('),
    detail: 'gateway config supports include merge depth control + ${VAR} substitution',
  });
  checks.push({
    id: 'profile_aware_config_path_present',
    pass:
      gatewayConfigSource.includes('process.env.SVEN_PROFILE')
      && gatewayConfigSource.includes("'.sven', 'profiles'"),
    detail: 'gateway config resolves profile-scoped config path',
  });

  const cliSource = readUtf8('packages/cli/bin/sven.js');
  const composeSource = readUtf8('docker-compose.yml');
  checks.push({
    id: 'cli_profile_flag_present',
    pass:
      cliSource.includes('SVEN_PROFILE')
      && cliSource.includes('--profile')
      && cliSource.includes("'.sven', 'profiles', ACTIVE_PROFILE"),
    detail: 'CLI exposes --profile and profile-scoped secure-store paths',
  });
  checks.push({
    id: 'event_bus_and_db_foundation_present',
    pass:
      composeSource.includes('nats:')
      && composeSource.includes('--jetstream')
      && composeSource.includes('postgres:')
      && composeSource.includes('pgvector/pgvector'),
    detail: 'compose includes NATS JetStream event bus and PostgreSQL/pgvector persistence foundation',
  });

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    mapped_openclaw_rows: [
      '1.1',
      '1.2',
      '1.3',
      '1.4',
      '1.5',
      '1.6',
      '1.7',
      '1.8',
      '1.9',
      '1.10',
      '1.11',
      '1.12',
      '1.15',
      '1.17',
      '1.18',
      '1.19',
      '1.20',
    ],
    checks,
    command_runs: commandRuns,
    source_files: [
      'services/gateway-api/src/config.ts',
      'packages/cli/bin/sven.js',
      'docker-compose.yml',
      'docs/release/status/websocket-contract-latest.json',
      'services/agent-runtime/src/__tests__/subagent-config.test.ts',
      'services/gateway-api/src/__tests__/sessions.e2e.ts',
      'services/gateway-api/src/__tests__/message-queue.runtime.e2e.ts',
      'services/gateway-api/src/__tests__/streaming-pacing.unit.test.ts',
      'services/gateway-api/src/__tests__/entity-typing-indicator.unit.test.ts',
    ],
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw Core Runtime Check',
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
  console.log(`openclaw-core-runtime-check: ${status}`);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

run();
