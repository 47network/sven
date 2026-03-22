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

function resolveApiBaseOrThrow() {
  if (!RAW_API_URL) {
    throw new Error('API_URL is required for privacy-compliance check (no implicit default).');
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

async function api(method, endpoint, body, cookie) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text().catch(() => '');
  return { status: res.status, ok: res.ok, data: parseJsonSafe(text), text };
}

async function run() {
  API_BASE = resolveApiBaseOrThrow();
  const targetEnvironment = deriveTargetEnvironment(API_BASE);
  const startedAt = new Date().toISOString();
  const checks = [];
  let failed = false;
  const failures = [];

  checks.push({
    id: 'api_url_explicit',
    pass: Boolean(RAW_API_URL),
    status: 0,
  });
  checks.push({
    id: 'target_environment_present',
    pass: Boolean(targetEnvironment),
    status: 0,
  });

  const cookie = await loginCookie();

  const retention = await api('GET', '/v1/admin/privacy/retention-policy', undefined, cookie);
  const retentionPass = retention.ok && Boolean(retention.data?.data?.id);
  checks.push({
    id: 'retention_policy_available',
    pass: retentionPass,
    status: retention.status,
  });
  if (!retentionPass) {
    failed = true;
    failures.push('Retention policy fetch failed');
  }

  const exportReq = await api(
    'POST',
    '/v1/admin/privacy/export-request',
    { exportType: 'messages' },
    cookie,
  );
  const exportRequestId = exportReq.data?.data?.requestId;
  const exportCreatePass = exportReq.status === 202 && Boolean(exportRequestId);
  checks.push({
    id: 'export_request_create',
    pass: exportCreatePass,
    status: exportReq.status,
  });
  if (!exportCreatePass) {
    failed = true;
    failures.push('Export request creation failed');
  }

  if (exportRequestId) {
    const exportStatus = await api('GET', `/v1/admin/privacy/export-request/${exportRequestId}`, undefined, cookie);
    const exportStatusPass = exportStatus.ok && Boolean(exportStatus.data?.data?.status);
    checks.push({
      id: 'export_request_status_fetch',
      pass: exportStatusPass,
      status: exportStatus.status,
    });
    if (!exportStatusPass) {
      failed = true;
      failures.push('Export request status fetch failed');
    }
  }

  const deletionReq = await api(
    'POST',
    '/v1/admin/privacy/deletion-request',
    { deletionType: 'soft_delete', reason: 'privacy compliance check' },
    cookie,
  );
  const deletionRequestId = deletionReq.data?.data?.requestId;
  const deletionCreatePass = deletionReq.status === 202 && Boolean(deletionRequestId);
  checks.push({
    id: 'deletion_request_create',
    pass: deletionCreatePass,
    status: deletionReq.status,
  });
  if (!deletionCreatePass) {
    failed = true;
    failures.push('Deletion request creation failed');
  }

  if (deletionRequestId) {
    const deletionApprove = await api(
      'POST',
      `/v1/admin/privacy/deletion-request/${deletionRequestId}/approve`,
      { scheduleDays: 0 },
      cookie,
    );
    const deletionApprovePass = deletionApprove.ok;
    checks.push({
      id: 'deletion_request_approve',
      pass: deletionApprovePass,
      status: deletionApprove.status,
    });
    if (!deletionApprovePass) {
      failed = true;
      failures.push('Deletion request approval failed');
    }

    const deletionExecute = await api(
      'POST',
      `/v1/admin/privacy/deletion-request/${deletionRequestId}/execute`,
      {},
      cookie,
    );
    const deletionExecutePass = deletionExecute.ok;
    checks.push({
      id: 'deletion_request_execute',
      pass: deletionExecutePass,
      status: deletionExecute.status,
    });
    if (!deletionExecutePass) {
      failed = true;
      failures.push('Deletion request execution failed');
    }
  }

  const piiDetect = await api(
    'POST',
    '/v1/admin/privacy/detect-pii',
    { text: 'Email me at privacy-check@example.com and call 555-123-4567' },
    cookie,
  );
  const piiDetectPass = piiDetect.ok
    && piiDetect.data?.data?.piiDetected === true
    && Number(piiDetect.data?.data?.count || 0) >= 1;
  checks.push({
    id: 'pii_detection',
    pass: piiDetectPass,
    status: piiDetect.status,
  });
  if (!piiDetectPass) {
    failed = true;
    failures.push('PII detection failed');
  }

  const redact = await api(
    'POST',
    '/v1/admin/privacy/redact-text',
    { text: 'User email is privacy-check@example.com' },
    cookie,
  );
  const redacted = String(redact.data?.data?.redacted || '');
  const redactPass = redact.ok && redacted.length > 0;
  checks.push({
    id: 'redaction_endpoint',
    pass: redactPass,
    status: redact.status,
  });
  if (!redactPass) {
    failed = true;
    failures.push('Redaction endpoint failed');
  }

  const audit = await api('GET', '/v1/admin/privacy/audit-log?limit=20', undefined, cookie);
  const auditEntries = Array.isArray(audit.data?.data?.auditLog) ? audit.data.data.auditLog : [];
  const auditSecretLeak = JSON.stringify(auditEntries).match(/privacy-check@example\.com|api[_-]?key|password|token/i);
  const auditPass = audit.ok && !auditSecretLeak;
  checks.push({
    id: 'audit_log_sanitized',
    pass: auditPass,
    status: audit.status,
  });
  if (!auditPass) {
    failed = true;
    failures.push('Audit log appears to contain sensitive content');
  }

  const report = {
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    api_base: API_BASE,
    target_environment: targetEnvironment,
    api_url_explicit: true,
    run_id: String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim(),
    head_sha: String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim(),
    status: failed ? 'fail' : 'pass',
    checks,
    failures,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'privacy-compliance-latest.json');
  const outMd = path.join(outDir, 'privacy-compliance-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Privacy Compliance Check',
    '',
    `Generated: ${report.generated_at}`,
    `API base: ${report.api_base}`,
    `Target environment: ${report.target_environment}`,
    `API URL explicit: yes`,
    `Status: ${report.status}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id} (http ${c.status})`),
    '',
  ];
  if (failures.length) {
    lines.push('## Failures');
    for (const f of failures) lines.push(`- ${f}`);
    lines.push('');
  }
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
  if (failed) process.exit(2);
}

run().catch((err) => {
  console.error('Privacy compliance check failed:', err);
  process.exit(1);
});
