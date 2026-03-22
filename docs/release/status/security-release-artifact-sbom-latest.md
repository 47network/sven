# Release Artifact SBOM Coverage Check

Generated: 2026-02-22T16:13:43.631Z
Status: pass

## Checks
- [x] supply_chain_workflow_present: .github/workflows/release-supply-chain.yml
- [x] container_signing_workflow_present: .github/workflows/release-container-signing.yml
- [x] repo_sbom_output_present: repository SBOM output file configured
- [x] installer_sh_sbom_output_present: install.sh SBOM output file configured
- [x] installer_ps1_sbom_output_present: install.ps1 SBOM output file configured
- [x] installer_cmd_sbom_output_present: install.cmd SBOM output file configured
- [x] supply_chain_uploads_installer_sboms: release-supply-chain uploads installer SBOM artifacts
- [x] container_workflow_installs_syft: release-container-signing installs syft
- [x] container_workflow_generates_per_image_sboms: release-container-signing generates SPDX SBOM per service image
- [x] container_workflow_uploads_image_sboms: release-container-signing uploads image SBOM files
