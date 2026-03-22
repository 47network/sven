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
  const runtimeSource = read('services/agent-runtime/src/index.ts');
  const contractSource = read(
    'services/gateway-api/src/__tests__/openhands-parity-w05-clarification-gate-contract.test.ts',
  );
  const matrixSource = read('docs/parity/wave1-openhands-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'openhands_w05_ambiguity_guardrail_prompt_present',
    runtimeSource.includes('If the request is ambiguous, ask a brief clarifying question before taking action.'),
    'runtime system prompt includes explicit clarification-first instruction',
  );

  add(
    'openhands_w05_prompt_gated_by_proactivity_context',
    runtimeSource.includes('if (buddyEnabled && isProactivityEnabled(buddySettings.proactivity))') &&
      runtimeSource.includes('let systemPrompt = context.systemPrompt;'),
    'clarification guardrail is injected only in proactivity-capable buddy context',
  );

  add(
    'openhands_w05_contract_test_coverage',
    contractSource.includes('OpenHands W05 clarification-first parity contract') &&
      contractSource.includes("'openhands_w05_ambiguity_guardrail_prompt_present'") &&
      contractSource.includes('openhands-w05-clarification-latest.json'),
    'contract test asserts W05 runtime anchor and status artifact production',
  );

  add(
    'openhands_w05_matrix_binding_present',
    matrixSource.includes('| OH-W05 | Clarification-first behavior on ambiguous requests | implemented |') &&
      matrixSource.includes('openhands_parity_w05_clarification_gate') &&
      matrixSource.includes('openhands-w05-clarification-latest'),
    'Wave 1 matrix binds OH-W05 to dedicated parity gate and artifact',
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
  const outJson = path.join(outDir, 'openhands-w05-clarification-latest.json');
  const outMd = path.join(outDir, 'openhands-w05-clarification-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenHands W05 Clarification Status',
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
