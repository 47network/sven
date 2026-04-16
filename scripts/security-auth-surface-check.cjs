#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const routesRoot = path.join(root, 'services', 'gateway-api', 'src', 'routes');
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const DEBUG_PUBLIC_ROUTE_EXCEPTIONS_ENV = 'SVEN_SECURITY_AUTH_SURFACE_DEBUG_PUBLIC_EXCEPTIONS';

const ROUTE_DECL_RE = /app\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;

const DEFAULT_PUBLIC_ALLOWLIST = [
  '/v1/auth/bootstrap',
  '/v1/auth/login',
  '/v1/auth/totp/verify',
  '/v1/auth/refresh',
  '/v1/auth/sso',
  '/v1/auth/sso/mock/login',
  '/v1/auth/sso/oidc/start',
  '/v1/auth/sso/oidc/callback',
  '/v1/auth/sso/saml/start',
  '/v1/auth/sso/saml/callback',
  '/v1/auth/device/start',
  '/v1/auth/device/token',
  '/v1/auth/token-exchange',
  '/v1/auth/google/callback',
  '/v1/config/deployment',
  '/v1/config/deployment/setup',
  '/v1/shared/:token',
  '/v1/contracts/version',
  '/v1/devices/pair/start',
  '/v1/federation/handshake',
  '/v1/federation/health',
  '/v1/federation/verify',
  '/v1/public/community/status',
  '/v1/public/community/feed',
  '/v1/public/community/leaderboard',
  '/v1/public/community/capability-proof',
  '/v1/public/community/access-request',
  '/v1/public/community/access-request/:requestId',
  '/v1/webhooks/:path',
];

function parseExplicitDebugPublicRouteExceptions(raw) {
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && entry.startsWith('/v1/debug/'));
}

function buildPublicAllowlist() {
  const allowlist = new Set(DEFAULT_PUBLIC_ALLOWLIST);
  const debugExceptions = parseExplicitDebugPublicRouteExceptions(process.env[DEBUG_PUBLIC_ROUTE_EXCEPTIONS_ENV]);
  for (const routePath of debugExceptions) {
    allowlist.add(routePath);
  }
  return {
    allowlist,
    debugExceptions,
  };
}

