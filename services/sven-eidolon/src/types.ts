// ---------------------------------------------------------------------------
// Eidolon types — 3D city projection of Sven's autonomous economy
// ---------------------------------------------------------------------------
// All coordinates are deterministic from the entity id (djb2 hash) so the
// city layout is stable across snapshots without requiring layout state in
// the DB. UI is free to re-map, but these defaults keep terminals + 3D in
// sync for debugging.
// ---------------------------------------------------------------------------

export type EidolonBuildingKind =
  | 'marketplace_listing'
  | 'revenue_service'
  | 'infra_node'
  | 'treasury_vault'
  | 'agent_business'
  | 'crew_headquarters'
  | 'publishing_house'
  | 'recruitment_center'
  | 'print_works'
  | 'media_studio'
  | 'xlvii_storefront'
  | 'memory_vault'
  | 'gpu_cluster'
  | 'evolution_lab'
  | 'skill_academy'
  | 'video_studio'
  | 'avatar_gallery'
  | 'training_lab'
  | 'tutoring_center'
  | 'service_portal'
  | 'research_campus'
  | 'integration_hub'
  | 'collaboration_hub'
  | 'analytics_tower'
  | 'reputation_monument'
  | 'council_chamber'
  | 'medical_bay'
  | 'dispatch_center'
  | 'automation_factory'
  | 'analytics_observatory'
  | 'deployment_center'
  | 'billing_office'
  | 'contract_hall'
  | 'knowledge_library'
  | 'notification_tower'
  | 'schedule_clocktower'
  | 'resource_depot'
  | 'compliance_courthouse'
  | 'review_forum'
  | 'comm_tower'
  | 'observatory_tower'
  | 'vault_bunker'
  | 'access_gate'
  | 'feedback_plaza'
  | 'recommendation_engine'
  | 'version_vault'
  | 'secret_vault'
  | 'experiment_lab'
  | 'data_warehouse'
  | 'rate_limiter'
  | 'translation_hub'
  | 'webhook_relay'
  | 'config_vault'
  | 'pipeline_forge'
  | 'cache_tower'
  | 'api_gateway'
  | 'log_archive'
  | 'mesh_nexus'
  | 'cost_center'
  | 'tenant_hub'
  | 'incident_center'
  | 'queue_exchange'
  | 'session_hub'
  | 'plugin_forge'
  | 'moderation_hall';

export interface EidolonBuilding {
  id: string;
  kind: EidolonBuildingKind;
  label: string;
  district: string;
  position: { x: number; z: number };
  height: number;
  glow: number;
  status: 'ok' | 'degraded' | 'down' | 'idle';
  metrics: {
    revenueUsd?: number;
    salesCount?: number;
    cpuPct?: number;
    memPct?: number;
  };
}

export interface EidolonCitizen {
  id: string;
  label: string;
  role: 'pipeline' | 'worker' | 'scout' | 'treasurer' | 'operator' | 'seller' | 'translator' | 'writer' | 'accountant' | 'marketer' | 'researcher' | 'counsel' | 'designer' | 'support' | 'strategist' | 'recruiter';
  position: { x: number; z: number };
  homeBuildingId: string | null;
  status: 'idle' | 'working' | 'earning' | 'retiring';
  earningsUsd: number;
  archetype?: string;
  bio?: string;
  avatarUrl?: string;
  specializations?: string[];
}

export interface EidolonTreasurySummary {
  totalBalanceUsd: number;
  byKind: Record<string, number>;
  lastSettlementAt: string | null;
  openApprovals: number;
}

export type ParcelZone = 'residential' | 'commercial' | 'workshop' | 'laboratory' | 'farm' | 'outpost' | 'estate';
export type ParcelSize = 'small' | 'medium' | 'large' | 'estate';
export type AgentLocation =
  | 'parcel' | 'city_market' | 'city_treasury' | 'city_infra'
  | 'city_revenue' | 'city_centre' | 'travelling' | 'away';

export interface EidolonParcel {
  id: string;
  agentId: string;
  zone: ParcelZone;
  gridX: number;
  gridZ: number;
  parcelSize: ParcelSize;
  structures: Array<{ type: string; label: string; level: number; builtAt: string }>;
  decorations: Array<Record<string, unknown>>;
  upgrades: Record<string, unknown>;
  currentLocation: AgentLocation;
  lastCityVisit: string | null;
  totalCityVisits: number;
  landValue: number;
  tokenInvested: number;
  acquiredAt: string;
}

export interface EidolonSnapshot {
  generatedAt: string;
  buildings: EidolonBuilding[];
  citizens: EidolonCitizen[];
  parcels: EidolonParcel[];
  treasury: EidolonTreasurySummary;
  meta: {
    version: string;
    districts: string[];
    totalParcels: number;
    agentsInCity: number;
    agentsOnParcels: number;
  };
}

