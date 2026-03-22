# A9 Temporal Decay Curve Validation (2026-02-22)

- Checklist row: `A9.1 - Optional: configurable decay curve (linear, exponential, step)`

## Implemented

1. Memory search now supports curve selection:
   - `services/gateway-api/src/services/MemoryStore.ts`
   - Added `decay_curve` and `decay_step_days` support in `MemorySearchInput`.
   - `applyTemporalDecay(...)` now supports:
     - `exponential` (existing behavior)
     - `linear`
     - `step` (with configurable step days)
2. Admin memory search route now loads and forwards curve settings:
   - `services/gateway-api/src/routes/admin/memory.ts`
   - Added parsing for:
     - `memory.temporalDecay.curve`
     - `memory.temporalDecay.stepDays`
3. Default settings migration added:
   - `services/gateway-api/src/db/migrations/114_memory_decay_curve_settings.sql`
4. Admin settings page now exposes both controls:
   - `apps/admin-ui/src/app/settings/page.tsx`
   - Keys:
     - `memory.temporalDecay.curve`
     - `memory.temporalDecay.stepDays`

## Local validation

Commands run:

```powershell
pnpm --dir services/gateway-api run build
node -e "import('./services/gateway-api/dist/services/MemoryStore.js').then(m=>{const now=new Date().toISOString();const old=new Date(Date.now()-10*86400000).toISOString();const linearOld=m.applyTemporalDecay(1,old,0.98,'linear');const stepOld=m.applyTemporalDecay(1,old,0.98,'step',7);if(!(linearOld<1&&stepOld<1)){process.exit(2)};console.log('decay-ok',linearOld.toFixed(4),stepOld.toFixed(4));}).catch(e=>{console.error(e);process.exit(1);});"
```

Observed:

- Build succeeded.
- Runtime probe output: `decay-ok 0.8000 0.9800`

## Note

- Direct Jest execution of `memory-retrieval.unit.test.ts` is currently blocked by an existing ESM module-resolution issue in this repo (`packages/shared/src/index.ts` imports `./types/events.js` under ts-jest context). This is pre-existing and separate from decay-curve implementation.
