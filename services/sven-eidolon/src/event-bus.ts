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
  'sven.analytics.snapshot_generated': 'analytics.snapshot_generated',
  'sven.analytics.health_alert': 'analytics.health_alert',
  'sven.analytics.trend_detected': 'analytics.trend_detected',
  'sven.analytics.productivity_scored': 'analytics.productivity_scored',
  'sven.deployment.pipeline_started': 'deployment.pipeline_started',
  'sven.deployment.stage_completed': 'deployment.stage_completed',
  'sven.deployment.deployed': 'deployment.deployed',
  'sven.deployment.rollback_initiated': 'deployment.rollback_initiated',
  'sven.billing.account_created': 'billing.account_created',
  'sven.billing.invoice_generated': 'billing.invoice_generated',
  'sven.billing.payment_received': 'billing.payment_received',
  'sven.billing.credit_adjusted': 'billing.credit_adjusted',
  'sven.contract.created': 'contract.created',
  'sven.contract.sla_breached': 'contract.sla_breached',
  'sven.contract.dispute_raised': 'contract.dispute_raised',
  'sven.contract.dispute_resolved': 'contract.dispute_resolved',
  'sven.knowledge.article_created': 'knowledge.article_created',
  'sven.knowledge.article_published': 'knowledge.article_published',
  'sven.knowledge.article_archived': 'knowledge.article_archived',
  'sven.knowledge.feedback_received': 'knowledge.feedback_received',
  'sven.notifications.notification_sent': 'notifications.notification_sent',
  'sven.notifications.notification_read': 'notifications.notification_read',
  'sven.notifications.escalation_triggered': 'notifications.escalation_triggered',
  'sven.notifications.digest_generated': 'notifications.digest_generated',
  'sven.scheduling.schedule_fired': 'scheduling.schedule_fired',
  'sven.scheduling.event_created': 'scheduling.event_created',
  'sven.scheduling.slot_booked': 'scheduling.slot_booked',
  'sven.scheduling.trigger_executed': 'scheduling.trigger_executed',
  'sven.resources.pool_created': 'resources.pool_created',
  'sven.resources.allocation_granted': 'resources.allocation_granted',
  'sven.resources.quota_exceeded': 'resources.quota_exceeded',
  'sven.resources.scaling_triggered': 'resources.scaling_triggered',
  'sven.compliance.policy_created': 'compliance.policy_created',
  'sven.compliance.check_completed': 'compliance.check_completed',
  'sven.compliance.violation_detected': 'compliance.violation_detected',
  'sven.compliance.report_generated': 'compliance.report_generated',
  'sven.reviews.review_submitted': 'reviews.review_submitted',
  'sven.reviews.response_posted': 'reviews.response_posted',
  'sven.reviews.review_moderated': 'reviews.review_moderated',
  'sven.reviews.analytics_generated': 'reviews.analytics_generated',
  'sven.messaging.channel_created': 'messaging.channel_created',
  'sven.messaging.message_sent': 'messaging.message_sent',
  'sven.messaging.presence_changed': 'messaging.presence_changed',
  'sven.messaging.broadcast_sent': 'messaging.broadcast_sent',
  'sven.monitoring.metric_recorded': 'monitoring.metric_recorded',
  'sven.monitoring.alert_fired': 'monitoring.alert_fired',
  'sven.monitoring.slo_breached': 'monitoring.slo_breached',
  'sven.monitoring.dashboard_updated': 'monitoring.dashboard_updated',
  'sven.backup.job_created': 'backup.job_created',
  'sven.backup.restore_completed': 'backup.restore_completed',
  'sven.backup.dr_plan_tested': 'backup.dr_plan_tested',
  'sven.backup.retention_applied': 'backup.retention_applied',
  'sven.acl.role_assigned': 'acl.role_assigned',
  'sven.acl.permission_granted': 'acl.permission_granted',
  'sven.acl.access_denied': 'acl.access_denied',
  'sven.acl.policy_evaluated': 'acl.policy_evaluated',
  'sven.feedback.submitted': 'feedback.submitted',
  'sven.feedback.survey_created': 'feedback.survey_created',
  'sven.feedback.response_received': 'feedback.response_received',
  'sven.feedback.improvement_proposed': 'feedback.improvement_proposed',
  'sven.recommend.generated': 'recommend.generated',
  'sven.recommend.model_trained': 'recommend.model_trained',
  'sven.recommend.interaction_recorded': 'recommend.interaction_recorded',
  'sven.recommend.campaign_launched': 'recommend.campaign_launched',
  'sven.versioning.version_created': 'versioning.version_created',
  'sven.versioning.snapshot_taken': 'versioning.snapshot_taken',
  'sven.versioning.rollback_initiated': 'versioning.rollback_initiated',
  'sven.versioning.version_promoted': 'versioning.version_promoted',
  'sven.secrets.secret_stored': 'secrets.secret_stored',
  'sven.secrets.secret_rotated': 'secrets.secret_rotated',
  'sven.secrets.access_logged': 'secrets.access_logged',
  'sven.secrets.policy_enforced': 'secrets.policy_enforced',
  'sven.flags.flag_toggled': 'flags.flag_toggled',
  'sven.flags.experiment_started': 'flags.experiment_started',
  'sven.flags.variant_assigned': 'flags.variant_assigned',
  'sven.flags.experiment_concluded': 'flags.experiment_concluded',
  'sven.data_transfer.export_created': 'data_transfer.export_created',
  'sven.data_transfer.import_created': 'data_transfer.import_created',
  'sven.data_transfer.transfer_completed': 'data_transfer.transfer_completed',
  'sven.data_transfer.schema_registered': 'data_transfer.schema_registered',
  'sven.rate_limit.policy_created': 'rate_limit.policy_created',
  'sven.rate_limit.agent_throttled': 'rate_limit.agent_throttled',
  'sven.rate_limit.quota_exceeded': 'rate_limit.quota_exceeded',
  'sven.rate_limit.override_granted': 'rate_limit.override_granted',
  'sven.locale.locale_created': 'locale.locale_created',
  'sven.locale.translation_approved': 'locale.translation_approved',
  'sven.locale.content_localized': 'locale.content_localized',
  'sven.locale.coverage_updated': 'locale.coverage_updated',
  'sven.webhook.endpoint_registered': 'webhook.endpoint_registered',
  'sven.webhook.delivery_completed': 'webhook.delivery_completed',
  'sven.webhook.integration_connected': 'webhook.integration_connected',
  'sven.webhook.delivery_failed': 'webhook.delivery_failed',
  'sven.config.profile_created': 'config.profile_created',
  'sven.config.variable_updated': 'config.variable_updated',
  'sven.config.snapshot_taken': 'config.snapshot_taken',
  'sven.config.template_applied': 'config.template_applied',
  'sven.pipeline.template_created': 'pipeline.template_created',
  'sven.pipeline.instance_launched': 'pipeline.instance_launched',
  'sven.pipeline.stage_completed': 'pipeline.stage_completed',
  'sven.pipeline.pipeline_finished': 'pipeline.pipeline_finished',
  'sven.cache.policy_created': 'cache.policy_created',
  'sven.cache.entry_invalidated': 'cache.entry_invalidated',
  'sven.cache.cdn_deployed': 'cache.cdn_deployed',
  'sven.cache.purge_completed': 'cache.purge_completed',
  'sven.gateway.route_created': 'gateway.route_created',
  'sven.gateway.policy_attached': 'gateway.policy_attached',
  'sven.gateway.traffic_spike': 'gateway.traffic_spike',
  'sven.gateway.circuit_opened': 'gateway.circuit_opened',
  'sven.log.stream_created': 'log.stream_created',
  'sven.log.entry_ingested': 'log.entry_ingested',
  'sven.log.alert_triggered': 'log.alert_triggered',
  'sven.log.dashboard_updated': 'log.dashboard_updated',
  'sven.mesh.service_registered': 'mesh.service_registered',
  'sven.mesh.health_changed': 'mesh.health_changed',
  'sven.mesh.dependency_mapped': 'mesh.dependency_mapped',
  'sven.mesh.traffic_routed': 'mesh.traffic_routed',
  'sven.cost.budget_created': 'cost.budget_created',
  'sven.cost.spend_recorded': 'cost.spend_recorded',
  'sven.cost.alert_triggered': 'cost.alert_triggered',
  'sven.cost.recommendation_made': 'cost.recommendation_made',
  'sven.tenant.created': 'tenant.created',
  'sven.tenant.member_joined': 'tenant.member_joined',
  'sven.tenant.quota_exceeded': 'tenant.quota_exceeded',
  'sven.tenant.plan_upgraded': 'tenant.plan_upgraded',
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
