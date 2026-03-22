#!/usr/bin/env node
'use strict';

const http = require('http');
const https = require('https');

const API_BASE = (process.env.API_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');
const TEST_SESSION_COOKIE = String(process.env.TEST_SESSION_COOKIE || '').trim();
const TEST_BEARER_TOKEN = String(process.env.TEST_BEARER_TOKEN || '').trim();
const TEST_ADMIN_USERNAME = String(process.env.TEST_ADMIN_USERNAME || '').trim();
const TEST_ADMIN_PASSWORD = String(process.env.TEST_ADMIN_PASSWORD || '').trim();

const KEYCLOAK_BASE_URL = (process.env.KEYCLOAK_BASE_URL || 'http://127.0.0.1:8081').replace(/\/+$/, '');
const KEYCLOAK_REALM = String(process.env.KEYCLOAK_REALM || 'sven').trim();
const KEYCLOAK_CLIENT_ID = String(process.env.KEYCLOAK_CLIENT_ID || 'sven-gateway').trim();
const KEYCLOAK_CLIENT_SECRET = String(process.env.KEYCLOAK_CLIENT_SECRET || 'sven-gateway-secret').trim();
const KEYCLOAK_USERNAME = String(process.env.KEYCLOAK_TEST_USERNAME || 'sven-sso-user').trim();
const KEYCLOAK_PASSWORD = String(process.env.KEYCLOAK_TEST_PASSWORD || 'sven-sso-pass').trim();
const OIDC_REDIRECT_URI = String(
  process.env.SSO_OIDC_REDIRECT_URI || `${API_BASE}/v1/auth/sso/oidc/callback`,
).trim();
const LEGACY_STATIC_TEST_TOKENS = new Set([
  '11111111-1111-4111-8111-111111111111',
]);

function parseArgs(argv) {
  const args = {
    browserFlowOnly: false,
    reportJsonPath: '',
    strict: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '').trim();
    if (!token) continue;
    if (token === '--browser-flow-only') {
      args.browserFlowOnly = true;
      continue;
    }
    if (token === '--strict') {
      args.strict = true;
      continue;
    }
    if (token === '--report-json' && i + 1 < argv.length) {
      args.reportJsonPath = String(argv[i + 1] || '').trim();
      i += 1;
    }
  }
  return args;
}

function isSet(name) {
  return String(process.env[name] || '').trim().length > 0;
}

function toJsonSafe(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function writeJsonReport(reportJsonPath, value) {
  if (!reportJsonPath) return;
  const fullPath = require('path').isAbsolute(reportJsonPath)
    ? reportJsonPath
    : require('path').join(process.cwd(), reportJsonPath);
  require('fs').mkdirSync(require('path').dirname(fullPath), { recursive: true });
  require('fs').writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function request(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.request(
      {
        method: opts.method || 'GET',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: opts.headers || {},
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += String(chunk);
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers || {},
            raw,
            json: toJsonSafe(raw),
          });
        });
      },
    );
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function bodyPreview(res) {
  if (!res) return '';
  const raw = String(res.raw || '').trim();
  if (raw) return raw.length > 400 ? `${raw.slice(0, 400)}...` : raw;
  try {
    const json = JSON.stringify(res.json || {});
    return json.length > 400 ? `${json.slice(0, 400)}...` : json;
  } catch {
    return '';
  }
}

