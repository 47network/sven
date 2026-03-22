# 72h Soak Runbook

Start soak (dedicated local stack + monitor):

```bash
npm run release:soak:start
```

Check status:

```bash
npm run release:soak:status
```

Finalize an expired/stale run (monitor process died, but soak window elapsed):

```bash
npm run release:soak:finalize
```

Stop soak:

```bash
npm run release:soak:stop
```

Evidence files:
- `docs/release/status/soak-72h-summary.json`
- `docs/release/status/soak-72h-events.jsonl`
- `docs/release/status/soak-72h.log`
- `docs/release/status/soak-gateway.log`

Promote release gates when soak is complete and clean:

```bash
npm run release:soak:promote
```

Manual fallback:

```bash
npm run release:gate:set -- soak_72h true
npm run release:gate:set -- week4_rc_complete true
```
