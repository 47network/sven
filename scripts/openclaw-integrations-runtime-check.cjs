#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-integrations-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-integrations-runtime-latest.md');

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

  const skillRunnerBuildRun = runNpm(['--prefix', 'services/skill-runner', 'run', '-s', 'build']);
  commandRuns.push(resultPayload(
    'skill_runner_build_check',
    'npm --prefix services/skill-runner run -s build',
    skillRunnerBuildRun,
  ));

  const gmailPubsubRun = runNpm([
    '--prefix',
    'services/gateway-api',
    'run',
    'test',
    '--',
    'email-pubsub.e2e.test.js',
    '--runInBand',
  ]);
  commandRuns.push(resultPayload(
    'gmail_pubsub_runtime_test_check',
    'npm --prefix services/gateway-api run test -- email-pubsub.e2e.test.js --runInBand',
    gmailPubsubRun,
  ));

  checks.push({
    id: 'integration_runtime_lanes_pass',
    pass: commandRuns.every((runItem) => runItem.pass),
    detail: 'skill-runner build + email pubsub runtime test lane pass',
  });

  const skillRunnerSource = readUtf8('services/skill-runner/src/index.ts');
  checks.push({
    id: 'music_integrations_surface_present',
    pass: hasAll(skillRunnerSource, [
      "case 'spotify.search'",
      "case 'spotify.play'",
      "case 'spotify.pause'",
      "case 'spotify.queue'",
      "case 'sonos.list_households'",
      "case 'sonos.list_groups'",
      "case 'sonos.playback'",
      "case 'shazam.recognize'",
    ]),
    detail: 'Spotify/Sonos/Shazam integration handlers are implemented',
  });

  checks.push({
    id: 'productivity_integrations_surface_present',
    pass: hasAll(skillRunnerSource, [
      "case 'apple.notes.list'",
      "case 'apple.notes.create'",
      "case 'apple.notes.search'",
      "case 'apple.reminders.list'",
      "case 'apple.reminders.create'",
      "case 'apple.reminders.complete'",
      "case 'things3.list'",
      "case 'things3.create'",
      "case 'things3.complete'",
      "case 'notion.search'",
      "case 'notion.create_page'",
      "case 'notion.append_block_text'",
      "case 'obsidian.list_notes'",
      "case 'obsidian.read_note'",
      "case 'obsidian.write_note'",
      "case 'obsidian.search_notes'",
      "case 'bear.list_notes'",
      "case 'bear.create_note'",
      "case 'bear.search_notes'",
      "case 'trello.list_boards'",
      "case 'trello.list_cards'",
      "case 'trello.create_card'",
      "case 'trello.move_card'",
    ]),
    detail: 'Apple/Things/Notion/Obsidian/Bear/Trello handlers are implemented',
  });

  checks.push({
    id: 'social_security_media_utility_integrations_surface_present',
    pass: hasAll(skillRunnerSource, [
      "case 'x.post_tweet'",
      "case 'x.search_recent'",
      "case 'onepassword.list_items'",
      "case 'onepassword.get_item'",
      "case 'onepassword.read_field'",
      "case 'gif.search'",
      "case 'weather.current'",
      "case 'weather.forecast'",
    ]),
    detail: 'X, 1Password, GIF, and Weather integration handlers are implemented',
  });

  checks.push({
    id: 'screen_capture_surface_present',
    pass: hasAll(skillRunnerSource, [
      'image_base64',
      'MAX_DEVICE_RELAY_IMAGE_BASE64_LENGTH',
      'Snapshot image too large',
      '<img style="max-width:100vw;max-height:100vh;object-fit:contain;"',
    ]),
    detail: 'desktop/device snapshot capture relay surface is implemented',
  });

  const imageEmailMigrationSource = readUtf8('services/gateway-api/src/db/migrations/093_image_email_skill_tools.sql');
  const emailRouteSource = readUtf8('services/gateway-api/src/routes/email.ts');
  const gmailServiceSource = readUtf8('services/gateway-api/src/services/GmailService.ts');
  checks.push({
    id: 'image_generation_and_email_generic_surface_present',
    pass: hasAll(imageEmailMigrationSource, [
      'tool_image_generation',
      'image-generation',
      'openai',
      'stable_diffusion',
      'tool_email_generic',
      'email-generic',
      "ARRAY['email.send']",
    ]) && hasAll(emailRouteSource, [
      '/v1/email/push',
      'executeEmailHandler(',
      'gmail_pubsub',
    ]) && hasAll(gmailServiceSource, [
      '/gmail/v1/users/',
      'gmail.access_token',
      'gmail.access_token_ref',
    ]),
    detail: 'image-generation/email-generic tool registrations plus Gmail bridge runtime surfaces are present',
  });

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    mapped_openclaw_rows: [
      '12.1',
      '12.2',
      '12.3',
      '12.4',
      '12.5',
      '12.6',
      '12.7',
      '12.8',
      '12.9',
      '12.10',
      '12.11',
      '12.12',
      '12.13',
      '12.14',
      '12.15',
      '12.16',
      '12.17',
    ],
    checks,
    command_runs: commandRuns,
    source_files: [
      'services/skill-runner/src/index.ts',
      'services/gateway-api/src/db/migrations/093_image_email_skill_tools.sql',
      'services/gateway-api/src/routes/email.ts',
      'services/gateway-api/src/services/GmailService.ts',
    ],
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw Integrations Runtime Check',
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
  console.log(`openclaw-integrations-runtime-check: ${status}`);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

run();

