# Agent Log Rotation

Automated log lifecycle management — rotation policies, archive storage, and retention enforcement.

## Triggers
- `logrot_create_policy` — Create a log rotation policy for a log source
- `logrot_update_policy` — Update rotation interval, retention, or compression settings
- `logrot_archive_logs` — Archive logs matching a policy to configured backend
- `logrot_run_retention` — Execute retention job to purge expired archives
- `logrot_list_archives` — List archived log files with metadata
- `logrot_report` — Generate log rotation statistics and storage usage

## Outputs
- Log rotation policies with configurable intervals and retention
- Compressed archives in S3/GCS/Azure Blob with checksums
- Retention job history with bytes reclaimed tracking
