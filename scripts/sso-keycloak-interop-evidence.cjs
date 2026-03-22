#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const http = require('http');
const https = require('https');

const root = process.cwd();
const evidenceDir = path.join(root, 'docs', 'release', 'evidence');
const statusDir = path.join(root, 'docs', 'release', 'status');
const scriptPath = path.join(root, 'scripts', 'sso-keycloak-interop-smoke.cjs');
const KEYCLOAK_BASE_URL = (process.env.KEYCLOAK_BASE_URL || 'http://127.0.0.1:8081').replace(/\/+$/, '');
const KEYCLOAK_REALM = String(process.env.KEYCLOAK_REALM || 'sven').trim();
const KEYCLOAK_CLIENT_SECRET = String(process.env.KEYCLOAK_CLIENT_SECRET || 'sven-gateway-secret').trim();
const KEYCLOAK_TEST_USERNAME = String(process.env.KEYCLOAK_TEST_USERNAME || 'sven-sso-user').trim();
const KEYCLOAK_TEST_PASSWORD = String(process.env.KEYCLOAK_TEST_PASSWORD || 'sven-sso-pass').trim();
const REQUIRE_BROWSER_FLOW = String(process.env.SSO_KEYCLOAK_BROWSER_FLOW_REQUIRED || '').trim() === '1';

function nowUtcParts() {
  const d = new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return { yyyy, mm, dd, hh, mi, ss };
}

function parseArgs(argv) {
  return {
    autoStartIdp: argv.includes('--auto-start-idp'),
  };
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    ...opts,
  });
}

