# admin-ui

**Admin Dashboard**

Central administration surface for Sven. Manage agents, users, skills, integrations, and system health in one React-based UI.

## Port

`3000`

## Dependencies

Gateway API, NATS, PostgreSQL (via Gateway)

## Required Environment Variables

```
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

## Running

```bash
docker compose up -d admin-ui

# Bare metal
npm --workspace services/admin-ui run dev
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md) and [apps/admin-ui/README.md](../../apps/admin-ui/README.md) for full feature documentation.
