# @sven/cli

The official command-line interface for Sven. Control agents, manage approvals, send messages, install skills, and query gateway health — all from your terminal.

## Installation

```bash
# From npm (once published)
npm install -g @sven/cli

# From the monorepo (development)
npm --workspace packages/cli install
npm --workspace packages/cli run build
npm link packages/cli
```

## Quick Start

```bash
# Check stack health
sven doctor

# Start the gateway
sven gateway start

# Send a message to an agent
sven send --message "summarise my unread emails" --channel telegram --target 123456 --sender-identity-id user_42

# List pending approval requests
sven approvals list

# Approve a queued action
sven approvals approve <approval-id>
```

## Commands

| Command | Subcommands | Description |
|---------|-------------|-------------|
| `sven version` | – | Print CLI and stack version |
| `sven doctor` | – | Check gateway/admin health plus host runtime dependencies (Node, Python, ffmpeg, GPU driver probe) |
| `sven install` | – | Install host daemon wiring (`systemd`/`launchd`/`pm2`) with dry-run planning |
| `sven gateway` | `status` `start` `stop` `restart` `logs` | Manage the Docker Compose gateway |
| `sven agent` | – | Send a one-shot agent message (`--message`, channel/chat identity flags) |
| `sven send` | – | Send a channel-targeted message (`--message`, `--channel`, `--target`, `--sender-identity-id`) |
| `sven channels` | `list` `login` | Manage adapter channel connections |
| `sven auth` | `login-device` `set-cookie` `set-adapter-token` `clear` `status` | Authentication helpers |
| `sven skills` | `list` `install` | Browse and install skills |
| `sven plugins` | `import-openclaw` `import-quarantine` `validate` | Plugin management |
| `sven approvals` | `list` `approve` `deny` | Manage pending approval requests |
| `sven config` | `get` `set` | Read and write local config values |
| `sven update` | – | Self-update CLI/gateway with optional `--channel stable|beta|dev` and `--dry-run` plan mode |
| `sven exit-codes` | – | Print all defined exit codes and their meanings |

## Global Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--profile <name>` | `default` | Use a named config profile (`~/.sven/profiles/<name>/`) |
| `--format <text\|json\|ndjson>` | `text` | Output format |
| `--trace` | off | Enable verbose request tracing |

## Configuration

Config is stored in `~/.sven/sven.json` (or `~/.sven/profiles/<name>/sven.json` for named profiles).

Key fields set via `sven config set`:

| Key | Description |
|-----|-------------|
| `gatewayUrl` | Base URL of the Gateway API (`SVEN_GATEWAY_URL`) |
| `defaultAgent` | Default agent ID used by `sven send` |

## Environment Variables

All flags can also be supplied as environment variables:

| Variable | Flag equivalent |
|----------|----------------|
| `SVEN_PROFILE` | `--profile` |
| `SVEN_OUTPUT_FORMAT` | `--format` |
| `SVEN_TRACE=1` | `--trace` |
| `SVEN_GATEWAY_URL` | gateway base URL |
| `SVEN_CONFIG` | path to config JSON |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Runtime error |
| `2` | Policy or validation error |

Run `sven exit-codes` for the full list with descriptions.

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md).
