#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const matrixRel = String(
  process.env.SVEN_RUNBOOK_SCENARIO_MATRIX_PATH || 'docs/release/evidence/runbook-scenario-matrix-latest.json',
).trim();
const matrixPath = path.join(root, matrixRel);
const maxAgeHours = Number(process.env.SVEN_RUNBOOK_SCENARIO_MATRIX_MAX_AGE_HOURS || 168);
const requiredScenarioIds = String(
  process.env.SVEN_REQUIRED_RUNBOOK_SCENARIOS
  || 'tunnel_down,queue_backlog_disk_full,enrollment_failures,update_rollback,cert_issues',
)
  .split(',')
  .map((value) => String(value || '').trim().toLowerCase())
  .filter(Boolean);

function readJson(fullPath) {
  return JSON.parse(fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, ''));
}

function parseIso(value) {
  const parsed = Date.parse(String(value || ''));
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function ageHours(timestampIso) {
  if (!timestampIso) return null;
  const parsed = Date.parse(timestampIso);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
}

function run() {
  const checks = [];
  if (!fs.existsSync(matrixPath)) {
    checks.push({
      id: 'runbook_scenario_matrix_present',
      pass: false,
      detail: `${matrixRel} missing`,
    });
    const report = {
      generated_at: new Date().toISOString(),
      status: 'fail',
      matrix: matrixRel,
      checks,
    };
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'runbook-scenario-matrix-latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(outDir, 'runbook-scenario-matrix-latest.md'), `# Runbook Scenario Matrix\n\nStatus: fail\nReason: ${matrixRel} missing\n`, 'utf8');
    if (strict) process.exit(2);
    return;
  }

  let matrix;
  try {
    matrix = readJson(matrixPath);
    checks.push({
      id: 'runbook_scenario_matrix_valid_json',
      pass: true,
      detail: matrixRel,
    });
  } catch (err) {
    checks.push({
      id: 'runbook_scenario_matrix_valid_json',
      pass: false,
      detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
    });
    matrix = null;
  }

  const entries = Array.isArray(matrix?.entries) ? matrix.entries : [];
  checks.push({
    id: 'runbook_scenario_matrix_schema_valid',
    pass: entries.length > 0,
    detail: entries.length > 0 ? `entries=${entries.length}` : 'entries[] missing or empty',
  });

  const rowErrors = [];
  const seenByScenario = new Map();
  for (let idx = 0; idx < entries.length; idx += 1) {
    const row = entries[idx];
    const scenarioId = String(row?.scenario_id || '').trim().toLowerCase();
    const environment = String(row?.environment || '').trim().toLowerCase();
    const outcome = String(row?.outcome || '').trim().toLowerCase();
    const evidenceLink = String(row?.evidence_link || '').trim();
    const executedAt = parseIso(row?.executed_at);
    if (!scenarioId) rowErrors.push(`row_${idx}: missing scenario_id`);
    if (!environment) rowErrors.push(`row_${idx}: missing environment`);
    if (!outcome) rowErrors.push(`row_${idx}: missing outcome`);
    if (!evidenceLink) rowErrors.push(`row_${idx}: missing evidence_link`);
    if (!executedAt) rowErrors.push(`row_${idx}: invalid executed_at`);
    if (scenarioId) {
      const bucket = seenByScenario.get(scenarioId) || [];
      bucket.push({
        environment,
        outcome,
      });
      seenByScenario.set(scenarioId, bucket);
    }
  }

  checks.push({
    id: 'runbook_scenario_matrix_entry_fields_valid',
    pass: rowErrors.length === 0,
    detail: rowErrors.length === 0 ? `validated=${entries.length}` : rowErrors.slice(0, 12).join('; '),
  });

  const missingRequired = [];
  for (const scenarioId of requiredScenarioIds) {
    const rows = seenByScenario.get(scenarioId) || [];
    const hasStagingExecution = rows.some(
      (row) => row.environment === 'staging'
        && ['pass', 'passed', 'ok', 'completed', 'success'].includes(row.outcome),
    );
    if (!hasStagingExecution) {
      missingRequired.push(scenarioId);
    }
  }
  checks.push({
    id: 'runbook_required_scenarios_staging_executed',
    pass: missingRequired.length === 0,
    detail: missingRequired.length === 0 ? `required=${requiredScenarioIds.length}` : `missing=${missingRequired.join(', ')}`,
  });

  const matrixGeneratedAt = parseIso(matrix?.generated_at);
  const matrixAge = ageHours(matrixGeneratedAt);
  const matrixFresh = typeof matrixAge === 'number' && matrixAge <= maxAgeHours;
  checks.push({
    id: 'runbook_scenario_matrix_fresh',
    pass: matrixFresh,
    detail: matrixFresh
      ? `${matrixAge.toFixed(2)}h <= ${maxAgeHours}h`
      : matrixGeneratedAt
        ? `${(matrixAge || 0).toFixed(2)}h > ${maxAgeHours}h`
        : 'missing/invalid generated_at',
  });

  const status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    matrix: matrixRel,
    required_scenarios: requiredScenarioIds,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'runbook-scenario-matrix-latest.json');
  const outMd = path.join(outDir, 'runbook-scenario-matrix-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Runbook Scenario Matrix\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\nMatrix: ${matrixRel}\n\n## Checks\n${checks
      .map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`)
      .join('\n')}\n`,
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
