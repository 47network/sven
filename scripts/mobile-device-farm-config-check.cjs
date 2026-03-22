#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const requiredFiles = [
  '.github/workflows/flutter-user-app-device-farm.yml',
  'scripts/ops/mobile/maestro-cloud-run.sh',
  'apps/companion-user-flutter/.maestro/flows/android-smoke.yaml',
  'apps/companion-user-flutter/.maestro/flows/ios-smoke.yaml',
];

const checks = requiredFiles.map((file) => {
  const exists = fs.existsSync(path.join(process.cwd(), file));
  return { id: `exists:${file}`, pass: exists };
});

const wfPath = path.join(process.cwd(), '.github/workflows/flutter-user-app-device-farm.yml');
if (fs.existsSync(wfPath)) {
  const workflow = fs.readFileSync(wfPath, 'utf8');
  checks.push({
    id: 'workflow:has_android_job',
    pass: /android-maestro-cloud:/.test(workflow),
  });
  checks.push({
    id: 'workflow:has_ios_job',
    pass: /ios-maestro-cloud:/.test(workflow),
  });
  checks.push({
    id: 'workflow:uses_maestro_secret',
    pass: /MAESTRO_CLOUD_API_KEY/.test(workflow),
  });
}

const legacyWorkflowPath = path.join(process.cwd(), '.github/workflows/mobile-device-farm.yml');
if (fs.existsSync(legacyWorkflowPath)) {
  const legacyWorkflow = fs.readFileSync(legacyWorkflowPath, 'utf8');
  checks.push({
    id: 'legacy_workflow_marked_deprecated',
    pass: /deprecated/i.test(legacyWorkflow),
  });
}

const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
const outDir = path.join(process.cwd(), 'docs/release/status');
const outJson = path.join(outDir, 'mobile-device-farm-config-latest.json');
const outMd = path.join(outDir, 'mobile-device-farm-config-latest.md');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  outJson,
  `${JSON.stringify({ generated_at: new Date().toISOString(), status, checks }, null, 2)}\n`,
  'utf8',
);
const lines = [
  '# Mobile Device Farm Config Check',
  '',
  `Status: ${status}`,
  '',
  '## Checks',
  ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}`),
  '',
];
fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${outJson}`);
console.log(`Wrote ${outMd}`);
if (status !== 'pass') process.exit(2);
