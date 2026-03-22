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
  const agentsRoute = read('services/gateway-api/src/routes/admin/agents.ts');
  const runtimeConfig = read('services/agent-runtime/src/subagent-config.ts');
  const runtimeIndex = read('services/agent-runtime/src/index.ts');
  const supervisorValidation = read('services/gateway-api/src/__tests__/agents-supervisor.validation.test.ts');
  const agentsE2e = read('services/gateway-api/src/__tests__/agents.e2e.ts');
  const mutationValidation = read('services/gateway-api/src/__tests__/admin-agents-mutation-validation-contract.test.ts');
  const subagentTests = read('services/agent-runtime/src/__tests__/subagent-config.test.ts');
  const contractSource = read('services/gateway-api/src/__tests__/crewai-parity-w05-specialist-tools-contract.test.ts');
  const matrixSource = read('docs/parity/wave5-crewai-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'crewai_w05_specialist_selection_surface_present',
    agentsRoute.includes("app.post('/agents/supervisor/orchestrate', {") &&
      agentsRoute.includes("required: ['supervisor_agent_id', 'session_id', 'task']") &&
      agentsRoute.includes('required_capabilities: {') &&
      agentsRoute.includes('const requiredCapabilitiesValidation = validateRequiredCapabilitiesPayload(body.required_capabilities);') &&
      agentsRoute.includes('const capabilities = parseAgentCapabilities(row);') &&
      agentsRoute.includes('requiredCapabilities.filter((cap) => capabilities.includes(cap)).length;') &&
      agentsRoute.includes("message: 'No eligible sub-agents matched required capabilities'"),
    'supervisor route performs specialist-agent selection using validated required capability constraints',
  );

  add(
    'crewai_w05_guardrail_policy_envelope_present',
    runtimeConfig.includes('const ownPolicyScope = toStringArray(routingRules.policy_scope);') &&
      runtimeConfig.includes('const mergedScope = mergePolicyScopes(parentPolicy, ownScope);') &&
      runtimeConfig.includes('policy_scope: hasExplicitPolicyScope ? mergedScope : undefined,') &&
      runtimeConfig.includes('if (allowedScopes.length === 0) return false;') &&
      runtimeIndex.includes('if (!isScopeAllowedForSubagent(toolCall.scope, agentConfig?.policy_scope)) {') &&
      runtimeIndex.includes('Subagent policy scope denied'),
    'worker tool execution is constrained by inherited per-role policy scope and enforced fail-closed at runtime',
  );

  add(
    'crewai_w05_specialist_execution_audit_present',
    agentsRoute.includes('INSERT INTO inter_agent_messages') &&
      agentsRoute.includes("'responded', $6, $7, NOW(), NOW(), NOW()") &&
      agentsRoute.includes('orchestrated: true,') &&
      agentsRoute.includes('required_capabilities: requiredCapabilities,') &&
      agentsRoute.includes('capability_score: candidate.capability_score,') &&
      agentsRoute.includes("control_flags: flags,"),
    'specialist delegation and message exchange persist capability-aware control flags for auditability',
  );

  add(
    'crewai_w05_runtime_and_contract_coverage_present',
    supervisorValidation.includes("describe('supervisor orchestrate validation'") &&
      supervisorValidation.includes('clamps max_agents to upper bound and limits assignments') &&
      agentsE2e.includes("'/v1/admin/agents/supervisor/orchestrate'") &&
      agentsE2e.includes("required_capabilities: ['calendar', 'email']") &&
      mutationValidation.includes('function validateRequiredCapabilitiesPayload') &&
      subagentTests.includes('integration: subordinate inherits parent config and applies explicit overrides') &&
      contractSource.includes('CrewAI W05 specialist tools guardrails parity contract') &&
      contractSource.includes("'crewai_w05_specialist_selection_surface_present'"),
    'specialist selection and guardrail behavior are anchored by validation/e2e/runtime tests and dedicated parity contract',
  );

  add(
    'crewai_w05_matrix_binding_present',
    matrixSource.includes('| CW-W05 | Tool-using specialist agents with per-role guardrails | implemented |') &&
      matrixSource.includes('crewai_parity_w05_specialist_tools_contract') &&
      matrixSource.includes('crewai-w05-specialist-tools-latest'),
    'Wave 5 matrix binds CW-W05 to dedicated parity gate and artifact',
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
  const outJson = path.join(outDir, 'crewai-w05-specialist-tools-latest.json');
  const outMd = path.join(outDir, 'crewai-w05-specialist-tools-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# CrewAI W05 Specialist Tools Status',
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
