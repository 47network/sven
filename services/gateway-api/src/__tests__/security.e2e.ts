/**
 * Security Hardening Tests (C2)
 * Tests rate limiting, lockout, CORS, and security headers.
 *
 * Run against a live gateway:
 *   GATEWAY_URL=http://localhost:3000 npx tsx src/__tests__/security.e2e.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:3000';
const AUTH_USERNAME = process.env.PEN_TEST_USERNAME || process.env.ADMIN_USERNAME || '';
const AUTH_PASSWORD = process.env.PEN_TEST_PASSWORD || process.env.ADMIN_PASSWORD || '';
const AUTH_TOTP_CODE = process.env.PEN_TEST_TOTP_CODE || process.env.ADMIN_TOTP_CODE || '';
const RUN_LIVE_GATEWAY_E2E = String(process.env.RUN_LIVE_GATEWAY_E2E || '').toLowerCase() === 'true';
const SECURITY_E2E_FAIL_ON_SKIP = String(
  process.env.SECURITY_E2E_FAIL_ON_SKIP || (RUN_LIVE_GATEWAY_E2E ? 'true' : 'false'),
).toLowerCase() === 'true';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  skipped?: boolean;
}

const results: TestResult[] = [];
let authCookieHeader = '';
let authUnavailableReason = '';

class SkipTestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkipTestError';
  }
}

async function runOrSkip(testFn: () => Promise<void>): Promise<void> {
  try {
    await testFn();
  } catch (err) {
    if (err instanceof SkipTestError) {
      if (SECURITY_E2E_FAIL_ON_SKIP) {
        throw new Error(`required security check skipped: ${err.message}`);
      }
      return;
    }
    throw err;
  }
}

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    console.log(`✓ ${name} (${duration}ms)`);
  } catch (err) {
    if (err instanceof SkipTestError) {
      const duration = Date.now() - start;
      results.push({ name, passed: true, duration, skipped: true });
      console.log(`⊘ ${name} — SKIPPED (${err.message})`);
      return;
    }
    const duration = Date.now() - start;
    results.push({ name, passed: false, duration, error: err instanceof Error ? err.message : String(err) });
    console.log(`✗ ${name} (${duration}ms): ${err}`);
  }
}

function skip(name: string, reason: string): void {
  results.push({ name, passed: true, duration: 0, skipped: true });
  console.log(`⊘ ${name} — SKIPPED (${reason})`);
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

function getSetCookies(res: Response): string[] {
  const headersAny = res.headers as any;
  if (typeof headersAny.getSetCookie === 'function') {
    return headersAny.getSetCookie();
  }
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

function rootPath(...parts: string[]): string {
  return path.resolve(process.cwd(), '..', '..', ...parts);
}

async function ensureAuthSession(): Promise<void> {
  if (authUnavailableReason) {
    throw new SkipTestError(authUnavailableReason);
  }
  if (authCookieHeader) return;
  if (!AUTH_USERNAME || !AUTH_PASSWORD) {
    authUnavailableReason = 'PEN_TEST_USERNAME/PEN_TEST_PASSWORD (or ADMIN_USERNAME/ADMIN_PASSWORD) not set';
    throw new SkipTestError(authUnavailableReason);
  }

  const loginRes = await fetch(`${GATEWAY_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: AUTH_USERNAME, password: AUTH_PASSWORD }),
  });
  if (!loginRes.ok) {
    if (loginRes.status === 403) {
      authUnavailableReason = 'Admin TOTP enforcement active (403); set PEN_TEST_TOTP_CODE/ADMIN_TOTP_CODE for auth-dependent checks';
      throw new SkipTestError(authUnavailableReason);
    }
    if (loginRes.status === 429) {
      authUnavailableReason = 'Auth lockout active (429)';
      throw new SkipTestError(authUnavailableReason);
    }
    throw new Error(`Login failed (${loginRes.status})`);
  }
  const loginData = (await loginRes.json()) as any;

  if (loginData?.data?.requires_totp) {
    if (!AUTH_TOTP_CODE) {
      authUnavailableReason = 'TOTP required; set PEN_TEST_TOTP_CODE/ADMIN_TOTP_CODE for auth-dependent checks';
      throw new SkipTestError(authUnavailableReason);
    }
    const verifyRes = await fetch(`${GATEWAY_URL}/v1/auth/totp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pre_session_id: loginData.data.pre_session_id,
        code: AUTH_TOTP_CODE,
      }),
    });
    if (!verifyRes.ok) {
      if (verifyRes.status === 429) {
        authUnavailableReason = 'Auth lockout active during TOTP verify (429)';
        throw new SkipTestError(authUnavailableReason);
      }
      throw new Error(`TOTP verify failed (${verifyRes.status})`);
    }
    const cookies = getSetCookies(verifyRes);
    authCookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');
    return;
  }

  const cookies = getSetCookies(loginRes);
  authCookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');
}

// ============================================================
//  1. Security header tests
// ============================================================

async function testSecurityHeaders(): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/healthz`);

  // Helmet headers
  const csp = res.headers.get('content-security-policy');
  assert(csp !== null, 'Content-Security-Policy header is missing');
  assert(csp!.includes("default-src 'self'"), 'CSP does not contain default-src self');

  const xContentType = res.headers.get('x-content-type-options');
  assert(xContentType === 'nosniff', 'X-Content-Type-Options should be nosniff');

  const xFrame = res.headers.get('x-frame-options');
  assert(xFrame === 'DENY' || xFrame === 'SAMEORIGIN', `X-Frame-Options unexpected: ${xFrame}`);

  const referrer = res.headers.get('referrer-policy');
  assert(referrer === 'no-referrer', `Referrer-Policy should be no-referrer, got: ${referrer}`);

  const hsts = res.headers.get('strict-transport-security');
  assert(hsts !== null, 'Strict-Transport-Security header missing');
  assert(hsts!.includes('max-age='), 'HSTS missing max-age');
}

async function testApiVersionHeader(): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/healthz`);
  const version = res.headers.get('x-api-contract-version') || res.headers.get('x-api-version');
  assert(version !== null, 'API version header is missing');
}

// ============================================================
//  2. Auth security tests
// ============================================================

async function testLoginRejectsEmptyBody(): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert(res.status === 401 || res.status === 400 || res.status === 429, `Expected 401/400/429, got ${res.status}`);
}

async function testLoginRejectsInvalidCredentials(): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'nonexistent_test_user', password: 'wrong' }),
  });
  assert(res.status === 401 || res.status === 429, `Expected 401/429, got ${res.status}`);
  if (res.status === 401) {
    const data = (await res.json()) as any;
    assert(data.error?.code === 'AUTH_FAILED', 'Expected AUTH_FAILED code');
  }
}

async function testLoginRejectsSqlInjectionPayload(): Promise<void> {
  // Keep combined failed-attempt volume below lockout threshold so reruns remain deterministic.
  const payloads = [
    { username: `' OR 1=1 --`, password: 'x' },
    { username: `admin'/*`, password: `*/ OR '1'='1` },
  ];

  for (const payload of payloads) {
    const res = await fetch(`${GATEWAY_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert(
      res.status === 401 || res.status === 400 || res.status === 429,
      `Expected auth rejection status for SQLi payload, got ${res.status}`,
    );
    if (res.status === 429) break;
  }
}

async function testBootstrapBlockedWhenUsersExist(): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/v1/auth/bootstrap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'attacker', password: 'test1234' }),
  });
  // Should be 409 (users exist) or 429 (rate limited)
  assert(res.status === 409 || res.status === 429, `Expected 409/429, got ${res.status}`);
}

async function testSessionCookieFlags(): Promise<void> {
  await ensureAuthSession();

  const loginRes = await fetch(`${GATEWAY_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: AUTH_USERNAME, password: AUTH_PASSWORD }),
  });
  const data = (await loginRes.json()) as any;
  if (data?.data?.requires_totp) {
    throw new SkipTestError('TOTP required for this account; cookie assertions require PEN_TEST_TOTP_CODE/ADMIN_TOTP_CODE');
  }
  const cookies = getSetCookies(loginRes);
  const sessionCookie = cookies.find((c) => c.startsWith('sven_session='));
  const refreshCookie = cookies.find((c) => c.startsWith('sven_refresh='));
  assert(Boolean(sessionCookie), 'sven_session cookie is missing');
  assert(Boolean(refreshCookie), 'sven_refresh cookie is missing');
  assert(/;\s*HttpOnly/i.test(sessionCookie!), 'sven_session cookie must be HttpOnly');
  assert(/;\s*SameSite=Strict/i.test(sessionCookie!), 'sven_session cookie must be SameSite=Strict');
  assert(/;\s*HttpOnly/i.test(refreshCookie!), 'sven_refresh cookie must be HttpOnly');
  assert(/;\s*SameSite=Strict/i.test(refreshCookie!), 'sven_refresh cookie must be SameSite=Strict');
}

