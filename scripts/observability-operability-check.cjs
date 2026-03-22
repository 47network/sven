#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const RAW_API_URL = String(process.env.API_URL || '').trim();
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_TOTP_CODE = process.env.ADMIN_TOTP_CODE || '';
const TEST_SESSION_COOKIE = String(process.env.TEST_SESSION_COOKIE || '').trim();
const TARGET_ENVIRONMENT = String(process.env.TARGET_ENVIRONMENT || process.env.SVEN_TARGET_ENVIRONMENT || '').trim();

const outDir = path.join(process.cwd(), 'docs', 'release', 'status');
let API_BASE = '';

const requiredDocs = [
  'docs/architecture/observability-standards-2026.md',
  'docs/ops/incident-triage-and-degraded-mode-runbook-2026.md',
  'docs/ops/alert-noise-thresholds-2026.md',
  'docs/privacy/telemetry-and-user-controls-2026.md',
];

function resolveApiBaseOrThrow() {
  if (!RAW_API_URL) {
    throw new Error('API_URL is required for observability-operability check (no implicit default).');
  }
  return RAW_API_URL.replace(/\/+$/, '');
}

function deriveTargetEnvironment(apiBase) {
  if (TARGET_ENVIRONMENT) return TARGET_ENVIRONMENT;
  try {
    const host = new URL(apiBase).hostname.toLowerCase();
    if (host === '127.0.0.1' || host === 'localhost') return 'local';
    if (host === 'app.sven.example.com' || host === 'app.sven.systems') return 'production';
    return 'custom';
  } catch {
    return 'custom';
  }
}

function parseJsonSafe(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function extractSessionCookieFromHeaders(headers) {
  const anyHeaders = headers;
  const cookieLines = typeof anyHeaders?.getSetCookie === 'function'
    ? anyHeaders.getSetCookie()
    : [headers.get('set-cookie')].filter(Boolean);
  for (const line of cookieLines) {
    const first = String(line || '').split(';')[0] || '';
    if (first.startsWith('sven_session=')) return first;
  }
  return '';
}

async function loginCookie() {
  if (TEST_SESSION_COOKIE.startsWith('sven_session=')) {
    return TEST_SESSION_COOKIE;
  }
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    throw new Error('TEST_SESSION_COOKIE or ADMIN_USERNAME and ADMIN_PASSWORD are required.');
  }
  const loginRes = await fetch(`${API_BASE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });
  const loginText = await loginRes.text().catch(() => '');
  const loginData = parseJsonSafe(loginText);

  let sessionCookie = extractSessionCookieFromHeaders(loginRes.headers);
  if (sessionCookie) return sessionCookie;

  const requiresTotp = Boolean(loginData?.data?.requires_totp);
  const preSessionId = String(loginData?.data?.pre_session_id || '');
  if (!requiresTotp || !preSessionId || !ADMIN_TOTP_CODE) {
    throw new Error('Login did not return session cookie and TOTP flow was not completed.');
  }

  const totpRes = await fetch(`${API_BASE}/v1/auth/totp/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pre_session_id: preSessionId, code: ADMIN_TOTP_CODE }),
  });
  if (!totpRes.ok) throw new Error(`TOTP verify failed with ${totpRes.status}`);
  sessionCookie = extractSessionCookieFromHeaders(totpRes.headers);
  if (!sessionCookie) throw new Error('No session cookie returned after TOTP verify.');
  return sessionCookie;
}

async function api(method, endpoint, cookie) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: { cookie },
  });
  const text = await res.text().catch(() => '');
  return { status: res.status, ok: res.ok, data: parseJsonSafe(text) };
}

async function run() {
  API_BASE = resolveApiBaseOrThrow();
  const targetEnvironment = deriveTargetEnvironment(API_BASE);
  const checks = [];
  const failures = [];

  checks.push({
    id: 'api_url_explicit',
    pass: Boolean(RAW_API_URL),
    detail: RAW_API_URL ? `api_url=${API_BASE}` : 'API_URL missing',
  });
  checks.push({
    id: 'target_environment_present',
    pass: Boolean(targetEnvironment),
    detail: `target_environment=${targetEnvironment || '(missing)'}`,
  });

  for (const doc of requiredDocs) {
    const exists = fs.existsSync(path.join(process.cwd(), doc));
    checks.push({ id: `doc:${doc}`, pass: exists, detail: exists ? 'present' : 'missing' });
    if (!exists) failures.push(`Missing required doc: ${doc}`);
  }

  const cookie = await loginCookie();
  const endpoints = [
    '/healthz',
    '/readyz',
    '/v1/admin/performance/metrics/summary',
    '/v1/admin/performance/queue-status',
    '/v1/admin/incident/status',
  ];
  for (const endpoint of endpoints) {
    const r = await api('GET', endpoint, cookie);
    const pass = r.ok;
    checks.push({ id: `endpoint:${endpoint}`, pass, detail: `http ${r.status}` });
    if (!pass) failures.push(`Endpoint check failed: ${endpoint} (${r.status})`);
  }

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    api_base: API_BASE,
    target_environment: targetEnvironment,
    api_url_explicit: true,
    run_id: String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim(),
    head_sha: String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim(),
    status,
    checks,
    failures,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'observability-operability-latest.json');
  const outMd = path.join(outDir, 'observability-operability-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = [
    '# Observability Operability Check',
    '',
    `Generated: ${report.generated_at}`,
    `API base: ${report.api_base}`,
    `Target environment: ${report.target_environment}`,
    `API URL explicit: yes`,
    `Status: ${report.status}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  if (failures.length) {
    md.push('## Failures');
    for (const f of failures) md.push(`- ${f}`);
    md.push('');
  }
  fs.writeFileSync(outMd, `${md.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
  if (status === 'fail') process.exit(2);
}

run().catch((err) => {
  console.error('Observability operability check failed:', err);
  process.exit(1);
});
