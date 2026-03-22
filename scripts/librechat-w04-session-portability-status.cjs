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
  const runtimeTestSource = read('services/agent-runtime/src/__tests__/session-portability-command.test.ts');
  const matrixSource = read('docs/parity/wave2-librechat-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'librechat_w04_session_command_surface_present',
    commandSource.includes('${parsed.prefix}session [status|export [limit]|import-base64 <payload>]') &&
      commandSource.includes('Usage: ${parsed.prefix}session status | ${parsed.prefix}session export [limit] | ${parsed.prefix}session import-base64 <payload>') &&
      commandSource.includes('Import command: /session import-base64 <payload>'),
    'session command surface exposes status/export/import continuity flow',
  );

  add(
    'librechat_w04_export_payload_channels_present',
    commandSource.includes('Session import payload (base64):') &&
      commandSource.includes('export JSON was truncated for channel size safety.') &&
      commandSource.includes('emitSessionExport'),
    'session export emits JSON + base64 payload channels with truncation guard messaging',
  );

  add(
    'librechat_w04_import_decode_guard_present',
    commandSource.includes('decodeSessionImportPayload') &&
      commandSource.includes('payload is not valid base64.') &&
      commandSource.includes('decoded payload is not valid JSON.'),
    'import path enforces decode/parse guards before write operations',
  );

  add(
    'librechat_w04_bounded_import_guard_present',
    commandSource.includes('.slice(0, 200)') &&
      commandSource.includes("const allowedRoles = new Set(['user', 'assistant', 'system', 'tool']);"),
    'import path bounds message volume and role allowlist',
  );

  add(
    'librechat_w04_runtime_test_coverage_present',
    runtimeTestSource.includes('exports session JSON and emits base64 import payload hint') &&
      runtimeTestSource.includes('imports base64 session payload into current chat and applies settings'),
    'runtime tests cover export and import continuity flows',
  );

  add(
    'librechat_w04_matrix_binding_present',
    matrixSource.includes('| LC-W04 | Session export/import continuity workflow | implemented |') &&
      matrixSource.includes('librechat_parity_w04_session_portability_contract'),
    'Wave 2 matrix binds LC-W04 to contract test and evidence ID',
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
  const outJson = path.join(outDir, 'librechat-w04-session-portability-latest.json');
  const outMd = path.join(outDir, 'librechat-w04-session-portability-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LibreChat W04 Session Portability Status',
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
