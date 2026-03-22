#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const strict = process.argv.includes('--strict');
const apiBase = String(process.env.API_BASE || process.env.API_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');
const username = String(process.env.RELEASE_AUTH_USERNAME || '').trim();
const password = String(process.env.RELEASE_AUTH_PASSWORD || '').trim();
const bootstrapIfEmpty = String(process.env.RELEASE_AUTH_BOOTSTRAP_IF_EMPTY || '1').trim() !== '0';
const bootstrapEnableTotp = String(process.env.RELEASE_AUTH_BOOTSTRAP_ENABLE_TOTP || '0').trim() === '1';
const outDir = path.join(process.cwd(), 'docs', 'release', 'status');
const outJson = path.join(outDir, 'auth-release-readiness-latest.json');
const outMd = path.join(outDir, 'auth-release-readiness-latest.md');
const STRICT_REQUIRED_CHECKS = new Set([
  'release_auth_credentials_present',
  'auth_bootstrap_or_existing_account',
  'auth_login_real_path',
  'auth_tokens_issued',
]);

function normalizeSetCookie(setCookieValue) {
  const raw = String(setCookieValue || '').trim();
  if (!raw) return '';
  return raw.split(';')[0] || '';
}

async function apiCall(method, endpoint, body, headers) {
  const res = await fetch(`${apiBase}${endpoint}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(headers || {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let parsed = {};
  try {
    parsed = await res.json();
  } catch {
    parsed = {};
  }
  return { status: res.status, ok: res.ok, data: parsed, headers: res.headers };
}

function writeReport(report) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Auth Release Readiness',
      '',
      `Generated: ${report.generated_at}`,
      `Status: ${report.status}`,
      `Live checks executed: ${String(report.live_checks_executed)}`,
      '',
      '## Checks',
      ...report.checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
      '',
    ].join('\n'),
    'utf8',
  );
}

async function run() {
  const checks = [];
  if (!username || !password) {
    checks.push({
      id: 'release_auth_credentials_present',
      pass: false,
      detail: 'RELEASE_AUTH_USERNAME and RELEASE_AUTH_PASSWORD are required',
    });
    const report = {
      generated_at: new Date().toISOString(),
      schema_version: 1,
      status: 'fail',
      live_checks_executed: false,
      checks,
    };
    writeReport(report);
    console.error('[release-auth-readiness-check] missing credentials');
    console.error(JSON.stringify(report, null, 2));
    process.exit(2);
  }

  checks.push({
    id: 'release_auth_credentials_present',
    pass: true,
    detail: 'username/password provided via environment',
  });

  let bootstrapAttempted = false;
  if (bootstrapIfEmpty) {
    bootstrapAttempted = true;
    const bootstrap = await apiCall('POST', '/v1/auth/bootstrap', {
      username,
      password,
      display_name: 'Release Auth Admin',
      enable_totp: bootstrapEnableTotp,
    });
    const bootstrapPass = bootstrap.status === 201 || bootstrap.status === 409;
    checks.push({
      id: 'auth_bootstrap_or_existing_account',
      pass: bootstrapPass,
      detail: bootstrapPass
        ? `status=${bootstrap.status}`
        : `status=${bootstrap.status}; expected 201 (created) or 409 (already initialized)`,
    });
  } else {
    checks.push({
      id: 'auth_bootstrap_or_existing_account',
      pass: true,
      detail: 'bootstrap disabled by RELEASE_AUTH_BOOTSTRAP_IF_EMPTY=0',
    });
  }

  const login = await apiCall('POST', '/v1/auth/login', { username, password });
  if (!login.ok) {
    checks.push({
      id: 'auth_login_real_path',
      pass: false,
      detail: `status=${login.status} (${bootstrapAttempted ? 'bootstrap attempted' : 'bootstrap skipped'})`,
    });
    const report = {
      generated_at: new Date().toISOString(),
      schema_version: 1,
      status: 'fail',
      live_checks_executed: true,
      context: {
        bootstrap_status: checks.find((entry) => entry.id === 'auth_bootstrap_or_existing_account')?.detail || 'unknown',
        login_status: login.status,
        login_response: login.data,
      },
      checks,
    };
    writeReport(report);
    console.error('[release-auth-readiness-check] login failed');
    console.error(JSON.stringify(report, null, 2));
    process.exit(2);
  }

  const requiresTotp = Boolean(login.data?.data?.requires_totp);
  checks.push({
    id: 'auth_login_real_path',
    pass: login.ok,
    detail: requiresTotp ? 'login reached TOTP gate (requires_totp=true)' : 'login succeeded',
  });

  if (requiresTotp) {
    checks.push({
      id: 'auth_login_without_seeded_bypass',
      pass: false,
      detail: 'TOTP required in release auth gate; set RELEASE_AUTH_BOOTSTRAP_ENABLE_TOTP=0 for this CI path',
    });
    const report = {
      generated_at: new Date().toISOString(),
      schema_version: 1,
      status: 'fail',
      live_checks_executed: true,
      checks,
    };
    writeReport(report);
    process.exit(2);
  }

  const accessToken = String(login.data?.data?.access_token || '').trim();
  const refreshToken = String(login.data?.data?.refresh_token || '').trim();
  const setCookie = normalizeSetCookie(login.headers.get('set-cookie') || '');

  checks.push({
    id: 'auth_tokens_issued',
    pass: Boolean(accessToken && refreshToken),
    detail: accessToken && refreshToken ? 'access+refresh issued' : 'missing access or refresh token',
  });

  const refresh = await apiCall('POST', '/v1/auth/refresh', { refresh_token: refreshToken });
  const rotatedToken = String(refresh.data?.data?.access_token || '').trim();
  checks.push({
    id: 'auth_refresh_real_path',
    pass: refresh.ok && Boolean(rotatedToken) && rotatedToken !== accessToken,
    detail: refresh.ok
      ? `status=${refresh.status}; rotated=${String(Boolean(rotatedToken && rotatedToken !== accessToken))}`
      : `status=${refresh.status}`,
  });

  const logout = await apiCall('POST', '/v1/auth/logout', undefined, { authorization: `Bearer ${rotatedToken}` });
  checks.push({
    id: 'auth_logout_real_path',
    pass: logout.ok,
    detail: `status=${logout.status}`,
  });

  const postLogout = await apiCall('GET', '/v1/approvals?status=pending', undefined, {
    authorization: `Bearer ${rotatedToken}`,
  });
  checks.push({
    id: 'auth_post_logout_token_invalidated',
    pass: postLogout.status === 401,
    detail: `status=${postLogout.status}`,
  });

  const allPass = checks.every((check) => check.pass);
  const strictPass = checks
    .filter((check) => STRICT_REQUIRED_CHECKS.has(String(check.id)))
    .every((check) => check.pass);
  const report = {
    generated_at: new Date().toISOString(),
    schema_version: 1,
    status: strictPass ? 'pass' : 'fail',
    live_checks_executed: true,
    issued_context: {
      access_token: accessToken,
      session_cookie: setCookie,
    },
    strict_required_checks: Array.from(STRICT_REQUIRED_CHECKS),
    checks,
  };
  writeReport(report);
  console.log(`Wrote ${path.relative(process.cwd(), outJson)}`);
  console.log(`Wrote ${path.relative(process.cwd(), outMd)}`);

  if (!strictPass) {
    console.error('[release-auth-readiness-check] strict checks failed');
    console.error(JSON.stringify({ strict_required_checks: Array.from(STRICT_REQUIRED_CHECKS), checks }, null, 2));
  }

  if (strict && !strictPass) process.exit(2);
  if (!allPass) process.exit(1);
}

run().catch((error) => {
  console.error(`[release-auth-readiness-check] ${String(error?.message || error)}`);
  process.exit(2);
});
