#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

function run() {
  const capPath = path.join(root, 'apps', 'companion-desktop-tauri', 'src-tauri', 'capabilities', 'default.json');
  const cap = JSON.parse(fs.readFileSync(capPath, 'utf8'));
  const perms = Array.isArray(cap.permissions) ? cap.permissions : [];

  const checks = [
    {
      id: 'capabilities_file_present',
      pass: true,
      detail: 'apps/companion-desktop-tauri/src-tauri/capabilities/default.json',
    },
    {
      id: 'shell_plugin_not_enabled',
      pass: !perms.some((p) => String(p).includes('shell')),
      detail: perms.filter((p) => String(p).includes('shell')).join(', ') || 'none',
    },
    {
      id: 'filesystem_plugin_not_enabled',
      pass: !perms.some((p) => String(p).includes('fs')),
      detail: perms.filter((p) => String(p).includes('fs')).join(', ') || 'none',
    },
    {
      id: 'dangerous_plugins_not_enabled',
      pass: !perms.some((p) => {
        const v = String(p);
        return v.includes('shell') || v.includes('process') || v.includes('cli');
      }),
      detail: perms.join(', '),
    },
    {
      id: 'core_default_profile_present',
      pass: perms.some((p) => String(p) === 'core:default')
        && perms.some((p) => String(p).startsWith('core:window:'))
        && perms.some((p) => String(p).startsWith('core:webview:')),
      detail: perms.join(', '),
    },
  ];

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = { generated_at: new Date().toISOString(), status, checks };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'desktop-capability-review-latest.json');
  const outMd = path.join(outDir, 'desktop-capability-review-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Desktop Capability Review Check\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8'
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
