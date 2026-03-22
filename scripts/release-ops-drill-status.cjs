#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const artifactPath = process.env.SVEN_OPS_DRILL_ARTIFACT_PATH || 'sven_copy.sql';
const scopePath = process.env.SVEN_OPS_DRILL_SCOPE_PATH || 'migration-drill-scope.json';
const validationPath = process.env.SVEN_OPS_DRILL_VALIDATION_PATH || 'restore-validation.json';
const triggerPathClass = String(process.env.SVEN_OPS_DRILL_PATH_CLASS || '').trim();

function sha256File(fullPath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(fullPath));
  return hash.digest('hex');
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

function run() {
  const artifactFullPath = path.join(root, artifactPath);
  const artifactExists = fs.existsSync(artifactFullPath);
  const artifactSha = artifactExists ? sha256File(artifactFullPath) : '';
  const artifactSize = artifactExists ? fs.statSync(artifactFullPath).size : 0;
  const scopePayload = readJsonIfExists(scopePath);
  const validationPayload = readJsonIfExists(validationPath);

  const runId = String(process.env.GITHUB_RUN_ID || '').trim();
  const headSha = String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim();
  const repo = String(process.env.GITHUB_REPOSITORY || '').trim();
  const serverUrl = String(process.env.GITHUB_SERVER_URL || 'https://github.com').trim();
  const runUrl = repo && runId ? `${serverUrl}/${repo}/actions/runs/${runId}` : '';

  const checks = [
    {
      id: 'ops_drill_artifact_present',
      pass: artifactExists,
      detail: artifactExists ? `${artifactPath} size=${artifactSize}` : `${artifactPath} missing`,
    },
    {
      id: 'ops_drill_artifact_sha256_valid',
      pass: /^[a-f0-9]{64}$/i.test(artifactSha),
      detail: artifactSha || 'missing/invalid sha256',
    },
    {
      id: 'ops_drill_scope_present',
      pass: Boolean(scopePayload),
      detail: scopePayload ? scopePath : `${scopePath} missing/invalid`,
    },
    {
      id: 'ops_drill_restore_validation_present',
      pass: Boolean(validationPayload),
      detail: validationPayload ? validationPath : `${validationPath} missing/invalid`,
    },
    {
      id: 'ops_drill_provenance_present',
      pass: Boolean(runId) && /^[a-f0-9]{7,40}$/i.test(headSha),
      detail: `run_id=${runId || '(missing)'}; head_sha=${headSha || '(missing)'}`,
    },
    {
      id: 'ops_drill_trigger_path_class_present',
      pass: triggerPathClass.length > 0,
      detail: triggerPathClass || 'missing trigger path class',
    },
  ];

  const status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    run_id: runId || null,
    head_sha: headSha || null,
    trigger_path_class: triggerPathClass || null,
    workflow_run_url: runUrl || null,
    artifact: {
      path: artifactPath,
      size_bytes: artifactSize,
      sha256: artifactSha || null,
    },
    scope: scopePayload || null,
    restore_validation: validationPayload || null,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'release-ops-drill-latest.json');
  const outMd = path.join(outDir, 'release-ops-drill-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Release Ops Drill Status\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`)
      .join('\n')}\n`,
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
