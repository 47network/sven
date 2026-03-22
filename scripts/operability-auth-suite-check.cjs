#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const maxAgeHours = Number(process.env.SVEN_OPERABILITY_AUTH_SUITE_MAX_AGE_HOURS || 72);

const ARTIFACTS = [
  { id: 'privacy_compliance', rel: 'docs/release/status/privacy-compliance-latest.json' },
  { id: 'performance_capacity', rel: 'docs/release/status/performance-capacity-latest.json' },
  { id: 'observability_operability', rel: 'docs/release/status/observability-operability-latest.json' },
];

function readJson(fullPath) {
  return JSON.parse(fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, ''));
}

function extractTimestampIso(value) {
  if (!value || typeof value !== 'object') return null;
  const keys = ['generated_at', 'at_utc', 'validated_at', 'updated_at', 'created_at', 'timestamp'];
  for (const key of keys) {
    const raw = value[key];
    if (!raw) continue;
    const parsed = Date.parse(String(raw));
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return null;
}

function ageHours(timestampIso) {
  if (!timestampIso) return null;
  const parsed = Date.parse(timestampIso);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
}

function run() {
  const checks = [];
  for (const artifact of ARTIFACTS) {
    const full = path.join(root, artifact.rel);
    if (!fs.existsSync(full)) {
      checks.push({ id: `${artifact.id}_present`, pass: false, detail: `${artifact.rel} missing` });
      continue;
    }

    let payload;
    try {
      payload = readJson(full);
      checks.push({ id: `${artifact.id}_valid_json`, pass: true, detail: artifact.rel });
    } catch (err) {
      checks.push({
        id: `${artifact.id}_valid_json`,
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
      continue;
    }

    const status = String(payload?.status || '').toLowerCase();
    checks.push({
      id: `${artifact.id}_status_pass`,
      pass: status === 'pass',
      detail: `status=${status || '(missing)'}`,
    });

    const ts = extractTimestampIso(payload);
    const age = ageHours(ts);
    const fresh = typeof age === 'number' && age <= maxAgeHours;
    checks.push({
      id: `${artifact.id}_fresh`,
      pass: fresh,
      detail: fresh ? `${age.toFixed(2)}h <= ${maxAgeHours}h` : ts ? `${(age || 0).toFixed(2)}h > ${maxAgeHours}h` : 'missing/invalid timestamp',
    });

    const runId = String(payload?.run_id || payload?.source_run_id || '').trim();
    const headSha = String(payload?.head_sha || '').trim();
    checks.push({
      id: `${artifact.id}_provenance_present`,
      pass: Boolean(runId) && /^[a-f0-9]{7,40}$/i.test(headSha),
      detail: `run_id=${runId || '(missing)'}; head_sha=${headSha || '(missing)'}`,
    });
  }

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = { generated_at: new Date().toISOString(), status, checks };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'operability-auth-suite-latest.json');
  const outMd = path.join(outDir, 'operability-auth-suite-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Operability Auth Suite\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8',
  );
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
