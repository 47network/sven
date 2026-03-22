#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const maxArtifactAgeHours = Number(process.env.SVEN_RC_PACKAGE_MAX_ARTIFACT_AGE_HOURS || 72);
const targetHeadSha = normalizeSha(
  process.env.SVEN_RC_TARGET_HEAD_SHA
    || process.env.GITHUB_SHA
    || process.env.CI_COMMIT_SHA
    || '',
);
const targetReleaseId = String(
  process.env.SVEN_RC_RELEASE_ID
  || process.env.SVEN_RELEASE_ID
  || process.env.GITHUB_REF_NAME
  || '',
).trim();

function readJson(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function extractTimestampIso(value) {
  if (!value || typeof value !== 'object') return null;
  for (const key of ['generated_at', 'at_utc', 'validated_at', 'updated_at', 'created_at', 'timestamp']) {
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

function normalizeSha(value) {
  const sha = String(value || '').trim().toLowerCase();
  return /^[a-f0-9]{40}$/i.test(sha) ? sha : '';
}

function extractHeadSha(value) {
  if (!value || typeof value !== 'object') return '';
  const candidates = [
    value.head_sha,
    value.commit_sha,
    value.source_head_sha,
    value.headSha,
    value.release?.head_sha,
    value.release?.commit_sha,
    value.provenance?.head_sha,
    value.provenance?.commit_sha,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeSha(candidate);
    if (normalized) return normalized;
  }
  return '';
}

function extractReleaseId(value) {
  if (!value || typeof value !== 'object') return '';
  const candidates = [
    value.release_id,
    value.rc_id,
    value.release?.release_id,
    value.release?.id,
    value.provenance?.release_id,
    value.provenance?.release_tag,
  ];
  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function run() {
  const statusSources = {
    versioning: 'docs/release/status/release-versioning-latest.json',
    reproducibility: 'docs/release/status/release-reproducibility-latest.json',
    artifacts: 'docs/release/status/release-artifacts-latest.json',
    rollout: 'docs/release/status/release-rollout-latest.json',
    rollbackRehearsal: 'docs/release/status/rollback-rehearsal-latest.json',
    dependency: 'docs/release/status/dependency-vuln-latest.json',
    transport: 'docs/release/status/security-transport-csp-latest.json',
  };
  const statuses = Object.fromEntries(
    Object.entries(statusSources).map(([key, relPath]) => [key, readJson(relPath)]),
  );
  const releaseArtifacts = statuses.artifacts && typeof statuses.artifacts === 'object'
    ? statuses.artifacts
    : null;
  const releaseArtifactsChecks = Array.isArray(releaseArtifacts?.checks) ? releaseArtifacts.checks : [];
  const signedArtifactsManifest = Array.isArray(releaseArtifacts?.artifacts?.signed_release_artifacts)
    ? releaseArtifacts.artifacts.signed_release_artifacts
    : [];
  const securityReportManifest = Array.isArray(releaseArtifacts?.artifacts?.security_report_artifacts)
    ? releaseArtifacts.artifacts.security_report_artifacts
    : [];
  const hasPassingReleaseArtifactsCheck = (id) =>
    releaseArtifactsChecks.some((entry) => entry && entry.id === id && entry.pass === true);
  const hasValidManifestRows = (rows) =>
    Array.isArray(rows)
    && rows.length > 0
    && rows.every((row) => {
      const rel = String(row?.path || '').trim();
      const sha = String(row?.sha256 || '').trim().toLowerCase();
      return Boolean(rel) && /^[a-f0-9]{64}$/i.test(sha);
    });

  const checks = [
    { id: 'release_versioning_pass', pass: statuses.versioning?.status === 'pass', detail: statuses.versioning?.status || 'missing' },
    { id: 'release_reproducibility_pass', pass: statuses.reproducibility?.status === 'pass', detail: statuses.reproducibility?.status || 'missing' },
    { id: 'release_artifacts_pass', pass: statuses.artifacts?.status === 'pass', detail: statuses.artifacts?.status || 'missing' },
    { id: 'release_rollout_pass', pass: statuses.rollout?.status === 'pass', detail: statuses.rollout?.status || 'missing' },
    { id: 'rollback_rehearsal_pass', pass: statuses.rollbackRehearsal?.status === 'pass', detail: statuses.rollbackRehearsal?.status || 'missing' },
    { id: 'security_dependency_pass', pass: statuses.dependency?.status === 'pass', detail: statuses.dependency?.status || 'missing' },
    { id: 'security_transport_pass', pass: statuses.transport?.status === 'pass', detail: statuses.transport?.status || 'missing' },
    {
      id: 'release_artifacts_signed_manifest_present',
      pass: hasValidManifestRows(signedArtifactsManifest),
      detail: hasValidManifestRows(signedArtifactsManifest)
        ? `signed artifacts manifest rows=${signedArtifactsManifest.length}`
        : 'release-artifacts signed_release_artifacts manifest missing/invalid',
    },
    {
      id: 'release_artifacts_security_reports_manifest_present',
      pass: hasValidManifestRows(securityReportManifest),
      detail: hasValidManifestRows(securityReportManifest)
        ? `security report manifest rows=${securityReportManifest.length}`
        : 'release-artifacts security_report_artifacts manifest missing/invalid',
    },
    {
      id: 'release_artifacts_signed_artifacts_present_check_pass',
      pass: hasPassingReleaseArtifactsCheck('signed_release_artifacts_present'),
      detail: hasPassingReleaseArtifactsCheck('signed_release_artifacts_present')
        ? 'release-artifacts gate confirms required signed artifacts present'
        : 'release-artifacts signed_release_artifacts_present check missing/fail',
    },
    {
      id: 'release_artifacts_security_reports_present_check_pass',
      pass: hasPassingReleaseArtifactsCheck('security_report_artifacts_present'),
      detail: hasPassingReleaseArtifactsCheck('security_report_artifacts_present')
        ? 'release-artifacts gate confirms required security report artifacts present'
        : 'release-artifacts security_report_artifacts_present check missing/fail',
    },
    {
      id: 'release_artifacts_release_id_present_check_pass',
      pass: hasPassingReleaseArtifactsCheck('release_id_present'),
      detail: hasPassingReleaseArtifactsCheck('release_id_present')
        ? 'release-artifacts gate confirms release_id provenance present'
        : 'release-artifacts release_id_present check missing/fail',
    },
    {
      id: 'provenance_target_head_sha_present',
      pass: Boolean(targetHeadSha),
      detail: targetHeadSha
        ? `target head_sha=${targetHeadSha}`
        : 'missing target head SHA (set SVEN_RC_TARGET_HEAD_SHA or CI-provided GITHUB_SHA/CI_COMMIT_SHA)',
    },
    {
      id: 'provenance_target_release_id_present',
      pass: Boolean(targetReleaseId),
      detail: targetReleaseId
        ? `target release_id=${targetReleaseId}`
        : 'missing target release_id (set SVEN_RC_RELEASE_ID/SVEN_RELEASE_ID or CI ref name)',
    },
  ];
  const statusHeadShas = {};
  const statusReleaseIds = {};
  for (const [key, relPath] of Object.entries(statusSources)) {
    const payload = statuses[key];
    const ts = extractTimestampIso(payload);
    const age = ageHours(ts);
    const fresh = typeof age === 'number' && age <= maxArtifactAgeHours;
    const sourceHeadSha = extractHeadSha(payload);
    const sourceReleaseId = extractReleaseId(payload);
    statusHeadShas[key] = sourceHeadSha;
    statusReleaseIds[key] = sourceReleaseId;
    checks.push({
      id: `status_fresh:${key}`,
      pass: fresh,
      detail: fresh
        ? `${age.toFixed(2)}h <= ${maxArtifactAgeHours}h (${relPath})`
        : ts
          ? `${(age || 0).toFixed(2)}h > ${maxArtifactAgeHours}h (${relPath})`
          : `missing/invalid timestamp (${relPath})`,
    });
    checks.push({
      id: `provenance_head_sha_present:${key}`,
      pass: Boolean(sourceHeadSha),
      detail: sourceHeadSha
        ? `${sourceHeadSha} (${relPath})`
        : `missing/invalid head SHA (${relPath})`,
    });
    checks.push({
      id: `provenance_head_sha_matches_target:${key}`,
      pass: Boolean(targetHeadSha) && sourceHeadSha === targetHeadSha,
      detail: targetHeadSha
        ? sourceHeadSha
          ? `${sourceHeadSha} ${sourceHeadSha === targetHeadSha ? '==' : '!='} ${targetHeadSha} (${relPath})`
          : `missing source head SHA (${relPath})`
        : 'target head SHA not configured',
    });
    checks.push({
      id: `provenance_release_id_present:${key}`,
      pass: Boolean(sourceReleaseId),
      detail: sourceReleaseId
        ? `${sourceReleaseId} (${relPath})`
        : `missing release_id (${relPath})`,
    });
    checks.push({
      id: `provenance_release_id_matches_target:${key}`,
      pass: Boolean(targetReleaseId) && sourceReleaseId === targetReleaseId,
      detail: targetReleaseId
        ? sourceReleaseId
          ? `${sourceReleaseId} ${sourceReleaseId === targetReleaseId ? '==' : '!='} ${targetReleaseId} (${relPath})`
          : `missing source release_id (${relPath})`
        : 'target release_id not configured',
    });
  }

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    evidence_policy: {
      max_artifact_age_hours: maxArtifactAgeHours,
      target_head_sha: targetHeadSha || null,
      target_release_id: targetReleaseId || null,
      status_sources: statusSources,
    },
    provenance: {
      target_head_sha: targetHeadSha || null,
      target_release_id: targetReleaseId || null,
      source_head_shas: statusHeadShas,
      source_release_ids: statusReleaseIds,
    },
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'release-candidate-package-latest.json');
  const outMd = path.join(outDir, 'release-candidate-package-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Release Candidate Package Check\n\nGenerated: ${report.generated_at}\nStatus: ${report.status}\n\n## Checks\n${checks
      .map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`)
      .join('\n')}\n`,
    'utf8'
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