const INLINE_AUTH_MARKERS = [
  /authenticateOpenAI\s*\(/,
  /authenticateDevice\s*\(/,
  /loadRelaySessionForExtension\s*\(/,
  /x-sven-relay-token/i,
  /SVEN_MCP_SERVER_TOKEN/,
  /x-sven-mcp-token/i,
  /x-gmail-token/i,
  /verification_token/i,
  /SELECT\s+s\.user_id\s+FROM\s+sessions/i,
  /SESSION_COOKIE/,
  /\bsven_session\b/i,
  /resolveActiveSessionPrincipal\s*\(/,
  /authenticateA2A\s*\(/,
  /authenticateMcp\s*\(/,
  /requireBearerSessionUser\s*\(/,
];

function listTsFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTsFiles(full));
      continue;
    }
    if (entry.isFile() && full.endsWith('.ts')) out.push(full);
  }
  return out;
}

function normalizeRoutePath(filePath, routePath) {
  const relFile = path.relative(root, filePath).replace(/\\/g, '/');
  const literal = String(routePath || '').trim();
  if (!literal) return null;
  if (literal.startsWith('/v1/')) return literal;
  // Admin sub-routes are commonly declared as relative paths and mounted with /v1/admin prefix.
  if (/\/services\/gateway-api\/src\/routes\/admin\//.test(`/${relFile}`)) {
    if (literal.startsWith('/')) return `/v1/admin${literal}`;
    return `/v1/admin/${literal}`;
  }
  return literal.startsWith('/') ? literal : `/${literal}`;
}

function classifySnippet(routePath, snippet, publicAllowlist) {
  if (publicAllowlist.has(routePath)) {
    return { class: 'public_allowlisted', reason: 'explicit allowlist' };
  }
  if (/preHandler\s*:/.test(snippet)) {
    return { class: 'protected', reason: 'fastify preHandler' };
  }
  for (const marker of INLINE_AUTH_MARKERS) {
    if (marker.test(snippet)) {
      return { class: 'protected', reason: `inline auth marker: ${marker}` };
    }
  }
  return { class: 'unknown', reason: 'no preHandler or recognized inline auth marker' };
}

function extractRoutes(filePath, content, publicAllowlist) {
  const relFile = path.relative(root, filePath).replace(/\\/g, '/');
  const mountedUnderAdminPreHandler = relFile.startsWith('services/gateway-api/src/routes/admin/')
    && relFile !== 'services/gateway-api/src/routes/admin/index.ts';
  const matches = [];
  let m;
  while ((m = ROUTE_DECL_RE.exec(content)) !== null) {
    matches.push({
      method: String(m[1]).toUpperCase(),
      path: String(m[2]),
      index: m.index,
      matchLength: m[0].length,
    });
  }

  const records = [];
  for (let i = 0; i < matches.length; i += 1) {
    const curr = matches[i];
    const normalizedPath = normalizeRoutePath(filePath, curr.path);
    if (!normalizedPath || !normalizedPath.startsWith('/v1/')) continue;
    const next = matches[i + 1];
    const start = curr.index;
    const end = next ? next.index : content.length;
    const snippet = content.slice(start, end);
    let cls = classifySnippet(normalizedPath, snippet, publicAllowlist);
    if (
      cls.class === 'unknown'
      && mountedUnderAdminPreHandler
      && normalizedPath.startsWith('/v1/admin/')
    ) {
      cls = { class: 'protected', reason: 'mounted under admin index preHandler hooks' };
    }
    records.push({
      file: relFile,
      method: curr.method,
      path: normalizedPath,
      route_literal: curr.path,
      class: cls.class,
      reason: cls.reason,
    });
  }
  return records;
}

function main() {
  const { allowlist: publicAllowlist, debugExceptions } = buildPublicAllowlist();
  const files = listTsFiles(routesRoot);
  const routes = [];
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    routes.push(...extractRoutes(filePath, content, publicAllowlist));
  }

  const protectedRoutes = routes.filter((r) => r.class === 'protected');
  const publicAllowlisted = routes.filter((r) => r.class === 'public_allowlisted');
  const unknown = routes.filter((r) => r.class === 'unknown');

  const status = unknown.length === 0 ? 'pass' : 'fail';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    totals: {
      v1_routes: routes.length,
      protected: protectedRoutes.length,
      public_allowlisted: publicAllowlisted.length,
      unknown: unknown.length,
    },
    allowlist_policy: {
      debug_public_exception_env: DEBUG_PUBLIC_ROUTE_EXCEPTIONS_ENV,
      debug_public_exceptions: debugExceptions,
    },
    unknown,
    public_allowlisted: publicAllowlisted.map((r) => ({
      method: r.method,
      path: r.path,
      route_literal: r.route_literal,
      file: r.file,
      reason: r.reason,
    })),
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'security-auth-surface-latest.json');
  const outMd = path.join(outDir, 'security-auth-surface-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Security Auth Surface Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Totals',
    `- v1_routes: ${report.totals.v1_routes}`,
    `- protected: ${report.totals.protected}`,
    `- public_allowlisted: ${report.totals.public_allowlisted}`,
    `- unknown: ${report.totals.unknown}`,
    '',
    '## Unknown',
  ];

  if (unknown.length === 0) {
    lines.push('- [x] none');
  } else {
    for (const row of unknown) {
      lines.push(`- [ ] ${row.method} ${row.path} [literal=${row.route_literal}] (${row.file})`);
    }
  }

  lines.push('');
  lines.push('## Public Allowlist');
  for (const row of publicAllowlisted) {
    lines.push(`- ${row.method} ${row.path} [literal=${row.route_literal}] (${row.file})`);
  }
  lines.push('');
  lines.push('## Debug Public Exceptions');
  lines.push(`- env: ${DEBUG_PUBLIC_ROUTE_EXCEPTIONS_ENV}`);
  if (debugExceptions.length === 0) {
    lines.push('- none');
  } else {
    for (const routePath of debugExceptions) {
      lines.push(`- ${routePath}`);
    }
  }

  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_PUBLIC_ALLOWLIST,
  DEBUG_PUBLIC_ROUTE_EXCEPTIONS_ENV,
  parseExplicitDebugPublicRouteExceptions,
  buildPublicAllowlist,
  normalizeRoutePath,
  classifySnippet,
};
