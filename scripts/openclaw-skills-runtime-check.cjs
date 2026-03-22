#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-skills-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-skills-runtime-latest.md');

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

  const gatewaySkillsRun = runNpm([
    '--prefix',
    'services/gateway-api',
    'run',
    'test',
    '--',
    'dynamic-tool-creation.e2e.ts',
    'mcp.e2e.ts',
    'souls.e2e.ts',
    '--runInBand',
  ]);
  commandRuns.push(resultPayload(
    'gateway_skills_runtime_tests_check',
    'npm --prefix services/gateway-api run test -- dynamic-tool-creation.e2e.ts mcp.e2e.ts souls.e2e.ts --runInBand',
    gatewaySkillsRun,
  ));

  const agentRuntimeSkillsRun = runNpm([
    '--prefix',
    'services/agent-runtime',
    'run',
    'test',
    '--',
    'skill-command.test.ts',
    'policy-engine-tool-bindings.test.ts',
    '--runInBand',
  ]);
  commandRuns.push(resultPayload(
    'agent_runtime_skills_tests_check',
    'npm --prefix services/agent-runtime run test -- skill-command.test.ts policy-engine-tool-bindings.test.ts --runInBand',
    agentRuntimeSkillsRun,
  ));

  checks.push({
    id: 'skills_runtime_tests_pass',
    pass:
      commandRuns.find((runItem) => runItem.id === 'gateway_skills_runtime_tests_check')?.pass === true
      && commandRuns.find((runItem) => runItem.id === 'agent_runtime_skills_tests_check')?.pass === true,
    detail: 'Registry/MCP/souls runtime tests and skill command/policy binding tests pass',
  });

  const registrySource = readUtf8('services/gateway-api/src/routes/admin/registry.ts');
  checks.push({
    id: 'registry_surface_present',
    pass: hasAll(registrySource, [
      "app.get('/registry/catalog'",
      "app.get('/registry/marketplace'",
      "app.post('/registry/install/:id'",
      "app.post('/registry/promote/:id'",
      "app.get('/registry/reviews'",
      "app.post('/registry/reviews'",
      "app.get('/registry/quarantine'",
      'semantic_query',
      'embedTextFromEnv',
    ]),
    detail: 'Registry exposes catalog/marketplace/install/promote/reviews/quarantine with semantic search binding',
  });

  const skillRunnerSource = readUtf8('services/skill-runner/src/index.ts');
  checks.push({
    id: 'skill_format_install_security_surface_present',
    pass: hasAll(skillRunnerSource, [
      'SKILL.md must start with YAML frontmatter',
      'SKILL.md frontmatter missing required key',
      'DYNAMIC_SKILL_INITIAL_TRUST_LEVEL',
      "'quarantined'",
      'registry.skill.review',
      'gVisor sandboxed execution for quarantined skills.',
      'SELECT id FROM registry_sources',
      'SELECT id FROM registry_publishers',
      'INSERT INTO skills_catalog',
      'INSERT INTO skills_installed',
      'INSERT INTO skill_quarantine_reports',
    ]),
    detail: 'Skill runner enforces SKILL.md structure and quarantined install pipeline with review-gated promotion path',
  });

  const soulsSource = readUtf8('services/gateway-api/src/routes/admin/souls.ts');
  checks.push({
    id: 'souls_registry_surface_present',
    pass: hasAll(soulsSource, [
      "app.get('/souls/catalog'",
      "app.post('/souls/install'",
      "app.post('/souls/activate/:id'",
      "app.get('/souls/signatures'",
      "app.post('/souls/signatures'",
    ]),
    detail: 'SOUL registry supports catalog/install/activate/signatures flows',
  });

  const cliSource = readUtf8('packages/cli/bin/sven.js');
  checks.push({
    id: 'cli_skills_and_souls_surface_present',
    pass: hasAll(cliSource, [
      'sven skills install',
      'Will create/find registry source, catalog entry, and install as quarantined',
      'SKILL.md is missing frontmatter field: name',
      'sven souls install',
      'sven souls sign',
      'sven souls activate',
    ]),
    detail: 'CLI exposes skill install/import + soul registry command surfaces',
  });

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    mapped_openclaw_rows: ['5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.7', '5.8'],
    checks,
    command_runs: commandRuns,
    source_files: [
      'services/gateway-api/src/routes/admin/registry.ts',
      'services/skill-runner/src/index.ts',
      'services/gateway-api/src/routes/admin/souls.ts',
      'packages/cli/bin/sven.js',
    ],
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw Skills Runtime Check',
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
  console.log(`openclaw-skills-runtime-check: ${status}`);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

run();
