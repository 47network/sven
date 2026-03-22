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
  const contractSource = read('services/agent-runtime/src/__tests__/chat-commands-workflow-dispatch-contract.test.ts');
  const matrixSource = read('docs/parity/wave1-openhands-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'openhands_w02_issuefix_command_present',
    commandSource.includes("if (sub === 'issuefix')") &&
      commandSource.includes('Usage: ${parsed.prefix}prose issuefix <issue summary>') &&
      commandSource.includes('Issue-fix run queued: ${run.runId}'),
    'chat command exposes issuefix lane and emits queued run summary',
  );

  add(
    'openhands_w02_issue_to_patch_workflow_shape_present',
    commandSource.includes('compileIssueFixProgram(issueSummary)') &&
      commandSource.includes("id: 'issue_triage'") &&
      commandSource.includes("id: 'patch_apply'") &&
      commandSource.includes("id: 'test_run'") &&
      commandSource.includes("id: 'patch_summary'") &&
      commandSource.includes("lane: 'OH-W02'"),
    'compiled workflow includes issue->patch->tests->summary shape with OH-W02 lane metadata',
  );

  add(
    'openhands_w02_deterministic_trace_present',
    commandSource.includes("traceSteps: ['issue_received', 'workflow_compiled', 'run_dispatched']") &&
      commandSource.includes("kind: 'issue', action: 'triage_issue'") &&
      commandSource.includes("kind: 'patch', action: 'prepare_patch'") &&
      commandSource.includes("kind: 'tests', action: 'execute_tests'") &&
      commandSource.includes("kind: 'summary', action: 'emit_patch_summary'"),
    'deterministic OH-W02 trace + plan steps are persisted',
  );

  add(
    'openhands_w02_contract_test_coverage',
    contractSource.includes('/prose issuefix compiles deterministic issue->patch->tests->summary workflow and dispatches run') &&
      contractSource.includes("inputVariables?.openhands_w02?.lane).toBe('OH-W02'"),
    'contract test verifies compiled workflow structure and W02 payload',
  );

  add(
    'openhands_w02_matrix_binding_present',
    matrixSource.includes('| OH-W02 | Repository issue -> code patch -> tests -> patch summary |') &&
      matrixSource.includes('openhands_parity_w02_issue_to_patch_e2e'),
    'Wave 1 matrix keeps W02 binding to evidence id',
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
  const outJson = path.join(outDir, 'openhands-w02-issue-to-patch-latest.json');
  const outMd = path.join(outDir, 'openhands-w02-issue-to-patch-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenHands W02 Issue-to-Patch Status',
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
