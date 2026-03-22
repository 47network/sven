# Final DoD Local Run Blocker (2026-02-12)

Attempted local execution of `services/gateway-api/src/__tests__/final-dod.e2e.ts` with ephemeral Postgres + NATS + gateway bootstrap.

## Outcome
Blocked before test execution due to migration incompatibilities.

## Root Cause
Migration set is internally inconsistent across schema families:
- Some migrations assume `TEXT` IDs (`001_foundation.sql`, `022/023/024/...` style references).
- Other migrations assume `UUID` IDs (`001_initial_schema.sql`, `009_ha_subscriptions_automations.sql`, `028_privacy_retention.sql`, etc.).

Observed failure while applying migrations with foundation-first baseline:
- `009_ha_subscriptions_automations.sql`
- Error: foreign key constraint cannot be implemented (`chat_id UUID REFERENCES chats(id)` vs `chats.id` as `TEXT`).

Observed failure while applying migrations with initial-schema-first baseline:
- `006_ha_tools.sql`
- Error chain due mixed assumptions around ID type and insert casts/defaults in downstream migrations.

## Immediate Next Fix Required
Choose one canonical migration baseline and normalize all downstream migrations to that ID type:
1. `UUID` everywhere (preferred modern path), or
2. `TEXT` everywhere (legacy compatibility path).

Then run:
- `final-dod-e2e` workflow
- `parity-e2e` workflow
- `release-ops-drill` workflow

Only after those pass should checklist lines for CI gates be auto-checked.
