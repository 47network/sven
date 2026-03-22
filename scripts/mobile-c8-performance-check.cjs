#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const local = process.argv.includes('--local');

const LIMITS = {
  cold_start_p95_ms: 3000,
  artifact_size_mb: 50,
  min_sample_count: 20,
  background_network_bytes_per_min_p95: 50000,
};

function rel(p) {
  return path.relative(root, p).replace(/\\/g, '/');
}

function parseMetric(md, key) {
  const re = new RegExp(`^\\s*-\\s*${key}:\\s*([^\\n\\r]+)`, 'im');
  const m = md.match(re);
  if (!m) return { raw: null, value: null };
  const raw = m[1].trim();
  const numberOnly = raw.match(/^([0-9]+(?:\.[0-9]+)?)(?:\s*(ms|mb))?$/i);
  if (!numberOnly) return { raw, value: null };
  const n = Number(numberOnly[1]);
  if (!Number.isFinite(n)) return { raw, value: null };
  return { raw, value: n };
}

function readNumericSamples(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return [];
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
  const values = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)$/);
    if (!m) continue;
    values.push(Number(m[1]));
  }
  return values.filter((v) => Number.isFinite(v));
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx];
}

function latestEvidenceFile() {
  const dir = path.join(root, 'docs', 'release', 'evidence');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter((name) => /^mobile-c8-remaining-validation-\d{4}-\d{2}-\d{2}\.md$/i.test(name))
    .map((name) => {
      const full = path.join(dir, name);
      return { full, mtimeMs: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0]?.full || null;
}

function run() {
  const evidencePath = latestEvidenceFile();
  const checks = [];

  if (!evidencePath) {
    checks.push({
      id: 'c8_remaining_validation_evidence_present',
      pass: false,
      detail: 'docs/release/evidence/mobile-c8-remaining-validation-YYYY-MM-DD.md not found',
    });
  } else {
    const md = fs.readFileSync(evidencePath, 'utf8');
    const apk = parseMetric(md, 'apk_size_mb');
    const ipa = parseMetric(md, 'ipa_size_mb');
    const coldAndroidSamples = readNumericSamples('docs/release/evidence/telemetry/cold_start_android_samples.txt');
    const coldIosSamples = readNumericSamples('docs/release/evidence/telemetry/cold_start_ios_samples.txt');
    const bgAndroidSamples = readNumericSamples('docs/release/evidence/telemetry/background_network_android_samples.txt');
    const bgIosSamples = readNumericSamples('docs/release/evidence/telemetry/background_network_ios_samples.txt');

    const coldAndroidP95 = percentile(coldAndroidSamples, 0.95);
    const coldIosP95 = percentile(coldIosSamples, 0.95);
    const bgAndroidP95 = percentile(bgAndroidSamples, 0.95);
    const bgIosP95 = percentile(bgIosSamples, 0.95);
    const iosCapturePath = path.join(root, 'docs', 'release', 'evidence', 'mobile-c8-ios-metrics-capture-latest.md');
    let iosCapturePass = false;
    let iosCaptureDetail = 'missing docs/release/evidence/mobile-c8-ios-metrics-capture-latest.md';
    if (fs.existsSync(iosCapturePath)) {
      const iosCapture = fs.readFileSync(iosCapturePath, 'utf8');
      const req = (label) => new RegExp(`^${label}:\\s*.+$`, 'im').test(iosCapture);
      const hasDevice = req('Device');
      const hasIos = req('iOS');
      const hasBuildRef = req('BuildRef');
      const hasSource = req('Source');
      const hasColdCount = /^- cold_start_ios_samples_count:\s*([1-9]\d*)$/im.test(iosCapture);
      const hasBgCount = /^- background_network_ios_samples_count:\s*([1-9]\d*)$/im.test(iosCapture);
      const hasIpa = /^- ipa_size_mb:\s*([0-9]+(?:\.[0-9]+)?)$/im.test(iosCapture);
      iosCapturePass = hasDevice && hasIos && hasBuildRef && hasSource && hasColdCount && hasBgCount && hasIpa;
      iosCaptureDetail = iosCapturePass
        ? 'mobile-c8-ios-metrics-capture-latest.md has required metadata and non-zero captured values'
        : 'mobile-c8-ios-metrics-capture-latest.md missing required metadata and/or non-zero captured values';
    }

    checks.push({
      id: 'cold_start_android_p95_lt_3s',
      pass: coldAndroidSamples.length >= LIMITS.min_sample_count
        && coldAndroidP95 !== null
        && coldAndroidP95 < LIMITS.cold_start_p95_ms,
      detail: `samples=${coldAndroidSamples.length}, p95=${coldAndroidP95 ?? 'n/a'} < ${LIMITS.cold_start_p95_ms}`,
    });
    checks.push({
      id: 'cold_start_ios_p95_lt_3s',
      pass: local
        ? true
        : (coldIosSamples.length >= LIMITS.min_sample_count
          && coldIosP95 !== null
          && coldIosP95 < LIMITS.cold_start_p95_ms),
      detail: local
        ? 'local_mode_skip: iOS cold-start samples not required for local validation'
        : `samples=${coldIosSamples.length}, p95=${coldIosP95 ?? 'n/a'} < ${LIMITS.cold_start_p95_ms}`,
    });
    checks.push({
      id: 'apk_size_lt_50mb',
      pass: apk.value !== null && apk.value < LIMITS.artifact_size_mb,
      detail: apk.raw === null ? 'apk_size_mb not found' : `${apk.raw} < ${LIMITS.artifact_size_mb}`,
    });
    checks.push({
      id: 'ipa_size_lt_50mb',
      pass: local ? true : (ipa.value !== null && ipa.value < LIMITS.artifact_size_mb),
      detail: local
        ? 'local_mode_skip: iOS IPA size evidence not required for local validation'
        : (ipa.raw === null ? 'ipa_size_mb not found' : `${ipa.raw} < ${LIMITS.artifact_size_mb}`),
    });
    checks.push({
      id: 'background_network_sample_captured',
      pass: local
        ? (bgAndroidSamples.length > 0
          && bgAndroidP95 !== null
          && bgAndroidP95 <= LIMITS.background_network_bytes_per_min_p95)
        : (bgAndroidSamples.length > 0
          && bgAndroidP95 !== null
          && bgAndroidP95 <= LIMITS.background_network_bytes_per_min_p95
          && bgIosSamples.length > 0
          && bgIosP95 !== null
          && bgIosP95 <= LIMITS.background_network_bytes_per_min_p95),
      detail: local
        ? `android(samples=${bgAndroidSamples.length}, p95=${bgAndroidP95 ?? 'n/a'}), local_mode_skip: iOS background samples not required, limit=${LIMITS.background_network_bytes_per_min_p95} bytes/min`
        : `android(samples=${bgAndroidSamples.length}, p95=${bgAndroidP95 ?? 'n/a'}), ios(samples=${bgIosSamples.length}, p95=${bgIosP95 ?? 'n/a'}), limit=${LIMITS.background_network_bytes_per_min_p95} bytes/min`,
    });
    checks.push({
      id: 'ios_metrics_provenance_present',
      pass: local ? true : iosCapturePass,
      detail: local
        ? 'local_mode_skip: iOS provenance capture is optional for local validation'
        : iosCaptureDetail,
    });
  }

  const report = {
    generated_at: new Date().toISOString(),
    mode: local ? 'local' : 'strict',
    status: checks.some((c) => !c.pass) ? 'fail' : 'pass',
    limits: LIMITS,
    evidence: evidencePath ? rel(evidencePath) : null,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'mobile-c8-performance-latest.json');
  const outMd = path.join(outDir, 'mobile-c8-performance-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = [
    '# Mobile C8.3 Performance Check',
    '',
    `Generated: ${report.generated_at}`,
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    report.evidence ? `Evidence: ${report.evidence}` : 'Evidence: missing',
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${md.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
  if (strict && report.status !== 'pass') process.exit(2);
}

run();
