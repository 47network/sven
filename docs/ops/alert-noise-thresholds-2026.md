# Alert Noise Thresholds (2026)

Date: 2026-02-14

## Objective

Reduce alert fatigue while preserving fast detection of P0/P1 failures.

## Baseline Thresholds

- Availability:
  - Trigger P0 if `healthz` hard fails for 2 consecutive minutes.
- Core endpoint error rate:
  - Trigger P1 if error rate `> 8%` for 5 minutes on auth/chat/approvals/admin metrics.
- Latency:
  - Trigger P1 if p95 exceeds SLO by `> 2x` for 10 minutes.

## Noise Controls

- Require sustained windows (no single-sample pages).
- Aggregate repeated identical alerts into one incident thread.
- Suppress duplicate alerts while incident is open.
- Route non-actionable alerts to digest channels, not pager.

## Escalation Mapping

- P0: immediate page + incident channel.
- P1: page during active hours, then escalate if >15 minutes unresolved.
- P2: ticket and daily ops review unless trend worsens.

## Review Cadence

- Weekly: top noisy alerts and false-positive rate.
- Per release: threshold recalibration using latest perf/capacity evidence.
