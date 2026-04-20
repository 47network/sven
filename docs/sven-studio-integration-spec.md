# Sven Studio IDE — Integration Specification

> **Version**: 1.0.0  
> **Audience**: IDE sidecar (Go), extension/plugin layer, Sven Studio frontend  
> **Base URL (LAN)**: `http://10.47.47.8:3000` (WireGuard) or `http://192.168.7.59:8088` (docker-host ingress)  
> **Base URL (public)**: `https://app.sven.systems:44747`

---

## Table of Contents

1. [Authentication & Session Management](#1-authentication--session-management)
2. [Sven API Endpoint Catalog](#2-sven-api-endpoint-catalog)
3. [Real-Time Events](#3-real-time-events)
4. [Forgejo Git Integration](#4-forgejo-git-integration)
5. [Runner & Sandbox](#5-runner--sandbox)
6. [Deployment Tracking](#6-deployment-tracking)
7. [Knowledge Base & RAG](#7-knowledge-base--rag)
8. [LAN Network Topology](#8-lan-network-topology)
9. [Database & Shared State](#9-database--shared-state)
10. [Error Codes & Rate Limits](#10-error-codes--rate-limits)

---

## 1. Authentication & Session Management

### 1.1 Auth Model

Sven uses **session-cookie** authentication — **not** Keycloak/JWT bearer tokens.
All authenticated requests must carry cookies set by the login flow.

| Cookie           | Purpose              | Max-Age   | Flags                                      |
|:-----------------|:---------------------|:----------|:--------------------------------------------|
| `sven_session`   | Access token (opaque)| 7 days    | `HttpOnly`, `Secure` (prod), `SameSite=Strict`, `Path=/` |
| `sven_refresh`   | Refresh token        | 90 days   | Same flags as above                          |

> **Important**: In production (`NODE_ENV=production`), cookies are `Secure`-flagged.
> On LAN dev, `Secure` is **not** set — plain HTTP works.

### 1.2 Login (Username + Password)

```
POST /v1/auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string",
  "totp_code": "string"    // optional — required only if 2FA is enabled
}
```

**Success (200)**:
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "username": "...", "display_name": "...", "role": "admin" },
    "org": { "id": "...", "slug": "..." }
  }
}
```

Response sets `Set-Cookie: sven_session=...; sven_refresh=...`.

**Failure (401)**:
```json
{
  "success": false,
  "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid username or password" }
}
```

### 1.3 Device Flow (Recommended for Go Sidecar)

The device flow is the **recommended** auth method for headless clients like the
IDE sidecar. It avoids storing user credentials and works like GitHub CLI's login.

#### Step 1 — Start device authorization

```
POST /v1/auth/device/start
Content-Type: application/json

{
  "client_name": "sven-studio",     // human-readable client name
  "client_type": "ide",             // client category
  "scope": "full"                   // optional scope hint
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "device_code": "a1b2c3...hex48",
    "user_code": "ABCD-1234",
    "verification_uri": "https://app.sven.systems/login?device=1",
    "verification_uri_complete": "https://app.sven.systems/login?device=1&user_code=ABCD-1234",
    "expires_in": 1800,
    "interval": 5
  }
}
```

- Display `user_code` to the developer, open `verification_uri_complete` in browser.
- `expires_in` = 1800 seconds (30 minutes).
- `interval` = 5 seconds (minimum poll delay).

#### Step 2 — User approves in browser

```
POST /v1/auth/device/confirm
Content-Type: application/json
Cookie: sven_session=<user's browser session>

{
  "user_code": "ABCD-1234"
}
```

This is called by the **web UI** (not the sidecar). The user sees the code in the
browser and clicks "Approve".

#### Step 3 — Sidecar polls for token

```
POST /v1/auth/device/token
Content-Type: application/json

{
  "device_code": "a1b2c3...hex48"
}
```

**While pending (200)**:
```json
{ "success": false, "error": { "code": "AUTHORIZATION_PENDING", "message": "..." } }
```

**When approved (200)** — sets session cookies:
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "username": "...", "role": "admin" },
    "session_id": "..."
  }
}
```

**When expired (200)**:
```json
{ "success": false, "error": { "code": "EXPIRED_TOKEN", "message": "Device code expired" } }
```

**Rate limits** (per IP, configurable via env):
| Action  | Default Limit | Window     | Lockout    |
|:--------|:--------------|:-----------|:-----------|
| start   | 20 req        | 60 sec     | 120 sec    |
| confirm | 60 req        | 60 sec     | 120 sec    |
| token   | 240 req       | 60 sec     | 120 sec    |

### 1.4 SSO (OIDC / SAML)

If the Sven instance has OIDC configured:

```
GET /v1/auth/sso/oidc/authorize?redirect_uri=<uri>&state=<csrf>
```

The sidecar can initiate OIDC login by opening this URL in the user's browser,
then capturing the redirect callback. SAML is also supported via
`POST /v1/auth/sso/saml/callback`.

State TTL: 10 minutes. Max clock skew: 120 seconds (configurable via
`SVEN_OIDC_MAX_CLOCK_SKEW_SEC`).

### 1.5 Session Validation

```
GET /v1/auth/me
Cookie: sven_session=...
```

**Authenticated (200)**:
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "username": "...", "display_name": "...", "role": "admin" },
    "org": { "id": "...", "slug": "...", "name": "..." }
  }
}
```

**Not authenticated (401)**:
```json
{ "success": false, "error": { "code": "UNAUTHORIZED", "message": "Not authenticated" } }
```

### 1.6 Logout

```
POST /v1/auth/logout
Cookie: sven_session=...
```

Clears both `sven_session` and `sven_refresh` cookies.

### 1.7 Brute-Force Protection

- **Max failed attempts**: 5 (env: `AUTH_MAX_FAILED`)
- **Lockout duration**: 15 minutes (env: `AUTH_LOCKOUT_MS`)
- **TOTP max attempts**: 5 per session
- Lockout is per-user, tracked in-memory

### 1.8 CSRF Protection

Trusted origins configured via `SVEN_CSRF_TRUSTED_ORIGINS` (comma-separated).
State-changing requests from untrusted origins are rejected.

---

## 2. Sven API Endpoint Catalog

All routes live under the gateway-api service. Base path: `/v1/`.

### 2.1 Standard Response Envelope

**Success**:
```json
{ "success": true, "data": { ... } }
```

**Error**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

### 2.2 Health & Readiness

| Method | Path                    | Auth | Purpose                           |
|:-------|:------------------------|:-----|:----------------------------------|
| GET    | `/healthz`              | No   | Liveness probe (always 200)       |
| GET    | `/readyz`               | No   | Readiness (checks Postgres + NATS)|
| GET    | `/v1/contracts/version` | No   | API contract version + surfaces   |

**`/readyz` response**:
```json
{
  "status": "pass",
  "checks": [
    { "name": "postgres", "status": "pass", "duration_ms": 2 },
    { "name": "nats", "status": "pass", "duration_ms": 1 }
  ]
}
```

Health responses are cached (default: 1000ms, env: `HEALTH_CACHE_TTL_MS`,
range: 100–60000ms).

### 2.3 Chat / Canvas

| Method | Path                                  | Auth  | Purpose                              |
|:-------|:--------------------------------------|:------|:-------------------------------------|
| GET    | `/v1/canvas/chats`                    | User  | List user's chats                    |
| POST   | `/v1/canvas/chats`                    | User  | Create a new chat                    |
| GET    | `/v1/canvas/chats/:chatId`            | User  | Get chat details + messages          |
| POST   | `/v1/canvas/chats/:chatId/messages`   | User  | Send message (triggers AI response)  |
| DELETE | `/v1/canvas/chats/:chatId`            | User  | Delete chat                          |
| GET    | `/v1/canvas/chats/:chatId/stream`     | User  | SSE stream for real-time updates     |

### 2.4 Entity State (Avatar / AI State)

| Method | Path                       | Auth  | Purpose                            |
|:-------|:---------------------------|:------|:-----------------------------------|
| GET    | `/v1/entity/state`         | User  | Current entity state (snapshot)    |
| GET    | `/v1/entity/avatar`        | User  | Current entity form/avatar         |
| PATCH  | `/v1/entity/avatar`        | User  | Update entity form                 |
| GET    | `/v1/entity/stream`        | User  | SSE — real-time entity state       |

Query param for SSE: `?channel=<default|chatId>`.

### 2.5 Stream Resume (Reconnection Protocol)

| Method | Path                           | Auth  | Purpose                          |
|:-------|:-------------------------------|:------|:---------------------------------|
| POST   | `/v1/streams`                  | User  | Create a stream session          |
| POST   | `/v1/streams/:id/events`       | User  | Push event to stream             |
| GET    | `/v1/streams/:id/events`       | User  | Replay events (from `?after=seq`)|
| GET    | `/v1/streams/:id/subscribe`    | User  | SSE subscription to stream       |
| DELETE | `/v1/streams/:id`              | User  | Close stream                     |

**Stream config** (env vars):
| Env Var                             | Default  | Range          |
|:------------------------------------|:---------|:---------------|
| `STREAM_RESUME_TTL_MS`              | 120000   | 10000–600000   |
| `STREAM_RESUME_MAX_EVENTS`          | 500      | 1–5000         |
| `STREAM_RESUME_MAX_EVENT_DATA_BYTES`| 65536    | 1024–1048576   |
| `STREAM_RESUME_MAX_STREAM_EVENT_BYTES` | 1048576 | 65536–16777216 |
| `STREAM_RESUME_CLEANUP_MS`          | 30000    | 1000–300000    |

### 2.6 Admin Routes

All admin routes require `role=admin`. Prefix: `/v1/admin/`.

#### Core Admin

| Method | Path                                          | Purpose                        |
|:-------|:----------------------------------------------|:-------------------------------|
| GET    | `/v1/admin/users`                             | List users                     |
| POST   | `/v1/admin/users`                             | Create user                    |
| GET    | `/v1/admin/settings`                          | Platform settings              |
| PUT    | `/v1/admin/settings`                          | Update settings                |
| GET    | `/v1/admin/agents`                            | List AI agents                 |
| POST   | `/v1/admin/agents`                            | Create/configure agent         |

#### Git Repositories

| Method | Path                                          | Purpose                        |
|:-------|:----------------------------------------------|:-------------------------------|
| GET    | `/v1/admin/git/repos`                         | List git repos                 |
| POST   | `/v1/admin/git/repos`                         | Add git repo                   |
| GET    | `/v1/admin/git/repos/:repoId`                 | Get repo details               |
| PUT    | `/v1/admin/git/repos/:repoId`                 | Update repo config             |
| DELETE | `/v1/admin/git/repos/:repoId`                 | Delete repo                    |
| POST   | `/v1/admin/git/repos/:repoId/branches`        | List branches                  |
| POST   | `/v1/admin/git/repos/:repoId/pull-requests`   | List/create PRs                |
| POST   | `/v1/admin/git/repos/:repoId/merge`           | Merge PR/branch                |

#### RAG & Knowledge

| Method | Path                                          | Purpose                        |
|:-------|:----------------------------------------------|:-------------------------------|
| GET    | `/v1/admin/rag/collections`                   | List RAG collections           |
| POST   | `/v1/admin/rag/collections`                   | Create collection              |
| POST   | `/v1/admin/rag/search`                        | Search across collections      |
| POST   | `/v1/admin/rag/ingest`                        | Ingest document into RAG       |
| GET    | `/v1/admin/knowledge-graph`                   | Query knowledge graph          |
| POST   | `/v1/admin/knowledge-graph/nodes`             | Add node to graph              |

#### Autonomous Economy

| Method | Path                                          | Purpose                        |
|:-------|:----------------------------------------------|:-------------------------------|
| GET    | `/v1/admin/treasury/accounts`                 | List treasury accounts         |
| GET    | `/v1/admin/treasury/transactions`             | Transaction ledger             |
| POST   | `/v1/admin/treasury/transfer`                 | Execute transfer               |
| GET    | `/v1/admin/treasury/balance`                  | Aggregate balances             |
| GET    | `/v1/market/listings`                         | Public listing catalog         |
| GET    | `/v1/market/listings/:id`                     | Single listing                 |
| POST   | `/v1/admin/market/listings`                   | Create listing                 |
| POST   | `/v1/admin/market/checkout`                   | Start checkout flow            |
| GET    | `/v1/admin/market/orders`                     | List orders                    |
| GET    | `/v1/admin/agents/archetypes`                 | List 15 agent archetypes       |
| GET    | `/v1/admin/agents/profiles`                   | List agent profiles            |
| POST   | `/v1/admin/agents/profiles`                   | Create profile                 |
| POST   | `/v1/admin/agents/spawn`                      | One-shot agent provisioning    |
| GET    | `/v1/admin/business-spaces`                   | List agent business spaces     |
| POST   | `/v1/admin/business-spaces`                   | Register business subdomain    |
| GET    | `/v1/admin/crews`                             | List agent crews               |
| POST   | `/v1/admin/crews`                             | Create crew                    |
| POST   | `/v1/admin/oversight/scan`                    | Trigger anomaly scan           |
| GET    | `/v1/admin/oversight/dashboard`               | Economy-wide metrics           |
| POST   | `/v1/admin/oversight/commands`                | Issue command to agent(s)      |
| GET    | `/v1/admin/oversight/anomalies`               | List detected anomalies        |
| POST   | `/v1/admin/messages`                          | Send inter-agent message       |

### 2.7 OpenAI-Compatible API

Sven exposes an OpenAI-compatible chat completions endpoint:

```
POST /v1/chat/completions
Content-Type: application/json
Cookie: sven_session=...

{
  "model": "sven",
  "messages": [{ "role": "user", "content": "Hello" }],
  "stream": true
}
```

When `stream: true`, response is SSE (`text/event-stream`) with OpenAI-format
delta chunks. Keepalive: every 15 seconds. Timeout: configurable upstream.

---

## 3. Real-Time Events

### 3.1 Transport: NATS JetStream

Sven does **not** expose a general-purpose WebSocket. All real-time inter-service
events flow over **NATS JetStream**. Client-facing real-time uses **SSE** (see §2).

**NATS connection details**:

| Context              | URL                              |
|:---------------------|:---------------------------------|
| LAN (WireGuard)      | `nats://10.47.47.8:4222`        |
| Docker Compose       | `nats://nats:4222`              |
| PM2 local dev        | `nats://127.0.0.1:59530`        |
| Monitoring (HTTP)    | `http://10.47.47.8:8222`        |

JetStream is enabled with persistent storage at `/data`.

### 3.2 NATS Subject Map (33+ subjects)

The sidecar can subscribe to any of these subjects for real-time updates:

#### Agent Lifecycle
| Subject                          | Payload shape                                        |
|:---------------------------------|:-----------------------------------------------------|
| `sven.agent.spawned`             | `{automatonId, agentId, archetype, displayName, parentId}` |
| `sven.agent.retired`             | `{automatonId, agentId, archetype, reason}`          |
| `sven.agent.profile_updated`     | `{agentId, fields: string[]}`                        |
| `sven.agent.anomaly_detected`    | `{anomalyId, type, severity, targetAgentId}`         |
| `sven.agent.report_generated`    | `{reportId, agentId, period}`                        |
| `sven.agent.message_sent`        | `{from, to, crew_id, subject, type, priority}`       |

#### Business & Crews
| Subject                               | Payload shape                                   |
|:--------------------------------------|:------------------------------------------------|
| `sven.agent.business_created`         | `{agentId, subdomain, businessUrl}`             |
| `sven.agent.business_activated`       | `{agentId, subdomain}`                          |
| `sven.agent.business_deactivated`     | `{agentId, subdomain}`                          |
| `sven.crew.created`                   | `{crewId, name, crewType, leadAgentId}`         |
| `sven.crew.member_added`              | `{crewId, agentId, role}`                       |

#### Economy
| Subject                          | Payload shape                                        |
|:---------------------------------|:-----------------------------------------------------|
| `sven.treasury.credited`         | `{accountId, amount, currency, source}`              |
| `sven.treasury.debited`          | `{accountId, amount, currency, reason}`              |
| `sven.market.listed`             | `{listingId, kind, price, sellerAgentId}`            |
| `sven.market.purchased`          | `{orderId, listingId, buyerId, amount}`              |
| `sven.market.fulfilled`          | `{orderId, deliveryType}`                            |
| `sven.market.refunded`           | `{orderId, amount, reason}`                          |
| `sven.market.task_created`       | `{taskId, orderId, agentId, taskType}`               |
| `sven.market.task_completed`     | `{taskId, orderId, status}`                          |

#### Oversight
| Subject                              | Payload shape                                    |
|:-------------------------------------|:-------------------------------------------------|
| `sven.oversight.command_issued`      | `{targetAgentId, commandType, reason}`           |

#### Eidolon City
| Subject                          | Payload shape                                        |
|:---------------------------------|:-----------------------------------------------------|
| `sven.eidolon.snapshot`          | `{buildings[], citizens[], parcels[]}`               |
| `sven.eidolon.building_updated`  | `{buildingId, kind, metrics}`                        |

### 3.3 SSE Endpoints (Client-Facing)

For the IDE, these SSE endpoints are most relevant:

| SSE Endpoint                        | Purpose                                |
|:------------------------------------|:---------------------------------------|
| `GET /v1/entity/stream`            | Entity state (avatar, thinking, etc.)  |
| `GET /v1/canvas/chats/:id/stream`  | Chat messages real-time                |
| `GET /v1/streams/:id/subscribe`    | Generic resumable stream               |
| `GET /v1/devices/events/stream`    | IoT device events                      |

**SSE format**: Standard `text/event-stream; charset=utf-8` with `\n\n`-delimited
events. Some streams include keepalive comments (`: ping\n\n`).

### 3.4 Reconnection Protocol

Use the Stream Resume API (§2.5) for robust reconnection:
1. `POST /v1/streams` → get `stream_id`
2. Subscribe via `GET /v1/streams/:id/subscribe`
3. Track `seq` number from each event
4. On disconnect, replay: `GET /v1/streams/:id/events?after=<last_seq>`
5. Re-subscribe

TTL: 120 seconds (events expire after this). Max buffered: 500 events.

---

## 4. Forgejo Git Integration

### 4.1 Overview

Sven supports three git providers: `local`, `forgejo`, `github`.
For Sven Studio, **Forgejo** is the primary provider (self-hosted).

### 4.2 Repository Registration

```
POST /v1/admin/git/repos
Content-Type: application/json
Cookie: sven_session=...

{
  "provider": "forgejo",
  "repoName": "my-project",
  "repoOwner": "sven",
  "repoUrl": "https://git.sven.systems/sven/my-project.git",
  "baseUrl": "https://git.sven.systems",
  "tokenRef": "env:FORGEJO_API_TOKEN",
  "sshKeyRef": "env:FORGEJO_SSH_KEY",
  "defaultBranch": "main"
}
```

**Required fields** (Forgejo):
- `provider`: `"forgejo"`
- `repoName`: repository name
- `repoOwner`: Forgejo org/user name
- `repoUrl`: full git URL (must be `http(s)://`)
- `baseUrl`: Forgejo instance URL (required for Forgejo; auto-inferred as fallback)
- `tokenRef`: secret reference for Forgejo API token (format: `env:VAR_NAME`)

**Optional**:
- `sshKeyRef`: secret reference for SSH key
- `defaultBranch`: defaults to `main`

### 4.3 Secret References

Token and SSH key references use a `secretRef` format that resolves to the actual
value at runtime:

- `env:FORGEJO_API_TOKEN` — reads from environment variable
- `file:/path/to/token` — reads from file
- `vault:secret/path` — reads from vault (if configured)

### 4.4 Git Operations

| Method | Path                                                 | Purpose              |
|:-------|:-----------------------------------------------------|:---------------------|
| GET    | `/v1/admin/git/repos`                                | List repos           |
| POST   | `/v1/admin/git/repos`                                | Add repo             |
| GET    | `/v1/admin/git/repos/:id`                            | Get repo             |
| PUT    | `/v1/admin/git/repos/:id`                            | Update repo          |
| DELETE | `/v1/admin/git/repos/:id`                            | Delete repo          |
| POST   | `/v1/admin/git/repos/:id/branches`                   | List branches        |
| POST   | `/v1/admin/git/repos/:id/pull-requests`              | Manage PRs           |
| POST   | `/v1/admin/git/repos/:id/merge`                      | Merge operations     |

**Merge strategies**: `merge`, `squash`, `rebase`.

### 4.5 Database Schema

```sql
CREATE TABLE git_repos (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  organization_id  TEXT,          -- org-scoped if column exists
  provider         TEXT NOT NULL,  -- CHECK: 'local' | 'forgejo' | 'github'
  repo_name        TEXT NOT NULL,
  repo_owner       TEXT,
  repo_url         TEXT NOT NULL,
  default_branch   TEXT DEFAULT 'main',
  ssh_key_ref      TEXT,
  token_ref        TEXT,
  enabled          BOOLEAN DEFAULT true,
  metadata         JSONB DEFAULT '{}',
  last_synced_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. Runner & Sandbox

### 5.1 Agent Runtime

The agent-runtime service executes AI agent tasks. For the IDE, the relevant
capability is **native shell execution** — the runtime can execute shell commands
on the host system when enabled.

**Environment flags**:
| Env Var                                  | Default | Purpose                        |
|:-----------------------------------------|:--------|:-------------------------------|
| `SVEN_INTEGRATION_RUNTIME_EXEC_ENABLED`  | `false` | Enable shell command execution |
| `SVEN_AGENT_DEFAULT_MODEL`               | `gpt-4o`| Default LLM model             |
| `SVEN_AGENT_CODING_MODEL`                | `coding` | Model for coding tasks        |
| `SVEN_AGENT_FAST_MODEL`                  | `coding-fast` | Fast model for quick tasks |

### 5.2 Execution Model

When `SVEN_INTEGRATION_RUNTIME_EXEC_ENABLED=true`, the agent-runtime supports:

- **Shell execution**: Run arbitrary commands in a sandboxed environment
- **Deploy commands**: Template-based deployment (`deploy`, `stop`, `status`)
- **Skill execution**: Run registered skills from `skills/` directory

### 5.3 Skill System

Skills are self-contained capabilities in `skills/` directory, each with:
- `SKILL.md` — YAML frontmatter manifest (name, inputs, outputs)
- `handler.ts` — execution logic

**Key economy skills**:
| Skill                          | Actions                                              |
|:-------------------------------|:-----------------------------------------------------|
| `autonomous-economy/treasury`  | `balance`, `transfer`, `history`                     |
| `autonomous-economy/market`    | `publish`, `sales`, `list`                           |
| `autonomous-economy/book-translate` | `translate`, `detect-language`, `preview`        |
| `autonomous-economy/book-write`| `outline`, `write-chapter`, `write-blurb`, `generate-title` |

### 5.4 Model Router

The model router on VM5 (`10.47.47.9:8080`) handles LLM inference routing:

| Alias          | Primary Model               | Fallback Chain                           |
|:---------------|:----------------------------|:-----------------------------------------|
| `coding`       | `copilot-claude-opus-4`     | `gemini-2.5-pro` → `gpt-4.1`            |
| `coding-fast`  | `copilot-o3-mini`           | `gemini-2.5-flash` → `gpt-4o-mini`      |
| `reasoning`    | `copilot-o3-mini`           | `gemini-2.5-pro`                         |

**Local models** (on-premise):
| Model                | VM        | Endpoint                        | GPU               |
|:---------------------|:----------|:--------------------------------|:-------------------|
| Qwen 2.5 Coder 32B  | VM5       | `http://10.47.47.9:8080/v1`    | RX 9070XT + 6750XT |
| Qwen 2.5 7B         | VM13      | `http://10.47.47.13:11434`     | RTX 3060           |
| DeepSeek R1 7B       | VM13      | `http://10.47.47.13:11434`     | RTX 3060           |
| Llama 3.2 3B         | VM13      | `http://10.47.47.13:11434`     | RTX 3060           |
| Nomic Embed Text     | VM13      | `http://10.47.47.13:11434`     | RTX 3060           |

LiteLLM proxy: `http://10.47.47.9:4000` (routes to cloud or local models).

---

## 6. Deployment Tracking

### 6.1 Deployment Modes

Sven supports two deployment modes stored in `settings_global`:

| Mode          | Description                                                 |
|:--------------|:------------------------------------------------------------|
| `personal`    | Single-user, no org isolation. Ideal for dev/personal use.  |
| `multi_user`  | Multi-user with organization scoping. Production default.   |

### 6.2 Endpoints

| Method | Path                              | Auth   | Purpose                           |
|:-------|:----------------------------------|:-------|:----------------------------------|
| GET    | `/v1/config/deployment`           | None   | Get current mode + setup status   |
| PUT    | `/v1/admin/deployment`            | Admin  | Change deployment mode            |
| POST   | `/v1/config/deployment/setup`     | None   | Initial setup (create admin + set mode) |

### 6.3 GET /v1/config/deployment

```json
{
  "success": true,
  "data": {
    "mode": "multi_user",
    "setup_complete": true,
    "user_count": 3
  }
}
```

The IDE sidecar should call this at startup to determine which auth flow to show.

### 6.4 POST /v1/config/deployment/setup

Used for first-time setup. Creates the admin user and sets deployment mode
atomically (PostgreSQL advisory lock `47010002`):

```json
{
  "username": "admin",
  "password": "...",
  "display_name": "Administrator",
  "mode": "personal"
}
```

This endpoint is idempotent — it fails gracefully if setup is already complete.

---

## 7. Knowledge Base & RAG

### 7.1 Architecture

Sven's RAG (Retrieval-Augmented Generation) pipeline:

```
Documents → Ingestors → OpenSearch → Embeddings (Ollama) → RAG Indexer → Agent Query
```

### 7.2 Services

| Service          | Host           | Port  | Purpose                          |
|:-----------------|:---------------|:------|:---------------------------------|
| OpenSearch       | VM6            | 9200  | Vector store + full-text search  |
| RAG Indexer      | VM4            | —     | Index management                 |
| RAG NAS Ingestor | VM4            | —     | File system document ingestion   |
| RAG Git Ingestor | VM4            | —     | Git repo content ingestion       |
| RAG Notes Ingestor| VM4           | —     | Note/wiki content ingestion      |
| Ollama (embeddings)| VM13         | 11434 | Embedding generation (nomic-embed-text, fp16, dim=768) |

**OpenSearch access** (LAN):
```
http://10.47.47.10:9200
```

Single-node mode, `JAVA_OPTS: -Xms512m -Xmx512m`.

### 7.3 RAG Admin API

| Method | Path                              | Auth   | Purpose                         |
|:-------|:----------------------------------|:-------|:--------------------------------|
| GET    | `/v1/admin/rag/collections`       | Admin  | List RAG collections            |
| POST   | `/v1/admin/rag/collections`       | Admin  | Create collection               |
| POST   | `/v1/admin/rag/search`            | Admin  | Semantic search across collections |
| POST   | `/v1/admin/rag/ingest`            | Admin  | Ingest document/URL             |
| DELETE | `/v1/admin/rag/collections/:id`   | Admin  | Delete collection               |

### 7.4 Knowledge Graph

| Method | Path                                   | Auth  | Purpose                        |
|:-------|:---------------------------------------|:------|:-------------------------------|
| GET    | `/v1/admin/knowledge-graph`            | Admin | Query graph nodes/edges        |
| POST   | `/v1/admin/knowledge-graph/nodes`      | Admin | Add node                       |
| DELETE | `/v1/admin/knowledge-graph/nodes/:id`  | Admin | Remove node                    |

### 7.5 47Dynamics RAG Collections

Pre-provisioned collections for 47Dynamics integration:
`device_docs`, `patch_catalog`, `kb_articles`, `security_advisories`,
`runbooks`, `ticket_history`, `monitoring_data`.

### 7.6 Search (SearXNG)

SearXNG runs on VM6 for web search augmentation. The admin search endpoint
proxies queries through it:

```
POST /v1/admin/search
{ "query": "...", "engines": ["google", "duckduckgo"] }
```

---

## 8. LAN Network Topology

### 8.1 WireGuard Mesh

**Subnet**: `10.47.47.0/24`  
**Trusted proxy range**: `10.47.47.0/24`, `127.0.0.1`

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   VM1       │     │    VM4       │     │    VM5       │
│ Edge Proxy  │     │ sven-platform│     │  sven-ai     │
│ 10.47.47.5  │────▶│ 10.47.47.8   │────▶│ 10.47.47.9   │
│ TLS term.   │     │ gateway:3000 │     │ llama:8080   │
└─────────────┘     │ PG:5432      │     │ LiteLLM:4000 │
                    │ NATS:4222    │     └──────────────┘
                    │ nginx:8088   │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │    VM6       │ │    VM7       │ │   VM13       │
     │  sven-data   │ │ sven-adapters│ │  kaldorei    │
     │ 10.47.47.10  │ │ 10.47.47.11  │ │ 10.47.47.13  │
     │ OpenSearch   │ │ 21 adapters  │ │ Ollama:11434 │
     │ Prometheus   │ │ Cloudflared  │ │ RTX 3060     │
     │ Grafana      │ └──────────────┘ └──────────────┘
     │ OTEL, Loki   │
     └──────────────┘
```

### 8.2 VM Service Map

| VM   | WireGuard IP   | Hostname         | Key Services                                        |
|:-----|:---------------|:-----------------|:----------------------------------------------------|
| VM1  | `10.47.47.5`   | —                | Edge proxy, TLS termination (port 44747)             |
| VM4  | `10.47.47.8`   | `sven-platform`  | gateway-api:3000, admin-ui:3100, canvas-ui:3200, PG:5432, NATS:4222, nginx:8088 |
| VM5  | `10.47.47.9`   | `sven-ai`        | llama-server:8080, LiteLLM:4000, voice services     |
| VM6  | `10.47.47.10`  | `sven-data`      | OpenSearch:9200, Prometheus:9090, Grafana:9091, OTEL:4317/4318, Loki |
| VM7  | `10.47.47.11`  | `sven-adapters`  | 21 channel adapters, Cloudflared                     |
| VM12 | `10.47.47.12`  | —                | Rocket.Chat (talk.sven.systems)                      |
| VM13 | `10.47.47.13`  | `kaldorei`       | Ollama:11434 (RTX 3060 — fallback inference)         |
| VM14 | `10.47.47.14`  | `daedalus`       | 47Network website                                    |

### 8.3 Physical LAN

| Asset              | IP                  | Notes                       |
|:-------------------|:--------------------|:----------------------------|
| LAN gateway/DNS    | `192.168.10.1`      | Domain: `ursu.cloud`        |
| Dev machine        | `192.168.10.79`     | Gateway API on `:3000`      |
| Proxmox node       | `192.168.10.74`     | SSH user: `root`            |
| Docker host ingress| `192.168.7.59:8088` | sven-internal-nginx         |

### 8.4 Public Domains

| Domain                       | Purpose                                    |
|:-----------------------------|:-------------------------------------------|
| `sven.systems`               | Landing page, installers                   |
| `app.sven.systems`           | Runtime: canvas, admin, API                |
| `market.sven.systems`        | Marketplace storefront                     |
| `eidolon.sven.systems`       | 3D agent city visualization                |
| `studio.sven.systems`        | Sven Studio IDE (this integration)         |
| `*.from.sven.systems`        | Agent business spaces (wildcard)           |
| `talk.sven.systems`          | Rocket.Chat                                |
| `the47network.com`           | 47Network website                          |

**TLS**: All HTTPS on port **44747** (non-standard). ACME challenge port: **9147**.

### 8.5 Docker Networks

| Network         | Services                                                    |
|:----------------|:------------------------------------------------------------|
| `sven-core`     | postgres, nats, gateway-api, ollama, litellm, agent-runtime |
| `sven-tools`    | egress-proxy, nats, searxng, internal-nginx                 |
| `sven-rag`      | opensearch, rag-indexer, rag-*-ingestor                     |
| `sven-monitoring`| otel-collector, prometheus, grafana, loki, promtail         |

### 8.6 Service Discovery

- **mDNS**: `_sven._tcp.local` for peer-to-peer NATS federation
- **WireGuard**: Static IP assignments, no dynamic discovery needed on mesh
- **Docker DNS**: Service names resolve within Docker networks (e.g., `nats:4222`)

---

## 9. Database & Shared State

### 9.1 PostgreSQL

| Property         | Value                                                  |
|:-----------------|:-------------------------------------------------------|
| **Host (LAN)**   | `10.47.47.8:5432`                                      |
| **Host (Docker)**| `postgres:5432`                                        |
| **Host (PM2 dev)** | `127.0.0.1:5432`                                     |
| **Database**     | `sven`                                                 |
| **User (dev)**   | `sven` / `sven-dev-47`                                 |
| **Extensions**   | `pgvector` (vector similarity search)                  |
| **Image**        | `pgvector/pgvector`                                    |
| **WAL archiving**| Enabled (`pgwalarchive` volume)                        |

> **IMPORTANT**: The IDE sidecar must **NOT** connect directly to PostgreSQL.
> All data access is API-mediated via the gateway-api endpoints. Direct DB
> connections are reserved for migrations and internal services only.

### 9.2 NATS JetStream

| Property         | Value                                              |
|:-----------------|:---------------------------------------------------|
| **Host (LAN)**   | `10.47.47.8:4222`                                  |
| **Host (Docker)**| `nats:4222`                                        |
| **Monitor**      | `http://10.47.47.8:8222`                           |
| **JetStream**    | Enabled, store: `/data` (persistent)               |
| **Volume**       | `natsdata`                                         |

The sidecar **may** connect to NATS directly for event subscriptions if operating
within the WireGuard mesh. Use `nats://10.47.47.8:4222`. No authentication is
required for connections from the trusted `10.47.47.0/24` range.

### 9.3 No Redis

Sven does **not** use Redis. All caching is in-memory (Node.js process) and
messaging is handled by NATS. Do not attempt to connect to Redis.

### 9.4 Key Tables (for reference, not direct access)

| Table                      | Purpose                                          |
|:---------------------------|:-------------------------------------------------|
| `users`                    | User accounts                                    |
| `sessions`                 | Active sessions (maps session token → user)      |
| `device_codes`             | Device flow authorization codes                  |
| `organizations`            | Multi-org support                                |
| `chats`                    | Chat threads                                     |
| `messages`                 | Chat messages                                    |
| `agents`                   | AI agent configurations                          |
| `settings_global`          | Platform settings (KV)                           |
| `git_repos`                | Git repository registrations                     |
| `agent_profiles`           | Agent archetype profiles (15 types)              |
| `treasury_accounts`        | Treasury ledger accounts                         |
| `treasury_transactions`    | Financial transaction log                        |
| `marketplace_listings`     | Products/services for sale                       |
| `marketplace_orders`       | Purchase orders                                  |
| `marketplace_tasks`        | Agent task queue                                 |
| `agent_crews`              | Team/crew definitions                            |
| `agent_crew_members`       | Crew membership                                  |
| `agent_messages`           | Inter-agent messaging                            |
| `agent_performance_reports`| Periodic agent metrics                           |
| `agent_anomalies`          | Flagged financial anomalies                      |
| `token_ledger`             | 47Token balance tracking                         |
| `agent_land_parcels`       | Eidolon city land ownership                      |
| `eidolon_buildings`        | 3D city building registry                        |

### 9.5 Observability Stack

| Service          | LAN Endpoint                    | Purpose               |
|:-----------------|:--------------------------------|:----------------------|
| Prometheus       | `http://10.47.47.10:9090`       | Metrics TSDB          |
| Grafana          | `http://10.47.47.10:9091`       | Dashboards            |
| OTEL Collector   | `http://10.47.47.10:4317` (gRPC)| Trace collection      |
|                  | `http://10.47.47.10:4318` (HTTP)| Trace collection      |
| Loki             | VM6                             | Log aggregation       |

The IDE can export OTEL traces to `http://10.47.47.10:4317` for debugging
visibility in Grafana.

---

## 10. Error Codes & Rate Limits

### 10.1 Error Response Format

All API errors follow this envelope:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description"
  }
}
```

HTTP status codes are standard (400, 401, 403, 404, 409, 429, 500, 502, 503).

### 10.2 Common Error Codes

| Code                     | HTTP | Meaning                                      |
|:-------------------------|:-----|:---------------------------------------------|
| `VALIDATION`             | 400  | Request body/params failed validation        |
| `UNAUTHORIZED`           | 401  | Missing or invalid session                   |
| `INVALID_CREDENTIALS`    | 401  | Wrong username/password                      |
| `ACCOUNT_LOCKED`         | 403  | Brute-force lockout active                   |
| `FORBIDDEN`              | 403  | Insufficient permissions                     |
| `ORG_REQUIRED`           | 403  | Active account/org context missing           |
| `NOT_FOUND`              | 404  | Resource not found                           |
| `DISABLED`               | 404  | Resource exists but is disabled              |
| `CONFLICT`               | 409  | Duplicate resource                           |
| `RATE_LIMITED`            | 429  | Rate limit exceeded                          |
| `AUTHORIZATION_PENDING`  | 200  | Device flow: user hasn't approved yet        |
| `EXPIRED_TOKEN`          | 200  | Device flow: code expired                    |
| `TOTP_REQUIRED`          | 200  | 2FA code needed                              |
| `INTERNAL`               | 500  | Unhandled server error                       |
| `UPSTREAM`               | 502  | Upstream service failure                     |

### 10.3 Rate Limits

#### Nginx Layer (edge proxy)

| Zone                    | Rate       | Burst | Notes                     |
|:------------------------|:-----------|:------|:--------------------------|
| `sven_global_per_ip`    | 30 req/s   | 120   | All endpoints              |
| `sven_auth_per_ip`      | 10 req/m   | —     | Auth endpoints only        |
| `sven_conn_per_ip`      | 30 conns   | —     | Concurrent connections     |

#### Application Layer (gateway-api)

| Scope          | Default           | Env Var                          |
|:---------------|:------------------|:---------------------------------|
| Per-user API   | 300 req / 60s     | `API_USER_RATE_LIMIT_MAX` / `API_USER_RATE_LIMIT_WINDOW_SEC` |
| Login          | 10 / min          | —                                |
| Bootstrap      | 3 / min           | —                                |
| TOTP           | 5 / session       | —                                |
| Device start   | 20 / 60s          | `AUTH_DEVICE_START_RATE_MAX`     |
| Device confirm | 60 / 60s          | `AUTH_DEVICE_CONFIRM_RATE_MAX`   |
| Device token   | 240 / 60s         | `AUTH_DEVICE_TOKEN_RATE_MAX`     |

#### 47Dynamics Bridge

| Scope          | Limit                            |
|:---------------|:---------------------------------|
| Per-tenant     | 120 req / 60s                    |

### 10.4 Retry Strategy Recommendations

For the Go sidecar:
- **429 responses**: Honor `Retry-After` header. Default backoff: 1 second.
- **5xx responses**: Exponential backoff starting at 500ms, max 30s, max 3 retries.
- **Network errors**: Retry with jitter, max 5 attempts.
- **SSE disconnects**: Reconnect immediately with stream resume (§3.4).

### 10.5 Security Headers (from Nginx)

All responses through the edge proxy include:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-site
```

