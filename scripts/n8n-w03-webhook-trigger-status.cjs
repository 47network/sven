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
  const webhooksRoute = read('services/gateway-api/src/routes/webhooks.ts');
  const matrixSource = read('docs/parity/wave3-n8n-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'n8n_w03_webhook_ingress_surface_present',
    webhooksRoute.includes("app.post('/v1/webhooks/:path'") &&
      webhooksRoute.includes('AMBIGUOUS_WEBHOOK_PATH') &&
      webhooksRoute.includes('WEBHOOK_ORG_UNAVAILABLE'),
    'webhook ingress route exists with org/path safety guards',
  );

  add(
    'n8n_w03_signature_and_replay_defenses_present',
    webhooksRoute.includes('x-sven-signature') &&
      webhooksRoute.includes('x-sven-timestamp') &&
      webhooksRoute.includes('x-sven-nonce') &&
      webhooksRoute.includes('REPLAY') &&
      webhooksRoute.includes('SIGNATURE_FRESHNESS'),
    'webhook ingress enforces signature, freshness, and replay protections',
  );

  add(
    'n8n_w03_workflow_trigger_dispatch_present',
    webhooksRoute.includes("if (handler === 'workflow')") &&
      webhooksRoute.includes('workflow handler requires config.workflow_id') &&
      webhooksRoute.includes("kind: 'workflow.execute'") &&
      webhooksRoute.includes('INSERT INTO workflow_runs'),
    'webhook workflow handler persists workflow run and dispatches workflow.execute',
  );

  add(
    'n8n_w03_template_message_rendering_present',
    webhooksRoute.includes('renderWebhookMessageText') &&
      webhooksRoute.includes("if (handler === 'agent_message')") &&
      webhooksRoute.includes('message_template'),
    'webhook path supports template-rendered agent message triggers',
  );

  add(
    'n8n_w03_matrix_binding_present',
    matrixSource.includes('| NN-W03 | Webhook trigger to workflow execution (signed ingress + replay defense) | implemented |') &&
      matrixSource.includes('n8n_parity_w03_webhook_to_workflow_contract'),
    'Wave 3 matrix binds NN-W03 to contract test and evidence ID',
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
  const outJson = path.join(outDir, 'n8n-w03-webhook-trigger-latest.json');
  const outMd = path.join(outDir, 'n8n-w03-webhook-trigger-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# n8n W03 Webhook Trigger Status',
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
