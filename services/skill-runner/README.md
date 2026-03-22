# skill-runner

Sandboxed tool execution service for the Sven platform. Runs agent-dispatched tools inside a **gVisor** (runsc) sandbox — syscall interception prevents any tool from escaping the container boundary or accessing the host.

## Responsibilities

- **Tool execution** — receives tool call requests from agent-runtime via NATS and executes the corresponding skill
- **gVisor sandboxing** — all tool code runs under `runsc`; no tool can make arbitrary syscalls or write outside the sandbox volume
- **Secret injection** — secrets are mounted read-only into the sandbox from SOPS / Vault / file; never passed as arguments or written to logs
- **Policy enforcement** — validates tool name, arguments, and caller permissions against the policy engine before execution
- **Quarantine pipeline** — newly submitted dynamic tools land in quarantine; they are not executable until an admin approves them in the registry
- **Output capture** — captures stdout/stderr, enforces output size limits, streams partial output back

## Tech Stack

- **Runtime**: Node.js 20, TypeScript (ESM)
- **Sandboxing**: gVisor (runsc) — required at runtime; see setup below
- **Message bus**: NATS JetStream
- **Schema validation**: Zod

## NATS Subjects

| Subject | Role |
|:--------|:-----|
| `sven.tool.execute.<toolName>` | **Subscribe** — incoming tool execution requests |
| `sven.tool.result.<callId>` | **Publish** — execution result back to agent-runtime |
| `sven.tool.quarantine.<toolName>` | **Publish** — new dynamic tool pending admin review |

## gVisor Setup

gVisor must be installed on the host running the skill-runner container:

```bash
# Install gVisor (Linux only)
curl -fsSL https://gvisor.dev/archive.key | gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" | sudo tee /etc/apt/sources.list.d/gvisor.list
sudo apt-get update && sudo apt-get install -y runsc
sudo runsc install
```

The Docker Compose production profile mounts the gVisor runtime automatically.

## Running Locally (dev mode)

In development (without gVisor), tools run in standard Node.js with restricted permissions. This is sufficient for writing and testing skills but does **not** provide the production security boundary.

```bash
# Full stack
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Bare metal
npm --workspace services/skill-runner run dev
```

## Key Scripts

| Script | Command |
|:-------|:--------|
| Dev | `npm run dev` |
| Build | `npm run build` |
| Start | `npm run start` |
| Tests | `npm test` |

## Writing Skills

Skills live in the `skills/` directory at the monorepo root. Each skill must follow the `SKILL.md` authoring standard:

- Export a default function with typed input/output (Zod schema)
- Declare its capability manifest (`name`, `description`, `parameters`, `permissions`)
- Declare all secrets it needs (they will be injected, not passed as args)
- Include a `skill.test.ts` with at least one happy-path and one error-path test

Agent-authored dynamic skills go through the quarantine pipeline before they can be activated. See the Admin UI Registry section.

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md). Sandbox runtime wiring is in `src/sandbox/`. Policy enforcement is in `src/policy/`. Tool registry and quarantine logic are in `src/registry/`.
