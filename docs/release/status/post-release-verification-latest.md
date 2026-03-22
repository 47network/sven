# Post-Release Verification Snapshot

Generated: 2026-02-13T14:08:20.584Z
API URL: http://127.0.0.1:10557
Overall status: PASS

- [PASS] gateway_healthz: {"status":200}
- [PASS] gateway_readyz: {"status":200}
- [PASS] outbox_queue_lag: {"pending_count":0,"oldest_pending_age_seconds":0}
- [PASS] approval_pipeline: {"pending_approvals":0}
- [PASS] relay_error_rate_15m: {"skipped":true,"message":"browser_relay_commands table not present in this migration baseline"}

