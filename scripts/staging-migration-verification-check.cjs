#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const evidenceRel = String(
  process.env.SVEN_STAGING_MIGRATION_VERIFICATION_PATH || 'docs/release/evidence/staging-migration-verification-latest.json',
).trim();
const evidencePath = path.join(root, evidenceRel);
const maxAgeHours = Number(process.env.SVEN_STAGING_MIGRATION_VERIFICATION_MAX_AGE_HOURS || 72);

function readJson(fullPath) {
  return JSON.parse(fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, ''));
}

function ageHours(timestampIso) {
  const parsed = Date.parse(String(timestampIso || ''));
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
}

function hasSha(value) {
  return /^[a-f0-9]{7,40}$/i.test(String(value || '').trim());
}

function run() {
  const checks = [];
  if (!fs.existsSync(evidencePath)) {
    checks.push({
      id: 'staging_migration_verification_evidence_present',
      pass: false,
      detail: `${evidenceRel} missing`,
    });
    const report = {
      generated_at: new Date().toISOString(),
      status: 'fail',
      evidence: evidenceRel,
      checks,
    };
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'staging-migration-verification-latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(outDir, 'staging-migration-verification-latest.md'), `# Staging Migration Verification\n\nStatus: fail\nReason: ${evidenceRel} missing\n`, 'utf8');
    if (strict) process.exit(2);
    return;
  }

  let evidence = null;
  try {
    evidence = readJson(evidencePath);
    checks.push({
      id: 'staging_migration_verification_evidence_valid_json',
      pass: true,
      detail: evidenceRel,
    });
  } catch (err) {
    checks.push({
      id: 'staging_migration_verification_evidence_valid_json',
      pass: false,
      detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
    });
  }

  const environmentId = String(evidence?.environment_id || '').trim();
  const environmentType = String(evidence?.environment_type || '').trim().toLowerCase();
  const schemaVersion = String(evidence?.schema_version || '').trim();
  const migrationHead = String(evidence?.migration_head || '').trim();
  const applied = evidence?.verification?.applied === true;
  const validated = evidence?.verification?.validated === true;
  const runId = String(evidence?.source_run_id || evidence?.run_id || '').trim();
  const headSha = String(evidence?.head_sha || '').trim();
  const generatedAt = String(evidence?.generated_at || '').trim();
  const evidenceMode = String(evidence?.evidence_mode || '').trim().toLowerCase();
  const drillMode = String(evidence?.drill_mode || '').trim().toLowerCase();
  const age = ageHours(generatedAt);

  checks.push({
    id: 'staging_environment_identity_present',
    pass: Boolean(environmentId) && environmentType === 'staging',
    detail: `environment_id=${environmentId || '(missing)'}; environment_type=${environmentType || '(missing)'}`,
  });
  checks.push({
    id: 'staging_schema_version_present',
    pass: Boolean(schemaVersion) && Boolean(migrationHead),
    detail: `schema_version=${schemaVersion || '(missing)'}; migration_head=${migrationHead || '(missing)'}`,
  });
  checks.push({
    id: 'staging_migrations_applied_and_validated',
    pass: applied && validated,
    detail: `applied=${String(applied)}; validated=${String(validated)}`,
  });
  checks.push({
    id: 'staging_migration_verification_provenance_present',
    pass: Boolean(runId) && hasSha(headSha),
    detail: `run_id=${runId || '(missing)'}; head_sha=${headSha || '(missing)'}`,
  });
  checks.push({
    id: 'staging_migration_verification_fresh',
    pass: typeof age === 'number' && age <= maxAgeHours,
    detail: typeof age === 'number' ? `${age.toFixed(2)}h <= ${maxAgeHours}h` : 'missing/invalid generated_at',
  });
  checks.push({
    id: 'staging_migration_not_local_ephemeral_only',
    pass: environmentType === 'staging' && drillMode !== 'local_ephemeral',
    detail: `environment_type=${environmentType || '(missing)'}; drill_mode=${drillMode || '(missing)'}; evidence_mode=${evidenceMode || '(missing)'}`,
  });

  const status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    evidence: evidenceRel,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'staging-migration-verification-latest.json');
  const outMd = path.join(outDir, 'staging-migration-verification-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Staging Migration Verification\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\nEvidence: ${evidenceRel}\n\n## Checks\n${checks
      .map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`)
      .join('\n')}\n`,
    'utf8',
  );
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
