#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const manifestRel = String(
  process.env.SVEN_EXTERNAL_INPUTS_MANIFEST || 'docs/release/evidence/external-inputs-manifest.json',
).trim();
const manifestPath = path.join(root, manifestRel);

function readJson(fullPath) {
  return JSON.parse(fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, ''));
}

function ageHours(timestampIso) {
  const parsed = Date.parse(String(timestampIso || ''));
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
}

function extractImportedAtFromDoc(content) {
  const match = String(content || '').match(/Imported at \(UTC\):\s*`([^`]+)`/i);
  return match ? String(match[1]).trim() : '';
}

function run() {
  const checks = [];
  if (!fs.existsSync(manifestPath)) {
    checks.push({
      id: 'external_inputs_manifest_present',
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
    fs.writeFileSync(path.join(outDir, 'external-input-resolution-latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(outDir, 'external-input-resolution-latest.md'), `# External Input Resolution\n\nStatus: fail\nReason: ${manifestRel} missing\n`, 'utf8');
    if (strict) process.exit(2);
    return;
  }

  let manifest;
  try {
    manifest = readJson(manifestPath);
    checks.push({
      id: 'external_inputs_manifest_valid_json',
      pass: true,
      detail: manifestRel,
    });
  } catch (err) {
    checks.push({
      id: 'external_inputs_manifest_valid_json',
      pass: false,
      detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
    });
    manifest = null;
  }

  const inputs = Array.isArray(manifest?.inputs) ? manifest.inputs : [];
  checks.push({
    id: 'external_inputs_manifest_schema_valid',
    pass: inputs.length > 0,
    detail: inputs.length > 0 ? `inputs=${inputs.length}` : 'inputs[] missing or empty',
  });

  const missingRequired = [];
  const staleRequired = [];
  const unresolvedSource = [];
  for (const input of inputs) {
    if (!input || typeof input !== 'object') continue;
    if (!input.required) continue;
    const id = String(input.id || '').trim();
    const sourceReference = String(input.source_reference || '').trim();
    const inRepoPath = String(input.in_repo_path || '').trim();
    const maxAge = Number(input.max_age_hours);
    if (!id || !sourceReference || !inRepoPath || !Number.isFinite(maxAge)) {
      missingRequired.push(id || '(unknown)');
      continue;
    }
    const fullDocPath = path.join(root, inRepoPath);
    if (!fs.existsSync(fullDocPath)) {
      missingRequired.push(id);
      continue;
    }
    const docBody = fs.readFileSync(fullDocPath, 'utf8');
    if (!docBody.trim()) {
      missingRequired.push(id);
      continue;
    }
    if (!docBody.toLowerCase().includes(sourceReference.toLowerCase())) {
      unresolvedSource.push(id);
    }
    const importedAt = extractImportedAtFromDoc(docBody);
    const age = ageHours(importedAt);
    if (!(typeof age === 'number' && age <= maxAge)) {
      staleRequired.push(`${id}:${age == null ? 'n/a' : `${age.toFixed(2)}h`}`);
    }
  }

  checks.push({
    id: 'external_inputs_required_docs_present',
    pass: missingRequired.length === 0,
    detail: missingRequired.length === 0 ? `required=${inputs.filter((x) => x && x.required).length}` : `missing=${missingRequired.join(', ')}`,
  });
  checks.push({
    id: 'external_inputs_source_reference_resolved',
    pass: unresolvedSource.length === 0,
    detail: unresolvedSource.length === 0 ? 'all required source references resolved in canonical docs' : `unresolved=${unresolvedSource.join(', ')}`,
  });
  checks.push({
    id: 'external_inputs_docs_fresh',
    pass: staleRequired.length === 0,
    detail: staleRequired.length === 0 ? 'all required canonical docs within freshness window' : `stale=${staleRequired.join(', ')}`,
  });

  const status = checks.some((check) => !check.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    manifest: manifestRel,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'external-input-resolution-latest.json');
  const outMd = path.join(outDir, 'external-input-resolution-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# External Input Resolution\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\nManifest: ${manifestRel}\n\n## Checks\n${checks
      .map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`)
      .join('\n')}\n`,
    'utf8',
  );
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
