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

function hasAll(text, patterns) {
  return patterns.every((p) => p.test(text));
}

function run() {
  const rust = read(rustPath);
  const app = read(appPath);
  const api = read(apiPath);

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'device_auth_flow_commands',
    hasAll(rust, [/async fn device_start\(/, /async fn device_poll\(/, /async fn refresh_session\(/]),
    'device_start, device_poll, refresh_session present in Tauri backend',
  );

  add(
    'chat_send_and_timeline_commands',
    hasAll(rust, [/async fn send_message\(/, /async fn fetch_timeline\(/]),
    'send_message and fetch_timeline present in Tauri backend',
  );

  add(
    'approval_read_and_vote_commands',
    hasAll(rust, [/async fn fetch_approvals\(/, /async fn vote_approval\(/]),
    'fetch_approvals and vote_approval present in Tauri backend',
  );

  add(
    'frontend_invokes_core_flows',
    hasAll(app, [/handleDeviceLogin/, /handleRefresh\(/, /handleSend\(/, /handleVoteApproval\(/, /handleRefreshTimeline\(/]),
    'frontend exposes login, refresh, send, approval vote, timeline refresh',
  );

  add(
    'api_bridge_parity_functions',
    hasAll(api, [/export async function deviceStart/, /export async function devicePoll/, /export async function refreshSession/, /export async function sendMessage/, /export async function fetchApprovals/, /export async function fetchTimeline/, /export async function voteApproval/]),
    'api bridge exports parity functions',
  );

  const distIndex = path.join(root, 'apps', 'companion-desktop-tauri', 'dist', 'index.html');
  add('desktop_web_bundle_present', fs.existsSync(distIndex), 'Vite desktop bundle exists at apps/companion-desktop-tauri/dist/index.html');

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : 'fail';
  const at = new Date().toISOString();

  const result = { at, status, passed, failed, checks };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'desktop-tauri-parity-check-latest.json'), JSON.stringify(result, null, 2) + '\n');

  const lines = [
    '# Desktop Tauri Parity Check',
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
  fs.writeFileSync(path.join(outDir, 'desktop-tauri-parity-check-latest.md'), lines.join('\n'));

  console.log(JSON.stringify(result, null, 2));
  if (failed > 0) process.exit(2);
}

run();
