#!/usr/bin/env node
/* eslint-disable no-console */
const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const os = require('node:os');

function argValue(name, fallback = '') {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
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

function inferSvenConfigPath() {
  const profileRaw = String(process.env.SVEN_PROFILE || 'default');
  const profile = profileRaw.replace(/[^a-zA-Z0-9._-]/g, '') || 'default';
  if (process.env.SVEN_CONFIG) return String(process.env.SVEN_CONFIG);
  if (profile === 'default') return join(os.homedir(), '.sven', 'sven.json');
  return join(os.homedir(), '.sven', 'profiles', profile, 'sven.json');
}

function loadAdapterTokenFromConfig() {
  const configPath = inferSvenConfigPath();
  if (!existsSync(configPath)) return '';
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8'));
    const direct = String(parsed?.adapter?.token || '').trim();
    if (direct) return direct;
    const envValue = String(parsed?.env?.SVEN_ADAPTER_TOKEN || '').trim();
    if (envValue) return envValue;
    return '';
  } catch {
    return '';
  }
}

async function loginCookie(apiBase) {
  const adminUsername = String(process.env.ADMIN_USERNAME || '');
  const adminPassword = String(process.env.ADMIN_PASSWORD || '');
  const adminTotpCode = String(process.env.ADMIN_TOTP_CODE || '');
  if (!adminUsername || !adminPassword) return '';

  const loginRes = await fetch(`${apiBase}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: adminUsername, password: adminPassword }),
  });
  const loginText = await loginRes.text().catch(() => '');
  const loginData = parseJsonSafe(loginText);

  let cookie = extractSessionCookieFromHeaders(loginRes.headers);
  if (cookie) return cookie;

  const requiresTotp = Boolean(loginData?.data?.requires_totp);
  const preSessionId = String(loginData?.data?.pre_session_id || '');
  if (!requiresTotp || !preSessionId || !adminTotpCode) return '';

  const totpRes = await fetch(`${apiBase}/v1/auth/totp/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pre_session_id: preSessionId, code: adminTotpCode }),
  });
  if (!totpRes.ok) return '';
  cookie = extractSessionCookieFromHeaders(totpRes.headers);
  return cookie;
}

function setDefaultScenarioCommands(env) {
  const defaults = {
    F3_MODEL_INDUCE_CMD: 'node scripts/failure-mode/f3-model-provider-unavailable.cjs induce',
    F3_MODEL_DETECT_CMD: 'node scripts/failure-mode/f3-model-provider-unavailable.cjs verify-degraded',
    F3_MODEL_RECOVER_CMD: 'node scripts/failure-mode/f3-model-provider-unavailable.cjs recover',
    F3_MODEL_VERIFY_RECOVERED_CMD: 'node scripts/failure-mode/f3-model-provider-unavailable.cjs verify-recovered',

    F3_TOOL_TIMEOUT_INDUCE_CMD: 'node scripts/failure-mode/f3-tool-timeout-loop.cjs induce',
    F3_TOOL_TIMEOUT_DETECT_CMD: 'node scripts/failure-mode/f3-tool-timeout-loop.cjs verify-degraded',
    F3_TOOL_TIMEOUT_RECOVER_CMD: 'node scripts/failure-mode/f3-tool-timeout-loop.cjs recover',
    F3_TOOL_TIMEOUT_VERIFY_RECOVERED_CMD: 'node scripts/failure-mode/f3-tool-timeout-loop.cjs verify-recovered',
  };
  for (const [k, v] of Object.entries(defaults)) {
    if (!env[k]) env[k] = v;
  }
}