### 10.6 CORS

Allowed origins use domain-suffix matching:
- `*.sven.systems` — all Sven subdomains
- `*.the47network.com` — all 47Network subdomains
- `*.from.sven.systems` — all agent business subdomains

The sidecar operating on LAN (`http://localhost:*`) should be allowed automatically
in development mode (`NODE_ENV !== 'production'`).

---

## Appendix A: Quick-Start Checklist for Go Sidecar

1. **Check deployment state**: `GET /v1/config/deployment` — determine if setup is needed
2. **Authenticate via Device Flow**:
   - `POST /v1/auth/device/start` with `client_name: "sven-studio"`
   - Display `user_code`, open `verification_uri_complete` in browser
   - Poll `POST /v1/auth/device/token` every 5 seconds
   - Store session cookie for subsequent requests
3. **Verify session**: `GET /v1/auth/me` — confirm user/org context
4. **Check health**: `GET /readyz` — ensure platform is operational
5. **Subscribe to events**: Connect to `nats://10.47.47.8:4222` for real-time updates
6. **List git repos**: `GET /v1/admin/git/repos` — show available repositories
7. **Open chat**: `POST /v1/canvas/chats` → `POST /v1/canvas/chats/:id/messages`
8. **Export traces**: Send OTEL spans to `http://10.47.47.10:4317` for observability