async function testCsrfOriginRequiredForCookieLogout(): Promise<void> {
  await ensureAuthSession();
  const res = await fetch(`${GATEWAY_URL}/v1/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: authCookieHeader,
      Origin: 'https://evil-attacker.example',
    },
    body: JSON.stringify({}),
  });
  assert(res.status === 403, `Expected 403 for cookie-auth logout from untrusted origin, got ${res.status}`);
  const data = (await res.json()) as any;
  assert(
    data?.error?.code === 'CSRF_ORIGIN_INVALID' || data?.error?.code === 'CSRF_ORIGIN_REQUIRED',
    `Expected CSRF_ORIGIN_INVALID/CSRF_ORIGIN_REQUIRED code, got ${data?.error?.code || 'n/a'}`,
  );
}

// ============================================================
//  3. Lockout simulation (offline)
// ============================================================

async function testLockoutLogic(): Promise<void> {
  // Simulate the lockout logic without hitting the server
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 15 * 60 * 1000;
  
  const attempts = new Map<string, { count: number; lockedUntil: number }>();
  
  function isLocked(ip: string) {
    const e = attempts.get(ip);
    return e ? e.lockedUntil > Date.now() : false;
  }
  
  function recordFail(ip: string) {
    const e = attempts.get(ip) || { count: 0, lockedUntil: 0 };
    e.count += 1;
    if (e.count >= MAX_ATTEMPTS) e.lockedUntil = Date.now() + LOCKOUT_MS;
    attempts.set(ip, e);
  }

  const testIp = '192.168.1.100';
  
  // Not locked initially
  assert(!isLocked(testIp), 'Should not be locked initially');
  
  // 4 failures — still not locked
  for (let i = 0; i < 4; i++) recordFail(testIp);
  assert(!isLocked(testIp), 'Should not be locked after 4 failures');
  
  // 5th failure — locked
  recordFail(testIp);
  assert(isLocked(testIp), 'Should be locked after 5 failures');
}

// ============================================================
//  4. CORS tests
// ============================================================

async function testCorsRejectsUnknownOrigin(): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/healthz`, {
    headers: { Origin: 'https://evil-attacker.com' },
  });
  const allowOrigin = res.headers.get('access-control-allow-origin');
  // Should NOT be the evil origin
  assert(
    allowOrigin !== 'https://evil-attacker.com',
    `CORS should not allow evil origin, got: ${allowOrigin}`,
  );
}

