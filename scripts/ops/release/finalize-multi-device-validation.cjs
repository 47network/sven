#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = process.cwd();
const logRel = 'docs/release/evidence/multi-device-validation-log.jsonl';
const outJsonRel = 'docs/release/status/multi-device-validation-latest.json';
const outMdRel = 'docs/release/status/multi-device-validation-latest.md';

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
    summary: {
      overall: status,
      note: hasEntries
        ? (failCount === 0
          ? 'Canonical multi-device/operator handoff proofs pass.'
          : 'One or more canonical multi-device/operator handoff proofs failed.')
        : 'Operator evidence log is not present in this local environment.',
    },
    checks: entries.map((entry, index) => ({
      id: String(entry.device_id || entry.scenario || `result-${index + 1}`),
      platform: entry.platform || null,
      scenario: entry.scenario || null,
      status: String(entry.result || '').toLowerCase() || 'unknown',
      recorded_at: entry.recorded_at || null,
      notes: entry.notes || '',
    })),
  };

  write(outJsonRel, `${JSON.stringify(payload, null, 2)}\n`);
  write(
    outMdRel,
    [
      '# Multi-device Validation',
      '',
      `Generated: ${generatedAt}`,
      `Status: ${status}`,
      '',
      `- total: ${payload.total}`,
      `- failed: ${payload.failed}`,
      `- evidence log: ${logRel}`,
      `- note: ${payload.summary.note}`,
      '',
    ].join('\n'),
  );

  console.log(`Updated ${outJsonRel}`);
  console.log(`Updated ${outMdRel}`);
  if (status === 'fail') process.exitCode = 2;
}

main();
