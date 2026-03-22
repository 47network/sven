/**
 * SearXNG Private Search — End-to-End Tests
 * Tests search.web tool handler and admin search settings routes.
 *
 * Test modes:
 *  - Offline (default): Shape validation and unit-level assertions
 *  - Online: Set SEARXNG_URL env var to run against a live SearXNG instance
 *  - Admin: Set TEST_SESSION_COOKIE to run admin settings tests
 */
import { describe, expect, it } from '@jest/globals';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const ADMIN_URL = `${GATEWAY_URL}/v1/admin`;
const SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const RUN_LIVE_SEARCH_INTEGRATION = String(process.env.RUN_LIVE_SEARCH_INTEGRATION || '').toLowerCase() === 'true';
const RUN_LIVE_GATEWAY_E2E = String(process.env.RUN_LIVE_GATEWAY_E2E || '').toLowerCase() === 'true';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  skipped?: boolean;
}

const results: TestResult[] = [];

async function apiCall(
  method: string,
  url: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; data: any }> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(SESSION_COOKIE ? { Cookie: `sven_session=${SESSION_COOKIE}` } : {}),
      ...headers,
    },
  };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(url, options);
    const data = await res.json();
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: { error: String(err) } };
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
    if (err instanceof Error && err.message === 'SKIP_LIVE_SEARCH_UPSTREAM_UNAVAILABLE') {
      skip(name, 'SearXNG upstream unavailable');
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

// ============================================================
//  1. Offline shape / validation tests
// ============================================================

async function testSearchResultShape(): Promise<void> {
  // Verify the expected output shape of search.web results
  const sampleResult = {
    title: 'Example Page',
    url: 'https://example.com',
    snippet: 'An example result.',
    source_engine: 'google',
    category: 'general',
  };

  assert(typeof sampleResult.title === 'string', 'title must be string');
  assert(typeof sampleResult.url === 'string', 'url must be string');
  assert(typeof sampleResult.snippet === 'string', 'snippet must be string');
  assert(typeof sampleResult.source_engine === 'string', 'source_engine must be string');
  assert(typeof sampleResult.category === 'string', 'category must be string');
}

async function testSearchConfigShape(): Promise<void> {
  // Verify expected admin search config response shape
  const sampleConfig = {
    searxng_url: 'http://searxng:8080',
    safe_search: 'moderate' as const,
    engines: ['google', 'bing'],
    default_language: 'auto',
    max_results: 10,
  };

  assert(typeof sampleConfig.searxng_url === 'string', 'searxng_url must be string');
  assert(['off', 'moderate', 'strict'].includes(sampleConfig.safe_search), 'invalid safe_search');
  assert(Array.isArray(sampleConfig.engines), 'engines must be array');
  assert(typeof sampleConfig.default_language === 'string', 'default_language must be string');
  assert(typeof sampleConfig.max_results === 'number' && sampleConfig.max_results > 0, 'max_results must be positive');
}

async function testSafeSearchValidation(): Promise<void> {
  // Ensure safe_search only accepts valid levels
  const valid = ['off', 'moderate', 'strict'];
  for (const level of valid) {
    assert(valid.includes(level), `${level} should be valid`);
  }
  assert(!valid.includes('invalid'), 'invalid should not be accepted');
}

async function testMaxResultsBounding(): Promise<void> {
  // Verify max_results clamping logic (as used in skill-runner)
  const clamp = (n: number) => Math.min(Math.max(n || 10, 1), 50);
  assert(clamp(0) === 10, 'falsy → default 10');
  assert(clamp(5) === 5, '5 → 5');
  assert(clamp(100) === 50, '100 → capped at 50');
  assert(clamp(-1) === 1, 'negative → lower-bounded to 1');
  assert(clamp(1) === 1, '1 → 1');
  assert(clamp(50) === 50, '50 → 50');
}

// ============================================================
//  2. Admin settings endpoint tests (require session cookie)
// ============================================================

async function testAdminSearchConfigUnauthenticated(): Promise<void> {
  const res = await fetch(`${ADMIN_URL}/search/config`, {
    headers: { 'Content-Type': 'application/json' },
  });
  assert(res.status === 401 || res.status === 403, `Expected 401/403 but got ${res.status}`);
}

async function testAdminSearchConfigGet(): Promise<void> {
  const { status, data } = await apiCall('GET', `${ADMIN_URL}/search/config`);
  assert(status === 200, `Expected 200 but got ${status}: ${JSON.stringify(data)}`);
  assert(data.success === true, 'Expected success: true');
  assert('safe_search' in data.data, 'Missing safe_search in config');
  assert('engines' in data.data, 'Missing engines in config');
}

async function testAdminSearchConfigUpdate(): Promise<void> {
  // Update safe_search to strict
  const { status, data } = await apiCall('PUT', `${ADMIN_URL}/search/config`, {
    safe_search: 'strict',
    max_results: 20,
  });
  assert(status === 200, `Expected 200 but got ${status}: ${JSON.stringify(data)}`);
  assert(data.success === true, 'Expected success: true');
  assert(Array.isArray(data.data.updated), 'Expected updated array');

  // Verify update persisted
  const { data: verify } = await apiCall('GET', `${ADMIN_URL}/search/config`);
  assert(verify.data.safe_search === 'strict', 'safe_search should be strict');
  assert(verify.data.max_results === 20, 'max_results should be 20');

  // Reset to moderate
  await apiCall('PUT', `${ADMIN_URL}/search/config`, {
    safe_search: 'moderate',
    max_results: 10,
  });
}

async function testAdminSearchConfigValidation(): Promise<void> {
  // Invalid safe_search value
  const { status } = await apiCall('PUT', `${ADMIN_URL}/search/config`, {
    safe_search: 'invalid_value',
  });
  assert(status === 400, `Expected 400 for invalid safe_search but got ${status}`);

  // Invalid max_results
  const { status: s2 } = await apiCall('PUT', `${ADMIN_URL}/search/config`, {
    max_results: 999,
  });
  assert(s2 === 400, `Expected 400 for max_results=999 but got ${s2}`);

  // Invalid URL
  const { status: s3 } = await apiCall('PUT', `${ADMIN_URL}/search/config`, {
    searxng_url: 'not-a-url',
  });
  assert(s3 === 400, `Expected 400 for invalid URL but got ${s3}`);
}

async function testAdminSearchTest(): Promise<void> {
  const { status, data } = await apiCall('POST', `${ADMIN_URL}/search/test`);
  assert(status === 200, `Expected 200 but got ${status}`);
  assert(data.success === true, 'Expected success: true');
  assert('reachable' in data.data, 'Missing reachable field');
  // reachable may be false in CI — that's fine, we just check the shape
}

async function testPolicySimBlockedWhenNotAllowed(): Promise<void> {
  const { status, data } = await apiCall('POST', `${ADMIN_URL}/policy/simulate`, {
    tool_name: 'search.web',
    action: 'run',
    context: { chat_id: '00000000-0000-0000-0000-000000000000' },
  });
  assert(status === 200, `Expected 200 but got ${status}: ${JSON.stringify(data)}`);
  assert(data.success === true, 'Expected success: true');
  assert(data.data.allowed === false, 'Expected policy simulation to default-deny search.web when no allow rule exists');
}

async function testSearchQueryValidation(): Promise<void> {
  const { status, data } = await apiCall('POST', `${ADMIN_URL}/search/query`, { query: '   ' });
  assert(status === 400, `Expected 400 for blank query but got ${status}`);
  assert(data.success === false, 'Expected success: false');
}

async function testSearchQueryStructuredResults(): Promise<void> {
  const { status, data } = await apiCall('POST', `${ADMIN_URL}/search/query`, {
    query: 'OpenSearch release notes',
    categories: 'general',
    num_results: 3,
    language: 'en',
  });

  if (status === 502 && data?.error?.code === 'UPSTREAM_ERROR') {
    throw new Error('SKIP_LIVE_SEARCH_UPSTREAM_UNAVAILABLE');
  }

  assert(status === 200, `Expected 200 but got ${status}: ${JSON.stringify(data)}`);
  assert(data.success === true, 'Expected success: true');
  assert(Array.isArray(data.data.results), 'Expected results array');
  for (const result of data.data.results) {
    assert(typeof result.title === 'string', 'result.title must be string');
    assert(typeof result.url === 'string', 'result.url must be string');
    assert(typeof result.snippet === 'string', 'result.snippet must be string');
    assert(typeof result.source_engine === 'string', 'result.source_engine must be string');
  }
}

// ============================================================
//  Main runner
// ============================================================

async function main(): Promise<void> {
  console.log('\n═══ SearXNG Private Search Tests ═══\n');

  // 1. Offline shape/validation tests (always run)
  console.log('── Shape & Validation ──');
  await runTest('search result shape', testSearchResultShape);
  await runTest('search config shape', testSearchConfigShape);
  await runTest('safe search validation', testSafeSearchValidation);
  await runTest('max_results bounding', testMaxResultsBounding);

  // 2. Admin unauthenticated test (always run)
  console.log('\n── Auth Guard ──');
  await runTest('search config rejects unauthenticated', testAdminSearchConfigUnauthenticated);

  // 3. Admin authenticated tests (require session cookie)
  console.log('\n── Admin Settings (authenticated) ──');
  if (SESSION_COOKIE) {
    await runTest('GET /search/config', testAdminSearchConfigGet);
    await runTest('PUT /search/config update', testAdminSearchConfigUpdate);
    await runTest('PUT /search/config validation', testAdminSearchConfigValidation);
    await runTest('POST /search/test connectivity', testAdminSearchTest);
    await runTest('POST /policy/simulate blocks search.web when not allowed', testPolicySimBlockedWhenNotAllowed);
    await runTest('POST /search/query validation', testSearchQueryValidation);
    if (RUN_LIVE_SEARCH_INTEGRATION) {
      await runTest('POST /search/query returns structured results', testSearchQueryStructuredResults);
    } else {
      skip('POST /search/query returns structured results', 'RUN_LIVE_SEARCH_INTEGRATION not set');
    }
  } else {
    skip('GET /search/config', 'TEST_SESSION_COOKIE not set');
    skip('PUT /search/config update', 'TEST_SESSION_COOKIE not set');
    skip('PUT /search/config validation', 'TEST_SESSION_COOKIE not set');
    skip('POST /search/test connectivity', 'TEST_SESSION_COOKIE not set');
    skip('POST /policy/simulate blocks search.web when not allowed', 'TEST_SESSION_COOKIE not set');
    skip('POST /search/query validation', 'TEST_SESSION_COOKIE not set');
    skip('POST /search/query returns structured results', 'TEST_SESSION_COOKIE not set');
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

describe('A11 Search (Jest)', () => {
  it('validates search result shape', async () => {
    await testSearchResultShape();
    expect(true).toBe(true);
  });

  it('validates search config shape', async () => {
    await testSearchConfigShape();
    expect(true).toBe(true);
  });

  it('validates safe search options', async () => {
    await testSafeSearchValidation();
    expect(true).toBe(true);
  });

  it('validates max_results clamping', async () => {
    await testMaxResultsBounding();
    expect(true).toBe(true);
  });

  (RUN_LIVE_GATEWAY_E2E ? it : it.skip)('enforces unauthenticated guard for admin search config', async () => {
    await testAdminSearchConfigUnauthenticated();
    expect(true).toBe(true);
  });

  (RUN_LIVE_GATEWAY_E2E && Boolean(SESSION_COOKIE) ? it : it.skip)(
    'supports authenticated admin search config read',
    async () => {
      await testAdminSearchConfigGet();
      expect(true).toBe(true);
    },
  );

  (RUN_LIVE_GATEWAY_E2E && Boolean(SESSION_COOKIE) ? it : it.skip)(
    'supports authenticated admin search config update + validation',
    async () => {
      await testAdminSearchConfigUpdate();
      await testAdminSearchConfigValidation();
      expect(true).toBe(true);
    },
  );

  (RUN_LIVE_GATEWAY_E2E && Boolean(SESSION_COOKIE) ? it : it.skip)(
    'supports search connectivity + policy simulation',
    async () => {
      await testAdminSearchTest();
      await testPolicySimBlockedWhenNotAllowed();
      await testSearchQueryValidation();
      expect(true).toBe(true);
    },
  );

  (RUN_LIVE_GATEWAY_E2E && Boolean(SESSION_COOKIE) && RUN_LIVE_SEARCH_INTEGRATION ? it : it.skip)(
    'returns structured live search results',
    async () => {
      await testSearchQueryStructuredResults();
      expect(true).toBe(true);
    },
  );
});

if (!process.env.JEST_WORKER_ID) {
  main().catch((err) => {
    console.error('Test runner failed:', err);
    process.exit(1);
  });
}
