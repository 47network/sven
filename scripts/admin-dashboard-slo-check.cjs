#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const API_BASE = process.env.API_URL || 'http://127.0.0.1:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_TOTP_CODE = process.env.ADMIN_TOTP_CODE || '';
const STRICT_MODE = process.env.ADMIN_DASHBOARD_SLO_STRICT === '1';
const outDir = path.join(process.cwd(), 'docs', 'release', 'status');

const LIMITS = {
  dashboard_p95_ms: 1500,
  dashboard_p99_ms: 2500,
  endpoint_error_rate_max: 0.1,
  aggregate_error_budget_max: 0.08,
};

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * p) - 1);
  return sorted[idx];
}

async function apiCall(method, endpoint, body, opts) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (opts?.cookie) headers.cookie = opts.cookie;
  const started = Date.now();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const latency_ms = Date.now() - started;
  const text = await res.text().catch(() => '');
  return { status: res.status, ok: res.ok, latency_ms, text };
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

async function tryAdminLoginCookie() {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) return '';

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
  if (!requiresTotp || !preSessionId) return '';
  if (!ADMIN_TOTP_CODE) return '';

  const totpRes = await fetch(`${API_BASE}/v1/auth/totp/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pre_session_id: preSessionId, code: ADMIN_TOTP_CODE }),
  });
  if (!totpRes.ok) return '';
  sessionCookie = extractSessionCookieFromHeaders(totpRes.headers);
  return sessionCookie;
}

function summarizeRuns(runs) {
  const ok = runs.filter((r) => r.ok).length;
  const err = runs.length - ok;
  const latencies = runs.map((r) => r.latency_ms);
  return {
    requests: runs.length,
    success: ok,
    error: err,
    success_rate: runs.length ? Number((ok / runs.length).toFixed(4)) : 0,
    error_rate: runs.length ? Number((err / runs.length).toFixed(4)) : 0,
    latency_ms: {
      min: latencies.length ? Math.min(...latencies) : null,
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
      max: latencies.length ? Math.max(...latencies) : null,
    },
  };
}

async function probe(method, endpoint, count, opts) {
  const runs = [];
  for (let i = 0; i < count; i += 1) {
    runs.push(await apiCall(method, endpoint, undefined, opts));
  }
  return { endpoint, ...summarizeRuns(runs) };
}

async function run() {
  const warnings = [];
  const probes = [];
  let effectiveCookie = TEST_SESSION_COOKIE;

  // Public baseline for overview banner health.
  probes.push(await probe('GET', '/healthz', 8));

  if (!effectiveCookie) {
    try {
      effectiveCookie = await tryAdminLoginCookie();
      if (!effectiveCookie && ADMIN_USERNAME) {
        warnings.push('Admin credential login attempted but no session cookie was obtained.');
      }
    } catch (err) {
      warnings.push(`Admin credential login failed: ${String(err)}`);
    }
  }

  // Admin overview-relevant endpoints (cookie-gated).
  if (effectiveCookie) {
    probes.push(await probe('GET', '/readyz', 6, { cookie: effectiveCookie }));
    probes.push(await probe('GET', '/v1/admin/approvals?status=pending&per_page=20', 6, { cookie: effectiveCookie }));
    probes.push(await probe('GET', '/v1/admin/runs?per_page=20', 6, { cookie: effectiveCookie }));
    probes.push(await probe('GET', '/v1/admin/incident/status', 6, { cookie: effectiveCookie }));
  } else {
    warnings.push('No admin session cookie available; set TEST_SESSION_COOKIE or ADMIN_USERNAME/ADMIN_PASSWORD.');
  }

  const aggregateRequests = probes.reduce((sum, p) => sum + p.requests, 0);
  const aggregateErrors = probes.reduce((sum, p) => sum + p.error, 0);
  const aggregateErrorRate = aggregateRequests ? Number((aggregateErrors / aggregateRequests).toFixed(4)) : 1;
  const p95Values = probes.map((p) => p.latency_ms.p95).filter((v) => Number.isFinite(v));
  const p99Values = probes.map((p) => p.latency_ms.p99).filter((v) => Number.isFinite(v));
  const dashboardP95 = p95Values.length ? Math.max(...p95Values) : null;
  const dashboardP99 = p99Values.length ? Math.max(...p99Values) : null;

  const checks = [
    {
      id: 'dashboard_p95',
      pass: dashboardP95 !== null && dashboardP95 <= LIMITS.dashboard_p95_ms,
      detail: `${dashboardP95} <= ${LIMITS.dashboard_p95_ms}`,
    },
    {
      id: 'dashboard_p99',
      pass: dashboardP99 !== null && dashboardP99 <= LIMITS.dashboard_p99_ms,
      detail: `${dashboardP99} <= ${LIMITS.dashboard_p99_ms}`,
    },
    {
      id: 'aggregate_error_budget',
      pass: aggregateErrorRate <= LIMITS.aggregate_error_budget_max,
      detail: `${aggregateErrorRate} <= ${LIMITS.aggregate_error_budget_max}`,
    },
    ...probes.map((p) => ({
      id: `endpoint_error_rate:${p.endpoint}`,
      pass: p.error_rate <= LIMITS.endpoint_error_rate_max,
      detail: `${p.error_rate} <= ${LIMITS.endpoint_error_rate_max}`,
    })),
  ];

  const hardFail = checks.some((c) => !c.pass);
  let status = hardFail ? 'fail' : 'pass';
  if (warnings.length && !STRICT_MODE) status = status === 'fail' ? 'fail' : 'warn';

  const report = {
    generated_at: new Date().toISOString(),
    api_base: API_BASE,
    status,
    strict_mode: STRICT_MODE,
    auth_mode: effectiveCookie
      ? (TEST_SESSION_COOKIE ? 'session_cookie_env' : ADMIN_USERNAME ? 'admin_login' : 'session_cookie')
      : 'none',
    limits: LIMITS,
    warnings,
    aggregate: {
      requests: aggregateRequests,
      errors: aggregateErrors,
      error_rate: aggregateErrorRate,
      dashboard_p95_ms: dashboardP95,
      dashboard_p99_ms: dashboardP99,
    },
    probes,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'admin-dashboard-slo-latest.json');
  const outMd = path.join(outDir, 'admin-dashboard-slo-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = [
    '# Admin Dashboard SLO Check',
    '',
    `Generated: ${report.generated_at}`,
    `API base: ${report.api_base}`,
    `Status: ${report.status}`,
    '',
    '## Aggregate',
    `- requests: ${report.aggregate.requests}`,
    `- errors: ${report.aggregate.errors}`,
    `- error_rate: ${report.aggregate.error_rate}`,
    `- dashboard_p95_ms: ${report.aggregate.dashboard_p95_ms}`,
    `- dashboard_p99_ms: ${report.aggregate.dashboard_p99_ms}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
    '## Probes',
    ...probes.map((p) => `- ${p.endpoint}: success=${p.success}/${p.requests}, error_rate=${p.error_rate}, p95=${p.latency_ms.p95}ms, p99=${p.latency_ms.p99}ms`),
    '',
  ];
  if (warnings.length) {
    md.push('## Warnings');
    for (const w of warnings) md.push(`- ${w}`);
    md.push('');
  }
  fs.writeFileSync(outMd, `${md.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
  if (status === 'fail') process.exit(2);
}

run().catch((err) => {
  console.error('Admin dashboard SLO check failed:', err);
  process.exit(1);
});
