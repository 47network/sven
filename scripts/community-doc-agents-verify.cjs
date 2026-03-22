#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'community-doc-agents-latest.json');
const outMd = path.join(outDir, 'community-doc-agents-latest.md');
const docsCatalog = path.join(root, 'docs', 'community', 'agent-feature-verification-latest.md');

const API_BASE = String(
  process.env.SVEN_DOC_AGENT_API_BASE
  || process.env.API_URL
  || process.env.SVEN_APP_HOST
  || 'https://app.sven.systems:44747',
).trim();
const inferredCommunityUrl = (() => {
  try {
    const u = new URL(API_BASE);
    return `${u.origin}/community`;
  } catch {
    return 'https://app.sven.systems:44747/community';
  }
})();
const COMMUNITY_URL = String(
  process.env.SVEN_DOC_AGENT_COMMUNITY_URL
  || process.env.SVEN_COMMUNITY_URL
  || inferredCommunityUrl,
).trim();
const AUTH_USER = String(process.env.SVEN_DOC_AGENT_USERNAME || '').trim();
const AUTH_PASS = String(process.env.SVEN_DOC_AGENT_PASSWORD || '').trim();
const TIMEOUT_MS = Number(process.env.SVEN_DOC_AGENT_TIMEOUT_MS || 12000);
const REQUIRE_COMMUNITY_FEED = /^(1|true|yes|on)$/i.test(
  String(process.env.SVEN_DOC_AGENT_REQUIRE_COMMUNITY_FEED || '').trim(),
);

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function addCheck(checks, id, pass, detail, required = true) {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || ''), required: Boolean(required) });
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      text,
      json: (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })(),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      headers: {},
      text: '',
      json: null,
      error: String(error?.message || error),
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseCookieHeader(setCookieHeaders) {
  const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [];
  return list
    .map((row) => String(row || '').split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

function readJsonIfExists(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

async function run() {
  const checks = [];
  const requiredDocPaths = [
    'docs/README.md',
    'docs/SVEN_APP_CHECKLIST.md',
    'docs/api/openapi.yaml',
    'docs/community/sven-community-platform-and-trust-model.md',
  ];

  let baseUrl;
  let communityUrl;
  try {
    baseUrl = new URL(API_BASE);
    communityUrl = new URL(COMMUNITY_URL);
  } catch (error) {
    addCheck(checks, 'doc_agent_urls_parseable', false, `invalid url config: ${String(error?.message || error)}`);
    const payload = {
      generated_at: new Date().toISOString(),
      status: 'fail',
      api_base: API_BASE,
      community_url: COMMUNITY_URL,
      checks,
      scenarios: {},
    };
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    fs.writeFileSync(outMd, '# Community Doc Agents Verify\n\nStatus: fail\n\nInvalid URL configuration.\n', 'utf8');
    console.log(`Wrote ${rel(outJson)}`);
    console.log(`Wrote ${rel(outMd)}`);
    if (strict) process.exit(2);
    return;
  }

  addCheck(checks, 'doc_agent_urls_parseable', true, `api=${baseUrl.origin}; community=${communityUrl.href}`);

  const healthz = await request(`${baseUrl.origin}/healthz`);
  addCheck(
    checks,
    'gateway_healthz_200',
    healthz.ok && healthz.status === 200,
    healthz.error ? `error=${healthz.error}` : `status=${healthz.status}`,
  );

  const readyz = await request(`${baseUrl.origin}/readyz`);
  addCheck(
    checks,
    'gateway_readyz_200',
    readyz.ok && readyz.status === 200,
    readyz.error ? `error=${readyz.error}` : `status=${readyz.status}`,
  );

  const publicStatus = await request(`${baseUrl.origin}/v1/public/community/status`);
  const publicData = publicStatus.json?.data && typeof publicStatus.json.data === 'object'
    ? publicStatus.json.data
    : publicStatus.json;
  const statusShapeValid = Boolean(
    publicData
      && publicData.policy
      && typeof publicData.policy.access_mode === 'string'
      && publicData.readiness
      && typeof publicData.readiness === 'object',
  );
  addCheck(
    checks,
    'community_public_status_contract',
    publicStatus.ok && statusShapeValid,
    publicStatus.error
      ? `error=${publicStatus.error}`
      : `status=${publicStatus.status}; shape=${statusShapeValid ? 'ok' : 'invalid'}`,
  );

  const publicFeed = await request(`${baseUrl.origin}/v1/public/community/feed`);
  const publicFeedData = publicFeed.json?.data && typeof publicFeed.json.data === 'object'
    ? publicFeed.json.data
    : publicFeed.json;
  const feedShapeValid = Boolean(
    publicFeedData
      && Array.isArray(publicFeedData.posts)
      && Array.isArray(publicFeedData.highlights)
      && publicFeedData.telemetry
      && typeof publicFeedData.telemetry === 'object',
  );
  addCheck(
    checks,
    'community_public_feed_contract',
    publicFeed.ok && feedShapeValid,
    publicFeed.error
      ? `error=${publicFeed.error}`
      : `status=${publicFeed.status}; shape=${feedShapeValid ? 'ok' : 'invalid'}`,
    REQUIRE_COMMUNITY_FEED,
  );

  const publicLeaderboard = await request(`${baseUrl.origin}/v1/public/community/leaderboard`);
  const publicLeaderboardData = publicLeaderboard.json?.data && typeof publicLeaderboard.json.data === 'object'
    ? publicLeaderboard.json.data
    : publicLeaderboard.json;
  const leaderboardShapeValid = Boolean(
    publicLeaderboardData
      && Array.isArray(publicLeaderboardData.accounts)
      && typeof publicLeaderboardData.status === 'string',
  );
  addCheck(
    checks,
    'community_public_leaderboard_contract',
    publicLeaderboard.ok && leaderboardShapeValid,
    publicLeaderboard.error
      ? `error=${publicLeaderboard.error}`
      : `status=${publicLeaderboard.status}; shape=${leaderboardShapeValid ? 'ok' : 'invalid'}`,
    false,
  );

  const publicCapabilityProof = await request(`${baseUrl.origin}/v1/public/community/capability-proof`);
  const publicCapabilityProofData = publicCapabilityProof.json?.data && typeof publicCapabilityProof.json.data === 'object'
    ? publicCapabilityProof.json.data
    : publicCapabilityProof.json;
  const capabilityProofShapeValid = Boolean(
    publicCapabilityProofData
      && publicCapabilityProofData.summary
      && typeof publicCapabilityProofData.summary === 'object'
      && Array.isArray(publicCapabilityProofData.competitors),
  );
  addCheck(
    checks,
    'community_public_capability_proof_contract',
    publicCapabilityProof.ok && capabilityProofShapeValid,
    publicCapabilityProof.error
      ? `error=${publicCapabilityProof.error}`
      : `status=${publicCapabilityProof.status}; shape=${capabilityProofShapeValid ? 'ok' : 'invalid'}`,
  );

  const communityPage = await request(communityUrl.href);
  const hasCommunityMarkup = communityPage.ok
    && /request verified access|community links|sven community/i.test(communityPage.text || '');
  addCheck(
    checks,
    'community_public_page_renders',
    hasCommunityMarkup,
    communityPage.error
      ? `error=${communityPage.error}`
      : `status=${communityPage.status}; marker=${hasCommunityMarkup ? 'found' : 'missing'}`,
  );

  for (const docPath of requiredDocPaths) {
    const full = path.join(root, docPath);
    addCheck(checks, `doc_present:${docPath}`, fs.existsSync(full), fs.existsSync(full) ? 'present' : 'missing');
  }

  const latestStatus = readJsonIfExists('docs/release/status/latest.json');
  const checklistStatus = String(latestStatus?.status || '').toLowerCase();
  addCheck(
    checks,
    'release_latest_status_present',
    Boolean(latestStatus),
    latestStatus ? `status=${checklistStatus || 'unknown'}` : 'missing docs/release/status/latest.json',
    false,
  );
  const competitorProof = readJsonIfExists('docs/release/status/competitor-capability-proof-latest.json');
  addCheck(
    checks,
    'competitor_capability_proof_status_pass',
    String(competitorProof?.status || '').toLowerCase() === 'pass',
    competitorProof
      ? `status=${competitorProof.status}; proven=${competitorProof?.summary?.proven_pass_rows ?? '(n/a)'}/${competitorProof?.summary?.total_rows ?? '(n/a)'}`
      : 'missing docs/release/status/competitor-capability-proof-latest.json',
  );

  const authScenario = {
    provided_credentials: Boolean(AUTH_USER && AUTH_PASS),
    login_status: null,
    me_status: null,
    cookie_received: false,
    error: null,
  };

  if (AUTH_USER && AUTH_PASS) {
    const login = await request(`${baseUrl.origin}/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: AUTH_USER, password: AUTH_PASS }),
    });
    authScenario.login_status = login.status;

    const rawSetCookie = []
      .concat(login.headers['set-cookie'] || [])
      .concat(login.headers['Set-Cookie'] || []);
    const cookieHeader = parseCookieHeader(rawSetCookie);
    authScenario.cookie_received = cookieHeader.length > 0;
    const loginPass = login.ok && (authScenario.cookie_received || Boolean(login.json?.data?.access_token));

    if (!loginPass) {
      authScenario.error = login.error || `login status=${login.status}`;
      addCheck(
        checks,
        'authenticated_user_scenario',
        false,
        authScenario.error,
      );
    } else {
      const authHeader = cookieHeader
        ? { cookie: cookieHeader }
        : { authorization: `Bearer ${String(login.json?.data?.access_token || '').trim()}` };
      const me = await request(`${baseUrl.origin}/v1/auth/me`, { headers: authHeader });
      authScenario.me_status = me.status;
      const mePass = me.ok && me.status === 200;
      addCheck(
        checks,
        'authenticated_user_scenario',
        mePass,
        me.error ? `error=${me.error}` : `login=${login.status}; me=${me.status}`,
      );
    }
  } else {
    addCheck(
      checks,
      'authenticated_user_scenario',
      true,
      'skipped (set SVEN_DOC_AGENT_USERNAME and SVEN_DOC_AGENT_PASSWORD to enable full user-path verification)',
      false,
    );
  }

  const requiredFailures = checks.filter((check) => check.required && !check.pass);
  const status = requiredFailures.length === 0 ? 'pass' : 'fail';

  const payload = {
    generated_at: new Date().toISOString(),
    status,
    api_base: baseUrl.origin,
    community_url: communityUrl.href,
    checks,
    required_failure_count: requiredFailures.length,
    required_failures: requiredFailures.map((check) => ({ id: check.id, detail: check.detail })),
    scenarios: {
      public_runtime: {
        healthz_status: healthz.status,
        readyz_status: readyz.status,
        community_status_http: publicStatus.status,
        community_feed_http: publicFeed.status,
        community_leaderboard_http: publicLeaderboard.status,
        community_capability_proof_http: publicCapabilityProof.status,
      },
      authenticated_user: authScenario,
    },
    artifacts: {
      status_json: rel(outJson),
      status_md: rel(outMd),
      docs_catalog_md: rel(docsCatalog),
    },
  };

  const md = [
    '# Community Doc Agents Verify',
    '',
    `Generated: ${payload.generated_at}`,
    `Status: ${payload.status}`,
    `API base: ${payload.api_base}`,
    `Community URL: ${payload.community_url}`,
    '',
    '## Checks',
    ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}${check.required ? '' : ' (optional)'}: ${check.detail}`),
    '',
    '## Scenarios',
    `- public_runtime: healthz=${payload.scenarios.public_runtime.healthz_status}, readyz=${payload.scenarios.public_runtime.readyz_status}, community_status=${payload.scenarios.public_runtime.community_status_http}`,
    `- public_feed: status=${payload.scenarios.public_runtime.community_feed_http}, leaderboard=${payload.scenarios.public_runtime.community_leaderboard_http}, capability_proof=${payload.scenarios.public_runtime.community_capability_proof_http}`,
    `- authenticated_user: credentials=${authScenario.provided_credentials ? 'provided' : 'not_provided'}, login=${authScenario.login_status ?? '(skipped)'}, me=${authScenario.me_status ?? '(skipped)'}, cookie=${authScenario.cookie_received}`,
    '',
  ].join('\n');

  const catalog = [
    '# Sven Feature Verification Catalog (Community Agents)',
    '',
    `Generated: ${payload.generated_at}`,
    `Status: ${payload.status}`,
    '',
    'This catalog is generated from live endpoint checks and required doc surfaces.',
    '',
    '## Runtime Surface',
    `- Gateway health: ${healthz.status || 'error'}`,
    `- Gateway readiness: ${readyz.status || 'error'}`,
    `- Community status contract: ${publicStatus.status || 'error'}`,
    `- Community feed contract: ${publicFeed.status || 'error'}`,
    `- Community leaderboard contract: ${publicLeaderboard.status || 'error'}`,
    `- Community capability proof contract: ${publicCapabilityProof.status || 'error'}`,
    `- Community page render marker: ${/request verified access|community links|sven community/i.test(communityPage.text || '') ? 'present' : 'missing'}`,
    '',
    '## Documentation Surface',
    ...requiredDocPaths.map((docPath) => {
      const exists = fs.existsSync(path.join(root, docPath));
      return `- ${docPath}: ${exists ? 'present' : 'missing'}`;
    }),
    '',
    '## Authenticated User Path',
    `- Credentials supplied: ${authScenario.provided_credentials}`,
    `- Login status: ${authScenario.login_status ?? 'skipped'}`,
    `- /v1/auth/me status: ${authScenario.me_status ?? 'skipped'}`,
    '',
    '## Evidence',
    `- ${rel(outJson)}`,
    `- ${rel(outMd)}`,
    '',
  ].join('\n');

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.dirname(docsCatalog), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(outMd, `${md}\n`, 'utf8');
  fs.writeFileSync(docsCatalog, `${catalog}\n`, 'utf8');

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
  console.log(`Wrote ${rel(docsCatalog)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
