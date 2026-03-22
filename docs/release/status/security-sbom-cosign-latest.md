# SBOM + Cosign Check

Generated: 2026-02-22T16:13:43.659Z
Status: pass

## Checks
- [x] workflow_present: .github/workflows/release-supply-chain.yml
- [x] workflow_has_syft_or_sbom_action: release-supply-chain workflow includes SBOM generation step
- [x] workflow_has_cosign_installer: release-supply-chain workflow installs cosign
- [x] workflow_has_cosign_sign_or_attest: release-supply-chain workflow executes cosign signing/attestation
- [x] workflow_uploads_sbom_or_signature_artifacts: release-supply-chain workflow uploads SBOM/signing artifacts
- [x] workflow_has_oidc_permission_for_keyless: workflow permissions include id-token: write
