#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const rustPath = path.join(root, 'apps', 'companion-desktop-tauri', 'src-tauri', 'src', 'main.rs');
const appPath = path.join(root, 'apps', 'companion-desktop-tauri', 'src', 'App.tsx');
const apiPath = path.join(root, 'apps', 'companion-desktop-tauri', 'src', 'lib', 'api.ts');
const outDir = path.join(root, 'docs', 'release', 'status');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function run() {
  const rust = read(rustPath);
  const app = read(appPath);
  const api = read(apiPath);

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add('rust_keyring_dependency_usage', /use keyring::Entry;/.test(rust) && /fn set_secret\(/.test(rust), 'Rust keyring APIs imported and set_secret command present');
  add('rust_get_clear_secret_commands', /fn get_secret\(/.test(rust) && /fn clear_secret\(/.test(rust), 'get_secret and clear_secret commands present');
  add('desktop_config_no_token_field', !/access_token/.test(rust.match(/struct DesktopConfig[\s\S]*?\}/)?.[0] || ''), 'DesktopConfig contains no access token field');
  add('frontend_uses_secret_bridge', /getSecret\('access_token'\)/.test(app) && /setSecret\('access_token'/.test(app), 'Frontend reads/writes token through secure bridge');
  add('frontend_no_localstorage_token', !/localStorage|sessionStorage/.test(app), 'No local/session storage token fallback in UI layer');
  add('api_exposes_secret_bridge_only', /invoke\('set_secret'/.test(api) && /invoke\('get_secret'/.test(api), 'API bridge exposes secret commands');

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : 'fail';
  const at = new Date().toISOString();

  const result = { at, status, passed, failed, checks };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'desktop-tauri-securestore-check-latest.json'), JSON.stringify(result, null, 2) + '\n');

  const lines = [
    '# Desktop Tauri Secure Store Check',
    '',
    `- Time: ${at}`,
    `- Status: ${status}`,
    `- Passed: ${passed}`,
    `- Failed: ${failed}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(path.join(outDir, 'desktop-tauri-securestore-check-latest.md'), lines.join('\n'));

  console.log(JSON.stringify(result, null, 2));
  if (failed > 0) process.exit(2);
}

run();
