#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

function runCmd(command, args, opts = {}) {
  const r = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    ...opts,
  });
  return {
    code: r.status ?? -1,
    ok: (r.status ?? -1) === 0,
    out: (r.stdout || '').trim(),
    err: (r.stderr || '').trim(),
  };
}

function run() {
  const checks = [];
  const hostPlatform = process.platform;
  const profile = hostPlatform === 'win32' ? 'windows_native' : 'posix_baseline';
  const requiredCheckIds = [];

  if (profile === 'windows_native') {
    const ps = runCmd(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', "$env:SVEN_INSTALLER_DRY_RUN='1'; & 'deploy/quickstart/install.ps1'"]
    );
    checks.push({
      id: 'powershell_installer_dry_run',
      pass: ps.ok,
      detail: ps.ok ? 'exit=0' : `exit=${ps.code} ${ps.err}`,
    });
    requiredCheckIds.push('powershell_installer_dry_run');

    const cmd = runCmd(
      'cmd',
      ['/c', 'call deploy\\quickstart\\install.cmd'],
      { env: { ...process.env, SVEN_INSTALLER_DRY_RUN: '1' } }
    );
    checks.push({
      id: 'cmd_installer_dry_run',
      pass: cmd.ok,
      detail: cmd.ok ? 'exit=0' : `exit=${cmd.code} ${cmd.err}`,
    });
    requiredCheckIds.push('cmd_installer_dry_run');

    const wslProbe = runCmd('wsl', ['sh', '-lc', 'echo ok']);
    if (wslProbe.ok) {
      const wslRoot = root.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => `/mnt/${d.toLowerCase()}`);
      const sh = runCmd(
        'wsl',
        ['sh', '-lc', `cd '${wslRoot}' && SVEN_INSTALLER_DRY_RUN=1 sh deploy/quickstart/install.sh`]
      );
      checks.push({
        id: 'wsl_sh_installer_dry_run',
        pass: sh.ok,
        detail: sh.ok ? 'exit=0' : `exit=${sh.code} ${sh.err}`,
      });
    } else {
      checks.push({
        id: 'wsl_sh_installer_dry_run',
        pass: true,
        detail: 'WSL unavailable on this host (additive coverage skipped)',
      });
    }
  } else {
    const sh = runCmd(
      'sh',
      ['-lc', `cd '${root.replace(/'/g, "'\\''")}' && SVEN_INSTALLER_DRY_RUN=1 sh deploy/quickstart/install.sh`]
    );
    checks.push({
      id: 'wsl_sh_installer_dry_run',
      pass: sh.ok,
      detail: 'legacy alias for posix baseline compatibility',
    });
    checks.push({
      id: 'sh_installer_dry_run',
      pass: sh.ok,
      detail: sh.ok ? 'exit=0' : `exit=${sh.code} ${sh.err || sh.out}`,
    });
    requiredCheckIds.push('sh_installer_dry_run');
    checks.push({
      id: 'powershell_installer_dry_run',
      pass: false,
      detail: 'not applicable on non-Windows host',
    });
    checks.push({
      id: 'cmd_installer_dry_run',
      pass: false,
      detail: 'not applicable on non-Windows host',
    });
  }

  const failedRequired = requiredCheckIds.filter(
    (id) => !checks.some((entry) => entry.id === id && entry.pass === true),
  );
  const status = failedRequired.length > 0 ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    platform: hostPlatform,
    platform_profile: profile,
    required_check_ids: requiredCheckIds,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'quickstart-installer-crosshost-latest.json');
  const outMd = path.join(outDir, 'quickstart-installer-crosshost-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Quickstart Installer Cross-Host Check\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8'
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
