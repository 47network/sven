# Sven Configuration

Sven supports a local config file at `~/.sven/sven.json` (or `SVEN_CONFIG`).
Precedence is: environment variables > config file > service defaults.

## Quick Start

```json
{
  "gateway": {
    "host": "0.0.0.0",
    "port": 3000,
    "public_url": "http://localhost:3000",
    "cors_origin": true
  },
  "database": {
    "url": "postgresql://sven:sven@localhost:5432/sven"
  },
  "nats": {
    "url": "nats://localhost:4222"
  },
  "inference": {
    "url": "http://localhost:11434"
  },
  "adapter": {
    "token": "<adapter-token>"
  }
}
```

## Supported Keys

### Top-level
- `env`: map of raw environment variables to inject (string values).
- `settings`: optional map of settings (reserved for future DB bootstrap).

### gateway
- `gateway.host` -> `GATEWAY_HOST` (default: `0.0.0.0`)
- `gateway.port` -> `GATEWAY_PORT` (default: `3000`)
- `gateway.public_url` -> `GATEWAY_URL`
- `gateway.cors_origin` -> `CORS_ORIGIN`

### auth
- `auth.cookie_secret` -> `COOKIE_SECRET`
- `auth.deeplink_secret` -> `DEEPLINK_SECRET`
- `auth.device_verify_url` -> `AUTH_DEVICE_VERIFY_URL`

### database
- `database.url` -> `DATABASE_URL`

### nats
- `nats.url` -> `NATS_URL`

### opensearch
- `opensearch.url` -> `OPENSEARCH_URL`
- `opensearch.user` -> `OPENSEARCH_USER`
- `opensearch.password` -> `OPENSEARCH_PASSWORD`
- `opensearch.disable_security` -> `OPENSEARCH_DISABLE_SECURITY`

### inference
- `inference.url` -> `OLLAMA_URL`
- `inference.embeddings_url` -> `EMBEDDINGS_URL`
- `inference.embeddings_model` -> `EMBEDDINGS_MODEL`
- `inference.embeddings_dim` -> `EMBEDDINGS_DIM`
- `inference.embeddings_provider` -> `EMBEDDINGS_PROVIDER`

### stream
- `stream.resume_max_events` -> `STREAM_RESUME_MAX_EVENTS`
- `stream.resume_ttl_ms` -> `STREAM_RESUME_TTL_MS`
- `stream.cleanup_ms` -> `STREAM_RESUME_CLEANUP_MS`

### tailscale
- `tailscale.mode` -> `GATEWAY_TAILSCALE_MODE` (`off|serve|funnel`)
- `tailscale.reset_on_shutdown` -> `GATEWAY_TAILSCALE_RESET_ON_SHUTDOWN`
- `tailscale.bin` -> `TAILSCALE_BIN`
- `tailscale.cmd_timeout_ms` -> `TAILSCALE_CMD_TIMEOUT_MS`

### browser
- `browser.headless` -> `BROWSER_HEADLESS`
- `browser.proxy_url` -> `BROWSER_PROXY_URL`
- `browser.enforce_container` -> `BROWSER_ENFORCE_CONTAINER`

### wake_word
- `wake_word.base_url` -> `WAKE_WORD_BASE_URL`

### web_push
- `env.WEB_PUSH_VAPID_PUBLIC_KEY` -> notification-service Web Push public key
- `env.WEB_PUSH_VAPID_PRIVATE_KEY` -> notification-service Web Push private key
- `env.WEB_PUSH_VAPID_SUBJECT` -> notification-service VAPID contact (mailto URL)
- `env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` -> canvas-ui public key for browser subscription

### email
- `email.gmail_pubsub_token` -> `GMAIL_PUBSUB_TOKEN`

### frigate
- `env.FRIGATE_BASE_URL` -> Frigate server base URL fallback.
- `env.FRIGATE_TOKEN` -> Frigate API token fallback.
- Preferred production path is Admin API config with secret ref:
  - `frigate.base_url` in `settings_global`
  - `frigate.token_ref` as `env://...` secret ref

### adapter
- `adapter.token` -> `SVEN_ADAPTER_TOKEN`

### logging
- `logging.level` -> `LOG_LEVEL`

## Legacy Keys (wizard output)
These are auto-mapped for compatibility:
- `gateway_url` -> `GATEWAY_URL`
- `database_url` -> `DATABASE_URL`
- `nats_url` -> `NATS_URL`
- `opensearch_url` -> `OPENSEARCH_URL`
- `inference_url` -> `OLLAMA_URL`

## CLI
- `sven config validate [--config <path>]` validates the config file.
- `sven config print [--config <path>]` prints resolved values with redaction.

