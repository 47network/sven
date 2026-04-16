#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

function read(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function runCmd(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    shell: process.platform === 'win32',
    ...options,
  });
  return {
    ok: result.status === 0,
    status: typeof result.status === 'number' ? result.status : 1,
    out: String(result.stdout || ''),
    err: String(result.stderr || ''),
  };
}

function cmdPreview(result) {
  const text = `${result.out || ''}\n${result.err || ''}`.trim();
  return text ? text.slice(0, 240).replace(/\s+/g, ' ') : '(no output)';
}

function run() {
  const quickstartPath = 'docs/onboarding/client-quickstart-2026.md';
  const troubleshootingPath = 'docs/ops/troubleshooting-tree-2026.md';
  const quickstart = read(quickstartPath);
  const troubleshooting = read(troubleshootingPath);
  const smoke = [];

  const nodeMajor = Number(String(process.versions.node || '0').split('.')[0] || 0);
  smoke.push({
    id: 'smoke_node_runtime_supported',
    pass: nodeMajor >= 20,
    detail: `node=${process.versions.node}`,
  });

  const npmVersion = runCmd('npm', ['--version']);
  smoke.push({
    id: 'smoke_npm_available',
    pass: npmVersion.ok,
    detail: npmVersion.ok ? `npm=${npmVersion.out.trim()}` : cmdPreview(npmVersion),
  });

  const ciDryRun = runCmd('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts', '--lockfile-only']);
  smoke.push({
    id: 'smoke_bootstrap_npm_ci_dry_run',
    pass: ciDryRun.ok,
    detail: ciDryRun.ok ? 'pnpm install --lockfile-only succeeded' : cmdPreview(ciDryRun),
  });

  const releaseStatus = runCmd(process.execPath, ['scripts/release-status.js']);
  const latestStatusPath = path.join(root, 'docs', 'release', 'status', 'latest.json');
  smoke.push({
    id: 'smoke_release_status_command_executes',
    pass: releaseStatus.ok && fs.existsSync(latestStatusPath),
    detail:
      releaseStatus.ok && fs.existsSync(latestStatusPath)
        ? 'release-status command executed and latest.json emitted'
        : cmdPreview(releaseStatus),
  });

  const apiUrl = String(process.env.API_URL || '').trim();
  if (apiUrl) {
    const health = runCmd(process.execPath, [
      '-e',
      `fetch(${JSON.stringify(`${apiUrl.replace(/\/+$/, '')}/healthz`)}).then(r=>{if(!r.ok){process.exit(2)};process.stdout.write(String(r.status));}).catch(()=>process.exit(3));`,
    ]);
    smoke.push({
      id: 'smoke_healthcheck_live_target',
      pass: health.ok,
      detail: health.ok ? `api_url=${apiUrl}; status=${health.out.trim() || 'ok'}` : `api_url=${apiUrl}; ${cmdPreview(health)}`,
    });
  } else {
    smoke.push({
      id: 'smoke_healthcheck_live_target',
      pass: false,
      detail: 'API_URL missing; live health probe not executed',
    });
  }

  const checks = [
    {
      id: 'quickstart_doc_present',
      pass: Boolean(quickstart),
      detail: quickstartPath,
    },
    {
      id: 'quickstart_covers_mobile_web_desktop_cli',
      pass: quickstart.includes('## 2. Web/Admin')
        && quickstart.includes('## 3. Mobile (Expo)')
        && quickstart.includes('## 4. Desktop (Tauri)')
        && quickstart.includes('## 5. CLI'),
      detail: 'expects sections for all client surfaces',
    },
    {
      id: 'quickstart_covers_smoke_validation',
      pass: quickstart.includes('release:verify:post')
        && quickstart.includes('release:edge:network:check'),
      detail: 'expects release smoke commands',
    },
    {
      id: 'troubleshooting_tree_present',
      pass: Boolean(troubleshooting),
      detail: troubleshootingPath,
    },
    {
      id: 'troubleshooting_covers_auth_latency_and_release_gates',
      pass: troubleshooting.includes('## Auth Failures')
        && troubleshooting.includes('## Elevated Errors or Latency')
        && troubleshooting.includes('## Release Gate Failure'),
      detail: 'expects auth/latency/release gate branches',
    },
  ];

  checks.push({
    id: 'onboarding_smoke_exercises_pass',
    pass: smoke.every((s) => s.pass),
    detail: `${smoke.filter((s) => s.pass).length}/${smoke.length} smoke checks passed`,
  });

  const status = checks.some((c) => !c.pass) || smoke.some((s) => !s.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    run_id: String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim(),
    head_sha: String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim(),
    source_ref: String(process.env.GITHUB_REF || process.env.CI_COMMIT_REF_NAME || '').trim(),
    api_url: apiUrl || null,
    status,
    checks,
    smoke,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'onboarding-readiness-latest.json');
  const outMd = path.join(outDir, 'onboarding-readiness-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Onboarding Readiness Check',
    '',
    `Generated: ${report.generated_at}`,
    `Run ID: ${report.run_id || 'n/a'}`,
    `Head SHA: ${report.head_sha || 'n/a'}`,
    `Source ref: ${report.source_ref || 'n/a'}`,
    `API URL: ${report.api_url || '(unset)'}`,
    `Status: ${report.status}`,
    '',
    '## Smoke',
    ...smoke.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();

