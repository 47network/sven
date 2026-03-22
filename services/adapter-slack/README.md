# adapter-slack

Sven messaging adapter for **Slack**.

Receives messages from Slack and forwards them to the Sven agent runtime via the Gateway API. Delivers agent responses back to Slack.

For a full overview of how adapters work, see [docs/adapter-development.md](../../docs/adapter-development.md).

## Platform

| | |
|:--|:--|
| **Platform** | Slack |
| **Protocol** | Slack Bolt SDK |

## Prerequisites

Supports DMs, channels, threads. Uses Socket Mode for local dev (no public URL needed).

## Required Environment Variables

| Variable | Description |
|:---------|:------------|
| SVEN_GATEWAY_URL | Sven Gateway API base URL |
| SVEN_ADAPTER_TOKEN | Shared adapter authentication token |
| SVEN_ADAPTER_ID | Unique identifier for this adapter instance |
| `SLACK_BOT_TOKEN` | Slack-specific credential — see platform docs |
| `SLACK_SIGNING_SECRET` | Slack-specific credential — see platform docs |
| `SLACK_APP_TOKEN` | Slack-specific credential — see platform docs |

## Running

```bash
# Via Docker Compose
docker compose up -d adapter-slack

# Bare metal
npm --workspace services/adapter-slack run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [adapter development guide](../../docs/adapter-development.md).
