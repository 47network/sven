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
  const schedulerRoute = read('services/gateway-api/src/routes/scheduler.ts');
  const adminCronRoute = read('services/gateway-api/src/routes/admin/cron.ts');
  const matrixSource = read('docs/parity/wave3-n8n-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'n8n_w02_scheduler_crud_surface_present',
    schedulerRoute.includes("app.post('/v1/schedules'") &&
      schedulerRoute.includes("app.put('/v1/schedules/:id'") &&
      schedulerRoute.includes("app.get('/v1/schedules/:id/history'") &&
      schedulerRoute.includes("app.post('/v1/schedules/:id/run'"),
    'schedule create/update/history/manual-run routes are present',
  );

  add(
    'n8n_w02_cron_validation_present',
    schedulerRoute.includes('function isValidCron(expression: string): boolean') &&
      schedulerRoute.includes('computeNextRun(expression'),
    'scheduler has strict cron expression validation and next-run computation',
  );

  add(
    'n8n_w02_admin_cron_run_targets_guarded',
    adminCronRoute.includes("if (handler === 'run_tool')") &&
      adminCronRoute.includes('run_tool target chat is not authorized for organization') &&
      adminCronRoute.includes('run_tool target user is not authorized for organization') &&
      adminCronRoute.includes("if (handler === 'workflow')") &&
      adminCronRoute.includes('workflow target is not authorized for organization'),
    'admin cron handler enforces org-scoped guardrails for run_tool/workflow targets',
  );

  add(
    'n8n_w02_admin_cron_workflow_dispatch_present',
    adminCronRoute.includes('ALLOWED_CRON_HANDLERS') &&
      adminCronRoute.includes("'workflow'") &&
      adminCronRoute.includes("kind: 'workflow.execute'"),
    'admin cron workflow handler dispatches runtime workflow.execute events',
  );

  add(
    'n8n_w02_matrix_binding_present',
    matrixSource.includes('| NN-W02 | Trigger and schedule automation (cron/scheduler + guarded run targets) | implemented |') &&
      matrixSource.includes('n8n_parity_w02_trigger_scheduling_contract'),
    'Wave 3 matrix binds NN-W02 to contract test and evidence ID',
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
  const outJson = path.join(outDir, 'n8n-w02-trigger-scheduling-latest.json');
  const outMd = path.join(outDir, 'n8n-w02-trigger-scheduling-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# n8n W02 Trigger Scheduling Status',
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
