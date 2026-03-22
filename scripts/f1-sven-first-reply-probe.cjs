#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = String(raw || '').trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    out[key] = value;
  }
  return out;
}

function extractCookieValue(headers, name) {
  const setCookie = headers.get('set-cookie') || '';
  const parts = String(setCookie).split(/,\s*/);
  for (const part of parts) {
    const first = String(part).split(';')[0] || '';
    if (first.startsWith(`${name}=`)) return first.slice(name.length + 1);
  }
  return '';
}

function pickTimeoutMs(envKey, fallback) {
  const raw = String(process.env[envKey] || '').trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

async function main() {
  const root = process.cwd();
  const envFile = parseEnvFile(path.join(root, '.env'));
  const apiBase = String(process.env.API_URL || process.env.F1_API_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
  const username = String(process.env.ADMIN_USERNAME || envFile.ADMIN_USERNAME || '').trim();
  const password = String(process.env.ADMIN_PASSWORD || envFile.ADMIN_PASSWORD || '').trim();
  const totpCode = String(process.env.ADMIN_TOTP_CODE || '').trim();
  const requestTimeoutMs = pickTimeoutMs('F1_SVEN_TIMEOUT_MS', 120000);

  if (!username || !password) {
    console.error('f1-sven-first-reply-probe: missing ADMIN_USERNAME/ADMIN_PASSWORD');
    process.exitCode = 2;
    return;
  }

  const loginRes = await fetch(`${apiBase}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(15000),
  });

  const loginBodyText = await loginRes.text();
  let loginBody = {};
  try { loginBody = loginBodyText ? JSON.parse(loginBodyText) : {}; } catch {}

  let sessionId = extractCookieValue(loginRes.headers, 'sven_session');
  if (!sessionId) {
    const requiresTotp = Boolean(loginBody?.data?.requires_totp);
    const preSessionId = String(loginBody?.data?.pre_session_id || '').trim();
    if (!requiresTotp || !preSessionId || !totpCode) {
      console.error('f1-sven-first-reply-probe: login did not produce session and TOTP flow unavailable');
      process.exitCode = 3;
      return;
    }
    const totpRes = await fetch(`${apiBase}/v1/auth/totp/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pre_session_id: preSessionId, code: totpCode }),
      signal: AbortSignal.timeout(15000),
    });
    if (!totpRes.ok) {
      console.error(`f1-sven-first-reply-probe: totp verify failed (${totpRes.status})`);
      process.exitCode = 4;
      return;
    }
    sessionId = extractCookieValue(totpRes.headers, 'sven_session');
  }

  if (!sessionId) {
    console.error('f1-sven-first-reply-probe: no sven_session established');
    process.exitCode = 5;
    return;
  }

  const authHeaders = {
    authorization: `Bearer ${sessionId}`,
    'content-type': 'application/json',
  };

  const modelsRes = await fetch(`${apiBase}/v1/models`, {
    method: 'GET',
    headers: authHeaders,
    signal: AbortSignal.timeout(15000),
  });
  const modelsText = await modelsRes.text();
  if (!modelsRes.ok) {
    console.error(`f1-sven-first-reply-probe: /v1/models failed (${modelsRes.status}) ${modelsText.slice(0, 200)}`);
    process.exitCode = 6;
    return;
  }

  let modelsData = {};
  try { modelsData = modelsText ? JSON.parse(modelsText) : {}; } catch {}
  const modelList = Array.isArray(modelsData?.data) ? modelsData.data : [];
  const modelName = String(modelList[0]?.id || modelList[0]?.name || '').trim();
  if (!modelName) {
    console.error('f1-sven-first-reply-probe: no models available in /v1/models');
    process.exitCode = 20;
    return;
  }

  const chatRes = await fetch(`${apiBase}/v1/chat/completions`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: 'user', content: 'Reply with exactly: SVEN_READY' }],
      temperature: 0,
      max_tokens: 16,
    }),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const chatText = await chatRes.text();
  if (!chatRes.ok) {
    if (chatRes.status === 502 || chatRes.status === 503 || chatRes.status === 504) {
      console.error(`f1-sven-first-reply-probe: upstream llm unavailable (${chatRes.status})`);
      process.exitCode = 21;
      return;
    }
    console.error(`f1-sven-first-reply-probe: /v1/chat/completions failed (${chatRes.status}) ${chatText.slice(0, 400)}`);
    process.exitCode = 8;
    return;
  }

  let chatData = {};
  try { chatData = chatText ? JSON.parse(chatText) : {}; } catch {}
  const content = String(chatData?.choices?.[0]?.message?.content || '').trim();
  if (!content) {
    console.error('f1-sven-first-reply-probe: empty assistant content');
    process.exitCode = 9;
    return;
  }

  console.log(`f1-sven-first-reply-probe: success model=${modelName} reply="${content.slice(0, 120)}"`);
}

main().catch((err) => {
  const msg = String(err && err.message ? err.message : err);
  const lower = msg.toLowerCase();
  console.error(`f1-sven-first-reply-probe: fatal ${msg}`);
  if (lower.includes('timeout')) {
    process.exitCode = 21;
    return;
  }
  if (lower.includes('fetch failed') || lower.includes('econn') || lower.includes('network')) {
    process.exitCode = 30;
    return;
  }
  process.exitCode = 1;
});
