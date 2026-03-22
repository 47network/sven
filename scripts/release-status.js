import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const signoffManifestPath = path.join(root, 'config', 'release', 'signoff-manifest.json');
const strict = process.argv.includes('--strict');
const strictProfileRequested = String(process.env.SVEN_RELEASE_STATUS_STRICT_PROFILE || '').trim().toLowerCase();
const mobileReleaseScopePath = path.join(root, 'config', 'release', 'mobile-release-scope.json');

function readMobileReleaseScope() {
  if (!fs.existsSync(mobileReleaseScopePath)) return 'android-and-ios';
  try {
    const parsed = JSON.parse(fs.readFileSync(mobileReleaseScopePath, 'utf8').replace(/^\uFEFF/, ''));
    return String(parsed?.scope || 'android-and-ios').trim().toLowerCase() || 'android-and-ios';
  } catch {
    return 'android-and-ios';
  }
}

const autoStrictProfile = readMobileReleaseScope() === 'android-only' ? 'android-mobile-rc' : 'production-cutover';
const strictProfile = strictProfileRequested || autoStrictProfile;
const strictProfileDefaults = {
  'ci-only': ['final_dod_ci', 'parity_e2e_ci', 'release_ops_drill_ci'],
  'android-mobile-rc': [
    'd9_keycloak_interop_ci',
    'release_ops_drill_ci',
    'soak_72h',
  ],
  'release-candidate': [
    'final_dod_ci',
    'parity_e2e_ci',
    'd9_keycloak_interop_ci',
    'release_ops_drill_ci',
    'soak_72h',
  ],
  'production-cutover': [
    'final_dod_ci',
    'parity_e2e_ci',
    'd9_keycloak_interop_ci',
    'release_ops_drill_ci',
    'soak_72h',
    'week4_rc_complete',
    'post_release_verified',
  ],
};
const selectedStrictProfile = Object.prototype.hasOwnProperty.call(strictProfileDefaults, strictProfile)
  ? strictProfile
  : 'production-cutover';
const mandatoryGatesOverride = String(process.env.SVEN_RELEASE_STATUS_MANDATORY_GATES || '').trim();
const mandatoryGatesConfig = mandatoryGatesOverride
  ? mandatoryGatesOverride
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  : strictProfileDefaults[selectedStrictProfile];
const apiArtifactMaxAgeHours = Number(process.env.SVEN_RELEASE_STATUS_API_ARTIFACT_MAX_AGE_HOURS || 72);
const shouldEnforceMirrorHostValidation = selectedStrictProfile !== 'android-mobile-rc';