## Appendix B: Environment Variables Reference

| Variable                              | Default           | Purpose                         |
|:--------------------------------------|:------------------|:--------------------------------|
| `NODE_ENV`                            | `development`     | Environment mode                |
| `PUBLIC_BASE_URL`                     | —                 | Base URL for links/redirects    |
| `AUTH_DEVICE_VERIFY_URL`              | —                 | Device flow verification base URL |
| `AUTH_MAX_FAILED`                     | `5`               | Max login attempts before lockout |
| `AUTH_LOCKOUT_MS`                     | `900000`          | Lockout duration (15 min)       |
| `API_USER_RATE_LIMIT_MAX`            | `300`             | Per-user rate limit             |
| `API_USER_RATE_LIMIT_WINDOW_SEC`     | `60`              | Rate limit window               |
| `HEALTH_CACHE_TTL_MS`                | `1000`            | Health check cache TTL          |
| `SVEN_AGENT_DEFAULT_MODEL`           | `gpt-4o`          | Default AI model                |
| `SVEN_AGENT_CODING_MODEL`            | `coding`          | Coding model alias              |
| `SVEN_AGENT_FAST_MODEL`              | `coding-fast`     | Fast model alias                |
| `SVEN_INTEGRATION_RUNTIME_EXEC_ENABLED` | `false`       | Enable shell execution          |
| `ECONOMY_API_TOKEN`                  | —                 | Economy API auth token          |
| `ECONOMY_ADMIN_TOKEN`                | —                 | Economy admin token (fallback)  |
| `STREAM_RESUME_TTL_MS`               | `120000`          | Stream event TTL                |
| `STREAM_RESUME_MAX_EVENTS`           | `500`             | Max buffered events per stream  |

