# Premium UX Patterns (2026)

Date: 2026-02-13

## Core Interaction Patterns

1. Streaming-first conversation
- Immediate optimistic user message placement.
- Assistant streaming with visible token cadence and cancel affordance.
- Deterministic completion state transition.

2. Latency masking
- Skeleton states for all primary panes.
- Progressive disclosure for heavy panels.
- Optimistic action UI with rollback on failure.

3. Cross-device continuity
- Session restore on app resume.
- Safe recovery from expired tokens.
- Seamless handoff between mobile/web/desktop using shared chat/session IDs.

4. Operational clarity
- Clear online/degraded/offline state banner.
- High-risk action confirmations with explicit consequence copy.
- Real-time counters and status chips for approvals/incidents/queues.

## Component Inventory (Required States)

- Message list: loading, streaming, sent, failed, retrying, offline.
- Composer: idle, sending, blocked, attachment-error.
- Approval card: pending, actioning, approved, denied, conflict.
- Stats card: loading, stale, healthy, warning, critical, unavailable.
- Auth banner: anonymous, authenticating, authorized, expired, revoked.
- Notifications: foreground, background, muted, permission-denied.

## Accessibility Baseline

- Contrast ratio >= WCAG AA across themes.
- Keyboard navigable web/desktop flows.
- Touch target minimum 44x44 logical pixels on mobile.
- Reduced motion path for major transitions.
- Announced status changes for critical async actions.

