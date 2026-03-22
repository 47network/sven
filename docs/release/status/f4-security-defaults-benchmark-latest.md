# F4 Security Defaults Benchmark

Generated: 2026-03-21T00:35:02.724Z
API base: http://127.0.0.1:15811
Status: inconclusive

## Summary
- denial_checks_total: 10
- denial_checks_passed: 0
- denial_checks_failed: 0
- denial_checks_skipped: 10
- unauthenticated_actions_accepted: 0
- security_audit_meta_pass: true
- remediation_minutes: 5
- remediation_minutes_pass: true
- gateway_probe: n/a (reachable=false)

## Criteria
- [x] 0 unauthenticated inbound actions accepted
- [x] Security audit includes severity + config_path + remediation (high-risk findings)
- [x] Operator remediation <= 10 minutes

## Denial Matrix
- [~] adapter_events_message_missing_token_denied: status=n/a expected=401 mode=no_auth detail=fetch failed; gateway_unavailable(healthz=n/a)
- [~] adapter_events_message_bad_token_denied: status=n/a expected=403 mode=bad_adapter_token detail=fetch failed; gateway_unavailable(healthz=n/a)
- [~] adapter_events_file_missing_token_denied: status=n/a expected=401 mode=no_auth detail=fetch failed; gateway_unavailable(healthz=n/a)
- [~] adapter_events_audio_missing_token_denied: status=n/a expected=401 mode=no_auth detail=fetch failed; gateway_unavailable(healthz=n/a)
- [~] adapter_identity_resolve_missing_token_denied: status=n/a expected=401 mode=no_auth detail=fetch failed; gateway_unavailable(healthz=n/a)
- [~] admin_webhooks_unauth_denied: status=n/a expected=401/403 mode=no_auth detail=fetch failed; gateway_unavailable(healthz=n/a)
- [~] admin_webhooks_forged_session_denied: status=n/a expected=401/403 mode=forged_session detail=fetch failed; gateway_unavailable(healthz=n/a)
- [~] tools_browser_action_unauth_denied: status=n/a expected=401/403 mode=no_auth detail=fetch failed; gateway_unavailable(healthz=n/a)
- [~] push_register_unauth_denied: status=n/a expected=401/403 mode=no_auth detail=fetch failed; gateway_unavailable(healthz=n/a)
- [~] openai_chat_completions_missing_bearer_denied: status=n/a expected=401 mode=no_auth detail=fetch failed; gateway_unavailable(healthz=n/a)

## Security Audit Metadata Check
- [x] security_audit_remediation_metadata: high_risk_findings=2, high_risk_with_meta=2, partial_meta=0

## Notes
- Gateway unreachable/degraded for auth matrix; run again against healthy gateway API target.
