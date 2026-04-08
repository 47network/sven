# Current Features And Setup

This document is the quick index for Sven's current feature surface and setup entrypoints.

## Feature Surfaces
- Admin UI: `apps/admin-ui`
- Canvas UI: `apps/canvas-ui`
- Gateway API: `services/gateway-api`
- Companion Mobile: `apps/companion-user-flutter`
- Desktop Companion: `apps/companion-desktop-tauri`

## Setup Entry Points
- Full docs index: `docs/README.md`
- Deployment docs: `docs/deploy/`
- Release runbooks and status: `docs/release/`
- Competitive parity program: `docs/parity/`

## Runtime Defaults (Current Ops Lane)
- Public ingress TLS port: `44747`
- Public host: `sven.systems`
- App host: `app.sven.systems`
- Admin alias: `admin.sven.systems`
- Chat host: `talk.sven.systems` (Rocket.Chat on `10.47.47.12`, proxied by VM4 edge nginx)
- Soak gateway source: `127.0.0.1:56002`