## Appendix C: Port Registry (Sidecar-Relevant)

| Port  | Service             | Bind Address  | LAN URL                       |
|:------|:--------------------|:--------------|:------------------------------|
| 3000  | gateway-api         | `127.0.0.1`   | `http://10.47.47.8:3000`     |
| 3100  | admin-ui            | `127.0.0.1`   | `http://10.47.47.8:3100`     |
| 3200  | canvas-ui           | `127.0.0.1`   | `http://10.47.47.8:3200`     |
| 4222  | NATS (client)       | `127.0.0.1`   | `nats://10.47.47.8:4222`    |
| 5432  | PostgreSQL          | `127.0.0.1`   | `10.47.47.8:5432` (internal) |
| 8080  | llama-server        | `0.0.0.0`     | `http://10.47.47.9:8080`    |
| 8088  | sven-internal-nginx | `0.0.0.0`     | `http://192.168.7.59:8088`  |
| 8222  | NATS (monitor)      | `127.0.0.1`   | `http://10.47.47.8:8222`    |
| 9090  | Prometheus          | `0.0.0.0`     | `http://10.47.47.10:9090`   |
| 9091  | Grafana             | `0.0.0.0`     | `http://10.47.47.10:9091`   |
| 9200  | OpenSearch          | `127.0.0.1`   | `http://10.47.47.10:9200`   |
| 9477  | treasury-service    | `0.0.0.0`     | `http://10.47.47.8:9477`    |
| 9478  | marketplace-service | `0.0.0.0`     | `http://10.47.47.8:9478`    |
| 9479  | eidolon-service     | `0.0.0.0`     | `http://10.47.47.8:9479`    |
| 11434 | Ollama              | `0.0.0.0`     | `http://10.47.47.13:11434`  |
| 44747 | Edge HTTPS          | `0.0.0.0`     | `https://app.sven.systems:44747` |
