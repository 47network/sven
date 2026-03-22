#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const http = require('http');
const https = require('https');

const root = process.cwd();
const statusDir = path.join(root, 'docs', 'release', 'status');
const KEYCLOAK_BASE_URL = (process.env.KEYCLOAK_BASE_URL || 'http://127.0.0.1:8081').replace(/\/+$/, '');
const KEYCLOAK_REALM = String(process.env.KEYCLOAK_REALM || 'sven').trim();
const REQUIRE_LIVE_EVIDENCE = String(process.env.D9_REQUIRE_LIVE_EVIDENCE || '').trim() === '1';

function run(cmd, args, env = process.env) {
  return spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    env,
  });
}

function shellLine(cmd, args) {
  return [cmd, ...args].join(' ');
}

function parseArgs(argv) {
  return {
    withIdpPreflight: argv.includes('--with-idp-preflight'),
    autoIdp: !argv.includes('--no-auto-idp'),
  };
}

function request(url, timeoutMs) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.request(
      {
        method: 'GET',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: { accept: 'application/json,text/plain,*/*' },
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

async function waitForKeycloakReady(maxWaitMs = 180000, pollMs = 2000) {
  const startedAt = Date.now();
  const url = `${KEYCLOAK_BASE_URL}/realms/${encodeURIComponent(KEYCLOAK_REALM)}/.well-known/openid-configuration`;
  while (Date.now() - startedAt < maxWaitMs) {
    const r = await request(url, Math.min(5000, pollMs));
    if (r.ok && r.statusCode >= 200 && r.statusCode < 300) {
      return { pass: true, detail: `ready status=${r.statusCode}` };
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return { pass: false, detail: `timeout waiting for ${url}` };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(statusDir)) fs.mkdirSync(statusDir, { recursive: true });

  const steps = [];
  let idpStartedByGate = false;

  if (args.withIdpPreflight && args.autoIdp) {
    const upArgs = ['compose', '-f', 'docker-compose.sso-idp.yml', 'up', '-d'];
    const up = run('docker', upArgs);
    steps.push({
      step: 'compose_up',
      command: shellLine('docker', upArgs),
      status: up.status,
      stdout: up.stdout || '',
      stderr: up.stderr || '',
    });
    if (up.status !== 0) {
      return finalize('fail', steps, args);
    }
    idpStartedByGate = true;

    const ready = await waitForKeycloakReady();
    steps.push({
      step: 'keycloak_ready_wait',
      command: `wait_for ${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration`,
      status: ready.pass ? 0 : 1,
      stdout: ready.detail,
      stderr: '',
    });
    if (!ready.pass) {
      return finalize('fail', steps, args, idpStartedByGate);
    }
  }

  const preflightArgs = ['scripts/sso-keycloak-interop-preflight.cjs', '--strict'];
  if (args.withIdpPreflight) preflightArgs.push('--with-idp');
  const preflight = run('node', preflightArgs);
  steps.push({
    step: 'preflight_strict',
    command: shellLine('node', preflightArgs),
    status: preflight.status,
    stdout: preflight.stdout || '',
    stderr: preflight.stderr || '',
  });
  if (preflight.status !== 0) {
    return finalize('fail', steps, args, idpStartedByGate);
  }

  const evidenceArgs = ['scripts/sso-keycloak-interop-evidence.cjs'];
  if (args.autoIdp && !idpStartedByGate) evidenceArgs.push('--auto-start-idp');
  const evidence = run('node', evidenceArgs);
  steps.push({
    step: 'live_evidence',
    command: shellLine('node', evidenceArgs),
    status: evidence.status,
    stdout: evidence.stdout || '',
    stderr: evidence.stderr || '',
  });
  if (evidence.status !== 0 && REQUIRE_LIVE_EVIDENCE) {
    return finalize('fail', steps, args, idpStartedByGate);
  }
  if (evidence.status !== 0 && !REQUIRE_LIVE_EVIDENCE) {
    return finalize('pass', steps, args, idpStartedByGate);
  }

  const checkArgs = ['scripts/sso-keycloak-evidence-check.cjs', '--strict'];
  const evidenceCheck = run('node', checkArgs);
  steps.push({
    step: 'evidence_check_strict',
    command: shellLine('node', checkArgs),
    status: evidenceCheck.status,
    stdout: evidenceCheck.stdout || '',
    stderr: evidenceCheck.stderr || '',
  });
  if (evidenceCheck.status !== 0) {
    return finalize('fail', steps, args, idpStartedByGate);
  }

  return finalize('pass', steps, args, idpStartedByGate);
}

function finalize(status, steps, args, idpStartedByGate = false) {
  if (idpStartedByGate) {
    const downArgs = ['compose', '-f', 'docker-compose.sso-idp.yml', 'down', '-v'];
    const down = run('docker', downArgs);
    steps.push({
      step: 'compose_down',
      command: shellLine('docker', downArgs),
      status: down.status,
      stdout: down.stdout || '',
      stderr: down.stderr || '',
    });
  }

  const report = {
    type: 'd9_keycloak_oidc_live_interop_gate',
    generated_at_utc: new Date().toISOString(),
    status,
    with_idp_preflight: args.withIdpPreflight,
    auto_idp: args.autoIdp,
    steps,
  };

  const outJson = path.join(statusDir, 'd9-keycloak-interop-gate-latest.json');
  const outMd = path.join(statusDir, 'd9-keycloak-interop-gate-latest.md');
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2));

  const md = [
    '# D9 Keycloak Interop Gate',
    '',
    `- Generated: ${report.generated_at_utc}`,
    `- Status: ${status.toUpperCase()}`,
    `- With IdP preflight: ${args.withIdpPreflight ? 'yes' : 'no'}`,
    `- Auto IdP lifecycle: ${args.autoIdp ? 'yes' : 'no'}`,
    '',
    '## Steps',
    '',
  ];
  for (const s of steps) {
    md.push(`- ${s.step}: status=${s.status}`);
  }
  md.push('');
  fs.writeFileSync(outMd, md.join('\n'));

  console.log(`wrote: ${path.relative(root, outJson)}`);
  console.log(`wrote: ${path.relative(root, outMd)}`);
  console.log(`status: ${status}`);
  for (const step of steps) {
    console.log(`step:${step.step} status=${step.status}`);
  }
  if (status !== 'pass') {
    const failed = steps.find((step) => Number(step.status) !== 0);
    if (failed) {
      console.error(`[d9-keycloak-interop-gate] failing_step=${failed.step}`);
      if (failed.command) console.error(`[d9-keycloak-interop-gate] command=${failed.command}`);
      if (failed.stderr) console.error(failed.stderr.trim().slice(0, 4000));
      if (failed.stdout) console.error(failed.stdout.trim().slice(0, 4000));
    }
  }

  process.exit(status === 'pass' ? 0 : 1);
}

main();
