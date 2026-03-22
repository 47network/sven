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
  const handoffTests = read('services/agent-runtime/src/__tests__/handoff-continuation-command.test.ts');
  const contractSource = read(
    'services/gateway-api/src/__tests__/crewai-parity-w02-sequential-handoff-contract.test.ts',
  );
  const matrixSource = read('docs/parity/wave5-crewai-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'crewai_w02_handoff_command_surface_present',
    commandSource.includes('${parsed.prefix}handoff <target> [note...]') &&
      commandSource.includes("case 'handoff': {") &&
      commandSource.includes('Usage: /handoff <target> [note...]'),
    'crew handoff command surface exists with deterministic usage contract',
  );

  add(
    'crewai_w02_deterministic_ownership_transition_present',
    commandSource.includes('async function resolveRelayDevice(') &&
      commandSource.includes('SELECT organization_id FROM chats') &&
      commandSource.includes('WHERE organization_id = $1') &&
      commandSource.includes("INSERT INTO device_commands (device_id, command, payload)") &&
      commandSource.includes("VALUES ($1, 'display', $2)") &&
      commandSource.includes("scene: 'ops_dashboard'") &&
      commandSource.includes('set_as_active: true') &&
      commandSource.includes('chat_id: ${ctx.event.chat_id}'),
    'handoff transition is org-scoped and emits target-owned display command with preserved chat identity',
  );

  add(
    'crewai_w02_continuity_payload_determinism_present',
    commandSource.includes('async function buildChatHandoffContinuity(') &&
      commandSource.includes('ORDER BY created_at DESC') &&
      commandSource.includes('LIMIT 6') &&
      commandSource.includes('const messages = [...messageRes.rows].reverse();') &&
      commandSource.includes('timeline.push(`${label}: ${truncateForHandoff(text, 140)}`);') &&
      commandSource.includes('`Chat: ${chatId}`') &&
      commandSource.includes('`Captured: ${nowIso}`') &&
      commandSource.includes("note ? `Note: ${truncateForHandoff(note, 120)}` : 'Note: none'"),
    'handoff continuity payload is generated with bounded, ordered, deterministic context',
  );

  add(
    'crewai_w02_runtime_and_contract_tests_present',
    opsTests.includes('/handoff pushes scene continuity payload to target mirror device') &&
      handoffTests.includes('pushes continuity payload and preserves chat thread identity in confirmation') &&
      handoffTests.includes('fails closed when chat is not bound to an organization') &&
      contractSource.includes('CrewAI W02 sequential handoff parity contract') &&
      contractSource.includes("'crewai_w02_handoff_command_surface_present'"),
    'handoff ownership transition is anchored by runtime tests and dedicated parity contract',
  );

  add(
    'crewai_w02_matrix_binding_present',
    matrixSource.includes(
      '| CW-W02 | Sequential crew handoff with deterministic task ownership | implemented |',
    ) &&
      matrixSource.includes('crewai_parity_w02_sequential_handoff_contract') &&
      matrixSource.includes('crewai-w02-sequential-handoff-latest'),
    'Wave 5 matrix binds CW-W02 to dedicated parity gate and artifact',
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
  const outJson = path.join(outDir, 'crewai-w02-sequential-handoff-latest.json');
  const outMd = path.join(outDir, 'crewai-w02-sequential-handoff-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# CrewAI W02 Sequential Handoff Status',
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
