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
  const agentsE2e = read('services/gateway-api/src/__tests__/agents.e2e.ts');
  const sendValidationRuntime = read('services/gateway-api/src/__tests__/agents-send.validation.test.ts');
  const orgScopeRuntime = read('services/gateway-api/src/__tests__/admin-agents-control-plane-org-scope.runtime.test.ts');
  const matrixSource = read('docs/parity/wave4-framework-absorption-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'framework_w02_delegated_send_route_surface_present',
    agentsRoute.includes("app.post('/agents/sessions/send'") &&
      agentsRoute.includes('required: [\'from_agent\', \'to_agent\', \'session_id\', \'message\']') &&
      agentsRoute.includes('reply_back: { type: \'boolean\' },') &&
      agentsRoute.includes('reply_skip: { type: \'boolean\' },') &&
      agentsRoute.includes('announce_skip: { type: \'boolean\' },') &&
      agentsRoute.includes('INSERT INTO inter_agent_messages') &&
      agentsRoute.includes("status: flags.reply_back && !flags.reply_skip ? 'responded' : 'delivered'"),
    'delegated send route exposes explicit control flags and deterministic delivered/responded semantics',
  );

  add(
    'framework_w02_delegated_org_scope_and_membership_enforced',
    agentsRoute.includes('if (!requireActiveOrg(request, reply)) return;') &&
      agentsRoute.includes('const orgId = String((request as any).orgId || \'\').trim();') &&
      agentsRoute.includes('JOIN chats c ON c.id = asn.session_id') &&
      agentsRoute.includes('c.organization_id::text = $3::text') &&
      agentsRoute.includes("error: { code: 'NOT_FOUND', message: 'Both agents must be attached to target session_id' },"),
    'delegated execution is fail-closed to org-scoped session membership before inter-agent handoff',
  );

  add(
    'framework_w02_role_bound_subordinate_policy_controls_present',
    agentsRoute.includes('parent_agent_id?: string;') &&
      agentsRoute.includes('policy_scope?: string[] | string;') &&
      agentsRoute.includes('subordinate_overrides') &&
      agentsRoute.includes('parent_agent_id is not mapped to this session') &&
      agentsRoute.includes('Maximum subagent nesting depth exceeded'),
    'subordinate delegation path enforces parent linkage and scoped policy/override controls',
  );

  add(
    'framework_w02_runtime_and_e2e_coverage_bound',
    sendValidationRuntime.includes("describe('agent send flag validation'") &&
      sendValidationRuntime.includes('respects strict boolean semantics for reply path') &&
      orgScopeRuntime.includes('scopes inter-agent send precheck by organization through chats join') &&
      agentsE2e.includes("'/v1/admin/agents/sessions/send'") &&
      agentsE2e.includes('reply_back: true,') &&
      agentsE2e.includes('policy_scope: [\'web.fetch\', \'nas.read\']'),
    'delegated handoff path is covered by runtime validation/org-scope tests and live e2e flow',
  );

  add(
    'framework_w02_matrix_binding_present',
    matrixSource.includes('| FW-W02 | Role-based agent handoff and delegated execution policy | implemented |') &&
      matrixSource.includes('framework_parity_w02_delegated_handoff_policy_contract'),
    'Wave 4 matrix binds FW-W02 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'framework-w02-delegated-handoff-latest.json');
  const outMd = path.join(outDir, 'framework-w02-delegated-handoff-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Framework W02 Delegated Handoff Status',
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
