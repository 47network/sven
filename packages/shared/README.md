# @sven/shared

Shared TypeScript utilities, types, and contracts consumed by every service and adapter in the Sven monorepo. Acts as the single source of truth for inter-service contracts, NATS stream definitions, event schemas, and common helpers.

> **Internal package** — not published to npm. Used as a monorepo workspace package dependency.

## What's Inside

| Module | Path | Description |
|--------|------|-------------|
| Types / Models | `src/types/models.ts` | Core domain model types (Agent, Skill, Message, User, etc.) |
| Types / Events | `src/types/events.ts` | NATS event payload types |
| Types / API | `src/types/api.ts` | Gateway REST request/response types |
| NATS Subjects | `src/types/nats-subjects.ts` | All NATS subject name constants |
| NATS Streams | `src/nats/streams.ts` | JetStream stream/consumer definitions |
| API Contract | `src/contracts/api-contract.ts` | Shared request/response contracts (used by Gateway + SDK) |
| Logger | `src/logger.ts` | Structured JSON logger (pino-based) |
| Health | `src/health.ts` | Standard health check response helpers |
| Hash | `src/hash.ts` | Deterministic content hashing utilities |
| Secrets | `src/secrets.ts` | Vault/env secret resolution helpers |
| Crypto / Envelope | `src/crypto/envelope.ts` | Message encryption/decryption envelope |
| Adapter | `src/adapter/index.ts` | Base adapter interface and inbound payload types |
| Integrations | `src/integrations/` | Shared integration helpers: calendar, git, NAS, web |
| SDK | `src/sdk/` | HTTP client factory for service-to-service calls |

## Usage

Any service in the monorepo can import from `@sven/shared`:

```typescript
import { AgentMessage, NATS_SUBJECTS, logger } from '@sven/shared';

logger.info({ subject: NATS_SUBJECTS.AGENT_RUN }, 'dispatching agent run');
```

## Building

```bash
npm --workspace packages/shared run build
```

The compiled output lands in `packages/shared/dist/`. All services depend on the built output except in watch mode where `ts-node` resolves directly from `src/`.

## Contributing

When adding a new type or constant:
1. Add or update in the appropriate `src/types/` or `src/nats/` file.
2. Re-export from `src/index.ts` if needed.
3. Run `npm --workspace packages/shared run build` and commit the updated `dist/`.
4. Bump the version in `package.json` if the change is breaking.

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md).
