# Load Test Evidence: C1.1 RSS Soak Relaunch (2026-02-22)

Date: 2026-02-22  
Owner: Codex session  
Checklist section: `C1.1 Load Testing`

## Why this rerun was required

- Previous RSS soak metadata had a dead PID with partial sampling.
- `ops:c1:rss:finalize` had a PowerShell parse bug (`?:` ternary form) and could not finalize cleanly.
- Status output needed stale-run reconciliation to avoid mixed run/summary states.

## Changes applied

- Fixed finalize parser issue:
  - `scripts/ops/c1-1-rss-soak-finalize.ps1`
  - Replaced invalid ternary with explicit `if` assignment for `finished_at`.
- Hardened status reconciliation:
  - `scripts/ops/c1-1-rss-soak-status.ps1`
  - Marks stale `summary.status=running` as `interrupted` when PID is no longer alive.
  - Keeps `summary.samples` aligned with current CSV sample count while running.

## Relaunch + validation

Commands run:

```powershell
npm run ops:c1:rss:start
npm run ops:c1:rss:status
npm run ops:c1:rss:finalize
```

Observed status snapshot (UTC):

- `running: true`
- `pid: 17804`
- `started_at: 2026-02-22T16:06:45.2661536+00:00`
- `expected_end_at: 2026-02-23T16:06:45.2661536+00:00`
- `samples: 3 / 1440`
- `growth_percent: 0.45`
- `last_sample_at: 2026-02-22T16:08:49.5309680Z`

Finalize validation result:

- `ops:c1:rss:finalize` now executes without parser errors and correctly blocks while soak PID is still running.

## Current verdict

- C1.1 RSS stability remains `in progress` until the full 24h window completes and finalization reports pass/fail.

## Rerun continuation (2026-02-22T17:37Z)

- The 16:06Z run later transitioned to `interrupted` at `84 / 1440` samples (PID exited early).
- A new 24h run was started to preserve full-window acceptance criteria.

Commands run:

```powershell
npm run ops:c1:rss:status
npm run ops:c1:rss:start
npm run ops:c1:rss:status
```

Observed status snapshot (UTC):

- `running: true`
- `pid: 44336`
- `started_at: 2026-02-22T17:37:27.5297168+00:00`
- `expected_end_at: 2026-02-23T17:37:27.5297168+00:00`
- `samples: 1 / 1440`
- `growth_percent: 0`
- `last_sample_at: 2026-02-22T17:37:28.2659473Z`

## Harness resilience hardening (2026-02-22T17:38Z)

- Updated `scripts/ops/start-c1-1-rss-soak.ps1` to avoid early process exit on transient Docker command failures.
- Changes:
  - added container-id resolver helper with guarded retries
  - wrapped `docker stats` reads in `try/catch`
  - if stats are unavailable, records `unavailable,0` sample and continues
  - auto-refreshes `gateway-api` container id once when container is recreated
- Validation:
  - PowerShell parser check passed (`OK`)
  - active run remains alive after patch (`running=true`, samples increasing via `npm run ops:c1:rss:status`)

## Continuity helper (2026-02-22T17:39Z)

- Added `scripts/ops/c1-1-rss-soak-ensure-running.ps1`.
- Added npm entrypoint: `npm run ops:c1:rss:ensure`.
- Behavior:
  - checks run metadata + PID liveness
  - if soak is running, prints current status
  - if soak is interrupted/not running, starts a new 24h soak and prints status
- Validation:
  - command run while active soak existed; returned `already running` + live status (`samples=3`).

## Live risk update (2026-02-22T18:14Z)

- Active rerun remains in progress but currently shows a large interim RSS increase:
  - `samples: 37 / 1440`
  - `first_mem_bytes: 62044242`
  - `last_mem_bytes: 109576192`
  - `growth_percent: 76.61`
- Command:
  - `npm run ops:c1:rss:ensure`
- Interpretation:
  - this is an in-progress risk signal, not a final verdict yet; full 24h completion + finalize criteria still required.

## Spike follow-up (2026-02-22T18:15Z)

- Immediate subsequent sample returned close to prior baseline:
  - `2026-02-22T18:14:27Z` -> `104.5MiB`
  - `2026-02-22T18:15:28Z` -> `59.86MiB`
- Current live status after follow-up:
  - `samples: 38 / 1440`
  - `growth_percent: 1.17`
