# Container Image Signing Check

Generated: 2026-02-22T16:13:43.703Z
Status: pass

## Checks
- [x] workflow_present: .github/workflows/release-container-signing.yml
- [x] workflow_has_packages_write_permission: workflow permissions include packages: write
- [x] workflow_has_oidc_permission_for_keyless: workflow permissions include id-token: write
- [x] workflow_builds_and_pushes_release_images: workflow builds and pushes container images
- [x] workflow_targets_service_dockerfiles: workflow iterates service Dockerfiles
- [x] workflow_installs_cosign: workflow installs cosign
- [x] workflow_signs_images_with_cosign: workflow signs image digests with cosign
