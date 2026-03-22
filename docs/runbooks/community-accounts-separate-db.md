# Community Accounts (Separate DB) Runbook

This setup keeps community user accounts and reputation outside Sven core data, while exposing admin visibility in Sven.

## 1) Create separate database/table

Run this SQL in your community database:

```sql
CREATE TABLE IF NOT EXISTS community_accounts (
  account_id TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  reputation NUMERIC,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_accounts_reputation
  ON community_accounts (reputation DESC);
```

## 2) Configure gateway env

Set these in your gateway environment:

```env
COMMUNITY_DATABASE_URL=postgres://user:pass@host:5432/community_db
COMMUNITY_ACCOUNTS_TABLE=community_accounts
COMMUNITY_ACCOUNTS_ACCOUNT_ID_COL=account_id
COMMUNITY_ACCOUNTS_HANDLE_COL=handle
COMMUNITY_ACCOUNTS_EMAIL_COL=email
COMMUNITY_ACCOUNTS_REPUTATION_COL=reputation
COMMUNITY_ACCOUNTS_VERIFIED_COL=verified
COMMUNITY_ACCOUNTS_CREATED_AT_COL=created_at
COMMUNITY_ACCOUNTS_UPDATED_AT_COL=updated_at
COMMUNITY_ACCESS_REQUESTS_TABLE=community_access_requests
```

Only `COMMUNITY_DATABASE_URL` is required when using default column names.

## 3) Access model

- Admin page: `/admin47/community`
- Endpoint: `GET /v1/admin/community/accounts/status`
- Endpoints:
  - `GET /v1/admin/community/accounts` (registry list, supports `limit`, `verified`, `q`)
  - `PATCH /v1/admin/community/accounts/:accountId` (set `reputation`, `verified`)
- Security: restricted to `platform_admin` role
- Public endpoint: `GET /v1/public/community/status` (policy/readiness only, no account list)
- Public leaderboard endpoint: `GET /v1/public/community/leaderboard`

## 4) Expected behavior

- If DB is configured and reachable:
  - backend: `separate_db`
  - connected: `true`
  - aggregate reputation stats and top accounts visible in admin
  - approved access requests auto-provision member rows in `community_accounts`
  - `verified` is computed from persona evidence (`sso_identities`) + `SVEN_COMMUNITY_PERSONA_ALLOWLIST` policy
  - public community page shows leaderboard from the same table
- If not configured:
  - backend: `disabled`
  - connected: `false`
  - warning explains missing `COMMUNITY_DATABASE_URL`
