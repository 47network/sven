/*
 * Sven Gateway API – k6 Load Test
 *
 * Targets (C1.1):
 *   - 100 concurrent virtual users
 *   - 10 concurrent chat sessions
 *   - p95 < 500ms for non-LLM endpoints
 *   - p95 < 5000ms for LLM streaming first token
 *   - 0 5xx errors under sustained load
 *
 * Usage:
 *   k6 run tests/load/gateway-load-test.js
 *   k6 run --env BASE_URL=https://sven.example.com tests/load/gateway-load-test.js
 *   k6 run --env COOKIE="sven_session=abc123" tests/load/gateway-load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ── Configuration ────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const COOKIE = __ENV.COOKIE || '';
const ADAPTER_TOKEN = __ENV.ADAPTER_TOKEN || '';
const OPENAI_API_KEY = __ENV.OPENAI_API_KEY || '';
const OPENAI_MODEL = __ENV.OPENAI_MODEL || '';
const LLM_STREAM_VUS = Number(__ENV.LLM_STREAM_VUS || 2);
const LLM_STREAM_DURATION = __ENV.LLM_STREAM_DURATION || '5m';
const ENABLE_LLM_STREAM = Boolean(OPENAI_API_KEY && OPENAI_MODEL);

const scenarios = {
  // Ramp up to 100 concurrent users over 2 minutes, hold 5 minutes, ramp down
  standard_load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 50 },
      { duration: '1m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '1m', target: 0 },
    ],
    gracefulStop: '30s',
  },
  // 10 concurrent chat sessions (simulated agent interactions)
  chat_sessions: {
    executor: 'constant-vus',
    exec: 'chatSession',
    vus: 10,
    duration: '5m',
    startTime: '2m', // Start after ramp-up
    gracefulStop: '30s',
  },
};

if (ENABLE_LLM_STREAM) {
  scenarios.llm_first_token = {
    executor: 'constant-vus',
    exec: 'llmFirstToken',
    vus: LLM_STREAM_VUS,
    duration: LLM_STREAM_DURATION,
    startTime: '2m',
    gracefulStop: '30s',
  };
}

const thresholds = {
  'http_req_duration{type:health}': ['p(95)<500'],
  'http_req_duration{type:api}': ['p(95)<500'],
  'http_req_duration{type:admin}': ['p(95)<500'],
  error_rate: ['rate<0.001'], // <0.1% semantic errors based on endpoint checks
  errors_5xx: ['count<1'],
};

if (ENABLE_LLM_STREAM) {
  thresholds.llm_first_token_ms = ['p(95)<5000'];
}

export const options = {
  scenarios,
  thresholds,
};

// ── Custom Metrics ───────────────────────────────────────────────────────────
const errors5xx = new Counter('errors_5xx');
const healthLatency = new Trend('health_latency', true);
const apiLatency = new Trend('api_latency', true);
const adminLatency = new Trend('admin_latency', true);
const llmFirstTokenMetric = new Trend('llm_first_token_ms', true);
const errorRate = new Rate('error_rate');

// ── Helpers ──────────────────────────────────────────────────────────────────
function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (COOKIE) h['Cookie'] = COOKIE;
  return h;
}

function openAIHeaders() {
  return {
    ...headers(),
    Authorization: `Bearer ${OPENAI_API_KEY}`,
  };
}

function checkResponse(res, name) {
  const ok = check(res, {
    [`${name} status 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${name} no 5xx`]: (r) => r.status < 500,
  });
  if (res.status >= 500) {
    errors5xx.add(1);
  }
  errorRate.add(!ok);
  return ok;
}

// ── Scenarios ────────────────────────────────────────────────────────────────
export default function () {
  group('Health Probes', () => {
    const healthRes = http.get(`${BASE_URL}/healthz`, {
      tags: { type: 'health' },
    });
    healthLatency.add(healthRes.timings.duration);
    checkResponse(healthRes, 'healthz');

    const readyRes = http.get(`${BASE_URL}/readyz`, {
      tags: { type: 'health' },
    });
    healthLatency.add(readyRes.timings.duration);
    checkResponse(readyRes, 'readyz');
  });

  group('Public API', () => {
    // Contract version
    const contractRes = http.get(`${BASE_URL}/v1/contracts/version`, {
      headers: headers(),
      tags: { type: 'api' },
    });
    apiLatency.add(contractRes.timings.duration);
    checkResponse(contractRes, 'contracts/version');
  });

  if (COOKIE) {
    group('Admin Endpoints', () => {
      // Chats list
      const chatsRes = http.get(`${BASE_URL}/v1/admin/chats?limit=5`, {
        headers: headers(),
        tags: { type: 'admin' },
      });
      adminLatency.add(chatsRes.timings.duration);
      checkResponse(chatsRes, 'admin/chats');

      // Users list
      const usersRes = http.get(`${BASE_URL}/v1/admin/users?limit=5`, {
        headers: headers(),
        tags: { type: 'admin' },
      });
      adminLatency.add(usersRes.timings.duration);
      checkResponse(usersRes, 'admin/users');

      // Memory stats
      const memStatsRes = http.get(`${BASE_URL}/v1/admin/memories/stats`, {
        headers: headers(),
        tags: { type: 'admin' },
      });
      adminLatency.add(memStatsRes.timings.duration);
      checkResponse(memStatsRes, 'admin/memories/stats');

      // Approvals list
      const approvalsRes = http.get(`${BASE_URL}/v1/admin/approvals?status=pending&limit=10`, {
        headers: headers(),
        tags: { type: 'admin' },
      });
      adminLatency.add(approvalsRes.timings.duration);
      checkResponse(approvalsRes, 'admin/approvals');

      // Registry source list
      const sourcesRes = http.get(`${BASE_URL}/v1/admin/registry/sources?limit=5`, {
        headers: headers(),
        tags: { type: 'admin' },
      });
      adminLatency.add(sourcesRes.timings.duration);
      checkResponse(sourcesRes, 'admin/registry/sources');
    });
  }

  // Prometheus metrics endpoint
  group('Metrics', () => {
    const metricsRes = http.get(`${BASE_URL}/metrics`, {
      tags: { type: 'health' },
    });
    healthLatency.add(metricsRes.timings.duration);
    checkResponse(metricsRes, 'metrics');
  });

  sleep(Math.random() * 2 + 0.5); // 0.5-2.5s think time
}

// Chat session scenario (simulates agent sends)
export function chatSession() {
  if (!COOKIE && !ADAPTER_TOKEN) {
    sleep(5);
    return;
  }

  const chatHeaders = headers();
  if (ADAPTER_TOKEN) {
    chatHeaders['X-Adapter-Token'] = ADAPTER_TOKEN;
  }

  group('Chat Session', () => {
    // List sessions
    const sessionsRes = http.get(`${BASE_URL}/v1/admin/chats?limit=5`, {
      headers: chatHeaders,
      tags: { type: 'api' },
    });
    checkResponse(sessionsRes, 'chats/list');

    // Simulate agent message (POST to adapter endpoint)
    const msgPayload = JSON.stringify({
      channel: 'api',
      chat_id: `loadtest-${__VU}`,
      sender_identity_id: `loadtest-identity-${__VU}`,
      message: 'This is a load test probe message.',
    });

    const sendRes = http.post(`${BASE_URL}/v1/adapter/receive`, msgPayload, {
      headers: chatHeaders,
      tags: { type: 'api' },
    });
    apiLatency.add(sendRes.timings.duration);
    // Allow 4xx since test identities may not exist
    check(sendRes, {
      'send no 5xx': (r) => r.status < 500,
    });
    if (sendRes.status >= 500) errors5xx.add(1);
  });

  sleep(Math.random() * 5 + 2); // 2-7s between chat messages
}

// LLM first-token probe (OpenAI-compatible streaming endpoint)
// p95 is measured from `res.timings.waiting`, which in this context tracks time-to-first-byte.
export function llmFirstToken() {
  if (!ENABLE_LLM_STREAM) {
    sleep(1);
    return;
  }

  const payload = JSON.stringify({
    model: OPENAI_MODEL,
    stream: true,
    messages: [
      { role: 'system', content: 'You are a concise assistant.' },
      { role: 'user', content: 'Reply with one short sentence.' },
    ],
    max_tokens: 64,
  });

  const res = http.post(`${BASE_URL}/v1/chat/completions`, payload, {
    headers: openAIHeaders(),
    tags: { type: 'llm_stream' },
  });

  llmFirstTokenMetric.add(res.timings.waiting);
  const ok = check(res, {
    'llm stream status 200': (r) => r.status === 200,
    'llm stream no 5xx': (r) => r.status < 500,
    'llm stream has sse data': (r) => String(r.body || '').includes('data: '),
  });
  if (res.status >= 500) errors5xx.add(1);
  errorRate.add(!ok);
  sleep(Math.random() * 2 + 0.5);
}

// ── Summary Handler ──────────────────────────────────────────────────────────
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    test: 'Sven Gateway API Load Test',
    vus_max: 100,
    chat_sessions: 10,
    llm_stream_enabled: ENABLE_LLM_STREAM,
    llm_model: ENABLE_LLM_STREAM ? OPENAI_MODEL : null,
    thresholds: {},
    metrics: {},
  };

  // Extract threshold results
  for (const [name, threshold] of Object.entries(data.root_group?.checks || {})) {
    summary.thresholds[name] = threshold;
  }

  // Extract key metrics
  const metrics = data.metrics || {};
  for (const key of ['http_req_duration', 'http_req_failed', 'errors_5xx', 'health_latency', 'api_latency', 'admin_latency', 'llm_first_token_ms']) {
    if (metrics[key]) {
      summary.metrics[key] = metrics[key].values || metrics[key];
    }
  }

  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'docs/performance/load-test-results.json': JSON.stringify(summary, null, 2),
  };
}

// k6 built-in text summary (imported from k6 lib)
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js';
