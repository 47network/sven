#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const maxAgeHours = Number(process.env.SVEN_COMPETITOR_BENCHMARK_MAX_AGE_HOURS || 168);

const combinedAnalysisPath = path.join(root, 'docs', 'parity', 'combined-competitive-analysis.md');
const azComparisonPath = path.join(root, 'docs', 'parity', 'sven-vs-agent-zero-feature-comparison.md');
const competitorEvidenceLedgerPath = path.join(root, 'docs', 'parity', 'competitor-evidence-ledger.json');
const benchmarkSuitePath = path.join(root, 'docs', 'release', 'status', 'benchmark-suite-latest.json');

function readUtf8(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function extractTimestampIso(value) {
  if (!value || typeof value !== 'object') return null;
  for (const key of ['generated_at', 'timestamp', 'updated_at', 'validated_at']) {
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

function add(checks, id, pass, detail) {
  checks.push({ id, pass: Boolean(pass), detail });
}

function run() {
  const checks = [];
  const combined = readUtf8(combinedAnalysisPath);
  const az = readUtf8(azComparisonPath);
  const competitorEvidenceLedger = readJson(competitorEvidenceLedgerPath);
  const benchmarkSuite = readJson(benchmarkSuitePath);

  add(checks, 'combined_analysis_present', Boolean(combined), combined ? 'present' : 'missing');
  add(checks, 'az_comparison_present', Boolean(az), az ? 'present' : 'missing');
  add(
    checks,
    'benchmark_suite_present',
    Boolean(benchmarkSuite),
    benchmarkSuite ? 'present' : 'missing/invalid JSON',
  );
  add(
    checks,
    'competitor_evidence_ledger_present',
    Boolean(competitorEvidenceLedger),
    competitorEvidenceLedger ? 'present' : 'missing/invalid JSON',
  );

  const requiredLabelTokens = ['snapshot-doc', 'in-repo-ci', 'upstream-ci-verified'];
  const missingLabelTokens = requiredLabelTokens.filter((token) => !combined.includes(token));
  add(
    checks,
    'competitor_source_quality_labels_present',
    missingLabelTokens.length === 0,
    missingLabelTokens.length === 0
      ? 'combined analysis includes source-quality labels'
      : `missing labels: ${missingLabelTokens.join(', ')}`,
  );

  add(
    checks,
    'competitor_snapshot_only_claims_block_rule_present',
    combined.includes('release claims that depend only on `snapshot-doc` evidence are blocked'),
    'combined analysis defines snapshot-doc-only claim blocking policy',
  );

  const requiredProvenanceClasses = ['local_code_verified', 'external_docs_verified', 'inferred'];
  const missingCombinedProvenanceClasses = requiredProvenanceClasses.filter(
    (token) => !combined.includes(token),
  );
  const missingAzProvenanceClasses = requiredProvenanceClasses.filter(
    (token) => !az.includes(token),
  );
  add(
    checks,
    'competitor_provenance_classes_present',
    missingCombinedProvenanceClasses.length === 0 && missingAzProvenanceClasses.length === 0,
    missingCombinedProvenanceClasses.length === 0 && missingAzProvenanceClasses.length === 0
      ? 'combined + agent-zero docs include provenance class labels'
      : `missing classes: combined=[${missingCombinedProvenanceClasses.join(', ')}] az=[${missingAzProvenanceClasses.join(', ')}]`,
  );

  if (competitorEvidenceLedger && typeof competitorEvidenceLedger === 'object') {
    const ledgerClasses = Array.isArray(competitorEvidenceLedger.provenance_classes)
      ? competitorEvidenceLedger.provenance_classes.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    const missingLedgerClasses = requiredProvenanceClasses.filter((token) => !ledgerClasses.includes(token));
    add(
      checks,
      'competitor_evidence_ledger_provenance_classes_present',
      missingLedgerClasses.length === 0,
      missingLedgerClasses.length === 0
        ? 'ledger includes required provenance classes'
        : `ledger missing provenance classes: ${missingLedgerClasses.join(', ')}`,
    );

    const claims = Array.isArray(competitorEvidenceLedger.claims) ? competitorEvidenceLedger.claims : [];
    const azCiSurfaceClaim = claims.find((claim) => String(claim?.id || '') === 'agent_zero_local_ci_workflow_surface');
    const azCiEvidencePaths = Array.isArray(azCiSurfaceClaim?.evidence_paths)
      ? azCiSurfaceClaim.evidence_paths.map((item) => String(item || '').trim())
      : [];
    add(
      checks,
      'agent_zero_ci_surface_classified_local_snapshot',
      Boolean(azCiSurfaceClaim)
        && String(azCiSurfaceClaim.provenance_class || '') === 'local_code_verified'
        && azCiEvidencePaths.includes('docs/examples/agent-zero-main/.github/FUNDING.yml'),
      azCiSurfaceClaim
        ? `provenance_class=${String(azCiSurfaceClaim.provenance_class || '(missing)')}`
        : 'missing claim: agent_zero_local_ci_workflow_surface',
    );

    const azCiBenchmarkExternalClaim = claims.find(
      (claim) => String(claim?.id || '') === 'agent_zero_ci_benchmark_fields_external_source_derived',
    );
    const azCiBenchmarkEvidencePaths = Array.isArray(azCiBenchmarkExternalClaim?.evidence_paths)
      ? azCiBenchmarkExternalClaim.evidence_paths.map((item) => String(item || '').trim())
      : [];
    add(
      checks,
      'agent_zero_ci_benchmark_fields_marked_external_source_derived',
      Boolean(azCiBenchmarkExternalClaim)
        && String(azCiBenchmarkExternalClaim.provenance_class || '') === 'external_docs_verified'
        && azCiBenchmarkEvidencePaths.includes('docs/examples/agent-zero-main/.github/FUNDING.yml'),
      azCiBenchmarkExternalClaim
        ? `provenance_class=${String(azCiBenchmarkExternalClaim.provenance_class || '(missing)')}`
        : 'missing claim: agent_zero_ci_benchmark_fields_external_source_derived',
    );
  }

  if (benchmarkSuite && typeof benchmarkSuite === 'object') {
    const status = String(benchmarkSuite.status || '').toLowerCase();
    const ts = extractTimestampIso(benchmarkSuite);
    const age = ageHours(ts);
    const fresh = typeof age === 'number' && age <= maxAgeHours;
    const checkIds = new Set(
      Array.isArray(benchmarkSuite.checks)
        ? benchmarkSuite.checks.map((c) => String(c?.id || '').trim()).filter(Boolean)
        : [],
    );
    const requiredBenchmarkCheckIds = [
      'f1_onboarding_provenance_present',
      'f2_ui_operability_provenance_present',
      'f3_reliability_recovery_provenance_present',
      'f4_security_defaults_provenance_present',
      'competitor_runtime_guard_provenance_present',
      'competitor_runtime_guard_status_pass',
    ];
    const missingCheckIds = requiredBenchmarkCheckIds.filter((id) => !checkIds.has(id));

    add(checks, 'benchmark_suite_status_pass', status === 'pass', `status=${status || '(missing)'}`);
    add(
      checks,
      'benchmark_suite_fresh',
      fresh,
      fresh
        ? `${age.toFixed(2)}h <= ${maxAgeHours}h`
        : ts
          ? `${(age || 0).toFixed(2)}h > ${maxAgeHours}h`
          : 'missing timestamp',
    );
    add(
      checks,
      'benchmark_suite_competitor_proof_check_ids_present',
      missingCheckIds.length === 0,
      missingCheckIds.length === 0
        ? 'required competitor-proof benchmark check ids present'
        : `missing benchmark checks: ${missingCheckIds.join(', ')}`,
    );
  }

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const payload = {
    generated_at: new Date().toISOString(),
    status,
    max_age_hours: maxAgeHours,
    checks,
    sources: {
      combined_analysis: 'docs/parity/combined-competitive-analysis.md',
      az_comparison: 'docs/parity/sven-vs-agent-zero-feature-comparison.md',
      competitor_evidence_ledger: 'docs/parity/competitor-evidence-ledger.json',
      benchmark_suite: 'docs/release/status/benchmark-suite-latest.json',
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'competitor-benchmark-integrity-latest.json');
  const outMd = path.join(outDir, 'competitor-benchmark-integrity-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Competitor Benchmark Integrity Gate\n\nGenerated: ${payload.generated_at}\nStatus: ${payload.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
