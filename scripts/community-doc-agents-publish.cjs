#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'community-doc-agents-publish-latest.json');
const outMd = path.join(outDir, 'community-doc-agents-publish-latest.md');
const draftsDir = path.join(root, 'docs', 'community', 'posts');

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function readJson(fullPath) {
  return JSON.parse(fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, ''));
}

async function postJson(url, body) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      detail: text.slice(0, 400),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      detail: '',
      error: String(error?.message || error),
    };
  }
}

async function run() {
  const verifyPath = path.join(root, 'docs', 'release', 'status', 'community-doc-agents-latest.json');
  if (!fs.existsSync(verifyPath)) {
    console.error('Missing docs/release/status/community-doc-agents-latest.json. Run verify first.');
    process.exit(1);
  }

  const verify = readJson(verifyPath);
  const summary = {
    generated_at: new Date().toISOString(),
    source_status: verify.status,
    source_generated_at: verify.generated_at,
    source_artifact: rel(verifyPath),
    publish_targets: [],
    status: 'pass',
  };

  const postBody = {
    source: 'sven-community-doc-agent',
    generated_at: summary.generated_at,
    verification_status: verify.status,
    verification_generated_at: verify.generated_at,
    required_failure_count: verify.required_failure_count,
    required_failures: verify.required_failures || [],
    api_base: verify.api_base,
    community_url: verify.community_url,
    checks: verify.checks || [],
    artifacts: verify.artifacts || {},
    message: 'Automated Sven feature verification snapshot for community docs.',
  };

  const targets = [
    { id: 'docs_webhook', env: 'SVEN_COMMUNITY_DOCS_WEBHOOK_URL' },
    { id: 'discord_webhook', env: 'SVEN_COMMUNITY_DISCORD_WEBHOOK_URL' },
    { id: 'github_discussions_webhook', env: 'SVEN_COMMUNITY_GITHUB_DISCUSSIONS_WEBHOOK_URL' },
    { id: 'marketplace_webhook', env: 'SVEN_COMMUNITY_MARKETPLACE_WEBHOOK_URL' },
  ];

  let configuredCount = 0;
  for (const target of targets) {
    const url = String(process.env[target.env] || '').trim();
    if (!url) {
      summary.publish_targets.push({
        id: target.id,
        configured: false,
        pass: true,
        detail: `missing ${target.env} (draft only)`,
      });
      continue;
    }
    configuredCount += 1;
    const result = await postJson(url, postBody);
    summary.publish_targets.push({
      id: target.id,
      configured: true,
      pass: result.ok,
      detail: result.error ? `error=${result.error}` : `status=${result.status}`,
      status_code: result.status,
    });
  }

  const failedConfiguredTargets = summary.publish_targets.filter((item) => item.configured && !item.pass);
  if (failedConfiguredTargets.length > 0) {
    summary.status = 'fail';
  } else if (strict && configuredCount === 0) {
    summary.status = 'fail';
    summary.publish_targets.push({
      id: 'strict_configured_target_required',
      configured: true,
      pass: false,
      detail: 'strict mode requires at least one configured community publish webhook',
    });
  } else {
    summary.status = verify.status === 'pass' ? 'pass' : 'warn';
  }

  const stamp = summary.generated_at.replace(/[:.]/g, '-');
  const draftPath = path.join(draftsDir, `community-doc-agent-post-${stamp}.md`);
  const latestDraftPath = path.join(draftsDir, 'community-doc-agent-post-latest.md');
  const draftBody = [
    '# Sven Community Auto Update',
    '',
    `Generated: ${summary.generated_at}`,
    `Verification status: ${verify.status}`,
    `Required failures: ${verify.required_failure_count ?? 0}`,
    '',
    '## Runtime',
    `- API base: ${verify.api_base}`,
    `- Community URL: ${verify.community_url}`,
    '',
    '## Checks',
    ...((verify.checks || []).map((check) => `- ${check.id}: ${check.pass ? 'pass' : 'fail'}${check.required ? '' : ' (optional)'} | ${check.detail}`)),
    '',
    '## Evidence',
    `- ${verify.artifacts?.status_json || 'docs/release/status/community-doc-agents-latest.json'}`,
    `- ${verify.artifacts?.status_md || 'docs/release/status/community-doc-agents-latest.md'}`,
    `- ${verify.artifacts?.docs_catalog_md || 'docs/community/agent-feature-verification-latest.md'}`,
    '',
  ].join('\n');

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(draftsDir, { recursive: true });
  fs.writeFileSync(draftPath, `${draftBody}\n`, 'utf8');
  fs.writeFileSync(latestDraftPath, `${draftBody}\n`, 'utf8');
  fs.writeFileSync(outJson, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  const md = [
    '# Community Doc Agents Publish',
    '',
    `Generated: ${summary.generated_at}`,
    `Status: ${summary.status}`,
    `Source verify status: ${summary.source_status}`,
    '',
    '## Targets',
    ...summary.publish_targets.map((target) => `- [${target.pass ? 'x' : ' '}] ${target.id}: ${target.detail}`),
    '',
    '## Drafts',
    `- ${rel(draftPath)}`,
    `- ${rel(latestDraftPath)}`,
    '',
  ].join('\n');
  fs.writeFileSync(outMd, `${md}\n`, 'utf8');

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
  console.log(`Wrote ${rel(draftPath)}`);
  console.log(`Wrote ${rel(latestDraftPath)}`);

  if (strict && summary.status !== 'pass') process.exit(2);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
