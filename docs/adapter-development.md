# Adapter Development Guide

This guide covers the Sven messaging adapter protocol, how to develop a new adapter, and how to run and test an existing one.

---

## Overview

Each messaging adapter is an independent service that:

1. Connects to an external messaging platform (Slack, Telegram, Discord, etc.)
2. Translates inbound messages from the platform into the Sven adapter protocol
3. Publishes inbound messages to the Gateway API
4. Subscribes to outbound messages from the Gateway API and forwards them to the platform

Adapters are intentionally kept thin — they do no AI processing, memory reads, or tool calls. All intelligence stays in the agent runtime.

---

## Communication Protocol

Adapters communicate with the Gateway API over **HTTP** using a shared token (`SVEN_ADAPTER_TOKEN`).

### Inbound (platform → Sven)

```
POST https://<gateway>/api/v1/adapters/<adapterId>/inbound
Authorization: Bearer <SVEN_ADAPTER_TOKEN>

{
  "accountId": "string",       // unique ID for the chat account/room
  "userId":    "string",       // platform-specific user ID
  "text":      "string",       // message text
  "attachments": [],           // optional file attachments
  "metadata":  {}              // platform-specific metadata
}
```

### Outbound (Sven → platform)

Adapters poll or use long-poll on:

```
GET https://<gateway>/api/v1/adapters/<adapterId>/outbound?accountId=<accountId>
Authorization: Bearer <SVEN_ADAPTER_TOKEN>
```

Or, if the platform supports it, adapters can receive outbound messages via the Gateway WebSocket stream.

---

## Environment Variables

Every adapter requires at minimum:

| Variable | Description |
|:---------|:------------|
| `SVEN_GATEWAY_URL` | Gateway API base URL |
| `SVEN_ADAPTER_TOKEN` | Shared authentication token |
| `SVEN_ADAPTER_ID` | Unique ID for this adapter instance |

Platform-specific credentials are also required (API keys, bot tokens, etc.) — see each adapter's own README.

---

## Running an Adapter Locally

```bash
# Via Docker Compose (include the adapter's service name)
docker compose up -d gateway-api adapter-slack

# Bare metal
npm --workspace services/adapter-slack run dev
```

---

## Creating a New Adapter

1. Copy `services/adapter-slack` as a template.
2. Update `package.json`: name, description, keywords.
3. Implement `src/index.ts`:
   - Connect to the platform using the platform's SDK.
   - On inbound message: POST to Gateway `inbound` endpoint.
   - Poll or subscribe to Gateway `outbound` endpoint and forward to the platform.
4. Add `Dockerfile` referencing the standard Node.js base image.
5. Add a service entry to `docker-compose.yml` and `docker-compose.production.yml`.
6. Add a Docker entry to `.github/dependabot.yml`.
7. Add to the adapter list in `README.md` and `docs/ARCHITECTURE.md`.
8. Write a basic integration test in `src/__tests__/`.

---

## Adapter Directory

| Adapter | Platform | Protocol |
|:--------|:---------|:---------|
| [adapter-slack](../../services/adapter-slack) | Slack | Bolt SDK webhook |
| [adapter-teams](../../services/adapter-teams) | Microsoft Teams | Bot Framework |
| [adapter-telegram](../../services/adapter-telegram) | Telegram | grammY polling / webhook |
| [adapter-discord](../../services/adapter-discord) | Discord | discord.js websocket |
| [adapter-whatsapp](../../services/adapter-whatsapp) | WhatsApp | WhatsApp Business API |
| [adapter-signal](../../services/adapter-signal) | Signal | signal-cli REST bridge |
| [adapter-matrix](../../services/adapter-matrix) | Matrix | matrix-js-sdk |
| [adapter-google-chat](../../services/adapter-google-chat) | Google Chat | Chat API webhook |
| [adapter-imessage](../../services/adapter-imessage) | iMessage | BlueBubbles API |
| [adapter-mattermost](../../services/adapter-mattermost) | Mattermost | Bot API |
| [adapter-irc](../../services/adapter-irc) | IRC | irc.js |
| [adapter-nostr](../../services/adapter-nostr) | Nostr | nostr-tools relay |
| [adapter-twitch](../../services/adapter-twitch) | Twitch | tmi.js chat |
| [adapter-line](../../services/adapter-line) | Line | Line Messaging API |
| [adapter-zalo](../../services/adapter-zalo) | Zalo | Zalo Official Account API |
| [adapter-feishu](../../services/adapter-feishu) | Feishu / Lark | Feishu Bot API |
| [adapter-nextcloud-talk](../../services/adapter-nextcloud-talk) | Nextcloud Talk | Talk API |
| [adapter-tlon](../../services/adapter-tlon) | Tlon / Urbit | Urbit Eyre HTTP |
| [adapter-webchat](../../services/adapter-webchat) | WebChat | Embedded JS widget |
| [adapter-voice-call](../../services/adapter-voice-call) | Voice Call | SIP / provider API |
