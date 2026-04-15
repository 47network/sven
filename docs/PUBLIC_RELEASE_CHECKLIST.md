# Sven — Public Release Preparation Checklist

> Generated: 2026-04-15
> Purpose: Strip all trading/financial code from the public `sven` branch
> Private branch codename: **`argentum`** (Ag — element 47)
> Public branch: **`sven`** (open-source release)

---

## Strategy

The `argentum` branch keeps everything (trading, treasury, wallet, XLVII brand, PCI compliance).
The public `sven` branch strips all trading/financial features while keeping Sven fully functional as an AI companion, agent runtime, and productivity platform.

**What gets stripped:**
- Trading UI, trading skills, trading routes, trading engines
- Wallet engine, treasury engine, crypto wallet management
- XLVII brand engine/merchandise
- PCI-DSS compliance module (payment-specific)
- Revenue pipeline trading type
- All trading-related DB migrations
- Trading admin pages, hooks, API namespaces
- Trading references in Copilot extension
- Trading references in Flutter companion (hub tab, deep links, notifications)
- Trading-related documentation

**What stays:**
- Full AI agent runtime (council, memory, evolution, skills, inference)
- Gateway API (minus trading routes)
- Admin UI (minus trading/treasury/wallet/brand pages)
- Flutter companion (minus trading tab)
- Canvas UI, Tauri desktop
- All infrastructure, deployment, CI/CD configs
- Revenue pipeline (minus trading type) — supports marketplace/content/product/merch
- Infra proposals (minus treasury proposals)

---

## Table of Contents

