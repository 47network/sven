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
    'services/gateway-api/src/__tests__/autogen-parity-w03-speaker-selection-contract.test.ts',
  );

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'autogen_w03_candidate_scoring_and_sorting_present',
    agentsRoute.includes('const rankedCandidates: CandidateAgent[] = candidatesRes.rows') &&
      agentsRoute.includes('const capabilityScore = requiredCapabilities.length === 0') &&
      agentsRoute.includes('.sort((left, right) => {') &&
      agentsRoute.includes('if (right.capability_score !== left.capability_score) {') &&
      agentsRoute.includes('return right.capability_score - left.capability_score;') &&
      agentsRoute.includes('return String(left.created_at).localeCompare(String(right.created_at));') &&
      agentsRoute.includes('.slice(0, maxAgents);'),
    'supervisor orchestration uses deterministic capability-scored candidate ranking and bounded speaker selection',
  );

  add(
    'autogen_w03_selection_policy_envelope_present',
    agentsRoute.includes("const VALID_CONFLICT_RESOLUTION = ['priority', 'first', 'merge'] as const;") &&
      agentsRoute.includes("const VALID_AGGREGATION = ['all', 'best', 'first'] as const;") &&
      agentsRoute.includes('const conflictResolution = body.conflict_resolution || \'priority\';') &&
      agentsRoute.includes('const aggregation = body.aggregation || \'all\';') &&
      agentsRoute.includes('if (!VALID_CONFLICT_RESOLUTION.includes(conflictResolution as any)) {') &&
      agentsRoute.includes('if (!VALID_AGGREGATION.includes(aggregation as any)) {'),
    'speaker-selection policy validates deterministic conflict-resolution and aggregation envelopes',
  );

  add(
    'autogen_w03_aggregation_resolution_logic_present',
    agentsRoute.includes('const uniqueResponses = new Set(assignments.map((x) => x.response.trim().toLowerCase()));') &&
      agentsRoute.includes('const hasConflict = uniqueResponses.size > 1;') &&
      agentsRoute.includes('if (aggregation === \'first\') {') &&
      agentsRoute.includes('} else if (aggregation === \'best\') {') &&
      agentsRoute.includes('} else if (conflictResolution === \'merge\') {') &&
      agentsRoute.includes('} else if (conflictResolution === \'first\') {'),
    'orchestration resolves selected-speaker outputs deterministically across aggregation/conflict branches',
  );

  add(
    'autogen_w03_existing_validation_proofs_present',
    exists('services/gateway-api/src/__tests__/agents-supervisor.validation.test.ts') &&
      exists('services/gateway-api/src/__tests__/framework-parity-w05-conflict-resolution-contract.test.ts') &&
      exists('services/gateway-api/src/__tests__/crewai-parity-w05-specialist-tools-contract.test.ts'),
    'existing supervisor validation and conflict-resolution contracts back AG-W03 parity lane',
  );

  add(
    'autogen_w03_matrix_program_alias_binding_present',
    matrixSource.includes('| AG-W03 | Agent role envelopes with deterministic speaker-selection policy | implemented |') &&
      matrixSource.includes('autogen_parity_w03_speaker_selection_contract') &&
      matrixSource.includes('autogen-w03-speaker-selection-latest') &&
      programSource.includes('AG-W03') &&
      packageSource.includes('"release:autogen:w03:status"') &&
      packageSource.includes('"release:autogen:w03:status:local"') &&
      contractSource.includes('AutoGen W03 speaker selection parity contract'),
    'Wave 7 matrix/program/npm bindings exist for AG-W03 strict speaker-selection lane',
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
  const outJson = path.join(outDir, 'autogen-w03-speaker-selection-latest.json');
  const outMd = path.join(outDir, 'autogen-w03-speaker-selection-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# AutoGen W03 Speaker Selection Status',
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
