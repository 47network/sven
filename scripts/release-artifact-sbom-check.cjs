#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');
const supplyChainWorkflowPath = path.join(root, '.github', 'workflows', 'release-supply-chain.yml');
const containerSigningWorkflowPath = path.join(root, '.github', 'workflows', 'release-container-signing.yml');
const runtimeEvidencePath = process.env.SVEN_SECURITY_RELEASE_ARTIFACT_SBOM_EVIDENCE_PATH
  ? path.resolve(root, process.env.SVEN_SECURITY_RELEASE_ARTIFACT_SBOM_EVIDENCE_PATH)
  : path.join(root, 'docs', 'release', 'status', 'security-release-artifact-sbom-evidence-latest.json');

function check(id, pass, detail) {
  return { id, pass, detail };
}

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveArtifactPath(ref) {
  const raw = String(ref || '').trim();
  if (!raw) return null;
  const candidates = [
    path.resolve(root, raw),
    path.resolve(root, 'docs', 'release', 'status', raw),
    path.resolve(root, 'docs', 'release', 'status', path.basename(raw)),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function sha256File(filePath) {
  const crypto = require('node:crypto');
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function hasRunProvenance(evidence) {
  if (!evidence || typeof evidence !== 'object') return false;
  const runIdValid = Number.isInteger(evidence.run_id) || /^\d+$/.test(String(evidence.run_id || ''));
  const headShaValid = /^[a-f0-9]{7,40}$/i.test(String(evidence.head_sha || ''));
  const refValid = String(evidence.ref || '').trim().length > 0;
  return runIdValid && headShaValid && refValid;
}

function hasSbomArtifacts(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return false;
  return entries.every((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const artifactPath = String(entry.path || '').trim();
    const digest = String(entry.sha256 || '').trim();
    return artifactPath.length > 0 && /^([a-f0-9]{64}|sha256:[a-f0-9]{64})$/i.test(digest);
  });
}

function normalizeDigest(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  return raw.startsWith('sha256:') ? raw.slice('sha256:'.length) : raw;
}

function validateSbomArtifactFiles(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { pass: false, detail: 'no sbom entries provided' };
  }
  for (const entry of entries) {
    const artifactPath = String(entry?.path || '').trim();
    const expectedDigest = normalizeDigest(entry?.sha256);
    const resolved = resolveArtifactPath(artifactPath);
    if (!resolved) {
      return { pass: false, detail: `missing artifact file for ${artifactPath}` };
    }
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(resolved, 'utf8').replace(/^\uFEFF/, ''));
    } catch {
      return { pass: false, detail: `invalid JSON artifact: ${artifactPath}` };
    }
    if (!parsed || typeof parsed !== 'object' || !String(parsed.spdxVersion || '').trim()) {
      return { pass: false, detail: `artifact is not valid SPDX JSON: ${artifactPath}` };
    }
    const actualDigest = sha256File(resolved);
    if (expectedDigest !== actualDigest) {
      return { pass: false, detail: `sha256 mismatch for ${artifactPath}` };
    }
  }
  return { pass: true, detail: `validated ${entries.length} SPDX artifact files` };
}

function hasSignatureBundleLinkage(evidence) {
  const links = Array.isArray(evidence?.signature_refs) ? evidence.signature_refs : [];
  const installerEntries = Array.isArray(evidence?.installer_sboms) ? evidence.installer_sboms : [];
  const imageEntries = Array.isArray(evidence?.image_sboms) ? evidence.image_sboms : [];
  const allArtifacts = [...installerEntries, ...imageEntries]
    .map((entry) => String(entry?.path || '').trim())
    .filter(Boolean);
  if (!allArtifacts.length) return false;
  for (const artifactPath of allArtifacts) {
    const link = links.find((item) => String(item?.artifact_path || '').trim() === artifactPath);
    if (!link) return false;
    const sigPath = resolveArtifactPath(String(link.signature_path || '').trim());
    const certPath = resolveArtifactPath(String(link.certificate_path || '').trim());
    if (!sigPath || !certPath) return false;
  }
  return true;
}

