#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const RAW_API_URL = String(process.env.API_URL || '').trim();
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_TOTP_CODE = process.env.ADMIN_TOTP_CODE || '';
const TEST_SESSION_COOKIE = String(process.env.TEST_SESSION_COOKIE || '').trim();
const DURATION_SECONDS = Number.parseInt(process.env.PERF_LOAD_DURATION_SECONDS || '8', 10);
const CONCURRENCY = Number.parseInt(process.env.PERF_LOAD_CONCURRENCY || '8', 10);
const TARGET_ENVIRONMENT = String(process.env.TARGET_ENVIRONMENT || process.env.SVEN_TARGET_ENVIRONMENT || '').trim();
const USER_RATE_LIMIT_ENABLED = process.env.API_USER_RATE_LIMIT_ENABLED !== 'false';
const USER_RATE_LIMIT_MAX = Math.max(1, Number.parseInt(process.env.API_USER_RATE_LIMIT_MAX || '300', 10));
const USER_RATE_LIMIT_WINDOW_SEC = Math.max(1, Number.parseInt(process.env.API_USER_RATE_LIMIT_WINDOW_SEC || '60', 10));
let API_BASE = '';

const outDir = path.join(process.cwd(), 'docs', 'release', 'status');

const TARGETS = {
  chat_list: { min_rps: 15, p95_ms: 700, p99_ms: 1200, min_headroom_ratio: 1.25 },
  approvals_list: { min_rps: 15, p95_ms: 700, p99_ms: 1200, min_headroom_ratio: 1.25 },
  admin_metrics_summary: { min_rps: 8, p95_ms: 1200, p99_ms: 2000, min_headroom_ratio: 1.25 },
  admin_queue_status: { min_rps: 8, p95_ms: 900, p99_ms: 1500, min_headroom_ratio: 1.25 },
};

const SCENARIOS = [
  { id: 'chat_list', method: 'GET', endpoint: '/v1/admin/chats?per_page=20' },
  { id: 'approvals_list', method: 'GET', endpoint: '/v1/admin/approvals?status=pending&per_page=20' },
  { id: 'admin_metrics_summary', method: 'GET', endpoint: '/v1/admin/performance/metrics/summary' },
  { id: 'admin_queue_status', method: 'GET', endpoint: '/v1/admin/performance/queue-status' },
];

function resolveApiBaseOrThrow() {
  if (!RAW_API_URL) {
    throw new Error('API_URL is required for performance-capacity check (no implicit default).');
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

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * p) - 1);
  return sorted[idx];
}

