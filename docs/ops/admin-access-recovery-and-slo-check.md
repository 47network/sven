# Admin Access Recovery and Dashboard SLO Check

Date: 2026-02-14

## Purpose

Recover or create an admin account when credentials are unknown, then run the authenticated dashboard SLO gate.

## Prerequisites

- `DATABASE_URL` available in environment where the command runs (same DB as gateway).
- Node dependencies installed in repo root.

## 1) Upsert admin user (create or reset password)

```bash
set DATABASE_URL=postgresql://USER:PASS@HOST:5432/DB
npm run ops:admin:upsert-user -- --username 47 --password "StrongTemp#2026" --display_name "Admin 47"
```

Notes:
- If user exists, password is reset and role enforced to `admin`.
- If user does not exist, user is created as `admin`.

## 2) Run authenticated dashboard SLO check

Interactive:

```bash
npm run release:admin:dashboard:slo:auth:interactive
```

Non-interactive:

```bash
powershell -ExecutionPolicy Bypass -File scripts/ops/admin/run-dashboard-slo-auth.ps1 `
  -ApiUrl https://app.example.com `
  -AdminUsername 47 `
  -AdminPassword "StrongTemp#2026"
```

## 3) Verify pass criteria

Check:
- `docs/release/status/admin-dashboard-slo-latest.json`

Required:
- `"status": "pass"`
- `"auth_mode": "admin_login"` or `"session_cookie_env"`

