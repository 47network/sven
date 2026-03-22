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
  const policyEngineSource = read('services/agent-runtime/src/policy-engine.ts');
  const promptFirewallSource = read('services/agent-runtime/src/prompt-firewall.ts');
  const policyHardeningContract = read(
    'services/gateway-api/src/__tests__/agent-runtime-policy-hardening-w1283-w1287.contract.test.ts',
  );
  const llmAuditContract = read('services/gateway-api/src/__tests__/llm-audit.org-scope.test.ts');
  const contractSource = read(
    'services/gateway-api/src/__tests__/openhands-parity-w09-policy-audit-chain-contract.test.ts',
  );
  const matrixSource = read('docs/parity/wave1-openhands-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'openhands_w09_runtime_policy_chain_present',
    runtimeSource.includes('const firewallResult = await promptFirewall.validate(') &&
      runtimeSource.includes("logger.warn('Prompt firewall blocked tool call'") &&
      runtimeSource.includes('toolCall.blocked = true;') &&
      runtimeSource.includes('toolCall.block_reason = firewallResult.reason;') &&
      runtimeSource.includes('const decision = await policyEngine.evaluateToolCall({') &&
      runtimeSource.includes('if (decision.requires_approval) {') &&
      runtimeSource.includes('toolCall.pending_approval = true;') &&
      runtimeSource.includes('toolCall.approval_id = approvalId;') &&
      runtimeSource.includes('(tc: any) => !tc.blocked && !tc.pending_approval'),
    'runtime enforces prompt-firewall + policy-eval + approval-gated fail-closed execution chain',
  );

  add(
    'openhands_w09_runtime_auditability_present',
    runtimeSource.includes('await recordLlmAudit(') &&
      runtimeSource.includes('if (incidentMode === \'forensics\') {') &&
      runtimeSource.includes('approval_id: toolCall.approval_id') &&
      runtimeSource.includes('text: `Voice shortcut blocked by policy: ${decision.reason || \'not allowed\'}.`') &&
      runtimeSource.includes('INSERT INTO llm_audit_log'),
    'runtime records LLM audit rows and preserves approval/policy outcomes in the execution/audit path',
  );

  add(
    'openhands_w09_policy_engine_and_firewall_guardrails_present',
    policyEngineSource.includes('deny-by-default') &&
      policyEngineSource.includes('No explicit allow rule found (deny-by-default)') &&
      policyEngineSource.includes('allowed: false') &&
      promptFirewallSource.includes('Tool calls must be authorized by user requests; RAG citations are supportive only') &&
      promptFirewallSource.includes('Tool call user_message_ids failed provenance verification for this chat/user context'),
    'policy engine and prompt firewall remain deny-by-default with strict provenance checks',
  );

  add(
    'openhands_w09_contract_and_audit_tests_present',
    policyHardeningContract.includes('agent-runtime policy hardening waves 1283-1287 contract') &&
      llmAuditContract.includes('llm audit org scope') &&
      llmAuditContract.includes('c.organization_id = $1') &&
      contractSource.includes('OpenHands W09 runtime policy+audit parity contract') &&
      contractSource.includes("'openhands_w09_runtime_policy_chain_present'"),
    'policy/audit behavior is anchored by hardening + llm-audit contracts and dedicated W09 parity contract',
  );

  add(
    'openhands_w09_matrix_binding_present',
    matrixSource.includes('| OH-W09 | Runtime policy enforcement + auditability for every action | implemented |') &&
      matrixSource.includes('strict artifact lane validates runtime prompt-firewall/policy chain') &&
      matrixSource.includes('openhands_parity_w09_policy_audit_chain') &&
      matrixSource.includes('openhands-w09-policy-audit-latest'),
    'Wave 1 matrix binds OH-W09 to dedicated parity gate and artifact',
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
  const outJson = path.join(outDir, 'openhands-w09-policy-audit-latest.json');
  const outMd = path.join(outDir, 'openhands-w09-policy-audit-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenHands W09 Policy + Audit Status',
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