function parseJsonSafe(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveRateLimitBudget(targetEnvironment) {
  if (!USER_RATE_LIMIT_ENABLED || targetEnvironment !== 'production') return null;
  const sustainableRps = Number(((USER_RATE_LIMIT_MAX / USER_RATE_LIMIT_WINDOW_SEC) * 0.8).toFixed(2));
  return {
    mode: 'budgeted',
    max_requests_per_window: USER_RATE_LIMIT_MAX,
    window_seconds: USER_RATE_LIMIT_WINDOW_SEC,
    sustainable_rps: sustainableRps,
  };
}

function effectiveTargetForScenario(target, rateLimitBudget) {
  if (!rateLimitBudget) return target;
  const minRps = Math.min(target.min_rps, rateLimitBudget.sustainable_rps);
  return {
    ...target,
    min_rps: minRps,
    min_headroom_ratio: 1.0,
  };
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

async function runScenario(scenario, cookie, rateLimitBudget) {
  const endAt = Date.now() + DURATION_SECONDS * 1000;
  const latencies = [];
  let success = 0;
  let errors = 0;
  let rateLimited = 0;

  async function executeOnce() {
    const started = Date.now();
    try {
      const res = await fetch(`${API_BASE}${scenario.endpoint}`, {
        method: scenario.method,
        headers: { cookie },
      });
      await res.text().catch(() => '');
      const latency = Date.now() - started;
      latencies.push(latency);
      if (res.ok) success += 1;
      else {
        errors += 1;
        if (res.status === 429) rateLimited += 1;
      }
    } catch {
      latencies.push(Date.now() - started);
      errors += 1;
    }
  }

  if (rateLimitBudget) {
    const intervalMs = Math.max(250, Math.ceil(1000 / rateLimitBudget.sustainable_rps));
    let nextAt = Date.now();
    while (Date.now() < endAt) {
      await executeOnce();
      nextAt += intervalMs;
      const waitMs = nextAt - Date.now();
      if (waitMs > 0) await sleep(waitMs);
    }
  } else {
    async function worker() {
      while (Date.now() < endAt) {
        await executeOnce();
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  }
  const total = success + errors;
  const duration = DURATION_SECONDS;
  const rps = duration > 0 ? Number((total / duration).toFixed(2)) : 0;
  const error_rate = total > 0 ? Number((errors / total).toFixed(4)) : 1;
  const p95 = percentile(latencies, 0.95);
  const p99 = percentile(latencies, 0.99);
  const target = effectiveTargetForScenario(TARGETS[scenario.id], rateLimitBudget);
  const headroom_ratio = target.min_rps > 0 ? Number((rps / target.min_rps).toFixed(2)) : 0;

  const checks = [
    { id: `${scenario.id}:rps`, pass: rps >= target.min_rps, detail: `${rps} >= ${target.min_rps}` },
    { id: `${scenario.id}:p95`, pass: p95 !== null && p95 <= target.p95_ms, detail: `${p95} <= ${target.p95_ms}` },
    { id: `${scenario.id}:p99`, pass: p99 !== null && p99 <= target.p99_ms, detail: `${p99} <= ${target.p99_ms}` },
    { id: `${scenario.id}:error_rate`, pass: error_rate <= 0.05, detail: `${error_rate} <= 0.05` },
    {
      id: `${scenario.id}:headroom`,
      pass: headroom_ratio >= target.min_headroom_ratio,
      detail: `${headroom_ratio} >= ${target.min_headroom_ratio}`,
    },
  ];
  if (rateLimitBudget) {
    checks.push({
      id: `${scenario.id}:rate_limit_budget`,
      pass: rateLimited === 0,
      detail: `${rateLimited} rate-limited responses under ${rateLimitBudget.sustainable_rps} rps budget`,
    });
  }

  return {
    id: scenario.id,
    endpoint: scenario.endpoint,
    method: scenario.method,
    target,
    requests: total,
    success,
    errors,
    rate_limited: rateLimited,
    error_rate,
    rps,
    latency_ms: {
      min: latencies.length ? Math.min(...latencies) : null,
      p50: percentile(latencies, 0.5),
      p95,
      p99,
      max: latencies.length ? Math.max(...latencies) : null,
    },
    headroom_ratio,
    execution_mode: rateLimitBudget ? 'rate_limit_budgeted' : 'full_load',
    checks,
  };
}

async function run() {
  API_BASE = resolveApiBaseOrThrow();
  const targetEnvironment = deriveTargetEnvironment(API_BASE);
  const rateLimitBudget = resolveRateLimitBudget(targetEnvironment);
  const cookie = await loginCookie();
  const scenarios = [];
  for (const s of SCENARIOS) {
    // serial execution keeps pressure profile clear and avoids cross-test interference.
    scenarios.push(await runScenario(s, cookie, rateLimitBudget));
  }

  const checks = scenarios.flatMap((s) => s.checks);
  checks.unshift({
    id: 'target_environment_present',
    pass: Boolean(targetEnvironment),
    detail: `target_environment=${targetEnvironment || '(missing)'}`,
  });
  checks.unshift({
    id: 'api_url_explicit',
    pass: Boolean(RAW_API_URL),
    detail: RAW_API_URL ? `api_url=${API_BASE}` : 'API_URL missing',
  });
  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const aggregate = {
    requests: scenarios.reduce((sum, s) => sum + s.requests, 0),
    success: scenarios.reduce((sum, s) => sum + s.success, 0),
    errors: scenarios.reduce((sum, s) => sum + s.errors, 0),
  };
  aggregate.error_rate = aggregate.requests > 0
    ? Number((aggregate.errors / aggregate.requests).toFixed(4))
    : 1;

  const report = {
    generated_at: new Date().toISOString(),
    api_base: API_BASE,
    target_environment: targetEnvironment,
    api_url_explicit: true,
    run_id: String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim(),
    head_sha: String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim(),
    status,
    config: {
      duration_seconds: DURATION_SECONDS,
      concurrency: CONCURRENCY,
    },
    rate_limit_budget: rateLimitBudget,
    aggregate,
    scenarios,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'performance-capacity-latest.json');
  const outMd = path.join(outDir, 'performance-capacity-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Performance Capacity Check',
    '',
    `Generated: ${report.generated_at}`,
    `API base: ${report.api_base}`,
    `Target environment: ${report.target_environment}`,
    `API URL explicit: yes`,
    `Status: ${report.status}`,
    `Duration per scenario: ${DURATION_SECONDS}s`,
    `Concurrency: ${CONCURRENCY}`,
    `Execution mode: ${rateLimitBudget ? 'rate-limit-budgeted' : 'full-load'}`,
    '',
    '## Aggregate',
    `- requests: ${aggregate.requests}`,
    `- success: ${aggregate.success}`,
    `- errors: ${aggregate.errors}`,
    `- error_rate: ${aggregate.error_rate}`,
    '',
    '## Scenarios',
  ];
  for (const s of scenarios) {
    lines.push(`- ${s.id} (${s.method} ${s.endpoint})`);
    lines.push(`  rps=${s.rps}, error_rate=${s.error_rate}, rate_limited=${s.rate_limited}, p95=${s.latency_ms.p95}ms, p99=${s.latency_ms.p99}ms, headroom=${s.headroom_ratio}x, mode=${s.execution_mode}`);
  }
  lines.push('');
  lines.push('## Checks');
  for (const c of checks) lines.push(`- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`);
  lines.push('');

  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
  if (status === 'fail') process.exit(2);
}

run().catch((err) => {
  console.error('Performance capacity check failed:', err);
  process.exit(1);
});
