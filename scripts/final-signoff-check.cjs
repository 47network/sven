#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const localOnlyFlag = process.argv.includes('--local-only');
const localOnlyEnvRequested = process.env.FINAL_SIGNOFF_LOCAL_ONLY === '1';
const ciContext = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const localOnly = localOnlyFlag || (!ciContext && localOnlyEnvRequested);
const d9LocalReadinessCaller = process.env.SVEN_D9_LOCAL_READINESS_CALLER === '1';
const d9LocalReadinessCallerRunId = String(process.env.SVEN_D9_LOCAL_READINESS_RUN_ID || '').trim();
const d9LocalReadinessInFlight = process.env.SVEN_D9_LOCAL_READINESS_IN_FLIGHT === '1';
const ciGatesPath = path.join(root, 'docs', 'release', 'status', 'ci-gates.json');
const latestStatusPath = path.join(root, 'docs', 'release', 'status', 'latest.json');
const d9LocalReadinessPath = path.join(root, 'docs', 'release', 'status', 'd9-local-readiness-latest.json');
const d9LocalSelfcheckPath = path.join(root, 'docs', 'release', 'status', 'd9-keycloak-local-selfcheck-latest.json');
const mobileReadinessPath = path.join(root, 'docs', 'release', 'status', 'mobile-release-readiness-latest.json');
const multiDeviceValidationPath = path.join(root, 'docs', 'release', 'status', 'multi-device-validation-latest.json');
const finalDodE2ePath = path.join(root, 'docs', 'release', 'status', 'final-dod-e2e-latest.json');
const parityE2ePath = path.join(root, 'docs', 'release', 'status', 'parity-e2e-latest.json');
const ciRequiredChecksPath = path.join(
  root,
  'docs',
  'release',
  'status',
  localOnly ? 'ci-required-checks-local-only.json' : 'ci-required-checks-latest.json',
);
const skillQuarantineScanPath = path.join(root, 'docs', 'release', 'status', 'skill-quarantine-scan-latest.json');
const securityAuditUnifiedPath = path.join(root, 'docs', 'release', 'status', 'security-audit-unified-latest.json');
const dependencyVulnPath = path.join(root, 'docs', 'release', 'status', 'dependency-vuln-latest.json');
const securityTransportCspPath = path.join(root, 'docs', 'release', 'status', 'security-transport-csp-latest.json');
const securityAuthSurfacePath = path.join(root, 'docs', 'release', 'status', 'security-auth-surface-latest.json');
const securityPlaintextSecretsPath = path.join(root, 'docs', 'release', 'status', 'security-plaintext-secrets-latest.json');
const securityImageSigningPath = path.join(root, 'docs', 'release', 'status', 'security-image-signing-latest.json');
const securityReleaseArtifactSbomPath = path.join(root, 'docs', 'release', 'status', 'security-release-artifact-sbom-latest.json');
const securitySbomCosignPath = path.join(root, 'docs', 'release', 'status', 'security-sbom-cosign-latest.json');
const thirdChecklistIntegrationPath = path.join(root, 'docs', 'release', 'status', 'third-checklist-integration-latest.json');
const finalDodExecutionPath = path.join(root, 'docs', 'release', 'status', 'final-dod-execution-latest.json');
const uiE2ePath = path.join(root, 'docs', 'release', 'status', 'ui-e2e-latest.json');
const backupRestoreApiPath = path.join(root, 'docs', 'release', 'status', 'backup-restore-api-e2e-latest.json');
const mobileDeviceFarmPath = path.join(root, 'docs', 'release', 'status', 'mobile-device-farm-latest.json');
const mobileDeviceFarmConfigPath = path.join(root, 'docs', 'release', 'status', 'mobile-device-farm-config-latest.json');
const mobileLegalUrlsPath = path.join(root, 'docs', 'release', 'status', 'mobile-legal-urls-latest.json');
const mobileC8IndexPath = path.join(root, 'docs', 'release', 'status', 'mobile-c8-index-latest.json');
const mobileReleaseSigningPath = path.join(root, 'docs', 'release', 'status', 'mobile-release-signing-latest.json');
const mobileAppStorePrivacyPath = path.join(root, 'docs', 'release', 'status', 'mobile-app-store-privacy-latest.json');
const resumableStreamPath = path.join(root, 'docs', 'release', 'status', 'resumable-stream-latest.json');
const webEgressSecurityPath = path.join(root, 'docs', 'release', 'status', 'web-egress-security-latest.json');
const seedBaselinePath = path.join(root, 'docs', 'release', 'status', 'seed-baseline-latest.json');
const apiContractVersionPath = path.join(root, 'docs', 'release', 'status', 'api-contract-version-latest.json');
const apiOpenapiContractPath = path.join(root, 'docs', 'release', 'status', 'api-openapi-contract-latest.json');
const apiRequestSchemaCoveragePath = path.join(root, 'docs', 'release', 'status', 'api-request-body-schema-coverage-latest.json');
const apiReliabilityObservabilityPath = path.join(root, 'docs', 'release', 'status', 'api-reliability-observability-latest.json');
const benchmarkSuitePath = path.join(root, 'docs', 'release', 'status', 'benchmark-suite-latest.json');
const competitorRuntimeGuardPath = path.join(root, 'docs', 'release', 'status', 'competitor-runtime-guard-latest.json');
const quickstartInstallerCrosshostPath = path.join(root, 'docs', 'release', 'status', 'quickstart-installer-crosshost-latest.json');
const quickstartInstallerRuntimePath = path.join(root, 'docs', 'release', 'status', 'quickstart-installer-runtime-latest.json');
const competitorBenchmarkIntegrityPath = path.join(root, 'docs', 'release', 'status', 'competitor-benchmark-integrity-latest.json');
const sastPath = path.join(root, 'docs', 'release', 'status', 'sast-latest.json');
const releaseEvidenceBundlePath = path.join(root, 'docs', 'release', 'status', 'release-evidence-bundle-latest.json');
const runbookScenarioMatrixPath = path.join(root, 'docs', 'release', 'status', 'runbook-scenario-matrix-latest.json');
const stagingMigrationVerificationPath = path.join(root, 'docs', 'release', 'status', 'staging-migration-verification-latest.json');
const featureFlagGovernancePath = path.join(root, 'docs', 'release', 'status', 'feature-flag-governance-latest.json');
const soakHardwareEvidencePath = path.join(root, 'docs', 'release', 'status', 'soak-hardware-evidence-latest.json');
const releaseCandidatePackagePath = path.join(root, 'docs', 'release', 'status', 'release-candidate-package-latest.json');
const releaseOpsDrillPath = path.join(root, 'docs', 'release', 'status', 'release-ops-drill-latest.json');
const externalInputResolutionPath = path.join(root, 'docs', 'release', 'status', 'external-input-resolution-latest.json');
const operabilityAuthSuitePath = path.join(root, 'docs', 'release', 'status', 'operability-auth-suite-latest.json');
const adminRbacPenetrationPath = path.join(root, 'docs', 'release', 'status', 'admin-rbac-penetration-latest.json');
const performanceE2ePath = path.join(root, 'docs', 'release', 'status', 'performance-e2e-latest.json');
const csrfAuthE2ePath = path.join(root, 'docs', 'release', 'status', 'csrf-auth-e2e-latest.json');
const mobileReadinessMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_MOBILE_MAX_AGE_HOURS || 72);
const multiDeviceValidationMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_MULTI_DEVICE_MAX_AGE_HOURS || 168);
const finalDodE2eMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_FINAL_DOD_E2E_MAX_AGE_HOURS || 72);
const parityE2eMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_PARITY_E2E_MAX_AGE_HOURS || 72);
const ciRequiredChecksMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_CI_REQUIRED_CHECKS_MAX_AGE_HOURS || 72);
const ciGatesMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_CI_GATES_MAX_AGE_HOURS || 72);
const skillQuarantineScanMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_SKILL_QUARANTINE_SCAN_MAX_AGE_HOURS || 72);
const skillQuarantineScanMaxSkipped = Number(process.env.SVEN_FINAL_SIGNOFF_SKILL_QUARANTINE_SCAN_MAX_SKIPPED || 0);
const securityAuditUnifiedMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_SECURITY_AUDIT_UNIFIED_MAX_AGE_HOURS || 72);
const dependencyVulnMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_DEPENDENCY_VULN_MAX_AGE_HOURS || 72);
const securityTransportCspMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_SECURITY_TRANSPORT_CSP_MAX_AGE_HOURS || 72);
const securityAuthSurfaceMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_SECURITY_AUTH_SURFACE_MAX_AGE_HOURS || 72);
const securityPlaintextSecretsMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_SECURITY_PLAINTEXT_SECRETS_MAX_AGE_HOURS || 72);
const securityImageSigningMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_SECURITY_IMAGE_SIGNING_MAX_AGE_HOURS || 72);
const securityReleaseArtifactSbomMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_SECURITY_RELEASE_ARTIFACT_SBOM_MAX_AGE_HOURS || 72);
const securitySbomCosignMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_SECURITY_SBOM_COSIGN_MAX_AGE_HOURS || 72);
const thirdChecklistIntegrationMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_THIRD_CHECKLIST_INTEGRATION_MAX_AGE_HOURS || 72);
const finalDodExecutionMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_FINAL_DOD_EXECUTION_MAX_AGE_HOURS || 72);
const uiE2eMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_UI_E2E_MAX_AGE_HOURS || 72);
const uiE2eMinProjectTests = Number(process.env.SVEN_FINAL_SIGNOFF_UI_E2E_MIN_PROJECT_TESTS || 2);
const uiE2eMinTotalTests = Number(process.env.SVEN_FINAL_SIGNOFF_UI_E2E_MIN_TOTAL_TESTS || 6);
const uiE2eMinAdminEndpointFlows = Number(process.env.SVEN_FINAL_SIGNOFF_UI_E2E_MIN_ADMIN_ENDPOINT_FLOWS || 2);
const backupRestoreApiMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_BACKUP_RESTORE_API_MAX_AGE_HOURS || 72);
const backupRestoreApiMinExecutedTests = Number(process.env.SVEN_FINAL_SIGNOFF_BACKUP_RESTORE_API_MIN_EXECUTED_TESTS || 3);
const mobileDeviceFarmMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_MOBILE_DEVICE_FARM_MAX_AGE_HOURS || 72);
const mobileDeviceFarmConfigMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_MOBILE_DEVICE_FARM_CONFIG_MAX_AGE_HOURS || 72);
const mobileLegalUrlsMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_MOBILE_LEGAL_URLS_MAX_AGE_HOURS || 72);
const mobileC8IndexMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_MOBILE_C8_INDEX_MAX_AGE_HOURS || 72);
const mobileReleaseSigningMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_MOBILE_RELEASE_SIGNING_MAX_AGE_HOURS || 72);
const mobileAppStorePrivacyMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_MOBILE_APP_STORE_PRIVACY_MAX_AGE_HOURS || 72);
const resumableStreamMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_RESUMABLE_STREAM_MAX_AGE_HOURS || 72);
const webEgressSecurityMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_WEB_EGRESS_MAX_AGE_HOURS || 72);
const seedBaselineMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_SEED_BASELINE_MAX_AGE_HOURS || 72);
const apiContractVersionMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_API_CONTRACT_VERSION_MAX_AGE_HOURS || 72);
const apiOpenapiContractMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_API_OPENAPI_CONTRACT_MAX_AGE_HOURS || 72);
const apiRequestSchemaCoverageMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_API_REQUEST_SCHEMA_MAX_AGE_HOURS || 72);
const apiReliabilityObservabilityMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_API_RELIABILITY_MAX_AGE_HOURS || 72);
const benchmarkSuiteMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_BENCHMARK_SUITE_MAX_AGE_HOURS || 72);
const competitorRuntimeGuardMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_COMPETITOR_RUNTIME_GUARD_MAX_AGE_HOURS || 72);
const quickstartInstallerCrosshostMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_QUICKSTART_INSTALLER_CROSSHOST_MAX_AGE_HOURS || 72);
const quickstartInstallerRuntimeMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_QUICKSTART_INSTALLER_RUNTIME_MAX_AGE_HOURS || 72);
const competitorBenchmarkIntegrityMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_COMPETITOR_BENCHMARK_INTEGRITY_MAX_AGE_HOURS || 168);
const sastMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_SAST_MAX_AGE_HOURS || 72);
const releaseEvidenceBundleMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_RELEASE_EVIDENCE_BUNDLE_MAX_AGE_HOURS || 72);
const runbookScenarioMatrixMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_RUNBOOK_SCENARIO_MATRIX_MAX_AGE_HOURS || 168);
const stagingMigrationVerificationMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_STAGING_MIGRATION_VERIFICATION_MAX_AGE_HOURS || 72);
const featureFlagGovernanceMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_FEATURE_FLAG_GOVERNANCE_MAX_AGE_HOURS || 72);
const soakHardwareEvidenceMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_SOAK_HARDWARE_EVIDENCE_MAX_AGE_HOURS || 168);
const releaseCandidatePackageMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_RC_PACKAGE_MAX_AGE_HOURS || 72);
const releaseOpsDrillMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_RELEASE_OPS_DRILL_MAX_AGE_HOURS || 72);
const externalInputResolutionMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_EXTERNAL_INPUT_RESOLUTION_MAX_AGE_HOURS || 168);
const operabilityAuthSuiteMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_OPERABILITY_AUTH_SUITE_MAX_AGE_HOURS || 72);
const adminRbacPenetrationMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_ADMIN_RBAC_PENETRATION_MAX_AGE_HOURS || 72);
const performanceE2eMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_PERFORMANCE_E2E_MAX_AGE_HOURS || 72);
const csrfAuthE2eMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_CSRF_AUTH_E2E_MAX_AGE_HOURS || 72);
const signoffMaxAgeHours = Number(process.env.SVEN_FINAL_SIGNOFF_MAX_AGE_HOURS || 168);
const signoffApprovalTtlHours = Number(process.env.SVEN_FINAL_SIGNOFF_APPROVAL_TTL_HOURS || 168);
const expectedReleaseId = String(process.env.SVEN_RELEASE_ID || '').trim();
const mobileReleaseScopePath = path.join(root, 'config', 'release', 'mobile-release-scope.json');
const finalSignoffProfileRequested = String(process.env.SVEN_FINAL_SIGNOFF_PROFILE || '').trim().toLowerCase();
const DEFAULT_SIGNOFF_REQUIRED_FIELDS = [
  'date',
  'approver',
  'status',
  'release_id',
  'head_sha',
  'artifact_manifest_hash',
  'expires_at',
  'staging_evidence_url',
  'dashboard_url',
];
const signoffDir = path.join(root, 'docs', 'release', 'signoffs');
const signoffManifestPath = path.join(root, 'config', 'release', 'signoff-manifest.json');
function loadSignoffManifest() {
  const fallbackRoles = [
    { id: 'engineering', label: 'Engineering', filename_pattern: '^engineering-signoff-(\\d{4}-\\d{2}-\\d{2})(?:-[a-z0-9-]+)?\\.md$' },
    { id: 'security', label: 'Security', filename_pattern: '^security-signoff-(\\d{4}-\\d{2}-\\d{2})(?:-[a-z0-9-]+)?\\.md$' },
    { id: 'operations', label: 'Operations', filename_pattern: '^operations-signoff-(\\d{4}-\\d{2}-\\d{2})(?:-[a-z0-9-]+)?\\.md$' },
    { id: 'product', label: 'Product', filename_pattern: '^product-signoff-(\\d{4}-\\d{2}-\\d{2})(?:-[a-z0-9-]+)?\\.md$' },
    { id: 'release_owner', label: 'Release owner', filename_pattern: '^release-owner-approval-(\\d{4}-\\d{2}-\\d{2})(?:-[a-z0-9-]+)?\\.md$' },
  ];
  if (!fs.existsSync(signoffManifestPath)) {
    return {
      source: 'fallback',
      required_fields: DEFAULT_SIGNOFF_REQUIRED_FIELDS,
      roles: fallbackRoles,
    };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(signoffManifestPath, 'utf8').replace(/^\uFEFF/, ''));
    const rolesRaw = Array.isArray(parsed?.roles) ? parsed.roles : [];
    const roles = rolesRaw
      .map((entry) => ({
        id: String(entry?.id || '').trim(),
        label: String(entry?.label || '').trim(),
        filename_pattern: String(entry?.filename_pattern || '').trim(),
      }))
      .filter((entry) => entry.id && entry.filename_pattern);
    if (!roles.length) {
      return {
        source: 'fallback',
        required_fields: DEFAULT_SIGNOFF_REQUIRED_FIELDS,
        roles: fallbackRoles,
      };
    }
    return {
      source: path.relative(root, signoffManifestPath).replace(/\\/g, '/'),
      required_fields: Array.isArray(parsed?.required_fields)
        ? parsed.required_fields.map((value) => String(value || '').trim()).filter(Boolean)
        : DEFAULT_SIGNOFF_REQUIRED_FIELDS,
      roles,
    };
  } catch {
    return {
      source: 'fallback',
      required_fields: DEFAULT_SIGNOFF_REQUIRED_FIELDS,
      roles: fallbackRoles,
    };
  }
}

const signoffManifest = loadSignoffManifest();
const SIGNOFF_REQUIRED_FIELDS = signoffManifest.required_fields.length
  ? signoffManifest.required_fields
  : DEFAULT_SIGNOFF_REQUIRED_FIELDS;
const SIGNOFF_ROLES = signoffManifest.roles.map((role) => ({
  id: role.id,
  label: role.label || role.id,
  pattern: new RegExp(role.filename_pattern, 'i'),
}));

function read(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function parseSignoffFields(md) {
  const fields = {};
  if (!md) return fields;
  const lines = String(md).split(/\r?\n/);
  for (const rawLine of lines) {
    const line = String(rawLine || '').trim();
    if (!line || line.startsWith('#') || line.startsWith('-')) continue;
    const match = line.match(/^([a-z_]+)\s*:\s*(.+)$/i);
    if (!match) continue;
    const key = String(match[1] || '').trim().toLowerCase();
    const value = String(match[2] || '').trim();
    if (!value) continue;
    if (!Object.prototype.hasOwnProperty.call(fields, key)) {
      fields[key] = value;
    }
  }
  return fields;
}

function isPlaceholderApprover(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  const blocked = [
    'tbd',
    'todo',
    'approver',
    'your name',
    'name here',
    'n/a',
    'na',
    'unknown',
    'example',
  ];
  return blocked.some((token) => normalized === token || normalized.includes(token));
}

function isStrictDateValue(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return !Number.isNaN(Date.parse(`${text}T00:00:00Z`));
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(text)) return !Number.isNaN(Date.parse(text));
  return false;
}

function isEvidenceLinkValue(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/^https?:\/\//i.test(text)) return true;
  if (text.startsWith('docs/')) return true;
  return false;
}

function isLikelyHash(value, minLength = 16) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (text.length < minLength) return false;
  return /^[a-f0-9]+$/i.test(text);
}

