# D10 Agent Analytics Dashboard - Phase 1 (2026-02-22)

## Scope

Implemented the first production slice of agent-specific analytics in Admin UI and Gateway API, including time windows, CSV export, and threshold-based alert evaluation.

## Backend

- New admin route module:
  - `services/gateway-api/src/routes/admin/agent-analytics.ts`
- Route registration:
  - `services/gateway-api/src/routes/admin/index.ts`
- Added endpoints:
  - `GET /v1/admin/agents/analytics`
  - `GET /v1/admin/agents/analytics/export?format=csv`
  - `GET /v1/admin/agents/analytics/alerts`
  - `PUT /v1/admin/agents/analytics/alerts`
  - `GET /v1/admin/agents/analytics/alerts/evaluate`
- Metrics included per agent:
  - task success/error totals + success rate
  - average response time
  - total tokens + cost USD
  - tool usage frequency map
  - error rate + self-correction success rate
  - conversation length + follow-up proxy
- Alert thresholds stored tenant-scoped in:
  - `organization_settings.key = 'agent.analytics.alert.thresholds'`

## Admin UI

- New page:
  - `apps/admin-ui/src/app/agent-analytics/page.tsx`
- New API and hooks:
  - `apps/admin-ui/src/lib/api.ts`
  - `apps/admin-ui/src/lib/hooks.ts`
- Navigation and search integration:
  - `apps/admin-ui/src/components/layout/Sidebar.tsx`
  - `apps/admin-ui/src/components/layout/Header.tsx`
  - `apps/admin-ui/src/components/GlobalSearch.tsx`
- UI capabilities:
  - range selector (`24h`, `7d`, `30d`, `custom`)
  - CSV export action
  - alert threshold editor
  - alert evaluation display
  - per-agent metrics table

## Local Validation

- `pnpm --dir services/gateway-api run build` passed.
- `pnpm --dir apps/admin-ui run build` passed.

## Remaining

- PDF export is not implemented yet (CSV available).
- Alerting currently evaluates and reports triggers; outbound notification/escalation actions are pending.
- Metrics attribution currently uses primary agent-session mapping per chat.
