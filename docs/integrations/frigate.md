# Frigate Integration

Sven can connect to Frigate for camera/event visibility and agent tool execution.

## Configure

Use admin endpoints:

- `PUT /v1/admin/frigate/config`
  - body: `{ "base_url": "http://frigate.local:5000", "token_ref": "env://FRIGATE_TOKEN" }`
- `GET /v1/admin/frigate/config`

Fallback env vars (if settings are not set):

- `FRIGATE_BASE_URL`
- `FRIGATE_TOKEN`

## Admin Endpoints

- `GET /v1/admin/frigate/health`
- `GET /v1/admin/frigate/cameras`
- `GET /v1/admin/frigate/events?camera=front&label=person&limit=50`
- `GET /v1/admin/frigate/events/:id`
- `POST /v1/admin/frigate/proxy`
  - supports methods: `GET|POST|PUT|PATCH|DELETE`
  - path must begin with `/api/`

## Agent Tools

Migration `053_frigate_tools.sql` registers:

- `frigate.list_events`
- `frigate.get_event`
- `frigate.list_cameras`

All require `frigate.read` permission and run as trusted in-process tools.
