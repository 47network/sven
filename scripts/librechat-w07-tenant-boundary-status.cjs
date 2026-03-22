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
  const mcpRuntimeTest = read('services/agent-runtime/src/__tests__/mcp-command.test.ts');
  const scopeRuntimeTest = read('services/agent-runtime/src/__tests__/policy-engine.scope-binding.test.ts');
  const matrixSource = read('docs/parity/wave2-librechat-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'librechat_w07_org_fail_closed_path_present',
    commandSource.includes('MCP discovery is unavailable because this chat is not bound to an organization.') &&
      commandSource.includes('listMcpServersForChatCommand(ctx.pool, orgId, ctx.event.chat_id)') &&
      commandSource.includes('WHERE t.organization_id = $1'),
    'MCP discovery and tool listing stay org-bound and fail-closed',
  );

  add(
    'librechat_w07_session_scoped_provider_setting_present',
    commandSource.includes('Only admins can change the active model.') &&
      commandSource.includes('UPDATE session_settings') &&
      commandSource.includes('WHERE session_id = $1'),
    'provider/model overrides are bounded to session scope with admin gating',
  );

  add(
    'librechat_w07_runtime_test_coverage_present',
    mcpRuntimeTest.includes('fails closed when chat has no organization binding') &&
      scopeRuntimeTest.includes('rejects mismatched model-provided scope not declared by tool permissions'),
    'runtime tests cover org fail-closed and policy scope mismatch rejection',
  );

  add(
    'librechat_w07_matrix_binding_present',
    matrixSource.includes('| LC-W07 | Tenant/session boundary safety for provider and tool settings | implemented |') &&
      matrixSource.includes('librechat_parity_w07_tenant_boundary_contract'),
    'Wave 2 matrix binds LC-W07 to contract test and evidence ID',
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
  const outJson = path.join(outDir, 'librechat-w07-tenant-boundary-latest.json');
  const outMd = path.join(outDir, 'librechat-w07-tenant-boundary-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LibreChat W07 Tenant Boundary Status',
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

