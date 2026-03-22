# deploy/multi-vm/secrets/

Runtime secret files consumed by containers. **Never commit actual secrets here.**

## Required Files

| File             | Consumer            | Format                    | Description                                  |
|------------------|----------------------|---------------------------|----------------------------------------------|
| `metrics-token`  | Prometheus → Gateway | Single-line plain text    | `SVEN_METRICS_AUTH_TOKEN` value for `/metrics` header |

## Setup

```bash
# On VM61 (sven-data), create the secrets directory and populate:
mkdir -p /srv/sven/prod/src/deploy/multi-vm/secrets
echo -n "$SVEN_METRICS_AUTH_TOKEN" > /srv/sven/prod/src/deploy/multi-vm/secrets/metrics-token
chmod 600 /srv/sven/prod/src/deploy/multi-vm/secrets/metrics-token
```

The `metrics-token` file must contain **only** the raw token value, with no trailing newline.
Prometheus reads this file at scrape time via `http_headers.<name>.files`.
