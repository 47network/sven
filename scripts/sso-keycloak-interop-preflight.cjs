#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');

const API_BASE = (process.env.API_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');
const KEYCLOAK_BASE_URL = (process.env.KEYCLOAK_BASE_URL || 'http://127.0.0.1:8081').replace(/\/+$/, '');
const KEYCLOAK_REALM = String(process.env.KEYCLOAK_REALM || 'sven').trim();
const LEGACY_STATIC_TEST_TOKENS = new Set([
  '11111111-1111-4111-8111-111111111111',
]);

function parseArgs(argv) {
  return {
    strict: argv.includes('--strict'),
    withIdp: argv.includes('--with-idp'),
    timeoutMs: Math.max(1000, Number(process.env.SSO_PREFLIGHT_TIMEOUT_MS || 6000)),
  };
}

function request(url, timeoutMs, options = {}) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.request(
      {
        method: options.method || 'GET',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: {
          accept: 'application/json,text/plain,*/*',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => {
          raw += String(c);
        });
        res.on('end', () => {
          resolve({ ok: true, statusCode: res.statusCode || 0, raw });
        });
      },
    );
    req.setTimeout(timeoutMs, () => {
      try {
        req.destroy(new Error('timeout'));
      } catch {}
    });
    req.on('error', (err) => {
      resolve({ ok: false, statusCode: 0, raw: '', error: String(err && err.message ? err.message : err) });
    });
    if (options.body) {
      req.write(String(options.body));
    }
    req.end();
  });
}

function checkAuthSource() {
  const hasBearer = Boolean(String(process.env.TEST_BEARER_TOKEN || '').trim());
  const hasCookie = Boolean(String(process.env.TEST_SESSION_COOKIE || '').trim());
  const hasCreds =
    Boolean(String(process.env.TEST_ADMIN_USERNAME || '').trim()) &&
    Boolean(String(process.env.TEST_ADMIN_PASSWORD || '').trim());
  return {
    pass: hasBearer || hasCookie || hasCreds,
    detail: hasBearer
      ? 'TEST_BEARER_TOKEN set'
      : hasCookie
        ? 'TEST_SESSION_COOKIE set'
        : hasCreds
          ? 'TEST_ADMIN_USERNAME + TEST_ADMIN_PASSWORD set'
          : 'no auth source set',
  };
}

