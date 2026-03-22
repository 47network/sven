#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const localOnly = process.argv.includes('--local-only');
const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'bridge-ci-lanes-latest.json');
const outMd = path.join(outDir, 'bridge-ci-lanes-latest.md');

const ciRequiredPath = path.join(outDir, localOnly ? 'ci-required-checks-local-only.json' : 'ci-required-checks-latest.json');
const finalSignoffPath = path.join(outDir, localOnly ? 'final-signoff-local-latest.json' : 'final-signoff-latest.json');

const CI_REQUIRED_IDS = [
  'latest_run_success:bridge-runtime-tests',
  'latest_run_success:gateway-bridge-contract-tests',
];

const FINAL_SIGNOFF_IDS = [
  'ci_required_checks_bridge_runtime_latest_run_success',
  'ci_required_checks_gateway_bridge_contract_latest_run_success',
];

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function findCheck(report, id) {
  const checks = Array.isArray(report?.checks) ? report.checks : [];
  return checks.find((item) => item && item.id === id) || null;
}

function checkToResult({ id, source, report }) {
  const sourceLabel = path.basename(source);
  const check = findCheck(report, id);
  if (!check) {
    return {
      id: `${sourceLabel}:${id}`,
      pass: false,
      detail: `${sourceLabel} missing check ${id}`,
    };
  }
  return {
    id: `${sourceLabel}:${id}`,
    pass: Boolean(check.pass),
    detail: String(check.detail || '(no detail)'),
  };
}

const ciRequired = readJson(ciRequiredPath);
const finalSignoff = readJson(finalSignoffPath);

const checks = [];

checks.push({
  id: 'artifact_present:ci-required-checks-latest',
  pass: Boolean(ciRequired),
  detail: ciRequired ? 'docs/release/status/ci-required-checks-latest.json parsed' : 'missing or invalid JSON',
});
checks.push({
  id: 'artifact_present:final-signoff-latest',
  pass: Boolean(finalSignoff),
  detail: finalSignoff ? 'docs/release/status/final-signoff-latest.json parsed' : 'missing or invalid JSON',
});

checks.push({
  id: 'artifact_status_pass:ci-required-checks-latest',
  pass: localOnly ? true : String(ciRequired?.status || '').toLowerCase() === 'pass',
  detail: localOnly
    ? `skipped in local-only mode (status=${String(ciRequired?.status || '(missing)')})`
    : `status=${String(ciRequired?.status || '(missing)')}`,
});
checks.push({
  id: 'artifact_status_pass:final-signoff-latest',
  pass: localOnly ? true : String(finalSignoff?.status || '').toLowerCase() === 'pass',
  detail: localOnly
    ? `skipped in local-only mode (status=${String(finalSignoff?.status || '(missing)')})`
    : `status=${String(finalSignoff?.status || '(missing)')}`,
});

for (const id of CI_REQUIRED_IDS) {
  checks.push(checkToResult({ id, source: ciRequiredPath, report: ciRequired }));
}
for (const id of FINAL_SIGNOFF_IDS) {
  checks.push(checkToResult({ id, source: finalSignoffPath, report: finalSignoff }));
}

const localOnlySignals = checks
  .filter((check) => /local-only mode/i.test(String(check.detail || '')) || /skipped run check/i.test(String(check.detail || '')))
  .map((check) => check.id);

checks.push({
  id: 'bridge_ci_lanes_remote_evidence_required',
  pass: localOnly ? true : localOnlySignals.length === 0,
  detail: localOnly
    ? 'skipped in local-only mode'
    : localOnlySignals.length
      ? `local-only evidence detected in ${localOnlySignals.join(', ')}`
      : 'no local-only evidence markers detected',
});

const status = checks.every((check) => Boolean(check.pass)) ? 'pass' : 'fail';

const report = {
  generated_at: new Date().toISOString(),
  status,
  checks,
  artifacts: {
    ci_required_checks: path.relative(root, ciRequiredPath).replace(/\\/g, '/'),
    final_signoff: path.relative(root, finalSignoffPath).replace(/\\/g, '/'),
    output_json: path.relative(root, outJson).replace(/\\/g, '/'),
    output_md: path.relative(root, outMd).replace(/\\/g, '/'),
  },
};

const md = [
  '# Bridge CI Lanes Check',
  '',
  `- Generated at: ${report.generated_at}`,
  `- Status: ${report.status}`,
  '',
  '## Checks',
  ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
  '',
  '## Artifacts',
  `- ci-required-checks: ${report.artifacts.ci_required_checks}`,
  `- final-signoff: ${report.artifacts.final_signoff}`,
  `- output-json: ${report.artifacts.output_json}`,
  `- output-md: ${report.artifacts.output_md}`,
  '',
].join('\n');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outJson, JSON.stringify(report, null, 2) + '\n', 'utf8');
fs.writeFileSync(outMd, md, 'utf8');

console.log(`Wrote ${path.relative(root, outJson).replace(/\\/g, '/')}`);
console.log(`Wrote ${path.relative(root, outMd).replace(/\\/g, '/')}`);

if (strict && status !== 'pass') {
  process.exitCode = 1;
}
