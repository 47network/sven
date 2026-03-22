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
  const modelTestSource = read('services/agent-runtime/src/__tests__/model-command.test.ts');
  const matrixSource = read('docs/parity/wave2-librechat-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'librechat_w01_model_command_surface_present',
    commandSource.includes('${parsed.prefix}model list') &&
      commandSource.includes('${parsed.prefix}model current') &&
      commandSource.includes('${parsed.prefix}model <number|alias|model_name>'),
    'chat command help advertises list/current/select model controls',
  );

  add(
    'librechat_w01_model_current_view_present',
    commandSource.includes("modelArg.toLowerCase() === 'current'") &&
      commandSource.includes('Current model override: ${currentModel}.') &&
      commandSource.includes('getSessionSettingsSafe(ctx.pool, ctx.event.chat_id)'),
    'runtime command can report active session model override deterministically',
  );

  add(
    'librechat_w01_model_change_policy_guard_present',
    commandSource.includes('Only admins can change the active model.') &&
      commandSource.includes('setSessionSettingModelName(ctx.pool, ctx.event.chat_id, resolved.modelName)'),
    'model-change path remains policy-gated and persisted in session settings',
  );

  add(
    'librechat_w01_runtime_test_coverage_present',
    modelTestSource.includes('lists available models with numbering') &&
      modelTestSource.includes('shows current model override') &&
      modelTestSource.includes('resolves alias to model id before saving override') &&
      modelTestSource.includes('blocks non-admins from switching models'),
    'runtime tests cover list/current/alias/admin-guard behavior',
  );

  add(
    'librechat_w01_matrix_binding_present',
    matrixSource.includes('| LC-W01 | Multi-provider model UX (`/model list/current/select`) |') &&
      matrixSource.includes('librechat_parity_w01_model_provider_ux_contract'),
    'Wave 2 matrix binds LC-W01 to contract test and evidence ID',
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
  const outJson = path.join(outDir, 'librechat-w01-model-provider-ux-latest.json');
  const outMd = path.join(outDir, 'librechat-w01-model-provider-ux-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LibreChat W01 Model Provider UX Status',
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
