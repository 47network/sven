#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const vmReportPath = path.join(outDir, 'bridge-vm-ci-lanes-latest.json');
const remoteReportPath = path.join(outDir, 'bridge-ci-lanes-remote-latest.json');

const repoArgIndex = process.argv.findIndex((arg) => arg === '--repo');
const prArgIndex = process.argv.findIndex((arg) => arg === '--pr');
const dryRun = process.argv.includes('--dry-run');

const repo = String(
  (repoArgIndex >= 0 ? process.argv[repoArgIndex + 1] : '')
  || process.env.BRIDGE_VM_CI_PR_REPO
  || process.env.GH_REPO
  || '',
).trim();

const pr = String(
  (prArgIndex >= 0 ? process.argv[prArgIndex + 1] : '')
  || process.env.BRIDGE_VM_CI_PR_NUMBER
  || '',
).trim();

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function formatChecks(report) {
  const checks = Array.isArray(report?.checks) ? report.checks : [];
  if (!checks.length) return '- (no checks)';
  return checks
    .map((check) => {
      const id = String(check.id || '(missing)');
      const pass = Boolean(check.pass);
      const detail = String(check.detail || '(no detail)');
      return `- [${pass ? 'x' : ' '}] \`${id}\` — ${detail}`;
    })
    .join('\n');
}

function runGh(args) {
  const result = spawnSync('gh', args, {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GH_PROMPT_DISABLED: '1',
      GIT_TERMINAL_PROMPT: '0',
    },
  });
  return {
    code: result.status ?? -1,
    out: String(result.stdout || '').trim(),
    err: String(result.stderr || '').trim(),
  };
}

const vmReport = readJson(vmReportPath);
if (!vmReport) {
  console.error(`Missing or invalid JSON: ${path.relative(root, vmReportPath).replace(/\\/g, '/')}`);
  process.exit(2);
}

const remoteReport = readJson(remoteReportPath);
const generatedAt = new Date().toISOString();
const vmStatus = String(vmReport.status || 'fail');
const remoteStatus = remoteReport ? String(remoteReport.status || 'fail') : 'missing';
const authority = String(vmReport?.execution?.authority || 'vm-local');

const body = [
  '## Bridge VM CI Lanes Evidence',
  '',
  `- Generated at: ${generatedAt}`,
  `- VM authority status: \`${vmStatus}\``,
  `- Authority: \`${authority}\``,
  `- Remote bridge status artifact: \`${remoteStatus}\``,
  '',
  '### VM Local Checks',
  formatChecks(vmReport),
  '',
  '### Remote Bridge Checks',
  remoteReport ? formatChecks(remoteReport) : '- (remote artifact missing)',
  '',
  '### Artifacts',
  `- \`docs/release/status/bridge-vm-ci-lanes-latest.json\``,
  `- \`docs/release/status/bridge-vm-ci-lanes-latest.md\``,
  `- \`docs/release/status/bridge-ci-lanes-remote-latest.json\``,
  `- \`docs/release/status/bridge-ci-lanes-remote-latest.md\``,
  '',
].join('\n');

if (dryRun || !repo || !pr) {
  console.log(body);
  if (!repo || !pr) {
    console.log('\nNote: pass --repo <owner/name> and --pr <number> (or set BRIDGE_VM_CI_PR_REPO/BRIDGE_VM_CI_PR_NUMBER) to post this comment.');
  }
  process.exit(0);
}

const post = runGh(['pr', 'comment', '-R', repo, pr, '--body', body]);
if (post.code !== 0) {
  console.error(post.err || post.out || `gh pr comment failed (exit ${String(post.code)})`);
  process.exit(1);
}

console.log(post.out || 'PR comment posted.');
