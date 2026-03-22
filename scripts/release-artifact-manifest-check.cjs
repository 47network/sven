#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');
const releaseId =
  String(process.env.SVEN_RELEASE_ID || process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim() || null;

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function readIfExists(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function fileManifestEntry(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  const stat = fs.statSync(full);
  return {
    path: relPath,
    size_bytes: stat.size,
    sha256: sha256File(full),
  };
}

function parseRequiredList(value, fallback) {
  if (!value) return fallback;
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function run() {
  const installerFiles = [
    'deploy/quickstart/install.sh',
    'deploy/quickstart/install.ps1',
    'deploy/quickstart/install.cmd',
  ];
  const installerManifest = installerFiles
    .filter((rel) => fs.existsSync(path.join(root, rel)))
    .map((rel) => {
      const full = path.join(root, rel);
      const stat = fs.statSync(full);
      return {
        path: rel,
        size_bytes: stat.size,
        sha256: sha256File(full),
      };
    });
  const requiredSignedArtifacts = parseRequiredList(
    process.env.SVEN_RELEASE_MANIFEST_REQUIRED_SIGNED_ARTIFACTS,
    [
      'docs/release/status/release-sbom-latest.spdx.json',
      'docs/release/status/release-sbom-latest.sig',
      'docs/release/status/release-sbom-latest.pem',
    ],
  );
  const signedArtifactsManifest = requiredSignedArtifacts
    .map((rel) => fileManifestEntry(rel))
    .filter((entry) => Boolean(entry));
  const requiredSecurityReports = parseRequiredList(
    process.env.SVEN_RELEASE_MANIFEST_REQUIRED_SECURITY_REPORTS,
    [
      'docs/release/status/security-sbom-cosign-latest.json',
      'docs/release/status/security-image-signing-latest.json',
      'docs/release/status/security-release-artifact-sbom-latest.json',
    ],
  );
  const securityReportManifest = requiredSecurityReports
    .map((rel) => fileManifestEntry(rel))
    .filter((entry) => Boolean(entry));

  const tauriWorkflow = readIfExists('.github/workflows/desktop-tauri-release.yml');
  const checks = [
    {
      id: 'quickstart_installers_present',
      pass: installerManifest.length === installerFiles.length,
      detail: `${installerManifest.length}/${installerFiles.length} files`,
    },
    {
      id: 'desktop_workflow_signing_enabled',
      pass: tauriWorkflow.includes('TAURI_SIGNING_PRIVATE_KEY'),
      detail: 'checks desktop-tauri-release workflow',
    },
    {
      id: 'desktop_workflow_checksum_step_present',
      pass: tauriWorkflow.includes('Generate SHA256 checksums'),
      detail: 'checks desktop-tauri-release workflow',
    },
    {
      id: 'desktop_workflow_provenance_attestation_present',
      pass: tauriWorkflow.includes('actions/attest-build-provenance@v2'),
      detail: 'checks desktop-tauri-release workflow',
    },
    {
      id: 'release_id_present',
      pass: Boolean(releaseId),
      detail: releaseId ? `release_id=${releaseId}` : 'missing SVEN_RELEASE_ID/GITHUB_SHA/CI_COMMIT_SHA',
    },
    {
      id: 'signed_release_artifacts_present',
      pass: signedArtifactsManifest.length === requiredSignedArtifacts.length,
      detail: `${signedArtifactsManifest.length}/${requiredSignedArtifacts.length} signed artifacts present`,
    },
    {
      id: 'security_report_artifacts_present',
      pass: securityReportManifest.length === requiredSecurityReports.length,
      detail: `${securityReportManifest.length}/${requiredSecurityReports.length} security report artifacts present`,
    },
  ];

  const status = checks.some((c) => !c.pass) ? 'fail' : 'pass';
  const report = {
    generated_at: new Date().toISOString(),
    release_id: releaseId,
    status,
    artifacts: {
      quickstart_installers: installerManifest,
      signed_release_artifacts: signedArtifactsManifest,
      security_report_artifacts: securityReportManifest,
    },
    expected_artifacts: {
      signed_release_artifacts: requiredSignedArtifacts,
      security_report_artifacts: requiredSecurityReports,
    },
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'release-artifacts-latest.json');
  const outMd = path.join(outDir, 'release-artifacts-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Release Artifact Manifest Check',
    '',
    `Generated: ${report.generated_at}`,
    `Release ID: ${report.release_id || '(missing)'}`,
    `Status: ${report.status}`,
    '',
    '## Quickstart Installer Manifest',
    ...installerManifest.map((a) => `- ${a.path} (${a.size_bytes} bytes, sha256=${a.sha256})`),
    '',
    '## Signed Release Artifact Manifest',
    ...signedArtifactsManifest.map((a) => `- ${a.path} (${a.size_bytes} bytes, sha256=${a.sha256})`),
    '',
    '## Security Report Artifact Manifest',
    ...securityReportManifest.map((a) => `- ${a.path} (${a.size_bytes} bytes, sha256=${a.sha256})`),
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

run();
