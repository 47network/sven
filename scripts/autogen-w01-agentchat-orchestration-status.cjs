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
  const matrixSource = read('docs/parity/wave7-autogen-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const packageSource = read('package.json');
  const contractSource = read(
    'services/gateway-api/src/__tests__/autogen-parity-w01-agentchat-orchestration-contract.test.ts',
  );

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'autogen_w01_control_plane_routes_present',
    agentsRoute.includes("app.post('/agents/:id/spawn-session'") &&
      agentsRoute.includes("app.post('/agents/sessions/send'") &&
      agentsRoute.includes("app.post('/agents/supervisor/orchestrate'"),
    'agent control plane exposes spawn-session, delegated send, and supervisor orchestration routes',
  );

  add(
    'autogen_w01_org_scope_contract_proofs_present',
    exists('services/gateway-api/src/__tests__/admin-agents-control-plane-org-scope.runtime.test.ts') &&
      exists('services/gateway-api/src/__tests__/admin-agents-spawn-session-org-scope-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/framework-parity-w02-delegated-handoff-policy-contract.test.ts'),
    'org-scoped and delegated-handoff proofs exist for multi-agent orchestration surfaces',
  );

  add(
    'autogen_w01_matrix_binding_present',
    matrixSource.includes('| AG-W01 | Multi-agent AgentChat orchestration with supervisor + delegated worker turns | implemented |') &&
      matrixSource.includes('autogen_parity_w01_agentchat_orchestration_contract') &&
      matrixSource.includes('autogen-w01-agentchat-orchestration-latest'),
    'Wave 7 matrix binds AG-W01 to implemented state with contract/evidence IDs',
  );

  add(
    'autogen_w01_program_and_aliases_present',
    programSource.includes('### 9.8) Wave 7 Kickoff Snapshot (2026-03-16)') &&
      packageSource.includes('"release:autogen:w01:status"') &&
      packageSource.includes('"release:autogen:w01:status:local"'),
    'competitive program snapshot and npm aliases are present for Wave 7 AG-W01 kickoff lane',
  );

  add(
    'autogen_w01_contract_binding_present',
    contractSource.includes('AutoGen W01 AgentChat orchestration parity contract') &&
      contractSource.includes("'autogen_w01_control_plane_routes_present'"),
    'AG-W01 contract test binds to strict status checks',
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
  const outJson = path.join(outDir, 'autogen-w01-agentchat-orchestration-latest.json');
  const outMd = path.join(outDir, 'autogen-w01-agentchat-orchestration-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# AutoGen W01 AgentChat Orchestration Status',
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
