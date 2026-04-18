# Argentum Branch Strategy

## Overview

Sven uses a **dual-branch release model** to separate the public open-source core
from the private autonomous economy and trading infrastructure.

| Branch | Visibility | Content |
|--------|-----------|---------|
| `argentum` | **Private** | Full codebase — core platform + trading, treasury, marketplace, Eidolon economy, misiuni, XLVII, all private skills |
| `sven` | **Public** | Core platform only — gateway, runtime, adapters, RAG, CLI, community skills |

The name **argentum** (Latin for silver, element 47) reflects The 47 Network branding.

---

## What stays private (argentum-only)

All files and directories marked with the `argentum-private` attribute in
`.gitattributes` are **never** pushed to the public `sven` branch.

### Services
- `services/sven-treasury/` — 47Token wallet, crypto, payment rails
- `services/sven-marketplace/` — autonomous economy task execution
- `services/sven-eidolon/` — 3D world simulation, agent parcels, avatars
- `services/marketing-intel/` — competitive analysis, trend research

### Skills
- `skills/trading/` — backtest, chart-analysis, market-data, portfolio, risk
- `skills/autonomous-economy/` — book publishing, social media, misiuni, XLVII,
  ASI-evolve, fleet management, council, memory, skill catalog

### Shared types (economy)
- `packages/shared/src/marketplace.ts`
- `packages/shared/src/treasury.ts`
- `packages/shared/src/eidolon.ts`
- All economy-related type modules (misiuni, xlvii-merch, publishing, social-media,
  llm-council, persistent-memory, model-fleet, asi-evolve, skill-registry,
  video-content, agent-avatars, micro-training)

### Migrations
- All migrations from `20260422120000` onward that create economy tables
- The bootstrap migration (`20260319120000`) and core migrations remain public

### Tests
- Batch test files 7–34 (economy-related test suites)

---

## What is public (sven branch)

- **Gateway API** — core HTTP/WS server, auth, session management
- **Agent Runtime** — skill execution, tool orchestration
- **Admin UI** — management dashboard
- **Canvas UI** — chat interface
- **All channel adapters** — Discord, Slack, Telegram, WhatsApp, etc.
- **RAG pipeline** — git ingestor, indexer, NAS ingestor, notes ingestor
- **CLI** — command-line interface
- **Compute mesh** — distributed execution
- **Document Intel** — document analysis
- **Core skills** — compute-mesh, data-engineering, devops, email-generic,
  image-generation, notifications, ocr, productivity, research, security, quantum
- **Infrastructure** — Docker Compose, Nix flake, deploy scripts (non-economy)
- **Documentation** — all public docs, architecture guides, API references
- **CI/CD workflows** — all GitHub Actions
- **Community files** — CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, SUPPORT, templates

---

## Branch workflow

### Development
All development happens on feature branches off `argentum`:
```
argentum → feature/my-change → PR → argentum
```

### Public sync
When releasing to public:
1. Create a filtered archive: `git archive --worktree-attributes argentum`
2. Files with `export-ignore` are automatically excluded
3. Apply the archive to the `sven` branch
4. Verify no private content leaked (automated CI check)
5. Push `sven` to the public remote

### Safeguards
- `.gitattributes` marks all private paths with `argentum-private export-ignore`
- CI workflow validates no `argentum-private` files exist on `sven` branch
- Pre-push hook checks for accidental private file inclusion
- `packages/shared/src/index.ts` must be sanitized (remove economy exports)

---

## Release checklist

- [ ] All tests pass on `argentum`
- [ ] CHANGELOG updated
- [ ] Version bumped in `package.json`
- [ ] `git archive` produces clean public snapshot
- [ ] No `argentum-private` files in archive
- [ ] `index.ts` exports verified (no economy modules)
- [ ] README accurate for public release
- [ ] All doc links resolve
- [ ] Community templates in place
- [ ] Dependabot configured
- [ ] SECURITY.md contact info current
