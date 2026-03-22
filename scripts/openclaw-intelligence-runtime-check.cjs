#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-intelligence-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-intelligence-runtime-latest.md');

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

  const gatewayIntelligenceRun = runNpm([
    '--prefix',
    'services/gateway-api',
    'run',
    'test',
    '--',
    'memory-retrieval.unit.test.ts',
    'memory-advanced.e2e.ts',
    'session-memory-indexing.e2e.ts',
    'rag-temporal.e2e.ts',
    'context-window-optimization.test.ts',
    'sessions.e2e.ts',
    '--runInBand',
  ]);
  commandRuns.push(resultPayload(
    'gateway_intelligence_runtime_tests_check',
    'npm --prefix services/gateway-api run test -- memory-retrieval.unit.test.ts memory-advanced.e2e.ts session-memory-indexing.e2e.ts rag-temporal.e2e.ts context-window-optimization.test.ts sessions.e2e.ts --runInBand',
    gatewayIntelligenceRun,
  ));

  const agentIntelligenceRun = runNpm([
    '--prefix',
    'services/agent-runtime',
    'run',
    'test',
    '--',
    'think-level.test.ts',
    'model-command.test.ts',
    'project-tree-context.test.ts',
    '--runInBand',
  ]);
  commandRuns.push(resultPayload(
    'agent_intelligence_runtime_tests_check',
    'npm --prefix services/agent-runtime run test -- think-level.test.ts model-command.test.ts project-tree-context.test.ts --runInBand',
    agentIntelligenceRun,
  ));

  checks.push({
    id: 'intelligence_runtime_tests_pass',
    pass:
      commandRuns.find((runItem) => runItem.id === 'gateway_intelligence_runtime_tests_check')?.pass === true
      && commandRuns.find((runItem) => runItem.id === 'agent_intelligence_runtime_tests_check')?.pass === true,
    detail: 'Memory/RAG/session-indexing/context-window tests and think/model/project-context tests pass',
  });

  const memoryStoreSource = readUtf8('services/gateway-api/src/services/MemoryStore.ts');
  checks.push({
    id: 'memory_scoring_surface_present',
    pass: hasAll(memoryStoreSource, [
      'temporal_decay',
      'decay_factor',
      'mmr_lambda',
      'applyMMR(',
      'applyTemporalDecay(',
    ]),
    detail: 'Memory store includes temporal decay + MMR retrieval controls',
  });

  const ragSource = readUtf8('services/gateway-api/src/routes/admin/rag.ts');
  checks.push({
    id: 'rag_hybrid_surface_present',
    pass: hasAll(ragSource, [
      '/sven_chunks/_search',
      'scores: {',
      'bm25',
      'vector',
      'vectorScore',
    ]),
    detail: 'RAG route includes BM25 + vector hybrid retrieval scoring',
  });

  const runtimeIndexSource = readUtf8('services/agent-runtime/src/index.ts');
  checks.push({
    id: 'agent_runtime_context_compaction_surface_present',
    pass: hasAll(runtimeIndexSource, [
      'Load context (chat history, memory, identity doc)',
      'FROM sven_identity_docs',
      'maybeAutoCompactSession(',
      'chat.compaction.threshold_pct',
      'maybeIndexSessionTranscript(',
      'model_override',
      'profile_override',
      'think_level',
    ]),
    detail: 'Agent runtime includes identity-doc context injection, compaction gates, transcript indexing, and model/profile/think overrides',
  });

  const chatCommandsSource = readUtf8('services/agent-runtime/src/chat-commands.ts');
  checks.push({
    id: 'chat_model_alias_and_session_settings_surface_present',
    pass: hasAll(chatCommandsSource, [
      "'gpt-mini':",
      "'gemini-flash':",
      'setSessionSettingThinkLevel',
      "case 'model'",
      "case 'context'",
    ]),
    detail: 'Chat command surface includes model aliases and think/context session controls',
  });

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    mapped_openclaw_rows: [
      '6.3',
      '6.4',
      '6.5',
      '6.6',
      '6.7',
      '6.8',
      '6.9',
      '6.10',
      '6.11',
      '6.12',
      '6.13',
      '6.14',
      '6.15',
      '6.16',
    ],
    checks,
    command_runs: commandRuns,
    source_files: [
      'services/gateway-api/src/services/MemoryStore.ts',
      'services/gateway-api/src/routes/admin/rag.ts',
      'services/agent-runtime/src/index.ts',
      'services/agent-runtime/src/chat-commands.ts',
    ],
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw Intelligence Runtime Check',
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
  console.log(`openclaw-intelligence-runtime-check: ${status}`);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

run();
