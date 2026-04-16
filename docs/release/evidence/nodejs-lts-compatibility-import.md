# Node.js LTS Compatibility Import

Imported at (UTC): `2026-04-16T11:00:00.000Z`

Source: https://nodejs.org/en/about/previous-releases

## Summary

Sven targets Node.js 20 (Iron LTS) as the primary runtime.

| Version | Codename | Status     | Active LTS Start | Maintenance End |
|---------|----------|------------|-------------------|-----------------|
| 20.x    | Iron     | Active LTS | 2023-10-24        | 2026-04-30      |
| 22.x    | Jod      | Active LTS | 2024-10-29        | 2027-04-30      |

## Engine Constraint

From `package.json` root:

```json
"engines": { "node": ">=20" }
```

## Validation

- CI matrix runs Node.js 20.x (pnpm-lock.yaml tested with `--frozen-lockfile`)
- `tsconfig.base.json` targets ES2022 (Node 20+ native support)
- All dependencies audited for Node 20 compatibility
