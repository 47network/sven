#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');

const masterChecklistPath = path.join(root, 'docs', 'Sven_Master_Checklist.md');
const appChecklistPath = path.join(root, 'docs', 'SVEN_APP_CHECKLIST.md');
const appMetricsPath = path.join(root, 'docs', 'release', 'status', 'app-checklist-metrics-latest.json');

const outDir = path.join(root, 'docs', 'release', 'status');
const outJson = path.join(outDir, 'checklist-metrics-drift-latest.json');
const outMd = path.join(outDir, 'checklist-metrics-drift-latest.md');

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function makeCheck(id, pass, detail) {
  return { id, status: pass ? 'pass' : 'fail', detail };
}

function firstLines(source, count = 90) {
  return source.split(/\r?\n/).slice(0, count).join('\n');
}

function normalizeStatusJson(raw) {
  if (!raw) return raw;
  return raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
}

function parseIsoDate(value) {
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
}

const checks = [];
let masterSource = '';
let appSource = '';
let appMetrics = null;

try {
  masterSource = readUtf8(masterChecklistPath);
  appSource = readUtf8(appChecklistPath);
  appMetrics = JSON.parse(normalizeStatusJson(readUtf8(appMetricsPath)));
} catch (error) {
  const status = {
    generated_at: new Date().toISOString(),
    status: 'fail',
    checks: [
      makeCheck(
        'inputs_readable',
        false,
        `failed reading required inputs: ${String(error && error.message ? error.message : error)}`,
      ),
    ],
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Checklist Metrics Drift Check\n\nStatus: fail\n\n- inputs_readable: fail - ${status.checks[0].detail}\n`,
    'utf8',
  );
  process.exit(2);
}

const masterTop = firstLines(masterSource);
const appTop = firstLines(appSource);

const masterHasMetricsArtifactRefs =
  masterTop.includes('docs/release/status/master-checklist-metrics-latest.md')
  && masterTop.includes('docs/release/status/master-checklist-metrics-latest.json');
checks.push(
  makeCheck(
    'master_summary_references_authoritative_metrics_artifacts',
    masterHasMetricsArtifactRefs,
    masterHasMetricsArtifactRefs
      ? 'master checklist summary references generated metrics artifacts'
      : 'master checklist summary is missing generated metrics artifact references',
  ),
);

const appHasArtifactRefs =
  appTop.includes('docs/release/status/app-checklist-format-latest.json')
  && appTop.includes('docs/release/status/app-checklist-format-latest.md')
  && appTop.includes('docs/release/status/app-checklist-metrics-latest.json')
  && appTop.includes('docs/release/status/app-checklist-metrics-latest.md');
checks.push(
  makeCheck(
    'app_summary_references_authoritative_readiness_artifacts',
    appHasArtifactRefs,
    appHasArtifactRefs
      ? 'app checklist summary references generated readiness artifacts'
      : 'app checklist summary is missing generated readiness artifact references',
  ),
);

const metricsGeneratedAt = appMetrics && typeof appMetrics.generated_at === 'string' ? appMetrics.generated_at : '';
const metricsGeneratedAtTs = parseIsoDate(metricsGeneratedAt);
const maxMetricsAgeHours = Number(process.env.SVEN_APP_METRICS_MAX_AGE_HOURS || 72);
const metricsAgeHours = metricsGeneratedAtTs === null ? null : ((Date.now() - metricsGeneratedAtTs) / 36e5);
const appMetricsFreshEnough =
  metricsGeneratedAtTs !== null
  && metricsAgeHours !== null
  && metricsAgeHours >= 0
  && metricsAgeHours <= maxMetricsAgeHours;
checks.push(
  makeCheck(
    'app_metrics_snapshot_freshness_within_threshold',
    appMetricsFreshEnough,
    appMetricsFreshEnough
      ? `app metrics snapshot age ${metricsAgeHours.toFixed(2)}h <= ${maxMetricsAgeHours}h`
      : `app metrics snapshot is missing/invalid/stale (generated_at="${metricsGeneratedAt}", age_hours=${metricsAgeHours === null ? 'n/a' : metricsAgeHours.toFixed(2)}, max=${maxMetricsAgeHours})`,
  ),
);

const appMetricsShapeValid =
  appMetrics
  && appMetrics.metrics
  && Number.isInteger(appMetrics.metrics.companion_lib_dart_files)
  && Number.isInteger(appMetrics.metrics.companion_test_dart_files)
  && Number.isInteger(appMetrics.metrics.companion_test_declarations);
checks.push(
  makeCheck(
    'app_metrics_snapshot_has_expected_fields',
    Boolean(appMetricsShapeValid),
    appMetricsShapeValid
      ? 'app metrics snapshot contains companion_lib_dart_files, companion_test_dart_files, companion_test_declarations'
      : 'app metrics snapshot is missing one or more required metric fields',
  ),
);

const staleMasterPatterns = [
  /\b12 migration files\b/i,
  /\b400\+\s*E2E test scenarios\b/i,
];
const masterNoKnownStaleToplineMetrics = staleMasterPatterns.every((pattern) => !pattern.test(masterTop));
checks.push(
  makeCheck(
    'master_summary_no_known_stale_topline_metrics',
    masterNoKnownStaleToplineMetrics,
    masterNoKnownStaleToplineMetrics
      ? 'master checklist top summary contains no known stale hardcoded headline metrics'
      : 'master checklist top summary still contains known stale hardcoded headline metrics',
  ),
);

const staticMasterClaimPatterns = [
  /\bREST\s+APIs?\s*:\s*\d+\+\s*endpoints?\b/i,
  /\bTests?\s*:\s*\d+\+\s*E2E\s+test\s+scenarios?\b/i,
  /\(\s*\d{3,}(?:,\d{3})*\+\s*commits?\s*\)/i,
];
const masterStaticClaimHits = staticMasterClaimPatterns
  .filter((pattern) => pattern.test(masterSource))
  .map((pattern) => pattern.toString());
checks.push(
  makeCheck(
    'master_no_static_endpoint_e2e_commit_claims',
    masterStaticClaimHits.length === 0,
    masterStaticClaimHits.length === 0
      ? 'master checklist avoids hardcoded endpoint/e2e/commit count claims'
      : `static_claim_patterns_detected=${masterStaticClaimHits.join(', ')}`,
  ),
);

const staleAppPatterns = [
  /~99\s*Dart files/i,
  /\b28\s*unit tests\b/i,
  /\b33\.3\s*MB\s*APK\b/i,
];
const appNoKnownStaleToplineMetrics = staleAppPatterns.every((pattern) => !pattern.test(appTop));
checks.push(
  makeCheck(
    'app_summary_no_known_stale_topline_metrics',
    appNoKnownStaleToplineMetrics,
    appNoKnownStaleToplineMetrics
      ? 'app checklist top summary contains no known stale hardcoded headline metrics'
      : 'app checklist top summary still contains known stale hardcoded headline metrics',
  ),
);

const sprintHeadlineLines = appTop
  .split(/\r?\n/)
  .filter((line) => /^\s*-\s*Sprint\s+\d+\s*:/i.test(line))
  .map((line) => line.trim().toLowerCase());
const sprintHeadlineDuplicateSet = new Set();
for (const line of sprintHeadlineLines) {
  if (sprintHeadlineLines.filter((entry) => entry === line).length > 1) {
    sprintHeadlineDuplicateSet.add(line);
  }
}
const sprintHeadlineDuplicates = Array.from(sprintHeadlineDuplicateSet);
checks.push(
  makeCheck(
    'app_top_sprint_headlines_no_duplicates',
    sprintHeadlineDuplicates.length === 0,
    sprintHeadlineDuplicates.length === 0
      ? 'app checklist top sprint headlines are unique'
      : `duplicate_sprint_headlines=${sprintHeadlineDuplicates.join(' | ')}`,
  ),
);

const appMetricClaims = [];
const claimMatchers = [
  { key: 'companion_lib_dart_files', regex: /(\d+)\s*Dart files/i },
  { key: 'companion_test_dart_files', regex: /(\d+)\s*test files/i },
  { key: 'companion_test_declarations', regex: /(\d+)\s*test declarations/i },
];
for (const { key, regex } of claimMatchers) {
  const match = appTop.match(regex);
  if (match) {
    appMetricClaims.push({ key, value: Number(match[1]) });
  }
}
const metricDriftThreshold = Number(process.env.SVEN_APP_METRICS_DRIFT_THRESHOLD || 0);
let driftCheckPass = true;
const driftDetails = [];
for (const claim of appMetricClaims) {
  if (!appMetrics || !appMetrics.metrics || !Number.isFinite(appMetrics.metrics[claim.key])) {
    driftCheckPass = false;
    driftDetails.push(`${claim.key}: missing snapshot metric`);
    continue;
  }
  const current = Number(appMetrics.metrics[claim.key]);
  const drift = Math.abs(current - claim.value);
  const pass = drift <= metricDriftThreshold;
  if (!pass) driftCheckPass = false;
  driftDetails.push(`${claim.key}: claim=${claim.value}, current=${current}, drift=${drift}`);
}
checks.push(
  makeCheck(
    'app_quantified_claims_within_snapshot_drift_threshold',
    driftCheckPass,
    appMetricClaims.length === 0
      ? 'no quantified app metrics claims found in checklist header; artifact-driven mode active'
      : `${driftCheckPass ? 'all quantified claims within threshold' : 'one or more quantified claims exceed drift threshold'} (${driftDetails.join('; ')})`,
  ),
);

const status = {
  generated_at: new Date().toISOString(),
  status: checks.every((c) => c.status === 'pass') ? 'pass' : 'fail',
  checks,
  sources: {
    master_checklist: 'docs/Sven_Master_Checklist.md',
    app_checklist: 'docs/SVEN_APP_CHECKLIST.md',
    master_metrics_json: 'docs/release/status/master-checklist-metrics-latest.json',
    app_metrics_json: 'docs/release/status/app-checklist-metrics-latest.json',
    app_format_json: 'docs/release/status/app-checklist-format-latest.json',
  },
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outJson, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const md = [
  '# Checklist Metrics Drift Check',
  '',
  `Status: ${status.status}`,
  '',
  '## Checks',
  '',
  ...checks.map((c) => `- ${c.id}: ${c.status} (${c.detail})`),
  '',
  '## Sources',
  '',
  `- master_checklist: ${status.sources.master_checklist}`,
  `- app_checklist: ${status.sources.app_checklist}`,
  `- master_metrics_json: ${status.sources.master_metrics_json}`,
  `- app_metrics_json: ${status.sources.app_metrics_json}`,
  `- app_format_json: ${status.sources.app_format_json}`,
  '',
].join('\n');
fs.writeFileSync(outMd, `${md}\n`, 'utf8');

console.log(JSON.stringify(status, null, 2));
console.log(`Wrote ${path.relative(root, outJson)}`);
console.log(`Wrote ${path.relative(root, outMd)}`);

if (strict && status.status !== 'pass') {
  process.exit(2);
}
