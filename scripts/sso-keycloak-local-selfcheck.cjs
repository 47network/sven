#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn, spawnSync } = require('child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict') || process.env.D9_LOCAL_SELFCHECK_STRICT === '1';

function runSync(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    ...options,
  });
  return {
    status: typeof result.status === 'number' ? result.status : 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? String(result.error.message || result.error) : '',
    command: [cmd, ...args].join(' '),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function quoteArg(arg) {
  const s = String(arg);
  if (/[\s"]/u.test(s)) return `"${s.replace(/"/g, '\\"')}"`;
  return s;
}

function runNpmStep(runStep, name, npmArgs) {
  if (process.platform === 'win32') {
    const cmdline = ['npm', ...npmArgs].map(quoteArg).join(' ');
    return runStep(name, 'cmd.exe', ['/d', '/s', '/c', cmdline]);
  }
  return runStep(name, 'npm', npmArgs);
}

function request(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        method: 'GET',
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: parsed.pathname + parsed.search,
      },
      (res) => {
        resolve({ ok: true, statusCode: res.statusCode || 0 });
      },
    );
    req.setTimeout(timeoutMs, () => {
      try {
        req.destroy(new Error('timeout'));
      } catch {}
    });
    req.on('error', (err) => {
      resolve({ ok: false, statusCode: 0, error: String(err && err.message ? err.message : err) });
    });
    req.end();
  });
}

function isTcpPortFree(host, port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findFreePort(host, candidates) {
  for (const port of candidates) {
    if (await isTcpPortFree(host, port)) return port;
  }
  return null;
}

async function waitForUrl(url, maxWaitMs = 30000, pollMs = 1000) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const r = await request(url);
    if (r.ok && r.statusCode >= 200 && r.statusCode < 500) return { pass: true, detail: `reachable=${r.statusCode}` };
    await sleep(pollMs);
  }
  return { pass: false, detail: `timeout waiting for ${url}` };
}

async function waitForHealthz(apiUrl, maxWaitMs = 90000, pollMs = 2000) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const r = await request(`${apiUrl.replace(/\/+$/, '')}/healthz`);
    if (r.ok && r.statusCode === 200) return { pass: true, detail: 'healthz=200' };
    await sleep(pollMs);
  }
  return { pass: false, detail: 'healthz timeout' };
}

