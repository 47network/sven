#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function run() {
  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add('shared_tokens_source', exists('packages/shared/design/tokens.json'), 'packages/shared/design/tokens.json exists');

  const adminGlobals = exists('apps/admin-ui/src/app/globals.css') ? read(path.join(root, 'apps/admin-ui/src/app/globals.css')) : '';
  add('admin_imports_tokens_css', /@import ['"]\.\/tokens\.css['"]/.test(adminGlobals), 'admin globals imports tokens.css');

  const canvasGlobals = exists('apps/canvas-ui/src/app/globals.css') ? read(path.join(root, 'apps/canvas-ui/src/app/globals.css')) : '';
  add('canvas_imports_tokens_css', /@import ['"]\.\/tokens\.css['"]/.test(canvasGlobals), 'canvas globals imports tokens.css');

  const mobileApp = exists('apps/companion-mobile/App.tsx') ? read(path.join(root, 'apps/companion-mobile/App.tsx')) : '';
  add('mobile_imports_tokens_module', /from '\.\/src\/theme\/tokens'/.test(mobileApp), 'mobile app imports theme tokens module');
  add('mobile_tokens_module_exists', exists('apps/companion-mobile/src/theme/tokens.ts'), 'mobile tokens module exists');

  const desktopStyles = exists('apps/companion-desktop-tauri/src/styles.css') ? read(path.join(root, 'apps/companion-desktop-tauri/src/styles.css')) : '';
  add('desktop_imports_tokens_css', /@import ['"]\.\/tokens\.css['"]/.test(desktopStyles), 'desktop styles import tokens.css');
  add('desktop_tokens_css_exists', exists('apps/companion-desktop-tauri/src/tokens.css'), 'desktop tokens.css exists');

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : 'fail';
  const at = new Date().toISOString();

  const report = { generated_at: at, status, passed, failed, checks };
  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'design-token-consumption-latest.json');
  const outMd = path.join(outDir, 'design-token-consumption-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Design Token Consumption Check',
    '',
    `Generated: ${at}`,
    `Status: ${status}`,
    `Passed: ${passed}`,
    `Failed: ${failed}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
  if (failed > 0) process.exit(2);
}

run();
