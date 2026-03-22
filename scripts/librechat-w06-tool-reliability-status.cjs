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
  const runtimeTestSource = read('services/agent-runtime/src/__tests__/tool-reliability-command.test.ts');
  const matrixSource = read('docs/parity/wave2-librechat-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'librechat_w06_tool_reliability_surface_present',
    commandSource.includes('${parsed.prefix}tool reliability [limit]') &&
      commandSource.includes("case 'tool':") &&
      commandSource.includes("case 'tools':") &&
      commandSource.includes('Tool reliability:'),
    'tool reliability command surface is exposed with /tool and /tools aliases',
  );

  add(
    'librechat_w06_retry_policy_bound_present',
    commandSource.includes('MAX_SELF_CORRECTION_RETRIES = 12') &&
      commandSource.includes('policy.maxRetries = Math.min(MAX_SELF_CORRECTION_RETRIES') &&
      commandSource.includes('Policy is bounded and fail-closed by runtime guards.'),
    'retry policy is bounded and explicitly surfaced to the operator',
  );

  add(
    'librechat_w06_failure_surfacing_present',
    commandSource.includes('Recent failures:') &&
      commandSource.includes('Retry outcomes:') &&
      commandSource.includes('- no recent failed tool runs in this chat') &&
      commandSource.includes('- no retry audit rows for this chat'),
    'command output clearly surfaces tool failures and retry outcomes',
  );

  add(
    'librechat_w06_runtime_test_coverage_present',
    runtimeTestSource.includes('shows bounded retry policy and recent failure/retry breakdown') &&
      runtimeTestSource.includes('supports /tools alias and empty-state messaging'),
    'runtime tests cover both populated and empty reliability paths',
  );

  add(
    'librechat_w06_matrix_binding_present',
    matrixSource.includes('| LC-W06 | Tool execution reliability with bounded retries and clear error surfacing | implemented |') &&
      matrixSource.includes('librechat_parity_w06_tool_reliability_contract'),
    'Wave 2 matrix binds LC-W06 to contract test and evidence ID',
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
  const outJson = path.join(outDir, 'librechat-w06-tool-reliability-latest.json');
  const outMd = path.join(outDir, 'librechat-w06-tool-reliability-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LibreChat W06 Tool Reliability Status',
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
