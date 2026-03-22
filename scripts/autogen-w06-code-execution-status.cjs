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
  const runnerIndex = read('services/skill-runner/src/index.ts');
  const nativeShell = read('services/skill-runner/src/native-shell.ts');
  const timeoutSource = read('services/skill-runner/src/tool-exec-timeout.ts');
  const concurrencySource = read('services/skill-runner/src/tool-run-concurrency.ts');
  const finalizationSource = read('services/skill-runner/src/tool-run-finalization.ts');
  const immutableAuditMigration = read('services/gateway-api/src/db/migrations/154_tool_execution_immutable_audit.sql');
  const matrixSource = read('docs/parity/wave7-autogen-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const packageSource = read('package.json');
  const contractSource = read('services/gateway-api/src/__tests__/autogen-parity-w06-code-execution-contract.test.ts');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'autogen_w06_team_code_executor_selection_surface_present',
    agentsRoute.includes("app.post('/agents/supervisor/orchestrate', {") &&
      agentsRoute.includes('required_capabilities: {') &&
      agentsRoute.includes('const requiredCapabilitiesValidation = validateRequiredCapabilitiesPayload(body.required_capabilities);') &&
      agentsRoute.includes('const capabilities = parseAgentCapabilities(row);') &&
      agentsRoute.includes('capability_score: candidate.capability_score,'),
    'team-level supervisor orchestration can deterministically target code-capable delegated agents',
  );

  add(
    'autogen_w06_code_execution_safety_gate_present',
    runnerIndex.includes("case 'shell.exec':") &&
      runnerIndex.includes('return executeNativeShellTool(inputs);') &&
      nativeShell.includes('shell.exec is disabled unless SVEN_NATIVE_MODE=true') &&
      nativeShell.includes('multi-line shell commands are not allowed') &&
      nativeShell.includes('command "${commandToken || \'(empty)\'}" is not allowlisted') &&
      nativeShell.includes('cwd is outside allowed roots'),
    'code-execution participation is fail-closed: native mode flag, allowlist gate, multiline rejection, and root-bounded cwd',
  );

  add(
    'autogen_w06_obfuscation_and_env_redaction_guardrails_present',
    nativeShell.includes("id: 'base64_decode_pipeline'") &&
      nativeShell.includes("id: 'dynamic_eval'") &&
      nativeShell.includes("id: 'shell_control_operator'") &&
      nativeShell.includes("id: 'pipeline_chaining'") &&
      nativeShell.includes('shell command rejected: potential obfuscation detected') &&
      nativeShell.includes('SVEN_NATIVE_SHELL_ENV_ALLOWLIST') &&
      nativeShell.includes('DEFAULT_ENV_ALLOWLIST'),
    'obfuscation signatures and default env allowlisting protect delegated code execution sessions',
  );

  add(
    'autogen_w06_runtime_bounds_and_finalization_present',
    runnerIndex.includes('const admission = await tryInsertRunningToolRun(pool, {') &&
      runnerIndex.includes('Tool concurrency limit exceeded') &&
      runnerIndex.includes('const timeout = resolveToolExecutionTimeoutMs(tool.timeout_seconds);') &&
      runnerIndex.includes('await finalizeToolRunRecord(pool, {') &&
      timeoutSource.includes('const MAX_MS = 600_000;') &&
      concurrencySource.includes("status = 'running'") &&
      finalizationSource.includes("status: 'completed' | 'error';"),
    'code-executor runs are bounded by timeout, concurrency admission, and deterministic completed/error finalization',
  );

  add(
    'autogen_w06_immutable_audit_chain_present',
    immutableAuditMigration.includes('CREATE TABLE IF NOT EXISTS tool_execution_audit_log') &&
      immutableAuditMigration.includes('entry_hash TEXT NOT NULL DEFAULT') &&
      immutableAuditMigration.includes("entry_hash_value := encode(digest(payload || latest_hash, 'sha256'), 'hex');") &&
      immutableAuditMigration.includes('CREATE TRIGGER trg_tool_runs_audit_append') &&
      immutableAuditMigration.includes('tool_execution_audit_log is append-only') &&
      immutableAuditMigration.includes('CREATE TRIGGER trg_tool_execution_audit_prevent_update') &&
      immutableAuditMigration.includes('CREATE TRIGGER trg_tool_execution_audit_prevent_delete'),
    'delegated code execution emits hash-chained append-only audit records with mutation prevention triggers',
  );

  add(
    'autogen_w06_matrix_program_alias_binding_present',
    matrixSource.includes('| AG-W06 | Code-execution agent participation with safety boundaries | implemented |') &&
      matrixSource.includes('autogen_parity_w06_code_execution_contract') &&
      matrixSource.includes('autogen-w06-code-execution-latest') &&
      programSource.includes('AG-W06') &&
      packageSource.includes('"release:autogen:w06:status"') &&
      packageSource.includes('"release:autogen:w06:status:local"') &&
      contractSource.includes('AutoGen W06 code execution parity contract'),
    'Wave 7 docs and npm bindings include AG-W06 strict evidence lane',
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
  const outJson = path.join(outDir, 'autogen-w06-code-execution-latest.json');
  const outMd = path.join(outDir, 'autogen-w06-code-execution-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# AutoGen W06 Code Execution Status',
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
