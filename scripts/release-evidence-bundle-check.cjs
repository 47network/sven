#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const manifestRel = String(
  process.env.SVEN_RELEASE_EVIDENCE_MANIFEST || 'docs/release/evidence/release-evidence-manifest.json',
).trim();
const manifestPath = path.join(root, manifestRel);
const outDir = path.join(root, 'docs', 'release', 'status');

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

function parseArtifactTimestamp(fullPath) {
  const ext = path.extname(fullPath).toLowerCase();
  if (ext === '.json') {
    try {
      const parsed = readJson(fullPath);
      const ts = extractTimestampIso(parsed);
      if (ts) return ts;
    } catch {
      return null;
    }
  }
  const stat = fs.statSync(fullPath);
  return stat.mtime.toISOString();
}

function run() {
  const checks = [];
  if (!fs.existsSync(manifestPath)) {
    checks.push({
      id: 'release_evidence_manifest_present',
      pass: false,
      detail: `${manifestRel} missing`,
    });
    const report = {
      generated_at: new Date().toISOString(),
      status: 'fail',
      manifest: manifestRel,
      checks,
    };
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'release-evidence-bundle-latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(outDir, 'release-evidence-bundle-latest.md'), `# Release Evidence Bundle\n\nStatus: fail\nReason: ${manifestRel} missing\n`, 'utf8');
    if (strict) process.exit(2);
    return;
  }

  const manifest = readJson(manifestPath);
  const classes = Array.isArray(manifest?.classes) ? manifest.classes : [];
  const requiredProvenanceFields = Array.isArray(manifest?.required_provenance_fields)
    ? manifest.required_provenance_fields
    : ['evidence_mode', 'source_run_id', 'head_sha'];

  checks.push({
    id: 'release_evidence_manifest_present',
    pass: true,
    detail: manifestRel,
  });
  checks.push({
    id: 'release_evidence_manifest_schema_valid',
    pass: classes.length > 0,
    detail: classes.length > 0 ? `classes=${classes.length}` : 'manifest has no classes[]',
  });

  const missingClasses = [];
  for (const cls of classes) {
    if (!cls || typeof cls !== 'object') continue;
    if (!cls.required) continue;
    const classId = String(cls.id || '').trim();
    const maxAgeHours = Number(cls.max_age_hours);
    const artifacts = Array.isArray(cls.artifacts) ? cls.artifacts : [];
    if (!classId || artifacts.length === 0 || !Number.isFinite(maxAgeHours)) {
      missingClasses.push(classId || '(unknown)');
      continue;
    }
    const missingArtifacts = [];
    const staleArtifacts = [];
    for (const rel of artifacts) {
      const full = path.join(root, rel);
      if (!fs.existsSync(full)) {
        missingArtifacts.push(rel);
        continue;
      }
      const ts = parseArtifactTimestamp(full);
      const age = ageHours(ts);
      if (!(typeof age === 'number' && age <= maxAgeHours)) {
        staleArtifacts.push(`${rel}:${age == null ? 'n/a' : `${age.toFixed(2)}h`}`);
      }
    }
    checks.push({
      id: `release_evidence_class_present:${classId}`,
      pass: missingArtifacts.length === 0,
      detail: missingArtifacts.length === 0 ? `artifacts=${artifacts.length}` : `missing=${missingArtifacts.join(', ')}`,
    });
    checks.push({
      id: `release_evidence_class_fresh:${classId}`,
      pass: staleArtifacts.length === 0,
      detail: staleArtifacts.length === 0 ? `max_age_hours=${maxAgeHours}` : `stale=${staleArtifacts.join(', ')}`,
    });
  }

  checks.push({
    id: 'release_evidence_required_classes_well_formed',
    pass: missingClasses.length === 0,
    detail: missingClasses.length === 0 ? 'all required classes are well formed' : `invalid_classes=${missingClasses.join(', ')}`,
  });

  const ciContext = Boolean(
    String(process.env.CI || '').trim() === 'true'
    || String(process.env.GITHUB_ACTIONS || '').trim() === 'true'
    || String(process.env.GITHUB_RUN_ID || '').trim(),
  );
  const provenance = {
    evidence_mode: String(process.env.SVEN_EVIDENCE_MODE || (ciContext ? 'ci_bundle' : 'local_bundle')).trim(),
    source_run_id: String(process.env.GITHUB_RUN_ID || process.env.CI_PIPELINE_ID || '').trim(),
    head_sha: String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim(),
  };
  const missingProvenance = [];
  for (const field of requiredProvenanceFields) {
    const value = String(provenance[field] || '').trim();
    if (!value) missingProvenance.push(field);
  }
  if (!/^[a-f0-9]{7,40}$/i.test(String(provenance.head_sha || ''))) {
    missingProvenance.push('head_sha(valid)');
  }
  const requireStrictProvenance = strict || ciContext;
  checks.push({
    id: 'release_evidence_bundle_provenance_present',
    pass: requireStrictProvenance ? missingProvenance.length === 0 : true,
    detail: missingProvenance.length === 0
      ? `mode=${provenance.evidence_mode}; run_id=${provenance.source_run_id}; head_sha=${provenance.head_sha}`
      : requireStrictProvenance
        ? `missing=${missingProvenance.join(', ')}`
        : `missing=${missingProvenance.join(', ')} (allowed in non-strict local mode)`,
  });

  const status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    manifest: manifestRel,
    required_provenance_fields: requiredProvenanceFields,
    provenance,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'release-evidence-bundle-latest.json');
  const outMd = path.join(outDir, 'release-evidence-bundle-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Release Evidence Bundle\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\nManifest: ${manifestRel}\n\n## Checks\n${checks
      .map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`)
      .join('\n')}\n`,
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