async function main() {
  const statusDir = outDir;
  if (!fs.existsSync(statusDir)) fs.mkdirSync(statusDir, { recursive: true });

  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  const testBearerToken = String(process.env.TEST_BEARER_TOKEN || '').trim();
  const missingRequiredEnv = [];
  if (!databaseUrl) missingRequiredEnv.push('DATABASE_URL');
  if (!testBearerToken) missingRequiredEnv.push('TEST_BEARER_TOKEN');

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    GATEWAY_PORT: process.env.GATEWAY_PORT || '3001',
    GATEWAY_HOST: process.env.GATEWAY_HOST || '127.0.0.1',
    API_URL: process.env.API_URL || 'http://127.0.0.1:3001',
    SVEN_MIGRATION_ID_MODE: process.env.SVEN_MIGRATION_ID_MODE || 'text',
    TEST_BEARER_TOKEN: testBearerToken,
  };
  const operatorProvidedNatsUrl = String(process.env.NATS_URL || '').trim();
  if (operatorProvidedNatsUrl) {
    env.NATS_URL = operatorProvidedNatsUrl;
  }
  if (strict) {
    env.SVEN_HARDENING_PROFILE = process.env.SVEN_HARDENING_PROFILE || process.env.SVEN_PROFILE || 'strict';
    env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'local-d9-selfcheck-cookie-secret-2026-03-10';
    env.BROWSER_ENFORCE_CONTAINER = process.env.BROWSER_ENFORCE_CONTAINER || 'true';
    env.SVEN_EGRESS_PROXY = process.env.SVEN_EGRESS_PROXY || 'http://127.0.0.1:3128';
    env.AUTH_DISABLE_TOKEN_EXCHANGE = process.env.AUTH_DISABLE_TOKEN_EXCHANGE || 'true';
    env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'local-d9-selfcheck-admin-password-2026-03-10';
  }
  if (process.env.SVEN_MIGRATION_SKIP_INCOMPATIBLE) {
    env.SVEN_MIGRATION_SKIP_INCOMPATIBLE = process.env.SVEN_MIGRATION_SKIP_INCOMPATIBLE;
  }
  if (process.env.SVEN_MIGRATION_MAX_SERIES) {
    env.SVEN_MIGRATION_MAX_SERIES = process.env.SVEN_MIGRATION_MAX_SERIES;
  }

  const steps = [];
  const runStep = (name, cmd, args, opts = {}) => {
    const r = runSync(cmd, args, { ...opts, env });
    steps.push({
      step: name,
      command: r.command,
      status: r.status,
      stdout: r.stdout,
      stderr: r.error ? `${r.stderr}\n${r.error}`.trim() : r.stderr,
    });
    return r;
  };

  if (missingRequiredEnv.length > 0) {
    steps.push({
      step: 'required_env_validation',
      command: 'validate DATABASE_URL, TEST_BEARER_TOKEN',
      status: 1,
      stdout: '',
      stderr: `missing required env: ${missingRequiredEnv.join(', ')}`,
    });
    return finalize('incomplete', steps, '', '', buildMigrationCoverage(steps), strict);
  }

  let gateway = null;
  let gatewayLogs = '';
  let gatewayErrs = '';
  let localNatsContainerName = null;

  try {
    if (!env.NATS_URL) {
      const natsHost = '127.0.0.1';
      const clientPort = await findFreePort(natsHost, [4223, 4224, 4225, 4226, 4227]);
      const monitorPort = await findFreePort(natsHost, [8223, 8224, 8225, 8226, 8227]);
      if (!clientPort || !monitorPort) {
        steps.push({
          step: 'nats_local_port_allocation',
          command: 'allocate local JetStream NATS ports',
          status: 1,
          stdout: '',
          stderr: 'unable to allocate free local ports for selfcheck NATS',
        });
        return finalize('fail', steps, gatewayLogs, gatewayErrs, buildMigrationCoverage(steps), strict);
      }

      localNatsContainerName = 'sven-d9-selfcheck-nats';
      runStep('cleanup_prior_local_nats', 'docker', ['rm', '-f', localNatsContainerName]);
      const startNats = runStep('start_local_nats', 'docker', [
        'run',
        '-d',
        '--rm',
        '--name',
        localNatsContainerName,
        '-p',
        `${natsHost}:${clientPort}:4222`,
        '-p',
        `${natsHost}:${monitorPort}:8222`,
        'nats:2.10',
        '-js',
        '-m',
        '8222',
      ]);
      if (startNats.status !== 0) {
        return finalize('fail', steps, gatewayLogs, gatewayErrs, buildMigrationCoverage(steps), strict);
      }

      env.NATS_URL = `nats://${natsHost}:${clientPort}`;
      const natsReady = await waitForUrl(`http://${natsHost}:${monitorPort}/jsz`);
      steps.push({
        step: 'wait_local_nats_jetstream',
        command: `http://${natsHost}:${monitorPort}/jsz`,
        status: natsReady.pass ? 0 : 1,
        stdout: natsReady.detail,
        stderr: '',
      });
      if (!natsReady.pass) {
        return finalize('fail', steps, gatewayLogs, gatewayErrs, buildMigrationCoverage(steps), strict);
      }
    }

    let r = runNpmStep(runStep, 'build_shared', ['run', '--workspace', 'packages/shared', 'build']);
    if (r.status !== 0) return finalize('fail', steps, gatewayLogs, gatewayErrs, buildMigrationCoverage(steps), strict);

    r = runNpmStep(runStep, 'build_gateway', ['run', '--workspace', 'services/gateway-api', 'build']);
    if (r.status !== 0) return finalize('fail', steps, gatewayLogs, gatewayErrs, buildMigrationCoverage(steps), strict);

    r = runNpmStep(runStep, 'db_migrate', ['run', '--workspace', 'services/gateway-api', 'db:migrate']);
    if (r.status !== 0) return finalize('fail', steps, gatewayLogs, gatewayErrs, buildMigrationCoverage(steps), strict);

    r = runNpmStep(runStep, 'seed_baseline', ['run', '--workspace', 'services/gateway-api', 'db:seed']);
    if (r.status !== 0) return finalize('fail', steps, gatewayLogs, gatewayErrs, buildMigrationCoverage(steps), strict);

    const seedScript = [
      "const { Client } = require('pg');",
      '(async () => {',
      "  const c = new Client({ connectionString: process.env.DATABASE_URL });",
      '  await c.connect();',
      "  await c.query('INSERT INTO users (id, username, display_name, \"role\", password_hash) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (username) DO NOTHING', ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin','Admin','admin','x']);",
      "  await c.query(\"INSERT INTO sessions (id,user_id,status,created_at,expires_at) VALUES ($1,$2,'active',NOW(),NOW()+interval '7 day') ON CONFLICT (id) DO UPDATE SET user_id=EXCLUDED.user_id,status='active',expires_at=NOW()+interval '7 day'\", [process.env.TEST_BEARER_TOKEN,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);",
      '  await c.end();',
      '})().catch((err) => { console.error(err); process.exit(1); });',
    ].join(' ');
    r = runStep('seed_admin_session', 'node', ['-e', seedScript]);
    if (r.status !== 0) return finalize('fail', steps, gatewayLogs, gatewayErrs, buildMigrationCoverage(steps), strict);

    gateway = spawn('node', ['services/gateway-api/dist/index.js'], {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    gateway.stdout.on('data', (chunk) => {
      gatewayLogs += String(chunk);
    });
    gateway.stderr.on('data', (chunk) => {
      gatewayErrs += String(chunk);
    });
    steps.push({
      step: 'start_gateway',
      command: 'node services/gateway-api/dist/index.js',
      status: 0,
      stdout: '',
      stderr: '',
    });

    const healthy = await waitForHealthz(env.API_URL);
    steps.push({
      step: 'wait_healthz',
      command: `${env.API_URL}/healthz`,
      status: healthy.pass ? 0 : 1,
      stdout: healthy.detail,
      stderr: '',
    });
    if (!healthy.pass) return finalize('fail', steps, gatewayLogs, gatewayErrs, buildMigrationCoverage(steps), strict);

    r = runStep(
      'tenant_rbac_regression',
      'node',
      ['--experimental-vm-modules', '../../node_modules/jest/bin/jest.js', '--config', 'jest.config.cjs', '--runTestsByPath', 'src/__tests__/tenant-rbac.e2e.ts', '--runInBand'],
      { cwd: path.join(root, 'services', 'gateway-api') },
    );
    if (r.status !== 0) return finalize('fail', steps, gatewayLogs, gatewayErrs, buildMigrationCoverage(steps), strict);

    r = runStep('d9_keycloak_gate', 'node', ['scripts/sso-keycloak-interop-gate.cjs', '--with-idp-preflight']);
    if (r.status !== 0) return finalize('fail', steps, gatewayLogs, gatewayErrs, buildMigrationCoverage(steps), strict);

    return finalize('pass', steps, gatewayLogs, gatewayErrs, buildMigrationCoverage(steps), strict);
  } finally {
    if (gateway && !gateway.killed) {
      try {
        gateway.kill('SIGTERM');
      } catch {}
    }
    if (localNatsContainerName) {
      try {
        runSync('docker', ['rm', '-f', localNatsContainerName], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
      } catch {}
    }
  }
}

function parseHighestSeriesSeenFromMigrationsDir() {
  try {
    const migrationsDir = path.join(root, 'services', 'gateway-api', 'src', 'db', 'migrations');
    if (!fs.existsSync(migrationsDir)) return null;
    const names = fs.readdirSync(migrationsDir);
    const series = names
      .map((name) => {
        const m = String(name).match(/^(\d+)_/);
        return m ? Number.parseInt(m[1], 10) : null;
      })
      .filter((value) => Number.isFinite(value));
    if (series.length === 0) return null;
    return Math.max(...series);
  } catch {
    return null;
  }
}

function buildMigrationCoverage(steps) {
  const migrateStep = steps.find((step) => step.step === 'db_migrate') || null;
  const stdout = migrateStep ? String(migrateStep.stdout || '') : '';

  const skipped = [];
  const skipRegex = /Skipping migration due to max-series limit".*?"series":\s*(\d+)/g;
  let match;
  while ((match = skipRegex.exec(stdout)) !== null) {
    const value = Number.parseInt(match[1], 10);
    if (Number.isFinite(value)) skipped.push(value);
  }

  const highestSeriesSeen = parseHighestSeriesSeenFromMigrationsDir();
  const skippedUniqueSorted = Array.from(new Set(skipped)).sort((a, b) => a - b);
  const maxSeriesApplied = highestSeriesSeen === null
    ? null
    : skippedUniqueSorted.length > 0
      ? Math.max(
        0,
        ...Array.from({ length: highestSeriesSeen }, (_, idx) => idx + 1).filter((series) => !skippedUniqueSorted.includes(series)),
      )
      : highestSeriesSeen;

  return {
    max_series_applied: maxSeriesApplied,
    highest_series_seen: highestSeriesSeen,
    skipped_series: skippedUniqueSorted,
    skipped_due_to_cap: skippedUniqueSorted.length > 0,
  };
}

function finalize(status, steps, gatewayLogs, gatewayErrs, migrationCoverage, strictMode) {
  let finalStatus = status;
  const coverage = migrationCoverage || buildMigrationCoverage(steps);
  const hardening = buildHardeningRiskSummary(gatewayLogs);
  if (strictMode && coverage.skipped_due_to_cap) {
    finalStatus = 'fail';
  }
  if (strictMode && hardening.risk_detected) {
    finalStatus = 'fail';
  }

  const report = {
    type: 'd9_keycloak_local_selfcheck',
    generated_at_utc: new Date().toISOString(),
    status: finalStatus,
    strict_mode: strictMode,
    source_run_id: String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim() || null,
    head_sha: String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim() || null,
    source_ref: String(process.env.GITHUB_REF || process.env.CI_COMMIT_REF_NAME || '').trim() || null,
    input_provenance: {
      database_url_provided: Boolean(String(process.env.DATABASE_URL || '').trim()),
      test_bearer_token_provided: Boolean(String(process.env.TEST_BEARER_TOKEN || '').trim()),
    },
    hardening_risks: hardening,
    migration_coverage: coverage,
    steps,
  };
  const outJson = path.join(outDir, 'd9-keycloak-local-selfcheck-latest.json');
  const outMd = path.join(outDir, 'd9-keycloak-local-selfcheck-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const md = [
    '# D9 Keycloak Local Selfcheck',
    '',
    `- Generated: ${report.generated_at_utc}`,
    `- Status: ${finalStatus.toUpperCase()}`,
    `- Strict mode: ${strictMode ? 'ON' : 'OFF'}`,
    `- Source run id: ${report.source_run_id || 'n/a'}`,
    `- Head SHA: ${report.head_sha || 'n/a'}`,
    `- Source ref: ${report.source_ref || 'n/a'}`,
    '',
    '## Input Provenance',
    '',
    `- database_url_provided: ${report.input_provenance.database_url_provided ? 'true' : 'false'}`,
    `- test_bearer_token_provided: ${report.input_provenance.test_bearer_token_provided ? 'true' : 'false'}`,
    '',
    '## Startup Hardening Risk Summary',
    '',
    `- risk_detected: ${hardening.risk_detected ? 'true' : 'false'}`,
    `- risk_codes: ${hardening.codes.length ? hardening.codes.join(', ') : '(none)'}`,
    `- risk_count: ${hardening.codes.length}`,
    '',
    '## Migration Coverage',
    '',
    `- highest_series_seen: ${coverage.highest_series_seen === null ? '(unknown)' : coverage.highest_series_seen}`,
    `- max_series_applied: ${coverage.max_series_applied === null ? '(unknown)' : coverage.max_series_applied}`,
    `- skipped_series_count: ${coverage.skipped_series.length}`,
    `- skipped_series: ${coverage.skipped_series.length ? coverage.skipped_series.join(', ') : '(none)'}`,
    `- skipped_due_to_cap: ${coverage.skipped_due_to_cap ? 'true' : 'false'}`,
    '',
    '## Steps',
    '',
    ...steps.map((s) => `- ${s.step}: status=${s.status}`),
    '',
    '## Gateway Stdout',
    '',
    '```text',
    (gatewayLogs || '(empty)').slice(-8000),
    '```',
    '',
    '## Gateway Stderr',
    '',
    '```text',
    (gatewayErrs || '(empty)').slice(-8000),
    '```',
    '',
  ];
  fs.writeFileSync(outMd, md.join('\n'), 'utf8');
  console.log(`wrote: ${path.relative(root, outJson)}`);
  console.log(`wrote: ${path.relative(root, outMd)}`);
  console.log(`status: ${finalStatus}`);
  process.exit(finalStatus === 'pass' ? 0 : 1);
}

function buildHardeningRiskSummary(gatewayLogs) {
  const lines = String(gatewayLogs || '').split(/\r?\n/);
  const codes = new Set();
  const messages = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!trimmed.includes('SECURITY STARTUP RISK')) continue;
    messages.push(trimmed);
    try {
      const payload = JSON.parse(trimmed);
      const issues = Array.isArray(payload.issues) ? payload.issues : [];
      for (const issue of issues) {
        const code = String(issue && issue.code ? issue.code : '').trim();
        if (code) codes.add(code);
      }
    } catch {
      const re = /"code"\s*:\s*"([^"]+)"/g;
      let match;
      while ((match = re.exec(trimmed)) !== null) {
        const code = String(match[1] || '').trim();
        if (code) codes.add(code);
      }
    }
  }
  return {
    risk_detected: messages.length > 0,
    codes: Array.from(codes).sort(),
    sample_messages: messages.slice(0, 3),
  };
}

main().catch((err) => {
  console.error(String(err && err.stack ? err.stack : err));
  process.exit(1);
});