async function validateAuthSource(apiBase, timeoutMs) {
  const bearer = String(process.env.TEST_BEARER_TOKEN || '').trim();
  if (bearer) {
    const probe = await request(`${apiBase}/v1/auth/me`, timeoutMs, {
      method: 'GET',
      headers: { authorization: `Bearer ${bearer}` },
    });
    return {
      pass: probe.ok && probe.statusCode === 200,
      detail: probe.ok ? `bearer /v1/auth/me status=${probe.statusCode}` : `bearer probe error=${probe.error || 'unknown'}`,
    };
  }

  const cookie = String(process.env.TEST_SESSION_COOKIE || '').trim();
  if (cookie) {
    const probe = await request(`${apiBase}/v1/auth/me`, timeoutMs, {
      method: 'GET',
      headers: { cookie },
    });
    return {
      pass: probe.ok && probe.statusCode === 200,
      detail: probe.ok ? `cookie /v1/auth/me status=${probe.statusCode}` : `cookie probe error=${probe.error || 'unknown'}`,
    };
  }

  const username = String(process.env.TEST_ADMIN_USERNAME || '').trim();
  const password = String(process.env.TEST_ADMIN_PASSWORD || '').trim();
  if (username && password) {
    const body = JSON.stringify({ username, password });
    const login = await request(`${apiBase}/v1/auth/login`, timeoutMs, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(body)),
      },
      body,
    });
    if (!login.ok) {
      return { pass: false, detail: `login probe error=${login.error || 'unknown'}` };
    }
    if (login.statusCode !== 200) {
      return { pass: false, detail: `login probe status=${login.statusCode}` };
    }
    const raw = String(login.raw || '');
    if (raw.includes('"requires_totp":true')) {
      return { pass: false, detail: 'login probe requires TOTP; use TEST_BEARER_TOKEN or TEST_SESSION_COOKIE' };
    }
    return { pass: true, detail: 'login probe status=200' };
  }

  return { pass: false, detail: 'no auth source available to validate' };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const checks = [];

  const nodeMajor = Number(process.versions.node.split('.')[0] || 0);
  checks.push({
    id: 'node_version_gte_20',
    pass: nodeMajor >= 20,
    detail: `node=${process.versions.node}`,
  });

  const health = await request(`${API_BASE}/healthz`, args.timeoutMs);
  checks.push({
    id: 'gateway_health_reachable',
    pass: health.ok && health.statusCode >= 200 && health.statusCode < 300,
    detail: health.ok ? `status=${health.statusCode}` : `error=${health.error || 'unknown'}`,
  });

  const auth = checkAuthSource();
  checks.push({
    id: 'admin_auth_source_present',
    pass: auth.pass,
    detail: auth.detail,
  });
  const bearer = String(process.env.TEST_BEARER_TOKEN || '').trim();
  checks.push({
    id: 'admin_auth_bearer_not_legacy_static',
    pass: !bearer || !LEGACY_STATIC_TEST_TOKENS.has(bearer),
    detail: !bearer
      ? 'not using bearer token'
      : LEGACY_STATIC_TEST_TOKENS.has(bearer)
        ? 'legacy static test bearer token is disallowed'
        : 'bearer token is non-legacy',
  });
  if (auth.pass) {
    const authValidation = await validateAuthSource(API_BASE, args.timeoutMs);
    checks.push({
      id: 'admin_auth_source_valid',
      pass: authValidation.pass,
      detail: authValidation.detail,
    });
  }

  if (args.withIdp) {
    const wellKnown = await request(
      `${KEYCLOAK_BASE_URL}/realms/${encodeURIComponent(KEYCLOAK_REALM)}/.well-known/openid-configuration`,
      args.timeoutMs,
    );
    checks.push({
      id: 'keycloak_well_known_reachable',
      pass: wellKnown.ok && wellKnown.statusCode >= 200 && wellKnown.statusCode < 300,
      detail: wellKnown.ok ? `status=${wellKnown.statusCode}` : `error=${wellKnown.error || 'unknown'}`,
    });
  }

  const failed = checks.filter((c) => !c.pass);
  const status = failed.length === 0 ? 'pass' : 'fail';

  const report = {
    type: 'd9_keycloak_oidc_interop_preflight',
    generated_at_utc: new Date().toISOString(),
    strict: args.strict,
    with_idp: args.withIdp,
    status,
    api_base: API_BASE,
    keycloak_base_url: KEYCLOAK_BASE_URL,
    keycloak_realm: KEYCLOAK_REALM,
    checks,
  };

  const outJson = path.join(outDir, 'd9-keycloak-interop-preflight-latest.json');
  const outMd = path.join(outDir, 'd9-keycloak-interop-preflight-latest.md');
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2));

  const md = [
    '# D9 Keycloak Interop Preflight',
    '',
    `- Generated: ${report.generated_at_utc}`,
    `- Status: ${status.toUpperCase()}`,
    `- With IdP: ${args.withIdp ? 'yes' : 'no'}`,
    `- Strict: ${args.strict ? 'yes' : 'no'}`,
    '',
    '## Checks',
    '',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, md.join('\n'));

  console.log(`wrote: ${path.relative(root, outJson)}`);
  console.log(`wrote: ${path.relative(root, outMd)}`);
  console.log(`status: ${status}`);

  if (status !== 'pass' && args.strict) process.exit(1);
}

main().catch((err) => {
  console.error(String(err && err.message ? err.message : err));
  process.exit(1);
});