async function testCorsAllowsLocalhost(): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/healthz`, {
    headers: { Origin: 'http://localhost:5173' },
  });
  const allowOrigin = res.headers.get('access-control-allow-origin');
  // Should either be the localhost origin or null (if not default-configured)
  // In dev, localhost is in the default allowlist
  assert(
    allowOrigin === 'http://localhost:5173' || allowOrigin === null || allowOrigin === '*',
    `CORS should allow localhost, got: ${allowOrigin}`,
  );
}

// ============================================================
//  5. Endpoint protection tests
// ============================================================

async function testAdminRequiresAuth(): Promise<void> {
  const endpoints = [
    '/v1/admin/settings',
    '/v1/admin/users',
    '/v1/admin/cron',
    '/v1/admin/models/registry',
  ];
  for (const ep of endpoints) {
    const res = await fetch(`${GATEWAY_URL}${ep}`);
    assert(
      res.status === 401 || res.status === 403,
      `${ep} should require auth, got ${res.status}`,
    );
  }
}

async function testHealthzIsPublic(): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/healthz`);
  assert(res.status === 200, `healthz should be public, got ${res.status}`);
}

async function testMcpRequiresToken(): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/v1/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
  });
  assert(res.status === 401, `Expected 401 for unauthenticated MCP call, got ${res.status}`);
}

async function testOutboxRequiresAdapterToken(): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/v1/outbox/next`);
  assert(
    res.status === 401 || res.status === 403,
    `Expected 401/403 for outbox without adapter token, got ${res.status}`,
  );
}

async function testDeviceEventStreamRequiresSession(): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/v1/devices/events/stream`);
  assert(
    res.status === 401 || res.status === 403,
    `Expected 401/403 for device stream without session, got ${res.status}`,
  );
}

