#!/usr/bin/env node
/* eslint-disable no-console */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '47';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sven-admin-dev-47';
const EXPECT_DEGRADED = (process.env.FM_EXPECT_DEGRADED || 'true').toLowerCase() !== 'false';

function extractCookie(setCookieHeader) {
  if (!setCookieHeader) return '';
  return String(setCookieHeader).split(';')[0];
}

async function login() {
  const res = await fetch(`${API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status}`);
  }
  const cookie = extractCookie(res.headers.get('set-cookie'));
  if (!cookie) {
    throw new Error('Login succeeded but no session cookie was returned');
  }
  return cookie;
}

async function checkRag(cookie) {
  const res = await fetch(`${API_URL}/v1/admin/rag/search`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie,
    },
    body: JSON.stringify({
      query: 'health check fallback query',
      top_n: 3,
      top_k: 3,
      user_id: 'failure-mode',
      chat_id: 'failure-mode',
    }),
  });
  if (!res.ok) {
    throw new Error(`RAG search failed: ${res.status}`);
  }
  const payload = await res.json();
  const degraded = Boolean(payload?.meta?.degraded_vector_only);
  if (degraded !== EXPECT_DEGRADED) {
    throw new Error(`Unexpected degraded_vector_only=${degraded} expected=${EXPECT_DEGRADED}`);
  }
  console.log(`verify-rag-degraded: ok degraded_vector_only=${degraded}`);
}

async function main() {
  const cookie = await login();
  await checkRag(cookie);
}

main().catch((err) => {
  console.error('verify-rag-degraded failed:', err);
  process.exit(1);
});

