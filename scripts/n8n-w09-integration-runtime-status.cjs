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
  const reconcilerSource = read('services/gateway-api/src/services/IntegrationRuntimeReconciler.ts');
  const orchestratorSource = read('services/gateway-api/src/services/IntegrationRuntimeOrchestrator.ts');
  const runtimeRouteSource = read('services/gateway-api/src/routes/admin/integration-runtime.ts');
  const catalogRouteSource = read('services/gateway-api/src/routes/admin/integrations-catalog.ts');
  const reconcilerContract = read('services/gateway-api/src/__tests__/integration-runtime-reconciler.test.ts');
  const reconcileLockContract = read('services/gateway-api/src/__tests__/integration-runtime-reconcile-lock-contract.test.ts');
  const orchestratorTimeoutContract = read('services/gateway-api/src/__tests__/integration-runtime-orchestrator-timeout-contract.test.ts');
  const routeAuthorizationContract = read('services/gateway-api/src/__tests__/integration-runtime.route.authorization-contract.test.ts');
  const deployExecutionContract = read('services/gateway-api/src/__tests__/integration-runtime-deploy-execution-status-wave367.contract.test.ts');
  const matrixSource = read('docs/parity/wave3-n8n-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'n8n_w09_reconciler_drift_and_autoheal_runtime_present',
    reconcilerSource.includes('async reconcileOnce(options?: { organizationId?: string }): Promise<IntegrationRuntimeReconcileReport>') &&
      reconcilerSource.includes('if (this.running) {') &&
      reconcilerSource.includes('report.skipped_due_to_lock = true;') &&
      reconcilerSource.includes('report.drift_detected += 1;') &&
      reconcilerSource.includes('report.autoheal_attempted += 1;') &&
      reconcilerSource.includes("SET status = 'running'") &&
      reconcilerSource.includes("SET status = 'error'"),
    'reconciler enforces single-flight lock semantics, drift detection, and bounded auto-heal state transitions',
  );

  add(
    'n8n_w09_orchestrator_timeout_and_failclosed_controls_present',
    orchestratorSource.includes('private readonly timeoutMs = Math.max(5_000, Number(process.env.SVEN_INTEGRATION_RUNTIME_EXEC_TIMEOUT_MS || 120_000));') &&
      orchestratorSource.includes('private readonly killGraceMs = Math.max(500, Number(process.env.SVEN_INTEGRATION_RUNTIME_EXEC_KILL_GRACE_MS || 3_000));') &&
      orchestratorSource.includes("child.kill('SIGTERM');") &&
      orchestratorSource.includes("child.kill('SIGKILL');") &&
      orchestratorSource.includes('error: `RUNTIME_CMD_TIMEOUT: command exceeded ${String(timeoutMs)}ms`') &&
      orchestratorSource.includes('shell: false') &&
      orchestratorSource.includes('No runtime command configured for'),
    'orchestrator enforces timeout escalation, safe process execution, and fail-closed command readiness checks',
  );

  add(
    'n8n_w09_admin_runtime_route_operability_present',
    runtimeRouteSource.includes("app.get('/integrations/runtime'") &&
      runtimeRouteSource.includes("app.post('/integrations/runtime/reconcile'") &&
      runtimeRouteSource.includes("app.post('/integrations/runtime/:integrationType/deploy'") &&
      runtimeRouteSource.includes("app.post('/integrations/runtime/:integrationType/stop'") &&
      runtimeRouteSource.includes("error: { code: 'RECONCILE_IN_PROGRESS'") &&
      runtimeRouteSource.includes("const nextStatus = orchestration.executed ? 'running' : 'stopped';") &&
      runtimeRouteSource.includes('tenantSafeRuntimeError('),
    'runtime admin routes expose reconcile/deploy/stop controls with lock-aware and tenant-safe failure behavior',
  );

  add(
    'n8n_w09_catalog_runtime_recovery_orchestration_present',
    catalogRouteSource.includes('async function deployRuntimeForType(params:') &&
      catalogRouteSource.includes('const runtimeStatus = commandExecuted ? \'running\' : \'stopped\';') &&
      catalogRouteSource.includes('const runtimeStatus = orchestration.executed ? \'running\' : \'stopped\';') &&
      catalogRouteSource.includes("'RUNTIME_DEPLOY_FAILED'") &&
      catalogRouteSource.includes('command_executed: orchestration.executed') &&
      catalogRouteSource.includes("app.post('/integrations/catalog/recovery-playbook'"),
    'catalog recovery playbook orchestrates integration runtime deployment with explicit execution status and fail-closed runtime errors',
  );

  add(
    'n8n_w09_contract_tests_bound',
    reconcilerContract.includes("describe('IntegrationRuntimeReconciler'") &&
      reconcileLockContract.includes("describe('integration runtime reconcile contention contract'") &&
      orchestratorTimeoutContract.includes("describe('integration runtime orchestrator timeout contract'") &&
      routeAuthorizationContract.includes("describe('integration runtime route authorization contract'") &&
      deployExecutionContract.includes("describe('Wave 367 runtime deploy false-green closure contract'"),
    'integration runtime reliability is bound to reconciler/lock/timeout/auth/deploy-status contract tests',
  );

  add(
    'n8n_w09_matrix_binding_present',
    matrixSource.includes('| NN-W09 | External integration runtime orchestration reliability | implemented |') &&
      matrixSource.includes('n8n_parity_w09_integration_runtime_contract'),
    'Wave 3 matrix binds NN-W09 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'n8n-w09-integration-runtime-latest.json');
  const outMd = path.join(outDir, 'n8n-w09-integration-runtime-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# n8n W09 Integration Runtime Status',
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
