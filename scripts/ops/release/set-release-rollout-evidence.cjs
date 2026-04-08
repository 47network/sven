#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = process.cwd();

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = 'true';
    }
  }
  return args;
}

function resolveHeadSha(explicit) {
  if (explicit) return explicit;
  const envSha = String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim();
  if (envSha) return envSha;
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

function resolveRunId(explicit) {
  if (explicit) return explicit;
  const envRunId = String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim();
  if (envRunId) return envRunId;
  return `local-rollout-${Date.now()}`;
}

function isUrl(value) {
  return /^[a-z]+:\/\//i.test(String(value || '').trim());
}

function writeJson(relOrAbsPath, payload) {
  const full = path.isAbsolute(relOrAbsPath) ? relOrAbsPath : path.join(root, relOrAbsPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return full;
}

function writeText(relOrAbsPath, contents) {
  const full = path.isAbsolute(relOrAbsPath) ? relOrAbsPath : path.join(root, relOrAbsPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents, 'utf8');
  return full;
}

function main() {
  const args = parseArgs(process.argv);
  const normalizedStatus = String(args.status || 'pass').trim().toLowerCase();
  const exitCode = Number.parseInt(String(args.exitCode || args['exit-code'] || '0'), 10);
  const runId = resolveRunId(String(args.runId || args['run-id'] || '').trim());
  const headSha = resolveHeadSha(String(args.headSha || args['head-sha'] || '').trim());
  const immutableLogUri = String(
    args.immutableLogUri || args['immutable-log-uri'] || 'docs/release/evidence/release-rollout-immutable-log-latest.txt',
  ).trim();
  const notes = String(args.notes || 'rollout execution captured after canary and rollback checks').trim();
  const evidencePath = String(
    args.evidencePath || args['evidence-path'] || 'docs/release/evidence/release-rollout-execution-latest.json',
  ).trim();
  const generatedAt = new Date().toISOString();
  const passStates = new Set(['pass', 'success', 'passed']);
  const rolloutStatus = passStates.has(normalizedStatus) && exitCode === 0 ? 'pass' : 'fail';

  const executionEvidence = {
    generated_at: generatedAt,
    status: normalizedStatus,
    exit_code: exitCode,
    run_id: runId,
    head_sha: headSha,
    immutable_log_uri: immutableLogUri,
    notes,
  };
  const rolloutStatusPayload = {
    generated_at: generatedAt,
    status: rolloutStatus,
    source_run_id: runId,
    head_sha: headSha,
    execution_evidence: evidencePath,
    detail: notes,
  };

  const evidenceFull = writeJson(evidencePath, executionEvidence);
  if (immutableLogUri && !isUrl(immutableLogUri)) {
    writeText(
      immutableLogUri,
      [
        `generated_at=${generatedAt}`,
        `status=${normalizedStatus}`,
        `exit_code=${exitCode}`,
        `run_id=${runId}`,
        `head_sha=${headSha}`,
        `notes=${notes}`,
        '',
      ].join('\n'),
    );
  }

  const statusJsonFull = writeJson('docs/release/status/release-rollout-latest.json', rolloutStatusPayload);
  const md = [
    '# Release Rollout',
    '',
    `Generated: ${generatedAt}`,
    `Status: ${rolloutStatus}`,
    '',
    `- execution_evidence: ${evidencePath}`,
    `- source_run_id: ${runId}`,
    `- head_sha: ${headSha}`,
    `- detail: ${notes}`,
    '',
  ].join('\n');
  const statusMdFull = writeText('docs/release/status/release-rollout-latest.md', md);

  console.log(`Updated ${path.relative(root, evidenceFull)}`);
  console.log(`Updated ${path.relative(root, statusJsonFull)}`);
  console.log(`Updated ${path.relative(root, statusMdFull)}`);
}

main();
