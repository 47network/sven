#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function run() {
  const commandSource = read('services/agent-runtime/src/chat-commands.ts');
  const runtimeTestSource = read('services/agent-runtime/src/__tests__/handoff-continuation-command.test.ts');
  const matrixSource = read('docs/parity/wave2-librechat-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'librechat_w09_handoff_command_surface_present',
    commandSource.includes('${parsed.prefix}handoff <target> [note...]') &&
      commandSource.includes('Usage: ${parsed.prefix}handoff <target> [note...]') &&
      commandSource.includes('Handoff pushed to ${targetDevice.name}.'),
    'handoff command surface and usage path are present',
  );

  add(
    'librechat_w09_continuity_payload_builder_present',
    commandSource.includes('buildChatHandoffContinuity') &&
      commandSource.includes('ORDER BY created_at DESC') &&
      commandSource.includes('LIMIT 6') &&
      commandSource.includes('Chat: ${chatId}') &&
      commandSource.includes('Session handoff context from mobile chat.'),
    'continuity payload is synthesized from in-thread recent context',
  );

  add(
    'librechat_w09_runtime_test_coverage_present',
    runtimeTestSource.includes('preserves chat thread identity in confirmation') &&
      runtimeTestSource.includes('fails closed when chat is not bound to an organization'),
    'runtime tests cover continuation confirmation + fail-closed org checks',
  );

  add(
    'librechat_w09_matrix_binding_present',
    matrixSource.includes('| LC-W09 | Agent handoff and continuation in same thread | implemented |') &&
      matrixSource.includes('librechat_parity_w09_handoff_continuation_contract'),
    'Wave 2 matrix binds LC-W09 to contract test and evidence ID',
  );

  const passed = checks.filter((check) => check.pass).length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : 'fail';
  const generatedAt = new Date().toISOString();

  const report = {
    generated_at: generatedAt,
    status,
    passed,
    failed,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'librechat-w09-handoff-continuation-latest.json');
  const outMd = path.join(outDir, 'librechat-w09-handoff-continuation-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LibreChat W09 Handoff Continuation Status',
      '',
      `Generated: ${generatedAt}`,
      `Status: ${status}`,
      `Passed: ${passed}`,
      `Failed: ${failed}`,
      '',
      '## Checks',
      ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(JSON.stringify(report, null, 2));
  if (strict && status !== 'pass') process.exit(2);
}

run();

