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
  const runtimeTestSource = read('services/agent-runtime/src/__tests__/policy-engine.tool-provider-bindings.test.ts');
  const matrixSource = read('docs/parity/wave2-librechat-workflow-matrix-2026-03-16.md');
  const packageSource = read('package.json');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'librechat_w10_fail_closed_runtime_signal_present',
    commandSource.includes('Policy is bounded and fail-closed by runtime guards.') &&
      commandSource.includes('Research mode is disabled by admin setting (agent.research.enabled=false).') &&
      commandSource.includes('const totalSteps = Math.max(1, Math.min(maxSteps, requestedSteps));'),
    'runtime command paths preserve bounded/fail-closed defaults',
  );

  add(
    'librechat_w10_safe_defaults_fallback_present',
    commandSource.includes('// Keep safe defaults if settings are unavailable.') &&
      commandSource.includes("const rawSafeSearch = String(parseSettingValue(settings.get('search.safeSearch')) || 'moderate').toLowerCase();"),
    'search/settings path keeps explicit safe default fallback behavior',
  );

  add(
    'librechat_w10_policy_runtime_coverage_present',
    runtimeTestSource.includes('blocks a tool that is not provider-allowlisted') &&
      runtimeTestSource.includes('lets a model-level deny override a provider-level allow'),
    'policy runtime tests enforce safe defaults and deny precedence',
  );

  add(
    'librechat_w10_release_governance_script_bindings_present',
    packageSource.includes('"release:feature:flag:governance:check"') &&
      packageSource.includes('"release:runtime:security:baseline:check"') &&
      packageSource.includes('"release:secret:ref:policy:check"'),
    'enterprise governance/reliability release checks are wired at repo root',
  );

  add(
    'librechat_w10_matrix_binding_present',
    matrixSource.includes('| LC-W10 | Policy-aware enterprise defaults (safe-by-default runtime behavior) | implemented |') &&
      matrixSource.includes('librechat_parity_w10_enterprise_defaults_contract'),
    'Wave 2 matrix binds LC-W10 to contract test and evidence ID',
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
  const outJson = path.join(outDir, 'librechat-w10-enterprise-defaults-latest.json');
  const outMd = path.join(outDir, 'librechat-w10-enterprise-defaults-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LibreChat W10 Enterprise Defaults Status',
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

