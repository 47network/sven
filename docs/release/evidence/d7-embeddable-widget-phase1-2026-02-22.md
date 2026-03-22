# D7 Embeddable Widget (Phase 1) — 2026-02-22

## Scope
- Deliver first local slice of embeddable web chat widget via `<script>` bootstrap, configurable settings, instance API keys, and per-instance rate limiting.

## Implemented
- Widget config + instance schema:
  - `services/gateway-api/src/db/migrations/140_web_widget_embed.sql`
  - Tables:
    - `web_widget_settings`
    - `web_widget_instances` (includes `api_key_hash`, `rate_limit_rpm`)
- Admin management APIs:
  - `services/gateway-api/src/routes/admin/web.ts`
  - `GET /v1/admin/web/widget/settings`
  - `PUT /v1/admin/web/widget/settings`
  - `GET /v1/admin/web/widget/instances`
  - `POST /v1/admin/web/widget/instances` (one-time API key return)
  - `GET /v1/admin/web/widget/embed/:instanceId` (embed snippet generator)
- Script-tag widget bootstrap:
  - `services/adapter-webchat/src/index.ts`
  - `GET /widget.js` serves bootstrap script.
  - Supports config from:
    - `window.SvenWidgetConfig`
    - `<script data-*>` attrs (`endpoint`, `apiKey`, title/theme/position/avatar/welcome)
  - Persists `user_id` + `chat_id` in `localStorage` for cross-navigation session continuity.
  - Renders responsive floating panel + iframe host.
- Inbound per-instance rate limiting:
  - `services/gateway-api/src/routes/adapter.ts`
  - Validates `metadata.widget_instance_key` against hashed instance keys.
  - Enforces per-minute counters by `rate_limit_rpm`.
  - Returns `WIDGET_RATE_LIMITED` when over quota.
- Adapter auth passthrough:
  - `services/adapter-webchat/src/index.ts`
  - Auth accepts `widget_api_key`; message/file/audio events include `metadata.widget_instance_key`.
- Admin UI page (phase-1):
  - `apps/admin-ui/src/app/widget/page.tsx`
  - Includes:
    - widget settings editor + save (`GET/PUT /v1/admin/web/widget/settings`)
    - widget instance creation/list (`GET/POST /v1/admin/web/widget/instances`)
    - embed snippet generation (`GET /v1/admin/web/widget/embed/:instanceId`)
    - copy-to-clipboard helper and local visual preview
  - Admin nav/search wiring:
    - `apps/admin-ui/src/components/layout/Sidebar.tsx`
    - `apps/admin-ui/src/components/layout/Header.tsx`
    - `apps/admin-ui/src/components/GlobalSearch.tsx`

## Local Validation
- Command (run in `services/gateway-api`):
  - `npm run test -- --runTestsByPath src/__tests__/embeddable-widget.test.ts src/__tests__/ai-ops-weekly-report.test.ts`
- Result:
  - `PASS src/__tests__/embeddable-widget.test.ts`
  - `PASS src/__tests__/ai-ops-weekly-report.test.ts`
  - `6 passed, 0 failed`

## Notes
- This phase now includes backend APIs + embed bootstrap/runtime + Admin UI phase-1 page.
- Instance API keys are intentionally one-time returned at creation and never listed again.
