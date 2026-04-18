// ---------------------------------------------------------------------------
// Event bus — bounded, in-memory fan-out from NATS → SSE subscribers.
// ---------------------------------------------------------------------------
// Cardinality-safe: only whitelisted NATS subjects are translated, and every
// outbound payload is a bounded JSON shape (no raw message bodies, no PII).
// Heartbeat pings every 15s keep SSE proxies from idle-timing out.
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import type { NatsConnection, Subscription } from 'nats';
import type { EidolonEvent, EidolonEventKind } from './types.js';

type Listener = (ev: EidolonEvent) => void;

const HEARTBEAT_MS = 15_000;
const MAX_LISTENERS = 256;

const SUBJECT_MAP: Record<string, EidolonEventKind> = {
  'sven.market.listing_published': 'market.listing_published',
  'sven.market.order_paid': 'market.order_paid',
  'sven.market.fulfilled': 'market.fulfilled',
  'sven.market.refunded': 'market.refunded',
  'sven.market.task_created': 'market.task_created',
  'sven.market.task_completed': 'market.task_completed',
  'sven.treasury.credit': 'treasury.credit',
  'sven.treasury.debit': 'treasury.debit',
  'sven.agent.spawned': 'agent.spawned',
  'sven.agent.retired': 'agent.retired',
  'sven.agent.profile_updated': 'agent.profile_updated',
  'sven.agent.tokens_earned': 'agent.tokens_earned',
  'sven.agent.moved': 'agent.moved',
  'sven.agent.built_structure': 'agent.built_structure',
  'sven.agent.parcel_acquired': 'agent.parcel_acquired',
  'sven.goal.progress': 'goal.progress',
  'sven.goal.completed': 'goal.completed',
  'sven.agent.business_created': 'agent.business_created',
  'sven.agent.business_activated': 'agent.business_activated',
  'sven.agent.business_deactivated': 'agent.business_deactivated',
  'sven.crew.created': 'crew.created',
  'sven.crew.member_added': 'crew.member_added',
  'sven.agent.anomaly_detected': 'agent.anomaly_detected',
  'sven.agent.report_generated': 'agent.report_generated',
  'sven.oversight.command_issued': 'oversight.command_issued',
  'sven.agent.message_sent': 'agent.message_sent',
  'sven.publishing.project_created': 'publishing.project_created',
  'sven.publishing.stage_advanced': 'publishing.stage_advanced',
  'sven.publishing.review_submitted': 'publishing.review_submitted',
  'sven.publishing.book_published': 'publishing.book_published',
  'sven.infra.node_change': 'infra.node_change',
};

export class EidolonEventBus {
  private readonly listeners = new Set<Listener>();
  private heartbeat: NodeJS.Timeout | null = null;
  private readonly natsSubs: Subscription[] = [];

  start(nc: NatsConnection | null): void {
    this.heartbeat = setInterval(() => this.publish(this.heartbeatEvent()), HEARTBEAT_MS);
    if (!nc) return;
    for (const subject of Object.keys(SUBJECT_MAP)) {
      const sub = nc.subscribe(subject);
      this.natsSubs.push(sub);
      this.consumeSubscription(sub, subject).catch(() => {
        /* subscription ended; ignore */
      });
    }
  }

  async stop(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    for (const sub of this.natsSubs) {
      try { sub.unsubscribe(); } catch { /* ignore */ }
    }
    this.natsSubs.length = 0;
    this.listeners.clear();
  }

  subscribe(listener: Listener): () => void {
    if (this.listeners.size >= MAX_LISTENERS) {
      throw new Error('max_listeners_reached');
    }
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(ev: EidolonEvent): void {
    for (const l of this.listeners) {
      try { l(ev); } catch { /* single bad listener must not halt fan-out */ }
    }
  }

  // ----- internals ---------------------------------------------------------

  private async consumeSubscription(sub: Subscription, subject: string): Promise<void> {
    const kind = SUBJECT_MAP[subject];
    if (!kind) return;
    for await (const msg of sub) {
      const payload = safeDecode(msg.data);
      this.publish({
        id: randomUUID(),
        at: new Date().toISOString(),
        kind,
        payload: sanitisePayload(payload),
      });
    }
  }

  private heartbeatEvent(): EidolonEvent {
    return {
      id: randomUUID(),
      at: new Date().toISOString(),
      kind: 'heartbeat',
      payload: { uptimeSec: Math.floor(process.uptime()) },
    };
  }
}

function safeDecode(data: Uint8Array): unknown {
  try {
    const text = Buffer.from(data).toString('utf8');
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Bounded payload — only primitive scalar fields survive, max 12 keys,
// strings truncated to 80 chars. No free-form user text or PII can leak.
function sanitisePayload(raw: unknown): Record<string, string | number | boolean | null> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string | number | boolean | null> = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= 12) break;
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(k)) continue;
    if (v === null || typeof v === 'boolean' || typeof v === 'number') {
      out[k] = typeof v === 'number' && !Number.isFinite(v) ? null : v;
    } else if (typeof v === 'string') {
      out[k] = v.length > 80 ? `${v.slice(0, 77)}…` : v;
    } else {
      continue;
    }
    count += 1;
  }
  return out;
}
