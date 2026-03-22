#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'community-ecosystem-readiness-latest.json');
const outMd = path.join(outDir, 'community-ecosystem-readiness-latest.md');
const apiBase = String(
  process.env.SVEN_DOC_AGENT_API_BASE
  || process.env.API_URL
  || process.env.SVEN_APP_HOST
  || 'https://app.sven.systems:44747',
).trim();

function normalizeHttpUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function toBool(raw) {
  const value = String(raw || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function add(checks, id, pass, detail) {
  checks.push({ id, pass: Boolean(pass), detail });
}

async function fetchPublicCommunityStatus() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${apiBase.replace(/\/+$/, '')}/v1/public/community/status`, {
      method: 'GET',
      signal: controller.signal,
    });
    const text = await res.text();
    const json = JSON.parse(text);
    return {
      ok: res.ok,
      status: res.status,
      data: json?.data && typeof json.data === 'object' ? json.data : json,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: String(error?.message || error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPublicJson(pathname) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${apiBase.replace(/\/+$/, '')}${pathname}`, {
      method: 'GET',
      signal: controller.signal,
    });
    const text = await res.text();
    const json = JSON.parse(text);
    return {
      ok: res.ok,
      status: res.status,
      data: json?.data && typeof json.data === 'object' ? json.data : json,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: String(error?.message || error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  const publicStatus = await fetchPublicCommunityStatus();
  const publicLeaderboard = await fetchPublicJson('/v1/public/community/leaderboard');
  const publicCapabilityProof = await fetchPublicJson('/v1/public/community/capability-proof');
  const docsUrl = normalizeHttpUrl(process.env.SVEN_COMMUNITY_DOCS_URL)
    || normalizeHttpUrl(publicStatus.data?.docs_url);
  const discordUrl = normalizeHttpUrl(process.env.SVEN_COMMUNITY_DISCORD_URL)
    || normalizeHttpUrl(publicStatus.data?.discord_url);
  const githubDiscussionsUrl = normalizeHttpUrl(process.env.SVEN_COMMUNITY_GITHUB_DISCUSSIONS_URL)
    || normalizeHttpUrl(publicStatus.data?.github_discussions_url);
  const marketplaceUrl = normalizeHttpUrl(process.env.SVEN_COMMUNITY_MARKETPLACE_URL)
    || normalizeHttpUrl(publicStatus.data?.marketplace_url);
  const accessMode = String(process.env.SVEN_COMMUNITY_ACCESS_MODE || publicStatus.data?.policy?.access_mode || '').trim().toLowerCase() || 'verified_persona_only';
  const personaProvider = String(process.env.SVEN_COMMUNITY_PERSONA_PROVIDER || publicStatus.data?.policy?.persona_provider || '').trim();
  const personaAllowlist = String(process.env.SVEN_COMMUNITY_PERSONA_ALLOWLIST || '').trim();
  const personaAllowlistConfigured =
    personaAllowlist.length > 0 || Boolean(publicStatus.data?.policy?.persona_allowlist_configured) || Boolean(publicStatus.data?.readiness?.verified_persona_allowlist);
  const moderationMode = String(process.env.SVEN_COMMUNITY_MODERATION_MODE || publicStatus.data?.policy?.moderation_mode || '').trim().toLowerCase() || 'strict';
  const agentPostPolicy = String(process.env.SVEN_COMMUNITY_AGENT_POST_POLICY || publicStatus.data?.policy?.agent_post_policy || '').trim().toLowerCase() || 'reviewed_only';
  const securityBaselineSigned = toBool(process.env.SVEN_COMMUNITY_SECURITY_BASELINE_SIGNED)
    || Boolean(publicStatus.data?.policy?.security_baseline_signed)
    || Boolean(publicStatus.data?.readiness?.security_baseline);

  const trustModelDoc = path.join(root, 'docs', 'community', 'sven-community-platform-and-trust-model.md');
  const submissionDoc = path.join(root, 'docs', 'community', 'skill-submission-process.md');
  const badgesDoc = path.join(root, 'docs', 'community', 'verified-publisher-badges.md');
  const docAgentStatusPath = path.join(root, 'docs', 'release', 'status', 'community-doc-agents-latest.json');
  const docAgentStatus = fs.existsSync(docAgentStatusPath)
    ? JSON.parse(fs.readFileSync(docAgentStatusPath, 'utf8').replace(/^\uFEFF/, ''))
    : null;

  const checks = [];
  add(
    checks,
    'community_public_status_endpoint_reachable',
    publicStatus.ok,
    publicStatus.error ? `error=${publicStatus.error}` : `status=${publicStatus.status}`,
  );
  add(checks, 'community_docs_url_configured', Boolean(docsUrl), docsUrl || 'missing/invalid SVEN_COMMUNITY_DOCS_URL');
  add(checks, 'community_discord_url_configured', Boolean(discordUrl), discordUrl || 'missing/invalid SVEN_COMMUNITY_DISCORD_URL');
  add(
    checks,
    'community_github_discussions_url_configured',
    Boolean(githubDiscussionsUrl),
    githubDiscussionsUrl || 'missing/invalid SVEN_COMMUNITY_GITHUB_DISCUSSIONS_URL',
  );
  add(
    checks,
    'community_marketplace_url_configured',
    Boolean(marketplaceUrl),
    marketplaceUrl || 'missing/invalid SVEN_COMMUNITY_MARKETPLACE_URL',
  );
  add(
    checks,
    'community_access_mode_verified_persona_only',
    accessMode === 'verified_persona_only',
    `access_mode=${accessMode}`,
  );
  add(
    checks,
    'community_persona_provider_configured',
    personaProvider.length > 0 || Boolean(publicStatus.data?.readiness?.verified_persona_provider),
    personaProvider || (publicStatus.data?.readiness?.verified_persona_provider ? 'configured (runtime readiness)' : 'missing SVEN_COMMUNITY_PERSONA_PROVIDER'),
  );
  add(
    checks,
    'community_persona_allowlist_configured',
    personaAllowlistConfigured,
    personaAllowlistConfigured ? 'configured' : 'missing SVEN_COMMUNITY_PERSONA_ALLOWLIST',
  );
  add(
    checks,
    'community_moderation_guardrails_strict',
    moderationMode === 'strict' && agentPostPolicy === 'reviewed_only',
    `moderation_mode=${moderationMode}, agent_post_policy=${agentPostPolicy}`,
  );
  add(
    checks,
    'community_security_baseline_signed',
    securityBaselineSigned,
    securityBaselineSigned ? 'signed' : 'missing SVEN_COMMUNITY_SECURITY_BASELINE_SIGNED=true',
  );
  add(
    checks,
    'community_trust_model_doc_present',
    fs.existsSync(trustModelDoc),
    fs.existsSync(trustModelDoc) ? 'docs/community/sven-community-platform-and-trust-model.md' : 'missing trust model doc',
  );
  add(
    checks,
    'community_submission_governance_docs_present',
    fs.existsSync(submissionDoc) && fs.existsSync(badgesDoc),
    fs.existsSync(submissionDoc) && fs.existsSync(badgesDoc)
      ? 'skill submission + verified publisher docs present'
      : 'missing one or more governance docs in docs/community/',
  );
  add(
    checks,
    'community_doc_agents_feature_verification_pass',
    String(docAgentStatus?.status || '').toLowerCase() === 'pass',
    docAgentStatus
      ? `community-doc-agents-latest.json status=${docAgentStatus.status}`
      : 'missing docs/release/status/community-doc-agents-latest.json',
  );
  add(
    checks,
    'community_public_leaderboard_endpoint_reachable',
    publicLeaderboard.ok,
    publicLeaderboard.error ? `error=${publicLeaderboard.error}` : `status=${publicLeaderboard.status}`,
  );
  const capabilityShapeValid = Boolean(publicCapabilityProof.data?.summary && typeof publicCapabilityProof.data.summary === 'object');
  add(
    checks,
    'community_public_capability_proof_endpoint_reachable',
    publicCapabilityProof.ok && capabilityShapeValid,
    publicCapabilityProof.error
      ? `error=${publicCapabilityProof.error}`
      : `status=${publicCapabilityProof.status}; shape=${capabilityShapeValid ? 'ok' : 'invalid'}`,
  );

  const pass = checks.every((c) => c.pass);
  const status = pass ? 'pass' : 'fail';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    checks,
    scope: {
      feature: 'agent_zero_9_6_community_ecosystem',
      mode: 'verified-persona-only',
    },
    runtime: {
      api_base: apiBase,
      community_status_http: publicStatus.status,
      community_leaderboard_http: publicLeaderboard.status,
      community_capability_proof_http: publicCapabilityProof.status,
    },
    sources: {
      trust_model: 'docs/community/sven-community-platform-and-trust-model.md',
      skill_submission: 'docs/community/skill-submission-process.md',
      verified_publishers: 'docs/community/verified-publisher-badges.md',
      doc_agent_verify: 'docs/release/status/community-doc-agents-latest.json',
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Community Ecosystem Readiness',
      '',
      `Generated: ${payload.generated_at}`,
      `Status: ${payload.status}`,
      '',
      '## Checks',
      ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && !pass) process.exit(2);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
