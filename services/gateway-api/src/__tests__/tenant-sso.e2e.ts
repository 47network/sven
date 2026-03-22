import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://127.0.0.1:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';

type ApiResult = {
  statusCode: number;
  data: unknown;
  raw: string;
  headers: http.IncomingHttpHeaders;
};

type MockOidcTokenErrorReply = {
  __status: number;
  __body: string;
  __contentType?: string;
};

async function apiCall(
  method: string,
  endpoint: string,
  body?: unknown,
  opts?: { bearer?: string; cookie?: string },
): Promise<ApiResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(`${API_BASE}${endpoint}`);
    const payload = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {};
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = String(Buffer.byteLength(payload));
    }
    if (opts?.bearer) headers.authorization = `Bearer ${opts.bearer}`;
    if (opts?.cookie) headers.cookie = opts.cookie;

    const req = http.request(
      {
        method,
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += String(chunk);
        });
        res.on('end', () => {
          const contentType = String(res.headers['content-type'] || '');
          let parsedBody: unknown = null;
          if (contentType.includes('application/json')) {
            try {
              parsedBody = raw ? JSON.parse(raw) : {};
            } catch {
              parsedBody = null;
            }
          }
          resolve({
            statusCode: res.statusCode || 0,
            data: parsedBody,
            raw,
            headers: res.headers,
          });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getBearerFromSessionCookie(cookie: string): Promise<string> {
  const started = await apiCall('POST', '/v1/auth/device/start', {
    client_name: `D2 tenant sso ${Date.now()}`,
    client_type: 'ci',
    scope: 'tenant sso',
  });
  expect(started.statusCode).toBe(200);
  const deviceCode = String((started.data as { data?: { device_code?: unknown } })?.data?.device_code || '');
  const userCode = String((started.data as { data?: { user_code?: unknown } })?.data?.user_code || '');
  expect(deviceCode).toBeTruthy();
  expect(userCode).toBeTruthy();

  const confirmed = await apiCall('POST', '/v1/auth/device/confirm', { user_code: userCode }, { cookie });
  expect(confirmed.statusCode).toBe(200);

  const tokenResp = await apiCall('POST', '/v1/auth/device/token', { device_code: deviceCode });
  expect(tokenResp.statusCode).toBe(200);
  const token = String((tokenResp.data as { data?: { access_token?: unknown } })?.data?.access_token || '');
  expect(token).toBeTruthy();
  return token;
}

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function buildUnsignedJwt(payload: Record<string, unknown>): string {
  const header = toBase64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = toBase64Url(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

function isMockOidcTokenErrorReply(payload: unknown): payload is MockOidcTokenErrorReply {
  if (!payload || typeof payload !== 'object') return false;
  const row = payload as Record<string, unknown>;
  return Number.isFinite(Number(row.__status)) && typeof row.__body === 'string';
}

async function withMockOidcServer(
  tokenByCode: Record<string, Record<string, unknown> | MockOidcTokenErrorReply>,
  userInfoByAccessToken: Record<string, Record<string, unknown>>,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer((req, res) => {
    const parsed = new URL(req.url || '/', 'http://127.0.0.1');
    if (req.method === 'POST' && parsed.pathname === '/token') {
      let raw = '';
      req.on('data', (chunk) => {
        raw += String(chunk);
      });
      req.on('end', () => {
        const params = new URLSearchParams(raw);
        const code = String(params.get('code') || '');
        const payload = tokenByCode[code];
        if (!payload) {
          res.statusCode = 400;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: 'invalid_grant' }));
          return;
        }
        if (isMockOidcTokenErrorReply(payload)) {
          res.statusCode = Number(payload.__status);
          res.setHeader('content-type', String(payload.__contentType || 'text/plain'));
          res.end(String(payload.__body || ''));
          return;
        }
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(payload));
      });
      return;
    }
    if (req.method === 'GET' && parsed.pathname === '/userinfo') {
      const authHeader = String(req.headers.authorization || '');
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
      const payload = userInfoByAccessToken[token];
      if (!payload) {
        res.statusCode = 401;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: 'invalid_token' }));
        return;
      }
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(payload));
      return;
    }
    res.statusCode = 404;
    res.end('not found');
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('mock OIDC server failed to bind');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('D2 tenant SSO phase1', () => {
  it('supports tenant-scoped SSO config and mock JIT login', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const account = await apiCall('POST', '/v1/admin/accounts', { name: `SSO ${unique}` }, { bearer });
    expect(account.statusCode).toBe(201);
    const accountId = String((account.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(accountId).toBeTruthy();

    const ssoConfig = {
      enabled: true,
      fallback_local_auth: true,
      oidc: {
        enabled: true,
        issuer_url: 'https://issuer.example.com',
        client_id: 'client-id',
        client_secret: 'secret-value',
      },
      saml: {
        enabled: false,
      },
      jit: { enabled: true, default_role: 'member' },
      group_mapping: [{ external_group: 'ops', tenant_role: 'operator' }],
    };
    const setConfig = await apiCall('PUT', '/v1/admin/settings/sso', ssoConfig, { bearer });
    expect(setConfig.statusCode).toBe(200);

    const getConfig = await apiCall('GET', '/v1/admin/settings/sso', undefined, { bearer });
    expect(getConfig.statusCode).toBe(200);
    const cfg = (getConfig.data as { data?: Record<string, unknown> })?.data || {};
    expect(Boolean(cfg.enabled)).toBe(true);
    const oidc = (cfg.oidc || {}) as Record<string, unknown>;
    expect(String(oidc.client_secret || '')).toBe('***');

    const mockLogin = await apiCall('POST', '/v1/auth/sso/mock/login', {
      account_id: accountId,
      provider: 'oidc',
      subject: `sub-${unique}`,
      email: `user-${unique}@example.com`,
      groups: ['ops'],
    });

    if (mockLogin.statusCode === 503) {
      const code = String((mockLogin.data as { error?: { code?: unknown } })?.error?.code || '');
      expect(code).toBe('SSO_MOCK_DISABLED');
      return;
    }

    expect(mockLogin.statusCode).toBe(200);
    const mockData = (mockLogin.data as { data?: Record<string, unknown> })?.data || {};
    expect(String(mockData.active_organization_id || '')).toBe(accountId);
    expect(String(mockData.membership_role || '')).toBe('operator');
    const ssoBearer = String(mockData.access_token || '');
    const ssoRefreshToken = String(mockData.refresh_token || '');
    expect(ssoBearer).toBeTruthy();
    expect(ssoRefreshToken).toBeTruthy();

    const me = await apiCall('GET', '/v1/me', undefined, { bearer: ssoBearer });
    expect(me.statusCode).toBe(200);
    const meData = (me.data as { data?: Record<string, unknown> })?.data || {};
    expect(String(meData.active_organization_id || '')).toBe(accountId);

    const refreshed = await apiCall('POST', '/v1/auth/refresh', { refresh_token: ssoRefreshToken });
    expect(refreshed.statusCode).toBe(200);
    const refreshedData = (refreshed.data as { data?: Record<string, unknown> })?.data || {};
    const rotatedAccessToken = String(refreshedData.access_token || '');
    const rotatedRefreshToken = String(refreshedData.refresh_token || '');
    expect(rotatedAccessToken).toBeTruthy();
    expect(rotatedAccessToken).not.toBe(ssoBearer);
    expect(rotatedRefreshToken).toBeTruthy();

    const oldMe = await apiCall('GET', '/v1/auth/me', undefined, { bearer: ssoBearer });
    expect(oldMe.statusCode).toBe(401);

    const meAfterRefresh = await apiCall('GET', '/v1/auth/me', undefined, { bearer: rotatedAccessToken });
    expect(meAfterRefresh.statusCode).toBe(200);

    const logoutRotated = await apiCall('POST', '/v1/auth/logout', undefined, { bearer: rotatedAccessToken });
    expect(logoutRotated.statusCode).toBe(200);
    const meAfterLogout = await apiCall('GET', '/v1/auth/me', undefined, { bearer: rotatedAccessToken });
    expect(meAfterLogout.statusCode).toBe(401);

    const refreshedAgain = await apiCall('POST', '/v1/auth/refresh', { refresh_token: rotatedRefreshToken });
    expect(refreshedAgain.statusCode).toBe(200);
    const refreshedAgainData = (refreshedAgain.data as { data?: Record<string, unknown> })?.data || {};
    const accessForLogoutAll = String(refreshedAgainData.access_token || '');
    expect(accessForLogoutAll).toBeTruthy();

    const logoutAll = await apiCall('POST', '/v1/auth/logout-all', undefined, { bearer: accessForLogoutAll });
    expect(logoutAll.statusCode).toBe(200);
    const meAfterLogoutAll = await apiCall('GET', '/v1/auth/me', undefined, { bearer: accessForLogoutAll });
    expect(meAfterLogoutAll.statusCode).toBe(401);

    const samlConfig = {
      enabled: true,
      fallback_local_auth: true,
      oidc: {
        enabled: false,
      },
      saml: {
        enabled: true,
        entrypoint_url: 'https://idp.example.com/saml/login',
        entity_id: 'urn:sven:test-sp',
        cert_pem: '-----BEGIN CERTIFICATE-----TEST-----END CERTIFICATE-----',
        callback_url: 'https://sven.example.com/v1/auth/sso/saml/callback',
      },
      jit: { enabled: true, default_role: 'member' },
      group_mapping: [{ external_group: 'ops', tenant_role: 'operator' }],
    };
    const setSamlConfig = await apiCall('PUT', '/v1/admin/settings/sso', samlConfig, { bearer });
    expect(setSamlConfig.statusCode).toBe(200);

    const samlStart = await apiCall('POST', '/v1/auth/sso/saml/start', { account_id: accountId });
    expect(samlStart.statusCode).toBe(200);
    const samlStartData = (samlStart.data as { data?: Record<string, unknown> })?.data || {};
    expect(String(samlStartData.redirect_url || '')).toContain('SAMLRequest=');

    const samlXml = [
      '<?xml version="1.0"?>',
      '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">',
      '<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">',
      '<saml:Subject><saml:NameID>tenant-saml-user</saml:NameID></saml:Subject>',
      '<saml:AttributeStatement>',
      '<saml:Attribute Name="email"><saml:AttributeValue>saml-user@example.com</saml:AttributeValue></saml:Attribute>',
      '<saml:Attribute Name="groups"><saml:AttributeValue>ops</saml:AttributeValue></saml:Attribute>',
      '</saml:AttributeStatement>',
      '</saml:Assertion>',
      '</samlp:Response>',
    ].join('');
    const samlResponse = Buffer.from(samlXml, 'utf8').toString('base64');
    const samlCallback = await apiCall('POST', '/v1/auth/sso/saml/callback', {
      account_id: accountId,
      saml_response: samlResponse,
    });
    expect(samlCallback.statusCode).toBe(200);
    const samlData = (samlCallback.data as { data?: Record<string, unknown> })?.data || {};
    expect(String(samlData.membership_role || '')).toBe('operator');
    expect(String(samlData.active_organization_id || '')).toBe(accountId);
  });

  it('rejects OIDC callback invalid/mismatched claims', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const account = await apiCall('POST', '/v1/admin/accounts', { name: `OIDC Neg ${unique}` }, { bearer });
    expect(account.statusCode).toBe(201);
    const accountId = String((account.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(accountId).toBeTruthy();

    const nowSec = Math.floor(Date.now() / 1000);
    const tokenByCode: Record<string, Record<string, unknown>> = {
      nonce_mismatch: {
        id_token: buildUnsignedJwt({
          sub: `oidc-user-${unique}`,
          iss: 'https://issuer.expected',
          aud: 'client-test',
          nonce: 'wrong-nonce',
          exp: nowSec + 300,
          iat: nowSec,
        }),
      },
      nonce_missing: {
        id_token: buildUnsignedJwt({
          sub: `oidc-user-${unique}`,
          iss: 'https://issuer.expected',
          aud: 'client-test',
          exp: nowSec + 300,
          iat: nowSec,
        }),
      },
      issuer_mismatch: {
        id_token: buildUnsignedJwt({
          sub: `oidc-user-${unique}`,
          iss: 'https://issuer.wrong',
          aud: 'client-test',
          nonce: 'to-be-replaced',
          exp: nowSec + 300,
          iat: nowSec,
        }),
      },
      audience_mismatch: {
        id_token: buildUnsignedJwt({
          sub: `oidc-user-${unique}`,
          iss: 'https://issuer.expected',
          aud: 'different-client',
          nonce: 'to-be-replaced',
          exp: nowSec + 300,
          iat: nowSec,
        }),
      },
    };

    await withMockOidcServer(tokenByCode, {}, async (mockBaseUrl) => {
      const ssoConfig = {
        enabled: true,
        fallback_local_auth: true,
        oidc: {
          enabled: true,
          issuer_url: 'https://issuer.expected',
          client_id: 'client-test',
          client_secret: 'secret-value',
          authorization_endpoint: `${mockBaseUrl}/authorize`,
          token_endpoint: `${mockBaseUrl}/token`,
          callback_url: 'https://sven.example.com/v1/auth/sso/oidc/callback',
          scopes: 'openid profile email',
        },
        saml: { enabled: false },
        jit: { enabled: true, default_role: 'member' },
        group_mapping: [],
      };
      const setConfig = await apiCall('PUT', '/v1/admin/settings/sso', ssoConfig, { bearer });
      expect(setConfig.statusCode).toBe(200);

      const invalidState = await apiCall('POST', '/v1/auth/sso/oidc/callback', {
        state: 'invalid-state',
        code: 'nonce_mismatch',
      });
      expect(invalidState.statusCode).toBe(401);
      expect(String(((invalidState.data as any)?.error?.code || ''))).toBe('INVALID_STATE');

      const start1 = await apiCall('POST', '/v1/auth/sso/oidc/start', { account_id: accountId });
      expect(start1.statusCode).toBe(200);
      const start1Data = (start1.data as { data?: Record<string, unknown> })?.data || {};
      const state1 = String(start1Data.state || '');
      expect(state1).toBeTruthy();
      const nonceMismatch = await apiCall('POST', '/v1/auth/sso/oidc/callback', {
        state: state1,
        code: 'nonce_mismatch',
      });
      expect(nonceMismatch.statusCode).toBe(401);
      expect(String(((nonceMismatch.data as any)?.error?.code || ''))).toBe('OIDC_NONCE_MISMATCH');

      const start2 = await apiCall('POST', '/v1/auth/sso/oidc/start', { account_id: accountId });
      expect(start2.statusCode).toBe(200);
      const start2Data = (start2.data as { data?: Record<string, unknown> })?.data || {};
      const state2 = String(start2Data.state || '');
      expect(state2).toBeTruthy();
      const nonceMissing = await apiCall('POST', '/v1/auth/sso/oidc/callback', {
        state: state2,
        code: 'nonce_missing',
      });
      expect(nonceMissing.statusCode).toBe(401);
      expect(String(((nonceMissing.data as any)?.error?.code || ''))).toBe('OIDC_NONCE_MISSING');

      const start3 = await apiCall('POST', '/v1/auth/sso/oidc/start', { account_id: accountId });
      expect(start3.statusCode).toBe(200);
      const start3Data = (start3.data as { data?: Record<string, unknown> })?.data || {};
      const state3 = String(start3Data.state || '');
      const authUrl3 = String(start3Data.authorization_url || '');
      const nonce3 = new URL(authUrl3).searchParams.get('nonce') || '';
      tokenByCode.issuer_mismatch = {
        id_token: buildUnsignedJwt({
          sub: `oidc-user-${unique}`,
          iss: 'https://issuer.wrong',
          aud: 'client-test',
          nonce: nonce3,
          exp: nowSec + 300,
          iat: nowSec,
        }),
      };
      const issuerMismatch = await apiCall('POST', '/v1/auth/sso/oidc/callback', {
        state: state3,
        code: 'issuer_mismatch',
      });
      expect(issuerMismatch.statusCode).toBe(401);
      expect(String(((issuerMismatch.data as any)?.error?.code || ''))).toBe('OIDC_ISSUER_MISMATCH');

      const start4 = await apiCall('POST', '/v1/auth/sso/oidc/start', { account_id: accountId });
      expect(start4.statusCode).toBe(200);
      const start4Data = (start4.data as { data?: Record<string, unknown> })?.data || {};
      const state4 = String(start4Data.state || '');
      const authUrl4 = String(start4Data.authorization_url || '');
      const nonce4 = new URL(authUrl4).searchParams.get('nonce') || '';
      tokenByCode.audience_mismatch = {
        id_token: buildUnsignedJwt({
          sub: `oidc-user-${unique}`,
          iss: 'https://issuer.expected',
          aud: 'different-client',
          nonce: nonce4,
          exp: nowSec + 300,
          iat: nowSec,
        }),
      };
      const audienceMismatch = await apiCall('POST', '/v1/auth/sso/oidc/callback', {
        state: state4,
        code: 'audience_mismatch',
      });
      expect(audienceMismatch.statusCode).toBe(401);
      expect(String(((audienceMismatch.data as any)?.error?.code || ''))).toBe('OIDC_AUDIENCE_MISMATCH');
    });
  });

  it('rejects OIDC callback expired/future/sub-mismatch id_token claims', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const account = await apiCall('POST', '/v1/admin/accounts', { name: `OIDC Claims ${unique}` }, { bearer });
    expect(account.statusCode).toBe(201);
    const accountId = String((account.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(accountId).toBeTruthy();

    const nowSec = Math.floor(Date.now() / 1000);
    const tokenByCode: Record<string, Record<string, unknown>> = {
      expired_token: {
        id_token: buildUnsignedJwt({
          sub: `oidc-user-${unique}`,
          iss: 'https://issuer.expected',
          aud: 'client-test',
          nonce: 'to-be-replaced',
          exp: nowSec - 600,
          iat: nowSec - 700,
        }),
      },
      future_iat: {
        id_token: buildUnsignedJwt({
          sub: `oidc-user-${unique}`,
          iss: 'https://issuer.expected',
          aud: 'client-test',
          nonce: 'to-be-replaced',
          exp: nowSec + 600,
          iat: nowSec + 1200,
        }),
      },
      subject_mismatch: {
        access_token: `atk-${unique}`,
        id_token: buildUnsignedJwt({
          sub: `id-token-subject-${unique}`,
          iss: 'https://issuer.expected',
          aud: 'client-test',
          nonce: 'to-be-replaced',
          exp: nowSec + 600,
          iat: nowSec,
        }),
      },
    };

    const userInfoByAccessToken: Record<string, Record<string, unknown>> = {
      [`atk-${unique}`]: {
        sub: `userinfo-subject-${unique}`,
        email: `oidc-${unique}@example.com`,
      },
    };

    await withMockOidcServer(tokenByCode, userInfoByAccessToken, async (mockBaseUrl) => {
      const ssoConfig = {
        enabled: true,
        fallback_local_auth: true,
        oidc: {
          enabled: true,
          issuer_url: 'https://issuer.expected',
          client_id: 'client-test',
          client_secret: 'secret-value',
          authorization_endpoint: `${mockBaseUrl}/authorize`,
          token_endpoint: `${mockBaseUrl}/token`,
          userinfo_endpoint: `${mockBaseUrl}/userinfo`,
          callback_url: 'https://sven.example.com/v1/auth/sso/oidc/callback',
          scopes: 'openid profile email',
        },
        saml: { enabled: false },
        jit: { enabled: true, default_role: 'member' },
        group_mapping: [],
      };
      const setConfig = await apiCall('PUT', '/v1/admin/settings/sso', ssoConfig, { bearer });
      expect(setConfig.statusCode).toBe(200);

      const startExpired = await apiCall('POST', '/v1/auth/sso/oidc/start', { account_id: accountId });
      expect(startExpired.statusCode).toBe(200);
      const startExpiredData = (startExpired.data as { data?: Record<string, unknown> })?.data || {};
      const stateExpired = String(startExpiredData.state || '');
      const nonceExpired = new URL(String(startExpiredData.authorization_url || '')).searchParams.get('nonce') || '';
      tokenByCode.expired_token = {
        id_token: buildUnsignedJwt({
          sub: `oidc-user-${unique}`,
          iss: 'https://issuer.expected',
          aud: 'client-test',
          nonce: nonceExpired,
          exp: nowSec - 600,
          iat: nowSec - 700,
        }),
      };
      const expiredRes = await apiCall('POST', '/v1/auth/sso/oidc/callback', { state: stateExpired, code: 'expired_token' });
      expect(expiredRes.statusCode).toBe(401);
      expect(String(((expiredRes.data as any)?.error?.code || ''))).toBe('OIDC_TOKEN_EXPIRED');

      const startFuture = await apiCall('POST', '/v1/auth/sso/oidc/start', { account_id: accountId });
      expect(startFuture.statusCode).toBe(200);
      const startFutureData = (startFuture.data as { data?: Record<string, unknown> })?.data || {};
      const stateFuture = String(startFutureData.state || '');
      const nonceFuture = new URL(String(startFutureData.authorization_url || '')).searchParams.get('nonce') || '';
      tokenByCode.future_iat = {
        id_token: buildUnsignedJwt({
          sub: `oidc-user-${unique}`,
          iss: 'https://issuer.expected',
          aud: 'client-test',
          nonce: nonceFuture,
          exp: nowSec + 600,
          iat: nowSec + 1200,
        }),
      };
      const futureRes = await apiCall('POST', '/v1/auth/sso/oidc/callback', { state: stateFuture, code: 'future_iat' });
      expect(futureRes.statusCode).toBe(401);
      expect(String(((futureRes.data as any)?.error?.code || ''))).toBe('OIDC_TOKEN_IAT_INVALID');

      const startSubject = await apiCall('POST', '/v1/auth/sso/oidc/start', { account_id: accountId });
      expect(startSubject.statusCode).toBe(200);
      const startSubjectData = (startSubject.data as { data?: Record<string, unknown> })?.data || {};
      const stateSubject = String(startSubjectData.state || '');
      const nonceSubject = new URL(String(startSubjectData.authorization_url || '')).searchParams.get('nonce') || '';
      tokenByCode.subject_mismatch = {
        access_token: `atk-${unique}`,
        id_token: buildUnsignedJwt({
          sub: `id-token-subject-${unique}`,
          iss: 'https://issuer.expected',
          aud: 'client-test',
          nonce: nonceSubject,
          exp: nowSec + 600,
          iat: nowSec,
        }),
      };
      const subjectRes = await apiCall('POST', '/v1/auth/sso/oidc/callback', { state: stateSubject, code: 'subject_mismatch' });
      expect(subjectRes.statusCode).toBe(401);
      expect(String(((subjectRes.data as any)?.error?.code || ''))).toBe('OIDC_SUBJECT_MISMATCH');
    });
  });

  it('rejects OIDC callback state replay and token exchange failures', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const account = await apiCall('POST', '/v1/admin/accounts', { name: `OIDC Replay ${unique}` }, { bearer });
    expect(account.statusCode).toBe(201);
    const accountId = String((account.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(accountId).toBeTruthy();

    const nowSec = Math.floor(Date.now() / 1000);
    const tokenByCode: Record<string, Record<string, unknown> | MockOidcTokenErrorReply> = {
      good_once: {
        id_token: buildUnsignedJwt({
          sub: `oidc-replay-user-${unique}`,
          iss: 'https://issuer.expected',
          aud: 'client-test',
          nonce: 'to-be-replaced',
          exp: nowSec + 600,
          iat: nowSec,
        }),
      },
      bad_exchange: {
        __status: 400,
        __contentType: 'application/json',
        __body: JSON.stringify({ error: 'invalid_grant', error_description: 'authorization code already consumed' }),
      },
    };

    await withMockOidcServer(tokenByCode, {}, async (mockBaseUrl) => {
      const ssoConfig = {
        enabled: true,
        fallback_local_auth: true,
        oidc: {
          enabled: true,
          issuer_url: 'https://issuer.expected',
          client_id: 'client-test',
          client_secret: 'secret-value',
          authorization_endpoint: `${mockBaseUrl}/authorize`,
          token_endpoint: `${mockBaseUrl}/token`,
          callback_url: 'https://sven.example.com/v1/auth/sso/oidc/callback',
          scopes: 'openid profile email',
        },
        saml: { enabled: false },
        jit: { enabled: true, default_role: 'member' },
        group_mapping: [],
      };
      const setConfig = await apiCall('PUT', '/v1/admin/settings/sso', ssoConfig, { bearer });
      expect(setConfig.statusCode).toBe(200);

      const startOk = await apiCall('POST', '/v1/auth/sso/oidc/start', { account_id: accountId });
      expect(startOk.statusCode).toBe(200);
      const startOkData = (startOk.data as { data?: Record<string, unknown> })?.data || {};
      const stateOk = String(startOkData.state || '');
      const nonceOk = new URL(String(startOkData.authorization_url || '')).searchParams.get('nonce') || '';
      tokenByCode.good_once = {
        id_token: buildUnsignedJwt({
          sub: `oidc-replay-user-${unique}`,
          iss: 'https://issuer.expected',
          aud: 'client-test',
          nonce: nonceOk,
          exp: nowSec + 600,
          iat: nowSec,
        }),
      };

      const firstCallback = await apiCall('POST', '/v1/auth/sso/oidc/callback', { state: stateOk, code: 'good_once' });
      expect(firstCallback.statusCode).toBe(200);

      const replayCallback = await apiCall('POST', '/v1/auth/sso/oidc/callback', { state: stateOk, code: 'good_once' });
      expect(replayCallback.statusCode).toBe(401);
      expect(String(((replayCallback.data as any)?.error?.code || ''))).toBe('INVALID_STATE');

      const startBad = await apiCall('POST', '/v1/auth/sso/oidc/start', { account_id: accountId });
      expect(startBad.statusCode).toBe(200);
      const startBadData = (startBad.data as { data?: Record<string, unknown> })?.data || {};
      const stateBad = String(startBadData.state || '');
      const badExchange = await apiCall('POST', '/v1/auth/sso/oidc/callback', { state: stateBad, code: 'bad_exchange' });
      expect(badExchange.statusCode).toBe(502);
      expect(String(((badExchange.data as any)?.error?.code || ''))).toBe('OIDC_TOKEN_EXCHANGE_FAILED');
      expect(String(((badExchange.data as any)?.error?.message || ''))).toContain('invalid_grant');
    });
  });
});
