# C2.3 SBOM + Image Signing Baseline (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Audit

Searched repo workflows/scripts/config for SBOM and image-signing toolchain markers:

- `sbom`
- `cyclonedx`
- `spdx`
- `syft`
- `cosign`

Result: release workflows and strict local gates now exist for both SBOM signing and container-image cosign signing.

## 2026-02-22 Workflow Enforcement Added

Implemented:

- Release workflow updates in `.github/workflows/release-supply-chain.yml`:
  - Repository SBOM generation (`anchore/sbom-action`) to `docs/release/status/release-sbom-latest.spdx.json`
  - Cosign installation (`sigstore/cosign-installer`)
  - Keyless cosign signing of SBOM blob (`cosign sign-blob`) producing:
    - `docs/release/status/release-sbom-latest.sig`
    - `docs/release/status/release-sbom-latest.pem`
  - Artifact upload includes SBOM + signature/certificate outputs
  - Workflow permissions include `id-token: write` for keyless signing

- Added strict local workflow gate:
  - Script: `scripts/sbom-cosign-check.cjs`
  - Command: `npm run security:sbom-cosign:check`
  - Status artifact: `docs/release/status/security-sbom-cosign-latest.md` (current status: `pass`)

- Added image signing workflow and strict gate:
  - Workflow: `.github/workflows/release-container-signing.yml`
  - Script: `scripts/container-image-signing-check.cjs`
  - Command: `npm run security:image-signing:check`
  - Status artifact: `docs/release/status/security-image-signing-latest.md` (current status: `pass`)
  - Workflow behavior: iterates all `services/*/Dockerfile` images, pushes to GHCR, signs pushed digest references with keyless cosign.

- Added release-artifact SBOM coverage workflow gate:
  - Script: `scripts/release-artifact-sbom-check.cjs`
  - Command: `npm run security:release-artifact-sbom:check`
  - Status artifact: `docs/release/status/security-release-artifact-sbom-latest.md` (current status: `pass`)
  - Coverage enforced:
    - Repository SBOM output.
    - Per-installer SBOM outputs for:
      - `deploy/quickstart/install.sh`
      - `deploy/quickstart/install.ps1`
      - `deploy/quickstart/install.cmd`
    - Per-service container image SBOM outputs in `release-container-signing` (`docs/release/status/image-sbom-*.spdx.json`).

Current assessment:

- Container image signing coverage is implemented for service release images and gated locally (`pass`).
- SBOM generation/signing is implemented and gated locally (`pass`).
- SBOM-per-release-artifact coverage is implemented and enforced by strict local gate (`pass`).