function main() {
  const checks = [];
  const supplyChainWorkflow = readIfExists(supplyChainWorkflowPath);
  const containerSigningWorkflow = readIfExists(containerSigningWorkflowPath);
  const runtimeEvidence = readJsonIfExists(runtimeEvidencePath);

  checks.push(
    check(
      'supply_chain_workflow_present',
      fs.existsSync(supplyChainWorkflowPath),
      '.github/workflows/release-supply-chain.yml',
    ),
  );
  checks.push(
    check(
      'container_signing_workflow_present',
      fs.existsSync(containerSigningWorkflowPath),
      '.github/workflows/release-container-signing.yml',
    ),
  );

  checks.push(
    check(
      'repo_sbom_output_present',
      /output-file:\s*docs\/release\/status\/release-sbom-latest\.spdx\.json/i.test(supplyChainWorkflow),
      'repository SBOM output file configured',
    ),
  );
  checks.push(
    check(
      'installer_sh_sbom_output_present',
      /output-file:\s*docs\/release\/status\/release-sbom-install-sh\.spdx\.json/i.test(supplyChainWorkflow),
      'install.sh SBOM output file configured',
    ),
  );
  checks.push(
    check(
      'installer_ps1_sbom_output_present',
      /output-file:\s*docs\/release\/status\/release-sbom-install-ps1\.spdx\.json/i.test(supplyChainWorkflow),
      'install.ps1 SBOM output file configured',
    ),
  );
  checks.push(
    check(
      'installer_cmd_sbom_output_present',
      /output-file:\s*docs\/release\/status\/release-sbom-install-cmd\.spdx\.json/i.test(supplyChainWorkflow),
      'install.cmd SBOM output file configured',
    ),
  );
  checks.push(
    check(
      'supply_chain_uploads_installer_sboms',
      /upload-artifact@[\s\S]*release-sbom-install-sh\.spdx\.json[\s\S]*release-sbom-install-ps1\.spdx\.json[\s\S]*release-sbom-install-cmd\.spdx\.json/i.test(
        supplyChainWorkflow,
      ),
      'release-supply-chain uploads installer SBOM artifacts',
    ),
  );
  checks.push(
    check(
      'container_workflow_installs_syft',
      /download-syft@|syft\s+version/i.test(containerSigningWorkflow),
      'release-container-signing installs syft',
    ),
  );
  checks.push(
    check(
      'container_workflow_generates_per_image_sboms',
      /syft\s+["']?\$image["']?\s+-o\s+["']?spdx-json=\$\{?sbom_file\}?["']?/i.test(containerSigningWorkflow),
      'release-container-signing generates SPDX SBOM per service image',
    ),
  );
  checks.push(
    check(
      'container_workflow_uploads_image_sboms',
      /upload-artifact@[\s\S]*image-sbom-\*\.spdx\.json/i.test(containerSigningWorkflow),
      'release-container-signing uploads image SBOM files',
    ),
  );
  checks.push(
    check(
      'runtime_evidence_present',
      runtimeEvidence !== null,
      path.relative(root, runtimeEvidencePath),
    ),
  );
  checks.push(
    check(
      'runtime_evidence_has_run_provenance',
      hasRunProvenance(runtimeEvidence),
      'runtime evidence includes run_id/head_sha/ref',
    ),
  );
  checks.push(
    check(
      'runtime_evidence_has_installer_sboms',
      hasSbomArtifacts(runtimeEvidence && runtimeEvidence.installer_sboms),
      'runtime evidence includes installer_sboms[] with path + sha256',
    ),
  );
  checks.push(
    check(
      'runtime_evidence_has_image_sboms',
      hasSbomArtifacts(runtimeEvidence && runtimeEvidence.image_sboms),
      'runtime evidence includes image_sboms[] with path + sha256',
    ),
  );
  const installerArtifactValidation = validateSbomArtifactFiles(runtimeEvidence && runtimeEvidence.installer_sboms);
  checks.push(
    check(
      'runtime_evidence_installer_sbom_files_valid',
      installerArtifactValidation.pass,
      installerArtifactValidation.detail,
    ),
  );
  const imageArtifactValidation = validateSbomArtifactFiles(runtimeEvidence && runtimeEvidence.image_sboms);
  checks.push(
    check(
      'runtime_evidence_image_sbom_files_valid',
      imageArtifactValidation.pass,
      imageArtifactValidation.detail,
    ),
  );
  checks.push(
    check(
      'runtime_evidence_signature_bundle_linked',
      hasSignatureBundleLinkage(runtimeEvidence),
      'runtime evidence links each SBOM artifact to signature + certificate paths',
    ),
  );

  const status = checks.every((c) => c.pass) ? 'pass' : 'fail';
  const report = {
    generated_at: new Date().toISOString(),
    status,
    provenance: runtimeEvidence && typeof runtimeEvidence === 'object'
      ? {
          source: path.relative(root, runtimeEvidencePath),
          run_id: runtimeEvidence.run_id ?? null,
          head_sha: runtimeEvidence.head_sha ?? null,
          ref: runtimeEvidence.ref ?? null,
          workflow: runtimeEvidence.workflow ?? null,
        }
      : null,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'security-release-artifact-sbom-latest.json');
  const outMd = path.join(outDir, 'security-release-artifact-sbom-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Release Artifact SBOM Coverage Check

Generated: ${report.generated_at}
Status: ${status}

## Checks
${checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`).join('\n')}
`,
    'utf8',
  );

  console.log(`Wrote ${path.relative(root, outJson)}`);
  console.log(`Wrote ${path.relative(root, outMd)}`);
  if (strict && status !== 'pass') process.exit(2);
}

main();
