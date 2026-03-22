#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const workflowPath = path.join(root, '.github', 'workflows', 'release-supply-chain.yml');
const outDir = path.join(root, 'docs', 'release', 'status');
const runtimeEvidencePath = process.env.SVEN_SECURITY_SBOM_COSIGN_EVIDENCE_PATH
  ? path.resolve(root, process.env.SVEN_SECURITY_SBOM_COSIGN_EVIDENCE_PATH)
  : path.join(root, 'docs', 'release', 'status', 'security-sbom-cosign-evidence-latest.json');

function check(id, pass, detail) {
  return { id, pass, detail };
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function hasRunProvenance(evidence) {
  if (!evidence || typeof evidence !== 'object') return false;
  const runIdValid = Number.isInteger(evidence.run_id) || /^\d+$/.test(String(evidence.run_id || ''));
  const headShaValid = /^[a-f0-9]{7,40}$/i.test(String(evidence.head_sha || ''));
  const refValid = String(evidence.ref || '').trim().length > 0;
  return runIdValid && headShaValid && refValid;
}

function normalizeSha256(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  return raw.startsWith('sha256:') ? raw.slice(7) : raw;
}

function sha256File(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hasSbomAndCosignEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object') return false;
  const sboms = Array.isArray(evidence.sbom_artifacts) ? evidence.sbom_artifacts : [];
  const attestations = Array.isArray(evidence.cosign_attestations) ? evidence.cosign_attestations : [];
  const transcript = Array.isArray(evidence.cosign_verification_transcript)
    ? evidence.cosign_verification_transcript
    : [];
  if (sboms.length === 0 || attestations.length === 0 || transcript.length === 0) return false;

  const sbomValid = sboms.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const artifactPathRel = String(item.path || '').trim();
    const digest = normalizeSha256(item.sha256);
    if (!artifactPathRel || !/^[a-f0-9]{64}$/i.test(digest)) return false;
    const artifactPath = path.resolve(root, artifactPathRel);
    if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) return false;
    const actual = sha256File(artifactPath);
    if (actual !== digest) return false;
    const signaturePathRel = String(item.signature_path || '').trim();
    const certificatePathRel = String(item.certificate_path || '').trim();
    if (!signaturePathRel || !certificatePathRel) return false;
    const signaturePath = path.resolve(root, signaturePathRel);
    const certificatePath = path.resolve(root, certificatePathRel);
    return fs.existsSync(signaturePath) && fs.existsSync(certificatePath);
  });
  const attestValid = attestations.every((item) => item && typeof item === 'object' && item.verified === true);
  const transcriptValid = transcript.every((row) => {
    if (!row || typeof row !== 'object') return false;
    const artifactPathRel = String(row.artifact_path || '').trim();
    const signaturePathRel = String(row.signature_path || '').trim();
    const certificatePathRel = String(row.certificate_path || '').trim();
    const verificationCommand = String(row.verification_command || '').trim();
    const outputSha = normalizeSha256(row.verification_output_sha256);
    if (!artifactPathRel || !signaturePathRel || !certificatePathRel || !verificationCommand) return false;
    if (!/^[a-f0-9]{64}$/i.test(outputSha)) return false;
    if (row.signature_verified !== true || row.certificate_identity_verified !== true || row.tlog_verified !== true) {
      return false;
    }
    return fs.existsSync(path.resolve(root, artifactPathRel))
      && fs.existsSync(path.resolve(root, signaturePathRel))
      && fs.existsSync(path.resolve(root, certificatePathRel));
  });
  const sbomTranscriptCoverage = sboms.every((sbom) => transcript.some((row) => row?.artifact_path === sbom.path));
  return sbomValid && attestValid && transcriptValid && sbomTranscriptCoverage;
}

function main() {
  const checks = [];
  const exists = fs.existsSync(workflowPath);
  checks.push(check('workflow_present', exists, '.github/workflows/release-supply-chain.yml'));
  const text = exists ? fs.readFileSync(workflowPath, 'utf8') : '';
  const runtimeEvidence = readJsonIfExists(runtimeEvidencePath);

  checks.push(
    check(
      'workflow_has_syft_or_sbom_action',
      /anchore\/sbom-action@|anchore\/syft-action@|syft\s+scan|syft\s+dir:/i.test(text),
      'release-supply-chain workflow includes SBOM generation step',
    ),
  );
  checks.push(
    check(
      'workflow_has_cosign_installer',
      /sigstore\/cosign-installer@/i.test(text),
      'release-supply-chain workflow installs cosign',
    ),
  );
  checks.push(
    check(
      'workflow_has_cosign_sign_or_attest',
      /cosign\s+(sign|attest|sign-blob|verify-attestation|verify-blob)/i.test(text),
      'release-supply-chain workflow executes cosign signing/attestation',
    ),
  );
  checks.push(
    check(
      'workflow_uploads_sbom_or_signature_artifacts',
      /upload-artifact@[\s\S]*sbom|upload-artifact@[\s\S]*cosign/i.test(text),
      'release-supply-chain workflow uploads SBOM/signing artifacts',
    ),
  );
  checks.push(
    check(
      'workflow_has_oidc_permission_for_keyless',
      /permissions:[\s\S]*id-token:\s*write/i.test(text),
      'workflow permissions include id-token: write',
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
      'runtime_evidence_has_sbom_and_cosign_verification',
      hasSbomAndCosignEvidence(runtimeEvidence),
      'runtime evidence includes digest-verified sbom_artifacts[] with signature/certificate files and cosign_verification_transcript[] identity+tlog verification',
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
  const outJson = path.join(outDir, 'security-sbom-cosign-latest.json');
  const outMd = path.join(outDir, 'security-sbom-cosign-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# SBOM + Cosign Check

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
