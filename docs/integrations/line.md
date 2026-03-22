# LINE Adapter

`adapter-line` provides LINE Messaging API integration for Sven.

## Features

- Webhook ingest with LINE signature validation (`x-line-signature`)
- Identity/chat resolution through gateway adapter APIs
- Outbox delivery to LINE push API
- Approval quick-reply actions (`approve <id>` / `deny <id>`)

## Docker profile

```bash
docker compose --profile line up -d adapter-line
```

## Required env vars

- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `SVEN_ADAPTER_TOKEN`

Optional:
- `LINE_PORT` (default `8488`)

## Webhook

Expose:

- `POST /webhook`

Configure the same URL in LINE Developers Console.

Health check:

- `GET /healthz`
