# Evidence: API File Upload Size Limits (C5.3)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C5.3`

## Implemented

- Added shared upload-size validation helpers:
  - `services/gateway-api/src/lib/upload-validation.ts`
  - Default max upload size: `50MB` (`SVEN_FILE_UPLOAD_MAX_BYTES`, default `52428800`)
  - Base64 decoded-size estimation before decode (prevents unnecessary large allocations)
  - Base64 format validation
- Enforced upload max size in backup upload path:
  - `services/gateway-api/src/services/BackupService.ts`
  - `registerUploadedBackup()` now:
    - validates base64 format
    - estimates decoded size and rejects if over 50MB default
    - verifies decoded buffer length is within max
- Added explicit HTTP status mapping for upload validation:
  - `services/gateway-api/src/routes/admin/backups.ts`
  - Returns `413` for oversized uploads
  - Returns `400` for invalid base64 payload

## Test Coverage

- Added helper tests:
  - `services/gateway-api/src/__tests__/upload-validation.test.ts`
  - Covers base64-size estimation and base64 format checks.

## Notes

- Global JSON body limit still applies (`API_MAX_BODY_BYTES`, default 10MB). Upload endpoints now additionally enforce an explicit file-size ceiling of 50MB default on decoded payloads.
