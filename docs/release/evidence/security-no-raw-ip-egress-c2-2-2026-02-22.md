# C2.2 No Raw IP Access From Tool Containers (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Changes

- Enforced strict raw-IP deny for web egress in tool runner:
  - `services/skill-runner/src/index.ts`
  - Raw IP hostnames are now always blocked (not allowlist-bypassable).

- Enforced raw-IP deny in media URL analysis path:
  - `services/skill-runner/src/media-analysis.ts`
  - Added `node:net` IP detection; URL hosts that are literal IPs are rejected.

## Existing Control

- Browser automation service already blocks raw IP navigation:
  - `services/gateway-api/src/services/BrowserAutomationService.ts`

## Validation

- `pnpm --dir services/skill-runner run build` -> pass.
