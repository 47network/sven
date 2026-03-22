# wake-word

**Wake Word Engine**

Wake-word ingest service. Accepts authenticated wake-word detections plus referenced audio, persists the event, forwards it into the gateway/runtime pipeline, and publishes the resulting event on NATS. The actual always-on detector/capture runtime is external to this repo.

## Port

$(System.Collections.Hashtable.port)

## Dependencies

Gateway API, Postgres, NATS, and an external detector/capture runtime

## Required Environment Variables

Set these in your .env (see [.env.example](../../.env.example)):

```
WAKE_WORD_MODEL, WAKE_WORD_PHRASE, WAKE_WORD_SENSITIVITY, WAKE_WORD_SIGNING_SECRET
```

Optional hardening limits:

```
WAKE_WORD_MAX_AUDIO_BYTES, WAKE_WORD_MAX_REQUEST_BODY_BYTES, WAKE_WORD_AUDIO_URL_ALLOWLIST
```

## Running

```bash
# Via Docker Compose
docker compose up -d wake-word

# Bare metal
npm --workspace services/wake-word run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md).
