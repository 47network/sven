#!/usr/bin/env node
/* eslint-disable no-console */

function argHas(name) {
  return process.argv.includes(name);
}

function pickEnv(keys, fallback = '') {
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  return fallback;
}

function pickTimeoutEnv(keys, fallbackMs) {
  for (const key of keys) {
    const raw = String(process.env[key] || '').trim();
    if (!raw) continue;
    const num = Number(raw);
    if (Number.isFinite(num) && num > 0) return Math.floor(num);
  }
  return fallbackMs;
}

async function fetchHealth(baseUrl) {
  const candidates = ['/healthz', '/health', '/'];
  for (const endpoint of candidates) {
    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
      });
      if (res.status > 0 && res.status < 500) return { ok: true, endpoint, status: res.status };
    } catch {}
  }
  return { ok: false };
}

async function main() {
  const healthOnly = argHas('--health-only');
  const baseUrl = pickEnv(['F1_OPENCLAW_URL', 'OPENCLAW_URL'], 'http://127.0.0.1:18789').replace(/\/+$/, '');
  const authToken = pickEnv(['F1_OPENCLAW_AUTH_TOKEN', 'OPENCLAW_GATEWAY_TOKEN', 'OPENCLAW_GATEWAY_PASSWORD']);
  const model = pickEnv(['F1_OPENCLAW_MODEL'], 'openclaw:main');
  const agentId = pickEnv(['F1_OPENCLAW_AGENT_ID'], 'main');
  const timeoutMs = pickTimeoutEnv(['F1_OPENCLAW_TIMEOUT_MS'], 180000);

  const health = await fetchHealth(baseUrl);
  if (!health.ok) {
    console.error(`f1-openclaw-first-reply-probe: service unavailable at ${baseUrl}`);
    process.exitCode = 30;
    return;
  }

  if (healthOnly) {
    console.log(`f1-openclaw-first-reply-probe: health ok (${health.endpoint} ${health.status})`);
    return;
  }

  if (!authToken) {
    console.error('f1-openclaw-first-reply-probe: missing F1_OPENCLAW_AUTH_TOKEN/OPENCLAW_GATEWAY_TOKEN');
    process.exitCode = 31;
    return;
  }

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${authToken}`,
      'content-type': 'application/json',
      'x-openclaw-agent-id': agentId,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Reply with exactly: OPENCLAW_READY' }],
      stream: false,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await res.text();
  if (!res.ok) {
    const body = String(text || '').toLowerCase();
    if (res.status === 404 && body.includes('not found')) {
      console.error('f1-openclaw-first-reply-probe: endpoint disabled (/v1/chat/completions)');
      process.exitCode = 32;
      return;
    }
    if (res.status === 502 || res.status === 503 || res.status === 504 || body.includes('internal error')) {
      console.error(`f1-openclaw-first-reply-probe: upstream llm unavailable (${res.status})`);
      process.exitCode = 21;
      return;
    }
    console.error(`f1-openclaw-first-reply-probe: request failed (${res.status}) ${text.slice(0, 300)}`);
    process.exitCode = 8;
    return;
  }

  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  const content = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!content) {
    console.error('f1-openclaw-first-reply-probe: empty assistant response');
    process.exitCode = 9;
    return;
  }

  console.log(`f1-openclaw-first-reply-probe: success model=${model} reply="${content.slice(0, 120)}"`);
}

main().catch((err) => {
  const msg = String(err && err.message ? err.message : err).toLowerCase();
  console.error(`f1-openclaw-first-reply-probe: fatal ${msg}`);
  if (msg.includes('timeout')) {
    process.exitCode = 21;
    return;
  }
  if (msg.includes('fetch failed') || msg.includes('econn') || msg.includes('network')) {
    process.exitCode = 30;
    return;
  }
  process.exitCode = 1;
});
