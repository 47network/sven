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
  const selfCorrection = read('services/agent-runtime/src/self-correction.ts');
  const subagentConfig = read('services/agent-runtime/src/subagent-config.ts');
  const runtimeIndex = read('services/agent-runtime/src/index.ts');
  const retryPolicyContract = read('services/gateway-api/src/__tests__/workflow-executor-step-retry-policy-contract.test.ts');
  const controlEnforcementContract = read('services/gateway-api/src/__tests__/workflow-executor-control-enforcement-contract.test.ts');
  const policyHardeningContract = read('services/gateway-api/src/__tests__/agent-runtime-policy-hardening-w1283-w1287.contract.test.ts');
  const selfCorrectionHardeningContract = read('services/gateway-api/src/__tests__/agent-runtime-policy-selfcorrection-hardening-w1313-w1317.contract.test.ts');
  const matrixSource = read('docs/parity/wave4-framework-absorption-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'framework_w06_workflow_retry_bounds_present',
    workflowExecutor.includes('type StepRetryPolicy = {') &&
      workflowExecutor.includes('resolveStepRetryPolicy(') &&
      workflowExecutor.includes('computeStepRetryDelayMs(') &&
      workflowExecutor.includes('while (attempt <= retryPolicy.maxRetries + 1)') &&
      workflowExecutor.includes('retry_delay_ms = $2') &&
      workflowExecutor.includes('next_retry_at = $3'),
    'workflow executor enforces bounded retries/backoff with persisted retry telemetry',
  );

  add(
    'framework_w06_stop_semantics_present',
    workflowExecutor.includes('private async waitForRunRunnable(run_id: string): Promise<\'running\' | \'cancelled\' | \'missing\'>') &&
      workflowExecutor.includes("if (controlState === 'cancelled') {") &&
      workflowExecutor.includes('await this.markRunCancelled(run_id);') &&
      workflowExecutor.includes("throw new WorkflowRunControlError('RUN_CANCELLED'"),
    'autonomous execution loop checks control state and stops on cancel/terminal conditions',
  );

  add(
    'framework_w06_policy_scope_fail_closed_present',
    subagentConfig.includes('policy_scope?: string[]; // undefined => no restriction configured, [] => explicit deny-all') &&
      subagentConfig.includes('if (allowedScopes === undefined) return true;') &&
      subagentConfig.includes('if (allowedScopes.length === 0) return false;') &&
      runtimeIndex.includes('if (!isScopeAllowedForSubagent(toolCall.scope, agentConfig?.policy_scope)) {'),
    'subagent policy scope is fail-closed and enforced on routed tool execution',
  );

  add(
    'framework_w06_self_correction_safety_bounds_present',
    selfCorrection.includes('const MAX_SELF_CORRECTION_RETRIES = 12;') &&
      selfCorrection.includes('const MIN_RETRY_DELAY_MS = 50;') &&
      selfCorrection.includes('const MAX_RETRY_DELAY_MS = 30_000;') &&
      selfCorrection.includes('if (attemptNumber > this.config.requireApprovalAfter) {') &&
      selfCorrection.includes('const budgetOk = await this.checkBudget(originalCall.user_id);') &&
      selfCorrection.includes('Strategy retry fan-out capped for attempt'),
    'self-correction loop applies retry/backoff bounds, approval threshold, budget guard, and fan-out cap',
  );

  add(
    'framework_w06_contract_suite_bound',
    retryPolicyContract.includes("describe('workflow executor step retry policy contract'") &&
      controlEnforcementContract.includes("describe('workflow executor control enforcement contract'") &&
      policyHardeningContract.includes("describe('agent-runtime policy hardening waves 1283-1287 contract'") &&
      selfCorrectionHardeningContract.includes("describe('agent-runtime policy/self-correction hardening waves 1313-1317 contract'"),
    'autonomous loop safety envelope is anchored by retry/control/policy hardening contracts',
  );

  add(
    'framework_w06_matrix_binding_present',
    matrixSource.includes('| FW-W06 | Autonomous loop safety envelope (policy scope + bounded retries + stop semantics) | implemented |') &&
      matrixSource.includes('framework_parity_w06_autonomous_loop_safety_contract'),
    'Wave 4 matrix binds FW-W06 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'framework-w06-autonomous-loop-safety-latest.json');
  const outMd = path.join(outDir, 'framework-w06-autonomous-loop-safety-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Framework W06 Autonomous Loop Safety Status',
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
