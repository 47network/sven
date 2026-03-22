# skills/

Built-in skills (tools) available to Sven agents out of the box. Each skill is a self-contained module with a `handler.ts` entry point, a `SKILL.md` capability manifest, and a `README.md`.

## Available Skills

| Skill | Description |
|-------|-------------|
| [`email-generic`](./email-generic/README.md) | Send and read emails via SMTP/IMAP — compatible with any standard mail server |
| [`gif-search`](./gif-search/README.md) | Search animated GIFs using Tenor or Giphy with safe filtering |
| [`image-generation`](./image-generation/README.md) | Generate images via a configured provider (Stable Diffusion, DALL·E, etc.) |
| [`notion`](./notion/README.md) | Search Notion content and create/append page content via Notion API |
| [`openclaw`](./openclaw/README.md) | Plugin bridge for importing skills from the OpenClaw ecosystem |
| [`spotify`](./spotify/README.md) | Search tracks/artists and fetch track details via Spotify Web API |
| [`trello`](./trello/README.md) | List boards/lists/cards and create/move cards via Trello REST API |
| [`weather-openmeteo`](./weather-openmeteo/README.md) | Current weather + forecast by city or coordinates (Open-Meteo) |

## Skill Structure

Every skill follows this layout:

```
skills/<name>/
├── handler.ts      # Exported async function(s) — the skill implementation
├── SKILL.md        # Capability manifest (name, description, parameters, examples)
└── README.md       # Developer notes, env vars, and setup instructions
```

## Installing a Skill

```bash
# Via CLI
sven skills install <name>

# Via Admin UI
# Navigate to Skills → Browse → Install
```

## Writing a New Skill

1. Create `skills/<your-skill>/handler.ts` exporting an async function.
2. Add `SKILL.md` describing inputs, outputs, and examples.
3. Add `README.md` (use the files above as templates).
4. Register the skill in the registry via `sven skills install ./<your-skill>` or the Admin UI.

For sandboxing requirements and the full skill authoring specification, see the [`skill-runner` README](../services/skill-runner/README.md) and the root [CONTRIBUTING.md](../CONTRIBUTING.md).
