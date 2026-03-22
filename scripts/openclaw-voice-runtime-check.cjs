#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-voice-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-voice-runtime-latest.md');

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

  const voiceRuntimeRun = runNpm([
    '--prefix',
    'services/gateway-api',
    'run',
    'test',
    '--',
    'voice-continuous-conversation.e2e.ts',
    'voice-call-integration.test.ts',
    'voice-speaker-identification.e2e.ts',
    'voice-shortcuts.test.ts',
    'voice-multilanguage.test.ts',
    'voice-emotion-detection.test.ts',
    'tts-cloud-fallback.e2e.test.js',
    '--runInBand',
  ]);
  commandRuns.push(resultPayload(
    'voice_runtime_tests_check',
    'npm --prefix services/gateway-api run test -- voice-continuous-conversation.e2e.ts voice-call-integration.test.ts voice-speaker-identification.e2e.ts voice-shortcuts.test.ts voice-multilanguage.test.ts voice-emotion-detection.test.ts tts-cloud-fallback.e2e.test.js --runInBand',
    voiceRuntimeRun,
  ));

  checks.push({
    id: 'voice_runtime_tests_pass',
    pass: commandRuns.find((runItem) => runItem.id === 'voice_runtime_tests_check')?.pass === true,
    detail: 'Voice runtime tests pass (continuous sessions, call integration, speaker identity, shortcuts, multilingual, emotion, TTS fallback)',
  });

  const composeSource = readUtf8('docker-compose.yml');
  checks.push({
    id: 'voice_services_present_in_compose',
    pass: hasAll(composeSource, ['faster-whisper:', 'piper:', 'wake-word:']),
    detail: 'Compose declares STT/TTS/wake-word service stack',
  });

  const canvasSource = readUtf8('services/gateway-api/src/routes/canvas.ts');
  checks.push({
    id: 'gateway_voice_routes_present',
    pass: hasAll(canvasSource, [
      "/voice/continuous/start",
      "/voice/continuous/status",
      "/voice/continuous/stop",
      "/v1/chats/:chatId/wake-word",
      "fetch(`${wakeWordUrl}/v1/wake-word/detection`",
      '/voice/speakers',
      'voice.emotionDetection.enabled',
    ]),
    detail: 'Gateway exposes wake-word, continuous conversation, speaker identity, and emotion-aware voice routes',
  });

  const piperSource = readUtf8('services/piper/src/index.ts');
  checks.push({
    id: 'tts_provider_fallback_surface_present',
    pass: hasAll(piperSource, [
      'VOICE_TTS_PROVIDER',
      'ELEVENLABS_API_KEY',
      'synthesizeElevenLabs',
      "type TtsProvider = 'piper' | 'elevenlabs' | 'openai'",
    ]),
    detail: 'TTS provider selection includes ElevenLabs/OpenAI/Piper with fallback path',
  });

  const migrationsSource = [
    'services/gateway-api/src/db/migrations/127_voice_continuous_conversation.sql',
    'services/gateway-api/src/db/migrations/128_voice_speaker_identification.sql',
    'services/gateway-api/src/db/migrations/129_voice_emotion_detection.sql',
    'services/gateway-api/src/db/migrations/130_voice_multilanguage_settings.sql',
    'services/gateway-api/src/db/migrations/132_voice_call_integration.sql',
  ].map((relPath) => ({ relPath, source: readUtf8(relPath) }));
  checks.push({
    id: 'voice_migration_contract_surface_present',
    pass: migrationsSource.every((entry) => entry.source.length > 0),
    detail: 'Voice migration surfaces exist for continuous mode, speaker ID, emotion, multilingual, and call integration',
  });

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    mapped_openclaw_rows: ['3.1', '3.2', '3.3', '3.4', '3.5'],
    checks,
    command_runs: commandRuns,
    source_files: [
      'docker-compose.yml',
      'services/gateway-api/src/routes/canvas.ts',
      'services/piper/src/index.ts',
      'services/gateway-api/src/__tests__/voice-continuous-conversation.e2e.ts',
      'services/gateway-api/src/__tests__/voice-call-integration.test.ts',
      'services/gateway-api/src/__tests__/voice-speaker-identification.e2e.ts',
      'services/gateway-api/src/__tests__/voice-shortcuts.test.ts',
      'services/gateway-api/src/__tests__/voice-multilanguage.test.ts',
      'services/gateway-api/src/__tests__/voice-emotion-detection.test.ts',
      'services/gateway-api/src/__tests__/tts-cloud-fallback.e2e.test.js',
      'services/gateway-api/src/db/migrations/127_voice_continuous_conversation.sql',
      'services/gateway-api/src/db/migrations/128_voice_speaker_identification.sql',
      'services/gateway-api/src/db/migrations/129_voice_emotion_detection.sql',
      'services/gateway-api/src/db/migrations/130_voice_multilanguage_settings.sql',
      'services/gateway-api/src/db/migrations/132_voice_call_integration.sql',
    ],
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw Voice Runtime Check',
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
  console.log(`openclaw-voice-runtime-check: ${status}`);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

run();