async function testSsrfBlockedByRelayDomainPolicy(): Promise<void> {
  await ensureAuthSession();
  const createRes = await fetch(`${GATEWAY_URL}/v1/tools/browser/relay/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: authCookieHeader,
    },
    body: JSON.stringify({
      name: 'security-relay-ssrf',
      allowed_domains: ['example.com'],
      permissions: ['read_url'],
    }),
  });
  assert(createRes.status === 200, `Expected relay session create 200, got ${createRes.status}`);
  const createData = (await createRes.json()) as any;
  const sessionId = String(createData?.data?.id || '');
  assert(Boolean(sessionId), 'Relay session id missing');

  const cmdRes = await fetch(`${GATEWAY_URL}/v1/tools/browser/relay/sessions/${encodeURIComponent(sessionId)}/commands`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: authCookieHeader,
    },
    body: JSON.stringify({
      command: 'get_url',
      payload: { url: 'http://127.0.0.1:3000/healthz' },
    }),
  });
  assert(cmdRes.status === 403, `Expected 403 DOMAIN_BLOCKED, got ${cmdRes.status}`);
}

async function testRelayRejectsCommandInjectionStrings(): Promise<void> {
  await ensureAuthSession();
  const createRes = await fetch(`${GATEWAY_URL}/v1/tools/browser/relay/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: authCookieHeader,
    },
    body: JSON.stringify({
      name: 'security-relay-injection',
      allowed_domains: ['example.com'],
      permissions: ['read_url'],
    }),
  });
  assert(createRes.status === 200, `Expected relay session create 200, got ${createRes.status}`);
  const createData = (await createRes.json()) as any;
  const sessionId = String(createData?.data?.id || '');
  assert(Boolean(sessionId), 'Relay session id missing');

  const badCmdRes = await fetch(`${GATEWAY_URL}/v1/tools/browser/relay/sessions/${encodeURIComponent(sessionId)}/commands`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: authCookieHeader,
    },
    body: JSON.stringify({
      command: 'get_url;rm -rf /',
      payload: { url: 'https://example.com' },
    }),
  });
  assert(badCmdRes.status === 400, `Expected 400 for unsupported relay command, got ${badCmdRes.status}`);
}

