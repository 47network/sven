# services/

All backend microservices in the Sven platform. Each service has its own `README.md` with responsibilities, dependencies, env vars, and run instructions.

## Core Services

| Service | Port | Description |
|---------|------|-------------|
| [`gateway-api`](./gateway-api/README.md) | 3000 | Central HTTP API, auth (JWT/OIDC), WebSocket hub, request routing |
| [`agent-runtime`](./agent-runtime/README.md) | — | LLM orchestration, tool dispatch, self-correction loop |
| [`skill-runner`](./skill-runner/README.md) | — | Sandboxed (gVisor) tool execution engine |
| [`workflow-executor`](./workflow-executor/README.md) | — | Cron scheduler and recurring task manager |
| [`notification-service`](./notification-service/README.md) | — | FCM/APNs push, email, and in-app notifications |
| [`registry-worker`](./registry-worker/README.md) | — | Skill marketplace ingestion and versioning |

## Knowledge & Search

| Service | Port | Description |
|---------|------|-------------|
| [`rag-indexer`](./rag-indexer/README.md) | — | Vector embedding and OpenSearch indexing engine |
| [`rag-git-ingestor`](./rag-git-ingestor/README.md) | — | Git repository ingestion for agent context |
| [`rag-nas-ingestor`](./rag-nas-ingestor/README.md) | — | NAS/filesystem ingestion with watch mode |
| [`rag-notes-ingestor`](./rag-notes-ingestor/README.md) | — | Apple Notes, Obsidian, Bear, and Notion ingestion |

## Voice Stack

| Service | Port | Description |
|---------|------|-------------|
| [`faster-whisper`](./faster-whisper/README.md) | 8100 | Local STT (CTranslate2 Whisper) — no audio leaves infrastructure |
| [`piper`](./piper/README.md) | 8200 | Local TTS (Piper) — no text leaves infrastructure |
| [`wake-word`](./wake-word/README.md) | 8300 | Always-on local wake-word detection |
| [`openwakeword-detector`](./openwakeword-detector/README.md) | 4410 | Open-source wake-word backend for custom hotword matching |

## Infrastructure

| Service | Port | Description |
|---------|------|-------------|
| [`litellm`](./litellm/README.md) | 4001 | Unified LLM proxy (OpenAI-compatible) |
| [`searxng`](./searxng/README.md) | 8080 | Self-hosted privacy search engine |
| [`egress-proxy`](./egress-proxy/README.md) | 3128 | Outbound HTTP allowlist proxy (Squid) |
| [`sso`](./sso/README.md) | 8080 | Keycloak OIDC identity provider |
| [`admin-ui`](./admin-ui/README.md) | 3000 | Admin dashboard (also in `apps/`) |
| [`sven-mirror-agent`](./sven-mirror-agent/README.md) | — | Agent self-reference / demo agent |

## Messaging Adapters

| Adapter | Protocol | Description |
|---------|----------|-------------|
| [`adapter-slack`](./adapter-slack/README.md) | Events API / Socket Mode | Slack workspace integration |
| [`adapter-teams`](./adapter-teams/README.md) | Bot Framework / Webhooks | Microsoft Teams integration |
| [`adapter-telegram`](./adapter-telegram/README.md) | Telegram Bot API | Telegram bot integration |
| [`adapter-discord`](./adapter-discord/README.md) | Discord Gateway | Discord bot integration |
| [`adapter-whatsapp`](./adapter-whatsapp/README.md) | Cloud API | WhatsApp Business integration |
| [`adapter-signal`](./adapter-signal/README.md) | signal-cli | Signal messenger integration |
| [`adapter-matrix`](./adapter-matrix/README.md) | Matrix CS API (v3) | Matrix / Element integration |
| [`adapter-google-chat`](./adapter-google-chat/README.md) | Google Chat API | Google Workspace Chat integration |
| [`adapter-imessage`](./adapter-imessage/README.md) | AppleScript / SQLite | iMessage (macOS only) |
| [`adapter-mattermost`](./adapter-mattermost/README.md) | REST + WebSocket | Mattermost self-hosted integration |
| [`adapter-irc`](./adapter-irc/README.md) | IRC (RFC 1459) | IRC network integration |
| [`adapter-nostr`](./adapter-nostr/README.md) | Nostr (NIPs) | Nostr decentralised protocol integration |
| [`adapter-twitch`](./adapter-twitch/README.md) | Twitch EventSub | Twitch chat integration |
| [`adapter-line`](./adapter-line/README.md) | LINE Messaging API | LINE integration |
| [`adapter-zalo`](./adapter-zalo/README.md) | Zalo Official Account API | Zalo (Vietnam) integration |
| [`adapter-zalo-personal`](./adapter-zalo-personal/README.md) | `zca` CLI / QR login | Zalo Personal (unofficial) integration |
| [`adapter-feishu`](./adapter-feishu/README.md) | Feishu Open Platform | Feishu / Lark integration |
| [`adapter-nextcloud-talk`](./adapter-nextcloud-talk/README.md) | Talk API | Nextcloud Talk integration |
| [`adapter-tlon`](./adapter-tlon/README.md) | Urbit HTTP API | Tlon / Urbit Groups integration |
| [`adapter-webchat`](./adapter-webchat/README.md) | WebSocket / REST | Embeddable webchat widget |
| [`adapter-voice-call`](./adapter-voice-call/README.md) | Twilio Voice / SIP | Voice call integration |

## Adapter Development

See [`docs/adapter-development.md`](../docs/adapter-development.md) for the canonical adapter protocol guide.

## Running Services

```bash
# Start the full stack
docker compose up -d

# Start a specific service
docker compose up -d gateway-api

# Bare metal (example)
npm --workspace services/gateway-api run dev
```
