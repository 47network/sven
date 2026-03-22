---
name: email-generic
description: Send/search emails via a generic IMAP/SMTP bridge (or vendor API).
version: 2026.2.21
publisher: Local Publisher
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["send","search","list"],"default":"send"},"to":{"type":"array","items":{"type":"string"}},"cc":{"type":"array","items":{"type":"string"}},"bcc":{"type":"array","items":{"type":"string"}},"subject":{"type":"string"},"body":{"type":"string"},"query":{"type":"string"},"limit":{"type":"integer","minimum":1,"maximum":50,"default":10}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"},"items":{"type":"array","items":{"type":"object"}}},"required":["action"]}
---

# Email (Generic IMAP/SMTP) Skill

Provides generic email operations via a bridge service that speaks IMAP/SMTP or a vendor API.

## Configuration
- Required:
  - `EMAIL_API_BASE` (HTTP endpoint for email bridge)
- Optional:
  - `EMAIL_API_KEY` (bearer token for the bridge)
  - `EMAIL_FROM` (default sender address)

The bridge should implement:
- `POST /send` with `{ from, to, cc, bcc, subject, body }`
- `POST /search` with `{ query, limit }`
- `GET /inbox?limit=10`

## Approval Policy
Sending email is **write** scope and should be approval-gated when the recipient is external or when policy requires explicit confirmation.

## Egress / Network Policy
- Allowlist:
  - Host for `EMAIL_API_BASE`
- Denylist:
  - All other outbound domains

## Scope Mapping
- `email.send`: **write**
- `email.search`: **read**
- `email.list`: **read**

## Notes
This skill is designed to be provider-agnostic; wire it to IMAP/SMTP or a vendor API through the bridge.