function extractTimestampIso(value) {
  if (!value || typeof value !== 'object') return null;
  const keys = ['generated_at', 'at_utc', 'validated_at', 'updated_at', 'created_at', 'timestamp'];
  for (const key of keys) {
    const raw = value[key];
    if (!raw) continue;
    const parsed = Date.parse(String(raw));
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return null;
}

function ageHours(timestampIso) {
  if (!timestampIso) return null;
  const parsed = Date.parse(timestampIso);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
}

function evaluateD9LocalSelfcheckArtifact(report) {
  if (!report || typeof report !== 'object') {
    return {
      valid: false,
      status: 'invalid',
      hardeningRiskDetected: false,
      hardeningRiskCodes: [],
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

  const hardeningRiskDetected = Boolean(report?.hardening_risks?.risk_detected);
  const hardeningRiskCodes = Array.isArray(report?.hardening_risks?.codes)
    ? report.hardening_risks.codes
    : [];

  return {
    valid: issues.length === 0,
    status: issues.length === 0 ? String(report.status || 'unknown').toLowerCase() : 'invalid',
    hardeningRiskDetected,
    hardeningRiskCodes,
    detail: issues.length ? issues.join('; ') : 'validated strict D9 local selfcheck artifact',
  };
}

function parseSignoffTimestamp(body, relPath) {
  const fields = parseSignoffFields(body);
  const dateField = String(fields.date || '');
  if (dateField) {
    const parsed = Date.parse(dateField);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return null;
}

function resolveLatestSignoff(role) {
  if (!fs.existsSync(signoffDir)) return null;
  const files = fs.readdirSync(signoffDir).filter((name) => role.pattern.test(name));
  if (!files.length) return null;
  files.sort((a, b) => a.localeCompare(b)).reverse();
  const selected = files[0];
  let approvedSelected = null;
  for (const candidate of files) {
    const rel = `docs/release/signoffs/${candidate}`;
    let body = '';
    try {
      body = read(rel);
    } catch {
      continue;
    }
    const fields = parseSignoffFields(body);
    const statusValue = String(fields.status || fields.approval || '').trim().toLowerCase();
    if (statusValue === 'approved') {
      approvedSelected = candidate;
      break;
    }
  }
  const selectedName = approvedSelected || selected;
  return {
    name: selectedName,
    rel: `docs/release/signoffs/${selectedName}`,
    selection: approvedSelected ? 'latest_approved' : 'latest_by_filename',
  };
}

function readMobileReleaseScope() {
  if (!fs.existsSync(mobileReleaseScopePath)) return 'android-and-ios';
  try {
    const parsed = JSON.parse(fs.readFileSync(mobileReleaseScopePath, 'utf8').replace(/^\uFEFF/, ''));
    return String(parsed?.scope || 'android-and-ios').trim().toLowerCase() || 'android-and-ios';
  } catch {
    return 'android-and-ios';
  }
}

function resolveFinalSignoffProfile() {
  if (finalSignoffProfileRequested) return finalSignoffProfileRequested;
  const scope = readMobileReleaseScope();
  if (scope === 'android-only') return 'android-mobile-rc';
  return 'full';
}

function run() {
  const finalSignoffProfile = resolveFinalSignoffProfile();
  const checks = [];
  const validationScope = localOnly ? 'local_only' : 'ci_remote';
  const validationAuthority = localOnly ? 'local_diagnostic' : 'release_authoritative';
  checks.push({
    id: 'validation_scope_declared',
    pass: validationScope === 'local_only' || validationScope === 'ci_remote',
    detail: `validation_scope=${validationScope}`,
  });
  checks.push({
    id: 'validation_scope_release_workflow_safe',
    pass: !(localOnly && ciContext),
    detail:
      localOnly && ciContext
        ? 'local_only validation scope is forbidden in CI/release workflow contexts'
        : `ok (validation_scope=${validationScope}; ci_context=${String(ciContext)})`,
  });
  checks.push({
    id: 'mode_local_only_disallowed_in_strict',
    pass: !(strict && localOnly),
    detail:
      strict && localOnly
        ? 'strict mode requires CI-backed validation; local-only mode is not allowed'
        : `ok (strict=${String(strict)} local_only=${String(localOnly)})`,
  });
  checks.push({
    id: 'mode_env_local_only_disallowed_in_strict',
    pass: !(strict && localOnlyEnvRequested && !localOnlyFlag),
    detail:
      strict && localOnlyEnvRequested && !localOnlyFlag
        ? 'strict mode forbids env-driven local-only; use explicit --local-only for diagnostics'
        : `ok (strict=${String(strict)} env_local_only=${String(localOnlyEnvRequested)} cli_local_only=${String(localOnlyFlag)} ci_context=${String(ciContext)})`,
  });
  const signoffRecords = [];
  for (const role of SIGNOFF_ROLES) {
    const selected = resolveLatestSignoff(role);
    const selectedRel = selected ? selected.rel : '';
    const body = selectedRel ? read(selectedRel) : '';
    checks.push({
      id: `signoff_doc_selected_latest:${role.id}`,
      pass: Boolean(selectedRel),
      detail: selectedRel
        ? `${selectedRel} (${String(selected.selection || 'latest_by_filename')})`
        : `no file matched ${role.pattern}`,
    });
    checks.push({
      id: `signoff_doc_present:${role.id}`,
      pass: Boolean(body),
      detail: selectedRel || `docs/release/signoffs/${role.id} (unresolved)`,
    });
    const signoffFields = parseSignoffFields(body);
    signoffRecords.push({ role, fields: signoffFields });
    const hasSchema = SIGNOFF_REQUIRED_FIELDS
      .every((key) => Boolean(signoffFields[key]));
    const approverValue = String(signoffFields.approver || '');
    const dateValue = String(signoffFields.date || '');
    const statusValue = String(signoffFields.status || signoffFields.approval || '').trim().toLowerCase();
    checks.push({
      id: `signoff_schema_valid:${role.id}`,
      pass: hasSchema,
      detail: hasSchema
        ? `required fields present (${SIGNOFF_REQUIRED_FIELDS.join(', ')})`
        : 'missing required signoff fields',
    });
    checks.push({
      id: `signoff_has_approver_and_date:${role.id}`,
      pass: Boolean(approverValue) && Boolean(dateValue),
      detail: 'approver/date fields present',
    });
    checks.push({
      id: `signoff_status_approved:${role.id}`,
      pass: statusValue === 'approved',
      detail: `status=${statusValue || '(missing)'}`,
    });
    checks.push({
      id: `signoff_approver_valid:${role.id}`,
      pass: Boolean(approverValue) && !isPlaceholderApprover(approverValue),
      detail: approverValue ? `approver=${approverValue}` : 'missing approver',
    });
    checks.push({
      id: `signoff_date_format_valid:${role.id}`,
      pass: isStrictDateValue(dateValue),
      detail: dateValue ? `date=${dateValue}` : 'missing date',
    });
    const stagingEvidenceUrl = String(signoffFields.staging_evidence_url || '');
    const dashboardUrl = String(signoffFields.dashboard_url || '');
    checks.push({
      id: `signoff_staging_evidence_link_valid:${role.id}`,
      pass: isEvidenceLinkValue(stagingEvidenceUrl),
      detail: stagingEvidenceUrl ? `staging_evidence_url=${stagingEvidenceUrl}` : 'missing staging_evidence_url',
    });
    checks.push({
      id: `signoff_dashboard_link_valid:${role.id}`,
      pass: isEvidenceLinkValue(dashboardUrl),
      detail: dashboardUrl ? `dashboard_url=${dashboardUrl}` : 'missing dashboard_url',
    });
    const signoffTimestamp = selectedRel ? parseSignoffTimestamp(body, selectedRel) : null;
    const signoffAge = ageHours(signoffTimestamp);
    const signoffFresh = typeof signoffAge === 'number' && signoffAge <= signoffMaxAgeHours;
    checks.push({
      id: `signoff_fresh:${role.id}`,
      pass: signoffFresh,
      detail: signoffFresh
        ? `${signoffAge.toFixed(2)}h <= ${signoffMaxAgeHours}h`
        : signoffTimestamp
          ? `${(signoffAge || 0).toFixed(2)}h > ${signoffMaxAgeHours}h`
          : 'missing/invalid date field',
    });
    const releaseValue = String(signoffFields.release_id || signoffFields.release || '');
    checks.push({
      id: `signoff_release_binding:${role.id}`,
      pass: !expectedReleaseId || (releaseValue && releaseValue === expectedReleaseId),
      detail: expectedReleaseId
        ? `expected=${expectedReleaseId}; observed=${releaseValue || '(missing)'}`
        : `release check skipped (SVEN_RELEASE_ID not set; observed=${releaseValue || '(missing)'})`,
    });
    const signoffHeadSha = String(signoffFields.head_sha || '').trim();
    checks.push({
      id: `signoff_head_sha_format_valid:${role.id}`,
      pass: /^[a-f0-9]{7,64}$/i.test(signoffHeadSha),
      detail: signoffHeadSha ? `head_sha=${signoffHeadSha}` : 'missing head_sha',
    });
    const signoffArtifactManifestHash = String(signoffFields.artifact_manifest_hash || '').trim();
    checks.push({
      id: `signoff_artifact_manifest_hash_format_valid:${role.id}`,
      pass: isLikelyHash(signoffArtifactManifestHash),
      detail: signoffArtifactManifestHash
        ? `artifact_manifest_hash=${signoffArtifactManifestHash}`
        : 'missing artifact_manifest_hash',
    });
    const expiresAt = String(signoffFields.expires_at || '').trim();
    const expiresParsed = Date.parse(expiresAt);
    const signoffDateParsed = Date.parse(dateValue);
    const expiresFormatValid = Boolean(expiresAt) && !Number.isNaN(expiresParsed);
    checks.push({
      id: `signoff_expires_at_format_valid:${role.id}`,
      pass: expiresFormatValid,
      detail: expiresAt || 'missing expires_at',
    });
    const notExpired = expiresFormatValid && expiresParsed >= Date.now();
    checks.push({
      id: `signoff_not_expired:${role.id}`,
      pass: notExpired,
      detail: notExpired
        ? `expires_at=${new Date(expiresParsed).toISOString()}`
        : expiresFormatValid
          ? `expired_at=${new Date(expiresParsed).toISOString()}`
          : 'missing/invalid expires_at',
    });
    const withinTtl = expiresFormatValid
      && !Number.isNaN(signoffDateParsed)
      && ((expiresParsed - signoffDateParsed) / (1000 * 60 * 60)) <= signoffApprovalTtlHours;
    checks.push({
      id: `signoff_expiry_within_ttl:${role.id}`,
      pass: withinTtl,
      detail: withinTtl
        ? `expiry_window<=${signoffApprovalTtlHours}h`
        : `expiry_window>${signoffApprovalTtlHours}h or invalid date/expires_at`,
    });
  }

  let ciGates = null;
  if (fs.existsSync(ciGatesPath)) {
    try {
      ciGates = JSON.parse(fs.readFileSync(ciGatesPath, 'utf8'));
      checks.push({
        id: 'ci_gates_file_valid_json',
        pass: true,
        detail: 'docs/release/status/ci-gates.json parsed',
      });
    } catch (err) {
      checks.push({
        id: 'ci_gates_file_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'ci_gates_file_present',
      pass: false,
      detail: 'docs/release/status/ci-gates.json missing',
    });
  }

  if (ciGates && typeof ciGates === 'object') {
    const ciGatesTimestamp = extractTimestampIso(ciGates);
    const ciGatesAge = ageHours(ciGatesTimestamp);
    const ciDerivedKeys = [
      'final_dod_ci',
      'parity_e2e_ci',
      'parity_checklist_verify_ci',
      'agent_zero_parity_verify_ci',
      'websocket_contract_ci',
      'mcp_server_compat_ci',
      'a2a_compat_ci',
      'release_ops_drill_ci',
      'd9_keycloak_interop_ci',
      'mobile_auth_session_smoke_ci',
      'mobile_release_readiness_ci',
      'backup_restore_api_ci',
      'flutter_user_app_device_farm_ci',
      'desktop_release_ci',
      'ui_e2e_ci',
      'mobile_coverage_gate_ci',
      'csrf_auth_e2e_ci',
      'client_env_governance_ci',
      'backend_capability_e2e_ci',
      'security_privacy_governance_ci',
      'privacy_admin_e2e_ci',
      'ops_shell_ci',
      'skill_quarantine_scan_ci',
      'security_audit_unified_ci',
      'security_baseline_ci',
    ];
    const sourceBranch = String(ciGates.source_branch || '').trim();
    const sourceHeadSha = String(ciGates.source_head_sha || '').trim();
    const gateProvenance = (ciGates.gate_provenance && typeof ciGates.gate_provenance === 'object')
      ? ciGates.gate_provenance
      : null;
    const requiredWorkflowGates = (ciGates.required_workflow_gates && typeof ciGates.required_workflow_gates === 'object')
      ? ciGates.required_workflow_gates
      : null;
    const manualOverrides = (ciGates.manual_overrides && typeof ciGates.manual_overrides === 'object')
      ? ciGates.manual_overrides
      : null;
    const opsShellCiRequired = ciGates.ops_shell_ci_required === true;
    checks.push({
      id: 'ci_gates_fresh',
      pass: localOnly ? true : (typeof ciGatesAge === 'number' && ciGatesAge <= ciGatesMaxAgeHours),
      detail: localOnly
        ? `local-only mode (age=${ciGatesAge === null ? '(missing)' : `${ciGatesAge.toFixed(2)}h`})`
        : (typeof ciGatesAge === 'number'
          ? `${ciGatesAge.toFixed(2)}h <= ${ciGatesMaxAgeHours}h`
          : 'missing/invalid timestamp'),
    });
    checks.push({
      id: 'ci_gates_source_provenance_present',
      pass: localOnly ? true : (Boolean(sourceBranch) && /^[a-f0-9]{7,40}$/i.test(sourceHeadSha)),
      detail: localOnly
        ? `local-only mode (source_branch=${sourceBranch || '(missing)'}; source_head_sha=${sourceHeadSha || '(missing)'})`
        : `source_branch=${sourceBranch || '(missing)'}; source_head_sha=${sourceHeadSha || '(missing)'}`,
    });
    checks.push({
      id: 'ci_gates_gate_provenance_object_present',
      pass: localOnly ? true : Boolean(gateProvenance),
      detail: gateProvenance
        ? `gate_provenance keys=${Object.keys(gateProvenance).length}`
        : 'missing gate_provenance object',
    });
    checks.push({
      id: 'ci_gates_required_workflow_gates_present',
      pass: localOnly ? true : Boolean(requiredWorkflowGates),
      detail: requiredWorkflowGates
        ? `required_workflow_gates keys=${Object.keys(requiredWorkflowGates).length}`
        : 'missing required_workflow_gates object',
    });
    checks.push({
      id: 'ops_shell_ci_requirement_declared',
      pass: localOnly ? true : typeof ciGates.ops_shell_ci_required === 'boolean',
      detail: `ops_shell_ci_required=${String(ciGates.ops_shell_ci_required)}`,
    });
    for (const record of signoffRecords) {
      const signoffHeadSha = String(record.fields.head_sha || '').trim();
      checks.push({
        id: `signoff_head_sha_binding:${record.role.id}`,
        pass: localOnly || !sourceHeadSha || (Boolean(signoffHeadSha) && signoffHeadSha === sourceHeadSha),
        detail: localOnly
          ? `local-only mode (signoff_head_sha=${signoffHeadSha || '(missing)'}; source_head_sha=${sourceHeadSha || '(missing)'})`
          : `signoff_head_sha=${signoffHeadSha || '(missing)'}; source_head_sha=${sourceHeadSha || '(missing)'}`,
      });
    }

    if (gateProvenance && !localOnly) {
      const workflowDerivedGateKeys = new Set(
        requiredWorkflowGates
          ? Object.values(requiredWorkflowGates)
            .filter((entry) => entry && typeof entry === 'object' && typeof entry.gate_key === 'string')
            .map((entry) => String(entry.gate_key))
          : [],
      );
      for (const key of ciDerivedKeys) {
        const provenance = gateProvenance[key];
        const runId = String(provenance?.run_id || '').trim();
        const headSha = String(provenance?.head_sha || '').trim();
        checks.push({
          id: `ci_gate_provenance:${key}`,
          pass: Boolean(runId) && /^[a-f0-9]{7,40}$/i.test(headSha),
          detail: `run_id=${runId || '(missing)'}; head_sha=${headSha || '(missing)'}`,
        });
        checks.push({
          id: `ci_gate_provenance_source_sha_match:${key}`,
          pass: Boolean(headSha) && Boolean(sourceHeadSha) && headSha === sourceHeadSha,
          detail: `gate_head_sha=${headSha || '(missing)'}; source_head_sha=${sourceHeadSha || '(missing)'}`,
        });
        const manualOverride = manualOverrides ? manualOverrides[key] : null;
        checks.push({
          id: `ci_gate_manual_override_absent:${key}`,
          pass: !manualOverride,
          detail: manualOverride
            ? `manual override present (updated_at=${String(manualOverride.updated_at || '(missing)')})`
            : 'no manual override',
        });
        const requiredWorkflowBinding = requiredWorkflowGates
          ? Object.values(requiredWorkflowGates).find((entry) => entry && typeof entry === 'object' && entry.gate_key === key)
          : null;
        checks.push({
          id: `ci_gate_required_workflow_binding:${key}`,
          pass: !workflowDerivedGateKeys.has(key) || Boolean(requiredWorkflowBinding),
          detail: !workflowDerivedGateKeys.has(key)
            ? 'not a required-workflow-derived gate'
            : requiredWorkflowBinding
              ? `workflow=${String(requiredWorkflowBinding.provenance?.workflow_name || '(missing)')}`
              : 'no required_workflow_gates entry for gate key',
        });
        if (workflowDerivedGateKeys.has(key) && requiredWorkflowBinding) {
          checks.push({
            id: `ci_gate_required_workflow_value_consistent:${key}`,
            pass: requiredWorkflowBinding.pass === Boolean(ciGates[key]),
            detail: `required_workflow_gates.pass=${String(requiredWorkflowBinding.pass)}; ci_gates.${key}=${String(ciGates[key])}`,
          });
          const bindingHeadSha = String(requiredWorkflowBinding?.provenance?.head_sha || '').trim();
          checks.push({
            id: `ci_gate_required_workflow_source_sha_match:${key}`,
            pass: Boolean(bindingHeadSha) && Boolean(sourceHeadSha) && bindingHeadSha === sourceHeadSha,
            detail: `workflow_gate_head_sha=${bindingHeadSha || '(missing)'}; source_head_sha=${sourceHeadSha || '(missing)'}`,
          });
        }
      }
    }

    const ciGateChecks = [
      ['final_dod_ci', 'final_dod_ci must be true'],
      ['parity_e2e_ci', 'parity_e2e_ci must be true'],
      ['parity_checklist_verify_ci', 'parity_checklist_verify_ci must be true'],
      ['agent_zero_parity_verify_ci', 'agent_zero_parity_verify_ci must be true'],
      ['websocket_contract_ci', 'websocket_contract_ci must be true'],
      ['mcp_server_compat_ci', 'mcp_server_compat_ci must be true'],
      ['a2a_compat_ci', 'a2a_compat_ci must be true'],
      ['multi_device_validation_ci', 'multi_device_validation_ci must be true'],
      ['release_ops_drill_ci', 'release_ops_drill_ci must be true'],
      ['d9_keycloak_interop_ci', 'd9_keycloak_interop_ci must be true'],
      ['mobile_auth_session_smoke_ci', 'mobile_auth_session_smoke_ci must be true'],
      ['mobile_release_readiness_ci', 'mobile_release_readiness_ci must be true'],
      ['backup_restore_api_ci', 'backup_restore_api_ci must be true'],
      ['flutter_user_app_device_farm_ci', 'flutter_user_app_device_farm_ci must be true'],
      ['desktop_release_ci', 'desktop_release_ci must be true'],
      ['ui_e2e_ci', 'ui_e2e_ci must be true'],
      ['mobile_coverage_gate_ci', 'mobile_coverage_gate_ci must be true'],
      ['csrf_auth_e2e_ci', 'csrf_auth_e2e_ci must be true'],
      ['client_env_governance_ci', 'client_env_governance_ci must be true'],
      ['backend_capability_e2e_ci', 'backend_capability_e2e_ci must be true'],
      ['security_privacy_governance_ci', 'security_privacy_governance_ci must be true'],
      ['privacy_admin_e2e_ci', 'privacy_admin_e2e_ci must be true'],
      ['skill_quarantine_scan_ci', 'skill_quarantine_scan_ci must be true'],
      ['security_audit_unified_ci', 'security_audit_unified_ci must be true'],
      ['integration_truthfulness_ci', 'integration_truthfulness_ci must be true'],
      ['security_baseline_ci', 'security_baseline_ci must be true'],
      ['soak_72h', 'soak_72h must be true'],
      ['week4_rc_complete', 'week4_rc_complete must be true'],
      ['post_release_verified', 'post_release_verified must be true'],
    ];
    for (const [key, label] of ciGateChecks) {
      checks.push({
        id: `ci_gate:${key}`,
        pass: localOnly ? true : Boolean(ciGates[key]) === true,
        detail: localOnly
          ? `${label} (skipped in local-only mode, current=${String(ciGates[key])})`
          : `${label} (current=${String(ciGates[key])})`,
      });
    }
    checks.push({
      id: 'ci_gate:ops_shell_ci',
      pass: localOnly ? true : (!opsShellCiRequired || Boolean(ciGates.ops_shell_ci) === true),
      detail: localOnly
        ? `ops_shell_ci conditional gate (skipped in local-only mode, required=${String(opsShellCiRequired)} current=${String(ciGates.ops_shell_ci)})`
        : (!opsShellCiRequired
          ? 'ops_shell_ci not required (scope clean)'
          : `ops_shell_ci must be true when required (current=${String(ciGates.ops_shell_ci)})`),
    });
  }

  if (fs.existsSync(ciRequiredChecksPath)) {
    try {
      const ciRequiredChecks = JSON.parse(fs.readFileSync(ciRequiredChecksPath, 'utf8').replace(/^\uFEFF/, ''));
      const ciRequiredChecksStatus = String((ciRequiredChecks && ciRequiredChecks.status) || '').toLowerCase();
      const ciRequiredChecksEntries = Array.isArray(ciRequiredChecks?.checks)
        ? ciRequiredChecks.checks
        : [];
      const ciRequiredChecksById = new Map(
        ciRequiredChecksEntries
          .filter((entry) => entry && typeof entry === 'object' && typeof entry.id === 'string')
          .map((entry) => [String(entry.id), entry]),
      );
      const ciRequiredChecksTimestamp = extractTimestampIso(ciRequiredChecks);
      const ciRequiredChecksAge = ageHours(ciRequiredChecksTimestamp);
      const ciRequiredChecksFresh = typeof ciRequiredChecksAge === 'number'
        && ciRequiredChecksAge <= ciRequiredChecksMaxAgeHours;
      const validationMode = String(ciRequiredChecks?.execution?.validation_mode || '').trim().toLowerCase();
      const authority = String(ciRequiredChecks?.execution?.authority || '').trim().toLowerCase();
      const targetShaFromRequired = String(ciRequiredChecks?.execution?.target_sha || '').trim();
      const sourceHeadSha = String(ciGates?.source_head_sha || '').trim();
      checks.push({
        id: 'ci_required_checks_status_pass',
        pass: localOnly ? ['pass', 'provisional'].includes(ciRequiredChecksStatus) : ciRequiredChecksStatus === 'pass',
        detail: `${path.basename(ciRequiredChecksPath)} status=${ciRequiredChecksStatus || '(missing)'}`,
      });
      checks.push({
        id: 'ci_required_checks_fresh',
        pass: localOnly ? true : ciRequiredChecksFresh,
        detail: localOnly
          ? `local-only mode (age=${ciRequiredChecksAge === null ? '(missing)' : `${ciRequiredChecksAge.toFixed(2)}h`})`
          : ciRequiredChecksFresh
            ? `${ciRequiredChecksAge.toFixed(2)}h <= ${ciRequiredChecksMaxAgeHours}h`
            : ciRequiredChecksTimestamp
              ? `${(ciRequiredChecksAge || 0).toFixed(2)}h > ${ciRequiredChecksMaxAgeHours}h`
              : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'ci_required_checks_execution_authoritative',
        pass: localOnly ? true : (validationMode === 'ci-remote' && authority === 'release_authoritative'),
        detail: localOnly
          ? `skipped in local-only mode (validation_mode=${validationMode || '(missing)'}; authority=${authority || '(missing)'})`
          : `validation_mode=${validationMode || '(missing)'}; authority=${authority || '(missing)'}`,
      });
      checks.push({
        id: 'ci_required_checks_not_local_only_evidence',
        pass: localOnly ? true : ciRequiredChecks?.execution?.local_only !== true,
        detail: localOnly
          ? `skipped in local-only mode (execution.local_only=${String(ciRequiredChecks?.execution?.local_only)})`
          : `execution.local_only=${String(ciRequiredChecks?.execution?.local_only)}`,
      });
      checks.push({
        id: 'ci_required_checks_target_sha_matches_source',
        pass: localOnly ? true : (
          Boolean(targetShaFromRequired)
          && Boolean(sourceHeadSha)
          && targetShaFromRequired === sourceHeadSha
        ),
        detail: localOnly
          ? `skipped in local-only mode (target_sha=${targetShaFromRequired || '(missing)'}; source_head_sha=${sourceHeadSha || '(missing)'})`
          : `target_sha=${targetShaFromRequired || '(missing)'}; source_head_sha=${sourceHeadSha || '(missing)'}`,
      });
      const bridgeRuntimeLatestRun = ciRequiredChecksById.get('latest_run_success:bridge-runtime-tests');
      checks.push({
        id: 'ci_required_checks_bridge_runtime_latest_run_success',
        pass: localOnly ? true : Boolean(bridgeRuntimeLatestRun?.pass) === true,
        detail: localOnly
          ? 'skipped in local-only mode'
          : bridgeRuntimeLatestRun
          ? String(bridgeRuntimeLatestRun.detail || 'latest_run_success:bridge-runtime-tests check present')
          : 'missing latest_run_success:bridge-runtime-tests in ci-required-checks-latest.json',
      });
      const gatewayBridgeContractLatestRun = ciRequiredChecksById.get('latest_run_success:gateway-bridge-contract-tests');
      checks.push({
        id: 'ci_required_checks_gateway_bridge_contract_latest_run_success',
        pass: localOnly ? true : Boolean(gatewayBridgeContractLatestRun?.pass) === true,
        detail: localOnly
          ? 'skipped in local-only mode'
          : gatewayBridgeContractLatestRun
          ? String(gatewayBridgeContractLatestRun.detail || 'latest_run_success:gateway-bridge-contract-tests check present')
          : 'missing latest_run_success:gateway-bridge-contract-tests in ci-required-checks-latest.json',
      });
    } catch (err) {
      checks.push({
        id: 'ci_required_checks_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'ci_required_checks_present',
      pass: false,
      detail: 'docs/release/status/ci-required-checks-latest.json missing',
    });
  }

  if (localOnly) {
    if (fs.existsSync(latestStatusPath)) {
      try {
        const latest = JSON.parse(fs.readFileSync(latestStatusPath, 'utf8'));
        const d9Local =
          latest &&
          typeof latest === 'object' &&
          latest.d9_keycloak_interop &&
          typeof latest.d9_keycloak_interop === 'object'
            ? String(latest.d9_keycloak_interop.local_selfcheck_status || '').toLowerCase()
            : '';
        const d9LocalValidation =
          latest &&
          typeof latest === 'object' &&
          latest.d9_keycloak_interop &&
          typeof latest.d9_keycloak_interop === 'object'
            ? String(latest.d9_keycloak_interop.local_selfcheck_validation_status || '').toLowerCase()
            : '';
        checks.push({
          id: 'd9_local_selfcheck_status_pass',
          pass: d9Local === 'pass' && d9LocalValidation === 'valid',
          detail: `latest.json d9_keycloak_interop.local_selfcheck_status=${d9Local || '(missing)'}; local_selfcheck_validation_status=${d9LocalValidation || '(missing)'}`,
        });
      } catch (err) {
        checks.push({
          id: 'd9_local_selfcheck_status_pass',
          pass: false,
          detail: `failed to parse latest.json: ${String(err && err.message ? err.message : err)}`,
        });
      }
    } else {
      checks.push({
        id: 'd9_local_selfcheck_status_pass',
        pass: false,
        detail: 'docs/release/status/latest.json missing',
      });
    }

    const d9InFlightBypassActive = d9LocalReadinessCaller && d9LocalReadinessInFlight;
    if (d9InFlightBypassActive) {
      checks.push({
        id: 'd9_local_readiness_inflight_context_verified',
        pass: Boolean(d9LocalReadinessCallerRunId),
        detail: `caller_run_id=${d9LocalReadinessCallerRunId || '(missing)'}`,
      });
      checks.push({
        id: 'd9_local_readiness_same_run_linked',
        pass: true,
        detail: `in-flight D9 caller mode active; run_id=${d9LocalReadinessCallerRunId || '(missing)'}; artifact same-run linkage deferred to post-run report`,
      });
      checks.push({
        id: 'd9_local_readiness_status_pass',
        pass: true,
        detail: 'bypassed prior artifact dependency for in-flight D9 local readiness caller',
      });
    } else if (fs.existsSync(d9LocalReadinessPath)) {
      try {
        const readiness = JSON.parse(fs.readFileSync(d9LocalReadinessPath, 'utf8'));
        const readinessStatus =
          readiness && typeof readiness === 'object' ? String(readiness.status || '').toLowerCase() : '';
        const readinessRunId =
          readiness && typeof readiness === 'object' ? String(readiness.run_id || '').trim() : '';
        if (d9LocalReadinessCaller) {
          checks.push({
            id: 'd9_local_readiness_same_run_linked',
            pass: Boolean(readinessRunId) && Boolean(d9LocalReadinessCallerRunId) && readinessRunId === d9LocalReadinessCallerRunId,
            detail: `caller_run_id=${d9LocalReadinessCallerRunId || '(missing)'}; readiness_run_id=${readinessRunId || '(missing)'}`,
          });
          checks.push({
            id: 'd9_local_readiness_status_pass',
            pass: true,
            detail: `skipped for in-flight D9 local readiness caller (status=${readinessStatus || '(missing)'})`,
          });
        } else {
          checks.push({
            id: 'd9_local_readiness_status_pass',
            pass: readinessStatus === 'pass',
            detail: `d9-local-readiness-latest.json status=${readinessStatus || '(missing)'}`,
          });
        }
      } catch (err) {
        checks.push({
          id: 'd9_local_readiness_status_pass',
          pass: false,
          detail: `failed to parse d9-local-readiness-latest.json: ${String(err && err.message ? err.message : err)}`,
        });
      }
    } else {
      if (d9LocalReadinessCaller) {
        checks.push({
          id: 'd9_local_readiness_same_run_linked',
          pass: false,
          detail: `missing d9-local-readiness-latest.json for caller_run_id=${d9LocalReadinessCallerRunId || '(missing)'}`,
        });
      }
      checks.push({
        id: 'd9_local_readiness_status_pass',
        pass: false,
        detail: 'docs/release/status/d9-local-readiness-latest.json missing',
      });
    }

    if (fs.existsSync(d9LocalSelfcheckPath)) {
      try {
        const d9Selfcheck = JSON.parse(fs.readFileSync(d9LocalSelfcheckPath, 'utf8'));
        const d9SelfcheckEvaluation = evaluateD9LocalSelfcheckArtifact(d9Selfcheck);
        checks.push({
          id: 'd9_local_selfcheck_artifact_hardened',
          pass: d9SelfcheckEvaluation.valid,
          detail: d9SelfcheckEvaluation.detail,
        });
        checks.push({
          id: 'd9_local_selfcheck_report_status_pass',
          pass: d9SelfcheckEvaluation.valid && d9SelfcheckEvaluation.status === 'pass',
          detail: `d9-keycloak-local-selfcheck-latest.json status=${d9SelfcheckEvaluation.status || '(missing)'}`,
        });
        checks.push({
          id: 'd9_local_selfcheck_hardening_risk_clear',
          pass: d9SelfcheckEvaluation.valid && !d9SelfcheckEvaluation.hardeningRiskDetected,
          detail: !d9SelfcheckEvaluation.valid
            ? `invalid D9 local selfcheck artifact: ${d9SelfcheckEvaluation.detail}`
            : d9SelfcheckEvaluation.hardeningRiskDetected
              ? `hardening risks present: ${d9SelfcheckEvaluation.hardeningRiskCodes.length ? d9SelfcheckEvaluation.hardeningRiskCodes.join(', ') : '(unspecified)'}`
              : 'no startup hardening risks detected',
        });
      } catch (err) {
        checks.push({
          id: 'd9_local_selfcheck_artifact_hardened',
          pass: false,
          detail: `failed to parse d9-keycloak-local-selfcheck-latest.json: ${String(err && err.message ? err.message : err)}`,
        });
        checks.push({
          id: 'd9_local_selfcheck_report_status_pass',
          pass: false,
          detail: `failed to parse d9-keycloak-local-selfcheck-latest.json: ${String(err && err.message ? err.message : err)}`,
        });
        checks.push({
          id: 'd9_local_selfcheck_hardening_risk_clear',
          pass: false,
          detail: `failed to parse d9-keycloak-local-selfcheck-latest.json: ${String(err && err.message ? err.message : err)}`,
        });
      }
    } else {
      checks.push({
        id: 'd9_local_selfcheck_artifact_hardened',
        pass: false,
        detail: 'docs/release/status/d9-keycloak-local-selfcheck-latest.json missing',
      });
      checks.push({
        id: 'd9_local_selfcheck_report_status_pass',
        pass: false,
        detail: 'docs/release/status/d9-keycloak-local-selfcheck-latest.json missing',
      });
      checks.push({
        id: 'd9_local_selfcheck_hardening_risk_clear',
        pass: false,
        detail: 'docs/release/status/d9-keycloak-local-selfcheck-latest.json missing',
      });
    }
  }

  let mobileReadinessStatus = '';
  let mobileReadinessTimestamp = null;
  if (fs.existsSync(mobileReadinessPath)) {
    try {
      const mobileReadiness = JSON.parse(fs.readFileSync(mobileReadinessPath, 'utf8').replace(/^\uFEFF/, ''));
      const mobileStatus = String((mobileReadiness && mobileReadiness.status) || '').toLowerCase();
      const mobileTimestamp = extractTimestampIso(mobileReadiness);
      const mobileAge = ageHours(mobileTimestamp);
      const mobileFresh = typeof mobileAge === 'number' && mobileAge <= mobileReadinessMaxAgeHours;
      mobileReadinessStatus = mobileStatus;
      mobileReadinessTimestamp = mobileTimestamp;
      checks.push({
        id: 'mobile_release_readiness_status_pass',
        pass: mobileStatus === 'pass',
        detail: `mobile-release-readiness-latest.json status=${mobileStatus || '(missing)'}`,
      });
      checks.push({
        id: 'mobile_release_readiness_fresh',
        pass: mobileFresh,
        detail: mobileFresh
          ? `${mobileAge.toFixed(2)}h <= ${mobileReadinessMaxAgeHours}h`
          : mobileTimestamp
            ? `${(mobileAge || 0).toFixed(2)}h > ${mobileReadinessMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'mobile_release_readiness_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'mobile_release_readiness_present',
      pass: false,
      detail: 'docs/release/status/mobile-release-readiness-latest.json missing',
    });
  }

  if (fs.existsSync(multiDeviceValidationPath)) {
    try {
      const multiDeviceValidation = JSON.parse(fs.readFileSync(multiDeviceValidationPath, 'utf8').replace(/^\uFEFF/, ''));
      const multiDeviceStatus = String(
        (multiDeviceValidation && multiDeviceValidation.summary && multiDeviceValidation.summary.overall)
          || (multiDeviceValidation && multiDeviceValidation.status)
          || ''
      ).toLowerCase();
      const multiDeviceTimestamp = extractTimestampIso(multiDeviceValidation);
      const multiDeviceAge = ageHours(multiDeviceTimestamp);
      const multiDeviceFresh = typeof multiDeviceAge === 'number' && multiDeviceAge <= multiDeviceValidationMaxAgeHours;
      checks.push({
        id: 'multi_device_validation_status_pass',
        pass: multiDeviceStatus === 'pass',
        detail: `multi-device-validation-latest.json status=${multiDeviceStatus || '(missing)'}`,
      });
      checks.push({
        id: 'multi_device_validation_fresh',
        pass: multiDeviceFresh,
        detail: multiDeviceFresh
          ? `${multiDeviceAge.toFixed(2)}h <= ${multiDeviceValidationMaxAgeHours}h`
          : multiDeviceTimestamp
            ? `${(multiDeviceAge || 0).toFixed(2)}h > ${multiDeviceValidationMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'multi_device_validation_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'multi_device_validation_present',
      pass: false,
      detail: 'docs/release/status/multi-device-validation-latest.json missing',
    });
  }

  function addMobileArtifactConsistencyChecks(opts) {
    const statusPath = opts.statusPath;
    const artifactIdPrefix = opts.artifactIdPrefix;
    const maxAgeHours = opts.maxAgeHours;
    const label = opts.label;
    if (!fs.existsSync(statusPath)) {
      checks.push({
        id: `${artifactIdPrefix}_present`,
        pass: true,
        detail: `${statusPath.replace(`${root}${path.sep}`, '')} missing (consistency check skipped)`,
      });
      return;
    }
    try {
      const payload = JSON.parse(fs.readFileSync(statusPath, 'utf8').replace(/^\uFEFF/, ''));
      const artifactStatus = String((payload && payload.status) || '').toLowerCase();
      const artifactTimestamp = extractTimestampIso(payload);
      const artifactAge = ageHours(artifactTimestamp);
      const artifactFresh = typeof artifactAge === 'number' && artifactAge <= maxAgeHours;
      const masksReadinessFailure = artifactStatus === 'pass' && mobileReadinessStatus && mobileReadinessStatus !== 'pass';
      const readinessTimeComparable = Boolean(artifactTimestamp) && Boolean(mobileReadinessTimestamp);
      const artifactNotNewerThanReadiness = !readinessTimeComparable
        || Date.parse(artifactTimestamp) <= Date.parse(mobileReadinessTimestamp);
      checks.push({
        id: `${artifactIdPrefix}_fresh`,
        pass: artifactFresh,
        detail: artifactFresh
          ? `${artifactAge.toFixed(2)}h <= ${maxAgeHours}h`
          : artifactTimestamp
            ? `${(artifactAge || 0).toFixed(2)}h > ${maxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: `${artifactIdPrefix}_consistent_with_mobile_readiness`,
        pass: !masksReadinessFailure,
        detail: `${label} status=${artifactStatus || '(missing)'}; mobile_readiness_status=${mobileReadinessStatus || '(missing)'}`,
      });
      checks.push({
        id: `${artifactIdPrefix}_not_newer_than_mobile_readiness`,
        pass: artifactNotNewerThanReadiness,
        detail: readinessTimeComparable
          ? `artifact_ts=${artifactTimestamp}; mobile_readiness_ts=${mobileReadinessTimestamp}`
          : `artifact_ts=${artifactTimestamp || '(missing)'}; mobile_readiness_ts=${mobileReadinessTimestamp || '(missing)'}`,
      });
    } catch (err) {
      checks.push({
        id: `${artifactIdPrefix}_valid_json`,
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  }

  addMobileArtifactConsistencyChecks({
    statusPath: mobileReleaseSigningPath,
    artifactIdPrefix: 'mobile_release_signing',
    maxAgeHours: mobileReleaseSigningMaxAgeHours,
    label: 'mobile-release-signing-latest.json',
  });

  addMobileArtifactConsistencyChecks({
    statusPath: mobileAppStorePrivacyPath,
    artifactIdPrefix: 'mobile_app_store_privacy',
    maxAgeHours: mobileAppStorePrivacyMaxAgeHours,
    label: 'mobile-app-store-privacy-latest.json',
  });

  if (fs.existsSync(finalDodExecutionPath)) {
    try {
      const finalDodExecution = JSON.parse(fs.readFileSync(finalDodExecutionPath, 'utf8').replace(/^\uFEFF/, ''));
      const finalDodExecutionStatus = String((finalDodExecution && finalDodExecution.status) || '').toLowerCase();
      const finalDodExecutionTimestamp = extractTimestampIso(finalDodExecution);
      const finalDodExecutionAge = ageHours(finalDodExecutionTimestamp);
      const finalDodExecutionFresh = typeof finalDodExecutionAge === 'number'
        && finalDodExecutionAge <= finalDodExecutionMaxAgeHours;
      const finalDodExecutionRunId = String(finalDodExecution?.source_run_id || finalDodExecution?.run_id || '').trim();
      const finalDodExecutionHeadSha = String(finalDodExecution?.head_sha || '').trim();
      const finalDodExecutionLive = finalDodExecution?.live_checks_executed === true;
      checks.push({
        id: 'final_dod_execution_status_pass',
        pass: finalDodExecutionStatus === 'pass',
        detail: `final-dod-execution-latest.json status=${finalDodExecutionStatus || '(missing)'}`,
      });
      checks.push({
        id: 'final_dod_execution_fresh',
        pass: finalDodExecutionFresh,
        detail: finalDodExecutionFresh
          ? `${finalDodExecutionAge.toFixed(2)}h <= ${finalDodExecutionMaxAgeHours}h`
          : finalDodExecutionTimestamp
            ? `${(finalDodExecutionAge || 0).toFixed(2)}h > ${finalDodExecutionMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'final_dod_execution_provenance_present',
        pass: Boolean(finalDodExecutionRunId) && /^[a-z0-9._-]{3,128}$/i.test(finalDodExecutionRunId) && /^[a-f0-9]{7,40}$/i.test(finalDodExecutionHeadSha),
        detail: `source_run_id=${finalDodExecutionRunId || '(missing)'}; head_sha=${finalDodExecutionHeadSha || '(missing)'}`,
      });
      checks.push({
        id: 'final_dod_execution_live_checks_executed',
        pass: finalDodExecutionLive,
        detail: `live_checks_executed=${String(finalDodExecutionLive)}`,
      });
    } catch (err) {
      checks.push({
        id: 'final_dod_execution_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'final_dod_execution_present',
      pass: false,
      detail: 'docs/release/status/final-dod-execution-latest.json missing',
    });
  }

  if (fs.existsSync(skillQuarantineScanPath)) {
    try {
      const skillQuarantineScan = JSON.parse(fs.readFileSync(skillQuarantineScanPath, 'utf8').replace(/^\uFEFF/, ''));
      const scanStatus = String((skillQuarantineScan && skillQuarantineScan.status) || '').toLowerCase();
      const scanTimestamp = extractTimestampIso(skillQuarantineScan);
      const scanAge = ageHours(scanTimestamp);
      const scanFresh = typeof scanAge === 'number' && scanAge <= skillQuarantineScanMaxAgeHours;
      const scanRunId = String(skillQuarantineScan?.source_run_id || skillQuarantineScan?.run_id || '').trim();
      const scanHeadSha = String(skillQuarantineScan?.head_sha || '').trim();
      const skippedCount = Number(skillQuarantineScan?.skipped_count);
      checks.push({
        id: 'skill_quarantine_scan_status_pass',
        pass: scanStatus === 'pass',
        detail: `skill-quarantine-scan-latest.json status=${scanStatus || '(missing)'}`,
      });
      checks.push({
        id: 'skill_quarantine_scan_fresh',
        pass: scanFresh,
        detail: scanFresh
          ? `${scanAge.toFixed(2)}h <= ${skillQuarantineScanMaxAgeHours}h`
          : scanTimestamp
            ? `${(scanAge || 0).toFixed(2)}h > ${skillQuarantineScanMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'skill_quarantine_scan_provenance_present',
        pass: Boolean(scanRunId) && /^[a-z0-9._-]{3,128}$/i.test(scanRunId) && /^[a-f0-9]{7,40}$/i.test(scanHeadSha),
        detail: `run_id=${scanRunId || '(missing)'}; head_sha=${scanHeadSha || '(missing)'}`,
      });
      checks.push({
        id: 'skill_quarantine_scan_skipped_count_within_threshold',
        pass: Number.isFinite(skippedCount) && skippedCount <= skillQuarantineScanMaxSkipped,
        detail: `skipped_count=${Number.isFinite(skippedCount) ? String(skippedCount) : '(missing)'}; max_skipped=${skillQuarantineScanMaxSkipped}`,
      });
    } catch (err) {
      checks.push({
        id: 'skill_quarantine_scan_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'skill_quarantine_scan_present',
      pass: false,
      detail: 'docs/release/status/skill-quarantine-scan-latest.json missing',
    });
  }

  if (fs.existsSync(securityAuditUnifiedPath)) {
    try {
      const securityAuditUnified = JSON.parse(fs.readFileSync(securityAuditUnifiedPath, 'utf8').replace(/^\uFEFF/, ''));
      const unifiedStatus = String((securityAuditUnified && securityAuditUnified.status) || '').toLowerCase();
      const unifiedTimestamp = extractTimestampIso(securityAuditUnified);
      const unifiedAge = ageHours(unifiedTimestamp);
      const unifiedFresh = typeof unifiedAge === 'number' && unifiedAge <= securityAuditUnifiedMaxAgeHours;
      const unifiedRunId = String(securityAuditUnified?.source_run_id || securityAuditUnified?.run_id || '').trim();
      const unifiedHeadSha = String(securityAuditUnified?.head_sha || '').trim();
      const deepModeSupported = securityAuditUnified?.deep_mode_supported === true;
      const deepCheckIds = Array.isArray(securityAuditUnified?.deep_check_ids)
        ? securityAuditUnified.deep_check_ids.map((value) => String(value || '').trim())
        : [];
      const requiredDeepCheckIds = ['SEC-021', 'SEC-022'];
      const deepCheckIdsPresent = requiredDeepCheckIds.every((id) => deepCheckIds.includes(id));
      checks.push({
        id: 'security_audit_unified_status_pass',
        pass: unifiedStatus === 'pass',
        detail: `security-audit-unified-latest.json status=${unifiedStatus || '(missing)'}`,
      });
      checks.push({
        id: 'security_audit_unified_fresh',
        pass: unifiedFresh,
        detail: unifiedFresh
          ? `${unifiedAge.toFixed(2)}h <= ${securityAuditUnifiedMaxAgeHours}h`
          : unifiedTimestamp
            ? `${(unifiedAge || 0).toFixed(2)}h > ${securityAuditUnifiedMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'security_audit_unified_provenance_present',
        pass: Boolean(unifiedRunId) && /^[a-z0-9._-]{3,128}$/i.test(unifiedRunId) && /^[a-f0-9]{7,40}$/i.test(unifiedHeadSha),
        detail: `run_id=${unifiedRunId || '(missing)'}; head_sha=${unifiedHeadSha || '(missing)'}`,
      });
      checks.push({
        id: 'security_audit_unified_deep_mode_supported',
        pass: deepModeSupported,
        detail: `deep_mode_supported=${String(deepModeSupported)}`,
      });
      checks.push({
        id: 'security_audit_unified_deep_check_ids_present',
        pass: deepCheckIdsPresent,
        detail: deepCheckIdsPresent
          ? `deep_check_ids include ${requiredDeepCheckIds.join(', ')}`
          : `deep_check_ids missing one or more required entries (${requiredDeepCheckIds.join(', ')})`,
      });
    } catch (err) {
      checks.push({
        id: 'security_audit_unified_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'security_audit_unified_present',
      pass: false,
      detail: 'docs/release/status/security-audit-unified-latest.json missing',
    });
  }

  if (fs.existsSync(dependencyVulnPath)) {
    try {
      const dependencyVuln = JSON.parse(fs.readFileSync(dependencyVulnPath, 'utf8').replace(/^\uFEFF/, ''));
      const dependencyVulnStatus = String((dependencyVuln && dependencyVuln.status) || '').toLowerCase();
      const dependencyVulnTimestamp = extractTimestampIso(dependencyVuln);
      const dependencyVulnAge = ageHours(dependencyVulnTimestamp);
      const dependencyVulnFresh = typeof dependencyVulnAge === 'number'
        && dependencyVulnAge <= dependencyVulnMaxAgeHours;
      checks.push({
        id: 'dependency_vuln_status_pass',
        pass: dependencyVulnStatus === 'pass',
        detail: `dependency-vuln-latest.json status=${dependencyVulnStatus || '(missing)'}`,
      });
      checks.push({
        id: 'dependency_vuln_fresh',
        pass: dependencyVulnFresh,
        detail: dependencyVulnFresh
          ? `${dependencyVulnAge.toFixed(2)}h <= ${dependencyVulnMaxAgeHours}h`
          : dependencyVulnTimestamp
            ? `${(dependencyVulnAge || 0).toFixed(2)}h > ${dependencyVulnMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'dependency_vuln_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'dependency_vuln_present',
      pass: false,
      detail: 'docs/release/status/dependency-vuln-latest.json missing',
    });
  }

  if (fs.existsSync(securityTransportCspPath)) {
    try {
      const securityTransportCsp = JSON.parse(fs.readFileSync(securityTransportCspPath, 'utf8').replace(/^\uFEFF/, ''));
      const securityTransportCspStatus = String((securityTransportCsp && securityTransportCsp.status) || '').toLowerCase();
      const securityTransportCspTimestamp = extractTimestampIso(securityTransportCsp);
      const securityTransportCspAge = ageHours(securityTransportCspTimestamp);
      const securityTransportCspFresh = typeof securityTransportCspAge === 'number'
        && securityTransportCspAge <= securityTransportCspMaxAgeHours;
      checks.push({
        id: 'security_transport_csp_status_pass',
        pass: securityTransportCspStatus === 'pass',
        detail: `security-transport-csp-latest.json status=${securityTransportCspStatus || '(missing)'}`,
      });
      checks.push({
        id: 'security_transport_csp_fresh',
        pass: securityTransportCspFresh,
        detail: securityTransportCspFresh
          ? `${securityTransportCspAge.toFixed(2)}h <= ${securityTransportCspMaxAgeHours}h`
          : securityTransportCspTimestamp
            ? `${(securityTransportCspAge || 0).toFixed(2)}h > ${securityTransportCspMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'security_transport_csp_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'security_transport_csp_present',
      pass: false,
      detail: 'docs/release/status/security-transport-csp-latest.json missing',
    });
  }

  if (fs.existsSync(securityAuthSurfacePath)) {
    try {
      const securityAuthSurface = JSON.parse(fs.readFileSync(securityAuthSurfacePath, 'utf8').replace(/^\uFEFF/, ''));
      const securityAuthSurfaceStatus = String((securityAuthSurface && securityAuthSurface.status) || '').toLowerCase();
      const securityAuthSurfaceTimestamp = extractTimestampIso(securityAuthSurface);
      const securityAuthSurfaceAge = ageHours(securityAuthSurfaceTimestamp);
      const securityAuthSurfaceFresh = typeof securityAuthSurfaceAge === 'number'
        && securityAuthSurfaceAge <= securityAuthSurfaceMaxAgeHours;
      checks.push({
        id: 'security_auth_surface_status_pass',
        pass: securityAuthSurfaceStatus === 'pass',
        detail: `security-auth-surface-latest.json status=${securityAuthSurfaceStatus || '(missing)'}`,
      });
      checks.push({
        id: 'security_auth_surface_fresh',
        pass: securityAuthSurfaceFresh,
        detail: securityAuthSurfaceFresh
          ? `${securityAuthSurfaceAge.toFixed(2)}h <= ${securityAuthSurfaceMaxAgeHours}h`
          : securityAuthSurfaceTimestamp
            ? `${(securityAuthSurfaceAge || 0).toFixed(2)}h > ${securityAuthSurfaceMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'security_auth_surface_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'security_auth_surface_present',
      pass: false,
      detail: 'docs/release/status/security-auth-surface-latest.json missing',
    });
  }

  if (fs.existsSync(securityPlaintextSecretsPath)) {
    try {
      const securityPlaintextSecrets = JSON.parse(fs.readFileSync(securityPlaintextSecretsPath, 'utf8').replace(/^\uFEFF/, ''));
      const securityPlaintextStatus = String((securityPlaintextSecrets && securityPlaintextSecrets.status) || '').toLowerCase();
      const securityPlaintextTimestamp = extractTimestampIso(securityPlaintextSecrets);
      const securityPlaintextAge = ageHours(securityPlaintextTimestamp);
      const securityPlaintextFresh = typeof securityPlaintextAge === 'number'
        && securityPlaintextAge <= securityPlaintextSecretsMaxAgeHours;
      checks.push({
        id: 'security_plaintext_secrets_status_pass',
        pass: securityPlaintextStatus === 'pass',
        detail: `security-plaintext-secrets-latest.json status=${securityPlaintextStatus || '(missing)'}`,
      });
      checks.push({
        id: 'security_plaintext_secrets_fresh',
        pass: securityPlaintextFresh,
        detail: securityPlaintextFresh
          ? `${securityPlaintextAge.toFixed(2)}h <= ${securityPlaintextSecretsMaxAgeHours}h`
          : securityPlaintextTimestamp
            ? `${(securityPlaintextAge || 0).toFixed(2)}h > ${securityPlaintextSecretsMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'security_plaintext_secrets_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'security_plaintext_secrets_present',
      pass: false,
      detail: 'docs/release/status/security-plaintext-secrets-latest.json missing',
    });
  }

  function addSecurityExecutionArtifactChecks(opts) {
    const statusPath = opts.statusPath;
    const checkIdPrefix = opts.checkIdPrefix;
    const label = opts.label;
    const maxAgeHours = opts.maxAgeHours;
    if (fs.existsSync(statusPath)) {
      try {
        const payload = JSON.parse(fs.readFileSync(statusPath, 'utf8').replace(/^\uFEFF/, ''));
        const statusValue = String((payload && payload.status) || '').toLowerCase();
        const timestamp = extractTimestampIso(payload);
        const age = ageHours(timestamp);
        const fresh = typeof age === 'number' && age <= maxAgeHours;
        const runId = String(payload?.source_run_id || payload?.run_id || '').trim();
        const headSha = String(payload?.head_sha || '').trim();
        checks.push({
          id: `${checkIdPrefix}_status_pass`,
          pass: statusValue === 'pass',
          detail: `${label} status=${statusValue || '(missing)'}`,
        });
        checks.push({
          id: `${checkIdPrefix}_fresh`,
          pass: fresh,
          detail: fresh
            ? `${age.toFixed(2)}h <= ${maxAgeHours}h`
            : timestamp
              ? `${(age || 0).toFixed(2)}h > ${maxAgeHours}h`
              : 'missing/invalid timestamp',
        });
        checks.push({
          id: `${checkIdPrefix}_provenance_present`,
          pass: Boolean(runId) && /^[a-z0-9._-]{3,128}$/i.test(runId) && /^[a-f0-9]{7,40}$/i.test(headSha),
          detail: `source_run_id=${runId || '(missing)'}; head_sha=${headSha || '(missing)'}`,
        });
      } catch (err) {
        checks.push({
          id: `${checkIdPrefix}_valid_json`,
          pass: false,
          detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
        });
      }
    } else {
      checks.push({
        id: `${checkIdPrefix}_present`,
        pass: false,
        detail: `${statusPath.replace(`${root}${path.sep}`, '')} missing`,
      });
    }
  }

  addSecurityExecutionArtifactChecks({
    statusPath: securityImageSigningPath,
    checkIdPrefix: 'security_image_signing',
    label: 'security-image-signing-latest.json',
    maxAgeHours: securityImageSigningMaxAgeHours,
  });

  addSecurityExecutionArtifactChecks({
    statusPath: securityReleaseArtifactSbomPath,
    checkIdPrefix: 'security_release_artifact_sbom',
    label: 'security-release-artifact-sbom-latest.json',
    maxAgeHours: securityReleaseArtifactSbomMaxAgeHours,
  });

  addSecurityExecutionArtifactChecks({
    statusPath: securitySbomCosignPath,
    checkIdPrefix: 'security_sbom_cosign',
    label: 'security-sbom-cosign-latest.json',
    maxAgeHours: securitySbomCosignMaxAgeHours,
  });

  if (fs.existsSync(thirdChecklistIntegrationPath)) {
    try {
      const thirdChecklistIntegration = JSON.parse(fs.readFileSync(thirdChecklistIntegrationPath, 'utf8').replace(/^\uFEFF/, ''));
      const thirdChecklistIntegrationStatus = String((thirdChecklistIntegration && thirdChecklistIntegration.status) || '').toLowerCase();
      const thirdChecklistIntegrationTimestamp = extractTimestampIso(thirdChecklistIntegration);
      const thirdChecklistIntegrationAge = ageHours(thirdChecklistIntegrationTimestamp);
      const thirdChecklistIntegrationFresh = typeof thirdChecklistIntegrationAge === 'number'
        && thirdChecklistIntegrationAge <= thirdChecklistIntegrationMaxAgeHours;
      checks.push({
        id: 'third_checklist_integration_status_pass',
        pass: thirdChecklistIntegrationStatus === 'pass',
        detail: `third-checklist-integration-latest.json status=${thirdChecklistIntegrationStatus || '(missing)'}`,
      });
      checks.push({
        id: 'third_checklist_integration_fresh',
        pass: thirdChecklistIntegrationFresh,
        detail: thirdChecklistIntegrationFresh
          ? `${thirdChecklistIntegrationAge.toFixed(2)}h <= ${thirdChecklistIntegrationMaxAgeHours}h`
          : thirdChecklistIntegrationTimestamp
            ? `${(thirdChecklistIntegrationAge || 0).toFixed(2)}h > ${thirdChecklistIntegrationMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'third_checklist_integration_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'third_checklist_integration_present',
      pass: false,
      detail: 'docs/release/status/third-checklist-integration-latest.json missing',
    });
  }

  if (fs.existsSync(finalDodE2ePath)) {
    try {
      const finalDodE2e = JSON.parse(fs.readFileSync(finalDodE2ePath, 'utf8').replace(/^\uFEFF/, ''));
      const finalDodE2eStatus = String((finalDodE2e && finalDodE2e.status) || '').toLowerCase();
      const finalDodE2eTimestamp = extractTimestampIso(finalDodE2e);
      const finalDodE2eAge = ageHours(finalDodE2eTimestamp);
      const finalDodE2eFresh = typeof finalDodE2eAge === 'number' && finalDodE2eAge <= finalDodE2eMaxAgeHours;
      const finalDodE2eRunId = String(finalDodE2e?.source_run_id || finalDodE2e?.run_id || '').trim();
      const finalDodE2eHeadSha = String(finalDodE2e?.head_sha || '').trim();
      const finalDodE2eRunUrl = String(finalDodE2e?.workflow_run_url || '').trim();
      checks.push({
        id: 'final_dod_e2e_status_pass',
        pass: finalDodE2eStatus === 'pass',
        detail: `final-dod-e2e-latest.json status=${finalDodE2eStatus || '(missing)'}`,
      });
      checks.push({
        id: 'final_dod_e2e_fresh',
        pass: finalDodE2eFresh,
        detail: finalDodE2eFresh
          ? `${finalDodE2eAge.toFixed(2)}h <= ${finalDodE2eMaxAgeHours}h`
          : finalDodE2eTimestamp
            ? `${(finalDodE2eAge || 0).toFixed(2)}h > ${finalDodE2eMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'final_dod_e2e_provenance_present',
        pass: Boolean(finalDodE2eRunId)
          && /^[a-z0-9._-]{3,128}$/i.test(finalDodE2eRunId)
          && /^[a-f0-9]{7,40}$/i.test(finalDodE2eHeadSha)
          && /^https:\/\/github\.com\/.+\/actions\/runs\/\d+$/i.test(finalDodE2eRunUrl),
        detail: `run_id=${finalDodE2eRunId || '(missing)'}; head_sha=${finalDodE2eHeadSha || '(missing)'}; workflow_run_url=${finalDodE2eRunUrl || '(missing)'}`,
      });
    } catch (err) {
      checks.push({
        id: 'final_dod_e2e_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'final_dod_e2e_present',
      pass: false,
      detail: 'docs/release/status/final-dod-e2e-latest.json missing',
    });
  }

  if (fs.existsSync(parityE2ePath)) {
    try {
      const parityE2e = JSON.parse(fs.readFileSync(parityE2ePath, 'utf8').replace(/^\uFEFF/, ''));
      const parityE2eStatus = String((parityE2e && parityE2e.status) || '').toLowerCase();
      const parityE2eTimestamp = extractTimestampIso(parityE2e);
      const parityE2eAge = ageHours(parityE2eTimestamp);
      const parityE2eFresh = typeof parityE2eAge === 'number' && parityE2eAge <= parityE2eMaxAgeHours;
      const parityE2eRunId = String(parityE2e?.source_run_id || parityE2e?.run_id || '').trim();
      const parityE2eHeadSha = String(parityE2e?.head_sha || '').trim();
      const parityE2eRunUrl = String(parityE2e?.workflow_run_url || '').trim();
      checks.push({
        id: 'parity_e2e_status_pass',
        pass: parityE2eStatus === 'pass',
        detail: `parity-e2e-latest.json status=${parityE2eStatus || '(missing)'}`,
      });
      checks.push({
        id: 'parity_e2e_fresh',
        pass: parityE2eFresh,
        detail: parityE2eFresh
          ? `${parityE2eAge.toFixed(2)}h <= ${parityE2eMaxAgeHours}h`
          : parityE2eTimestamp
            ? `${(parityE2eAge || 0).toFixed(2)}h > ${parityE2eMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'parity_e2e_provenance_present',
        pass: Boolean(parityE2eRunId)
          && /^[a-z0-9._-]{3,128}$/i.test(parityE2eRunId)
          && /^[a-f0-9]{7,40}$/i.test(parityE2eHeadSha)
          && /^https:\/\/github\.com\/.+\/actions\/runs\/\d+$/i.test(parityE2eRunUrl),
        detail: `run_id=${parityE2eRunId || '(missing)'}; head_sha=${parityE2eHeadSha || '(missing)'}; workflow_run_url=${parityE2eRunUrl || '(missing)'}`,
      });
    } catch (err) {
      checks.push({
        id: 'parity_e2e_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'parity_e2e_present',
      pass: false,
      detail: 'docs/release/status/parity-e2e-latest.json missing',
    });
  }

  if (fs.existsSync(uiE2ePath)) {
    try {
      const uiE2e = JSON.parse(fs.readFileSync(uiE2ePath, 'utf8').replace(/^\uFEFF/, ''));
      const uiE2eStatus = String((uiE2e && uiE2e.status) || '').toLowerCase();
      const uiE2eTimestamp = extractTimestampIso(uiE2e);
      const uiE2eAge = ageHours(uiE2eTimestamp);
      const uiE2eFresh = typeof uiE2eAge === 'number' && uiE2eAge <= uiE2eMaxAgeHours;
      const uiE2eRunId = String(uiE2e?.provenance?.run_id || uiE2e?.run_id || uiE2e?.source_run_id || '').trim();
      const uiE2eHeadSha = String(uiE2e?.provenance?.head_sha || uiE2e?.head_sha || '').trim();
      const suites = Array.isArray(uiE2e?.suites) ? uiE2e.suites : [];
      const requiredProjects = ['admin-web', 'canvas-web', 'desktop-tauri-web'];
      const projectCounts = {};
      let totalExecuted = 0;
      for (const suite of suites) {
        const project = String(suite?.project || '').trim();
        if (!project) continue;
        const explicitTests = Number(suite?.tests);
        const passed = Number(suite?.passed || 0);
        const failed = Number(suite?.failed || 0);
        const executed = Number.isFinite(explicitTests) && explicitTests >= 0 ? explicitTests : Math.max(0, passed + failed);
        projectCounts[project] = executed;
        totalExecuted += executed;
      }
      const minProjectTestsOk = requiredProjects.every((project) => Number(projectCounts[project] || 0) >= uiE2eMinProjectTests);
      const minTotalTestsOk = totalExecuted >= uiE2eMinTotalTests;
      const adminEndpointCoverage = uiE2e?.admin_endpoint_coverage && typeof uiE2e.admin_endpoint_coverage === 'object'
        ? uiE2e.admin_endpoint_coverage
        : null;
      const adminCoverageMode = String(adminEndpointCoverage?.coverage_mode || '').trim();
      const adminEndpointMap = Array.isArray(adminEndpointCoverage?.endpoint_map)
        ? adminEndpointCoverage.endpoint_map
        : [];
      const adminFlowsRaw = Number(adminEndpointCoverage?.endpoint_flows_verified);
      const adminFlows = Number.isFinite(adminFlowsRaw)
        ? adminFlowsRaw
        : Number(projectCounts['admin-web'] || 0);
      const adminCoveragePresent = Boolean(adminCoverageMode) && adminEndpointMap.length > 0;
      const adminFlowThresholdOk = Number.isFinite(adminFlows) && adminFlows >= uiE2eMinAdminEndpointFlows;
      checks.push({
        id: 'ui_e2e_status_pass',
        pass: uiE2eStatus === 'pass',
        detail: `ui-e2e-latest.json status=${uiE2eStatus || '(missing)'}`,
      });
      checks.push({
        id: 'ui_e2e_fresh',
        pass: uiE2eFresh,
        detail: uiE2eFresh
          ? `${uiE2eAge.toFixed(2)}h <= ${uiE2eMaxAgeHours}h`
          : uiE2eTimestamp
            ? `${(uiE2eAge || 0).toFixed(2)}h > ${uiE2eMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'ui_e2e_provenance_present',
        pass: Boolean(uiE2eRunId) && /^[a-z0-9._-]{3,128}$/i.test(uiE2eRunId) && /^[a-f0-9]{7,40}$/i.test(uiE2eHeadSha),
        detail: `run_id=${uiE2eRunId || '(missing)'}; head_sha=${uiE2eHeadSha || '(missing)'}`,
      });
      checks.push({
        id: 'ui_e2e_min_project_tests',
        pass: minProjectTestsOk,
        detail: `min_per_project=${uiE2eMinProjectTests}; observed=${requiredProjects.map((project) => `${project}:${Number(projectCounts[project] || 0)}`).join(', ')}`,
      });
      checks.push({
        id: 'ui_e2e_min_total_tests',
        pass: minTotalTestsOk,
        detail: `min_total=${uiE2eMinTotalTests}; observed_total=${totalExecuted}`,
      });
      checks.push({
        id: 'ui_e2e_admin_endpoint_coverage_present',
        pass: adminCoveragePresent,
        detail: adminCoveragePresent
          ? `coverage_mode=${adminCoverageMode}; endpoint_map_entries=${adminEndpointMap.length}`
          : 'admin_endpoint_coverage block missing/invalid',
      });
      checks.push({
        id: 'ui_e2e_admin_endpoint_flow_threshold',
        pass: adminFlowThresholdOk,
        detail: `min_admin_endpoint_flows=${uiE2eMinAdminEndpointFlows}; observed=${adminFlows}`,
      });
    } catch (err) {
      checks.push({
        id: 'ui_e2e_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'ui_e2e_present',
      pass: false,
      detail: 'docs/release/status/ui-e2e-latest.json missing',
    });
  }

  if (fs.existsSync(backupRestoreApiPath)) {
    try {
      const backupRestoreApi = JSON.parse(fs.readFileSync(backupRestoreApiPath, 'utf8').replace(/^\uFEFF/, ''));
      const backupRestoreApiStatus = String((backupRestoreApi && backupRestoreApi.status) || '').toLowerCase();
      const backupRestoreApiTimestamp = extractTimestampIso(backupRestoreApi);
      const backupRestoreApiAge = ageHours(backupRestoreApiTimestamp);
      const backupRestoreApiFresh = typeof backupRestoreApiAge === 'number'
        && backupRestoreApiAge <= backupRestoreApiMaxAgeHours;
      const backupRestoreApiRunId = String(
        backupRestoreApi?.source_run_id || backupRestoreApi?.provenance?.run_id || backupRestoreApi?.run_id || '',
      ).trim();
      const backupRestoreApiHeadSha = String(
        backupRestoreApi?.head_sha || backupRestoreApi?.provenance?.head_sha || '',
      ).trim();
      const backupRestoreApiExecuted = Number(backupRestoreApi?.executed_tests || 0);
      const backupRestoreApiLiveExecuted = backupRestoreApi?.live_checks_executed === true;
      checks.push({
        id: 'backup_restore_api_status_pass',
        pass: backupRestoreApiStatus === 'pass',
        detail: `backup-restore-api-e2e-latest.json status=${backupRestoreApiStatus || '(missing)'}`,
      });
      checks.push({
        id: 'backup_restore_api_fresh',
        pass: backupRestoreApiFresh,
        detail: backupRestoreApiFresh
          ? `${backupRestoreApiAge.toFixed(2)}h <= ${backupRestoreApiMaxAgeHours}h`
          : backupRestoreApiTimestamp
            ? `${(backupRestoreApiAge || 0).toFixed(2)}h > ${backupRestoreApiMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'backup_restore_api_provenance_present',
        pass: Boolean(backupRestoreApiRunId) && /^[a-z0-9._-]{3,128}$/i.test(backupRestoreApiRunId) && /^[a-f0-9]{7,40}$/i.test(backupRestoreApiHeadSha),
        detail: `run_id=${backupRestoreApiRunId || '(missing)'}; head_sha=${backupRestoreApiHeadSha || '(missing)'}`,
      });
      checks.push({
        id: 'backup_restore_api_live_checks_executed',
        pass: backupRestoreApiLiveExecuted,
        detail: `live_checks_executed=${String(backupRestoreApiLiveExecuted)}`,
      });
      checks.push({
        id: 'backup_restore_api_min_executed_tests',
        pass: Number.isFinite(backupRestoreApiExecuted) && backupRestoreApiExecuted >= backupRestoreApiMinExecutedTests,
        detail: `min_executed=${backupRestoreApiMinExecutedTests}; observed=${backupRestoreApiExecuted}`,
      });
    } catch (err) {
      checks.push({
        id: 'backup_restore_api_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'backup_restore_api_present',
      pass: false,
      detail: 'docs/release/status/backup-restore-api-e2e-latest.json missing',
    });
  }

  if (fs.existsSync(mobileDeviceFarmConfigPath)) {
    try {
      const mobileDeviceFarmConfig = JSON.parse(fs.readFileSync(mobileDeviceFarmConfigPath, 'utf8').replace(/^\uFEFF/, ''));
      const mobileDeviceFarmConfigStatus = String((mobileDeviceFarmConfig && mobileDeviceFarmConfig.status) || '').toLowerCase();
      const mobileDeviceFarmConfigTimestamp = extractTimestampIso(mobileDeviceFarmConfig);
      const mobileDeviceFarmConfigAge = ageHours(mobileDeviceFarmConfigTimestamp);
      const mobileDeviceFarmConfigFresh = typeof mobileDeviceFarmConfigAge === 'number'
        && mobileDeviceFarmConfigAge <= mobileDeviceFarmConfigMaxAgeHours;
      const checkIds = Array.isArray(mobileDeviceFarmConfig?.checks)
        ? mobileDeviceFarmConfig.checks.map((entry) => String(entry?.id || ''))
        : [];
      const currentPathChecksPresent =
        checkIds.includes('exists:apps/companion-user-flutter/.maestro/flows/android-smoke.yaml')
        && checkIds.includes('exists:apps/companion-user-flutter/.maestro/flows/ios-smoke.yaml');
      checks.push({
        id: 'mobile_device_farm_config_status_pass',
        pass: mobileDeviceFarmConfigStatus === 'pass',
        detail: `mobile-device-farm-config-latest.json status=${mobileDeviceFarmConfigStatus || '(missing)'}`,
      });
      checks.push({
        id: 'mobile_device_farm_config_fresh',
        pass: mobileDeviceFarmConfigFresh,
        detail: mobileDeviceFarmConfigFresh
          ? `${mobileDeviceFarmConfigAge.toFixed(2)}h <= ${mobileDeviceFarmConfigMaxAgeHours}h`
          : mobileDeviceFarmConfigTimestamp
            ? `${(mobileDeviceFarmConfigAge || 0).toFixed(2)}h > ${mobileDeviceFarmConfigMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'mobile_device_farm_config_current_path_checks_present',
        pass: currentPathChecksPresent,
        detail: currentPathChecksPresent
          ? 'artifact includes active flutter-user maestro path checks'
          : 'artifact missing active flutter-user maestro path checks',
      });
    } catch (err) {
      checks.push({
        id: 'mobile_device_farm_config_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'mobile_device_farm_config_present',
      pass: false,
      detail: 'docs/release/status/mobile-device-farm-config-latest.json missing',
    });
  }

  if (fs.existsSync(mobileDeviceFarmPath)) {
    try {
      const mobileDeviceFarm = JSON.parse(fs.readFileSync(mobileDeviceFarmPath, 'utf8').replace(/^\uFEFF/, ''));
      const mobileDeviceFarmStatus = String((mobileDeviceFarm && mobileDeviceFarm.status) || '').toLowerCase();
      const mobileDeviceFarmTimestamp = extractTimestampIso(mobileDeviceFarm);
      const mobileDeviceFarmAge = ageHours(mobileDeviceFarmTimestamp);
      const mobileDeviceFarmFresh = typeof mobileDeviceFarmAge === 'number'
        && mobileDeviceFarmAge <= mobileDeviceFarmMaxAgeHours;
      const mobileDeviceFarmRunId = String(mobileDeviceFarm?.run_id || mobileDeviceFarm?.source_run_id || '').trim();
      const mobileDeviceFarmHeadSha = String(mobileDeviceFarm?.head_sha || '').trim();
      checks.push({
        id: 'mobile_device_farm_status_pass',
        pass: mobileDeviceFarmStatus === 'pass',
        detail: `mobile-device-farm-latest.json status=${mobileDeviceFarmStatus || '(missing)'}`,
      });
      checks.push({
        id: 'mobile_device_farm_fresh',
        pass: mobileDeviceFarmFresh,
        detail: mobileDeviceFarmFresh
          ? `${mobileDeviceFarmAge.toFixed(2)}h <= ${mobileDeviceFarmMaxAgeHours}h`
          : mobileDeviceFarmTimestamp
            ? `${(mobileDeviceFarmAge || 0).toFixed(2)}h > ${mobileDeviceFarmMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'mobile_device_farm_provenance_present',
        pass: Boolean(mobileDeviceFarmRunId) && /^[a-f0-9]{7,40}$/i.test(mobileDeviceFarmHeadSha),
        detail: `run_id=${mobileDeviceFarmRunId || '(missing)'}; head_sha=${mobileDeviceFarmHeadSha || '(missing)'}`,
      });
    } catch (err) {
      checks.push({
        id: 'mobile_device_farm_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'mobile_device_farm_present',
      pass: false,
      detail: 'docs/release/status/mobile-device-farm-latest.json missing',
    });
  }

  if (fs.existsSync(mobileLegalUrlsPath)) {
    try {
      const mobileLegalUrls = JSON.parse(fs.readFileSync(mobileLegalUrlsPath, 'utf8').replace(/^\uFEFF/, ''));
      const mobileLegalUrlsStatus = String((mobileLegalUrls && mobileLegalUrls.status) || '').toLowerCase();
      const mobileLegalUrlsTimestamp = extractTimestampIso(mobileLegalUrls);
      const mobileLegalUrlsAge = ageHours(mobileLegalUrlsTimestamp);
      const mobileLegalUrlsFresh = typeof mobileLegalUrlsAge === 'number'
        && mobileLegalUrlsAge <= mobileLegalUrlsMaxAgeHours;
      checks.push({
        id: 'mobile_legal_urls_status_pass',
        pass: mobileLegalUrlsStatus === 'pass',
        detail: `mobile-legal-urls-latest.json status=${mobileLegalUrlsStatus || '(missing)'}`,
      });
      checks.push({
        id: 'mobile_legal_urls_fresh',
        pass: mobileLegalUrlsFresh,
        detail: mobileLegalUrlsFresh
          ? `${mobileLegalUrlsAge.toFixed(2)}h <= ${mobileLegalUrlsMaxAgeHours}h`
          : mobileLegalUrlsTimestamp
            ? `${(mobileLegalUrlsAge || 0).toFixed(2)}h > ${mobileLegalUrlsMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'mobile_legal_urls_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'mobile_legal_urls_present',
      pass: false,
      detail: 'docs/release/status/mobile-legal-urls-latest.json missing',
    });
  }

  if (fs.existsSync(mobileC8IndexPath)) {
    try {
      const mobileC8Index = JSON.parse(fs.readFileSync(mobileC8IndexPath, 'utf8').replace(/^\uFEFF/, ''));
      const mobileC8IndexStatus = String((mobileC8Index && mobileC8Index.status) || '').toLowerCase();
      const mobileC8IndexTimestamp = extractTimestampIso(mobileC8Index);
      const mobileC8IndexAge = ageHours(mobileC8IndexTimestamp);
      const mobileC8IndexFresh = typeof mobileC8IndexAge === 'number'
        && mobileC8IndexAge <= mobileC8IndexMaxAgeHours;
      checks.push({
        id: 'mobile_c8_index_status_pass',
        pass: mobileC8IndexStatus === 'pass',
        detail: `mobile-c8-index-latest.json status=${mobileC8IndexStatus || '(missing)'}`,
      });
      checks.push({
        id: 'mobile_c8_index_fresh',
        pass: mobileC8IndexFresh,
        detail: mobileC8IndexFresh
          ? `${mobileC8IndexAge.toFixed(2)}h <= ${mobileC8IndexMaxAgeHours}h`
          : mobileC8IndexTimestamp
            ? `${(mobileC8IndexAge || 0).toFixed(2)}h > ${mobileC8IndexMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'mobile_c8_index_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'mobile_c8_index_present',
      pass: false,
      detail: 'docs/release/status/mobile-c8-index-latest.json missing',
    });
  }

  if (fs.existsSync(resumableStreamPath)) {
    try {
      const resumableStream = JSON.parse(fs.readFileSync(resumableStreamPath, 'utf8').replace(/^\uFEFF/, ''));
      const resumableStatus = String((resumableStream && resumableStream.status) || '').toLowerCase();
      const resumableTimestamp = extractTimestampIso(resumableStream);
      const resumableAge = ageHours(resumableTimestamp);
      const resumableFresh = typeof resumableAge === 'number' && resumableAge <= resumableStreamMaxAgeHours;
      checks.push({
        id: 'resumable_stream_status_pass',
        pass: resumableStatus === 'pass',
        detail: `resumable-stream-latest.json status=${resumableStatus || '(missing)'}`,
      });
      checks.push({
        id: 'resumable_stream_fresh',
        pass: resumableFresh,
        detail: resumableFresh
          ? `${resumableAge.toFixed(2)}h <= ${resumableStreamMaxAgeHours}h`
          : resumableTimestamp
            ? `${(resumableAge || 0).toFixed(2)}h > ${resumableStreamMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'resumable_stream_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'resumable_stream_present',
      pass: false,
      detail: 'docs/release/status/resumable-stream-latest.json missing',
    });
  }

  if (fs.existsSync(webEgressSecurityPath)) {
    try {
      const webEgressSecurity = JSON.parse(fs.readFileSync(webEgressSecurityPath, 'utf8').replace(/^\uFEFF/, ''));
      const webEgressSecurityStatus = String((webEgressSecurity && webEgressSecurity.status) || '').toLowerCase();
      const webEgressSecurityTimestamp = extractTimestampIso(webEgressSecurity);
      const webEgressSecurityAge = ageHours(webEgressSecurityTimestamp);
      const webEgressSecurityFresh = typeof webEgressSecurityAge === 'number'
        && webEgressSecurityAge <= webEgressSecurityMaxAgeHours;
      checks.push({
        id: 'web_egress_security_status_pass',
        pass: webEgressSecurityStatus === 'pass',
        detail: `web-egress-security-latest.json status=${webEgressSecurityStatus || '(missing)'}`,
      });
      checks.push({
        id: 'web_egress_security_fresh',
        pass: webEgressSecurityFresh,
        detail: webEgressSecurityFresh
          ? `${webEgressSecurityAge.toFixed(2)}h <= ${webEgressSecurityMaxAgeHours}h`
          : webEgressSecurityTimestamp
            ? `${(webEgressSecurityAge || 0).toFixed(2)}h > ${webEgressSecurityMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'web_egress_security_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'web_egress_security_present',
      pass: false,
      detail: 'docs/release/status/web-egress-security-latest.json missing',
    });
  }

  if (fs.existsSync(seedBaselinePath)) {
    try {
      const seedBaseline = JSON.parse(fs.readFileSync(seedBaselinePath, 'utf8').replace(/^\uFEFF/, ''));
      const seedStatus = String((seedBaseline && seedBaseline.status) || '').toLowerCase();
      const seedTimestamp = extractTimestampIso(seedBaseline);
      const seedAge = ageHours(seedTimestamp);
      const seedFresh = typeof seedAge === 'number' && seedAge <= seedBaselineMaxAgeHours;
      checks.push({
        id: 'seed_baseline_status_pass',
        pass: seedStatus === 'pass',
        detail: `seed-baseline-latest.json status=${seedStatus || '(missing)'}`,
      });
      checks.push({
        id: 'seed_baseline_fresh',
        pass: seedFresh,
        detail: seedFresh
          ? `${seedAge.toFixed(2)}h <= ${seedBaselineMaxAgeHours}h`
          : seedTimestamp
            ? `${(seedAge || 0).toFixed(2)}h > ${seedBaselineMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'seed_baseline_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'seed_baseline_present',
      pass: false,
      detail: 'docs/release/status/seed-baseline-latest.json missing',
    });
  }

  if (fs.existsSync(apiContractVersionPath)) {
    try {
      const apiContractVersion = JSON.parse(fs.readFileSync(apiContractVersionPath, 'utf8').replace(/^\uFEFF/, ''));
      const apiContractVersionStatus = String((apiContractVersion && apiContractVersion.status) || '').toLowerCase();
      const apiContractVersionTimestamp = extractTimestampIso(apiContractVersion);
      const apiContractVersionAge = ageHours(apiContractVersionTimestamp);
      const apiContractVersionFresh = typeof apiContractVersionAge === 'number'
        && apiContractVersionAge <= apiContractVersionMaxAgeHours;
      const apiContractVersionRunId = String(apiContractVersion?.source_run_id || apiContractVersion?.run_id || '').trim();
      const apiContractVersionHeadSha = String(apiContractVersion?.head_sha || '').trim();
      checks.push({
        id: 'api_contract_version_status_pass',
        pass: apiContractVersionStatus === 'pass',
        detail: `api-contract-version-latest.json status=${apiContractVersionStatus || '(missing)'}`,
      });
      checks.push({
        id: 'api_contract_version_fresh',
        pass: apiContractVersionFresh,
        detail: apiContractVersionFresh
          ? `${apiContractVersionAge.toFixed(2)}h <= ${apiContractVersionMaxAgeHours}h`
          : apiContractVersionTimestamp
            ? `${(apiContractVersionAge || 0).toFixed(2)}h > ${apiContractVersionMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'api_contract_version_provenance_present',
        pass: Boolean(apiContractVersionRunId) && /^[a-f0-9]{7,40}$/i.test(apiContractVersionHeadSha),
        detail: `run_id=${apiContractVersionRunId || '(missing)'}; head_sha=${apiContractVersionHeadSha || '(missing)'}`,
      });
    } catch (err) {
      checks.push({
        id: 'api_contract_version_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'api_contract_version_present',
      pass: false,
      detail: 'docs/release/status/api-contract-version-latest.json missing',
    });
  }

  if (fs.existsSync(apiOpenapiContractPath)) {
    try {
      const apiOpenapiContract = JSON.parse(fs.readFileSync(apiOpenapiContractPath, 'utf8').replace(/^\uFEFF/, ''));
      const apiOpenapiContractStatus = String((apiOpenapiContract && apiOpenapiContract.status) || '').toLowerCase();
      const apiOpenapiContractTimestamp = extractTimestampIso(apiOpenapiContract);
      const apiOpenapiContractAge = ageHours(apiOpenapiContractTimestamp);
      const apiOpenapiContractFresh = typeof apiOpenapiContractAge === 'number'
        && apiOpenapiContractAge <= apiOpenapiContractMaxAgeHours;
      const apiOpenapiContractRunId = String(apiOpenapiContract?.source_run_id || apiOpenapiContract?.run_id || '').trim();
      const apiOpenapiContractHeadSha = String(apiOpenapiContract?.head_sha || '').trim();
      checks.push({
        id: 'api_openapi_contract_status_pass',
        pass: apiOpenapiContractStatus === 'pass',
        detail: `api-openapi-contract-latest.json status=${apiOpenapiContractStatus || '(missing)'}`,
      });
      checks.push({
        id: 'api_openapi_contract_fresh',
        pass: apiOpenapiContractFresh,
        detail: apiOpenapiContractFresh
          ? `${apiOpenapiContractAge.toFixed(2)}h <= ${apiOpenapiContractMaxAgeHours}h`
          : apiOpenapiContractTimestamp
            ? `${(apiOpenapiContractAge || 0).toFixed(2)}h > ${apiOpenapiContractMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'api_openapi_contract_provenance_present',
        pass: Boolean(apiOpenapiContractRunId) && /^[a-f0-9]{7,40}$/i.test(apiOpenapiContractHeadSha),
        detail: `run_id=${apiOpenapiContractRunId || '(missing)'}; head_sha=${apiOpenapiContractHeadSha || '(missing)'}`,
      });
    } catch (err) {
      checks.push({
        id: 'api_openapi_contract_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'api_openapi_contract_present',
      pass: false,
      detail: 'docs/release/status/api-openapi-contract-latest.json missing',
    });
  }

  if (fs.existsSync(apiRequestSchemaCoveragePath)) {
    try {
      const apiRequestSchemaCoverage = JSON.parse(fs.readFileSync(apiRequestSchemaCoveragePath, 'utf8').replace(/^\uFEFF/, ''));
      const apiRequestSchemaCoverageStatus = String((apiRequestSchemaCoverage && apiRequestSchemaCoverage.status) || '').toLowerCase();
      const apiRequestSchemaCoverageTimestamp = extractTimestampIso(apiRequestSchemaCoverage);
      const apiRequestSchemaCoverageAge = ageHours(apiRequestSchemaCoverageTimestamp);
      const apiRequestSchemaCoverageFresh = typeof apiRequestSchemaCoverageAge === 'number'
        && apiRequestSchemaCoverageAge <= apiRequestSchemaCoverageMaxAgeHours;
      const apiRequestSchemaCoverageRunId = String(apiRequestSchemaCoverage?.source_run_id || apiRequestSchemaCoverage?.run_id || '').trim();
      const apiRequestSchemaCoverageHeadSha = String(apiRequestSchemaCoverage?.head_sha || '').trim();
      checks.push({
        id: 'api_request_schema_coverage_status_pass',
        pass: apiRequestSchemaCoverageStatus === 'pass',
        detail: `api-request-body-schema-coverage-latest.json status=${apiRequestSchemaCoverageStatus || '(missing)'}`,
      });
      checks.push({
        id: 'api_request_schema_coverage_fresh',
        pass: apiRequestSchemaCoverageFresh,
        detail: apiRequestSchemaCoverageFresh
          ? `${apiRequestSchemaCoverageAge.toFixed(2)}h <= ${apiRequestSchemaCoverageMaxAgeHours}h`
          : apiRequestSchemaCoverageTimestamp
            ? `${(apiRequestSchemaCoverageAge || 0).toFixed(2)}h > ${apiRequestSchemaCoverageMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'api_request_schema_coverage_provenance_present',
        pass: Boolean(apiRequestSchemaCoverageRunId) && /^[a-f0-9]{7,40}$/i.test(apiRequestSchemaCoverageHeadSha),
        detail: `run_id=${apiRequestSchemaCoverageRunId || '(missing)'}; head_sha=${apiRequestSchemaCoverageHeadSha || '(missing)'}`,
      });
    } catch (err) {
      checks.push({
        id: 'api_request_schema_coverage_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'api_request_schema_coverage_present',
      pass: false,
      detail: 'docs/release/status/api-request-body-schema-coverage-latest.json missing',
    });
  }

  if (fs.existsSync(apiReliabilityObservabilityPath)) {
    try {
      const apiReliabilityObservability = JSON.parse(
        fs.readFileSync(apiReliabilityObservabilityPath, 'utf8').replace(/^\uFEFF/, ''),
      );
      const apiReliabilityObservabilityStatus = String(
        (apiReliabilityObservability && apiReliabilityObservability.status) || '',
      ).toLowerCase();
      const apiReliabilityObservabilityTimestamp = extractTimestampIso(apiReliabilityObservability);
      const apiReliabilityObservabilityAge = ageHours(apiReliabilityObservabilityTimestamp);
      const apiReliabilityObservabilityFresh = typeof apiReliabilityObservabilityAge === 'number'
        && apiReliabilityObservabilityAge <= apiReliabilityObservabilityMaxAgeHours;
      const apiReliabilityObservabilityRunId = String(
        apiReliabilityObservability?.source_run_id || apiReliabilityObservability?.run_id || '',
      ).trim();
      const apiReliabilityObservabilityHeadSha = String(apiReliabilityObservability?.head_sha || '').trim();
      checks.push({
        id: 'api_reliability_observability_status_pass',
        pass: apiReliabilityObservabilityStatus === 'pass',
        detail: `api-reliability-observability-latest.json status=${apiReliabilityObservabilityStatus || '(missing)'}`,
      });
      checks.push({
        id: 'api_reliability_observability_fresh',
        pass: apiReliabilityObservabilityFresh,
        detail: apiReliabilityObservabilityFresh
          ? `${apiReliabilityObservabilityAge.toFixed(2)}h <= ${apiReliabilityObservabilityMaxAgeHours}h`
          : apiReliabilityObservabilityTimestamp
            ? `${(apiReliabilityObservabilityAge || 0).toFixed(2)}h > ${apiReliabilityObservabilityMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'api_reliability_observability_provenance_present',
        pass: Boolean(apiReliabilityObservabilityRunId) && /^[a-f0-9]{7,40}$/i.test(apiReliabilityObservabilityHeadSha),
        detail: `run_id=${apiReliabilityObservabilityRunId || '(missing)'}; head_sha=${apiReliabilityObservabilityHeadSha || '(missing)'}`,
      });
    } catch (err) {
      checks.push({
        id: 'api_reliability_observability_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'api_reliability_observability_present',
      pass: false,
      detail: 'docs/release/status/api-reliability-observability-latest.json missing',
    });
  }

  if (fs.existsSync(benchmarkSuitePath)) {
    try {
      const benchmarkSuite = JSON.parse(fs.readFileSync(benchmarkSuitePath, 'utf8').replace(/^\uFEFF/, ''));
      const benchmarkStatus = String((benchmarkSuite && benchmarkSuite.status) || '').toLowerCase();
      const benchmarkTimestamp = extractTimestampIso(benchmarkSuite);
      const benchmarkAge = ageHours(benchmarkTimestamp);
      const benchmarkFresh = typeof benchmarkAge === 'number' && benchmarkAge <= benchmarkSuiteMaxAgeHours;
      const benchmarkChecks = Array.isArray(benchmarkSuite?.checks) ? benchmarkSuite.checks : [];
      const benchmarkCheckMap = new Map();
      for (const check of benchmarkChecks) {
        const id = String(check?.id || '').trim();
        if (!id) continue;
        benchmarkCheckMap.set(id, check);
      }
      const requiredBenchmarkChecks = [
        'f1_onboarding_status_pass',
        'f1_onboarding_fresh',
        'f2_ui_operability_status_pass',
        'f2_ui_operability_fresh',
        'f3_reliability_recovery_status_pass',
        'f3_reliability_recovery_fresh',
        'f4_security_defaults_status_pass',
        'f4_security_defaults_fresh',
      ];
      checks.push({
        id: 'benchmark_suite_status_pass',
        pass: benchmarkStatus === 'pass',
        detail: `benchmark-suite-latest.json status=${benchmarkStatus || '(missing)'}`,
      });
      checks.push({
        id: 'benchmark_suite_fresh',
        pass: benchmarkFresh,
        detail: benchmarkFresh
          ? `${benchmarkAge.toFixed(2)}h <= ${benchmarkSuiteMaxAgeHours}h`
          : benchmarkTimestamp
            ? `${(benchmarkAge || 0).toFixed(2)}h > ${benchmarkSuiteMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      for (const requiredId of requiredBenchmarkChecks) {
        const check = benchmarkCheckMap.get(requiredId);
        checks.push({
          id: `benchmark_suite_required_check_pass:${requiredId}`,
          pass: Boolean(check) && check.pass === true,
          detail: check
            ? `${requiredId}=${String(check.pass)}`
            : `${requiredId} missing in benchmark-suite-latest.json`,
        });
      }
    } catch (err) {
      checks.push({
        id: 'benchmark_suite_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'benchmark_suite_present',
      pass: false,
      detail: 'docs/release/status/benchmark-suite-latest.json missing',
    });
  }

  if (fs.existsSync(competitorBenchmarkIntegrityPath)) {
    try {
      const competitorBenchmarkIntegrity = JSON.parse(
        fs.readFileSync(competitorBenchmarkIntegrityPath, 'utf8').replace(/^\uFEFF/, ''),
      );
      const competitorBenchmarkIntegrityStatus = String(
        (competitorBenchmarkIntegrity && competitorBenchmarkIntegrity.status) || '',
      ).toLowerCase();
      const competitorBenchmarkIntegrityTimestamp = extractTimestampIso(competitorBenchmarkIntegrity);
      const competitorBenchmarkIntegrityAge = ageHours(competitorBenchmarkIntegrityTimestamp);
      const competitorBenchmarkIntegrityFresh =
        typeof competitorBenchmarkIntegrityAge === 'number'
        && competitorBenchmarkIntegrityAge <= competitorBenchmarkIntegrityMaxAgeHours;
      checks.push({
        id: 'competitor_benchmark_integrity_status_pass',
        pass: competitorBenchmarkIntegrityStatus === 'pass',
        detail: `competitor-benchmark-integrity-latest.json status=${competitorBenchmarkIntegrityStatus || '(missing)'}`,
      });
      checks.push({
        id: 'competitor_benchmark_integrity_fresh',
        pass: competitorBenchmarkIntegrityFresh,
        detail: competitorBenchmarkIntegrityFresh
          ? `${competitorBenchmarkIntegrityAge.toFixed(2)}h <= ${competitorBenchmarkIntegrityMaxAgeHours}h`
          : competitorBenchmarkIntegrityTimestamp
            ? `${(competitorBenchmarkIntegrityAge || 0).toFixed(2)}h > ${competitorBenchmarkIntegrityMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'competitor_benchmark_integrity_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'competitor_benchmark_integrity_present',
      pass: false,
      detail: 'docs/release/status/competitor-benchmark-integrity-latest.json missing',
    });
  }

  if (fs.existsSync(competitorRuntimeGuardPath)) {
    try {
      const competitorRuntimeGuard = JSON.parse(
        fs.readFileSync(competitorRuntimeGuardPath, 'utf8').replace(/^\uFEFF/, ''),
      );
      const competitorRuntimeGuardStatus = String(
        (competitorRuntimeGuard && competitorRuntimeGuard.status) || '',
      ).toLowerCase();
      const competitorRuntimeGuardTimestamp = extractTimestampIso(competitorRuntimeGuard);
      const competitorRuntimeGuardAge = ageHours(competitorRuntimeGuardTimestamp);
      const competitorRuntimeGuardFresh =
        typeof competitorRuntimeGuardAge === 'number'
        && competitorRuntimeGuardAge <= competitorRuntimeGuardMaxAgeHours;
      const competitorRuntimeGuardRunId = String(
        competitorRuntimeGuard?.provenance?.source_run_id
          || competitorRuntimeGuard?.source_run_id
          || competitorRuntimeGuard?.run_id
          || '',
      ).trim();
      const competitorRuntimeGuardHeadSha = String(
        competitorRuntimeGuard?.provenance?.head_sha
          || competitorRuntimeGuard?.head_sha
          || '',
      ).trim();
      checks.push({
        id: 'competitor_runtime_guard_status_pass',
        pass: competitorRuntimeGuardStatus === 'pass',
        detail: `competitor-runtime-guard-latest.json status=${competitorRuntimeGuardStatus || '(missing)'}`,
      });
      checks.push({
        id: 'competitor_runtime_guard_fresh',
        pass: competitorRuntimeGuardFresh,
        detail: competitorRuntimeGuardFresh
          ? `${competitorRuntimeGuardAge.toFixed(2)}h <= ${competitorRuntimeGuardMaxAgeHours}h`
          : competitorRuntimeGuardTimestamp
            ? `${(competitorRuntimeGuardAge || 0).toFixed(2)}h > ${competitorRuntimeGuardMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'competitor_runtime_guard_provenance_present',
        pass: Boolean(competitorRuntimeGuardRunId) && /^[a-f0-9]{7,40}$/i.test(competitorRuntimeGuardHeadSha),
        detail: `run_id=${competitorRuntimeGuardRunId || '(missing)'}; head_sha=${competitorRuntimeGuardHeadSha || '(missing)'}`,
      });
    } catch (err) {
      checks.push({
        id: 'competitor_runtime_guard_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'competitor_runtime_guard_present',
      pass: false,
      detail: 'docs/release/status/competitor-runtime-guard-latest.json missing',
    });
  }

  if (fs.existsSync(quickstartInstallerCrosshostPath)) {
    try {
      const quickstartCrosshost = JSON.parse(fs.readFileSync(quickstartInstallerCrosshostPath, 'utf8').replace(/^\uFEFF/, ''));
      const quickstartCrosshostStatus = String((quickstartCrosshost && quickstartCrosshost.status) || '').toLowerCase();
      const quickstartCrosshostTimestamp = extractTimestampIso(quickstartCrosshost);
      const quickstartCrosshostAge = ageHours(quickstartCrosshostTimestamp);
      const quickstartCrosshostFresh =
        typeof quickstartCrosshostAge === 'number'
        && quickstartCrosshostAge <= quickstartInstallerCrosshostMaxAgeHours;
      const quickstartCrosshostChecks = Array.isArray(quickstartCrosshost?.checks) ? quickstartCrosshost.checks : [];
      const quickstartCrosshostProfile = String(quickstartCrosshost?.platform_profile || '').trim().toLowerCase();
      const hasPosixBaselineCheck = quickstartCrosshostChecks.some((entry) => entry && entry.id === 'sh_installer_dry_run');
      const requiredCrosshostChecks = quickstartCrosshostProfile === 'windows_native'
        ? ['powershell_installer_dry_run', 'cmd_installer_dry_run']
        : (quickstartCrosshostProfile === 'posix_baseline' || hasPosixBaselineCheck)
          ? ['sh_installer_dry_run']
          : ['powershell_installer_dry_run', 'cmd_installer_dry_run'];
      const crosshostMissingRequired = requiredCrosshostChecks.filter(
        (id) => !quickstartCrosshostChecks.some((entry) => entry && entry.id === id),
      );
      const crosshostFailedRequired = requiredCrosshostChecks.filter(
        (id) => !quickstartCrosshostChecks.some((entry) => entry && entry.id === id && entry.pass === true),
      );
      checks.push({
        id: 'quickstart_installer_crosshost_status_pass',
        pass: quickstartCrosshostStatus === 'pass',
        detail: `quickstart-installer-crosshost-latest.json status=${quickstartCrosshostStatus || '(missing)'}`,
      });
      checks.push({
        id: 'quickstart_installer_crosshost_fresh',
        pass: quickstartCrosshostFresh,
        detail: quickstartCrosshostFresh
          ? `${quickstartCrosshostAge.toFixed(2)}h <= ${quickstartInstallerCrosshostMaxAgeHours}h`
          : quickstartCrosshostTimestamp
            ? `${(quickstartCrosshostAge || 0).toFixed(2)}h > ${quickstartInstallerCrosshostMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'quickstart_installer_crosshost_required_checks_present',
        pass: crosshostMissingRequired.length === 0,
        detail: crosshostMissingRequired.length === 0
          ? `required checks present (${requiredCrosshostChecks.join(', ')})`
          : `missing required checks: ${crosshostMissingRequired.join(', ')}`,
      });
      checks.push({
        id: 'quickstart_installer_crosshost_required_checks_pass',
        pass: crosshostFailedRequired.length === 0,
        detail: crosshostFailedRequired.length === 0
          ? `required checks pass (${requiredCrosshostChecks.join(', ')})`
          : `required checks failing: ${crosshostFailedRequired.join(', ')}`,
      });
    } catch (err) {
      checks.push({
        id: 'quickstart_installer_crosshost_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'quickstart_installer_crosshost_present',
      pass: false,
      detail: 'docs/release/status/quickstart-installer-crosshost-latest.json missing',
    });
  }

  if (fs.existsSync(quickstartInstallerRuntimePath)) {
    try {
      const quickstartRuntime = JSON.parse(fs.readFileSync(quickstartInstallerRuntimePath, 'utf8').replace(/^\uFEFF/, ''));
      const quickstartRuntimeStatus = String((quickstartRuntime && quickstartRuntime.status) || '').toLowerCase();
      const quickstartRuntimeTimestamp = extractTimestampIso(quickstartRuntime);
      const quickstartRuntimeAge = ageHours(quickstartRuntimeTimestamp);
      const quickstartRuntimeFresh =
        typeof quickstartRuntimeAge === 'number'
        && quickstartRuntimeAge <= quickstartInstallerRuntimeMaxAgeHours;
      const quickstartRuntimeChecks = Array.isArray(quickstartRuntime?.checks) ? quickstartRuntime.checks : [];
      const quickstartRuntimeProfile = String(quickstartRuntime?.platform_profile || '').trim().toLowerCase();
      const hasPosixRuntimeBaseline = quickstartRuntimeChecks.some(
        (entry) => entry && entry.id === 'quickstart_runtime_baseline_installer_dry_run',
      );
      const requiredRuntimeChecks = quickstartRuntimeProfile === 'windows_native'
        ? [
          'powershell_installer_exit_ok',
          'powershell_installer_functional_ready',
          'wsl_sh_installer_exit_and_functional_ready',
          'quickstart_runtime_stack_healthz_operable',
          'quickstart_runtime_auth_surface_operable',
        ]
        : (quickstartRuntimeProfile === 'posix_baseline' || hasPosixRuntimeBaseline)
          ? [
            'quickstart_runtime_baseline_installer_dry_run',
            'quickstart_runtime_baseline_install_status_emitted',
            'quickstart_runtime_stack_healthz_operable',
            'quickstart_runtime_auth_surface_operable',
          ]
          : [
            'powershell_installer_exit_ok',
            'powershell_installer_functional_ready',
            'quickstart_runtime_stack_healthz_operable',
            'quickstart_runtime_auth_surface_operable',
          ];
      const runtimeMissingRequired = requiredRuntimeChecks.filter(
        (id) => !quickstartRuntimeChecks.some((entry) => entry && entry.id === id),
      );
      const runtimeFailedRequired = requiredRuntimeChecks.filter(
        (id) => !quickstartRuntimeChecks.some((entry) => entry && entry.id === id && entry.pass === true),
      );
      checks.push({
        id: 'quickstart_installer_runtime_status_pass',
        pass: quickstartRuntimeStatus === 'pass',
        detail: `quickstart-installer-runtime-latest.json status=${quickstartRuntimeStatus || '(missing)'}`,
      });
      checks.push({
        id: 'quickstart_installer_runtime_fresh',
        pass: quickstartRuntimeFresh,
        detail: quickstartRuntimeFresh
          ? `${quickstartRuntimeAge.toFixed(2)}h <= ${quickstartInstallerRuntimeMaxAgeHours}h`
          : quickstartRuntimeTimestamp
            ? `${(quickstartRuntimeAge || 0).toFixed(2)}h > ${quickstartInstallerRuntimeMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'quickstart_installer_runtime_required_checks_present',
        pass: runtimeMissingRequired.length === 0,
        detail: runtimeMissingRequired.length === 0
          ? `required checks present (${requiredRuntimeChecks.join(', ')})`
          : `missing required checks: ${runtimeMissingRequired.join(', ')}`,
      });
      checks.push({
        id: 'quickstart_installer_runtime_required_checks_pass',
        pass: runtimeFailedRequired.length === 0,
        detail: runtimeFailedRequired.length === 0
          ? `required checks pass (${requiredRuntimeChecks.join(', ')})`
          : `required checks failing: ${runtimeFailedRequired.join(', ')}`,
      });
    } catch (err) {
      checks.push({
        id: 'quickstart_installer_runtime_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'quickstart_installer_runtime_present',
      pass: false,
      detail: 'docs/release/status/quickstart-installer-runtime-latest.json missing',
    });
  }

  if (fs.existsSync(sastPath)) {
    try {
      const sast = JSON.parse(fs.readFileSync(sastPath, 'utf8').replace(/^\uFEFF/, ''));
      const sastStatus = String((sast && sast.status) || '').toLowerCase();
      const sastTimestamp = extractTimestampIso(sast);
      const sastAge = ageHours(sastTimestamp);
      const sastFresh = typeof sastAge === 'number' && sastAge <= sastMaxAgeHours;
      const sastRunId = String(sast?.source_run_id || sast?.run_id || '').trim();
      const sastHeadSha = String(sast?.head_sha || '').trim();
      checks.push({
        id: 'sast_status_pass',
        pass: sastStatus === 'pass',
        detail: `sast-latest.json status=${sastStatus || '(missing)'}`,
      });
      checks.push({
        id: 'sast_fresh',
        pass: sastFresh,
        detail: sastFresh
          ? `${sastAge.toFixed(2)}h <= ${sastMaxAgeHours}h`
          : sastTimestamp
            ? `${(sastAge || 0).toFixed(2)}h > ${sastMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'sast_provenance_present',
        pass: Boolean(sastRunId) && /^[a-f0-9]{7,40}$/i.test(sastHeadSha),
        detail: `run_id=${sastRunId || '(missing)'}; head_sha=${sastHeadSha || '(missing)'}`,
      });
    } catch (err) {
      checks.push({
        id: 'sast_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'sast_present',
      pass: false,
      detail: 'docs/release/status/sast-latest.json missing',
    });
  }

  if (fs.existsSync(releaseEvidenceBundlePath)) {
    try {
      const releaseEvidenceBundle = JSON.parse(fs.readFileSync(releaseEvidenceBundlePath, 'utf8').replace(/^\uFEFF/, ''));
      const releaseEvidenceBundleStatus = String((releaseEvidenceBundle && releaseEvidenceBundle.status) || '').toLowerCase();
      const releaseEvidenceBundleTimestamp = extractTimestampIso(releaseEvidenceBundle);
      const releaseEvidenceBundleAge = ageHours(releaseEvidenceBundleTimestamp);
      const releaseEvidenceBundleFresh = typeof releaseEvidenceBundleAge === 'number'
        && releaseEvidenceBundleAge <= releaseEvidenceBundleMaxAgeHours;
      checks.push({
        id: 'release_evidence_bundle_status_pass',
        pass: releaseEvidenceBundleStatus === 'pass',
        detail: `release-evidence-bundle-latest.json status=${releaseEvidenceBundleStatus || '(missing)'}`,
      });
      checks.push({
        id: 'release_evidence_bundle_fresh',
        pass: releaseEvidenceBundleFresh,
        detail: releaseEvidenceBundleFresh
          ? `${releaseEvidenceBundleAge.toFixed(2)}h <= ${releaseEvidenceBundleMaxAgeHours}h`
          : releaseEvidenceBundleTimestamp
            ? `${(releaseEvidenceBundleAge || 0).toFixed(2)}h > ${releaseEvidenceBundleMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'release_evidence_bundle_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'release_evidence_bundle_present',
      pass: false,
      detail: 'docs/release/status/release-evidence-bundle-latest.json missing',
    });
  }

  if (fs.existsSync(runbookScenarioMatrixPath)) {
    try {
      const runbookScenarioMatrix = JSON.parse(fs.readFileSync(runbookScenarioMatrixPath, 'utf8').replace(/^\uFEFF/, ''));
      const runbookScenarioMatrixStatus = String((runbookScenarioMatrix && runbookScenarioMatrix.status) || '').toLowerCase();
      const runbookScenarioMatrixTimestamp = extractTimestampIso(runbookScenarioMatrix);
      const runbookScenarioMatrixAge = ageHours(runbookScenarioMatrixTimestamp);
      const runbookScenarioMatrixFresh = typeof runbookScenarioMatrixAge === 'number'
        && runbookScenarioMatrixAge <= runbookScenarioMatrixMaxAgeHours;
      checks.push({
        id: 'runbook_scenario_matrix_status_pass',
        pass: runbookScenarioMatrixStatus === 'pass',
        detail: `runbook-scenario-matrix-latest.json status=${runbookScenarioMatrixStatus || '(missing)'}`,
      });
      checks.push({
        id: 'runbook_scenario_matrix_fresh',
        pass: runbookScenarioMatrixFresh,
        detail: runbookScenarioMatrixFresh
          ? `${runbookScenarioMatrixAge.toFixed(2)}h <= ${runbookScenarioMatrixMaxAgeHours}h`
          : runbookScenarioMatrixTimestamp
            ? `${(runbookScenarioMatrixAge || 0).toFixed(2)}h > ${runbookScenarioMatrixMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'runbook_scenario_matrix_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'runbook_scenario_matrix_present',
      pass: false,
      detail: 'docs/release/status/runbook-scenario-matrix-latest.json missing',
    });
  }

  if (fs.existsSync(stagingMigrationVerificationPath)) {
    try {
      const stagingMigrationVerification = JSON.parse(fs.readFileSync(stagingMigrationVerificationPath, 'utf8').replace(/^\uFEFF/, ''));
      const stagingMigrationVerificationStatus = String((stagingMigrationVerification && stagingMigrationVerification.status) || '').toLowerCase();
      const stagingMigrationVerificationTimestamp = extractTimestampIso(stagingMigrationVerification);
      const stagingMigrationVerificationAge = ageHours(stagingMigrationVerificationTimestamp);
      const stagingMigrationVerificationFresh = typeof stagingMigrationVerificationAge === 'number'
        && stagingMigrationVerificationAge <= stagingMigrationVerificationMaxAgeHours;
      checks.push({
        id: 'staging_migration_verification_status_pass',
        pass: stagingMigrationVerificationStatus === 'pass',
        detail: `staging-migration-verification-latest.json status=${stagingMigrationVerificationStatus || '(missing)'}`,
      });
      checks.push({
        id: 'staging_migration_verification_fresh',
        pass: stagingMigrationVerificationFresh,
        detail: stagingMigrationVerificationFresh
          ? `${stagingMigrationVerificationAge.toFixed(2)}h <= ${stagingMigrationVerificationMaxAgeHours}h`
          : stagingMigrationVerificationTimestamp
            ? `${(stagingMigrationVerificationAge || 0).toFixed(2)}h > ${stagingMigrationVerificationMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'staging_migration_verification_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'staging_migration_verification_present',
      pass: false,
      detail: 'docs/release/status/staging-migration-verification-latest.json missing',
    });
  }

  if (fs.existsSync(featureFlagGovernancePath)) {
    try {
      const featureFlagGovernance = JSON.parse(fs.readFileSync(featureFlagGovernancePath, 'utf8').replace(/^\uFEFF/, ''));
      const featureFlagGovernanceStatus = String((featureFlagGovernance && featureFlagGovernance.status) || '').toLowerCase();
      const featureFlagGovernanceTimestamp = extractTimestampIso(featureFlagGovernance);
      const featureFlagGovernanceAge = ageHours(featureFlagGovernanceTimestamp);
      const featureFlagGovernanceFresh = typeof featureFlagGovernanceAge === 'number'
        && featureFlagGovernanceAge <= featureFlagGovernanceMaxAgeHours;
      checks.push({
        id: 'feature_flag_governance_status_pass',
        pass: featureFlagGovernanceStatus === 'pass',
        detail: `feature-flag-governance-latest.json status=${featureFlagGovernanceStatus || '(missing)'}`,
      });
      checks.push({
        id: 'feature_flag_governance_fresh',
        pass: featureFlagGovernanceFresh,
        detail: featureFlagGovernanceFresh
          ? `${featureFlagGovernanceAge.toFixed(2)}h <= ${featureFlagGovernanceMaxAgeHours}h`
          : featureFlagGovernanceTimestamp
            ? `${(featureFlagGovernanceAge || 0).toFixed(2)}h > ${featureFlagGovernanceMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'feature_flag_governance_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'feature_flag_governance_present',
      pass: false,
      detail: 'docs/release/status/feature-flag-governance-latest.json missing',
    });
  }

  if (fs.existsSync(soakHardwareEvidencePath)) {
    try {
      const soakHardwareEvidence = JSON.parse(fs.readFileSync(soakHardwareEvidencePath, 'utf8').replace(/^\uFEFF/, ''));
      const soakHardwareEvidenceStatus = String((soakHardwareEvidence && soakHardwareEvidence.status) || '').toLowerCase();
      const soakHardwareEvidenceTimestamp = extractTimestampIso(soakHardwareEvidence);
      const soakHardwareEvidenceAge = ageHours(soakHardwareEvidenceTimestamp);
      const soakHardwareEvidenceFresh = typeof soakHardwareEvidenceAge === 'number'
        && soakHardwareEvidenceAge <= soakHardwareEvidenceMaxAgeHours;
      checks.push({
        id: 'soak_hardware_evidence_status_pass',
        pass: soakHardwareEvidenceStatus === 'pass',
        detail: `soak-hardware-evidence-latest.json status=${soakHardwareEvidenceStatus || '(missing)'}`,
      });
      checks.push({
        id: 'soak_hardware_evidence_fresh',
        pass: soakHardwareEvidenceFresh,
        detail: soakHardwareEvidenceFresh
          ? `${soakHardwareEvidenceAge.toFixed(2)}h <= ${soakHardwareEvidenceMaxAgeHours}h`
          : soakHardwareEvidenceTimestamp
            ? `${(soakHardwareEvidenceAge || 0).toFixed(2)}h > ${soakHardwareEvidenceMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'soak_hardware_evidence_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'soak_hardware_evidence_present',
      pass: false,
      detail: 'docs/release/status/soak-hardware-evidence-latest.json missing',
    });
  }

  if (fs.existsSync(releaseCandidatePackagePath)) {
    try {
      const releaseCandidatePackage = JSON.parse(fs.readFileSync(releaseCandidatePackagePath, 'utf8').replace(/^\uFEFF/, ''));
      const releaseCandidatePackageStatus = String((releaseCandidatePackage && releaseCandidatePackage.status) || '').toLowerCase();
      const releaseCandidatePackageTimestamp = extractTimestampIso(releaseCandidatePackage);
      const releaseCandidatePackageAge = ageHours(releaseCandidatePackageTimestamp);
      const releaseCandidatePackageFresh = typeof releaseCandidatePackageAge === 'number'
        && releaseCandidatePackageAge <= releaseCandidatePackageMaxAgeHours;
      checks.push({
        id: 'release_candidate_package_status_pass',
        pass: releaseCandidatePackageStatus === 'pass',
        detail: `release-candidate-package-latest.json status=${releaseCandidatePackageStatus || '(missing)'}`,
      });
      checks.push({
        id: 'release_candidate_package_fresh',
        pass: releaseCandidatePackageFresh,
        detail: releaseCandidatePackageFresh
          ? `${releaseCandidatePackageAge.toFixed(2)}h <= ${releaseCandidatePackageMaxAgeHours}h`
          : releaseCandidatePackageTimestamp
            ? `${(releaseCandidatePackageAge || 0).toFixed(2)}h > ${releaseCandidatePackageMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'release_candidate_package_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'release_candidate_package_present',
      pass: false,
      detail: 'docs/release/status/release-candidate-package-latest.json missing',
    });
  }

  if (fs.existsSync(releaseOpsDrillPath)) {
    try {
      const releaseOpsDrill = JSON.parse(fs.readFileSync(releaseOpsDrillPath, 'utf8').replace(/^\uFEFF/, ''));
      const releaseOpsDrillStatus = String((releaseOpsDrill && releaseOpsDrill.status) || '').toLowerCase();
      const releaseOpsDrillTimestamp = extractTimestampIso(releaseOpsDrill);
      const releaseOpsDrillAge = ageHours(releaseOpsDrillTimestamp);
      const releaseOpsDrillFresh = typeof releaseOpsDrillAge === 'number'
        && releaseOpsDrillAge <= releaseOpsDrillMaxAgeHours;
      const releaseOpsDrillRunId = String(releaseOpsDrill?.source_run_id || releaseOpsDrill?.run_id || '').trim();
      const releaseOpsDrillHeadSha = String(releaseOpsDrill?.head_sha || '').trim();
      const releaseOpsDrillArtifactSha = String(releaseOpsDrill?.artifact?.sha256 || '').trim();
      const sourceHeadSha = String(ciGates?.source_head_sha || '').trim();
      checks.push({
        id: 'release_ops_drill_status_pass',
        pass: releaseOpsDrillStatus === 'pass',
        detail: `release-ops-drill-latest.json status=${releaseOpsDrillStatus || '(missing)'}`,
      });
      checks.push({
        id: 'release_ops_drill_fresh',
        pass: releaseOpsDrillFresh,
        detail: releaseOpsDrillFresh
          ? `${releaseOpsDrillAge.toFixed(2)}h <= ${releaseOpsDrillMaxAgeHours}h`
          : releaseOpsDrillTimestamp
            ? `${(releaseOpsDrillAge || 0).toFixed(2)}h > ${releaseOpsDrillMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'release_ops_drill_provenance_present',
        pass: Boolean(releaseOpsDrillRunId) && /^[a-f0-9]{7,40}$/i.test(releaseOpsDrillHeadSha),
        detail: `run_id=${releaseOpsDrillRunId || '(missing)'}; head_sha=${releaseOpsDrillHeadSha || '(missing)'}`,
      });
      checks.push({
        id: 'release_ops_drill_source_sha_match',
        pass: localOnly || !sourceHeadSha || (Boolean(releaseOpsDrillHeadSha) && releaseOpsDrillHeadSha === sourceHeadSha),
        detail: localOnly
          ? `local-only mode (ops_drill_head_sha=${releaseOpsDrillHeadSha || '(missing)'}; source_head_sha=${sourceHeadSha || '(missing)'})`
          : `ops_drill_head_sha=${releaseOpsDrillHeadSha || '(missing)'}; source_head_sha=${sourceHeadSha || '(missing)'}`,
      });
      checks.push({
        id: 'release_ops_drill_artifact_sha_present',
        pass: /^[a-f0-9]{64}$/i.test(releaseOpsDrillArtifactSha),
        detail: releaseOpsDrillArtifactSha
          ? `artifact.sha256=${releaseOpsDrillArtifactSha}`
          : 'missing/invalid artifact.sha256',
      });
    } catch (err) {
      checks.push({
        id: 'release_ops_drill_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'release_ops_drill_present',
      pass: false,
      detail: 'docs/release/status/release-ops-drill-latest.json missing',
    });
  }

  if (fs.existsSync(externalInputResolutionPath)) {
    try {
      const externalInputResolution = JSON.parse(fs.readFileSync(externalInputResolutionPath, 'utf8').replace(/^\uFEFF/, ''));
      const externalInputResolutionStatus = String((externalInputResolution && externalInputResolution.status) || '').toLowerCase();
      const externalInputResolutionTimestamp = extractTimestampIso(externalInputResolution);
      const externalInputResolutionAge = ageHours(externalInputResolutionTimestamp);
      const externalInputResolutionFresh = typeof externalInputResolutionAge === 'number'
        && externalInputResolutionAge <= externalInputResolutionMaxAgeHours;
      checks.push({
        id: 'external_input_resolution_status_pass',
        pass: externalInputResolutionStatus === 'pass',
        detail: `external-input-resolution-latest.json status=${externalInputResolutionStatus || '(missing)'}`,
      });
      checks.push({
        id: 'external_input_resolution_fresh',
        pass: externalInputResolutionFresh,
        detail: externalInputResolutionFresh
          ? `${externalInputResolutionAge.toFixed(2)}h <= ${externalInputResolutionMaxAgeHours}h`
          : externalInputResolutionTimestamp
            ? `${(externalInputResolutionAge || 0).toFixed(2)}h > ${externalInputResolutionMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'external_input_resolution_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'external_input_resolution_present',
      pass: false,
      detail: 'docs/release/status/external-input-resolution-latest.json missing',
    });
  }

  if (fs.existsSync(operabilityAuthSuitePath)) {
    try {
      const operabilityAuthSuite = JSON.parse(fs.readFileSync(operabilityAuthSuitePath, 'utf8').replace(/^\uFEFF/, ''));
      const operabilityAuthSuiteStatus = String((operabilityAuthSuite && operabilityAuthSuite.status) || '').toLowerCase();
      const operabilityAuthSuiteTimestamp = extractTimestampIso(operabilityAuthSuite);
      const operabilityAuthSuiteAge = ageHours(operabilityAuthSuiteTimestamp);
      const operabilityAuthSuiteFresh = typeof operabilityAuthSuiteAge === 'number'
        && operabilityAuthSuiteAge <= operabilityAuthSuiteMaxAgeHours;
      checks.push({
        id: 'operability_auth_suite_status_pass',
        pass: operabilityAuthSuiteStatus === 'pass',
        detail: `operability-auth-suite-latest.json status=${operabilityAuthSuiteStatus || '(missing)'}`,
      });
      checks.push({
        id: 'operability_auth_suite_fresh',
        pass: operabilityAuthSuiteFresh,
        detail: operabilityAuthSuiteFresh
          ? `${operabilityAuthSuiteAge.toFixed(2)}h <= ${operabilityAuthSuiteMaxAgeHours}h`
          : operabilityAuthSuiteTimestamp
            ? `${(operabilityAuthSuiteAge || 0).toFixed(2)}h > ${operabilityAuthSuiteMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
    } catch (err) {
      checks.push({
        id: 'operability_auth_suite_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'operability_auth_suite_present',
      pass: false,
      detail: 'docs/release/status/operability-auth-suite-latest.json missing',
    });
  }

  if (fs.existsSync(performanceE2ePath)) {
    try {
      const performanceE2e = JSON.parse(fs.readFileSync(performanceE2ePath, 'utf8').replace(/^\uFEFF/, ''));
      const performanceE2eStatus = String((performanceE2e && performanceE2e.status) || '').toLowerCase();
      const performanceE2eTimestamp = extractTimestampIso(performanceE2e);
      const performanceE2eAge = ageHours(performanceE2eTimestamp);
      const performanceE2eFresh = typeof performanceE2eAge === 'number'
        && performanceE2eAge <= performanceE2eMaxAgeHours;
      const performanceE2eRunId = String(performanceE2e?.provenance?.run_id || performanceE2e?.run_id || '').trim();
      const performanceE2eHeadSha = String(performanceE2e?.provenance?.head_sha || performanceE2e?.head_sha || '').trim();
      checks.push({
        id: 'performance_e2e_status_pass',
        pass: performanceE2eStatus === 'pass',
        detail: `performance-e2e-latest.json status=${performanceE2eStatus || '(missing)'}`,
      });
      checks.push({
        id: 'performance_e2e_fresh',
        pass: performanceE2eFresh,
        detail: performanceE2eFresh
          ? `${performanceE2eAge.toFixed(2)}h <= ${performanceE2eMaxAgeHours}h`
          : performanceE2eTimestamp
            ? `${(performanceE2eAge || 0).toFixed(2)}h > ${performanceE2eMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'performance_e2e_provenance_present',
        pass: Boolean(performanceE2eRunId) && /^[a-f0-9]{7,40}$/i.test(performanceE2eHeadSha),
        detail: `run_id=${performanceE2eRunId || '(missing)'}; head_sha=${performanceE2eHeadSha || '(missing)'}`,
      });
    } catch (err) {
      checks.push({
        id: 'performance_e2e_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'performance_e2e_present',
      pass: false,
      detail: 'docs/release/status/performance-e2e-latest.json missing',
    });
  }

  if (fs.existsSync(adminRbacPenetrationPath)) {
    try {
      const adminRbacPenetration = JSON.parse(fs.readFileSync(adminRbacPenetrationPath, 'utf8').replace(/^\uFEFF/, ''));
      const adminRbacPenetrationStatus = String((adminRbacPenetration && adminRbacPenetration.status) || '').toLowerCase();
      const adminRbacPenetrationTimestamp = extractTimestampIso(adminRbacPenetration);
      const adminRbacPenetrationAge = ageHours(adminRbacPenetrationTimestamp);
      const adminRbacPenetrationFresh = typeof adminRbacPenetrationAge === 'number'
        && adminRbacPenetrationAge <= adminRbacPenetrationMaxAgeHours;
      const adminRbacRunId = String(adminRbacPenetration?.run_id || adminRbacPenetration?.source_run_id || '').trim();
      const adminRbacHeadSha = String(adminRbacPenetration?.head_sha || '').trim();
      checks.push({
        id: 'admin_rbac_penetration_status_pass',
        pass: adminRbacPenetrationStatus === 'pass',
        detail: `admin-rbac-penetration-latest.json status=${adminRbacPenetrationStatus || '(missing)'}`,
      });
      checks.push({
        id: 'admin_rbac_penetration_fresh',
        pass: adminRbacPenetrationFresh,
        detail: adminRbacPenetrationFresh
          ? `${adminRbacPenetrationAge.toFixed(2)}h <= ${adminRbacPenetrationMaxAgeHours}h`
          : adminRbacPenetrationTimestamp
            ? `${(adminRbacPenetrationAge || 0).toFixed(2)}h > ${adminRbacPenetrationMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'admin_rbac_penetration_provenance_present',
        pass: Boolean(adminRbacRunId) && /^[a-f0-9]{7,40}$/i.test(adminRbacHeadSha),
        detail: `run_id=${adminRbacRunId || '(missing)'}; head_sha=${adminRbacHeadSha || '(missing)'}`,
      });
    } catch (err) {
      checks.push({
        id: 'admin_rbac_penetration_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'admin_rbac_penetration_present',
      pass: false,
      detail: 'docs/release/status/admin-rbac-penetration-latest.json missing',
    });
  }

  if (fs.existsSync(csrfAuthE2ePath)) {
    try {
      const csrfAuthE2e = JSON.parse(fs.readFileSync(csrfAuthE2ePath, 'utf8').replace(/^\uFEFF/, ''));
      const csrfAuthE2eStatus = String((csrfAuthE2e && csrfAuthE2e.status) || '').toLowerCase();
      const csrfAuthE2eTimestamp = extractTimestampIso(csrfAuthE2e);
      const csrfAuthE2eAge = ageHours(csrfAuthE2eTimestamp);
      const csrfAuthE2eFresh = typeof csrfAuthE2eAge === 'number'
        && csrfAuthE2eAge <= csrfAuthE2eMaxAgeHours;
      const csrfAuthRunId = String(csrfAuthE2e?.run_id || csrfAuthE2e?.source_run_id || '').trim();
      const csrfAuthHeadSha = String(csrfAuthE2e?.head_sha || '').trim();
      checks.push({
        id: 'csrf_auth_e2e_status_pass',
        pass: csrfAuthE2eStatus === 'pass',
        detail: `csrf-auth-e2e-latest.json status=${csrfAuthE2eStatus || '(missing)'}`,
      });
      checks.push({
        id: 'csrf_auth_e2e_fresh',
        pass: csrfAuthE2eFresh,
        detail: csrfAuthE2eFresh
          ? `${csrfAuthE2eAge.toFixed(2)}h <= ${csrfAuthE2eMaxAgeHours}h`
          : csrfAuthE2eTimestamp
            ? `${(csrfAuthE2eAge || 0).toFixed(2)}h > ${csrfAuthE2eMaxAgeHours}h`
            : 'missing/invalid timestamp',
      });
      checks.push({
        id: 'csrf_auth_e2e_provenance_present',
        pass: Boolean(csrfAuthRunId) && /^[a-f0-9]{7,40}$/i.test(csrfAuthHeadSha),
        detail: `run_id=${csrfAuthRunId || '(missing)'}; head_sha=${csrfAuthHeadSha || '(missing)'}`,
      });
    } catch (err) {
      checks.push({
        id: 'csrf_auth_e2e_valid_json',
        pass: false,
        detail: `parse failed: ${String(err && err.message ? err.message : err)}`,
      });
    }
  } else {
    checks.push({
      id: 'csrf_auth_e2e_present',
      pass: false,
      detail: 'docs/release/status/csrf-auth-e2e-latest.json missing',
    });
  }

  let effectiveChecks = checks;
  let scopedOutChecks = [];
  if (localOnly) {
    const inScopeMatchers = [
      /^validation_scope_/,
      /^mode_/,
      /^signoff_/,
      /^ci_required_checks_(status_pass|fresh|execution_authoritative|not_local_only_evidence|target_sha_matches_source|bridge_runtime_latest_run_success|gateway_bridge_contract_latest_run_success)$/,
    ];
    effectiveChecks = checks.filter((check) => inScopeMatchers.some((matcher) => matcher.test(check.id)));
    scopedOutChecks = checks.filter((check) => !inScopeMatchers.some((matcher) => matcher.test(check.id)));
  } else if (finalSignoffProfile === 'android-mobile-rc') {
    const inScopeMatchers = [
      /^validation_scope_/,
      /^mode_/,
      /^signoff_/,
      /^ci_gates_file_valid_json$/,
      /^ci_gates_fresh$/,
      /^ci_gates_source_provenance_present$/,
      /^ci_gate:(d9_keycloak_interop_ci|release_ops_drill_ci|soak_72h)$/,
      /^mobile_release_readiness_(present|valid_json|status_pass|fresh)$/,
      /^multi_device_validation_(present|valid_json|status_pass|fresh)$/,
    ];
    effectiveChecks = checks.filter((check) => inScopeMatchers.some((matcher) => matcher.test(check.id)));
    scopedOutChecks = checks.filter((check) => !inScopeMatchers.some((matcher) => matcher.test(check.id)));
  }
  const status = effectiveChecks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    profile: finalSignoffProfile,
    execution: {
      strict,
      local_only: localOnly,
      validation_scope: validationScope,
      authority: validationAuthority,
      ci_context: ciContext,
    },
    checks: effectiveChecks,
    checks_scoped_out_count: scopedOutChecks.length,
    checks_scoped_out_ids: scopedOutChecks.map((check) => check.id),
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outputPrefix = localOnly ? 'final-signoff-local-latest' : 'final-signoff-latest';
  const outJson = path.join(outDir, `${outputPrefix}.json`);
  const outMd = path.join(outDir, `${outputPrefix}.md`);
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Final Sign-Off Gate\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Execution\n- strict: ${String(report.execution.strict)}\n- local_only: ${String(report.execution.local_only)}\n- validation_scope: ${report.execution.validation_scope}\n- authority: ${report.execution.authority}\n- ci_context: ${String(report.execution.ci_context)}\n- profile: ${report.profile}\n- checks_scoped_out_count: ${report.checks_scoped_out_count}\n\n## Checks\n${effectiveChecks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8'
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
