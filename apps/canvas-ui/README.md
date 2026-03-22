# canvas-ui

The real-time chat surface for the Sven platform. A rich, full-featured conversation UI that supports KaTeX math rendering, markdown, code blocks, tool trace viewer, image display, approval flows, and live streaming from agents.

## What it does

- **Real-time streaming** — Server-Sent Events (SSE) connection to Gateway API; agent responses stream token by token
- **KaTeX math** — inline `$...$` and block `$$...$$` math expressions render natively
- **Markdown** — full GFM support: tables, task lists, fenced code with syntax highlighting, blockquotes
- **Tool trace viewer** — every tool call is shown as a collapsible trace: input, output, timing, sandbox status
- **Approval flows** — when the agent hits an approval gate, a prompt appears for the user to review and approve/reject the action
- **Multi-session** — tabbed conversation sessions; switch between threads without losing context
- **File upload / media** — attach files that get ingested into RAG or passed to the agent as context
- **Voice input** — browser microphone → Whisper STT → agent query (when voice stack is running)
- **Memory inspector** — sidebar showing memories the agent loaded for this session
- **WebChat embedding** — the UI can be embedded into any webpage as a widget

## Tech Stack

- **Framework**: React 18
- **Language**: TypeScript (strict)
- **Build**: Vite
- **Styling**: Tailwind CSS
- **Math rendering**: KaTeX
- **Markdown**: react-markdown + rehype/remark plugins
- **Code highlighting**: Prism.js
- **Realtime transport**: native browser `EventSource` (SSE) to Gateway API

## Running Locally

```bash
# Full stack (recommended)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Bare metal (requires Gateway API running on :4000)
npm --workspace apps/canvas-ui run dev
# → http://localhost:3001
```

## Key Scripts

| Script | Command |
|:-------|:--------|
| Dev (hot-reload) | `npm run dev` |
| Build | `npm run build` |
| Preview (built) | `npm run preview` |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| E2E tests | `npm run test:e2e` |

## Environment Variables

| Variable | Description |
|:---------|:------------|
| `VITE_GATEWAY_URL` | Gateway API base URL used by proxied SSE endpoints (default `http://localhost:4000`) |

## Embedding as a Widget

Canvas UI ships a standalone embeddable widget build. To embed in any page:

```html
<script src="https://your-sven-host/widget.js"
        data-gateway="https://your-sven-host:4000"
        data-agent-id="your-agent-id">
</script>
```

## Contributing

See the root [CONTRIBUTING.md](../../CONTRIBUTING.md). Chat rendering lives in `src/components/chat/`. Tool trace components live in `src/components/traces/`. Approval flow logic is in `src/components/approval/`. Realtime stream wiring lives in `src/components/RealtimeProvider.tsx` and chat stream wiring in `src/app/c/[chatId]/page.tsx`.
