#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-ops-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-ops-runtime-latest.md');

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function readUtf8(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function hasAll(source, values) {
  return values.every((value) => source.includes(value));
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

function runNode(scriptPath, args = []) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
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

  const composeProfilesRun = runNode('scripts/docker-compose-profiles-check.cjs', ['--strict']);
  commandRuns.push(resultPayload(
    'docker_compose_profiles_check',
    'node scripts/docker-compose-profiles-check.cjs --strict',
    composeProfilesRun,
  ));

  const dockerMultiRun = runNode('scripts/docker-multistage-check.cjs', ['--strict']);
  commandRuns.push(resultPayload(
    'docker_multistage_check',
    'node scripts/docker-multistage-check.cjs --strict',
    dockerMultiRun,
  ));

  const dockerNonRootRun = runNode('scripts/docker-nonroot-check.cjs', ['--strict']);
  commandRuns.push(resultPayload(
    'docker_nonroot_check',
    'node scripts/docker-nonroot-check.cjs --strict',
    dockerNonRootRun,
  ));

  const configExternalizationRun = runNpm(['run', '-s', 'release:config:externalization:check']);
  commandRuns.push(resultPayload(
    'config_externalization_check',
    'npm run -s release:config:externalization:check',
    configExternalizationRun,
  ));

  const configEnvRun = runNpm(['run', '-s', 'release:config:environments:check']);
  commandRuns.push(resultPayload(
    'config_environments_check',
    'npm run -s release:config:environments:check',
    configEnvRun,
  ));

  const adapterHealthRun = runNpm(['run', '-s', 'release:adapter:health:contract:check']);
  commandRuns.push(resultPayload(
    'adapter_health_contract_check',
    'npm run -s release:adapter:health:contract:check',
    adapterHealthRun,
  ));

  const gatewayOpsRun = runNpm([
    '--prefix',
    'services/gateway-api',
    'run',
    'test',
    '--',
    'tailscale.e2e.test.js',
    'tunnel.e2e.ts',
    'entity-typing-indicator.unit.test.ts',
    'logger-redaction.unit.test.ts',
    '--runInBand',
  ]);
  commandRuns.push(resultPayload(
    'gateway_ops_runtime_tests_check',
    'npm --prefix services/gateway-api run test -- tailscale.e2e.test.js tunnel.e2e.ts entity-typing-indicator.unit.test.ts logger-redaction.unit.test.ts --runInBand',
    gatewayOpsRun,
  ));

  checks.push({
    id: 'ops_runtime_lanes_and_tests_pass',
    pass: commandRuns.every((runItem) => runItem.pass),
    detail: 'docker/config/adapter-health lanes plus tailscale/tunnel/typing/redaction runtime tests pass',
  });

  checks.push({
    id: 'nix_deployment_surface_present',
    pass: exists('flake.nix') && exists('nix/sven.nix') && exists('docs/deploy/nix.md'),
    detail: 'flake.nix + nix module + deployment guide are present',
  });

  const tailscaleSource = readUtf8('services/gateway-api/src/services/TailscaleService.ts');
  checks.push({
    id: 'tailscale_integration_surface_present',
    pass: hasAll(tailscaleSource, ['tailscale serve --bg', 'tailscale funnel --bg', 'gateway.tailscale.mode']),
    detail: 'tailscale serve/funnel integration and mode persistence are implemented',
  });

  const tunnelRouteSource = readUtf8('services/gateway-api/src/routes/admin/tunnel.ts');
  checks.push({
    id: 'remote_gateway_surface_present',
    pass: hasAll(tunnelRouteSource, ['/tunnel/status', 'SVEN_TUNNEL_PUBLIC_URL', 'sven://gateway/connect']),
    detail: 'remote gateway tunnel status/URL propagation route is implemented',
  });

  const healthRouteSource = readUtf8('services/gateway-api/src/routes/health.ts');
  checks.push({
    id: 'health_checks_surface_present',
    pass: hasAll(healthRouteSource, ['/healthz', '/readyz', "health.status === 'healthy'"]),
    detail: 'healthz + readyz endpoints are implemented with healthy status reporting',
  });

  const entityStateSource = readUtf8('services/gateway-api/src/services/EntityStateService.ts');
  checks.push({
    id: 'presence_and_typing_surface_present',
    pass: hasAll(entityStateSource, ["typingMode: 'thinking'", "mode === 'instant'", "mode === 'message'", "mode === 'never'"]),
    detail: 'presence + typing indicator state machine supports thinking/message/instant/never modes',
  });

  const composeDevSource = readUtf8('docker-compose.dev.yml');
  const composeStagingSource = readUtf8('docker-compose.staging.yml');
  const composeProdSource = readUtf8('docker-compose.production.yml');
  checks.push({
    id: 'release_channels_surface_present',
    pass:
      composeDevSource.includes('SVEN_DEPLOYMENT_MODE: development') &&
      composeStagingSource.includes('SVEN_DEPLOYMENT_MODE: staging') &&
      composeProdSource.includes('SVEN_DEPLOYMENT_MODE: production'),
    detail: 'dev/staging/production channel profiles are explicitly configured',
  });

  const webchatSource = readUtf8('services/adapter-webchat/src/index.ts');
  checks.push({
    id: 'ui_config_surface_present',
    pass: hasAll(webchatSource, ['primaryColor', 'title', 'avatarUrl', 'welcomeText', '--sven-accent']),
    detail: 'webchat widget supports configurable accent/title/avatar/welcome text',
  });

  const settingsSource = readUtf8('apps/admin-ui/src/app/settings/page.tsx');
  checks.push({
    id: 'log_redaction_config_surface_present',
    pass: hasAll(settingsSource, ['logging.redactSensitive', 'logging.redactPatterns']),
    detail: 'admin settings exposes redactSensitive and redactPatterns controls',
  });

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    mapped_openclaw_rows: ['9.1', '9.2', '9.3', '9.4', '9.5', '9.7', '9.8', '9.9', '9.10'],
    checks,
    command_runs: commandRuns,
    source_files: [
      'flake.nix',
      'nix/sven.nix',
      'docs/deploy/nix.md',
      'docker-compose.dev.yml',
      'docker-compose.staging.yml',
      'docker-compose.production.yml',
      'services/gateway-api/src/services/TailscaleService.ts',
      'services/gateway-api/src/routes/admin/tunnel.ts',
      'services/gateway-api/src/routes/health.ts',
      'services/gateway-api/src/services/EntityStateService.ts',
      'services/adapter-webchat/src/index.ts',
      'apps/admin-ui/src/app/settings/page.tsx',
    ],
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw Ops Runtime Check',
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
  console.log(`openclaw-ops-runtime-check: ${status}`);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

run();
