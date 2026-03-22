# agent-runtime

The LLM orchestration engine for the Sven platform. Executes agent conversations, manages the tool-use loop, reads and writes memory, and dispatches tool calls to the skill runner.

## Responsibilities

- **LLM execution** — calls LiteLLM proxy with streaming; handles multi-model per-agent configuration
- **Tool dispatch** — detects tool calls in model output, validates against policy engine, dispatches to skill runner via NATS
- **Memory R/W** — queries memory pipeline (BM25 + pgvector, temporal decay, MMR), writes new memories post-conversation
- **RAG context injection** — fetches relevant RAG chunks and injects into context window before LLM call
- **Self-correcting loop** — classifies errors, retries with bounded counter, detects infinite loops, triggers approval gates
- **Sub-agent orchestration** — spawns child agent runtimes with isolated context
- **Agent pause / resume** — persists mid-task state to NATS KV, resumes on request
- **Proactive execution** — handles scheduled proactive message triggers from workflow executor

## Tech Stack

- **Runtime**: Node.js 20, TypeScript (ESM)
- **Message bus**: NATS JetStream (primary I/O)
- **LLM**: LiteLLM proxy (any provider via API)
- **Database**: PostgreSQL via `pg`
- **Schema validation**: Zod

## NATS Subjects

| Subject | Role |
|:--------|:-----|
| `sven.agent.run.<agentId>` | **Subscribe** — incoming conversation requests from Gateway |
| `sven.agent.result.<sessionId>` | **Publish** — streaming response chunks back to Gateway |
| `sven.tool.execute.<toolName>` | **Publish** — tool execution requests to Skill Runner |
| `sven.tool.result.<callId>` | **Subscribe** — tool execution results from Skill Runner |
| `sven.rag.query.*` | **Publish** — RAG retrieval requests to RAG Indexer |
| `sven.memory.write.*` | **Publish** — new memory entries to be indexed |

## Running Locally

```bash
# Full stack (recommended)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Bare metal (requires NATS + PostgreSQL + LiteLLM running)
npm --workspace services/agent-runtime run dev
```

## Key Scripts

| Script | Command |
|:-------|:--------|
| Dev (hot-reload) | `npm run dev` |
| Build | `npm run build` |
| Start (production) | `npm run start` |
| Tests | `npm test` |
| Citation check | `npm run test:citations` |

## Agent Execution Flow

```
1. Receive sven.agent.run.<agentId> from NATS
2. Load agent config (model, system prompt, tools, memory scope)
3. Fetch memories: hybrid BM25 + vector → temporal decay → MMR top-k
4. Inject RAG chunks + memories into context window
5. Call LiteLLM (streaming)
   ├─ Text delta → publish to sven.agent.result.*
   └─ Tool call detected
         ├─ Check policy engine (allowlist, privilege scope, budget)
         ├─ Publish to sven.tool.execute.<toolName>
         ├─ Await sven.tool.result.<callId>
         └─ Inject result → continue loop
6. Write new memories from conversation
7. Publish final done signal
```

**Error handling**: on any failure, classify error type → apply strategy (retry with backoff, reformulate prompt, request human approval, or abandon with explanation). Infinite loop detection via bounded iteration counter.

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md). Agent logic lives in `src/agent/`. Tool dispatch lives in `src/tools/`. Memory operations live in `src/memory/`.
