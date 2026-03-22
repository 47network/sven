#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const maxArtifactAgeHours = Number(process.env.SVEN_MOBILE_READINESS_MAX_AGE_HOURS || 72);
const targetRef = String(process.env.GITHUB_REF || process.env.CI_COMMIT_REF_NAME || '').trim() || null;
const targetSha = String(process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim() || null;
const scopePath = path.join(root, 'config', 'release', 'mobile-release-scope.json');

function readJson(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  const raw = fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function readScope() {
  if (!fs.existsSync(scopePath)) {
    return {
      scope: 'android-and-ios',
      deferred_platforms: [],
      reason: '',
    };
  }
  const raw = fs.readFileSync(scopePath, 'utf8').replace(/^\uFEFF/, '');
  const parsed = JSON.parse(raw);
  return {
    scope: parsed.scope || 'android-and-ios',
    deferred_platforms: Array.isArray(parsed.deferred_platforms) ? parsed.deferred_platforms : [],
    reason: parsed.reason || '',
  };
}

function relPath(fullPath) {
  return path.relative(root, fullPath).replace(/\\/g, '/');
}

function selectNewestMarkdownByPrefix(evidenceDir, prefix) {
  const latestAlias = `${prefix}-latest.md`;
  const candidates = fs.readdirSync(evidenceDir)
    .filter((name) => name.toLowerCase().endsWith('.md'))
    .filter((name) => name.toLowerCase() !== latestAlias.toLowerCase())
    .filter((name) => name.startsWith(`${prefix}-`));
  if (!candidates.length) return null;
  const ranked = candidates
    .map((name) => {
      const full = path.join(evidenceDir, name);
      const stat = fs.statSync(full);
      return { name, mtimeMs: stat.mtimeMs || 0 };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs || a.name.localeCompare(b.name));
  return path.join(evidenceDir, ranked[0].name);
}

function resolveSigningEvidencePath() {
  const override = process.env.SVEN_MOBILE_RELEASE_SIGNING_EVIDENCE_PATH;
  if (override) {
    const resolved = path.isAbsolute(override) ? override : path.join(root, override);
    if (!/mobile-release-signing-template\.md$/i.test(resolved)) {
      return resolved;
    }
  }
  const latestPath = path.join(root, 'docs', 'release', 'evidence', 'mobile-release-signing-latest.md');
  if (fs.existsSync(latestPath)) return latestPath;
  const evidenceDir = path.join(root, 'docs', 'release', 'evidence');
  if (!fs.existsSync(evidenceDir)) return null;
  return selectNewestMarkdownByPrefix(evidenceDir, 'mobile-release-signing');
}

function extractTimestampIso(value) {
  if (!value || typeof value !== 'object') return null;
  const candidates = ['generated_at', 'at_utc', 'validated_at', 'updated_at', 'created_at', 'timestamp'];
  for (const key of candidates) {
    const raw = value[key];
    if (!raw) continue;
    const parsed = Date.parse(String(raw));
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return null;
}

function ageHours(isoTimestamp) {
  if (!isoTimestamp) return null;
  const parsed = Date.parse(isoTimestamp);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
}

function buildFreshnessCheck(id, timestampIso, maxHours) {
  const age = ageHours(timestampIso);
  const pass = typeof age === 'number' && age <= maxHours;
  return {
    id: `${id}_fresh`,
    pass,
    detail: pass
      ? `${age.toFixed(2)}h <= ${maxHours}h`
      : timestampIso
        ? `${(age || 0).toFixed(2)}h > ${maxHours}h`
        : 'missing/invalid timestamp',
  };
}

function parseGradleApplicationId() {
  const gradlePath = path.join(root, 'apps', 'companion-user-flutter', 'android', 'app', 'build.gradle.kts');
  if (!fs.existsSync(gradlePath)) return null;
  const body = fs.readFileSync(gradlePath, 'utf8');
  const match = body.match(/applicationId\s*=\s*"([^"]+)"/);
  return match ? match[1] : null;
}

function parseWorkflowPlayPackageName() {
  const workflowPath = path.join(root, '.github', 'workflows', 'flutter-user-release.yml');
  if (!fs.existsSync(workflowPath)) return null;
  const body = fs.readFileSync(workflowPath, 'utf8');
  const usesEnvBinding = /packageName:\s*\$\{\{\s*env\.ANDROID_PACKAGE_NAME\s*\}\}/.test(body);
  const resolvesFromGradle = /Resolve Android package ID from Gradle config/.test(body)
    && /echo "ANDROID_PACKAGE_NAME=\$RESOLVED_PACKAGE_ID" >> "\$GITHUB_ENV"/.test(body);
  if (usesEnvBinding && resolvesFromGradle) {
    return parseGradleApplicationId();
  }
  const envMatch = body.match(/ANDROID_PACKAGE_NAME:\s*([^\s]+)/);
  if (envMatch && envMatch[1]) return envMatch[1].trim().replace(/^['"]|['"]$/g, '');
  const directMatch = body.match(/packageName:\s*([^\n]+)/);
  if (!directMatch || !directMatch[1]) return null;
  const value = directMatch[1].trim();
  if (value.startsWith('${{')) return null;
  return value.replace(/^['"]|['"]$/g, '');
}

function run() {
  const releaseScope = readScope();
  const androidOnly = releaseScope.scope === 'android-only';
  const perf = readJson('docs/release/status/mobile-perf-slo-latest.json');
  const crashAnr = readJson('docs/release/status/mobile-crash-anr-latest.json');
  const deviceValidation = readJson('docs/release/status/mobile-device-release-validation-latest.json');
  const privacy = readJson('docs/release/status/mobile-app-store-privacy-latest.json');
  const firebaseTlsDefines = readJson('docs/release/status/mobile-firebase-tls-define-latest.json');
  const signingStatus = readJson('docs/release/status/mobile-release-signing-latest.json');
  const signingEvidencePath = resolveSigningEvidencePath();
  const signedBuildEvidence = signingStatus
    ? signingStatus.status === 'pass'
    : Boolean(signingEvidencePath && fs.existsSync(signingEvidencePath));
  const signingEvidenceTimestamp = signingStatus
    ? (extractTimestampIso(signingStatus) || signingStatus?.evidence?.timestamp || null)
    : (signedBuildEvidence ? fs.statSync(signingEvidencePath).mtime.toISOString() : null);
  const signingEvidenceResolvedPath = signingStatus?.evidence?.path || (signingEvidencePath ? relPath(signingEvidencePath) : null);
  const gradleApplicationId = parseGradleApplicationId();
  const workflowPackageName = parseWorkflowPlayPackageName();
  const deviceValidationRunId = String(
    deviceValidation?.provenance?.run_id
      || deviceValidation?.source_run_id
      || deviceValidation?.run_id
      || '',
  ).trim();
  const deviceValidationHeadSha = String(
    deviceValidation?.provenance?.head_sha
      || deviceValidation?.head_sha
      || '',
  ).trim();
  const deviceValidationSourceRef = String(
    deviceValidation?.provenance?.source_ref
      || deviceValidation?.source_ref
      || '',
  ).trim();

  const checks = [
    { id: 'mobile_perf_slo_pass', pass: perf?.status === 'pass', detail: perf?.status || 'missing' },
    { id: 'mobile_crash_anr_pass', pass: crashAnr?.status === 'pass', detail: crashAnr?.status || 'missing' },
    { id: 'mobile_device_validation_pass', pass: deviceValidation?.status === 'pass', detail: deviceValidation?.status || 'missing' },
    {
      id: 'mobile_device_validation_provenance_present',
      pass: Boolean(deviceValidationRunId) && /^[a-f0-9]{7,40}$/i.test(deviceValidationHeadSha),
      detail: `run_id=${deviceValidationRunId || '(missing)'}; head_sha=${deviceValidationHeadSha || '(missing)'}`,
    },
    {
      id: 'mobile_device_validation_release_sha_match',
      pass: strict ? (!targetSha || (Boolean(deviceValidationHeadSha) && deviceValidationHeadSha === targetSha)) : true,
      detail: targetSha ? `target=${targetSha} device_validation=${deviceValidationHeadSha || '(missing)'}` : 'target sha not provided',
    },
    {
      id: 'mobile_device_validation_release_ref_match',
      pass: strict ? (!targetRef || (Boolean(deviceValidationSourceRef) && deviceValidationSourceRef === targetRef)) : true,
      detail: targetRef ? `target=${targetRef} device_validation=${deviceValidationSourceRef || '(missing)'}` : 'target ref not provided',
    },
    { id: 'mobile_appstore_privacy_pass', pass: privacy?.status === 'pass', detail: privacy?.status || 'missing' },
    {
      id: 'mobile_firebase_tls_define_check_pass',
      pass: firebaseTlsDefines?.status === 'pass',
      detail: firebaseTlsDefines?.status || 'missing',
    },
    {
      id: 'mobile_signed_build_evidence_present',
      pass: signedBuildEvidence,
      detail: signedBuildEvidence ? (signingEvidenceResolvedPath || 'mobile-release-signing-latest.json') : 'missing',
    },
    {
      id: 'mobile_play_package_matches_android_application_id',
      pass: Boolean(workflowPackageName && gradleApplicationId && workflowPackageName === gradleApplicationId),
      detail: `workflow=${workflowPackageName || 'missing'}; gradle=${gradleApplicationId || 'missing'}`,
    },
    buildFreshnessCheck('mobile_perf_slo', extractTimestampIso(perf), maxArtifactAgeHours),
    buildFreshnessCheck('mobile_crash_anr', extractTimestampIso(crashAnr), maxArtifactAgeHours),
    buildFreshnessCheck('mobile_device_validation', extractTimestampIso(deviceValidation), maxArtifactAgeHours),
    buildFreshnessCheck('mobile_appstore_privacy', extractTimestampIso(privacy), maxArtifactAgeHours),
    buildFreshnessCheck('mobile_firebase_tls_define_check', extractTimestampIso(firebaseTlsDefines), maxArtifactAgeHours),
    buildFreshnessCheck('mobile_signed_build_evidence', signingEvidenceTimestamp, maxArtifactAgeHours),
  ];

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    mobile_release_scope: releaseScope.scope,
    ios_release_status: androidOnly ? 'deferred' : 'required',
    status,
    freshness_max_age_hours: maxArtifactAgeHours,
    checks,
    artifacts: {
      mobile_perf_slo: { timestamp: extractTimestampIso(perf) },
      mobile_crash_anr: { timestamp: extractTimestampIso(crashAnr) },
      mobile_device_validation: { timestamp: extractTimestampIso(deviceValidation) },
      mobile_appstore_privacy: { timestamp: extractTimestampIso(privacy) },
      mobile_firebase_tls_define: { timestamp: extractTimestampIso(firebaseTlsDefines) },
      mobile_release_signing_evidence: {
        path: signingEvidenceResolvedPath,
        timestamp: signingEvidenceTimestamp,
        signing_status_artifact: signingStatus ? 'docs/release/status/mobile-release-signing-latest.json' : null,
      },
      android_package_alignment: {
        workflow_package_name: workflowPackageName,
        gradle_application_id: gradleApplicationId,
      },
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'mobile-release-readiness-latest.json');
  const outMd = path.join(outDir, 'mobile-release-readiness-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Mobile Release Readiness Check\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8'
  );
  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
