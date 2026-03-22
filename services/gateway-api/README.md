# gateway-api

The central API service for the Sven platform. All client traffic — web, mobile, desktop, and messaging adapters — flows exclusively through the Gateway API.

## Responsibilities

- **Authentication** — JWT issuance and validation (HS256, short TTL), OIDC token verification (Keycloak SSO)
- **SSE streaming** — real-time agent response/event streaming to all clients
- **REST API** — agents, memory, RAG, scheduler, registry, admin, backup/restore
- **Multi-agent routing** — dispatches messages to the correct agent runtime via NATS
- **Rate limiting** — per-user and per-IP, configurable via env
- **Multi-tenancy** — every request is scoped to an organisation; row-level security enforced at the DB layer
- **Adapter authentication** — validates `SVEN_ADAPTER_TOKEN` on all inbound adapter requests
- **Database migrations** — owns all PostgreSQL schema via Knex migrations

## Tech Stack

- **Runtime**: Node.js 20, TypeScript (ESM)
- **Framework**: Fastify (`@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/cookie`)
- **Database**: PostgreSQL via `pg`
- **Message bus**: NATS JetStream
- **Schema validation**: Zod

## Running Locally

```bash
# Full stack (recommended)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Bare metal
npm --workspace services/gateway-api run dev
# → http://localhost:4000
```

Requires: PostgreSQL, NATS, and a populated `.env` (copy `.env.example`).

## Key Scripts

| Script | Command |
|:-------|:--------|
| Dev (hot-reload) | `npm run dev` |
| Build | `npm run build` |
| Start (production) | `npm run start` |
| Run migrations | `npm run db:migrate` |
| Roll back migrations | `npm run db:migrate:down` |
| Seed DB | `npm run db:seed` |
| Tests | `npm test` |
| Agent E2E tests | `npm run test:agents` |
| Backup/restore E2E | `npm run test:backup-restore` |

## Environment Variables

All variables are documented in [`.env.example`](../../.env.example). Key ones for this service:

| Variable | Description |
|:---------|:------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NATS_URL` | NATS broker URL |
| `GATEWAY_PORT` | Port to listen on (default `4000`) |
| `COOKIE_SECRET` | Session cookie signing secret |
| `JWT_SECRET` | JWT signing secret |
| `CORS_ORIGIN` | Allowed origin for CORS |
| `SVEN_ADAPTER_TOKEN` | Shared secret for adapter authentication |

## API Structure

```
/api/v1/
  auth/           → sign in, sign out, refresh token, SSO callback
  agents/         → CRUD, routing rules, model config
  sessions/       → chat sessions, message history
  memory/         → read, write, delete, export, import memories
  rag/            → index management, query, feedback
  scheduler/      → jobs CRUD, manual trigger, run history
  registry/       → skill marketplace, install, version
  admin/          → users, orgs, tenants, RBAC
  backup/         → create, list, restore, delete
  billing/        → usage, metering, invoices
/v1/stream
  stream          → SSE: agent response/event streaming
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md). For gateway-specific changes:

1. Add migrations to `src/db/migrations/` — never alter existing migrations.
2. New API endpoints go in `src/routes/` with a Zod schema for request/response.
3. Keep all DB queries inside `src/db/` — no raw SQL in route handlers.
4. All breaking API changes must bump the contract version.
