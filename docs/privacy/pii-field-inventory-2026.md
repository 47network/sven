# PII Field Inventory (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Scope

PII/sensitive-field inventory for core Sven Postgres tables in `public` schema.

## Discovery Method

```powershell
docker exec sven_v010-postgres-1 psql -U sven -d sven -P pager=off -c "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND (column_name ~* '(email|phone|name|address|ip|token|secret|password|cookie|session|user_id|chat_id)' OR data_type='inet') ORDER BY table_name, ordinal_position;"
```

## PII/Sensitive Categories

1. Identity and account data
- `users`: `username`, `display_name`, `password_hash`, `totp_secret_enc`
- `identities`: `user_id`, `channel_user_id`, `display_name`
- `identity_links`: `user_id`, `channel_user_id`
- `organization_memberships`: `user_id`
- `organizations`: `name`, `owner_user_id`

2. Contact and notification data
- `calendar_accounts`: `google_email`, `username`, `password_ref`, `oauth_token`
- `mobile_push_tokens`: `user_id`, `token`
- `scheduled_tasks`: `user_id`, `notify_email_to`
- `email_subscriptions`: `name`

3. Conversation-linked personal data
- `messages`: `chat_id`, `sender_user_id`
- `chats`: `name`, `channel_chat_id`
- `chat_members`: `chat_id`, `user_id`
- `artifacts`: `chat_id`, `name`
- `voice_transcripts`: `chat_id`, `transcript`
- `wake_word_events`: `chat_id`

4. Security and secret material
- `webhooks`: `secret`
- `api_keys`: `user_id`, `name`
- `browser_relay_sessions`: `extension_secret_hash`
- `calendar_accounts`: `password_ref`, `oauth_token`

5. Audit/operations personal traces
- `config_change_audit`: `changed_by_user_id`, `source_ip`
- `retention_audit_log`: `target_user_id`, `target_chat_id`, `actor_user_id`
- `approval_votes`: `voter_user_id`
- `approvals`: `requester_user_id`, `chat_id`

## Handling Rules

1. Log redaction applies to secrets and common PII patterns via shared logger and privacy redaction routes.
2. Export/deletion workflow is handled through privacy endpoints and retention audit log.
3. Retention cleanup policies apply per-table classes (messages/artifacts/tool runs/voice/logs/metadata).
