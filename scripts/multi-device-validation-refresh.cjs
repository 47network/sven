const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const nodeExe = process.execPath;

const checks = [
  {
    id: 'admin_devices_browser',
    label: 'Admin devices browser flow',
    script: path.join('scripts', 'tmp', 'admin-devices-browser-check.cjs'),
    output: path.join('docs', 'release', 'status', 'admin-devices-browser-latest.json'),
    platform: 'web-admin-device',
    scenario: 'register-pair-command-ack-event',
  },
  {
    id: 'device_entity_runtime',
    label: 'Device and entity runtime flow',
    script: path.join('scripts', 'tmp', 'batch5-device-entity-runtime-check.cjs'),
    output: path.join('docs', 'release', 'status', 'batch5-device-entity-runtime-latest.json'),
    platform: 'runtime-device-entity',
    scenario: 'admin-user-device-handoff',
  },
  {
    id: 'admin_batch5_cross_surface',
    label: 'Admin pairing and widget cross-surface flow',
    script: path.join('scripts', 'tmp', 'admin-batch5-cross-surface-browser-check.cjs'),
    output: path.join('docs', 'release', 'status', 'admin-batch5-cross-surface-browser-latest.json'),
    platform: 'web-admin-cross-surface',
    scenario: 'pairing-and-widget',
  },
];

function runNodeScript(relPath) {
  return spawnSync(nodeExe, [relPath], {
    cwd: root,
    encoding: 'utf8',
    timeout: 300000,
  });
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function writeJson(relPath, value) {
  const full = path.join(root, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(relPath, value) {
  const full = path.join(root, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, value, 'utf8');
}

function extractDeviceId(result) {
  return (
    result?.create?.body?.success === true && String(result?.create?.body?.data?.id || '').trim()
  ) || (
    result?.checks && Array.isArray(result.checks)
      ? String(
          result.checks.find((item) => item?.step === 'admin_device_register')?.body?.data?.id || ''
        ).trim()
      : ''
  );
}

function main() {
  const generatedAt = new Date().toISOString();
  const evidenceLog = path.join(root, 'docs', 'release', 'evidence', 'multi-device-validation-log.jsonl');
  fs.mkdirSync(path.dirname(evidenceLog), { recursive: true });
  const logLines = [];
  if (!fs.existsSync(evidenceLog)) {
    logLines.push(
      JSON.stringify({
        type: 'header',
        created_at: generatedAt,
        note: 'multi-device evidence log',
      }),
    );
  }

  const results = [];
  let overall = 'pass';

  for (const check of checks) {
    const exec = runNodeScript(check.script);
    const payload = parseJson(exec.stdout) || {
      status: exec.status === 0 ? 'pass' : 'fail',
      error: exec.stderr || exec.stdout || `exit ${exec.status}`,
    };
    writeJson(check.output, payload);

    const passed = exec.status === 0 && String(payload.status || '').toLowerCase() === 'pass';
    if (!passed) overall = 'fail';

    const deviceId = extractDeviceId(payload) || check.id;
    logLines.push(
      JSON.stringify({
        type: 'result',
        recorded_at: generatedAt,
        device_id: deviceId,
        platform: check.platform,
        scenario: check.scenario,
        result: passed ? 'pass' : 'fail',
        notes: `${check.label} -> ${check.output}`,
      }),
    );

    results.push({
      id: check.id,
      label: check.label,
      status: passed ? 'pass' : 'fail',
      output: check.output.replaceAll('\\', '/'),
      device_id: deviceId || null,
    });
  }

  fs.appendFileSync(evidenceLog, `${logLines.join('\n')}\n`, 'utf8');

  const summary = {
    source_run_id: process.env.GITHUB_RUN_ID || `local-${Math.floor(Date.now() / 1000)}`,
    generated_at: generatedAt,
    status: overall,
    summary: {
      overall,
      note: overall === 'pass'
        ? 'Canonical multi-device/operator handoff proofs pass on app.sven.systems:44747.'
        : 'One or more canonical multi-device/operator handoff proofs failed.',
    },
    total: results.length,
    failed: results.filter((item) => item.status !== 'pass').length,
    log_path: 'docs/release/evidence/multi-device-validation-log.jsonl',
    checks: results,
    head_sha: process.env.GITHUB_SHA || '',
  };

  const md = [
    '# Multi-device Validation',
    '',
    `Generated: ${generatedAt}`,
    `Status: ${overall}`,
    '',
    `- total: ${summary.total}`,
    `- failed: ${summary.failed}`,
    `- evidence log: ${summary.log_path}`,
    '',
    ...results.map((item) => `- ${item.status.toUpperCase()} ${item.label}: ${item.output}`),
    '',
  ].join('\n');

  writeJson(path.join('docs', 'release', 'status', 'multi-device-validation-latest.json'), summary);
  writeText(path.join('docs', 'release', 'status', 'multi-device-validation-latest.md'), md);

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (overall !== 'pass') process.exitCode = 1;
}

main();