function shellLine(cmd, args) {
  return [cmd, ...args].join(' ');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function buildInteropChildEnv() {
  return {
    ...process.env,
    KEYCLOAK_CLIENT_SECRET,
    KEYCLOAK_TEST_USERNAME,
    KEYCLOAK_TEST_PASSWORD,
  };
}

function redactEnvValue(value) {
  const v = String(value || '').trim();
  if (!v) return '(unset)';
  if (v.length <= 8) return '***';
  return `${v.slice(0, 4)}...${v.slice(-2)}`;
}

function mdEscape(text) {
  return String(text || '').replace(/```/g, '``\\`');
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
  const t = nowUtcParts();
  const stamp = `${t.yyyy}${t.mm}${t.dd}-${t.hh}${t.mi}${t.ss}Z`;
  const dateLabel = `${t.yyyy}-${t.mm}-${t.dd}`;

  ensureDir(evidenceDir);
  ensureDir(statusDir);
  const base = `d9-keycloak-interop-live-${stamp}`;
  const jsonPath = path.join(evidenceDir, `${base}.json`);
  const mdPath = path.join(evidenceDir, `${base}.md`);
  const latestJsonPath = path.join(statusDir, 'd9-keycloak-interop-live-latest.json');
  const latestMdPath = path.join(statusDir, 'd9-keycloak-interop-live-latest.md');
  const smokeChecksJsonPath = path.join(statusDir, 'd9-keycloak-interop-smoke-checks-latest.json');
  const sourceRunId = String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim() || null;
  const headSha = String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim() || null;
  const sourceRef = String(process.env.GITHUB_REF || process.env.CI_COMMIT_REF_NAME || '').trim() || null;

  const steps = [];
  let composeUp = null;
  let smoke = null;
  let composeDown = null;
  let keycloakReady = true;

  if (!fs.existsSync(scriptPath)) {
    console.error(`missing script: ${scriptPath}`);
    process.exit(2);
  }

  if (args.autoStartIdp) {
    const upCmd = 'docker';
    const upArgs = ['compose', '-f', 'docker-compose.sso-idp.yml', 'up', '-d'];
    composeUp = run(upCmd, upArgs);
    steps.push({
      step: 'compose_up',
      command: shellLine(upCmd, upArgs),
      status: composeUp.status,
      stdout: composeUp.stdout || '',
      stderr: composeUp.stderr || '',
    });

    if (composeUp.status === 0) {
      const ready = await waitForKeycloakReady();
      keycloakReady = ready.pass;
      steps.push({
        step: 'keycloak_ready_wait',
        command: `wait_for ${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration`,
        status: ready.pass ? 0 : 1,
        stdout: ready.detail,
        stderr: '',
      });
    }
  }

  const smokeCmd = 'node';
  const smokeArgs = [
    path.join('scripts', 'sso-keycloak-interop-smoke.cjs'),
    '--report-json',
    path.relative(root, smokeChecksJsonPath),
  ];
  const smokeStrictMode = String(process.env.SSO_KEYCLOAK_INTEROP_STRICT || '').trim() === '1'
    || String(process.env.CI || '').trim().toLowerCase() === 'true';
  const interopChildEnv = buildInteropChildEnv();
  if (smokeStrictMode) smokeArgs.push('--strict');
  if (args.autoStartIdp && !keycloakReady) {
    smoke = { status: 1, stdout: '', stderr: 'Keycloak not ready after compose up wait' };
  } else {
    smoke = run(smokeCmd, smokeArgs, { env: interopChildEnv });
  }
  steps.push({
    step: 'keycloak_interop_smoke',
    command: shellLine(smokeCmd, smokeArgs),
    status: smoke.status,
    stdout: smoke.stdout || '',
    stderr: smoke.stderr || '',
  });

  const browserFlowCmd = 'node';
  const browserFlowArgs = [path.join('scripts', 'sso-keycloak-browser-flow-check.cjs'), '--strict'];
  const browserFlow = run(browserFlowCmd, browserFlowArgs, { env: interopChildEnv });
  steps.push({
    step: 'browser_flow_companion_check',
    command: shellLine(browserFlowCmd, browserFlowArgs),
    status: browserFlow.status,
    stdout: browserFlow.stdout || '',
    stderr: browserFlow.stderr || '',
  });

  if (args.autoStartIdp) {
    const downCmd = 'docker';
    const downArgs = ['compose', '-f', 'docker-compose.sso-idp.yml', 'down', '-v'];
    composeDown = run(downCmd, downArgs);
    steps.push({
      step: 'compose_down',
      command: shellLine(downCmd, downArgs),
      status: composeDown.status,
      stdout: composeDown.stdout || '',
      stderr: composeDown.stderr || '',
    });
  }

  const smokeStatus = (smoke && typeof smoke.status === 'number') ? smoke.status : 1;
  const browserFlowStatus = (browserFlow && typeof browserFlow.status === 'number') ? browserFlow.status : 1;
  const success = smokeStatus === 0 && (browserFlowStatus === 0 || !REQUIRE_BROWSER_FLOW);
  let smokeChecks = null;
  if (fs.existsSync(smokeChecksJsonPath)) {
    try {
      smokeChecks = JSON.parse(fs.readFileSync(smokeChecksJsonPath, 'utf8'));
    } catch {
      smokeChecks = null;
    }
  }
  const report = {
    type: 'd9_keycloak_oidc_live_interop',
    generated_at_utc: new Date().toISOString(),
    source_run_id: sourceRunId,
    head_sha: headSha,
    source_ref: sourceRef,
    success,
    artifacts: {
      timestamped_json: path.relative(root, jsonPath).replace(/\\/g, '/'),
      timestamped_md: path.relative(root, mdPath).replace(/\\/g, '/'),
      smoke_checks_json: path.relative(root, smokeChecksJsonPath).replace(/\\/g, '/'),
    },
    auto_start_idp: args.autoStartIdp,
    smoke_strict_mode: smokeStrictMode,
    browser_flow_required: REQUIRE_BROWSER_FLOW,
    environment: {
      API_URL: process.env.API_URL || '(default http://127.0.0.1:3001)',
      KEYCLOAK_BASE_URL: process.env.KEYCLOAK_BASE_URL || '(default http://127.0.0.1:8081)',
      KEYCLOAK_REALM: process.env.KEYCLOAK_REALM || '(default sven)',
      KEYCLOAK_CLIENT_ID: process.env.KEYCLOAK_CLIENT_ID || '(default sven-gateway)',
      TEST_BEARER_TOKEN: redactEnvValue(process.env.TEST_BEARER_TOKEN),
      TEST_SESSION_COOKIE: redactEnvValue(process.env.TEST_SESSION_COOKIE),
    },
    steps,
    smoke_checks: smokeChecks,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md = [
    `# D9 Keycloak OIDC Live Interop Evidence (${dateLabel})`,
    '',
    `- Generated: ${report.generated_at_utc}`,
    `- Result: ${success ? 'PASS' : 'FAIL'}`,
    `- Source run id: ${sourceRunId || 'n/a'}`,
    `- Head SHA: ${headSha || 'n/a'}`,
    `- Source ref: ${sourceRef || 'n/a'}`,
    `- Auto-start IdP: ${args.autoStartIdp ? 'yes' : 'no'}`,
    '',
    '## Environment',
    '',
    `- API_URL: ${report.environment.API_URL}`,
    `- KEYCLOAK_BASE_URL: ${report.environment.KEYCLOAK_BASE_URL}`,
    `- KEYCLOAK_REALM: ${report.environment.KEYCLOAK_REALM}`,
    `- KEYCLOAK_CLIENT_ID: ${report.environment.KEYCLOAK_CLIENT_ID}`,
    `- TEST_BEARER_TOKEN: ${report.environment.TEST_BEARER_TOKEN}`,
    `- TEST_SESSION_COOKIE: ${report.environment.TEST_SESSION_COOKIE}`,
    '',
    '## Steps',
    '',
  ];

  for (const row of steps) {
    md.push(`### ${row.step}`);
    md.push('');
    md.push(`- Command: \`${row.command}\``);
    md.push(`- Exit status: ${row.status}`);
    md.push('');
    md.push('```text');
    md.push(mdEscape(row.stdout || '').trim() || '(no stdout)');
    md.push('```');
    if (String(row.stderr || '').trim()) {
      md.push('');
      md.push('```text');
      md.push(mdEscape(row.stderr || '').trim());
      md.push('```');
    }
    md.push('');
  }

  fs.writeFileSync(mdPath, md.join('\n'));
  fs.writeFileSync(latestJsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(latestMdPath, md.join('\n'));

  console.log(`wrote: ${path.relative(root, jsonPath)}`);
  console.log(`wrote: ${path.relative(root, mdPath)}`);
  console.log(`wrote: ${path.relative(root, latestJsonPath)}`);
  console.log(`wrote: ${path.relative(root, latestMdPath)}`);

  process.exit(success ? 0 : 1);
}

main().catch((err) => {
  console.error(String(err && err.message ? err.message : err));
  process.exit(1);
});