export type EidolonEventKind =
  | 'market.listing_published'
  | 'market.order_paid'
  | 'market.fulfilled'
  | 'market.refunded'
  | 'market.task_created'
  | 'market.task_completed'
  | 'treasury.credit'
  | 'treasury.debit'
  | 'agent.spawned'
  | 'agent.retired'
  | 'agent.profile_updated'
  | 'agent.tokens_earned'
  | 'agent.moved'
  | 'agent.built_structure'
  | 'agent.parcel_acquired'
  | 'goal.progress'
  | 'goal.completed'
  | 'agent.business_created'
  | 'agent.business_activated'
  | 'agent.business_deactivated'
  | 'crew.created'
  | 'crew.member_added'
  | 'agent.anomaly_detected'
  | 'agent.report_generated'
  | 'oversight.command_issued'
  | 'agent.message_sent'
  | 'publishing.project_created'
  | 'publishing.stage_advanced'
  | 'publishing.review_submitted'
  | 'publishing.book_published'
  | 'agent.avatar_changed'
  | 'world.tick'
  | 'world.parcel_interaction'
  | 'infra.node_change'
  | 'misiuni.task_created'
  | 'misiuni.bid_accepted'
  | 'misiuni.proof_submitted'
  | 'misiuni.task_verified'
  | 'misiuni.payment_released'
  | 'publishing.print_order_created'
  | 'publishing.print_order_shipped'
  | 'publishing.legal_requirement_added'
  | 'publishing.genre_trend_discovered'
  | 'publishing.author_persona_created'
  | 'publishing.printer_proposal_submitted'
  | 'social.account_connected'
  | 'social.post_created'
  | 'social.post_published'
  | 'social.campaign_started'
  | 'social.engagement_milestone'
  | 'xlvii.collection_created'
  | 'xlvii.product_created'
  | 'xlvii.design_created'
  | 'xlvii.design_approved'
  | 'xlvii.fulfillment_shipped'
  | 'council.session_started'
  | 'council.round_completed'
  | 'council.session_completed'
  | 'council.model_ranked'
  | 'memory.stored'
  | 'memory.recalled'
  | 'memory.compressed'
  | 'memory.decayed'
  | 'fleet.model_deployed'
  | 'fleet.model_evicted'
  | 'fleet.benchmark_completed'
  | 'fleet.vram_alert'
  | 'evolve.proposal_created'
  | 'evolve.experiment_started'
  | 'evolve.improvement_applied'
  | 'evolve.rollback_triggered'
  | 'skill.registered'
  | 'skill.imported'
  | 'skill.audited'
  | 'skill.promoted'
  | 'video.render_started'
  | 'video.render_completed'
  | 'video.template_created'
  | 'video.spec_generated'
  | 'identity.avatar_created'
  | 'identity.trait_evolved'
  | 'identity.mood_changed'
  | 'identity.item_acquired'
  | 'training.job_created'
  | 'training.epoch_completed'
  | 'training.job_finished'
  | 'training.export_registered'
  | 'academic.project_submitted'
  | 'academic.review_completed'
  | 'academic.project_delivered'
  | 'academic.citation_validated'
  | 'service.domain_created'
  | 'service.domain_activated'
  | 'service.deployed'
  | 'service.domain_archived'
  | 'research.lab_founded'
  | 'research.project_started'
  | 'research.paper_published'
  | 'research.dataset_released'
  | 'integration.platform_discovered'
  | 'integration.agent_built'
  | 'integration.agent_evolved'
  | 'integration.subscription_created'
  | 'collaboration.proposed'
  | 'collaboration.completed'
  | 'team.formed'
  | 'social.interaction'
  | 'revenue.snapshot'
  | 'revenue.alert'
  | 'goal.updated'
  | 'dashboard.refreshed'
  | 'reputation.reviewed'
  | 'reputation.promoted'
  | 'trust.established'
  | 'badge.awarded'
  | 'governance.proposal_created'
  | 'governance.vote_cast'
  | 'governance.proposal_passed'
  | 'governance.council_formed'
  | 'health.check_completed'
  | 'health.recovery_triggered'
  | 'lifecycle.state_changed'
  | 'lifecycle.agent_retired'
  | 'task.queued'
  | 'task.assigned'
  | 'task.completed'
  | 'task.schedule_triggered'
  | 'workflow.created'
  | 'workflow.run_started'
  | 'workflow.run_completed'
  | 'workflow.step_failed'
  | 'analytics.snapshot_generated'
  | 'analytics.health_alert'
  | 'analytics.trend_detected'
  | 'analytics.productivity_scored'
  | 'deployment.pipeline_started'
  | 'deployment.stage_completed'
  | 'deployment.deployed'
  | 'deployment.rollback_initiated'
  | 'billing.account_created'
  | 'billing.invoice_generated'
  | 'billing.payment_received'
  | 'billing.credit_adjusted'
  | 'contract.created'
  | 'contract.sla_breached'
  | 'contract.dispute_raised'
  | 'contract.dispute_resolved'
  | 'knowledge.article_created'
  | 'knowledge.article_published'
  | 'knowledge.article_archived'
  | 'knowledge.feedback_received'
  | 'notifications.notification_sent'
  | 'notifications.notification_read'
  | 'notifications.escalation_triggered'
  | 'notifications.digest_generated'
  | 'scheduling.schedule_fired'
  | 'scheduling.event_created'
  | 'scheduling.slot_booked'
  | 'scheduling.trigger_executed'
  | 'resources.pool_created'
  | 'resources.allocation_granted'
  | 'resources.quota_exceeded'
  | 'resources.scaling_triggered'
  | 'compliance.policy_created'
  | 'compliance.check_completed'
  | 'compliance.violation_detected'
  | 'compliance.report_generated'
  | 'reviews.review_submitted'
  | 'reviews.response_posted'
  | 'reviews.review_moderated'
  | 'reviews.analytics_generated'
  | 'messaging.channel_created'
  | 'messaging.message_sent'
  | 'messaging.presence_changed'
  | 'messaging.broadcast_sent'
  | 'monitoring.metric_recorded'
  | 'monitoring.alert_fired'
  | 'monitoring.slo_breached'
  | 'monitoring.dashboard_updated'
  | 'backup.job_created'
  | 'backup.restore_completed'
  | 'backup.dr_plan_tested'
  | 'backup.retention_applied'
  | 'acl.role_assigned'
  | 'acl.permission_granted'
  | 'acl.access_denied'
  | 'acl.policy_evaluated'
  | 'feedback.submitted'
  | 'feedback.survey_created'
  | 'feedback.response_received'
  | 'feedback.improvement_proposed'
  | 'recommend.generated'
  | 'recommend.model_trained'
  | 'recommend.interaction_recorded'
  | 'recommend.campaign_launched'
  | 'versioning.version_created'
  | 'versioning.snapshot_taken'
  | 'versioning.rollback_initiated'
  | 'versioning.version_promoted'
  | 'secrets.secret_stored'
  | 'secrets.secret_rotated'
  | 'secrets.access_logged'
  | 'secrets.policy_enforced'
  | 'flags.flag_toggled'
  | 'flags.experiment_started'
  | 'flags.variant_assigned'
  | 'flags.experiment_concluded'
  | 'data_transfer.export_created'
  | 'data_transfer.import_created'
  | 'data_transfer.transfer_completed'
  | 'data_transfer.schema_registered'
  | 'rate_limit.policy_created'
  | 'rate_limit.agent_throttled'
  | 'rate_limit.quota_exceeded'
  | 'rate_limit.override_granted'
  | 'locale.locale_created'
  | 'locale.translation_approved'
  | 'locale.content_localized'
  | 'locale.coverage_updated'
  | 'webhook.endpoint_registered'
  | 'webhook.delivery_completed'
  | 'webhook.integration_connected'
  | 'webhook.delivery_failed'
  | 'config.profile_created'
  | 'config.variable_updated'
  | 'config.snapshot_taken'
  | 'config.template_applied'
  | 'pipeline.template_created'
  | 'pipeline.instance_launched'
  | 'pipeline.stage_completed'
  | 'pipeline.pipeline_finished'
  | 'cache.policy_created'
  | 'cache.entry_invalidated'
  | 'cache.cdn_deployed'
  | 'cache.purge_completed'
  | 'gateway.route_created'
  | 'gateway.policy_attached'
  | 'gateway.traffic_spike'
  | 'gateway.circuit_opened'
  | 'log.stream_created'
  | 'log.entry_ingested'
  | 'log.alert_triggered'
  | 'log.dashboard_updated'
  | 'mesh.service_registered'
  | 'mesh.health_changed'
  | 'mesh.dependency_mapped'
  | 'mesh.traffic_routed'
  | 'cost.budget_created'
  | 'cost.spend_recorded'
  | 'cost.alert_triggered'
  | 'cost.recommendation_made'
  | 'tenant.created'
  | 'tenant.member_joined'
  | 'tenant.quota_exceeded'
  | 'tenant.plan_upgraded'
  | 'incident.created'
  | 'incident.escalated'
  | 'incident.resolved'
  | 'incident.postmortem_published'
  | 'queue.created'
  | 'queue.message_enqueued'
  | 'queue.message_completed'
  | 'queue.consumer_registered'
  | 'session.started'
  | 'session.handoff_initiated'
  | 'session.expired'
  | 'session.analytics_recorded'
  | 'plugin.registered'
  | 'plugin.installed'
  | 'plugin.hook_fired'
  | 'plugin.review_submitted'
  | 'moderation.content_screened'
  | 'moderation.verdict_rendered'
  | 'moderation.appeal_filed'
  | 'moderation.action_taken'
  | 'heartbeat';

