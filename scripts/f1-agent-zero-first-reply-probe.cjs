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

async function healthCheck(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const healthOnly = argHas('--health-only');
  const baseUrl = pickEnv(['F1_AGENT0_URL', 'AGENT0_URL'], 'http://127.0.0.1:50001').replace(/\/+$/, '');
  const apiKey = pickEnv(['F1_AGENT0_API_KEY', 'AGENT0_API_KEY']);
  const requestTimeoutMs = Number(process.env.F1_AGENT0_TIMEOUT_MS || '300000');
  const message = pickEnv(
    ['F1_AGENT0_MESSAGE'],
    [
      'Return only one valid JSON object for Agent Zero tool execution.',
      'Use this exact schema keys: thoughts, headline, tool_name, tool_args.',
      'Set tool_name to "response".',
      'Set tool_args to {"text":"AGENT_ZERO_READY"}.',
      'Do not add markdown or code fences.',
    ].join(' ')
  );

  const healthy = await healthCheck(baseUrl);
  if (!healthy) {
    console.error(`f1-agent-zero-first-reply-probe: service unavailable at ${baseUrl}`);
    process.exitCode = 30;
    return;
  }

  if (healthOnly) {
    console.log('f1-agent-zero-first-reply-probe: health ok');
    return;
  }

  if (!apiKey) {
    console.error('f1-agent-zero-first-reply-probe: missing F1_AGENT0_API_KEY/AGENT0_API_KEY');
    process.exitCode = 31;
    return;
  }

  const messageRes = await fetch(`${baseUrl}/api_message`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      message,
      lifetime_hours: 1,
    }),
    signal: AbortSignal.timeout(Number.isFinite(requestTimeoutMs) ? requestTimeoutMs : 300000),
  });

  const messageText = await messageRes.text();
  if (!messageRes.ok) {
    const body = String(messageText || '').toLowerCase();
    if (messageRes.status === 401 && body.includes('api key')) {
      console.error(`f1-agent-zero-first-reply-probe: auth failed (${messageRes.status})`);
      process.exitCode = 8;
      return;
    }
    if (messageRes.status >= 500 || body.includes('no api key') || body.includes('provider')) {
      console.error(`f1-agent-zero-first-reply-probe: upstream llm unavailable (${messageRes.status})`);
      process.exitCode = 21;
      return;
    }
    console.error(`f1-agent-zero-first-reply-probe: request failed (${messageRes.status}) ${messageText.slice(0, 300)}`);
    process.exitCode = 8;
    return;
  }

  let payload = {};
  try { payload = messageText ? JSON.parse(messageText) : {}; } catch {}
  const reply = String(payload?.response || '').trim();
  const contextId = String(payload?.context_id || '').trim();
  if (!reply) {
    console.error('f1-agent-zero-first-reply-probe: empty assistant response');
    process.exitCode = 9;
    return;
  }

  if (contextId) {
    try {
      await fetch(`${baseUrl}/api_terminate_chat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({ context_id: contextId }),
        signal: AbortSignal.timeout(15000),
      });
    } catch {}
  }

  console.log(`f1-agent-zero-first-reply-probe: success reply="${reply.slice(0, 120)}"`);
}

main().catch((err) => {
  const msg = String(err && err.message ? err.message : err).toLowerCase();
  console.error(`f1-agent-zero-first-reply-probe: fatal ${msg}`);
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
