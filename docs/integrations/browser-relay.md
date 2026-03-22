# Browser Relay (Extension Mode)

Browser Relay lets Sven control an already-open user browser session through a signed extension channel, instead of launching a separate headless browser.

## Security model

- Relay sessions are per-user and short-lived (`ttl_minutes`).
- Every session has an `extension_token` shown once at creation.
- Commands are permission-scoped (`read_dom`, `capture_screenshot`, `click`, `type`, etc.).
- Domain guardrails are explicit (`allowed_domains` required).
- Optional origin pinning (`allowed_origins`) blocks token replay from unexpected extension origins.
- Write commands (`click`, `type`, `submit`, `download`, `clipboard_write`) require `approval_id`.

## API flow

1. Create relay session:
   - `POST /v1/tools/browser/relay/sessions`
2. Extension heartbeat:
   - `POST /v1/tools/browser/relay/sessions/:id/heartbeat`
   - Header: `x-sven-relay-token`
3. Dispatch command from Sven:
   - `POST /v1/tools/browser/relay/sessions/:id/commands`
4. Extension pulls command queue:
   - `GET /v1/tools/browser/relay/sessions/:id/commands/pull`
   - Header: `x-sven-relay-token`
5. Extension posts command result:
   - `POST /v1/tools/browser/relay/sessions/:id/commands/:commandId/result`
   - Header: `x-sven-relay-token`

## Environment variables

- `BROWSER_RELAY_MAX_TTL_MINUTES` (default `720`)
- `BROWSER_RELAY_MAX_COMMAND_AGE_SECONDS` (default `300`)

## Operational notes

- Revoke compromised sessions with:
  - `POST /v1/tools/browser/relay/sessions/:id/revoke`
- Browser relay actions are written to `browser_audit_logs` with `relay_*` actions.
