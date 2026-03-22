#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-channels-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-channels-runtime-latest.md');

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

  const channelsRuntimeRun = runNpm([
    '--prefix',
    'services/gateway-api',
    'run',
    'test',
    '--',
    'adapter-helpers.test.ts',
    'pairing.e2e.ts',
    'chat-commands.e2e.test.js',
    'matrix-adapter.e2e.test.js',
    'line-adapter.e2e.test.js',
    'email-pubsub.e2e.test.js',
    'scheduler-chat.e2e.test.js',
    'identity-links.e2e.ts',
    'message-queue.e2e.ts',
    'message-queue.integration.e2e.ts',
    '--runInBand',
  ]);
  commandRuns.push(resultPayload(
    'channels_runtime_tests_check',
    'npm --prefix services/gateway-api run test -- adapter-helpers.test.ts pairing.e2e.ts chat-commands.e2e.test.js matrix-adapter.e2e.test.js line-adapter.e2e.test.js email-pubsub.e2e.test.js scheduler-chat.e2e.test.js identity-links.e2e.ts message-queue.e2e.ts message-queue.integration.e2e.ts --runInBand',
    channelsRuntimeRun,
  ));

  const composeSource = readUtf8('docker-compose.yml');
  const requiredAdapters = [
    'adapter-discord:',
    'adapter-slack:',
    'adapter-telegram:',
    'adapter-matrix:',
    'adapter-zalo:',
    'adapter-zalo-personal:',
    'adapter-teams:',
    'adapter-google-chat:',
    'adapter-feishu:',
    'adapter-mattermost:',
    'adapter-whatsapp:',
    'adapter-signal:',
    'adapter-imessage:',
    'adapter-webchat:',
    'adapter-irc:',
    'adapter-nostr:',
    'adapter-tlon:',
    'adapter-twitch:',
    'adapter-nextcloud-talk:',
  ];
  checks.push({
    id: 'channels_runtime_tests_pass',
    pass: commandRuns.find((runItem) => runItem.id === 'channels_runtime_tests_check')?.pass === true,
    detail: 'Adapter/message/pairing/scheduler/identity queue runtime tests pass',
  });
  checks.push({
    id: 'docker_compose_channel_adapters_present',
    pass: hasAll(composeSource, requiredAdapters),
    detail: 'docker-compose declares full channel adapter service set',
  });

  const pairingSource = readUtf8('services/gateway-api/src/routes/admin/pairing.ts');
  const usersSource = readUtf8('services/gateway-api/src/routes/admin/users.ts');
  checks.push({
    id: 'pairing_routes_present',
    pass: hasAll(pairingSource, ['/pairing/approve', '/pairing/deny', '/pairing/allowlist']),
    detail: 'Pairing approval/deny/allowlist routes exist in gateway adapter surface',
  });
  checks.push({
    id: 'identity_links_admin_routes_present',
    pass: hasAll(usersSource, ['/identity-links', '/identity-links/:linkId/verify']),
    detail: 'Identity links CRUD+verify admin routes exist',
  });

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    mapped_openclaw_rows: [
      '2.1',
      '2.2',
      '2.3',
      '2.4',
      '2.5',
      '2.6',
      '2.7',
      '2.8',
      '2.9',
      '2.10',
      '2.11',
      '2.12',
      '2.13',
      '2.16',
      '2.17',
      '2.18',
      '2.19',
      '2.20',
      '2.21',
      '2.22',
      '2.23',
      '2.24',
      '2.25',
      '2.26',
      '2.27',
      '2.28',
    ],
    checks,
    command_runs: commandRuns,
    source_files: [
      'docker-compose.yml',
      'services/gateway-api/src/routes/admin/pairing.ts',
      'services/gateway-api/src/routes/admin/users.ts',
    ],
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw Channels Runtime Check',
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
  console.log(`openclaw-channels-runtime-check: ${status}`);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

run();
