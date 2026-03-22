# Post-Release Verification Checklist

Run immediately after deployment.

Automation helper:

- `npm run release:verify:post`
- Output:
  - `docs/release/status/post-release-verification-latest.json`
  - `docs/release/status/post-release-verification-latest.md`

1. Gateway health: `GET /healthz` and `GET /readyz`
2. Queue depth / lag:
   - NATS consumer pending messages
   - Outbox pending count
3. Error rate and latency:
   - 5xx rate over last 5-15 minutes
   - p95 latency over last 5-15 minutes
4. Approval pipeline:
   - Create test approval
   - Vote/resolve path
5. Audit logging:
   - Confirm write action records are present
6. Channel smoke test:
   - Send and receive a test message on at least one adapter
7. Rollback readiness:
   - Confirm rollback toggles and prior image tags are available
