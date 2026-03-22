# Development Machine Handoff 2026

This document defines the safe handoff path when moving Sven development to a different machine.

## GitHub Branches

Preservation branch:

- `backup/2026-03-19-worktree-snapshot`

Clean merge lanes:

1. `lane/runtime-core`
2. `lane/admin-canvas-ui`
3. `lane/service-integrations`
4. `lane/deploy-and-ingress`
5. `lane/docs-canonical`
6. `lane/mobile-selected`
7. `lane/release-automation`
8. `lane/ops-release-scripts`

## Merge Order

Apply the clean lanes into `thesven` in this order:

1. `lane/runtime-core`
2. `lane/admin-canvas-ui`
3. `lane/service-integrations`
4. `lane/deploy-and-ingress`
5. `lane/docs-canonical`
6. `lane/mobile-selected`
7. `lane/release-automation`
8. `lane/ops-release-scripts`

Do not merge `backup/2026-03-19-worktree-snapshot`. Keep it as recovery-only history.

## What Must Move

Move by Git only:

- source branches listed above
- canonical docs
- deploy assets
- release scripts

## What Must Not Move

Do not copy host-local runtime state from this machine:

- `node_modules/`
- `apps/*/.next/`
- Flutter caches such as `.dart_tool/` and `build/`
- `deploy/nginx/windows/acme-challenge/`
- `deploy/nginx/windows/certbot/`
- `deploy/nginx/windows/certs/`
- `deploy/nginx/windows/logs/`
- `deploy/nginx/windows/temp/`
- `.runtime/`
- `tmp/`
- `.git/info/exclude`

These are machine-local runtime or cache artifacts and should be rebuilt or reissued on the new host.

## First Commands On The New Machine

```powershell
git clone https://github.com/47network/thesven.git
cd thesven
git fetch --all --prune
git branch -r
```

Then review or merge the clean lanes in the merge order above.

## Current Source Of Truth

For public release examples:

- `https://example.com`
- `https://app.example.com`

For the live deployment split currently in use:

- `https://sven.systems:44747`
- `https://app.sven.systems:44747`
- `https://admin.sven.systems:44747`

## Current Machine State

This machine was left in a safe local-clean state:

- Git worktree clean
- IDE pending-change noise removed
- disposable Flutter caches removed
- live nginx runtime state intentionally left in place

That means this machine can still host the current runtime while development moves elsewhere.
