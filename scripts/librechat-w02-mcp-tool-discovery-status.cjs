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
  const runtimeTestSource = read('services/agent-runtime/src/__tests__/mcp-command.test.ts');
  const matrixSource = read('docs/parity/wave2-librechat-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'librechat_w02_mcp_command_surface_present',
    commandSource.includes("case 'mcp':") &&
      commandSource.includes('${parsed.prefix}mcp list|tools [server_id|server_name]') &&
      commandSource.includes('Usage: ${parsed.prefix}mcp list | ${parsed.prefix}mcp tools [server_id|server_name]'),
    'chat command help + usage surface exposes MCP discovery lane',
  );

  add(
    'librechat_w02_org_fail_closed_guard_present',
    commandSource.includes('MCP discovery is unavailable because this chat is not bound to an organization.') &&
      commandSource.includes('getChatOrganizationId(ctx.pool, ctx.event.chat_id)'),
    'MCP discovery fails closed when org binding is absent',
  );

  add(
    'librechat_w02_server_discovery_present',
    commandSource.includes('MCP servers:') &&
      commandSource.includes('No MCP servers are registered for this organization.') &&
      commandSource.includes('listMcpServersForChatCommand(ctx.pool, orgId, ctx.event.chat_id)'),
    'MCP server inventory path is present with explicit empty-state handling',
  );

  add(
    'librechat_w02_tool_discovery_present',
    commandSource.includes('MCP tools:') &&
      commandSource.includes('MCP tools for ${serverRef}:') &&
      commandSource.includes('listMcpToolsForChatCommand(ctx.pool, orgId, serverRef)'),
    'MCP tool discovery supports global and server-filtered listing',
  );

  add(
    'librechat_w02_runtime_test_coverage_present',
    runtimeTestSource.includes('lists MCP servers with effective enablement and scope') &&
      runtimeTestSource.includes('lists MCP tools and supports server filter') &&
      runtimeTestSource.includes('fails closed when chat has no organization binding'),
    'runtime tests cover MCP list/tools/org guard behaviors',
  );

  add(
    'librechat_w02_matrix_binding_present',
    matrixSource.includes('| LC-W02 | MCP/tool discovery + operator-safe listing flow | implemented |') &&
      matrixSource.includes('librechat_parity_w02_mcp_tool_discovery_contract'),
    'Wave 2 matrix binds LC-W02 to contract test and evidence ID',
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
  const outJson = path.join(outDir, 'librechat-w02-mcp-tool-discovery-latest.json');
  const outMd = path.join(outDir, 'librechat-w02-mcp-tool-discovery-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LibreChat W02 MCP Tool Discovery Status',
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
