# apps/

End-user and operator application frontends in the Sven platform.

| App | Description |
|-----|-------------|
| [`admin-ui`](./admin-ui/README.md) | React admin dashboard — manage agents, users, skills, integrations, and system health |
| [`canvas-ui`](./canvas-ui/README.md) | Real-time chat surface — supports KaTeX, code blocks, tool-trace viewer, approval flows, and voice input |
| [`companion-user-flutter`](./companion-user-flutter/README.md) | Flutter mobile companion app (iOS + Android) for end-users |
| [`companion-desktop-tauri`](./companion-desktop-tauri/README.md) | Tauri/Rust cross-platform desktop companion app (macOS, Windows, Linux) |

## Running Apps

```bash
# Via Docker Compose
docker compose up -d admin-ui canvas-ui

# Bare metal (example)
npm --workspace apps/admin-ui run dev
npm --workspace apps/canvas-ui run dev
```

See each app's README for full setup instructions, env vars, and architecture notes.