- Interpretation:
  - spike appears transient so far; keep run active and evaluate final 24h summary before classification.

## Live continuation snapshot (2026-02-22T18:23Z)

- Current status from `npm run ops:c1:rss:status`:
  - `running: true`
  - `pid: 44336`
  - `samples: 46 / 1440`
  - `last_sample_at: 2026-02-22T18:23:41.5524697Z`
  - `growth_percent: 2.69`
- Interpretation:
  - soak is still progressing with stable low growth after the earlier transient spike; final verdict remains pending full 24h completion + finalize.

## Live continuation snapshot (2026-02-22T18:43Z)

- Current status from `npm run ops:c1:rss:ensure`:
  - `running: true`
  - `pid: 44336`
  - `samples: 65 / 1440`
  - `last_sample_at: 2026-02-22T18:43:10.6142147Z`
  - `growth_percent: 1.5`
- Interpretation:
  - run remains stable and active; keep soak running to full 24h window, then finalize for pass/fail verdict.

## Live continuation snapshot (2026-02-22T18:45Z)

- Current status from `npm run ops:c1:rss:ensure`:
  - `running: true`
  - `pid: 44336`
  - `samples: 67 / 1440`
  - `last_sample_at: 2026-02-22T18:45:14.9637323Z`
  - `growth_percent: 0.95`
- Interpretation:
  - trend remains low-growth and stable; continue full-duration run and finalize after expected end time.

## Live continuation snapshot (2026-02-22T18:51Z)

- Current status from `npm run ops:c1:rss:status`:
  - `running: true`
  - `pid: 44336`
  - `samples: 73 / 1440`
  - `last_sample_at: 2026-02-22T18:51:25.2211396Z`
  - `growth_percent: 2.13`
- Interpretation:
  - soak remains in stable range and active; final pass/fail still gated on full 24h completion and finalize output.

## Live continuation snapshot (2026-02-22T18:55Z)

- Current status from `npm run ops:c1:rss:status`:
  - `running: true`
  - `pid: 44336`
  - `samples: 77 / 1440`
  - `last_sample_at: 2026-02-22T18:55:31.0554149Z`
  - `growth_percent: 1.77`
- Interpretation:
  - run remains stable and within low-growth band; keep soak active to completion and finalize afterwards.

## Live continuation snapshot (2026-02-22T18:57Z)

- Current status from `npm run ops:c1:rss:ensure`:
  - `running: true`
  - `pid: 44336`
  - `samples: 79 / 1440`
  - `last_sample_at: 2026-02-22T18:57:35.5232632Z`
  - `growth_percent: 1.62`
- Interpretation:
  - still stable and running; no new leak signal. Keep collecting through full 24h window, then finalize.

## Live continuation snapshot (2026-02-22T18:59Z)

- Current status from `npm run ops:c1:rss:status`:
  - `running: true`
  - `pid: 44336`
  - `samples: 81 / 1440`
  - `last_sample_at: 2026-02-22T18:59:38.9391418Z`
  - `growth_percent: 3.58`
- Interpretation:
  - still in-progress and currently within acceptable interim range; completion verdict remains pending 24h finalize.

## Live continuation snapshot (2026-02-22T19:00Z)

- Current status from `npm run ops:c1:rss:status`:
  - `running: true`
  - `pid: 44336`
  - `samples: 82 / 1440`
  - `last_sample_at: 2026-02-22T19:00:40.1303536Z`
  - `growth_percent: 1.25`
- Interpretation:
  - run remains stable after transient variance; continue collection through full 24h and finalize.

## Live continuation snapshot (2026-02-22T19:01Z)

- Current status from `npm run ops:c1:rss:status`:
  - `running: true`
  - `pid: 44336`
  - `samples: 83 / 1440`
  - `last_sample_at: 2026-02-22T19:01:41.3192766Z`
  - `growth_percent: 2.75`
- Interpretation:
  - soak remains active with low interim growth; final disposition still gated by 24h completion + finalize.

## Live continuation snapshot (2026-02-22T19:06Z)

- Current status from `npm run ops:c1:rss:status`:
  - `running: true`
  - `pid: 44336`
  - `samples: 88 / 1440`
  - `last_sample_at: 2026-02-22T19:06:49.3620809Z`
  - `growth_percent: 3.03`
- Interpretation:
  - run remains stable and in-progress; continue to full 24h duration and finalize for verdict.
