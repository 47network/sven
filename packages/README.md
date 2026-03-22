# packages/

Shared internal packages consumed across the Sven monorepo. These packages are **not published to npm** — they are linked via npm workspaces.

| Package | Description |
|---------|-------------|
| [`cli`](./cli/README.md) | The `sven` command-line interface — control agents, approvals, gateway, skills, and auth from your terminal |
| [`shared`](./shared/README.md) | Shared TypeScript types, NATS stream definitions, event contracts, logger, crypto helpers, and SDK utilities used by every service |

## Working with Packages

```bash
# Build all packages
npm run build --workspaces --if-present

# Build a specific package
npm --workspace packages/shared run build
npm --workspace packages/cli run build

# Run tests for a package
npm --workspace packages/cli test
```

## Adding a New Package

1. Create `packages/<name>/` with a `package.json` declaring `"name": "@sven/<name>"`.
2. Add `"@sven/<name>": "*"` as a dependency in whichever services need it.
3. Run `npm install` from the repo root to link it.
4. Export everything through a `src/index.ts`.
5. Add a `README.md` (use the files above as templates).

See the root [CONTRIBUTING.md](../CONTRIBUTING.md) for code style and commit guidelines.
