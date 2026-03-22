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
  const workflowExecutor = read('services/workflow-executor/src/index.ts');
  const skillRunner = read('services/skill-runner/src/index.ts');
  const approvalValidation = read('services/skill-runner/src/approval-validation.ts');
  const inProcessEgressPolicy = read('services/skill-runner/src/in-process-egress-policy.ts');
  const toolDispatchContract = read('services/gateway-api/src/__tests__/workflow-executor-tool-dispatch-contract.test.ts');
  const controlEnforcementContract = read('services/gateway-api/src/__tests__/workflow-executor-control-enforcement-contract.test.ts');
  const matrixSource = read('docs/parity/wave8-langgraph-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const packageSource = read('package.json');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'langgraph_w05_tool_node_validation_and_identity_present',
    workflowExecutor.includes('private async executeTool(') &&
      workflowExecutor.includes("throw new Error('workflow tool_call step requires tool_name');") &&
      workflowExecutor.includes("throw new Error('workflow tool_call step requires user identity');"),
    'tool_call nodes enforce required tool identity and caller identity before dispatch',
  );

  add(
    'langgraph_w05_tool_node_dispatch_and_terminal_wait_present',
    workflowExecutor.includes("this.nc.publish('tool.run.request'") &&
      workflowExecutor.includes('FROM tool_runs') &&
      workflowExecutor.includes("if (status === 'completed')") &&
      workflowExecutor.includes("if (status === 'error' || status === 'failed' || status === 'cancelled')"),
    'tool nodes dispatch through tool-run pipeline and fail-closed on non-completed terminal states',
  );

  add(
    'langgraph_w05_policy_scope_enforcement_present',
    approvalValidation.includes('approval scope mismatch') &&
      approvalValidation.includes('if (row.tool_name !== event.tool_name)') &&
      skillRunner.includes('No web domains are allowlisted') &&
      inProcessEgressPolicy.includes(
        'In-process execution is not permitted for web-scoped tools; use container/gvisor execution mode',
      ),
    'policy scope enforcement remains active via approval scope checks and tool runtime egress controls',
  );

  add(
    'langgraph_w05_contract_coverage_present',
    toolDispatchContract.includes("describe('workflow executor tool_call dispatch contract'") &&
      toolDispatchContract.includes('publishes tool.run.request and waits for real tool_runs status') &&
      controlEnforcementContract.includes("describe('workflow executor control enforcement contract'"),
    'tool node dispatch and control safety invariants are bound by contract suites',
  );

  add(
    'langgraph_w05_matrix_program_alias_binding_present',
    matrixSource.includes('| LG-W05 | Tool node execution guardrails with per-node policy scope | implemented |') &&
      matrixSource.includes('langgraph_parity_w05_tool_node_policy_contract') &&
      matrixSource.includes('langgraph-w05-tool-node-policy-latest') &&
      programSource.includes('LG-W05') &&
      packageSource.includes('"release:langgraph:w05:status"') &&
      packageSource.includes('"release:langgraph:w05:status:local"'),
    'Wave 8 matrix/program/npm bindings include LG-W05 strict evidence lane',
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
  const outJson = path.join(outDir, 'langgraph-w05-tool-node-policy-latest.json');
  const outMd = path.join(outDir, 'langgraph-w05-tool-node-policy-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LangGraph W05 Tool Node Policy Status',
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