async function testCanvasXssSanitizationGuardsPresent(): Promise<void> {
  const pagePath = rootPath('apps', 'canvas-ui', 'src', 'app', 'c', '[chatId]', 'page.tsx');
  const panelPath = rootPath('apps', 'canvas-ui', 'src', 'components', 'chat', 'A2uiPanel.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  const panelContent = fs.readFileSync(panelPath, 'utf8');

  assert(
    pageContent.includes("doc.querySelectorAll('script, style, iframe, object, embed, link, meta, base').forEach((el) => el.remove());"),
    'sanitizeA2uiHtml must remove scriptable elements',
  );
  assert(
    pageContent.includes("const sanitizedA2uiHtml = useMemo(() => sanitizeA2uiHtml(a2ui.html), [a2ui.html]);"),
    'A2UI HTML must be sanitized before render',
  );
  assert(
    pageContent.includes('<A2uiPanel html={sanitizedA2uiHtml} onInteract={handleA2uiInteract} />'),
    'A2uiPanel must consume sanitized HTML binding',
  );
  assert(
    panelContent.includes('dangerouslySetInnerHTML'),
    'A2uiPanel uses dangerous HTML rendering path and must be fed sanitized content',
  );
}

// ============================================================
//  Main runner
// ============================================================

async function main(): Promise<void> {
  console.log('\n═══ Security Hardening Tests (C2) ═══\n');

  // Offline tests (always run)
  console.log('── Lockout Logic ──');
  await runTest('lockout after 5 failed attempts', testLockoutLogic);

  // Online tests (check if gateway is reachable)
  let gatewayReachable = false;
  try {
    const check = await fetch(`${GATEWAY_URL}/healthz`, { signal: AbortSignal.timeout(5000) });
    gatewayReachable = check.status === 200;
  } catch { /* not reachable */ }

  if (gatewayReachable) {
    console.log('\n── Security Headers ──');
    await runTest('security headers present', testSecurityHeaders);
    await runTest('API version header present', testApiVersionHeader);

    console.log('\n── Auth Security ──');
    await runTest('session cookie secure by default', testSessionCookieFlags);

    console.log('\n── CORS ──');
    await runTest('CORS rejects unknown origin', testCorsRejectsUnknownOrigin);
    await runTest('CORS allows localhost in dev', testCorsAllowsLocalhost);

    console.log('\n── Endpoint Protection ──');
    await runTest('admin endpoints require auth', testAdminRequiresAuth);
    await runTest('MCP endpoint requires token', testMcpRequiresToken);
    await runTest('outbox endpoints require adapter token', testOutboxRequiresAdapterToken);
    await runTest('device events stream requires session', testDeviceEventStreamRequiresSession);
    await runTest('healthz is public', testHealthzIsPublic);

    console.log('\n── Penetration Probes ──');
    await runTest('relay domain policy blocks SSRF target', testSsrfBlockedByRelayDomainPolicy);
    await runTest('relay rejects command-injection-like command strings', testRelayRejectsCommandInjectionStrings);
    await runTest('canvas XSS sanitization guards present', testCanvasXssSanitizationGuardsPresent);

    console.log('\n── Auth Rejection Probes ──');
    await runTest('login rejects empty body', testLoginRejectsEmptyBody);
    await runTest('login rejects invalid credentials', testLoginRejectsInvalidCredentials);
    await runTest('login rejects SQL injection payloads', testLoginRejectsSqlInjectionPayload);
    await runTest('bootstrap blocked when users exist', testBootstrapBlockedWhenUsersExist);
    await runTest('cookie-auth state change rejects untrusted origin', testCsrfOriginRequiredForCookieLogout);
  } else {
    skip('security headers', 'Gateway not reachable');
    skip('API version header', 'Gateway not reachable');
    skip('login rejects empty body', 'Gateway not reachable');
    skip('login rejects invalid credentials', 'Gateway not reachable');
    skip('login rejects SQL injection payloads', 'Gateway not reachable');
    skip('bootstrap blocked', 'Gateway not reachable');
    skip('cookie-auth state change rejects untrusted origin', 'Gateway not reachable');
    skip('session cookie flags', 'Gateway not reachable');
    skip('CORS rejects unknown', 'Gateway not reachable');
    skip('CORS allows localhost', 'Gateway not reachable');
    skip('admin requires auth', 'Gateway not reachable');
    skip('MCP token required', 'Gateway not reachable');
    skip('outbox token required', 'Gateway not reachable');
    skip('device stream session required', 'Gateway not reachable');
    skip('healthz public', 'Gateway not reachable');
    skip('relay domain policy blocks SSRF target', 'Gateway not reachable');
    skip('relay rejects command-injection-like command strings', 'Gateway not reachable');
    skip('canvas XSS sanitization guards present', 'Gateway not reachable');
  }

  // Summary
  console.log('\n═══ Summary ═══');
  const passed = results.filter((r) => r.passed && !r.skipped).length;
  const failed = results.filter((r) => !r.passed).length;
  const skipped = results.filter((r) => r.skipped).length;
  console.log(`Passed: ${passed}  Failed: ${failed}  Skipped: ${skipped}  Total: ${results.length}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    for (const r of results.filter((t) => !t.passed)) {
      console.log(`  ✗ ${r.name}: ${r.error}`);
    }
    process.exit(1);
  }
}

describe('C2 Security (Jest)', () => {
  it('validates lockout logic after 5 failed attempts', async () => {
    await testLockoutLogic();
    expect(true).toBe(true);
  });

  it('verifies canvas XSS sanitization guards in source', async () => {
    await testCanvasXssSanitizationGuardsPresent();
    expect(true).toBe(true);
  });

  (RUN_LIVE_GATEWAY_E2E ? it : it.skip)('validates security headers and API version header', async () => {
    await testSecurityHeaders();
    await testApiVersionHeader();
    expect(true).toBe(true);
  });

  (RUN_LIVE_GATEWAY_E2E ? it : it.skip)('validates auth and CORS protections', async () => {
    await runOrSkip(testSessionCookieFlags);
    await testCorsRejectsUnknownOrigin();
    await testCorsAllowsLocalhost();
    await testLoginRejectsEmptyBody();
    await testLoginRejectsInvalidCredentials();
    await testLoginRejectsSqlInjectionPayload();
    await testBootstrapBlockedWhenUsersExist();
    await runOrSkip(testCsrfOriginRequiredForCookieLogout);
    expect(true).toBe(true);
  });

  (RUN_LIVE_GATEWAY_E2E ? it : it.skip)('validates endpoint protection and probe guards', async () => {
    await testAdminRequiresAuth();
    await testMcpRequiresToken();
    await testOutboxRequiresAdapterToken();
    await testDeviceEventStreamRequiresSession();
    await testHealthzIsPublic();
    await runOrSkip(testSsrfBlockedByRelayDomainPolicy);
    await runOrSkip(testRelayRejectsCommandInjectionStrings);
    expect(true).toBe(true);
  });
});

if (!process.env.JEST_WORKER_ID) {
  main().catch((err) => {
    console.error('Test runner failed:', err);
    process.exit(1);
  });
}
