#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = process.cwd();
const logRel = 'docs/release/evidence/mirror-agent-packaging-log.jsonl';
const outJsonRel = 'docs/release/status/mirror-agent-host-validation-latest.json';
const outMdRel = 'docs/release/status/mirror-agent-host-validation-latest.md';

function resolveHeadSha() {
  const envSha = String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim();
  if (envSha) return envSha;
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

function write(relPath, contents) {
  const full = path.join(root, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents, 'utf8');
  return full;
}

function readResultEntries(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return [];
  return fs.readFileSync(full, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((entry) => entry && entry.type === 'result');
}

function main() {
  const generatedAt = new Date().toISOString();
  const sourceRunId = String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim() || `local-${Date.now()}`;
  const headSha = resolveHeadSha();
  const entries = readResultEntries(logRel);
  const failCount = entries.filter((entry) => String(entry.result || '').toLowerCase() === 'fail').length;
  const hasEntries = entries.length > 0;
  const status = hasEntries ? (failCount === 0 ? 'pass' : 'fail') : 'incomplete';

  const payload = {
    generated_at: generatedAt,
    status,
    source_run_id: sourceRunId,
    head_sha: headSha,
    total: entries.length,
    failed: failCount,
    log_path: logRel,
    note: hasEntries
      ? (failCount === 0
        ? 'Mirror-agent host validation evidence finalized from captured operator log.'
        : 'Mirror-agent host validation evidence contains failures.')
      : 'Mirror-agent host validation log is not present in this local environment.',
  };

  write(outJsonRel, `${JSON.stringify(payload, null, 2)}\n`);
  write(
    outMdRel,
    [
      '# Mirror Agent Host Validation',
      '',
      `Generated: ${generatedAt}`,
      `Status: ${status}`,
      '',
      `- total: ${payload.total}`,
      `- failed: ${payload.failed}`,
      `- evidence log: ${logRel}`,
      `- note: ${payload.note}`,
      '',
    ].join('\n'),
  );

  console.log(`Updated ${outJsonRel}`);
  console.log(`Updated ${outMdRel}`);
  if (status === 'fail') process.exitCode = 2;
}

main();
