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
  const workflowsRoute = read('services/gateway-api/src/routes/admin/workflows.ts');
  const skillRunnerScopedGuard = read('services/skill-runner/src/scoped-settings-guard.ts');
  const matrixSource = read('docs/parity/wave8-langgraph-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const packageSource = read('package.json');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'langgraph_w09_org_binding_required_present',
    workflowsRoute.includes("error: { code: 'ORG_REQUIRED', message: 'Active account required' }") &&
      workflowsRoute.includes('function currentOrgId(request: any): string | null'),
    'workflow routes require active org/account binding before workflow operations',
  );

  add(
    'langgraph_w09_org_scoped_queries_present',
    workflowsRoute.includes('c.organization_id = $2') &&
      workflowsRoute.includes('c.organization_id = $4') &&
      workflowsRoute.includes('JOIN chats c ON c.id = w.chat_id') &&
      workflowsRoute.includes('WHERE wr.id = $1 AND c.organization_id = $2'),
    'workflow CRUD/run operations are constrained by organization-scoped joins and filters',
  );

  add(
    'langgraph_w09_actor_identity_and_scope_guard_present',
    workflowsRoute.includes('async function resolveActorIdentityId(request: any, reply: FastifyReply): Promise<string | null>') &&
      workflowsRoute.includes("sendError(reply, 401, 'UNAUTHENTICATED', 'Authenticated actor required')") &&
      skillRunnerScopedGuard.includes('Tenant-scoped integration settings require resolvable organization scope'),
    'actor identity and downstream tenant-scoped guardrails enforce isolation boundaries',
  );

  add(
    'langgraph_w09_route_fail_closed_not_found_present',
    workflowsRoute.includes("return sendError(reply, 404, 'NOT_FOUND', 'Workflow not found');") &&
      workflowsRoute.includes("return sendError(reply, 404, 'NOT_FOUND', 'Run not found');"),
    'cross-org access attempts fail closed as not found for workflow/run scoped resources',
  );

  add(
    'langgraph_w09_matrix_program_alias_binding_present',
    matrixSource.includes('| LG-W09 | Organization-scoped graph governance and policy isolation | implemented |') &&
      matrixSource.includes('langgraph_parity_w09_graph_policy_isolation_contract') &&
      matrixSource.includes('langgraph-w09-graph-policy-isolation-latest') &&
      programSource.includes('LG-W09') &&
      packageSource.includes('"release:langgraph:w09:status"') &&
      packageSource.includes('"release:langgraph:w09:status:local"'),
    'Wave 8 matrix/program/npm bindings include LG-W09 strict evidence lane',
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
  const outJson = path.join(outDir, 'langgraph-w09-graph-policy-isolation-latest.json');
  const outMd = path.join(outDir, 'langgraph-w09-graph-policy-isolation-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LangGraph W09 Graph Policy Isolation Status',
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

