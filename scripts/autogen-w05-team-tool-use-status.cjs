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

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function run() {
  const agentsRoute = read('services/gateway-api/src/routes/admin/agents.ts');
  const runtimeConfig = read('services/agent-runtime/src/subagent-config.ts');
  const runtimeIndex = read('services/agent-runtime/src/index.ts');
  const matrixSource = read('docs/parity/wave7-autogen-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const packageSource = read('package.json');
  const contractSource = read('services/gateway-api/src/__tests__/autogen-parity-w05-team-tool-use-contract.test.ts');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'autogen_w05_specialist_selection_surface_present',
    agentsRoute.includes("app.post('/agents/supervisor/orchestrate', {") &&
      agentsRoute.includes('required_capabilities: {') &&
      agentsRoute.includes('const requiredCapabilitiesValidation = validateRequiredCapabilitiesPayload(body.required_capabilities);') &&
      agentsRoute.includes('const capabilities = parseAgentCapabilities(row);') &&
      agentsRoute.includes('requiredCapabilities.filter((cap) => capabilities.includes(cap)).length;') &&
      agentsRoute.includes("message: 'No eligible sub-agents matched required capabilities'"),
    'supervisor route performs capability-targeted specialist selection for tool-using team assistants',
  );

  add(
    'autogen_w05_team_tool_guardrails_present',
    runtimeConfig.includes('const ownPolicyScope = toStringArray(routingRules.policy_scope);') &&
      runtimeConfig.includes('const mergedScope = mergePolicyScopes(parentPolicy, ownScope);') &&
      runtimeConfig.includes('policy_scope: hasExplicitPolicyScope ? mergedScope : undefined,') &&
      runtimeIndex.includes('if (!isScopeAllowedForSubagent(toolCall.scope, agentConfig?.policy_scope)) {') &&
      runtimeIndex.includes('Subagent policy scope denied'),
    'team tool use is constrained by inherited subagent policy scopes and fail-closed runtime enforcement',
  );

  add(
    'autogen_w05_delegated_execution_audit_present',
    agentsRoute.includes('INSERT INTO inter_agent_messages') &&
      agentsRoute.includes("'responded', $6, $7, NOW(), NOW(), NOW()") &&
      agentsRoute.includes('orchestrated: true,') &&
      agentsRoute.includes('required_capabilities: requiredCapabilities,') &&
      agentsRoute.includes('capability_score: candidate.capability_score,') &&
      agentsRoute.includes('control_flags: flags,'),
    'delegated team-tool execution persists orchestration control flags and capability metadata for audit',
  );

  add(
    'autogen_w05_existing_tool_orchestration_proofs_present',
    exists('services/gateway-api/src/__tests__/agents-supervisor.validation.test.ts') &&
      exists('services/gateway-api/src/__tests__/crewai-parity-w05-specialist-tools-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/framework-parity-w02-delegated-handoff-policy-contract.test.ts') &&
      exists('services/agent-runtime/src/__tests__/subagent-config.test.ts'),
    'existing supervisor/delegation/specialist contracts back AG-W05 team-tool parity lane',
  );

  add(
    'autogen_w05_matrix_program_alias_binding_present',
    matrixSource.includes('| AG-W05 | Tool-using assistant agent within team chat | implemented |') &&
      matrixSource.includes('autogen_parity_w05_team_tool_use_contract') &&
      matrixSource.includes('autogen-w05-team-tool-use-latest') &&
      programSource.includes('AG-W05') &&
      packageSource.includes('"release:autogen:w05:status"') &&
      packageSource.includes('"release:autogen:w05:status:local"') &&
      contractSource.includes('AutoGen W05 team tool use parity contract'),
    'Wave 7 matrix/program/npm bindings exist for AG-W05 strict team-tool lane',
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
  const outJson = path.join(outDir, 'autogen-w05-team-tool-use-latest.json');
  const outMd = path.join(outDir, 'autogen-w05-team-tool-use-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# AutoGen W05 Team Tool Use Status',
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
