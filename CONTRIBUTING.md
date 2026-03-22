# Contributing to Sven

Thank you for taking the time to contribute! Sven is a large monorepo — this guide covers everything from first-time setup to submitting production-quality PRs.

**Quick links**
- [Reporting a bug](https://github.com/47network/thesven/issues/new?template=bug_report.yml)
- [Requesting a feature](https://github.com/47network/thesven/issues/new?template=feature_request.yml)
- [Security vulnerabilities](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Getting the Code](#getting-the-code)
3. [Local Dev — Docker (recommended)](#local-dev--docker-recommended)
4. [Local Dev — Bare Metal](#local-dev--bare-metal)
5. [Project Layout](#project-layout)
6. [Working on Specific Areas](#working-on-specific-areas)
7. [Coding Conventions](#coding-conventions)
8. [Testing](#testing)
9. [Commit Messages](#commit-messages)
10. [Opening a PR](#opening-a-pr)
11. [Good First Issues](#good-first-issues)

---

## Prerequisites

| Tool | Version | Required for |
|:-----|:-------:|:-------------|
| Node.js | 20+ | Gateway, Admin UI, Canvas UI, all services |
| npm | 10+ | Workspace management (npm workspaces) |
| Docker + Compose | 25+ | Full stack (strongly recommended for dev) |
| PostgreSQL | 15+ | Local dev DB (skip if using Docker) |
| NATS | 2.10+ | Local broker (skip if using Docker) |
| Flutter SDK | 3.27+ | `apps/companion-user-flutter` only |
| Rust + Cargo | 1.76+ | `apps/companion-desktop-tauri` only |
| Python | 3.11+ | Optional — some dev scripts |

---

## Getting the Code

```bash
git clone https://github.com/47network/thesven.git
cd thesven
```

Create a feature branch immediately — never commit directly to `master`:

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/issue-123-short-description
```

---

## Local Dev — Docker (recommended)

The fastest way to get a full working environment:

```bash
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET and one LLM provider key

docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
npm install
npm run db:migrate
```

| Surface | URL |
|:--------|:----|
| Admin UI | http://localhost:3000 |
| Canvas Chat | http://localhost:3001 |
| Gateway API | http://localhost:4000 |

All services rebuild automatically on file changes in dev mode.

---

## Local Dev — Bare Metal

If you prefer running services directly (useful when iterating on a single service):

### 1. Install dependencies

```bash
npm install
```

### 2. Start infrastructure

```bash
# PostgreSQL + NATS + OpenSearch via Docker
docker compose up -d postgres nats opensearch
```

### 3. Run database migrations

```bash
npm run db:migrate
```

### 4. Start individual services

```bash
# Gateway API (port 4000)
npm --workspace services/gateway-api run dev

# Admin UI (port 3000)
npm --workspace apps/admin-ui run dev

# Canvas UI (port 3001)
npm --workspace apps/canvas-ui run dev

# Agent Runtime
npm --workspace services/agent-runtime run dev
```

### Environment variables

All services read from environment. Copy `.env.example` and fill in the required values. See [Configuration in README](README.md#%EF%B8%8F-configuration) for a full variable reference.

---

## Project Layout

```
thesven/
├── apps/
│   ├── admin-ui/                  # React admin dashboard
│   ├── canvas-ui/                 # Real-time chat (KaTeX, tool traces)
│   ├── companion-user-flutter/    # iOS + Android Flutter app
│   └── companion-desktop-tauri/   # macOS / Windows / Linux (Tauri/Rust)
├── services/
│   ├── gateway-api/               # Central API — start here for backend work
│   ├── agent-runtime/             # LLM + tool orchestration
│   ├── skill-runner/              # Sandboxed executor (gVisor)
│   ├── workflow-executor/         # Cron + scheduler
│   ├── notification-service/      # Push, email, in-app
│   ├── rag-*/                     # RAG indexer + ingestors
│   ├── litellm/                   # LLM proxy
│   ├── searxng/                   # Private search
│   ├── egress-proxy/              # Outbound allowlist
│   ├── faster-whisper/            # STT
│   ├── piper/                     # TTS
│   ├── wake-word/                 # Wake word engine
│   ├── sso/                       # Keycloak
│   └── adapter-*/                 # 20 messaging adapters
├── packages/                      # Shared TS packages
├── skills/                        # Built-in skills
├── tests/                         # E2E + load tests
├── deploy/                        # Kubernetes, Helm, Docker Compose
├── config/                        # Service config
├── docs/                          # Documentation
└── scripts/                       # Dev and ops scripts
```

---

## Working on Specific Areas

### Backend services (TypeScript/Node)
Services live in `services/`. Each has its own `package.json`. Run `npm --workspace services/<name> run dev` to start with hot-reload. Check `services/<name>/README.md` for service-specific notes.

### Admin UI / Canvas UI
`apps/admin-ui` and `apps/canvas-ui` are React + TypeScript apps. They expect the Gateway API running on port 4000.

### Flutter mobile app
```bash
cd apps/companion-user-flutter
flutter pub get
flutter run
```
See `apps/companion-user-flutter/CONTRIBUTING.md` for signing, flavours, and device testing procedures.

### Tauri desktop app
```bash
cd apps/companion-desktop-tauri
npm install
npm run tauri dev
```
Requires Rust 1.76+ and the platform-specific Tauri prerequisites.

### Messaging adapters
Adapters live in `services/adapter-<name>/`. Each is an independent service implementing the Sven adapter protocol. Copy an existing simple adapter (e.g. `adapter-discord`) as a starting template.

### Skills
Skills live in `skills/`. Follow the `SKILL.md` authoring standard. New skills go through the quarantine pipeline and require an admin approval before activation.

---

## Coding Conventions

- **TypeScript strict mode** — no `any`, no implicit `any`
- **Prettier + ESLint** — run `npm run format` and `npm run lint` before committing
- Keep API shapes backward-compatible; bump contract version if breaking
- Add tests for all new service behaviour and endpoints
- Every new environment variable must be documented in `.env.example`
- Do not commit `.env`, secrets, credentials, or personal data

---

## Testing

```bash
# Lint + type-check
npm run lint
npm run format:check

# Unit tests (per service)
npm --workspace services/gateway-api test
npm --workspace services/agent-runtime test

# E2E tests (requires full stack running)
npm run test:e2e

# Flutter tests
cd apps/companion-user-flutter && flutter test

# Maestro mobile smoke tests (requires connected device)
maestro test apps/companion-user-flutter/.maestro/flows/android-smoke.yaml
```

All CI checks must pass before a PR can be merged.

---

## Commit Messages

[Conventional Commits](https://www.conventionalcommits.org/) are enforced via `commitlint`. Allowed types:

| Type | When to use |
|:-----|:------------|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change with no functional change |
| `test` | Adding or updating tests |
| `chore` | Tooling, CI, dependency updates |
| `perf` | Performance improvement |
| `ci` | CI/CD workflow changes |

Examples:
```
feat(adapter-discord): add thread reply support
fix(agent-runtime): prevent infinite retry loop on context exhaustion
docs(contributing): add Tauri setup instructions
chore(deps): bump faster-whisper to 1.1.0
```

Keep the subject line under 72 characters. Reference issues with `Closes #123` in the body.

---

## Opening a PR

1. Push your branch and open a PR against `master`
2. Fill in the [PR template](.github/pull_request_template.md) completely
3. Ensure all CI checks pass (build, lint, test, security baseline)
4. Add a `CHANGELOG.md` entry under `[Unreleased]` for any user-facing change
5. Request review from the relevant [CODEOWNER](.github/CODEOWNERS)

PRs that touch multiple unrelated areas should be split into separate PRs.

### Review turnaround

Maintainers aim to give initial feedback within **2 business days**. If you haven't heard back after 3 days, feel free to ping the thread.

---

## Good First Issues

Looking for somewhere to start? Check issues labelled [`good first issue`](https://github.com/47network/thesven/issues?q=is%3Aopen+label%3A%22good+first+issue%22) — these are scoped to be approachable for new contributors and have clear acceptance criteria.

Higher-complexity work is labelled [`help wanted`](https://github.com/47network/thesven/issues?q=is%3Aopen+label%3A%22help+wanted%22).

---

*Thank you for making Sven better. 🙌*