export interface EidolonEvent {
  id: string;
  at: string;
  kind: EidolonEventKind;
  // Bounded, sanitised payload — never raw PII or free-form user text.
  payload: Record<string, string | number | boolean | null>;
}

// ---- Deterministic layout helpers ----------------------------------------

const DISTRICTS = ['market', 'revenue', 'infra', 'treasury'] as const;
export type District = (typeof DISTRICTS)[number];

export function listDistricts(): string[] {
  return [...DISTRICTS];
}

function djb2(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

const DISTRICT_CENTRES: Record<District, { cx: number; cz: number }> = {
  treasury: { cx: 0, cz: 0 },
  market: { cx: -80, cz: -40 },
  revenue: { cx: 80, cz: -40 },
  infra: { cx: 0, cz: 80 },
};

export function positionFor(entityId: string, district: District): { x: number; z: number } {
  const hash = djb2(`${district}:${entityId}`);
  const centre = DISTRICT_CENTRES[district];
  const ring = 20 + ((hash >>> 3) % 40);
  const angle = ((hash & 0x3ff) / 0x3ff) * Math.PI * 2;
  return {
    x: Math.round(centre.cx + Math.cos(angle) * ring),
    z: Math.round(centre.cz + Math.sin(angle) * ring),
  };
}

export function districtFor(kind: EidolonBuildingKind): District {
  switch (kind) {
    case 'marketplace_listing':
      return 'market';
    case 'revenue_service':
      return 'revenue';
    case 'infra_node':
      return 'infra';
    case 'treasury_vault':
      return 'treasury';
    case 'agent_business':
      return 'market';
    case 'crew_headquarters':
      return 'market'; // default; overridden per crew type in repo.ts
    case 'publishing_house':
      return 'market';
    case 'recruitment_center':
      return 'market';
    case 'print_works':
      return 'market';
    case 'media_studio':
      return 'market';
    case 'xlvii_storefront':
      return 'market';
    case 'memory_vault':
      return 'infrastructure';
    case 'gpu_cluster':
      return 'infrastructure';
    case 'evolution_lab':
      return 'infrastructure';
    case 'skill_academy':
      return 'infrastructure';
    case 'video_studio':
      return 'market';
    case 'avatar_gallery':
      return 'residential';
    case 'training_lab':
      return 'infrastructure';
    case 'tutoring_center':
      return 'market';
    case 'service_portal':
      return 'market';
    case 'research_campus':
      return 'infrastructure';
    case 'integration_hub':
      return 'infrastructure';
    case 'collaboration_hub':
      return 'residential';
    case 'analytics_tower':
      return 'market';
    case 'reputation_monument':
      return 'market';
    case 'council_chamber':
      return 'civic';
    case 'medical_bay':
      return 'residential';
    case 'dispatch_center':
      return 'industrial';
    case 'analytics_observatory':
      return 'market';
    case 'deployment_center':
      return 'market';
    case 'billing_office':
      return 'market';
    case 'contract_hall':
      return 'market';
    case 'knowledge_library':
      return 'civic';
    case 'automation_factory':
      return 'industrial';
    case 'notification_tower':
      return 'civic';
    case 'schedule_clocktower':
      return 'civic';
    case 'resource_depot':
      return 'industrial';
    case 'compliance_courthouse':
      return 'civic';
    case 'review_forum':
      return 'market';
    case 'comm_tower':
      return 'civic';
    case 'observatory_tower':
      return 'civic';
    case 'vault_bunker':
      return 'industrial';
    case 'access_gate':
    case 'feedback_plaza':
    case 'recommendation_engine':
    case 'version_vault':
    case 'secret_vault':
    case 'experiment_lab':
    case 'data_warehouse':
    case 'rate_limiter':
    case 'translation_hub':
    case 'webhook_relay':
    case 'config_vault':
    case 'pipeline_forge':
    case 'cache_tower':
    case 'api_gateway':
    case 'log_archive':
    case 'mesh_nexus':
    case 'cost_center':
    case 'tenant_hub':
    case 'incident_center':
    case 'queue_exchange':
    case 'session_hub':
    case 'plugin_forge':
    case 'moderation_hall':
      return 'civic';
  }
}
