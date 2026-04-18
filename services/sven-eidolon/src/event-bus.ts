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
  'sven.agent.avatar_changed': 'agent.avatar_changed',
  'sven.world.tick': 'world.tick',
  'sven.world.parcel_interaction': 'world.parcel_interaction',
  'sven.infra.node_change': 'infra.node_change',
  'sven.misiuni.task_created': 'misiuni.task_created',
  'sven.misiuni.bid_accepted': 'misiuni.bid_accepted',
  'sven.misiuni.proof_submitted': 'misiuni.proof_submitted',
  'sven.misiuni.task_verified': 'misiuni.task_verified',
  'sven.misiuni.payment_released': 'misiuni.payment_released',
  'sven.publishing.print_order_created': 'publishing.print_order_created',
  'sven.publishing.print_order_shipped': 'publishing.print_order_shipped',
  'sven.publishing.legal_requirement_added': 'publishing.legal_requirement_added',
  'sven.publishing.genre_trend_discovered': 'publishing.genre_trend_discovered',
  'sven.publishing.author_persona_created': 'publishing.author_persona_created',
  'sven.publishing.printer_proposal_submitted': 'publishing.printer_proposal_submitted',
  'sven.social.account_connected': 'social.account_connected',
  'sven.social.post_created': 'social.post_created',
  'sven.social.post_published': 'social.post_published',
  'sven.social.campaign_started': 'social.campaign_started',
  'sven.social.engagement_milestone': 'social.engagement_milestone',
  'sven.xlvii.collection_created': 'xlvii.collection_created',
  'sven.xlvii.product_created': 'xlvii.product_created',
  'sven.xlvii.design_created': 'xlvii.design_created',
  'sven.xlvii.design_approved': 'xlvii.design_approved',
  'sven.xlvii.fulfillment_shipped': 'xlvii.fulfillment_shipped',
  'sven.council.session_started': 'council.session_started',
  'sven.council.round_completed': 'council.round_completed',
  'sven.council.session_completed': 'council.session_completed',
  'sven.council.model_ranked': 'council.model_ranked',
  'sven.memory.stored': 'memory.stored',
  'sven.memory.recalled': 'memory.recalled',
  'sven.memory.compressed': 'memory.compressed',
  'sven.memory.decayed': 'memory.decayed',
  'sven.fleet.model_deployed': 'fleet.model_deployed',
  'sven.fleet.model_evicted': 'fleet.model_evicted',
  'sven.fleet.benchmark_completed': 'fleet.benchmark_completed',
  'sven.fleet.vram_alert': 'fleet.vram_alert',
  'sven.evolve.proposal_created': 'evolve.proposal_created',
  'sven.evolve.experiment_started': 'evolve.experiment_started',
  'sven.evolve.improvement_applied': 'evolve.improvement_applied',
  'sven.evolve.rollback_triggered': 'evolve.rollback_triggered',
  'sven.skill.registered': 'skill.registered',
  'sven.skill.imported': 'skill.imported',
  'sven.skill.audited': 'skill.audited',
  'sven.skill.promoted': 'skill.promoted',
  'sven.video.render_started': 'video.render_started',
  'sven.video.render_completed': 'video.render_completed',
  'sven.video.template_created': 'video.template_created',
  'sven.video.spec_generated': 'video.spec_generated',
  'sven.identity.avatar_created': 'identity.avatar_created',
  'sven.identity.trait_evolved': 'identity.trait_evolved',
  'sven.identity.mood_changed': 'identity.mood_changed',
  'sven.identity.item_acquired': 'identity.item_acquired',
  'sven.training.job_created': 'training.job_created',
  'sven.training.epoch_completed': 'training.epoch_completed',
  'sven.training.job_finished': 'training.job_finished',
  'sven.training.export_registered': 'training.export_registered',
  'sven.academic.project_submitted': 'academic.project_submitted',
  'sven.academic.review_completed': 'academic.review_completed',
  'sven.academic.project_delivered': 'academic.project_delivered',
  'sven.academic.citation_validated': 'academic.citation_validated',
  'sven.service.domain_created': 'service.domain_created',
  'sven.service.domain_activated': 'service.domain_activated',
  'sven.service.deployed': 'service.deployed',
  'sven.service.domain_archived': 'service.domain_archived',
  'sven.research.lab_founded': 'research.lab_founded',
  'sven.research.project_started': 'research.project_started',
  'sven.research.paper_published': 'research.paper_published',
  'sven.research.dataset_released': 'research.dataset_released',
  'sven.integration.platform_discovered': 'integration.platform_discovered',
  'sven.integration.agent_built': 'integration.agent_built',
  'sven.integration.agent_evolved': 'integration.agent_evolved',
  'sven.integration.subscription_created': 'integration.subscription_created',
  'sven.collaboration.proposed': 'collaboration.proposed',
  'sven.collaboration.completed': 'collaboration.completed',
  'sven.team.formed': 'team.formed',
  'sven.social.interaction': 'social.interaction',
  'sven.revenue.snapshot': 'revenue.snapshot',
  'sven.revenue.alert': 'revenue.alert',
  'sven.goal.updated': 'goal.updated',
  'sven.dashboard.refreshed': 'dashboard.refreshed',
  'sven.reputation.reviewed': 'reputation.reviewed',
  'sven.reputation.promoted': 'reputation.promoted',
  'sven.trust.established': 'trust.established',
  'sven.badge.awarded': 'badge.awarded',
  'sven.governance.proposal_created': 'governance.proposal_created',
  'sven.governance.vote_cast': 'governance.vote_cast',
  'sven.governance.proposal_passed': 'governance.proposal_passed',
  'sven.governance.council_formed': 'governance.council_formed',
  'sven.health.check_completed': 'health.check_completed',
  'sven.health.recovery_triggered': 'health.recovery_triggered',
  'sven.lifecycle.state_changed': 'lifecycle.state_changed',
  'sven.lifecycle.agent_retired': 'lifecycle.agent_retired',
  'sven.task.queued': 'task.queued',
  'sven.task.assigned': 'task.assigned',
  'sven.task.completed': 'task.completed',
  'sven.task.schedule_triggered': 'task.schedule_triggered',
  'sven.workflow.created': 'workflow.created',
  'sven.workflow.run_started': 'workflow.run_started',
  'sven.workflow.run_completed': 'workflow.run_completed',
  'sven.workflow.step_failed': 'workflow.step_failed',
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
