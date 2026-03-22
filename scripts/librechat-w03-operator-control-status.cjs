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
  const runtimeTestSource = read('services/agent-runtime/src/__tests__/operator-command.test.ts');
  const matrixSource = read('docs/parity/wave2-librechat-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'librechat_w03_operator_command_surface_present',
    commandSource.includes("case 'operator':") &&
      commandSource.includes('${parsed.prefix}operator status') &&
      commandSource.includes('Operator controls:') &&
      commandSource.includes('Admin-gated commands:'),
    'operator command lane is exposed with explicit status summary',
  );

  add(
    'librechat_w03_admin_gate_strings_present',
    commandSource.includes('Only admins can change the active model.') &&
      commandSource.includes('Only admins can install or manage skills.') &&
      commandSource.includes('Only admins can toggle self-chat mode.') &&
      commandSource.includes('Only admins can message subagents.') &&
      commandSource.includes('Only admins can steer subagents.') &&
      commandSource.includes('Only admins can kill subagents.') &&
      commandSource.includes('Only admins can toggle elevated mode.'),
    'existing admin gates remain explicit for sensitive operations',
  );

  add(
    'librechat_w03_operator_runtime_test_coverage_present',
    runtimeTestSource.includes('shows admin operator controls when user is admin') &&
      runtimeTestSource.includes('shows blocked operator controls for non-admin users'),
    'runtime tests cover both admin and non-admin operator status views',
  );

  add(
    'librechat_w03_matrix_binding_present',
    matrixSource.includes('| LC-W03 | Role/operator controls over model switching and admin actions | implemented |') &&
      matrixSource.includes('librechat_parity_w03_operator_control_contract'),
    'Wave 2 matrix binds LC-W03 to contract test and evidence ID',
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
  const outJson = path.join(outDir, 'librechat-w03-operator-control-latest.json');
  const outMd = path.join(outDir, 'librechat-w03-operator-control-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LibreChat W03 Operator Control Status',
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
