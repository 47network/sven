#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'openclaw-workflows-runtime-latest.json');
const outMd = path.join(outDir, 'openclaw-workflows-runtime-latest.md');

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function readUtf8(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function hasAll(source, values) {
  return values.every((value) => source.includes(value));
}

function runNpm(args) {
  if (process.platform === 'win32') {
    const cmdline = `npm ${args.join(' ')}`;
    return spawnSync('cmd.exe', ['/d', '/s', '/c', cmdline], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  }
  return spawnSync('npm', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function resultPayload(id, command, result) {
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  return {
    id,
    command,
    exit_code: exitCode,
    pass: exitCode === 0,
    error: result.error ? String(result.error.message || result.error) : null,
    stdout_excerpt: String(result.stdout || '').split(/\r?\n/).slice(-25),
    stderr_excerpt: String(result.stderr || '').split(/\r?\n/).slice(-25),
  };
}

function run() {
  const checks = [];
  const commandRuns = [];

  const dataShapingRun = runNpm(['--prefix', 'services/workflow-executor', 'run', '-s', 'test:data-shaping']);
  commandRuns.push(resultPayload(
    'workflow_executor_data_shaping_tests_check',
    'npm --prefix services/workflow-executor run -s test:data-shaping',
    dataShapingRun,
  ));

  checks.push({
    id: 'workflow_executor_data_shaping_tests_pass',
    pass: commandRuns.every((runItem) => runItem.pass),
    detail: 'workflow executor data-shaping build + runtime tests pass',
  });

  const workflowExecutorSource = readUtf8('services/workflow-executor/src/index.ts');
  checks.push({
    id: 'typed_workflow_step_surface_present',
    pass: hasAll(workflowExecutorSource, [
      "case 'tool_call'",
      "case 'approval'",
      "case 'conditional'",
      "case 'notification'",
      "case 'data_shape'",
      "case 'llm_task'",
      'applyStepOutputMappings(',
      'output_variables',
      'step_results',
    ]),
    detail: 'workflow runtime supports typed step classes with output mapping and step result envelope',
  });

  const workflowRouteSource = readUtf8('services/gateway-api/src/routes/admin/workflows.ts');
  checks.push({
    id: 'approval_gate_surface_present',
    pass: hasAll(workflowRouteSource, [
      "if (stepType === 'approval')",
      'quorum_required',
      'approvers must be an array',
      'quorum_required cannot exceed approvers length',
    ]) && hasAll(workflowExecutorSource, [
      'INSERT INTO approvals',
      'FROM approval_votes',
      "throw new Error('Approval denied')",
      'Approval timed out after',
    ]),
    detail: 'approval-gated workflow steps enforce approver/quorum rules and fail-closed timeout behavior',
  });

  const dataShapingSource = readUtf8('services/workflow-executor/src/data-shaping.ts');
  checks.push({
    id: 'data_shaping_operators_present',
    pass: hasAll(dataShapingSource, [
      "op: 'where'",
      "op: 'pick'",
      "op: 'head' | 'tail'",
      'applyDataShapingPipeline(',
      'applyWhere(',
      'applyPick(',
    ]),
    detail: 'data-shaping pipeline supports where/pick/head-tail operators',
  });

  checks.push({
    id: 'resume_replay_controls_surface_present',
    pass: hasAll(workflowRouteSource, [
      "/workflow-runs/:run_id/resume",
      "/workflow-runs/:run_id/pause",
      "/workflow-runs/:run_id/steps/:step_id/retry",
      "kind: 'workflow.retry_step'",
      "status: 'retry_queued'",
    ]) && hasAll(workflowExecutorSource, [
      "if (data.kind === 'workflow.retry_step')",
      'processWorkflowRetryStepMessage(',
      "if (status === 'paused')",
    ]),
    detail: 'workflow runtime exposes pause/resume and step replay/retry with event-driven execution',
  });

  checks.push({
    id: 'workflow_terminal_execution_surface_present',
    pass: exists('scripts/test-workflow-e2e.js') && hasAll(readUtf8('scripts/test-workflow-e2e.js'), [
      "request('POST', `/workflows/${workflowId}/execute`",
      "request('POST', `/workflow-runs/${pauseRunId}/pause`",
      "request('POST', `/workflow-runs/${pauseRunId}/resume`",
      "request('POST', `/workflow-runs/${cancelRunId}/cancel`",
    ]),
    detail: 'workflow runs can be executed and controlled from terminal automation scripts',
  });

  checks.push({
    id: 'llm_task_step_surface_present',
    pass: hasAll(workflowExecutorSource, [
      'executeLlmTask(',
      '/v1/chat/completions',
      'response_format',
      'json_schema',
      'model_used',
      'provider_used',
    ]) && hasAll(workflowRouteSource, [
      "if (stepType === 'llm_task')",
      'prompt is required',
      'temperature must be a number between 0 and 2',
    ]),
    detail: 'workflow runtime supports validated llm_task steps backed by provider calls',
  });

  checks.push({
    id: 'sandbox_aware_workflow_dispatch_surface_present',
    pass: hasAll(workflowExecutorSource, [
      "throw new Error('workflow tool_call step requires user identity')",
      "this.nc.publish('tool.run.request'",
      'waitForRunRunnable(',
      "if (status === 'error' || status === 'failed' || status === 'cancelled')",
    ]),
    detail: 'workflow tool dispatch uses runtime tool bus with identity binding and cancellation-aware control checks',
  });

  const status = checks.every((check) => check.pass) ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    mapped_openclaw_rows: ['10.1', '10.2', '10.3', '10.4', '10.5', '10.6', '10.7', '10.8'],
    checks,
    command_runs: commandRuns,
    source_files: [
      'services/workflow-executor/src/index.ts',
      'services/workflow-executor/src/data-shaping.ts',
      'services/workflow-executor/test/data-shaping.test.cjs',
      'services/gateway-api/src/routes/admin/workflows.ts',
      'scripts/test-workflow-e2e.js',
    ],
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenClaw Workflows Runtime Check',
      '',
      `Generated: ${payload.generated_at}`,
      `Status: ${status}`,
      '',
      `Mapped OpenClaw rows: ${payload.mapped_openclaw_rows.join(', ')}`,
      '',
      '## Checks',
      ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
      '',
      '## Command Runs',
      ...commandRuns.map((runItem) => `- ${runItem.id}: exit_code=${runItem.exit_code} (\`${runItem.command}\`)`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
  console.log(`openclaw-workflows-runtime-check: ${status}`);
  if (strict && status !== 'pass') {
    process.exit(2);
  }
}

run();

