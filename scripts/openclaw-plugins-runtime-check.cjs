#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-plugins-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-plugins-runtime-latest.md');

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

function run() {
  const checks = [];
  const commandRuns = [];

  const mcpRun = runNpm([
    '--prefix',
    'services/gateway-api',
    'run',
    'test',
    '--',
    'mcp.e2e.ts',
    '--runInBand',
  ]);
  commandRuns.push(resultPayload(
    'mcp_admin_runtime_check',
    'npm --prefix services/gateway-api run test -- mcp.e2e.ts --runInBand',
    mcpRun,
  ));

  const skillRun = runNpm([
    '--prefix',
    'services/agent-runtime',
    'run',
    'test',
    '--',
    'skill-command.test.ts',
    '--runInBand',
  ]);
  commandRuns.push(resultPayload(
    'skill_command_runtime_check',
    'npm --prefix services/agent-runtime run test -- skill-command.test.ts --runInBand',
    skillRun,
  ));

  checks.push({
    id: 'mcp_admin_runtime_tests_pass',
    pass: commandRuns.find((runItem) => runItem.id === 'mcp_admin_runtime_check')?.pass === true,
    detail: 'MCP server registry/test/tools/call runtime checks pass',
  });
  checks.push({
    id: 'skill_plugin_runtime_tests_pass',
    pass: commandRuns.find((runItem) => runItem.id === 'skill_command_runtime_check')?.pass === true,
    detail: '/skill command and lockdown/admin guardrails pass',
  });

  const mcpAdminSource = readUtf8('services/gateway-api/src/routes/admin/mcp.ts');
  const mcpServerSource = readUtf8('services/gateway-api/src/routes/mcp-server.ts');
  const chatCommandsSource = readUtf8('services/agent-runtime/src/chat-commands.ts');
  checks.push({
    id: 'mcp_registry_routes_present',
    pass:
      mcpAdminSource.includes("app.get('/mcp-servers'")
      && mcpAdminSource.includes("app.post('/mcp-servers/:id/tools/call'")
      && mcpServerSource.includes("app.post('/v1/mcp'"),
    detail: 'Gateway exposes admin MCP registry and MCP RPC routes',
  });
  checks.push({
    id: 'plugin_security_controls_present',
    pass:
      mcpServerSource.includes('MCP_SERVER_RATE_LIMIT')
      && mcpServerSource.includes('Missing required MCP scope')
      && chatCommandsSource.includes('skill install')
      && chatCommandsSource.includes("incidentMode === 'lockdown'"),
    detail: 'Plugin/MCP security controls include auth scope checks, rate limits, and lockdown-aware skill management',
  });

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    mapped_openclaw_rows: ['1.13', '11.5'],
    checks,
    command_runs: commandRuns,
    source_files: [
      'services/gateway-api/src/routes/admin/mcp.ts',
      'services/gateway-api/src/routes/mcp-server.ts',
      'services/agent-runtime/src/chat-commands.ts',
    ],
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw Plugins Runtime Check',
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
  console.log(`openclaw-plugins-runtime-check: ${status}`);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

run();
