#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const evidenceRel = String(
  process.env.SVEN_SOAK_HARDWARE_EVIDENCE_PATH || 'docs/release/evidence/soak-hardware-evidence-latest.json',
).trim();
const evidencePath = path.join(root, evidenceRel);
const maxAgeHours = Number(process.env.SVEN_SOAK_HARDWARE_EVIDENCE_MAX_AGE_HOURS || 168);

function readJson(fullPath) {
  return JSON.parse(fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, ''));
}

function parseIso(value) {
  const parsed = Date.parse(String(value || ''));
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function ageHours(timestampIso) {
  if (!timestampIso) return null;
  const parsed = Date.parse(timestampIso);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
}

function run() {
  const checks = [];
  if (!fs.existsSync(evidencePath)) {
    checks.push({
      id: 'soak_hardware_evidence_present',
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
    fs.writeFileSync(path.join(outDir, 'soak-hardware-evidence-latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(outDir, 'soak-hardware-evidence-latest.md'), `# Soak Hardware Evidence\n\nStatus: fail\nReason: ${evidenceRel} missing\n`, 'utf8');
    if (strict) process.exit(2);
    return;
  }

  let evidence;
  try {
    evidence = readJson(evidencePath);
    checks.push({
      id: 'soak_hardware_evidence_valid_json',
      pass: true,
      detail: evidenceRel,
    });
  } catch (err) {
    checks.push({
      id: 'soak_hardware_evidence_valid_json',
      pass: false,
      detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
    });
    evidence = null;
  }

  const requiredFields = [
    'hardware_class',
    'environment',
    'site',
    'load_profile',
    'gateway_host',
    'run_id',
    'head_sha',
    'started_at',
    'finished_at',
    'summary_status',
  ];
  const missing = [];
  for (const field of requiredFields) {
    if (!String(evidence?.[field] || '').trim()) {
      missing.push(field);
    }
  }
  checks.push({
    id: 'soak_hardware_evidence_fields_present',
    pass: missing.length === 0,
    detail: missing.length === 0 ? `required_fields=${requiredFields.length}` : `missing=${missing.join(', ')}`,
  });

  const environment = String(evidence?.environment || '').trim().toLowerCase();
  checks.push({
    id: 'soak_hardware_evidence_environment_not_local_lab',
    pass: environment !== 'local' && environment !== 'local_lab' && environment !== 'dev_local',
    detail: `environment=${environment || '(missing)'}`,
  });

  const summaryStatus = String(evidence?.summary_status || '').trim().toLowerCase();
  checks.push({
    id: 'soak_hardware_evidence_summary_pass',
    pass: summaryStatus === 'pass',
    detail: `summary_status=${summaryStatus || '(missing)'}`,
  });

  const headSha = String(evidence?.head_sha || '').trim();
  checks.push({
    id: 'soak_hardware_evidence_head_sha_valid',
    pass: /^[a-f0-9]{7,40}$/i.test(headSha),
    detail: headSha ? `head_sha=${headSha}` : 'missing head_sha',
  });

  const generatedAt = parseIso(evidence?.generated_at);
  const evidenceAge = ageHours(generatedAt);
  const fresh = typeof evidenceAge === 'number' && evidenceAge <= maxAgeHours;
  checks.push({
    id: 'soak_hardware_evidence_fresh',
    pass: fresh,
    detail: fresh
      ? `${evidenceAge.toFixed(2)}h <= ${maxAgeHours}h`
      : generatedAt
        ? `${(evidenceAge || 0).toFixed(2)}h > ${maxAgeHours}h`
        : 'missing/invalid generated_at',
  });

  const status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    evidence: evidenceRel,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'soak-hardware-evidence-latest.json');
  const outMd = path.join(outDir, 'soak-hardware-evidence-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Soak Hardware Evidence\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\nEvidence: ${evidenceRel}\n\n## Checks\n${checks
      .map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`)
      .join('\n')}\n`,
    'utf8',
  );
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