async function apiCall(method, endpoint, body, opts = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {};
  let payload = '';
  if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['content-type'] = 'application/json';
    headers['content-length'] = String(Buffer.byteLength(payload));
  }
  if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`;
  if (opts.cookie) headers.cookie = opts.cookie;
  return request(url, { method, headers, body: payload });
}

function parseCookieHeader(setCookieHeader) {
  const rows = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader].filter(Boolean);
  const jar = {};
  for (const row of rows) {
    const part = String(row || '').split(';')[0];
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) jar[key] = value;
  }
  return jar;
}

function mergeCookieString(baseCookie, newCookies) {
  const jar = {};
  const base = String(baseCookie || '').split(';').map((v) => v.trim()).filter(Boolean);
  for (const row of base) {
    const idx = row.indexOf('=');
    if (idx <= 0) continue;
    jar[row.slice(0, idx)] = row.slice(idx + 1);
  }
  for (const [k, v] of Object.entries(newCookies || {})) jar[k] = v;
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

function decodeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractLoginAction(html) {
  const byId = html.match(/<form[^>]*id="kc-form-login"[^>]*action="([^"]+)"/i);
  if (byId) return decodeHtmlAttribute(byId[1]);
  const generic = html.match(/<form[^>]*action="([^"]+)"[^>]*>/i);
  if (generic) return decodeHtmlAttribute(generic[1]);
  return '';
}

async function getBearerFromSessionCookie() {
  assert(TEST_SESSION_COOKIE, 'TEST_SESSION_COOKIE is required');

  const started = await apiCall('POST', '/v1/auth/device/start', {
    client_name: `keycloak-interop-${Date.now()}`,
    client_type: 'ci',
    scope: 'tenant sso',
  });
  assert(started.statusCode === 200, `device/start failed (${started.statusCode})`);

  const deviceCode = String(started.json?.data?.device_code || '').trim();
  const userCode = String(started.json?.data?.user_code || '').trim();
  assert(deviceCode, 'device/start missing device_code');
  assert(userCode, 'device/start missing user_code');

  const confirmed = await apiCall('POST', '/v1/auth/device/confirm', { user_code: userCode }, { cookie: TEST_SESSION_COOKIE });
  assert(confirmed.statusCode === 200, `device/confirm failed (${confirmed.statusCode})`);

  const tokenRes = await apiCall('POST', '/v1/auth/device/token', { device_code: deviceCode });
  assert(tokenRes.statusCode === 200, `device/token failed (${tokenRes.statusCode})`);
  const accessToken = String(tokenRes.json?.data?.access_token || '').trim();
  assert(accessToken, 'device/token missing access_token');
  return accessToken;
}

async function getAdminBearer() {
  if (TEST_BEARER_TOKEN) {
    const probe = await apiCall('GET', '/v1/auth/me', undefined, { bearer: TEST_BEARER_TOKEN });
    if (probe.statusCode === 200) {
      return { token: TEST_BEARER_TOKEN, source: 'test_bearer_token' };
    }
    throw new Error(`TEST_BEARER_TOKEN is set but invalid for /v1/auth/me (${probe.statusCode})`);
  }
  if (TEST_SESSION_COOKIE) {
    const token = await getBearerFromSessionCookie();
    return { token, source: 'test_session_cookie_device_flow' };
  }
  if (TEST_ADMIN_USERNAME && TEST_ADMIN_PASSWORD) {
    const login = await apiCall('POST', '/v1/auth/login', {
      username: TEST_ADMIN_USERNAME,
      password: TEST_ADMIN_PASSWORD,
    });
    if (login.statusCode !== 200) {
      throw new Error(`/v1/auth/login failed for TEST_ADMIN_USERNAME (${login.statusCode})`);
    }
    const token = String(login.json?.data?.access_token || '').trim();
    if (!token) {
      const requiresTotp = Boolean(login.json?.data?.requires_totp);
      if (requiresTotp) {
        throw new Error('Admin login requires TOTP; set TEST_BEARER_TOKEN or TEST_SESSION_COOKIE for smoke run');
      }
      throw new Error('Admin login succeeded but no access_token was returned');
    }
    return { token, source: 'admin_username_password_login' };
  }
  throw new Error('Set TEST_BEARER_TOKEN, TEST_SESSION_COOKIE, or TEST_ADMIN_USERNAME + TEST_ADMIN_PASSWORD');
}

async function keycloakLoginAndGetCode(authUrl) {
  const authRes = await request(authUrl, { method: 'GET' });
  assert(authRes.statusCode === 200, `Keycloak auth page failed (${authRes.statusCode})`);
  const loginAction = extractLoginAction(authRes.raw);
  assert(loginAction, 'Keycloak login action URL not found');

  const cookies = parseCookieHeader(authRes.headers['set-cookie']);
  const cookieHeader = mergeCookieString('', cookies);
  const formBody = new URLSearchParams({
    username: KEYCLOAK_USERNAME,
    password: KEYCLOAK_PASSWORD,
    credentialId: '',
  }).toString();

  const postRes = await request(loginAction, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'content-length': String(Buffer.byteLength(formBody)),
      cookie: cookieHeader,
    },
    body: formBody,
  });

  assert([302, 303].includes(postRes.statusCode), `Keycloak login did not redirect (${postRes.statusCode})`);
  const location = String(postRes.headers.location || '').trim();
  assert(location, 'Keycloak login redirect missing location');
  const parsed = new URL(location);
  const code = String(parsed.searchParams.get('code') || '').trim();
  const state = String(parsed.searchParams.get('state') || '').trim();
  assert(code, 'Keycloak redirect missing code');
  assert(state, 'Keycloak redirect missing state');
  return { code, state, redirectUrl: location };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const strictMode = Boolean(
    args.strict
    || String(process.env.SSO_KEYCLOAK_INTEROP_STRICT || '').trim() === '1'
    || String(process.env.CI || '').trim().toLowerCase() === 'true',
  );
  const credentialsSource = {
    keycloak_client_secret: isSet('KEYCLOAK_CLIENT_SECRET') ? 'explicit_env' : 'default_fallback',
    keycloak_test_username: isSet('KEYCLOAK_TEST_USERNAME') ? 'explicit_env' : 'default_fallback',
    keycloak_test_password: isSet('KEYCLOAK_TEST_PASSWORD') ? 'explicit_env' : 'default_fallback',
  };
  if (strictMode) {
    const fallbackFields = Object.entries(credentialsSource)
      .filter(([, source]) => source !== 'explicit_env')
      .map(([field]) => field);
    assert(
      fallbackFields.length === 0,
      `strict credential policy failed: default fallback used for ${fallbackFields.join(', ')}`,
    );
    assert(
      !(TEST_BEARER_TOKEN && LEGACY_STATIC_TEST_TOKENS.has(TEST_BEARER_TOKEN)),
      'strict auth-source policy failed: legacy static TEST_BEARER_TOKEN is disallowed',
    );
  }
  console.log('[sso:keycloak] starting smoke interop');
  console.log(`[sso:keycloak] api=${API_BASE}`);
  console.log(`[sso:keycloak] keycloak=${KEYCLOAK_BASE_URL} realm=${KEYCLOAK_REALM}`);

  const adminAuth = await getAdminBearer();
  const bearer = String(adminAuth.token || '').trim();
  assert(bearer, 'failed to resolve admin bearer token');
  console.log(`[sso:keycloak] acquired admin bearer via ${adminAuth.source}`);

  const me = await apiCall('GET', '/v1/auth/me', undefined, { bearer });
  assert(me.statusCode === 200, `/v1/auth/me failed for admin token (${me.statusCode})`);
  const activeOrgId = String(me.json?.data?.active_organization_id || '').trim();

  const accountName = `SSO Keycloak ${Date.now()}`;
  let accountId = activeOrgId;
  if (!accountId) {
    const accountRes = await apiCall('POST', '/v1/admin/accounts', { name: accountName }, { bearer });
    if (accountRes.statusCode === 201) {
      accountId = String(accountRes.json?.data?.id || '').trim();
      assert(accountId, 'create account missing id');
    } else {
      throw new Error(
        `create account failed (${accountRes.statusCode}) body=${bodyPreview(accountRes)}; precondition required: bootstrap/activate admin account via control-plane API before D9 smoke run`,
      );
    }
  }
  assert(accountId, 'failed to resolve account id for smoke run');
  console.log(`[sso:keycloak] created account ${accountId}`);

  const issuer = `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}`;
  const ssoConfig = {
    enabled: true,
    fallback_local_auth: true,
    oidc: {
      enabled: true,
      issuer_url: issuer,
      client_id: KEYCLOAK_CLIENT_ID,
      client_secret: KEYCLOAK_CLIENT_SECRET,
      callback_url: OIDC_REDIRECT_URI,
      scopes: 'openid profile email',
    },
    saml: { enabled: false },
    jit: { enabled: true, default_role: 'member' },
    group_mapping: [{ external_group: 'ops', tenant_role: 'operator' }],
  };
  const cfgRes = await apiCall('PUT', '/v1/admin/settings/sso', ssoConfig, { bearer });
  assert(cfgRes.statusCode === 200, `set sso config failed (${cfgRes.statusCode})`);
  console.log('[sso:keycloak] tenant SSO config applied');

  const startRes = await apiCall('POST', '/v1/auth/sso/oidc/start', {
    account_id: accountId,
    redirect_uri: OIDC_REDIRECT_URI,
  });
  assert(startRes.statusCode === 200, `oidc/start failed (${startRes.statusCode})`);

  const authUrl = String(startRes.json?.data?.authorization_url || '').trim();
  const stateFromStart = String(startRes.json?.data?.state || '').trim();
  assert(authUrl, 'oidc/start missing authorization_url');
  assert(stateFromStart, 'oidc/start missing state');
  console.log('[sso:keycloak] oidc/start succeeded');

  const loginResult = await keycloakLoginAndGetCode(authUrl);
  console.log('[sso:keycloak] keycloak login produced authorization code');

  const redirectMatchesCallback = String(loginResult.redirectUrl || '').startsWith(`${OIDC_REDIRECT_URI}?`);
  assert(
    stateFromStart === loginResult.state,
    'OIDC state correlation failed: start state does not match login redirect state',
  );
  assert(
    redirectMatchesCallback,
    `OIDC redirect target mismatch: expected prefix ${OIDC_REDIRECT_URI}?`,
  );

  const flowReport = {
    generated_at_utc: new Date().toISOString(),
    source_run_id: String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim() || null,
    head_sha: String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim() || null,
    source_ref: String(process.env.GITHUB_REF || process.env.CI_COMMIT_REF_NAME || '').trim() || null,
    mode: args.browserFlowOnly ? 'browser_flow_only' : 'api_callback_smoke',
    strict_mode: strictMode,
    setup_auth_bootstrap: {
      source: String(adminAuth.source || 'unknown'),
      token_type: 'session_id_bearer',
      used_for_setup_only: true,
    },
    credentials_source: credentialsSource,
    account_id: accountId,
    oidc_live_proof: {
      issuer,
      run_id: String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim() || null,
      acquisition: {
        oidc_start_completed: true,
        authorization_url_present: true,
        authorization_url_host: (() => {
          try {
            return new URL(authUrl).host;
          } catch {
            return '';
          }
        })(),
        state_issued: Boolean(stateFromStart),
      },
      authorization_code: {
        method: 'interactive_browser_login',
        acquired: Boolean(loginResult.code),
        code_length: String(loginResult.code || '').length,
        redirect_url: String(loginResult.redirectUrl || ''),
      },
      exchange: {
        endpoint: '/v1/auth/sso/oidc/callback',
        callback_completed: false,
        access_token_issued: false,
        auth_me_validated: false,
      },
    },
    checks: {
      state_correlation_pass: stateFromStart === loginResult.state,
      redirect_target_matches_callback_uri: redirectMatchesCallback,
      browser_redirect_chain_verified: true,
      api_callback_completed: false,
    },
  };

  if (args.browserFlowOnly) {
    if (args.reportJsonPath) {
      writeJsonReport(args.reportJsonPath, flowReport);
      console.log(`[sso:keycloak] wrote browser-flow report: ${args.reportJsonPath}`);
    }
    console.log('[sso:keycloak] success: browser redirect/state continuity validated');
    return;
  }

  const callbackRes = await apiCall('POST', '/v1/auth/sso/oidc/callback', {
    state: loginResult.state,
    code: loginResult.code,
    redirect_uri: OIDC_REDIRECT_URI,
  });
  assert(callbackRes.statusCode === 200, `oidc/callback failed (${callbackRes.statusCode})`);
  const accessToken = String(callbackRes.json?.data?.access_token || '').trim();
  const membershipRole = String(callbackRes.json?.data?.membership_role || '').trim();
  assert(accessToken, 'oidc/callback missing access_token');
  assert(membershipRole === 'operator', `expected mapped membership_role=operator, got ${membershipRole || '(empty)'}`);
  console.log('[sso:keycloak] oidc/callback succeeded');
  flowReport.checks.api_callback_completed = true;
  flowReport.oidc_live_proof.exchange.callback_completed = true;
  flowReport.oidc_live_proof.exchange.access_token_issued = Boolean(accessToken);
  flowReport.oidc_live_proof.exchange.membership_role = membershipRole || null;

  const meRes = await apiCall('GET', '/v1/auth/me', undefined, { bearer: accessToken });
  assert(meRes.statusCode === 200, `/v1/auth/me failed for sso token (${meRes.statusCode})`);
  flowReport.oidc_live_proof.exchange.auth_me_validated = true;
  flowReport.oidc_live_proof.exchange.auth_me_status = meRes.statusCode;

  if (args.reportJsonPath) {
    writeJsonReport(args.reportJsonPath, flowReport);
    console.log(`[sso:keycloak] wrote smoke report: ${args.reportJsonPath}`);
  }

  console.log('[sso:keycloak] success: live keycloak OIDC interop validated end-to-end');
}

main().catch((err) => {
  console.error(`[sso:keycloak] failed: ${String(err && err.message ? err.message : err)}`);
  process.exit(1);
});
