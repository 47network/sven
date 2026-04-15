# Sven Copilot Extension

VS Code extension that adds **@sven** as a GitHub Copilot Chat participant.

## Features

- **@sven** — Chat with Sven with full codebase awareness
- **@sven /soul** — View Sven's active soul content
- **@sven /heal** — Self-healing diagnostics (scan workspace for errors)
- **@sven /codebase** — Sven's codebase overview
- **@sven /deploy** — Deployment guide and status
- **@sven /improve** — Sven analyzes his own code and proposes improvements

## Setup

1. Install dependencies: `pnpm install`
2. Build: `pnpm run build`
3. Configure `sven.gatewayUrl` and `sven.apiToken` in VS Code settings
4. Press F5 to launch Extension Development Host

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `sven.gatewayUrl` | `https://sven.47network.org` | Sven gateway API URL |
| `sven.apiToken` | _(empty)_ | JWT or API key for authentication |
