# DB Migrate Mixed-Schema Runbook

Use this when gateway DB migrations run against environments that may contain older TEXT-id and newer UUID-id schema fragments.

## Default behavior

- `docker-compose.yml` now sets:
  - `SVEN_MIGRATION_SKIP_INCOMPATIBLE=true`
  - `SVEN_MIGRATION_ID_MODE=text`

This keeps migration runs forward-moving by skipping incompatible files instead of hard-failing.

## Commands

1. Build latest gateway migration runner:

```bash
docker compose build gateway-api
docker compose up -d gateway-api
```

2. Run migrations in compatibility mode:

```bash
docker compose exec -T -e SVEN_MIGRATION_SKIP_INCOMPATIBLE=1 gateway-api node services/gateway-api/dist/db/migrate.js
```

3. Validate strict-mode pass on current DB state:

```bash
docker compose exec -T -e SVEN_MIGRATION_SKIP_INCOMPATIBLE=0 gateway-api node services/gateway-api/dist/db/migrate.js
```

4. Validate service health:

```bash
curl -skI https://app.example.com/readyz
```

## Notes

- Compatibility mode is operationally safe for mixed legacy deployments but may skip feature-specific migrations.
- Any skipped migration should be normalized later into an idempotent, text-id-compatible migration file before strict mode is re-enabled.

