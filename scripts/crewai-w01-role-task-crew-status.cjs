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
  const opsTests = read('services/agent-runtime/src/__tests__/ops-commands.test.ts');
  const contractSource = read(
    'services/gateway-api/src/__tests__/crewai-parity-w01-role-task-crew-contract.test.ts',
  );
  const matrixSource = read('docs/parity/wave5-crewai-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'crewai_w01_command_surface_present',
    commandSource.includes('${parsed.prefix}subagents') &&
      commandSource.includes('${parsed.prefix}tell <agent_id> <message>') &&
      commandSource.includes('${parsed.prefix}steer <agent_id|all> <instruction>') &&
      commandSource.includes('${parsed.prefix}kill <agent_id>'),
    'chat command surface exposes crew-style routed messaging and control operations',
  );

  add(
    'crewai_w01_inter_agent_routing_runtime_present',
    commandSource.includes('async function queueInterAgentMessage(') &&
      commandSource.includes('INSERT INTO inter_agent_messages') &&
      commandSource.includes('async function setSubagentSteerInstruction(') &&
      commandSource.includes('UPDATE agent_sessions') &&
      commandSource.includes('Only admins can message subagents.') &&
      commandSource.includes('Only admins can steer subagents.'),
    'runtime enforces admin-gated inter-agent routing through chat-scoped session mappings',
  );

  add(
    'crewai_w01_operator_visibility_present',
      commandSource.includes('getSubagentStatus(') &&
      commandSource.includes('formatSubagentStatus(subagents)') &&
      commandSource.includes('FROM agent_sessions asn') &&
      commandSource.includes('LEFT JOIN inter_agent_messages iam') &&
      commandSource.includes('Subagents:'),
    'runtime exposes crew session status and queue counters for operator visibility',
  );

  add(
    'crewai_w01_test_and_contract_coverage_present',
    opsTests.includes('/tell queues inter-agent message when mapping exists') &&
      opsTests.includes('/tell rejects non-admin users and does not queue inter-agent message') &&
      opsTests.includes('/kill detaches subagent from current chat without global agent mutation') &&
      contractSource.includes('CrewAI W01 role-based crew orchestration parity contract') &&
      contractSource.includes("'crewai_w01_command_surface_present'"),
    'behavior is anchored by runtime tests and dedicated CrewAI parity contract',
  );

  add(
    'crewai_w01_matrix_binding_present',
    matrixSource.includes('| CW-W01 | Role-based crew orchestration with routed inter-agent tasks | implemented |') &&
      matrixSource.includes('crewai_parity_w01_role_task_crew_contract') &&
      matrixSource.includes('crewai-w01-role-task-crew-latest'),
    'Wave 5 matrix binds CW-W01 to dedicated parity gate and artifact',
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
  const outJson = path.join(outDir, 'crewai-w01-role-task-crew-latest.json');
  const outMd = path.join(outDir, 'crewai-w01-role-task-crew-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# CrewAI W01 Role Task Crew Status',
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