async function main() {
  const apiBase = argValue('--api-url', process.env.API_URL || 'http://127.0.0.1:3000');
  const strict = process.argv.includes('--strict');
  const env = { ...process.env };
  env.API_URL = apiBase;
  env.F3_EVIDENCE_MODE = String(env.F3_EVIDENCE_MODE || 'local_runner');
  if (!env.F3_SOURCE_RUN_ID) env.F3_SOURCE_RUN_ID = `local-${Date.now()}`;

  setDefaultScenarioCommands(env);

  const explicitTokenProvided = Boolean(String(env.FM_CHANNEL_VALID_ADAPTER_TOKEN || env.SVEN_ADAPTER_TOKEN || '').trim());
  let usedAutoProfileToken = false;
  if (!env.FM_CHANNEL_VALID_ADAPTER_TOKEN) {
    const fromEnv = String(env.SVEN_ADAPTER_TOKEN || '').trim();
    const fromProfile = loadAdapterTokenFromConfig();
    env.FM_CHANNEL_VALID_ADAPTER_TOKEN = fromEnv || fromProfile;
    usedAutoProfileToken = Boolean(!fromEnv && fromProfile);
  }

  const explicitCookieProvided = Boolean(String(env.F3_POLICY_COOKIE || env.COOKIE || env.SVEN_SESSION_COOKIE || '').trim());
  let usedAutoLoginCookie = false;
  if (!env.F3_POLICY_COOKIE && !env.COOKIE && !env.SVEN_SESSION_COOKIE) {
    const cookie = await loginCookie(apiBase);
    if (cookie) {
      env.F3_POLICY_COOKIE = cookie;
      usedAutoLoginCookie = true;
    }
  }

  if (!env.F3_CREDENTIAL_SOURCE_MODE) {
    const modes = [];
    if (explicitTokenProvided || explicitCookieProvided) modes.push('explicit_env');
    if (usedAutoProfileToken) modes.push('local_profile_auto');
    if (usedAutoLoginCookie) modes.push('local_login_auto');
    if (!modes.length) modes.push('none');
    env.F3_CREDENTIAL_SOURCE_MODE = modes.join('+');
  }

  if (strict && (usedAutoProfileToken || usedAutoLoginCookie)) {
    console.error(
      `f3-local-runner strict blocked: auto credential discovery not allowed (credential_source_mode=${env.F3_CREDENTIAL_SOURCE_MODE})`,
    );
    process.exit(2);
  }

  const hasToken = Boolean(String(env.FM_CHANNEL_VALID_ADAPTER_TOKEN || '').trim());
  const hasPolicyCookie = Boolean(
    String(env.F3_POLICY_COOKIE || env.COOKIE || env.SVEN_SESSION_COOKIE || '').trim(),
  );

  if (hasToken) {
    if (!env.F3_CHANNEL_INDUCE_CMD) env.F3_CHANNEL_INDUCE_CMD = 'node scripts/failure-mode/f3-channel-credential.cjs induce';
    if (!env.F3_CHANNEL_DETECT_CMD) env.F3_CHANNEL_DETECT_CMD = 'node scripts/failure-mode/f3-channel-credential.cjs verify-degraded';
    if (!env.F3_CHANNEL_RECOVER_CMD) env.F3_CHANNEL_RECOVER_CMD = 'node scripts/failure-mode/f3-channel-credential.cjs recover';
    if (!env.F3_CHANNEL_VERIFY_RECOVERED_CMD) env.F3_CHANNEL_VERIFY_RECOVERED_CMD = 'node scripts/failure-mode/f3-channel-credential.cjs verify-recovered';
  } else {
    delete env.F3_CHANNEL_INDUCE_CMD;
    delete env.F3_CHANNEL_DETECT_CMD;
    delete env.F3_CHANNEL_RECOVER_CMD;
    delete env.F3_CHANNEL_VERIFY_RECOVERED_CMD;
  }

  if (hasPolicyCookie) {
    if (!env.F3_POLICY_INDUCE_CMD) env.F3_POLICY_INDUCE_CMD = 'node scripts/failure-mode/f3-invalid-policy-configuration.cjs induce';
    if (!env.F3_POLICY_DETECT_CMD) env.F3_POLICY_DETECT_CMD = 'node scripts/failure-mode/f3-invalid-policy-configuration.cjs verify-degraded';
    if (!env.F3_POLICY_RECOVER_CMD) env.F3_POLICY_RECOVER_CMD = 'node scripts/failure-mode/f3-invalid-policy-configuration.cjs recover';
    if (!env.F3_POLICY_VERIFY_RECOVERED_CMD) env.F3_POLICY_VERIFY_RECOVERED_CMD = 'node scripts/failure-mode/f3-invalid-policy-configuration.cjs verify-recovered';
  } else {
    delete env.F3_POLICY_INDUCE_CMD;
    delete env.F3_POLICY_DETECT_CMD;
    delete env.F3_POLICY_RECOVER_CMD;
    delete env.F3_POLICY_VERIFY_RECOVERED_CMD;
  }
  console.log(
    `f3-local-runner: preflight token=${hasToken ? 'yes' : 'no'} policy_cookie=${hasPolicyCookie ? 'yes' : 'no'} api=${apiBase}`,
  );

  const childArgs = ['scripts/f3-reliability-recovery-benchmark.cjs'];
  if (strict) childArgs.push('--strict');
  const child = spawnSync('node', childArgs, {
    stdio: 'inherit',
    env,
  });
  process.exit(child.status || 0);
}

main().catch((err) => {
  console.error('run-f3-benchmark-local failed:', err);
  process.exit(1);
});
