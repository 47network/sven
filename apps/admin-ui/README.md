# admin-ui

The full-featured administration dashboard for the Sven platform. Provides complete control over every aspect of the platform — agents, memory, RAG, scheduler, skill registry, billing, observability, users, and organisations.

## What it does

- **Agent management** — create, configure, and test agents; set models, system prompts, tool allowlists, routing rules, and memory scopes
- **Memory dashboard** — browse, search, edit, delete, bulk-export, and import memories for any user or scope
- **RAG management** — manage ingestors (Git / NAS / Notes), trigger re-indexing, query the index, provide retrieval feedback
- **Scheduler** — create one-time and recurring tasks, view run history, manually trigger, enable/disable
- **Skill registry** — browse the marketplace, install skills, review and approve quarantined dynamic tools, manage versions
- **Users & organisations** — invite users, manage RBAC roles, configure tenant isolation, view usage metering and billing
- **Observability** — SLO dashboard, agent performance metrics, memory growth, API contract coverage, alert status
- **Backup & restore** — trigger backups, view backup history, restore from any snapshot
- **Key rotation** — rotate JWT secrets, adapter tokens, and DB credentials without downtime

## Tech Stack

- **Framework**: React 18
- **Language**: TypeScript (strict)
- **Build**: Vite
- **Routing**: React Router v6
- **State management**: Zustand + React Query
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Realtime transport**: native browser `EventSource` (SSE) to Gateway API

## Running Locally

```bash
# Full stack (recommended)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Bare metal (requires Gateway API running on :4000)
npm --workspace apps/admin-ui run dev
# → http://localhost:3000
```

## Key Scripts

| Script | Command |
|:-------|:--------|
| Dev (hot-reload) | `npm run dev` |
| Build | `npm run build` |
| Preview (built) | `npm run preview` |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| E2E tests | `npm run test:e2e` |

## Environment Variables

| Variable | Description |
|:---------|:------------|
| `VITE_GATEWAY_URL` | Gateway API base URL used by admin SSE endpoints (default `http://localhost:4000`) |

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md). UI components live in `src/components/`. Route-level pages live in `src/pages/`. API client wrappers live in `src/api/`. Keep all store slices in `src/store/`.
