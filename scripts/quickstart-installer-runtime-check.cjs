#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
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

function withDefaultEnv(env, defaults) {
  return {
    ...env,
    ...Object.fromEntries(
      Object.entries(defaults).map(([key, value]) => [key, env[key] && String(env[key]).length > 0 ? env[key] : value])
    ),
  };
}

function inspectDockerImage(imageRef) {
  const result = runCmd('docker', ['image', 'inspect', imageRef, '--format', '{{.Id}}']);
  return {
    present: result.ok && Boolean(result.out),
    detail: result.ok ? result.out : (result.err || result.out || 'image inspect failed'),
  };
}

function httpGet(url, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let raw = '';
      res.on('data', (chunk) => {
        raw += String(chunk || '');
      });
      res.on('end', () => {
        resolve({
          ok: true,
          status: res.statusCode || 0,
          body: raw,
        });
      });
    });
    req.on('error', (err) => {
      resolve({
        ok: false,
        status: 0,
        error: String(err && err.message ? err.message : err || 'request error'),
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
  });
}

async function waitForHttpHealthy(url, attempts = 20, sleepMs = 1500) {
  for (let i = 0; i < attempts; i += 1) {
    const res = await httpGet(url, 3000);
    if (res.ok && res.status === 200) {
      return { pass: true, detail: `status=200 attempt=${i + 1}` };
    }
    await new Promise((r) => setTimeout(r, sleepMs));
  }
  return { pass: false, detail: 'healthz did not return 200 within wait window' };
}

async function run() {
  const hostPlatform = process.platform;
  const profile = hostPlatform === 'win32' ? 'windows_native' : 'posix_baseline';
  const branchResult = runCmd('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = branchResult.ok ? branchResult.out.split(/\r?\n/)[0].trim() : (process.env.SVEN_BRANCH || 'main');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sven-installer-'));
  const winInstall = path.join(tmp, 'win-src');
  const winPrefix = path.join(tmp, 'win-npm-prefix');
  fs.mkdirSync(winInstall, { recursive: true });
  fs.mkdirSync(winPrefix, { recursive: true });

  const checks = [
  ];
  const requiredCheckIds = [];

  if (profile === 'windows_native') {
    const pwsh = runCmd(
      'powershell',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `$env:SVEN_REPO_URL='${root.replace(/\\/g, '\\\\')}'; ` +
        `$env:SVEN_BRANCH='${branch}'; ` +
        `$env:SVEN_INSTALL_DIR='${winInstall.replace(/\\/g, '\\\\')}'; ` +
        `$env:NPM_CONFIG_PREFIX='${winPrefix.replace(/\\/g, '\\\\')}'; ` +
        `& 'deploy/quickstart/install.ps1'`,
      ]
    );
    const pwshFunctional = runCmd(
      'powershell',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `$env:NPM_CONFIG_PREFIX='${winPrefix.replace(/\\/g, '\\\\')}'; ` +
        `$env:Path="$env:NPM_CONFIG_PREFIX;$env:NPM_CONFIG_PREFIX\\\\node_modules\\\\.bin;$env:Path"; ` +
        `$cmd = Get-Command sven -ErrorAction SilentlyContinue; ` +
        `if (-not $cmd) { Write-Error "sven not resolvable from configured prefix"; exit 11 }; ` +
        `sven --version`,
      ]
    );
    checks.push(
      {
        id: 'powershell_installer_exit_ok',
        pass: pwsh.ok,
        detail: pwsh.ok ? `exit=0 install_dir=${winInstall}` : `exit=${pwsh.code} ${pwsh.err}`,
      },
      {
        id: 'powershell_installer_functional_ready',
        pass: pwsh.ok && pwshFunctional.ok,
        detail:
          pwsh.ok && pwshFunctional.ok
            ? `sven --version => ${pwshFunctional.out.split(/\r?\n/)[0] || 'ok'}`
            : `exit=${pwshFunctional.code} ${(pwshFunctional.err || pwshFunctional.out || '').trim()}`,
      },
    );
    requiredCheckIds.push('powershell_installer_exit_ok', 'powershell_installer_functional_ready');
  } else {
    const shBaseline = runCmd(
      'sh',
      ['-lc', `cd '${root.replace(/'/g, "'\\''")}' && SVEN_INSTALLER_DRY_RUN=1 sh deploy/quickstart/install.sh`],
    );
    const hasInstallStatusJson = String(shBaseline.out || '').includes('INSTALL_STATUS_JSON=');
    checks.push(
      {
        id: 'wsl_sh_installer_exit_and_functional_ready',
        pass: shBaseline.ok,
        detail: 'legacy alias for posix baseline compatibility',
      },
      {
        id: 'quickstart_runtime_baseline_installer_dry_run',
        pass: shBaseline.ok,
        detail: shBaseline.ok ? 'exit=0' : `exit=${shBaseline.code} ${shBaseline.err || shBaseline.out}`,
      },
      {
        id: 'quickstart_runtime_baseline_install_status_emitted',
        pass: shBaseline.ok && hasInstallStatusJson,
        detail: hasInstallStatusJson ? 'INSTALL_STATUS_JSON present' : 'INSTALL_STATUS_JSON not detected',
      },
      {
        id: 'powershell_installer_exit_ok',
        pass: false,
        detail: 'not applicable on non-Windows host',
      },
      {
        id: 'powershell_installer_functional_ready',
        pass: false,
        detail: 'not applicable on non-Windows host',
      },
    );
    requiredCheckIds.push(
      'quickstart_runtime_baseline_installer_dry_run',
      'quickstart_runtime_baseline_install_status_emitted',
    );
  }

  if (profile === 'windows_native') {
    const wslProbe = runCmd('wsl', ['sh', '-lc', 'echo ok']);
    if (wslProbe.ok) {
      const wslRoot = root.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => `/mnt/${d.toLowerCase()}`);
      const wslTmp = tmp.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => `/mnt/${d.toLowerCase()}`);
      const sh = runCmd(
        'wsl',
        [
          'sh',
          '-lc',
          `cd '${wslRoot}' && ` +
          `SVEN_REPO_URL='${wslRoot}' SVEN_BRANCH='${branch}' ` +
          `SVEN_INSTALL_DIR='${wslTmp}/wsl-src' NPM_CONFIG_PREFIX='${wslTmp}/wsl-prefix' ` +
          `sh deploy/quickstart/install.sh && ` +
          `PATH='${wslTmp}/wsl-prefix/bin:$PATH' sven --version`,
        ]
      );
      checks.push({
        id: 'wsl_sh_installer_exit_and_functional_ready',
        pass: sh.ok,
        detail: sh.ok ? `sven --version => ${sh.out.split(/\r?\n/).pop() || 'ok'}` : `exit=${sh.code} ${sh.err}`,
      });
    } else {
      checks.push({
        id: 'wsl_sh_installer_exit_and_functional_ready',
        pass: false,
        detail: 'WSL unavailable',
      });
    }
  }

  const dockerProbe = runCmd('docker', ['version', '--format', '{{.Server.Version}}']);
  const composeProject = `sven_qs_runtime_${Date.now()}`;
  const composeFiles = [path.join(root, 'docker-compose.yml')];
  const composeEnv = withDefaultEnv(
    { ...process.env, COMPOSE_PROJECT_NAME: composeProject },
    {
      DATABASE_URL: 'postgresql://sven:sven-dev-47@postgres:5432/sven',
      POSTGRES_USER: 'sven',
      POSTGRES_PASSWORD: 'sven-dev-47',
      POSTGRES_DB: 'sven',
      ADMIN_PASSWORD: 'quickstart-admin-password',
      COOKIE_SECRET: 'quickstart-cookie-secret-2026-03-09',
      SEARXNG_SECRET: 'quickstart-searxng-secret',
      LITELLM_MASTER_KEY: 'sk-quickstart-litellm-master',
      GRAFANA_ADMIN_PASSWORD: 'quickstart-grafana-admin-password',
      GATEWAY_PORT: '13001',
      SVEN_EXPOSE_POSTGRES_PORT: '127.0.0.1::5432',
      SVEN_EXPOSE_NATS_CLIENT_PORT: '127.0.0.1::4222',
      SVEN_EXPOSE_NATS_MONITORING_PORT: '127.0.0.1::8222',
    }
  );
  const gatewayBaseUrl = `http://127.0.0.1:${composeEnv.GATEWAY_PORT}`;
  const cachedGatewayImage = inspectDockerImage('sven_v010-gateway-api:latest');
  if (cachedGatewayImage.present) {
    const overridePath = path.join(tmp, 'quickstart-runtime.override.yml');
    fs.writeFileSync(
      overridePath,
      [
        'services:',
        '  postgres:',
        '    ports: []',
        '  nats:',
        '    ports: []',
        '  gateway-api:',
        '    image: sven_v010-gateway-api:latest',
        '    pull_policy: never',
        '',
      ].join('\n'),
      'utf8'
    );
    composeFiles.push(overridePath);
  }
  const composeArgs = composeFiles.flatMap((file) => ['-f', file]);
  const skipRuntimeOperability = String(process.env.SVEN_SKIP_QUICKSTART_RUNTIME_OPERABILITY || '').toLowerCase() === 'true';
  if (skipRuntimeOperability) {
    checks.push({
      id: 'quickstart_runtime_stack_healthz_operable',
      pass: false,
      detail: 'skipped via SVEN_SKIP_QUICKSTART_RUNTIME_OPERABILITY=true',
    });
    checks.push({
      id: 'quickstart_runtime_auth_surface_operable',
      pass: false,
      detail: 'skipped via SVEN_SKIP_QUICKSTART_RUNTIME_OPERABILITY=true',
    });
  } else if (!dockerProbe.ok) {
    checks.push({
      id: 'quickstart_runtime_stack_healthz_operable',
      pass: false,
      detail: `docker unavailable: ${dockerProbe.err || dockerProbe.out || 'docker version probe failed'}`,
    });
    checks.push({
      id: 'quickstart_runtime_auth_surface_operable',
      pass: false,
      detail: 'docker unavailable; auth probe not executed',
    });
  } else {
    const up = runCmd(
      'docker',
      ['compose', ...composeArgs, 'up', '-d', '--no-build', 'postgres', 'nats', 'gateway-api'],
      { env: composeEnv }
    );
    if (!up.ok) {
      checks.push({
        id: 'quickstart_runtime_stack_healthz_operable',
        pass: false,
        detail: `compose up failed: ${up.err || up.out || `exit=${up.code}`}`,
      });
      checks.push({
        id: 'quickstart_runtime_auth_surface_operable',
        pass: false,
        detail: 'compose up failed; auth probe not executed',
      });
    } else {
      const healthProbe = await waitForHttpHealthy(`${gatewayBaseUrl}/healthz`);
      checks.push({
        id: 'quickstart_runtime_stack_healthz_operable',
        pass: healthProbe.pass,
        detail: healthProbe.detail,
      });

      const authProbe = await httpGet(`${gatewayBaseUrl}/v1/auth/me`, 4000);
      const authStatus = Number(authProbe.status || 0);
      const authPass = Boolean(authProbe.ok) && [200, 401, 403].includes(authStatus);
      checks.push({
        id: 'quickstart_runtime_auth_surface_operable',
        pass: authPass,
        detail: authPass
          ? `status=${authStatus}`
          : `unexpected status=${authStatus} error=${authProbe.error || 'none'}`,
      });
    }

    runCmd('docker', ['compose', ...composeArgs, 'down', '--remove-orphans'], { env: composeEnv });
  }

  requiredCheckIds.push('quickstart_runtime_stack_healthz_operable', 'quickstart_runtime_auth_surface_operable');
  if (profile === 'windows_native') {
    requiredCheckIds.push('wsl_sh_installer_exit_and_functional_ready');
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
  const outJson = path.join(outDir, 'quickstart-installer-runtime-latest.json');
  const outMd = path.join(outDir, 'quickstart-installer-runtime-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Quickstart Installer Runtime Check\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8'
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
