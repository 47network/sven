#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const workflowPath = path.join(root, '.github', 'workflows', 'release-container-signing.yml');
const outDir = path.join(root, 'docs', 'release', 'status');
const runtimeEvidencePath = process.env.SVEN_SECURITY_IMAGE_SIGNING_EVIDENCE_PATH
  ? path.resolve(root, process.env.SVEN_SECURITY_IMAGE_SIGNING_EVIDENCE_PATH)
  : path.join(root, 'docs', 'release', 'status', 'security-image-signing-evidence-latest.json');

function check(id, pass, detail) {
  return { id, pass, detail };
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

function normalizeDigest(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  return raw.startsWith('sha256:') ? raw : `sha256:${raw}`;
}

function sha256File(filePath) {
  const crypto = require('node:crypto');
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return `sha256:${hash.digest('hex')}`;
}

function hasRunProvenance(evidence) {
  if (!evidence || typeof evidence !== 'object') return false;
  const runIdValid = Number.isInteger(evidence.run_id) || /^\d+$/.test(String(evidence.run_id || ''));
  const headShaValid = /^[a-f0-9]{7,40}$/i.test(String(evidence.head_sha || ''));
  const refValid = String(evidence.ref || '').trim().length > 0;
  return runIdValid && headShaValid && refValid;
}

function hasVerifiedImageSignatures(evidence) {
  if (!evidence || typeof evidence !== 'object' || !Array.isArray(evidence.signed_images)) return false;
  if (evidence.signed_images.length === 0) return false;
  return evidence.signed_images.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const image = String(item.image || '').trim();
    const digest = String(item.digest || '').trim();
    const verified = item.signature_verified === true;
    return image.length > 0 && /^sha256:[a-f0-9]{64}$/i.test(digest) && verified;
  });
}

function hasVerificationTranscript(evidence) {
  return (
    evidence
    && typeof evidence === 'object'
    && Array.isArray(evidence.cosign_verification_transcript)
    && evidence.cosign_verification_transcript.length > 0
  );
}

function validateVerificationTranscript(evidence) {
  if (!hasVerificationTranscript(evidence)) {
    return { pass: false, detail: 'missing cosign_verification_transcript entries' };
  }
  if (!hasVerifiedImageSignatures(evidence)) {
    return { pass: false, detail: 'signed_images verification prerequisites not satisfied' };
  }
  const rows = evidence.cosign_verification_transcript;
  const byDigest = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      return { pass: false, detail: 'transcript row must be an object' };
    }
    const digest = normalizeDigest(row.digest);
    if (!/^sha256:[a-f0-9]{64}$/i.test(digest)) {
      return { pass: false, detail: 'transcript row missing valid digest' };
    }
    if (byDigest.has(digest)) {
      return { pass: false, detail: `duplicate transcript digest row: ${digest}` };
    }
    byDigest.set(digest, row);
  }

  for (const image of evidence.signed_images) {
    const digest = normalizeDigest(image.digest);
    const transcript = byDigest.get(digest);
    if (!transcript) {
      return { pass: false, detail: `missing transcript row for signed digest ${digest}` };
    }
    if (!/cosign\s+verify(?:-blob)?\b/i.test(String(transcript.verification_command || ''))) {
      return { pass: false, detail: `invalid verification command for ${digest}` };
    }
    if (transcript.signature_verified !== true) {
      return { pass: false, detail: `signature verification flag is not true for ${digest}` };
    }
    if (transcript.certificate_identity_verified !== true) {
      return { pass: false, detail: `certificate identity flag is not true for ${digest}` };
    }
    if (transcript.tlog_verified !== true) {
      return { pass: false, detail: `transparency log flag is not true for ${digest}` };
    }
    const expectedOutputSha = normalizeDigest(transcript.verification_output_sha256);
    if (!/^sha256:[a-f0-9]{64}$/i.test(expectedOutputSha)) {
      return { pass: false, detail: `invalid verification_output_sha256 for ${digest}` };
    }
    const outputPathRef = String(transcript.verification_output_path || '').trim();
    const outputPath = resolveArtifactPath(outputPathRef);
    if (!outputPath) {
      return { pass: false, detail: `missing verification output artifact for ${digest}` };
    }
    const actualOutputSha = sha256File(outputPath);
    if (actualOutputSha.toLowerCase() !== expectedOutputSha.toLowerCase()) {
      return { pass: false, detail: `verification output hash mismatch for ${digest}` };
    }
  }
  return { pass: true, detail: `validated ${evidence.signed_images.length} digest verification transcripts` };
}

function main() {
  const checks = [];
  const exists = fs.existsSync(workflowPath);
  checks.push(check('workflow_present', exists, '.github/workflows/release-container-signing.yml'));
  const text = exists ? fs.readFileSync(workflowPath, 'utf8') : '';
  const runtimeEvidence = readJsonIfExists(runtimeEvidencePath);

  checks.push(
    check(
      'workflow_has_packages_write_permission',
      /permissions:[\s\S]*packages:\s*write/i.test(text),
      'workflow permissions include packages: write',
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
      'workflow_builds_and_pushes_release_images',
      /(docker\s+build\b|docker\s+buildx\s+build\b)[\s\S]*(docker\s+push\b|--push\b)/i.test(text),
      'workflow builds and pushes container images',
    ),
  );
  checks.push(
    check(
      'workflow_targets_service_dockerfiles',
      /(services\/\*\/Dockerfile|find\s+services[\s\S]*Dockerfile)/i.test(text),
      'workflow iterates service Dockerfiles',
    ),
  );
  checks.push(
    check(
      'workflow_installs_cosign',
      /sigstore\/cosign-installer@/i.test(text),
      'workflow installs cosign',
    ),
  );
  checks.push(
    check(
      'workflow_signs_images_with_cosign',
      /cosign\s+sign\s+--yes/i.test(text),
      'workflow signs image digests with cosign',
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
      'runtime_evidence_has_verified_image_signatures',
      hasVerifiedImageSignatures(runtimeEvidence),
      'runtime evidence includes signed_images[] with sha256 digests and signature_verified=true',
    ),
  );
  checks.push(
    check(
      'runtime_evidence_has_cosign_verification_transcript',
      hasVerificationTranscript(runtimeEvidence),
      'runtime evidence includes cosign_verification_transcript[] entries',
    ),
  );
  const transcriptValidation = validateVerificationTranscript(runtimeEvidence);
  checks.push(
    check(
      'runtime_evidence_verification_transcript_valid',
      transcriptValidation.pass,
      transcriptValidation.detail,
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
  const outJson = path.join(outDir, 'security-image-signing-latest.json');
  const outMd = path.join(outDir, 'security-image-signing-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    `# Container Image Signing Check

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