function resolveFirstExistingPath(candidates) {
  for (const rel of candidates) {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

const parityChecklistRel = 'docs/parity/Sven_Parity_Checklist.md';
const parityComparisonRel = 'docs/parity/Sven_vs_OpenClaw_Feature_Comparison.md';
const parityIntegrationTruthfulnessTests = [
  'services/gateway-api/src/__tests__/parity-integration-skills-truthfulness-2026-03-12.contract.test.ts',
  'services/gateway-api/src/__tests__/parity-integration-runtime-truthfulness-2026-03-12.contract.test.ts',
];
const checklistPath = resolveFirstExistingPath([parityChecklistRel]);
const comparisonPath = resolveFirstExistingPath([parityComparisonRel]);

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function fileExists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function resolveLatestSignoffRel(pattern) {
  const signoffDir = path.join(root, 'docs', 'release', 'signoffs');
  if (!fs.existsSync(signoffDir)) return null;
  const files = fs
    .readdirSync(signoffDir)
    .filter((name) => pattern.test(name))
    .sort()
    .reverse();
  if (!files.length) return null;
  return `docs/release/signoffs/${files[0]}`;
}

function readJsonIfExists(relPath) {
  const abs = path.join(root, relPath);
  if (!fs.existsSync(abs)) return null;
  try {
    const raw = fs.readFileSync(abs, 'utf8');
    const normalized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

function readSignoffManifest() {
  const fallback = {
    source: 'fallback',
    release_id_env: 'SVEN_RELEASE_ID',
    required_fields: ['date', 'approver', 'status', 'staging_evidence_url', 'dashboard_url'],
    roles: [
      { id: 'engineering', label: 'Engineering', filename_pattern: '^engineering-signoff-(\\d{4}-\\d{2}-\\d{2})(?:-[a-z0-9-]+)?\\.md$' },
      { id: 'security', label: 'Security', filename_pattern: '^security-signoff-(\\d{4}-\\d{2}-\\d{2})(?:-[a-z0-9-]+)?\\.md$' },
      { id: 'operations', label: 'Operations', filename_pattern: '^operations-signoff-(\\d{4}-\\d{2}-\\d{2})(?:-[a-z0-9-]+)?\\.md$' },
      { id: 'product', label: 'Product', filename_pattern: '^product-signoff-(\\d{4}-\\d{2}-\\d{2})(?:-[a-z0-9-]+)?\\.md$' },
      { id: 'release_owner', label: 'Release owner', filename_pattern: '^release-owner-approval-(\\d{4}-\\d{2}-\\d{2})(?:-[a-z0-9-]+)?\\.md$' },
    ],
  };
  if (!fs.existsSync(signoffManifestPath)) return fallback;
  try {
    const parsed = JSON.parse(fs.readFileSync(signoffManifestPath, 'utf8'));
    const rolesRaw = Array.isArray(parsed?.roles) ? parsed.roles : [];
    const roles = rolesRaw
      .map((entry) => ({
        id: String(entry?.id || '').trim(),
        label: String(entry?.label || '').trim(),
        filename_pattern: String(entry?.filename_pattern || '').trim(),
      }))
      .filter((entry) => entry.id && entry.filename_pattern);
    if (!roles.length) return fallback;
    return {
      source: path.relative(root, signoffManifestPath).replace(/\\/g, '/'),
      release_id_env: String(parsed?.release_id_env || fallback.release_id_env).trim() || fallback.release_id_env,
      required_fields: Array.isArray(parsed?.required_fields)
        ? parsed.required_fields.map((value) => String(value || '').trim()).filter(Boolean)
        : fallback.required_fields,
      roles,
    };
  } catch {
    return fallback;
  }
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

function evaluateD9LocalSelfcheck(report) {
  if (!report || typeof report !== 'object') {
    return {
      valid: false,
      status: 'invalid',
      detail: 'missing or invalid d9-keycloak-local-selfcheck-latest.json',
    };
  }

  const issues = [];
  if (report.strict_mode !== true) issues.push('strict_mode!=true');
  if (!report.input_provenance || typeof report.input_provenance !== 'object') {
    issues.push('input_provenance missing');
  } else {
    if (report.input_provenance.database_url_provided !== true) issues.push('database_url_provided!=true');
    if (report.input_provenance.test_bearer_token_provided !== true) issues.push('test_bearer_token_provided!=true');
  }
  if (!report.hardening_risks || typeof report.hardening_risks !== 'object') issues.push('hardening_risks missing');
  if (!report.migration_coverage || typeof report.migration_coverage !== 'object') {
    issues.push('migration_coverage missing');
  } else if (report.migration_coverage.skipped_due_to_cap !== false) {
    issues.push('migration_coverage.skipped_due_to_cap!=false');
  }

  const status = String(report.status || 'unknown').toLowerCase();
  return {
    valid: issues.length === 0,
    status: issues.length === 0 ? status : 'invalid',
    detail: issues.length ? issues.join('; ') : 'validated strict D9 local selfcheck artifact',
  };
}

const checklistSourcePresent = Boolean(checklistPath);
const comparisonSourcePresent = Boolean(comparisonPath);
const checklist = checklistSourcePresent ? read(checklistPath) : null;
const comparison = comparisonSourcePresent ? read(comparisonPath) : null;
const signoffManifest = readSignoffManifest();
const signoffRoles = signoffManifest.roles.map((role) => ({
  id: role.id,
  label: role.label || role.id,
  pattern: new RegExp(role.filename_pattern, 'i'),
}));

const uncheckedRaw = checklistSourcePresent
  ? checklist
      .split(/\r?\n/)
      .map((line, idx) => ({ line: idx + 1, text: line.trim() }))
      .filter((entry) => /-\s*\[\s\]/.test(entry.text))
  : [];
const checklistWaiverMatchersByProfile = {
  'android-mobile-rc': [
    /week 4 target:/i,
    /post-release verification checklist completed/i,
  ],
};
const checklistWaiverMatchers = checklistWaiverMatchersByProfile[selectedStrictProfile] || [];
const unchecked = uncheckedRaw.filter(
  (entry) => !checklistWaiverMatchers.some((matcher) => matcher.test(entry.text)),
);
const waivedUnchecked = uncheckedRaw.filter(
  (entry) => checklistWaiverMatchers.some((matcher) => matcher.test(entry.text)),
);

const numberedRows = comparisonSourcePresent
  ? comparison
      .split(/\r?\n/)
      .filter((line) => /^\|\s*\d+\.\d+\s*\|/.test(line))
  : [];
const comparisonSchemaValid = comparisonSourcePresent ? numberedRows.length > 0 : false;
const integrationTruthfulnessSourcesPresent = parityIntegrationTruthfulnessTests.every((rel) => fileExists(rel));

const unresolvedRows = numberedRows.filter((line) => line.includes('⚠️') || line.includes('❌'));

const signoffEvidenceFiles = signoffRoles
  .map((role) => resolveLatestSignoffRel(role.pattern))
  .filter(Boolean);
const signoffEpochs = signoffEvidenceFiles
  .map((rel) => {
    const m = String(rel).match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  })
  .filter(Boolean);
const signoffEpochSet = new Set(signoffEpochs);
const signoffEpochConsistent = signoffEpochSet.size <= 1;

const evidenceFiles = [
  '.github/workflows/final-dod-e2e.yml',
  '.github/workflows/parity-e2e.yml',
  '.github/workflows/release-ops-drill.yml',
  'docs/release/p0-findings.md',
  'docs/release/release-notes-template.md',
  'docs/release/post-release-verification-checklist.md',
  ...signoffEvidenceFiles,
];

const evidence = evidenceFiles.map((rel) => ({ file: rel, exists: fileExists(rel) }));
const missingEvidence = evidence.filter((entry) => !entry.exists).map((entry) => entry.file);

const ciGates = readJsonIfExists('docs/release/status/ci-gates.json');
const d9GateStatus = readJsonIfExists('docs/release/status/d9-keycloak-interop-gate-latest.json');
const d9EvidenceCheckStatus = readJsonIfExists('docs/release/status/d9-keycloak-interop-evidence-check-latest.json');
const d9PreflightStatus = readJsonIfExists('docs/release/status/d9-keycloak-interop-preflight-latest.json');
const d9LocalSelfcheckStatus = readJsonIfExists('docs/release/status/d9-keycloak-local-selfcheck-latest.json');
const d9LocalSelfcheckEvaluation = evaluateD9LocalSelfcheck(d9LocalSelfcheckStatus);
const soakSummaryStatus = readJsonIfExists('docs/release/status/soak-72h-summary.json');
const soakRunStatus = readJsonIfExists('docs/release/status/soak-72h-run.json');
const apiContractVersionStatus = readJsonIfExists('docs/release/status/api-contract-version-latest.json');
const apiOpenapiContractStatus = readJsonIfExists('docs/release/status/api-openapi-contract-latest.json');
const apiRequestSchemaCoverageStatus = readJsonIfExists('docs/release/status/api-request-body-schema-coverage-latest.json');
const traceabilityMatrixStatus = readJsonIfExists('docs/release/status/traceability-matrix-latest.json');
const masterChecklistMetricsStatus = readJsonIfExists('docs/release/status/master-checklist-metrics-latest.json');
const masterChecklistGovernanceStatus = readJsonIfExists('docs/release/status/master-checklist-governance-latest.json');
const masterParitySummaryStatus = readJsonIfExists('docs/release/status/master-parity-summary-latest.json');
const appChecklistMetricsStatus = readJsonIfExists('docs/release/status/app-checklist-metrics-latest.json');
const appChecklistFormatStatus = readJsonIfExists('docs/release/status/app-checklist-format-latest.json');
const openapiMetricsStatus = readJsonIfExists('docs/release/status/openapi-metrics-latest.json');
const mobileReleaseReadinessStatus = readJsonIfExists('docs/release/status/mobile-release-readiness-latest.json');
const multiDeviceValidationStatus = readJsonIfExists('docs/release/status/multi-device-validation-latest.json');
const finalSignoffStatus = readJsonIfExists('docs/release/status/final-signoff-latest.json');
const releaseRolloutStatus = readJsonIfExists('docs/release/status/release-rollout-latest.json');
const mirrorAgentHostValidationStatus = readJsonIfExists('docs/release/status/mirror-agent-host-validation-latest.json');
const competitorRuntimeTruthStatus = readJsonIfExists('docs/release/status/competitor-runtime-truth-latest.json');
const competitorCapabilityProofStatus = readJsonIfExists('docs/release/status/competitor-capability-proof-latest.json');
const competitiveScorecardStatus = readJsonIfExists('docs/release/status/competitive-scorecard-latest.json');
const competitiveProgramCompletionStatus = readJsonIfExists(
  'docs/release/status/competitive-reproduction-program-completion-latest.json',
);

function deriveSoakLiveCounts(summary, run) {
  if (!summary || typeof summary !== 'object' || !run || typeof run !== 'object') {
    return null;
  }
  const eventsRel = typeof run.events_file === 'string' ? run.events_file : '';
  if (!eventsRel) return null;
  const eventsPath = path.join(root, eventsRel.replace(/\//g, path.sep));
  if (!fs.existsSync(eventsPath)) return null;

  const runApi = String(run.api_url || '');
  const runStarted = Date.parse(String(run.started_at || ''));
  const startedMs = Number.isNaN(runStarted) ? null : runStarted;

  let samples = 0;
  let failures = 0;
  try {
    const lines = fs.readFileSync(eventsPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      if (!line) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (runApi && String(event.api_url || '') !== runApi) continue;
      if (startedMs !== null) {
        const eventMs = Date.parse(String(event.at || ''));
        if (!Number.isNaN(eventMs) && eventMs < startedMs) continue;
      }
      samples += 1;
      if (String(event.status || '').toLowerCase() === 'fail') failures += 1;
    }
  } catch {
    return null;
  }
  return { samples, failures };
}

const status = {
  generated_at: new Date().toISOString(),
  signoff_manifest: {
    source: signoffManifest.source,
    release_id_env: signoffManifest.release_id_env,
    required_fields: signoffManifest.required_fields,
    roles: signoffRoles.map((role) => role.id),
    selected_files: signoffEvidenceFiles,
    selected_epochs: Array.from(signoffEpochSet),
    epoch_consistent: signoffEpochConsistent,
  },
  parity_sources: {
    checklist_path: checklistPath ? path.relative(root, checklistPath).replace(/\\/g, '/') : null,
    comparison_path: comparisonPath ? path.relative(root, comparisonPath).replace(/\\/g, '/') : null,
    integration_truthfulness_tests: parityIntegrationTruthfulnessTests,
  },
  source_validation: {
    checklist_source_present: checklistSourcePresent,
    comparison_source_present: comparisonSourcePresent,
    comparison_row_schema_valid: comparisonSchemaValid,
    integration_truthfulness_tests_present: integrationTruthfulnessSourcesPresent,
  },
  checklist: {
    unchecked_count: checklistSourcePresent ? unchecked.length : null,
    unchecked_items: unchecked,
    waived_unchecked_count: checklistSourcePresent ? waivedUnchecked.length : null,
    waived_unchecked_items: waivedUnchecked,
  },
  comparison: {
    unresolved_feature_rows: comparisonSourcePresent ? unresolvedRows.length : null
  },
  evidence: {
    missing_count: missingEvidence.length,
    missing: missingEvidence
  },
  d9_keycloak_interop: {
    ci_gate: ciGates && typeof ciGates === 'object' ? Boolean(ciGates.d9_keycloak_interop_ci) : null,
    local_gate_status: d9GateStatus && typeof d9GateStatus === 'object' ? String(d9GateStatus.status || 'unknown') : null,
    evidence_check_status:
      d9EvidenceCheckStatus && typeof d9EvidenceCheckStatus === 'object'
        ? String(d9EvidenceCheckStatus.status || 'unknown')
        : null,
    preflight_status:
      d9PreflightStatus && typeof d9PreflightStatus === 'object'
        ? String(d9PreflightStatus.status || 'unknown')
        : null,
    local_selfcheck_status: d9LocalSelfcheckEvaluation.status,
    local_selfcheck_validation_status: d9LocalSelfcheckEvaluation.valid ? 'valid' : 'invalid',
    local_selfcheck_validation_detail: d9LocalSelfcheckEvaluation.detail,
  },
  soak_72h: {
    ci_gate: ciGates && typeof ciGates === 'object' ? Boolean(ciGates.soak_72h) : null,
    summary_status:
      soakSummaryStatus && typeof soakSummaryStatus === 'object'
        ? String(soakSummaryStatus.status || 'unknown')
        : null,
    failures:
      soakSummaryStatus && typeof soakSummaryStatus === 'object'
        ? Number(soakSummaryStatus.failures || 0)
        : null,
    samples:
      soakSummaryStatus && typeof soakSummaryStatus === 'object'
        ? Number(soakSummaryStatus.samples || 0)
        : null,
    expected_samples:
      soakSummaryStatus && typeof soakSummaryStatus === 'object'
        ? Number(soakSummaryStatus.expected_samples || 0)
        : null,
    reason:
      soakSummaryStatus && typeof soakSummaryStatus === 'object'
        ? String(soakSummaryStatus.reason || '')
        : null
  },
  api_contracts: {
    contract_version_status:
      apiContractVersionStatus && typeof apiContractVersionStatus === 'object'
        ? String(apiContractVersionStatus.status || 'unknown')
        : null,
    openapi_contract_status:
      apiOpenapiContractStatus && typeof apiOpenapiContractStatus === 'object'
        ? String(apiOpenapiContractStatus.status || 'unknown')
        : null,
    request_schema_coverage_status:
      apiRequestSchemaCoverageStatus && typeof apiRequestSchemaCoverageStatus === 'object'
        ? String(apiRequestSchemaCoverageStatus.status || 'unknown')
        : null,
    traceability_matrix_status:
      traceabilityMatrixStatus && typeof traceabilityMatrixStatus === 'object'
        ? String(traceabilityMatrixStatus.status || 'unknown')
        : null,
  },
  mobile_release_readiness: {
    status:
      mobileReleaseReadinessStatus && typeof mobileReleaseReadinessStatus === 'object'
        ? String(mobileReleaseReadinessStatus.status || 'unknown')
        : null,
    generated_at: extractTimestampIso(mobileReleaseReadinessStatus),
    age_hours: ageHours(extractTimestampIso(mobileReleaseReadinessStatus)),
    max_age_hours: apiArtifactMaxAgeHours,
  },
  multi_device_validation: {
    status:
      multiDeviceValidationStatus && typeof multiDeviceValidationStatus === 'object'
        ? String((multiDeviceValidationStatus.summary && multiDeviceValidationStatus.summary.overall) || multiDeviceValidationStatus.status || 'unknown')
        : null,
    generated_at: extractTimestampIso(multiDeviceValidationStatus),
    age_hours: ageHours(extractTimestampIso(multiDeviceValidationStatus)),
    max_age_hours: apiArtifactMaxAgeHours,
  },
  final_signoff: {
    status:
      finalSignoffStatus && typeof finalSignoffStatus === 'object'
        ? String(finalSignoffStatus.status || 'unknown')
        : null,
    generated_at: extractTimestampIso(finalSignoffStatus),
    age_hours: ageHours(extractTimestampIso(finalSignoffStatus)),
    max_age_hours: apiArtifactMaxAgeHours,
  },
  strict_policy: {
    strict_profile_requested: strictProfileRequested || '(auto)',
    strict_profile_applied: selectedStrictProfile,
    strict_profile_auto_default: autoStrictProfile,
    mandatory_gates_override: mandatoryGatesOverride.length > 0,
    mandatory_gates: mandatoryGatesConfig,
  },
  release_rollout: {
    status:
      releaseRolloutStatus && typeof releaseRolloutStatus === 'object'
        ? String(releaseRolloutStatus.status || 'unknown')
        : null,
    generated_at: extractTimestampIso(releaseRolloutStatus),
    age_hours: ageHours(extractTimestampIso(releaseRolloutStatus)),
    max_age_hours: apiArtifactMaxAgeHours,
  },
  mirror_agent_host_validation: {
    status:
      mirrorAgentHostValidationStatus && typeof mirrorAgentHostValidationStatus === 'object'
        ? String(
          (mirrorAgentHostValidationStatus.summary && mirrorAgentHostValidationStatus.summary.overall)
          || mirrorAgentHostValidationStatus.status
          || 'unknown'
        )
        : null,
    generated_at: extractTimestampIso(mirrorAgentHostValidationStatus),
    age_hours: ageHours(extractTimestampIso(mirrorAgentHostValidationStatus)),
    max_age_hours: apiArtifactMaxAgeHours,
  },
  competitive_program: {
    runtime_truth_status:
      competitorRuntimeTruthStatus && typeof competitorRuntimeTruthStatus === 'object'
        ? String(competitorRuntimeTruthStatus.status || 'unknown')
        : null,
    runtime_truth_generated_at: extractTimestampIso(competitorRuntimeTruthStatus),
    runtime_truth_age_hours: ageHours(extractTimestampIso(competitorRuntimeTruthStatus)),
    capability_proof_status:
      competitorCapabilityProofStatus && typeof competitorCapabilityProofStatus === 'object'
        ? String(competitorCapabilityProofStatus.status || 'unknown')
        : null,
    capability_proof_generated_at: extractTimestampIso(competitorCapabilityProofStatus),
    capability_proof_age_hours: ageHours(extractTimestampIso(competitorCapabilityProofStatus)),
    scorecard_status:
      competitiveScorecardStatus && typeof competitiveScorecardStatus === 'object'
        ? String(competitiveScorecardStatus.status || 'unknown')
        : null,
    scorecard_generated_at: extractTimestampIso(competitiveScorecardStatus),
    scorecard_age_hours: ageHours(extractTimestampIso(competitiveScorecardStatus)),
    program_completion_status:
      competitiveProgramCompletionStatus && typeof competitiveProgramCompletionStatus === 'object'
        ? String(competitiveProgramCompletionStatus.status || 'unknown')
        : null,
    program_completion_generated_at: extractTimestampIso(competitiveProgramCompletionStatus),
    program_completion_age_hours: ageHours(extractTimestampIso(competitiveProgramCompletionStatus)),
  },
  blocking_reasons: []
};

if (
  status.soak_72h.expected_samples === null ||
  !Number.isFinite(status.soak_72h.expected_samples) ||
  status.soak_72h.expected_samples <= 0
) {
  const intervalSecondsRaw =
    soakSummaryStatus && typeof soakSummaryStatus === 'object'
      ? Number(soakSummaryStatus.interval_seconds || 60)
      : 60;
  const durationHoursRaw =
    soakSummaryStatus && typeof soakSummaryStatus === 'object'
      ? Number(soakSummaryStatus.duration_hours || 72)
      : 72;
  const intervalSeconds = Number.isFinite(intervalSecondsRaw) && intervalSecondsRaw > 0 ? intervalSecondsRaw : 60;
  const durationHours = Number.isFinite(durationHoursRaw) && durationHoursRaw > 0 ? durationHoursRaw : 72;
  status.soak_72h.expected_samples = Math.max(1, Math.floor((durationHours * 3600) / intervalSeconds));
}

if (
  status.soak_72h.summary_status === 'fail' &&
  status.soak_72h.failures === 0 &&
  status.soak_72h.samples !== null &&
  status.soak_72h.expected_samples !== null &&
  status.soak_72h.expected_samples > 0 &&
  status.soak_72h.samples < status.soak_72h.expected_samples
) {
  status.soak_72h.summary_status = 'interrupted';
}

const soakLiveCounts = deriveSoakLiveCounts(soakSummaryStatus, soakRunStatus);
if (
  soakLiveCounts &&
  (status.soak_72h.summary_status === 'running' || status.soak_72h.summary_status === 'interrupted')
) {
  status.soak_72h.samples = soakLiveCounts.samples;
  status.soak_72h.failures = soakLiveCounts.failures;
}

const blockingReasons = [];
const mandatoryGateSet = new Set(mandatoryGatesConfig);
if (!checklistSourcePresent) {
  blockingReasons.push({
    id: 'checklist_source_present',
    detail: `required canonical checklist not found: ${parityChecklistRel}`,
  });
}
if (!comparisonSourcePresent) {
  blockingReasons.push({
    id: 'comparison_source_present',
    detail: `required canonical comparison not found: ${parityComparisonRel}`,
  });
}
if (comparisonSourcePresent && !comparisonSchemaValid) {
  blockingReasons.push({
    id: 'comparison_source_schema',
    detail: `comparison source missing expected feature-row schema (| <digit>.<digit> |): ${parityComparisonRel}`,
  });
}
if (!integrationTruthfulnessSourcesPresent) {
  blockingReasons.push({
    id: 'integration_truthfulness_sources_present',
    detail: `required integration truthfulness tests missing: ${parityIntegrationTruthfulnessTests.join(', ')}`,
  });
}
if (status.comparison.unresolved_feature_rows > 0) {
  blockingReasons.push({
    id: 'comparison_unresolved_feature_rows',
    detail: `unresolved feature rows: ${status.comparison.unresolved_feature_rows}`,
  });
}
if (status.checklist.unchecked_count > 0) {
  blockingReasons.push({
    id: 'checklist_unchecked_items',
    detail: `checklist unchecked items: ${status.checklist.unchecked_count}`,
  });
}
if (status.evidence.missing_count > 0) {
  blockingReasons.push({
    id: 'missing_evidence_files',
    detail: `missing evidence files: ${status.evidence.missing_count}`,
  });
}
if (!status.signoff_manifest.epoch_consistent) {
  blockingReasons.push({
    id: 'signoff_epoch_divergence',
    detail: `selected signoff epochs diverge: ${status.signoff_manifest.selected_epochs.join(', ')}`,
  });
}

const ciGateMap = ciGates && typeof ciGates === 'object' ? ciGates : {};
for (const gateKey of mandatoryGatesConfig) {
  const raw = ciGateMap[gateKey];
  if (raw !== true) {
    blockingReasons.push({
      id: `mandatory_gate_${gateKey}`,
      detail:
        raw === undefined
          ? `${gateKey} missing in docs/release/status/ci-gates.json`
          : `${gateKey}=${String(raw)} (expected true)`,
    });
  }
}

if (mandatoryGateSet.has('d9_keycloak_interop_ci')) {
  const d9Statuses = [
    { id: 'd9_keycloak_local_gate_status', value: String(status.d9_keycloak_interop.local_gate_status || '').toLowerCase() },
    { id: 'd9_keycloak_evidence_check_status', value: String(status.d9_keycloak_interop.evidence_check_status || '').toLowerCase() },
  ];
  for (const item of d9Statuses) {
    if (item.value !== 'pass') {
      blockingReasons.push({
        id: item.id,
        detail: `${item.id}=${item.value || 'unknown'} (expected pass)`,
      });
    }
  }
  const d9LocalSelfcheckStatus = String(status.d9_keycloak_interop.local_selfcheck_status || '').toLowerCase();
  if (d9LocalSelfcheckStatus !== 'pass') {
    blockingReasons.push({
      id: 'd9_keycloak_local_selfcheck_status',
      detail: `d9_keycloak_local_selfcheck_status=${d9LocalSelfcheckStatus || 'unknown'} (expected pass); ${String(status.d9_keycloak_interop.local_selfcheck_validation_detail || 'missing validation detail')}`,
    });
  }
}

if (mandatoryGateSet.has('soak_72h')) {
  const soakSummary = String(status.soak_72h.summary_status || '').toLowerCase();
  if (soakSummary !== 'pass') {
    blockingReasons.push({
      id: 'soak_72h_summary_status',
      detail: `soak summary_status=${soakSummary || 'unknown'} (expected pass)`,
    });
  }
  if (Number.isFinite(status.soak_72h.failures) && Number(status.soak_72h.failures) > 0) {
    blockingReasons.push({
      id: 'soak_72h_failures_nonzero',
      detail: `soak failures=${status.soak_72h.failures} (expected 0)`,
    });
  }
  if (
    Number.isFinite(status.soak_72h.samples)
    && Number.isFinite(status.soak_72h.expected_samples)
    && Number(status.soak_72h.expected_samples) > 0
    && Number(status.soak_72h.samples) < Number(status.soak_72h.expected_samples)
  ) {
    blockingReasons.push({
      id: 'soak_72h_samples_below_expected',
      detail: `soak samples=${status.soak_72h.samples} expected_samples=${status.soak_72h.expected_samples}`,
    });
  }
}

const apiArtifacts = [
  { id: 'api_contract_version', report: apiContractVersionStatus },
  { id: 'api_openapi_contract', report: apiOpenapiContractStatus },
  { id: 'api_request_schema_coverage', report: apiRequestSchemaCoverageStatus },
  { id: 'traceability_matrix', report: traceabilityMatrixStatus },
];
for (const artifact of apiArtifacts) {
  const report = artifact.report;
  if (!report || typeof report !== 'object') {
    blockingReasons.push({
      id: `${artifact.id}_missing`,
      detail: `missing docs/release/status artifact for ${artifact.id}`,
    });
    continue;
  }
  const artifactStatus = String(report.status || '').toLowerCase();
  if (artifactStatus !== 'pass') {
    blockingReasons.push({
      id: `${artifact.id}_status`,
      detail: `${artifact.id} status=${artifactStatus || 'unknown'} (expected pass)`,
    });
  }
  const artifactTimestamp = extractTimestampIso(report);
  const artifactAge = ageHours(artifactTimestamp);
  if (!(typeof artifactAge === 'number' && artifactAge <= apiArtifactMaxAgeHours)) {
    blockingReasons.push({
      id: `${artifact.id}_freshness`,
      detail: artifactTimestamp
        ? `${artifact.id} age=${(artifactAge || 0).toFixed(2)}h (max ${apiArtifactMaxAgeHours}h)`
        : `${artifact.id} missing/invalid timestamp`,
    });
  }
  const runId = String(report.source_run_id || report.run_id || '').trim();
  const headSha = String(report.head_sha || '').trim();
  if (!runId || !/^[a-f0-9]{7,40}$/i.test(headSha)) {
    blockingReasons.push({
      id: `${artifact.id}_provenance`,
      detail: `${artifact.id} missing provenance (run_id/head_sha)`,
    });
  }
}

const freshnessArtifacts = [
  { id: 'master_checklist_metrics', report: masterChecklistMetricsStatus, requirePassStatus: false },
  { id: 'master_checklist_governance', report: masterChecklistGovernanceStatus, requirePassStatus: true },
  { id: 'master_parity_summary', report: masterParitySummaryStatus, requirePassStatus: false },
  { id: 'app_checklist_metrics', report: appChecklistMetricsStatus, requirePassStatus: false },
  { id: 'app_checklist_format', report: appChecklistFormatStatus, requirePassStatus: true },
  { id: 'openapi_metrics', report: openapiMetricsStatus, requirePassStatus: false },
  { id: 'release_rollout', report: releaseRolloutStatus, requirePassStatus: false },
  { id: 'mirror_agent_host_validation', report: mirrorAgentHostValidationStatus, requirePassStatus: false },
];

for (const artifact of freshnessArtifacts) {
  const report = artifact.report;
  if (!report || typeof report !== 'object') {
    blockingReasons.push({
      id: `${artifact.id}_missing`,
      detail: `missing docs/release/status artifact for ${artifact.id}`,
    });
    continue;
  }
  const artifactTimestamp = extractTimestampIso(report);
  const artifactAge = ageHours(artifactTimestamp);
  if (!(typeof artifactAge === 'number' && artifactAge <= apiArtifactMaxAgeHours)) {
    blockingReasons.push({
      id: `${artifact.id}_freshness`,
      detail: artifactTimestamp
        ? `${artifact.id} age=${(artifactAge || 0).toFixed(2)}h (max ${apiArtifactMaxAgeHours}h)`
        : `${artifact.id} missing/invalid timestamp`,
    });
  }
  if (artifact.requirePassStatus) {
    const artifactStatus = String(report.status || '').toLowerCase();
    if (artifactStatus !== 'pass') {
      blockingReasons.push({
        id: `${artifact.id}_status`,
        detail: `${artifact.id} status=${artifactStatus || 'unknown'} (expected pass)`,
      });
    }
  }
}

const strictDomainArtifacts = [
  { id: 'mobile_release_readiness', report: mobileReleaseReadinessStatus },
  {
    id: 'multi_device_validation',
    report: multiDeviceValidationStatus,
    statusResolver: (report) =>
      String((report && report.summary && report.summary.overall) || (report && report.status) || '').toLowerCase(),
  },
  { id: 'final_signoff', report: finalSignoffStatus },
  { id: 'release_rollout', report: releaseRolloutStatus },
];
if (shouldEnforceMirrorHostValidation) {
  strictDomainArtifacts.push({
    id: 'mirror_agent_host_validation',
    report: mirrorAgentHostValidationStatus,
    statusResolver: (report) =>
      String((report && report.summary && report.summary.overall) || (report && report.status) || '').toLowerCase(),
  });
}

for (const artifact of strictDomainArtifacts) {
  const report = artifact.report;
  if (!report || typeof report !== 'object') {
    blockingReasons.push({
      id: `${artifact.id}_missing`,
      detail: `missing docs/release/status artifact for ${artifact.id}`,
    });
    continue;
  }
  const artifactStatus = typeof artifact.statusResolver === 'function'
    ? String(artifact.statusResolver(report) || '').toLowerCase()
    : String(report.status || '').toLowerCase();
  if (artifactStatus !== 'pass') {
    blockingReasons.push({
      id: `${artifact.id}_status`,
      detail: `${artifact.id} status=${artifactStatus || 'unknown'} (expected pass)`,
    });
  }
}

const competitiveArtifacts = [
  { id: 'competitor_runtime_truth', report: competitorRuntimeTruthStatus, requireProvenance: true },
  { id: 'competitor_capability_proof', report: competitorCapabilityProofStatus, requireProvenance: true },
  { id: 'competitive_scorecard', report: competitiveScorecardStatus, requireProvenance: true },
  { id: 'competitive_program_completion', report: competitiveProgramCompletionStatus, requireProvenance: false },
];

for (const artifact of competitiveArtifacts) {
  const report = artifact.report;
  if (!report || typeof report !== 'object') {
    blockingReasons.push({
      id: `${artifact.id}_missing`,
      detail: `missing docs/release/status artifact for ${artifact.id}`,
    });
    continue;
  }
  const artifactStatus = String(report.status || '').toLowerCase();
  if (artifactStatus !== 'pass') {
    blockingReasons.push({
      id: `${artifact.id}_status`,
      detail: `${artifact.id} status=${artifactStatus || 'unknown'} (expected pass)`,
    });
  }
  const artifactTimestamp = extractTimestampIso(report);
  const artifactAge = ageHours(artifactTimestamp);
  if (!(typeof artifactAge === 'number' && artifactAge <= apiArtifactMaxAgeHours)) {
    blockingReasons.push({
      id: `${artifact.id}_freshness`,
      detail: artifactTimestamp
        ? `${artifact.id} age=${(artifactAge || 0).toFixed(2)}h (max ${apiArtifactMaxAgeHours}h)`
        : `${artifact.id} missing/invalid timestamp`,
    });
  }
  if (artifact.requireProvenance) {
    const provenance = report.provenance && typeof report.provenance === 'object' ? report.provenance : {};
    const runId = String(provenance.source_run_id || report.source_run_id || report.run_id || '').trim();
    const headSha = String(provenance.head_sha || report.head_sha || '').trim();
    if (!runId || !/^[a-f0-9]{7,40}$/i.test(headSha)) {
      blockingReasons.push({
        id: `${artifact.id}_provenance`,
        detail: `${artifact.id} missing provenance (source_run_id/head_sha)`,
      });
    }
  }
}

status.blocking_reasons = blockingReasons;
status.strict_evaluation = {
  would_fail: status.blocking_reasons.length > 0,
  reasons: status.blocking_reasons.map((reason) => ({
    id: reason.id,
    detail: reason.detail,
  })),
};
const domainStatusPass = (value) => String(value || '').trim().toLowerCase() === 'pass';
status.composite_release_readiness = {
  verdict:
    status.blocking_reasons.length === 0
    && domainStatusPass(status.mobile_release_readiness.status)
    && domainStatusPass(status.multi_device_validation.status)
    && domainStatusPass(status.final_signoff.status)
    && domainStatusPass(status.release_rollout.status)
    && domainStatusPass(status.competitive_program.program_completion_status)
    && (!shouldEnforceMirrorHostValidation || domainStatusPass(status.mirror_agent_host_validation.status))
      ? 'pass'
      : 'fail',
  dimensions: {
    strict_blockers_clear: status.blocking_reasons.length === 0,
    mobile_release_readiness_pass: domainStatusPass(status.mobile_release_readiness.status),
    multi_device_validation_pass: domainStatusPass(status.multi_device_validation.status),
    final_signoff_pass: domainStatusPass(status.final_signoff.status),
    release_rollout_pass: domainStatusPass(status.release_rollout.status),
    competitive_program_pass: domainStatusPass(status.competitive_program.program_completion_status),
    mirror_agent_host_validation_pass:
      !shouldEnforceMirrorHostValidation || domainStatusPass(status.mirror_agent_host_validation.status),
  },
};

const markdownLines = [];
markdownLines.push('# Release Status Snapshot');
markdownLines.push('');
markdownLines.push(`Generated: ${status.generated_at}`);
markdownLines.push('');
markdownLines.push(`- Checklist source present: ${status.source_validation.checklist_source_present ? 'true' : 'false'}`);
markdownLines.push(`- Comparison source present: ${status.source_validation.comparison_source_present ? 'true' : 'false'}`);
markdownLines.push(`- Comparison row schema valid: ${status.source_validation.comparison_row_schema_valid ? 'true' : 'false'}`);
markdownLines.push(
  `- Integration truthfulness test sources present: ${status.source_validation.integration_truthfulness_tests_present ? 'true' : 'false'}`
);
markdownLines.push(`- Checklist unchecked items: ${status.checklist.unchecked_count === null ? 'unknown' : status.checklist.unchecked_count}`);
markdownLines.push(`- Comparison unresolved feature rows: ${status.comparison.unresolved_feature_rows === null ? 'unknown' : status.comparison.unresolved_feature_rows}`);
markdownLines.push(`- Missing evidence files: ${status.evidence.missing_count}`);
markdownLines.push(
  `- D9 Keycloak interop CI gate: ${
    status.d9_keycloak_interop.ci_gate === null ? 'unknown' : status.d9_keycloak_interop.ci_gate ? 'pass' : 'fail'
  }`
);
markdownLines.push(
  `- D9 Keycloak interop local gate: ${status.d9_keycloak_interop.local_gate_status || 'unknown'}`
);
markdownLines.push(
  `- D9 Keycloak interop evidence check: ${status.d9_keycloak_interop.evidence_check_status || 'unknown'}`
);
markdownLines.push(
  `- D9 Keycloak interop preflight: ${status.d9_keycloak_interop.preflight_status || 'unknown'}`
);
markdownLines.push(
  `- D9 Keycloak local selfcheck: ${status.d9_keycloak_interop.local_selfcheck_status || 'unknown'}`
);
markdownLines.push(
  `- 72h soak CI gate: ${status.soak_72h.ci_gate === null ? 'unknown' : status.soak_72h.ci_gate ? 'pass' : 'fail'}`
);
markdownLines.push(`- 72h soak summary status: ${status.soak_72h.summary_status || 'unknown'}`);
markdownLines.push(`- API contract version status: ${status.api_contracts.contract_version_status || 'unknown'}`);
markdownLines.push(`- API OpenAPI contract status: ${status.api_contracts.openapi_contract_status || 'unknown'}`);
markdownLines.push(`- API request-schema coverage status: ${status.api_contracts.request_schema_coverage_status || 'unknown'}`);
markdownLines.push(`- Traceability matrix status: ${status.api_contracts.traceability_matrix_status || 'unknown'}`);
if (status.competitive_program) {
  const runtimeTruthAge =
    typeof status.competitive_program.runtime_truth_age_hours === 'number'
      ? status.competitive_program.runtime_truth_age_hours.toFixed(2)
      : 'unknown';
  const capabilityProofAge =
    typeof status.competitive_program.capability_proof_age_hours === 'number'
      ? status.competitive_program.capability_proof_age_hours.toFixed(2)
      : 'unknown';
  const scorecardAge =
    typeof status.competitive_program.scorecard_age_hours === 'number'
      ? status.competitive_program.scorecard_age_hours.toFixed(2)
      : 'unknown';
  const completionAge =
    typeof status.competitive_program.program_completion_age_hours === 'number'
      ? status.competitive_program.program_completion_age_hours.toFixed(2)
      : 'unknown';
  markdownLines.push(
    `- Competitive runtime truth: ${status.competitive_program.runtime_truth_status || 'unknown'} (age=${runtimeTruthAge}h, max=${apiArtifactMaxAgeHours}h)`
  );
  markdownLines.push(
    `- Competitor capability proof: ${status.competitive_program.capability_proof_status || 'unknown'} (age=${capabilityProofAge}h, max=${apiArtifactMaxAgeHours}h)`
  );
  markdownLines.push(
    `- Competitive scorecard: ${status.competitive_program.scorecard_status || 'unknown'} (age=${scorecardAge}h, max=${apiArtifactMaxAgeHours}h)`
  );
  markdownLines.push(
    `- Competitive program completion: ${status.competitive_program.program_completion_status || 'unknown'} (age=${completionAge}h, max=${apiArtifactMaxAgeHours}h)`
  );
}
if (status.release_rollout) {
  const rolloutAge =
    typeof status.release_rollout.age_hours === 'number'
      ? status.release_rollout.age_hours.toFixed(2)
      : 'unknown';
  markdownLines.push(
    `- Release rollout status: ${status.release_rollout.status || 'unknown'} (age=${rolloutAge}h, max=${status.release_rollout.max_age_hours}h)`
  );
}
if (status.mirror_agent_host_validation) {
  const hostValidationAge =
    typeof status.mirror_agent_host_validation.age_hours === 'number'
      ? status.mirror_agent_host_validation.age_hours.toFixed(2)
      : 'unknown';
  markdownLines.push(
    `- Mirror-agent host validation: ${status.mirror_agent_host_validation.status || 'unknown'} (age=${hostValidationAge}h, max=${status.mirror_agent_host_validation.max_age_hours}h)`
  );
}
if (status.mobile_release_readiness) {
  const mobileAge =
    typeof status.mobile_release_readiness.age_hours === 'number'
      ? status.mobile_release_readiness.age_hours.toFixed(2)
      : 'unknown';
  markdownLines.push(
    `- Mobile release readiness: ${status.mobile_release_readiness.status || 'unknown'} (age=${mobileAge}h, max=${status.mobile_release_readiness.max_age_hours}h)`
  );
}
if (status.multi_device_validation) {
  const multiDeviceAge =
    typeof status.multi_device_validation.age_hours === 'number'
      ? status.multi_device_validation.age_hours.toFixed(2)
      : 'unknown';
  markdownLines.push(
    `- Multi-device validation: ${status.multi_device_validation.status || 'unknown'} (age=${multiDeviceAge}h, max=${status.multi_device_validation.max_age_hours}h)`
  );
}
if (status.final_signoff) {
  const signoffAge =
    typeof status.final_signoff.age_hours === 'number'
      ? status.final_signoff.age_hours.toFixed(2)
      : 'unknown';
  markdownLines.push(
    `- Final signoff status: ${status.final_signoff.status || 'unknown'} (age=${signoffAge}h, max=${status.final_signoff.max_age_hours}h)`
  );
}
markdownLines.push(`- Composite release readiness: ${status.composite_release_readiness.verdict}`);
if (status.soak_72h.failures !== null && status.soak_72h.samples !== null) {
  markdownLines.push(`- 72h soak samples/failures: ${status.soak_72h.samples}/${status.soak_72h.failures}`);
}
if (status.soak_72h.expected_samples !== null) {
  markdownLines.push(`- 72h soak expected samples: ${status.soak_72h.expected_samples}`);
}
if (status.soak_72h.reason) {
  markdownLines.push(`- 72h soak reason: ${status.soak_72h.reason}`);
}
markdownLines.push('');

if (status.checklist.unchecked_count > 0) {
  markdownLines.push('## Remaining Checklist Items');
  markdownLines.push('');
  for (const item of status.checklist.unchecked_items) {
    markdownLines.push(`- L${item.line}: ${item.text}`);
  }
  markdownLines.push('');
}

if (status.evidence.missing_count > 0) {
  markdownLines.push('## Missing Evidence Files');
  markdownLines.push('');
  for (const rel of status.evidence.missing) {
    markdownLines.push(`- ${rel}`);
  }
  markdownLines.push('');
}

if (status.blocking_reasons.length > 0) {
  markdownLines.push('## Blocking Reasons');
  markdownLines.push('');
  for (const reason of status.blocking_reasons) {
    markdownLines.push(`- ${reason.id}: ${reason.detail}`);
  }
  markdownLines.push('');
}
if (status.strict_evaluation.would_fail) {
  markdownLines.push('## Strict Failure Reasons');
  markdownLines.push('');
  for (const reason of status.strict_evaluation.reasons) {
    markdownLines.push(`- ${reason.id}: ${reason.detail}`);
  }
  markdownLines.push('');
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'latest.json'), `${JSON.stringify(status, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, 'latest.md'), `${markdownLines.join('\n')}\n`);

console.log(JSON.stringify(status, null, 2));
console.log(`Wrote ${path.relative(root, path.join(outDir, 'latest.json'))}`);
console.log(`Wrote ${path.relative(root, path.join(outDir, 'latest.md'))}`);

if (!checklistPath || !comparisonPath) {
  process.exit(1);
}

if (strict) {
  const hasBlocking = status.blocking_reasons.length > 0;
  if (hasBlocking) {
    process.exit(1);
  }
}