1. [Phase 1 — Clean Delete (Full Directories)](#phase-1--clean-delete-full-directories)
2. [Phase 2 — Clean Delete (Individual Files)](#phase-2--clean-delete-individual-files)
3. [Phase 3 — Surgical Edits (Backend)](#phase-3--surgical-edits-backend)
4. [Phase 4 — Surgical Edits (Admin UI)](#phase-4--surgical-edits-admin-ui)
5. [Phase 5 — Surgical Edits (Flutter Companion)](#phase-5--surgical-edits-flutter-companion)
6. [Phase 6 — Surgical Edits (Copilot Extension)](#phase-6--surgical-edits-copilot-extension)
7. [Phase 7 — Surgical Edits (Configs & Deploy)](#phase-7--surgical-edits-configs--deploy)
8. [Phase 8 — Surgical Edits (Documentation)](#phase-8--surgical-edits-documentation)
9. [Phase 9 — DB Migration Cleanup](#phase-9--db-migration-cleanup)
10. [Phase 10 — Changelog & README Update](#phase-10--changelog--readme-update)
11. [Phase 11 — Verification & Build](#phase-11--verification--build)

---

## Phase 1 — Clean Delete (Full Directories)

> 4 full directory trees to remove. No surgical editing needed.

- [x] **1.1** Delete `apps/trading-ui/` — Next.js trading frontend (TradingView charts, order ticket, backtest, analytics, alerts)
- [x] **1.2** Delete `packages/trading-platform/` — `@sven/trading-platform` package (14 sub-modules: market-data, engine, risk, OMS, predictions, news, autonomous, broker, backtest, alerts, analytics, indicators)
- [x] **1.3** Delete `skills/trading/` — 14 trading skills (chart-analysis, backtest, crypto-wallet, revenue-pipeline, portfolio-manager, market-data-query, news-analysis, place-order, treasury-manager, strategy-manager, predictions, xlvii-brand, risk-assessment, tool-builder)
- [x] **1.4** Delete `services/gateway-api/src/routes/trading/` — Trading route helpers (binance.ts, binance-ws.ts, news-sources.ts, gpu-fleet.ts, types.ts, index.ts)

---

## Phase 2 — Clean Delete (Individual Files)

> ~35 individual files to remove.

### Gateway API — Trading Routes

- [x] **2.1** Delete `services/gateway-api/src/routes/trading.ts` — Main trading engine (~1600 lines: all `/v1/trading/*` endpoints, autonomous loop, SSE, Binance WS, predictions, backtest)
- [x] **2.2** Delete `services/gateway-api/src/routes/admin/trading.ts` — Admin trading dashboard routes
- [x] **2.3** Delete `services/gateway-api/src/routes/admin/treasury.ts` — Treasury admin routes (accounts, proposals, budgets, audit)
- [x] **2.4** Delete `services/gateway-api/src/routes/admin/wallet.ts` — Crypto wallet admin routes
- [x] **2.5** Delete `services/gateway-api/src/routes/admin/xlvii-brand.ts` — XLVII brand admin routes (products, orders, config)

### Agent Runtime — Trading Engines

- [x] **2.6** Delete `services/agent-runtime/src/wallet-engine.ts` — Crypto wallet engine (EVM, multi-chain, HD derivation)
- [x] **2.7** Delete `services/agent-runtime/src/treasury-engine.ts` — Treasury engine (double-entry ledger, proposals, budgets)
- [x] **2.8** Delete `services/agent-runtime/src/xlvii-brand-engine.ts` — XLVII brand engine (merch e-commerce)
- [x] **2.9** Delete `services/agent-runtime/src/pci-compliance.ts` — PCI-DSS compliance module (payment card detection/redaction)

### Agent Runtime — Test Files

- [x] **2.10** Delete `services/agent-runtime/src/__tests__/revenue-pipeline.test.ts`
- [x] **2.11** Delete `services/agent-runtime/src/__tests__/treasury-engine.test.ts`
- [x] **2.12** Delete `services/agent-runtime/src/__tests__/xlvii-brand-engine.test.ts`

### Flutter Companion — Trading Feature

- [x] **2.13** Delete `apps/companion-user-flutter/lib/features/trading/` — Entire trading feature (18 files: dashboard, service, SSE, cache, models, backtest, broker, credentials, news, P&L, portfolio, alerts, control, goals, intelligence, messages, history, trends)
- [x] **2.14** Delete `apps/companion-user-flutter/test/trading_cache_test.dart`
- [x] **2.15** Delete `apps/companion-user-flutter/test/trading_models_test.dart`

### Admin UI — Trading Pages

- [x] **2.16** Delete `apps/admin-ui/src/app/trading/page.tsx` — Admin trading dashboard
- [x] **2.17** Delete `apps/admin-ui/src/app/trading-brokers/page.tsx` — Admin broker health
- [x] **2.18** Delete `apps/admin-ui/src/app/trading-credentials/page.tsx` — Exchange key management
- [x] **2.19** Delete `apps/admin-ui/src/app/treasury/page.tsx` — Treasury dashboard
- [x] **2.20** Delete `apps/admin-ui/src/app/brand/page.tsx` — XLVII brand dashboard

### E2E Tests

- [x] **2.21** Delete `tests/e2e/ui/trading-dashboard.spec.ts` — Playwright trading dashboard tests (12 tests)

### Nginx / Config

- [x] **2.22** Delete `config/nginx/extnginx-sven-trading.conf` — Nginx TLS proxy for `trading.sven.systems`

### Documentation

- [x] **2.23** Delete `docs/features/PILLAR_06_TRADING_PLATFORM.md` — Entire Pillar 6 spec

---

## Phase 3 — Surgical Edits (Backend)

> Shared backend files that reference trading. Remove only trading-specific code.

### Gateway API — Main Index

- [x] **3.1** `services/gateway-api/src/index.ts` — Remove `import { registerTradingRoutes }` (L55), SSE route check for `/v1/trading/events` (L415), and `await registerTradingRoutes(app, pool)` (L798)

### Gateway API — Admin Route Index

- [x] **3.2** `services/gateway-api/src/routes/admin/index.ts` — Remove imports: `registerTradingDashboardRoutes` (L70), `registerTreasuryRoutes` (L72), `registerWalletRoutes` (L73), `registerXlviiBrandRoutes` (L76). Remove registrations: trading (L381), treasury (L383), wallet (L384), xlvii-brand (L387)

### Gateway API — Package.json

- [x] **3.3** `services/gateway-api/package.json` — Remove `"@sven/trading-platform": "file:../../packages/trading-platform"` dependency

### Gateway API — Admin Revenue Routes

- [x] **3.4** `services/gateway-api/src/routes/admin/revenue.ts` — Remove `'trading'` from `validTypes` array (L42). Review `treasury_audit_log` reference (L207)

### Gateway API — Admin Evolution Routes

- [x] **3.5** `services/gateway-api/src/routes/admin/evolution.ts` — Remove `trading_strategy` from seed data (L215)

### Agent Runtime — Revenue Pipeline

- [x] **3.6** `services/agent-runtime/src/revenue-pipeline.ts` — Remove `'trading'` from `PipelineType` union (L16), delete `tradingPnlToRevenueEvent()` function (L685–704), clean header comments

### Agent Runtime — Evolution Engine

- [x] **3.7** `services/agent-runtime/src/evolution-engine.ts` — Remove `'trading_strategy'` from `ExperimentDomain` type (L23), remove `trading_strategy` template (L888–891)

### Agent Runtime — Video Engine

- [x] **3.8** `services/agent-runtime/src/video-engine.ts` — Remove XLVII brand video template entry (L1107–1111)

### Agent Runtime — Remaining Backend Tests

- [x] **3.9** `services/agent-runtime/src/__tests__/remaining-backend.test.ts` — Remove wallet-engine imports (L11–21), PCI-compliance imports (L23–42), I.2.6 Fiat On/Off Ramp test block (~L195–490), I.8.4 PCI-DSS test block (~L495–710)

### Model Router — Qwen3 Fleet

- [x] **3.10** `packages/model-router/src/deploy/qwen3-fleet.ts` — Remove "trading signals" from purpose string (L136)

---

## Phase 4 — Surgical Edits (Admin UI)

> Remove trading API namespaces, hooks, and sidebar navigation.

### API Client

- [x] **4.1** `apps/admin-ui/src/lib/api.ts` — Remove `trading` namespace (~L2358–2370), `treasury` namespace (~L2448–2483), `wallet` namespace (~L2486–2510)

### Hooks

- [x] **4.2** `apps/admin-ui/src/lib/hooks.ts` — Remove ~10 trading hooks (`useTradingDashboard`, etc. ~L1740–1749), ~11 treasury hooks (~L1781–1800), ~8 wallet hooks, merch product/order hooks

### Sidebar Navigation

- [x] **4.3** `apps/admin-ui/src/components/layout/Sidebar.tsx` — Remove entire "Trading" nav group (L112–121: Trading Dashboard, Exchange Keys, Brokers, Treasury, Proposals, XLVII Brand). Clean up unused icon imports (`TrendingUp`, `DollarSign`, `FileCheck`, `ShoppingBag`)

### Proposals Page

- [x] **4.4** `apps/admin-ui/src/app/proposals/page.tsx` — Strip treasury proposal half. Keep infra proposals only. Rename "Investment Proposals" → "Infrastructure Proposals". Remove treasury imports/hooks/handlers

---

## Phase 5 — Surgical Edits (Flutter Companion)

> Remove trading tab, deep links, notifications, and SvenHubPage trading wiring.

### SvenHubPage (3→3 tab, remove trading tab)

- [x] **5.1** `apps/companion-user-flutter/lib/features/entity/sven_hub_page.dart` — Remove trading imports (L29–31), `_HubTab.trading` enum value (L45), `tradingService`/`tradingSseService` constructor params + fields (L79–80, L103–104), `TradingDeepLink` consumption in `initState` (L124–127), trading tab content in build (L247–250+)

### AppShell (remove trading service wiring)

- [x] **5.2** `apps/companion-user-flutter/lib/app/app_shell.dart` — Remove `tradingService`/`tradingSseService` provider reads (L77–78), remove params passed to `SvenHubPage` (L161–162). Clean up trading imports

### Deep Links

- [x] **5.3** `apps/companion-user-flutter/lib/app/deep_link.dart` — Remove `DeepLinkTarget.trading()` factory (L15), `TradingDeepLink` class (L18–23), `'trading'` case in URI parser (L39–40)

### SvenUserApp (deep link handler)

- [x] **5.4** `apps/companion-user-flutter/lib/app/sven_user_app.dart` — Remove `sven_trading` channel handler (L352–355), trading deep-link handler (L791–795)

### Push Notification Manager

- [x] **5.5** `apps/companion-user-flutter/lib/features/notifications/push_notification_manager.dart` — Remove `trading` channel constants (L46–50), `financial` channel constants (L53–57), `_groupKeyTrading`/`_groupKeyFinancial` (L119–120), `_summaryIdTrading`/`_summaryIdFinancial` (L125–126), `_recentTradingLines`/`_recentFinancialLines` (L130–131). Remove any channel creation/grouping logic for these

---

## Phase 6 — Surgical Edits (Copilot Extension)

> Remove trading commands and references from VS Code Chat Participant.

- [x] **6.1** `apps/sven-copilot-extension/package.json` — Remove trading-related command descriptions: `/status` (L34), `/trade` (L50), `/positions` (L54), `/execute` (L58). Update description strings to remove "live trading context"
- [x] **6.2** `apps/sven-copilot-extension/src/extension.ts` — Remove `/status` handler (L88–94), `/trade` handler (L294–343), trading status in system prompt (L601). Remove positions handler (L279)
- [x] **6.3** `apps/sven-copilot-extension/src/api-client.ts` — Remove `getTradingStatus()` method (L199–201)
- [x] **6.4** `apps/sven-copilot-extension/src/codebase-context.ts` — Remove trading references in codebase descriptions (L26, L62, L98)
- [x] **6.5** `apps/sven-copilot-extension/README.md` — Remove trading feature descriptions (L7–8)

---

## Phase 7 — Surgical Edits (Configs & Deploy)

> Remove trading from nginx, caddy, PM2, and deploy configs.

- [x] **7.1** `config/caddy/Sven.Caddyfile` — Remove `trading.sven.systems` server block (~lines 68–95)
- [x] **7.2** `config/pm2/ecosystem.config.cjs` — Remove `sven-trading-ui` process block
- [x] **7.3** `deploy/multi-vm/nginx/nginx.multi-vm.conf` — Remove `trading.sven.systems` server block (~L718–790), `upstream trading_ui`, SSE trading events location
- [x] **7.4** `deploy/47network-website/nginx-vm1-the47network.conf` — Remove `trading.sven.systems` from `server_name` lists (L58, L180)
- [x] **7.5** `deploy/quickstart/download/index.html` — Remove "Real-time trading dashboard" feature (L145), "Trading Dashboard" tag (L154)

---

## Phase 8 — Surgical Edits (Documentation)

> Remove trading references from feature docs, expansion plan, and cross-pillar references.

- [x] **8.1** `docs/features/EXPANSION_MASTER_PLAN.md` — Remove Pillar 6 references, `trading-engine/`, `trading-ui/`, `VM-TRADE`, `trading.sven.systems`, Phase C, XLVII currency
- [x] **8.2** `docs/features/EXPANSION_MASTER_CHECKLIST.md` — Remove Phase C trading checklist, Pillar 6 items, trading engine phases, cross-pillar trading sections, trading DNS/infra/Docker entries
- [x] **8.3** `docs/features/PILLAR_08_DISTRIBUTED_COMPUTE.md` — Remove "Pillar 6 (Trading)" workload references (backtesting, MiroFish, Kronos)
- [x] **8.4** `docs/features/PILLAR_07_MARKETING_INTELLIGENCE.md` — Remove "Pillar 6 (Trading): Trading performance data"
- [x] **8.5** `docs/features/PILLAR_02_MULTI_MODEL_AGENCY.md` — Remove "Trading Engine (Pillar 6)" reference
- [x] **8.6** `docs/features/PILLAR_03_OCR_DOCUMENT_INTELLIGENCE.md` — Remove "Trading Platform (Pillar 6)" checklist item
- [x] **8.7** `docs/NEXT_IDEAS_MASTER_CHECKLIST.md` — Remove/redact trading skill paths, treasury management references, XLVII brand, revenue→treasury pipeline, VM13 trading inference (~20+ references)

---

## Phase 9 — DB Migration Cleanup

> Remove trading-specific migrations. Surgically edit mixed migrations.

- [x] **9.1** Delete `services/gateway-api/src/db/migrations/20260614100000_trading_alerts_backtest.sql` — Trading alerts + backtest tables
- [x] **9.2** Delete `services/gateway-api/src/db/migrations/20260616100000_sven_trading_state.sql` — `sven_trading_state` table
- [x] **9.3** Delete `services/gateway-api/src/db/migrations/20260617100000_sven_trading_state_v2.sql` — `sven_trading_state` v2 columns
- [x] **9.4** Delete `services/gateway-api/src/db/migrations/20260415150000_treasury_management.sql` — 6 treasury tables + 11 indexes
- [x] **9.5** `services/gateway-api/src/db/migrations/20260415200000_wallet_revenue_infra.sql` — SURGICAL EDIT: Remove wallet section (I.2, L11–80: `wallet_accounts`, `wallet_transactions`, `wallet_balance_alerts`, `wallet_multisig`). Remove `'trading'` from `revenue_pipelines.type` CHECK constraint (L89). Keep I.3 revenue tables, I.4 infra tables, I.5.5 goals

---

## Phase 10 — Changelog & README Update

> Update changelog to redact trading entries. Update README for public release.

- [x] **10.1** `CHANGELOG.md` — Redact/remove all trading-specific changelog entries (Treasury Dashboard I.7.1, Investment Proposals I.7.3, XLVII Brand I.7.4, wallet-engine, revenue-pipeline trading type, treasury-engine, trading platform, exchange keys, backtesting, broker health, trading skills, autonomous trading loop). Keep non-trading entries
- [x] **10.2** `README.md` — Review and update for public release if needed. Add "Open Source" badge/section
- [x] **10.3** `apps/sven-copilot-extension/README.md` — Remove trading feature descriptions (L7–8)

---

## Phase 11 — Verification & Build

> Ensure everything compiles, tests pass, no broken imports.

### Backend

- [x] **11.1** Run `pnpm install` in workspace root — verify no missing `@sven/trading-platform` errors
- [x] **11.2** Run TypeScript typecheck on `services/gateway-api/` — zero errors
- [x] **11.3** Run TypeScript typecheck on `services/agent-runtime/` — zero errors
- [x] **11.4** Run `npx jest` on `services/agent-runtime/` — all remaining tests pass
- [x] **11.5** Run TypeScript typecheck on `apps/admin-ui/` — zero errors
- [x] **11.6** Run `pnpm build` on `apps/admin-ui/` — successful build

### Flutter

- [x] **11.7** Run `dart analyze` on `apps/companion-user-flutter/` — zero errors
- [x] **11.8** Run `flutter test` on `apps/companion-user-flutter/` — all remaining tests pass

### Copilot Extension

- [x] **11.9** Run TypeScript typecheck on `apps/sven-copilot-extension/` — zero errors

### Full Workspace

- [x] **11.10** Grep entire workspace for orphaned `trading` imports — zero matches in non-test/non-doc files
- [x] **11.11** Grep entire workspace for orphaned `treasury` imports — zero matches
- [x] **11.12** Grep entire workspace for orphaned `wallet-engine` imports — zero matches
- [x] **11.13** Grep entire workspace for orphaned `xlvii-brand` imports — zero matches
- [x] **11.14** Grep for `@sven/trading-platform` — zero matches
- [x] **11.15** Verify `pnpm-lock.yaml` regenerated cleanly after removing trading-platform

---

## Summary Statistics

| Category | Count | Action |
|----------|-------|--------|
| Full directories to delete | 4 | `apps/trading-ui/`, `packages/trading-platform/`, `skills/trading/`, gateway trading helpers |
| Individual files to delete | 23 | Routes, engines, tests, migrations, flutter features, admin pages, nginx, docs |
| Files requiring surgical edit | ~30 | Backend shared files, admin UI (api/hooks/sidebar), Flutter (hub/shell/deeplink/notif), copilot ext, configs, docs |
| DB migrations to delete | 4 | Trading state, alerts, treasury management |
| DB migrations to surgically edit | 1 | Wallet/revenue/infra mixed migration |
| Trading skills removed | 14 | All under `skills/trading/` |
| Flutter trading pages removed | 18 | All under `lib/features/trading/` |
| Admin UI pages removed | 5 | trading, trading-brokers, trading-credentials, treasury, brand |
| Copilot extension commands removed | 4 | /status, /trade, /positions, /execute |
| Total checklist items | 73 | Across 11 phases |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Broken imports after deletion | Medium | High (build fails) | Phase 11 verification catches all |
| Mixed migration leaves orphaned constraints | Low | Medium | Surgical edit keeps only non-trading tables/constraints |
| Flutter runtime crash from missing trading tab | Medium | High | Remove enum value + all references in hub/shell |
| Revenue pipeline breaks without trading type | Low | Low | Other 5 types remain functional |
| Copilot extension loses useful commands | N/A | Low | Only trading commands removed, core chat preserved |
| `treasury_audit_log` table name in infra.ts | Low | None | Table name is just a name — rename if confusing, or leave |

---

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Delete entire `packages/trading-platform/` | Only consumed by trading-ui and gateway trading routes — both being removed |
| D2 | Keep `revenue-pipeline.ts` with surgical edit | Non-trading pipeline types (marketplace, product, content, merch) are infrastructure |
| D3 | Delete `pci-compliance.ts` | PCI-DSS is payment-card-specific; no non-trading use |
| D4 | Delete `brand/page.tsx` + `xlvii-brand.ts` + `xlvii-brand-engine.ts` | XLVII brand is part of the trading/revenue ecosystem |
| D5 | Keep `revenue.ts` admin route with edit | Non-trading revenue (marketplace, content) stays |
| D6 | Keep `infra.ts` as-is | `treasury_audit_log` reference is a table name — functionally it's a generic audit log |
| D7 | Strip proposals page to infra-only | Treasury proposals removed; infra proposals are non-trading |
| D8 | Remove Flutter trading tab entirely | SvenHubPage goes from conditional 4-tab → 3-tab shell |
| D9 | Remove `sven_financial` notification channel too | Financial summaries are treasury-dependent |
