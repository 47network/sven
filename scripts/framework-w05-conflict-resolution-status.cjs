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
  const mutationValidationContract = read('services/gateway-api/src/__tests__/admin-agents-mutation-validation-contract.test.ts');
  const matrixSource = read('docs/parity/wave4-framework-absorption-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'framework_w05_conflict_policy_surface_present',
    agentsRoute.includes('const VALID_CONFLICT_RESOLUTION = [\'priority\', \'first\', \'merge\'] as const;') &&
      agentsRoute.includes('const VALID_AGGREGATION = [\'all\', \'best\', \'first\'] as const;') &&
      agentsRoute.includes('conflict_resolution?: \'priority\' | \'first\' | \'merge\';') &&
      agentsRoute.includes('aggregation?: \'all\' | \'best\' | \'first\';') &&
      agentsRoute.includes('required_capabilities?: string[];'),
    'supervisor orchestration exposes explicit conflict-resolution and aggregation policy surface',
  );

  add(
    'framework_w05_conflict_policy_validation_fail_closed_present',
    agentsRoute.includes('if (!VALID_CONFLICT_RESOLUTION.includes(conflictResolution as any)) {') &&
      agentsRoute.includes('conflict_resolution must be one of:') &&
      agentsRoute.includes('if (!VALID_AGGREGATION.includes(aggregation as any)) {') &&
      agentsRoute.includes('aggregation must be one of:'),
    'conflict-resolution and aggregation policies are strictly validated with fail-closed responses',
  );

  add(
    'framework_w05_conflict_resolution_execution_present',
    agentsRoute.includes('const uniqueResponses = new Set(assignments.map((x) => x.response.trim().toLowerCase()));') &&
      agentsRoute.includes('const hasConflict = uniqueResponses.size > 1;') &&
      agentsRoute.includes('if (aggregation === \'first\') {') &&
      agentsRoute.includes('} else if (aggregation === \'best\') {') &&
      agentsRoute.includes('} else if (conflictResolution === \'merge\') {') &&
      agentsRoute.includes('conflict_detected: hasConflict,') &&
      agentsRoute.includes('aggregated_result: aggregatedResult,'),
    'runtime computes conflict detection and applies deterministic aggregation/conflict policies',
  );

  add(
    'framework_w05_e2e_and_contract_binding_present',
    agentsE2e.includes("'/v1/admin/agents/supervisor/orchestrate'") &&
      agentsE2e.includes('aggregation: \'all\',') &&
      agentsE2e.includes('conflict_resolution: \'merge\',') &&
      agentsE2e.includes('aggregated_result') &&
      mutationValidationContract.includes("app.post('/agents/supervisor/orchestrate', {"),
    'policy route is covered by e2e orchestration flow and mutation-validation contract anchor',
  );

  add(
    'framework_w05_matrix_binding_present',
    matrixSource.includes('| FW-W05 | Multi-agent routing conflict resolution and aggregation policy | implemented |') &&
      matrixSource.includes('framework_parity_w05_conflict_resolution_contract'),
    'Wave 4 matrix binds FW-W05 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'framework-w05-conflict-resolution-latest.json');
  const outMd = path.join(outDir, 'framework-w05-conflict-resolution-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Framework W05 Conflict Resolution Status',
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
