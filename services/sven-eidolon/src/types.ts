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
  | 'auto_scaler'
  | 'dns_manager'
  | 'ssl_cert_manager'
  | 'chaos_engineer'
  | 'ab_tester'
  | 'container_registry'
  | 'graphql_gateway'
  | 'message_queue_hub'
  | 'canary_deployer'
  | 'db_replicator'
  | 'edge_node'
  | 'api_version_tower'
  | 'compliance_scanner'
  | 'backup_vault'
  | 'traffic_shaper' | 'service_mesh' | 'wan_optimizer' | 'link_aggregator' | 'protocol_gateway' | 'vlan_manager' | 'network_tap' | 'flow_collector' | 'sflow_agent' | 'netflow_exporter' | 'arp_inspector' | 'packet_sniffer' | 'bandwidth_monitor' | 'latency_probe' | 'jitter_analyzer' | 'packet_loss_tracker' | 'traffic_classifier' | 'qos_enforcer' | 'acl_auditor' | 'firewall_policy' | 'port_mapper'
  | 'cloud_provisioner'
  | 'vm_orchestrator'
  | 'registry_manager'
  | 'image_builder'
  | 'artifact_store'
  | 'pipeline_runner'
  | 'test_orchestrator'
  | 'deploy_manager'
  | 'rollback_controller'
  | 'release_gatekeeper'
  | 'metric_exporter'
  | 'log_shipper'
  | 'alert_manager'
  | 'incident_responder'
  | 'uptime_monitor'
  | 'schema_migrator'
  | 'query_tuner'
  | 'backup_scheduler'
  | 'replication_manager'
  | 'pool_manager'
  | 'vuln_scanner'
  | 'credential_rotator'
  | 'compliance_auditor'
  | 'rbac_controller'
  | 'policy_enforcer'
  | 'msg_relay'
  | 'stream_ingester'
  | 'event_router'
  | 'queue_manager'
  | 'pubsub_gateway'
  | 'container_builder'
  | 'image_registry'
  | 'orchestrator'
  | 'svc_mesh'
  | 'config_manager'
  | 'search_indexer'
  | 'analytics_engine'
  | 'data_lakehouse'
  | 'etl_pipeline'
  | 'report_generator'
  | 'network_router'
  | 'dns_gateway'
  | 'lb_orchestrator'
  | 'cdn_proxy'
  | 'rate_controller'
  | 'log_streamer'
  | 'metrics_hub'
  | 'event_correlator'
  | 'trace_collector'
  | 'dashboard_builder'
  | 'pentest_runner'
  | 'intrusion_guard'
  | 'rbac_enforcer'
  | 'siem_connector'
  | 'forensic_analyzer'
  | 'log_rotator'
  | 'ip_gatekeeper'
  | 'webhook_relay'
  | 'storage_tower'
  | 'peering_bridge'
  | 'container_yard'
  | 'mesh_nexus'
  | 'drift_scanner'
  | 'escalation_tower'
  | 'forecast_engine'
  | 'dns_registry'
  | 'cert_tower'
  | 'audit_hall'
  | 'rate_gate'
  | 'flag_tower'
  | 'health_beacon'
  | 'cost_bureau'
  | 'data_forge'
  | 'alert_hub'
  | 'geo_watchtower'
  | 'audit_archive'
  | 'change_bureau'
  | 'deploy_gateway'
  | 'asset_vault'
  | 'token_mint'
  | 'sandbox_chamber'
  | 'swarm_nexus'
  | 'consensus_forum'
  | 'anomaly_watchtower'
  | 'dep_graph_lab'
  | 'blueprint_forge'
  | 'signal_tower'
  | 'throttle_station'
  | 'sync_bridge'
  | 'mesh_router'
  | 'patch_workshop'
  | 'inventory_vault'
  | 'discovery_beacon'
  | 'federation_hub'
  | 'circuit_panel'
  | 'rate_gate'
  | 'canary_tower'
  | 'flag_control'
  | 'chaos_arena'
  | 'telemetry_hub'
  | 'cost_ledger'
  | 'net_firewall'
  | 'recovery_vault'
  | 'perf_lab'
  | 'sandbox_pod'
  | 'secret_rotator'
  | 'mirror_tap'
  | 'compliance_desk'
  | 'capacity_planner'
  | 'topology_grid'
  | 'forensic_lab'
  | 'patch_depot'
  | 'access_court'
  | 'release_station'
  | 'cost_watchtower'
  | 'remediation_forge'
  | 'correlation_hub'
  | 'webhook_station'
  | 'certificate_vault'
  | 'quota_gate'
  | 'runbook_forge'
  | 'network_scanner'
  | 'dns_tower'
  | 'inventory_depot'
  | 'patch_manager'
  | 'firewall_controller'
  | 'backup_orchestrator'
  | 'storage_optimizer'
  | 'health_monitor'
  | 'credential_manager'
  | 'certificate_manager'
  | 'vpn_gateway'
  | 'proxy_router'
  | 'access_controller'
  | 'log_aggregator'
  | 'metric_collector'
  | 'alert_dispatcher'
  | 'trace_analyzer'
  | 'config_validator'
  | 'service_registry'
  | 'ingress_controller'
  | 'fault_injector'
  | 'connection_pool'
  | 'retry_handler'
  | 'stream_processor'
  | 'schema_validator'
  | 'etl_processor'
  | 'data_catalog'
  | 'query_optimizer' | 'message_broker' | 'cache_manager' | 'traffic_router' | 'dns_resolver' | 'config_server' | 'network_monitor' | 'packet_analyzer' | 'bandwidth_controller' | 'firewall_manager' | 'proxy_server' | 'ssl_manager' | 'session_manager' | 'endpoint_resolver' | 'vulnerability_scanner' | 'traffic_analyzer' | 'identity_provider' | 'key_manager' | 'audit_logger' | 'compliance_checker' | 'threat_detector' | 'policy_engine' | 'data_classifier' | 'encryption_gateway' | 'security_scanner' | 'incident_manager' | 'access_auditor' | 'permission_manager' | 'token_validator' | 'session_enforcer' | 'network_firewall' | 'certificate_authority' | 'geo_locator' | 'ddos_protector' | 'api_gateway_manager' | 'endpoint_monitor' | 'proxy_manager' | 'vpn_provisioner' | 'bandwidth_optimizer' | 'latency_analyzer' | 'packet_inspector' | 'network_auditor' | 'connection_pooler' | 'ip_allocator' | 'port_scanner' | 'edge_router' | 'load_balancer' | 'health_checker' | 'reverse_proxy' | 'nat_gateway' | 'traffic_shaper' | 'service_mesh' | 'wan_optimizer' | 'link_aggregator' | 'protocol_gateway' | 'vlan_manager' | 'network_tap' | 'flow_collector' | 'sflow_agent' | 'netflow_exporter' | 'arp_inspector' | 'packet_sniffer' | 'bandwidth_monitor' | 'latency_probe' | 'jitter_analyzer' | 'packet_loss_tracker' | 'traffic_classifier' | 'qos_enforcer' | 'acl_auditor' | 'firewall_policy' | 'port_mapper'
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
  | 'moderation_hall'
  | 'discovery_beacon'
  | 'circuit_tower'
  | 'injection_forge'
  | 'state_engine'
  | 'delivery_hub'
  | 'search_archive'
  | 'event_ledger'
  | 'config_vault'
  | 'health_tower'
  | 'trace_nexus'
  | 'load_balancer'
  | 'validation_hub'
  | 'schema_registry'
  | 'workflow_factory'
  | 'rate_limiter'
  | 'auto_scaler'
  | 'dns_manager'
  | 'ssl_cert_manager'
  | 'chaos_engineer'
  | 'ab_tester'
  | 'container_registry'
  | 'graphql_gateway'
  | 'message_queue_hub'
  | 'canary_deployer'
  | 'db_replicator'
  | 'edge_node'
  | 'api_version_tower'
  | 'compliance_scanner'
  | 'backup_vault'
  | 'traffic_shaper' | 'service_mesh' | 'wan_optimizer' | 'link_aggregator' | 'protocol_gateway' | 'vlan_manager' | 'network_tap' | 'flow_collector' | 'sflow_agent' | 'netflow_exporter' | 'arp_inspector' | 'packet_sniffer' | 'bandwidth_monitor' | 'latency_probe' | 'jitter_analyzer' | 'packet_loss_tracker' | 'traffic_classifier' | 'qos_enforcer' | 'acl_auditor' | 'firewall_policy' | 'port_mapper';
  | 'log_rotator'
  | 'ip_gatekeeper'
  | 'webhook_relay'
  | 'storage_tower'
  | 'peering_bridge'

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
  | 'discovery.service_registered'
  | 'discovery.health_changed'
  | 'discovery.endpoint_cataloged'
  | 'discovery.dependency_mapped'
  | 'circuit.breaker_tripped'
  | 'circuit.breaker_reset'
  | 'circuit.fallback_invoked'
  | 'circuit.metrics_collected'
  | 'di.container_created'
  | 'di.binding_registered'
  | 'di.resolution_completed'
  | 'di.container_disposed'
  | 'statemachine.created'
  | 'statemachine.transitioned'
  | 'statemachine.completed'
  | 'statemachine.failed'
  | 'cdn.asset_published'
  | 'cdn.cache_purged'
  | 'cdn.origin_registered'
  | 'cdn.analytics_collected'
  | 'search.index_created'
  | 'search.query_executed'
  | 'search.reindex_completed'
  | 'search.relevance_tuned'
  | 'eventsource.event_appended'
  | 'eventsource.projection_created'
  | 'eventsource.snapshot_taken'
  | 'eventsource.replay_completed'
  | 'config.entry_updated'
  | 'config.namespace_created'
  | 'config.rollback_applied'
  | 'config.schema_validated'
  | 'health.check_completed'
  | 'health.threshold_breached'
  | 'health.alert_triggered'
  | 'health.dashboard_updated'
  | 'tracing.trace_started'
  | 'tracing.span_completed'
  | 'tracing.sampling_updated'
  | 'tracing.analysis_generated'
  | 'lb.instance_created'
  | 'lb.backend_added'
  | 'lb.backend_drained'
  | 'lb.rule_activated'
  | 'validation.schema_created'
  | 'validation.data_validated'
  | 'validation.pipeline_completed'
  | 'validation.audit_logged'
  | 'registry.schema_registered'
  | 'registry.version_published'
  | 'registry.compatibility_checked'
  | 'registry.schema_evolved'
  | 'workflow.template_created'
  | 'workflow.execution_started'
  | 'workflow.execution_completed'
  | 'workflow.trigger_fired'
  | 'ratelimit.policy_created'
  | 'ratelimit.quota_exceeded'
  | 'ratelimit.violation_detected'
  | 'ratelimit.violation_resolved'
  | 'autoscaling.policy_created'
  | 'autoscaling.scale_triggered'
  | 'autoscaling.scale_completed'
  | 'autoscaling.metric_recorded'
  | 'dns.zone_created'
  | 'dns.record_added'
  | 'dns.record_updated'
  | 'dns.propagation_complete'
  | 'ssl.cert_issued'
  | 'ssl.cert_renewed'
  | 'ssl.cert_expiring'
  | 'ssl.cert_revoked'
  | 'chaos.experiment_created'
  | 'chaos.fault_injected'
  | 'chaos.experiment_completed'
  | 'chaos.weakness_found'
  | 'telemetry.sink_created'
  | 'telemetry.pipeline_configured'
  | 'telemetry.batch_exported'
  | 'telemetry.sink_error'
  | 'costalloc.center_created'
  | 'costalloc.cost_recorded'
  | 'costalloc.report_generated'
  | 'costalloc.budget_exceeded'
  | 'netpolicy.rule_created'
  | 'netpolicy.traffic_denied'
  | 'netpolicy.segment_created'
  | 'netpolicy.audit_logged'
  | 'dr.plan_created'
  | 'dr.failover_triggered'
  | 'dr.drill_completed'
  | 'dr.checkpoint_stale'
  | 'perfprof.profile_started'
  | 'perfprof.bottleneck_found'
  | 'perfprof.baseline_set'
  | 'perfprof.trend_degrading'
  | 'sandbox.created'
  | 'sandbox.execution_started'
  | 'sandbox.violation_detected'
  | 'sandbox.terminated'
  | 'secretrot.policy_created'
  | 'secretrot.secret_rotated'
  | 'secretrot.rotation_failed'
  | 'secretrot.expiring_soon'
  | 'trafficmirror.mirror_created'
  | 'trafficmirror.diff_detected'
  | 'trafficmirror.replay_completed'
  | 'trafficmirror.mirror_stopped'
  | 'compliance.assessment_started'
  | 'compliance.finding_submitted'
  | 'compliance.report_generated'
  | 'compliance.framework_updated'
  | 'capacity.forecast_generated'
  | 'capacity.breach_warning'
  | 'capacity.action_proposed'
  | 'capacity.action_completed'
  | 'topology.scan_started' | 'topology.scan_completed' | 'topology.drift_detected' | 'topology.snapshot_created'
  | 'forensic.case_opened' | 'forensic.evidence_collected' | 'forensic.analysis_completed' | 'forensic.case_concluded'
  | 'patch.advisory_found' | 'patch.test_passed' | 'patch.deployed' | 'patch.rolled_back'
  | 'access.campaign_started' | 'access.review_completed' | 'access.permission_revoked' | 'access.compliance_reported'
  | 'release.train_planned' | 'release.gates_passed' | 'release.train_deployed' | 'release.train_rolled_back'
  | 'cost.budget_created' | 'cost.anomaly_detected' | 'cost.forecast_generated' | 'cost.budget_exceeded'
  | 'drift.baseline_set' | 'drift.drift_detected' | 'drift.remediation_applied' | 'drift.escalated'
  | 'logcorr.rule_triggered' | 'logcorr.incident_opened' | 'logcorr.root_cause_found' | 'logcorr.incident_resolved'
  | 'webhook.endpoint_registered' | 'webhook.delivery_sent' | 'webhook.delivery_failed' | 'webhook.retry_exhausted'
  | 'cert.certificate_imported' | 'cert.renewal_requested' | 'cert.renewal_completed' | 'cert.expiry_warning'
  | 'quota.policy_created' | 'quota.limit_reached' | 'quota.overage_detected' | 'quota.enforcement_applied'
  | 'runbook.runbook_triggered' | 'runbook.step_completed' | 'runbook.execution_finished' | 'runbook.approval_required'
  | 'netscan.scan_started' | 'netscan.host_discovered' | 'netscan.vulnerability_found' | 'netscan.scan_completed'
  | 'dns.zone_created' | 'dns.record_updated' | 'dns.health_check_failed' | 'dns.failover_triggered'
  | 'inventory.asset_discovered' | 'inventory.sync_completed' | 'inventory.conflict_detected' | 'inventory.asset_decommissioned'
  | 'patch.policy_created' | 'patch.release_approved' | 'patch.rollout_completed' | 'patch.compliance_failed'
  | 'firewall.ruleset_created' | 'firewall.rule_added' | 'firewall.threat_blocked' | 'firewall.audit_completed'
  | 'backup.plan_created' | 'backup.job_completed' | 'backup.restore_verified' | 'backup.retention_cleaned'
  | 'storage.analysis_completed' | 'storage.dedup_finished' | 'storage.tier_moved' | 'storage.savings_realized'
  | 'health.endpoint_added' | 'health.check_failed' | 'health.incident_opened' | 'health.incident_resolved'
  | 'credential.store_created' | 'credential.rotated' | 'credential.leaked' | 'credential.audit_completed'
  | 'certificate.ca_created' | 'certificate.issued' | 'certificate.renewed' | 'certificate.revoked'
  | 'vpn.network_created' | 'vpn.peer_connected' | 'vpn.session_established' | 'vpn.tunnel_failed'
  | 'proxy.upstream_added' | 'proxy.route_configured' | 'proxy.health_failed' | 'proxy.traffic_anomaly'
  | 'access.policy_created' | 'access.grant_issued' | 'access.grant_revoked' | 'access.violation_detected'
  | 'log.source_registered' | 'log.entry_ingested' | 'log.pipeline_created' | 'log.anomaly_detected'
  | 'metric.source_added' | 'metric.threshold_breached' | 'metric.alert_fired' | 'metric.trend_detected'
  | 'alert.channel_configured' | 'alert.dispatched' | 'alert.acknowledged' | 'alert.incident_resolved'
  | 'trace.config_created' | 'trace.span_collected' | 'trace.analysis_completed' | 'trace.bottleneck_found'
  | 'config.schema_created' | 'config.validation_passed' | 'config.drift_detected' | 'config.compliance_failed'
  | 'registry.service_registered' | 'registry.service_deregistered' | 'registry.health_changed' | 'registry.endpoint_added'
  | 'ingress.rule_created' | 'ingress.cert_issued' | 'ingress.traffic_spike' | 'ingress.rate_limited'
  | 'fault.experiment_started' | 'fault.experiment_completed' | 'fault.observation_recorded' | 'fault.report_generated'
  | 'pool.created' | 'pool.exhausted' | 'pool.health_degraded' | 'pool.connection_error'
  | 'retry.policy_created' | 'retry.attempt_failed' | 'retry.exhausted' | 'retry.dlq_entry_added'
  | 'stream.source_created' | 'stream.source_active' | 'stream.source_error' | 'stream.sink_delivered'
  | 'schema.definition_created' | 'schema.validation_failed' | 'schema.evolution_checked' | 'schema.compatibility_broken'
  | 'etl.pipeline_created' | 'etl.run_started' | 'etl.run_completed' | 'etl.run_failed'
  | 'catalog.asset_registered' | 'catalog.lineage_traced' | 'catalog.profile_completed' | 'catalog.quality_scored'
  | 'query.analyzed' | 'query.suggestion_generated' | 'query.plan_cached' | 'query.optimization_applied' | 'broker.connection_established' | 'broker.topic_created' | 'broker.subscription_added' | 'broker.message_published' | 'cache.store_provisioned' | 'cache.policy_configured' | 'cache.warmup_completed' | 'cache.invalidation_triggered' | 'traffic.route_created' | 'traffic.rule_applied' | 'traffic.canary_deployed' | 'traffic.analytics_generated' | 'dns.zone_created' | 'dns.record_updated' | 'dns.dnssec_enabled' | 'dns.propagation_verified' | 'config.namespace_created' | 'config.entry_updated' | 'config.secret_encrypted' | 'config.rollback_executed' | 'monitor.check_executed' | 'monitor.alert_triggered' | 'monitor.metric_recorded' | 'monitor.uptime_reported' | 'packet.capture_started' | 'packet.analysis_completed' | 'packet.rule_created' | 'packet.anomaly_detected' | 'bandwidth.policy_created' | 'bandwidth.quota_set' | 'bandwidth.usage_reported' | 'bandwidth.throttle_applied' | 'firewall.ruleset_created' | 'firewall.rule_added' | 'firewall.traffic_evaluated' | 'firewall.threat_detected' | 'proxy.endpoint_created' | 'proxy.access_rule_added' | 'proxy.cache_configured' | 'proxy.traffic_logged' | 'ssl.certificate_issued' | 'ssl.renewal_initiated' | 'ssl.audit_completed' | 'ssl.certificate_revoked' | 'session.created' | 'session.refreshed' | 'session.terminated' | 'session.policy_applied' | 'endpoint.registered' | 'endpoint.health_checked' | 'endpoint.routing_configured' | 'endpoint.deregistered' | 'vuln.scan_completed' | 'vuln.cve_detected' | 'vuln.remediation_applied' | 'vuln.compliance_verified' | 'traffic.capture_started' | 'traffic.pattern_detected' | 'traffic.report_generated' | 'traffic.threat_identified' | 'identity.provider_configured' | 'identity.session_created' | 'identity.mapping_updated' | 'identity.authentication_completed' | 'key.generated' | 'key.rotated' | 'key.revoked' | 'key.usage_logged' | 'audit.log_created' | 'audit.policy_updated' | 'audit.alert_triggered' | 'audit.retention_applied' | 'compliance.framework_added' | 'compliance.check_completed' | 'compliance.report_generated' | 'compliance.violation_detected' | 'threat.rule_created' | 'threat.detected' | 'threat.response_executed' | 'threat.mitigated' | 'policy.created' | 'policy.evaluated' | 'policy.exception_granted' | 'policy.enforcement_changed' | 'data.classified' | 'data.rule_created' | 'data.lineage_tracked' | 'data.reclassified' | 'encryption.channel_created' | 'encryption.operation_performed' | 'encryption.certificate_managed' | 'encryption.keys_rotated' | 'scan.profile_created' | 'scan.completed' | 'scan.remediation_applied' | 'scan.scheduled' | 'incident.created' | 'incident.responded' | 'incident.resolved' | 'incident.postmortem_created' | 'access.logged' | 'access.pattern_detected' | 'access.alert_raised' | 'access.report_generated' | 'permission.role_created' | 'permission.role_assigned' | 'permission.checked' | 'permission.audit_completed' | 'token.config_created' | 'token.issued' | 'token.validated' | 'token.revoked' | 'session.policy_created' | 'session.enforced' | 'session.violation_detected' | 'session.terminated_enforced' | 'firewall_rule.created' | 'firewall_rule.zone_configured' | 'firewall_rule.log_analyzed' | 'firewall_rule.tested' | 'certificate.issued' | 'certificate.renewed' | 'certificate.revoked' | 'certificate.audited' | 'geo.lookup_completed' | 'geo.compliance_checked' | 'geo.restriction_updated' | 'geo.report_generated' | 'ddos.policy_created' | 'ddos.attack_detected' | 'ddos.incident_mitigated' | 'ddos.metrics_reviewed' | 'api_route.created' | 'api_route.consumer_managed' | 'api_route.traffic_analyzed' | 'api_route.versioned' | 'endpoint.added' | 'endpoint.health_checked' | 'endpoint.alert_raised' | 'endpoint.uptime_reported' | 'proxy.configured' | 'proxy.rule_added' | 'proxy.traffic_logged' | 'proxy.health_checked' | 'vpn.tunnel_created' | 'vpn.peer_added' | 'vpn.connection_established' | 'vpn.config_updated' | 'bandwidth.profile_created' | 'bandwidth.allocated' | 'bandwidth.metrics_collected' | 'bandwidth.optimized' | 'latency.target_added' | 'latency.measured' | 'latency.baseline_computed' | 'latency.anomaly_detected' | 'packet.policy_created' | 'packet.capture_started' | 'packet.anomaly_found' | 'packet.analysis_complete' | 'audit.scan_started' | 'audit.finding_added' | 'audit.report_generated' | 'audit.scan_completed' | 'pool.created' | 'pool.resized' | 'pool.drained' | 'pool.metrics_collected' | 'ipam.pool_created' | 'ipam.ip_allocated' | 'ipam.ip_released' | 'ipam.conflict_detected' | 'portscan.started' | 'portscan.completed' | 'portscan.service_detected' | 'portscan.risk_assessed' | 'edge.config_created' | 'edge.route_added' | 'edge.cache_configured' | 'edge.traffic_routed' | 'lb.config_created' | 'lb.backend_added' | 'lb.traffic_distributed' | 'lb.health_checked' | 'healthcheck.target_added' | 'healthcheck.check_completed' | 'healthcheck.incident_opened' | 'healthcheck.incident_resolved' | 'rproxy.config_created' | 'rproxy.upstream_added' | 'rproxy.request_routed' | 'rproxy.ssl_configured' | 'nat.gateway_created' | 'nat.rule_added' | 'nat.translation_logged' | 'nat.rule_removed' | 'shaper.policy_created' | 'shaper.rule_added' | 'shaper.stats_collected' | 'shaper.bandwidth_adjusted' | 'mesh.deployed' | 'mesh.service_registered' | 'mesh.rule_created' | 'mesh.topology_updated' | 'wan.optimizer_created' | 'wan.tunnel_established' | 'wan.savings_reported' | 'wan.metrics_exported' | 'lag.group_created' | 'lag.member_added' | 'lag.failover_triggered' | 'lag.stats_collected' | 'proto.gateway_created' | 'proto.mapping_added' | 'proto.message_translated' | 'proto.metrics_collected' | 'vlan.created' | 'vlan.port_assigned' | 'vlan.acl_applied' | 'vlan.topology_updated' | 'tap.session_started' | 'tap.session_stopped' | 'tap.filter_applied' | 'tap.packets_captured' | 'fc.collection_started' | 'fc.report_generated' | 'fc.anomaly_detected' | 'fc.top_talkers_updated' | 'sflow.sampling_started' | 'sflow.counters_polled' | 'sflow.sample_captured' | 'sflow.config_updated' | 'nf.export_started' | 'nf.template_refreshed' | 'nf.flows_exported' | 'nf.export_error' | 'arp.binding_added' | 'arp.violation_detected' | 'arp.spoof_blocked' | 'arp.trust_updated' | 'sniff.capture_started' | 'sniff.capture_stopped' | 'sniff.dissection_complete' | 'sniff.pcap_exported' | 'bw.sample_collected' | 'bw.threshold_exceeded' | 'bw.alert_triggered' | 'bw.utilization_reported' | 'lat.probe_completed' | 'lat.baseline_updated' | 'lat.threshold_exceeded' | 'lat.degradation_detected' | 'jit.sample_collected' | 'jit.report_generated' | 'jit.mos_degraded' | 'jit.quality_restored' | 'ploss.probe_completed' | 'ploss.loss_detected' | 'ploss.trend_updated' | 'ploss.alert_triggered' | 'tclass.flow_classified' | 'tclass.policy_applied' | 'tclass.signatures_updated' | 'tclass.report_generated' | 'qos.classes_configured' | 'qos.policy_applied' | 'qos.violation_detected' | 'qos.bandwidth_adjusted' | 'acl.audit_completed' | 'acl.shadow_detected' | 'acl.conflict_found' | 'acl.rules_optimized' | 'fwpol.change_proposed' | 'fwpol.change_applied' | 'fwpol.change_rolled_back' | 'fwpol.audit_completed' | 'pmap.scan_completed' | 'pmap.service_detected' | 'pmap.change_detected' | 'pmap.vuln_correlated'
  | 'cprov.resource_provisioned' | 'cprov.resource_destroyed' | 'cprov.cost_alert' | 'cprov.scale_triggered'
  | 'vmorch.vm_created' | 'vmorch.vm_migrated' | 'vmorch.snapshot_taken' | 'vmorch.vm_destroyed'
  | 'regmgr.repo_created' | 'regmgr.tag_pushed' | 'regmgr.retention_applied' | 'regmgr.vuln_found'
  | 'imgbld.build_started' | 'imgbld.build_completed' | 'imgbld.image_pushed' | 'imgbld.build_failed'
  | 'artstore.artifact_uploaded' | 'artstore.artifact_downloaded' | 'artstore.retention_applied' | 'artstore.access_audited' | 'plrun.pipeline_triggered' | 'plrun.stage_completed' | 'plrun.run_passed' | 'plrun.run_failed' | 'torch.suite_executed' | 'torch.failure_analyzed' | 'torch.coverage_tracked' | 'torch.report_exported' | 'dpmgr.deploy_initiated' | 'dpmgr.health_verified' | 'dpmgr.deploy_promoted' | 'dpmgr.instances_drained' | 'rbctl.rollback_initiated' | 'rbctl.snapshot_restored' | 'rbctl.rollback_verified' | 'rbctl.report_exported' | 'relgk.candidate_evaluated' | 'relgk.gate_checked' | 'relgk.release_promoted' | 'relgk.candidate_rejected' | 'mexp.metric_recorded' | 'mexp.alert_triggered' | 'mexp.dashboard_exported' | 'mexp.alerts_listed' | 'lship.pipeline_created' | 'lship.logs_shipped' | 'lship.health_checked' | 'lship.config_exported' | 'almgr.rule_created' | 'almgr.alert_fired' | 'almgr.incident_acknowledged' | 'almgr.incident_resolved' | 'incrs.incident_opened' | 'incrs.diagnosis_completed' | 'incrs.remediation_executed' | 'incrs.postmortem_exported' | 'uptm.endpoint_added' | 'uptm.check_completed' | 'uptm.uptime_reported' | 'uptm.sla_exported' | 'smig.migration_applied' | 'smig.migration_rolled_back' | 'smig.diff_generated' | 'smig.schema_optimized' | 'qtun.query_analyzed' | 'qtun.index_suggested' | 'qtun.optimization_applied' | 'qtun.report_exported' | 'bsched.backup_completed' | 'bsched.restore_completed' | 'bsched.retention_enforced' | 'bsched.schedule_updated' | 'rplmgr.node_added' | 'rplmgr.failover_completed' | 'rplmgr.lag_detected' | 'rplmgr.sync_verified' | 'plmgr.pool_configured' | 'plmgr.connections_drained' | 'plmgr.stats_recorded' | 'plmgr.pool_optimized' | 'vscan.scan_completed' | 'vscan.vuln_found' | 'vscan.vuln_patched' | 'vscan.report_exported' | 'crot.credential_rotated' | 'crot.rotation_scheduled' | 'crot.rotation_failed' | 'crot.vault_synced' | 'caud.audit_completed' | 'caud.control_checked' | 'caud.report_generated' | 'caud.remediation_applied' | 'rbac.role_created' | 'rbac.assignment_granted' | 'rbac.assignment_revoked' | 'rbac.access_denied' | 'penf.policy_evaluated' | 'penf.decision_logged' | 'penf.policy_updated' | 'penf.violation_detected' | 'mrel.channel_created' | 'mrel.message_relayed' | 'mrel.dlq_processed' | 'mrel.batch_flushed' | 'sing.partition_assigned' | 'sing.checkpoint_saved' | 'sing.lag_detected' | 'sing.rebalanced' | 'ertr.rule_created' | 'ertr.event_routed' | 'ertr.fanout_completed' | 'ertr.dead_lettered' | 'qmgr.queue_created' | 'qmgr.message_dequeued' | 'qmgr.depth_exceeded' | 'qmgr.metrics_recorded' | 'psgw.topic_created' | 'psgw.subscription_added' | 'psgw.message_published' | 'psgw.ack_timeout' | 'cbld.image_built' | 'cbld.layers_optimized' | 'cbld.scan_completed' | 'cbld.config_exported' | 'ireg.repo_created' | 'ireg.image_pushed' | 'ireg.gc_completed' | 'ireg.tags_listed' | 'orch.deployed' | 'orch.scaled' | 'orch.rolled_back' | 'orch.health_checked' | 'smsh.route_created' | 'smsh.policy_applied' | 'smsh.breaker_toggled' | 'smsh.traffic_shifted' | 'cfmg.config_set' | 'cfmg.config_retrieved' | 'cfmg.config_rolled_back' | 'cfmg.config_exported' | 'sidx.index_created' | 'sidx.docs_indexed' | 'sidx.query_executed' | 'sidx.index_optimized' | 'anle.dataset_created' | 'anle.query_executed' | 'anle.data_ingested' | 'anle.cache_hit' | 'dlkh.table_created' | 'dlkh.snapshot_taken' | 'dlkh.compaction_completed' | 'dlkh.data_loaded' | 'etlp.job_started' | 'etlp.job_completed' | 'etlp.job_failed' | 'etlp.rows_processed' | 'rgen.report_generated' | 'rgen.template_created' | 'rgen.report_scheduled' | 'rgen.report_exported' | 'nrtr.route_created' | 'nrtr.policy_applied' | 'nrtr.traffic_routed' | 'nrtr.failover_triggered' | 'dngw.domain_resolved' | 'dngw.record_created' | 'dngw.cache_warmed' | 'dngw.query_completed' | 'lbor.backend_added' | 'lbor.health_checked' | 'lbor.traffic_distributed' | 'lbor.backend_drained' | 'cdnp.cache_populated' | 'cdnp.content_purged' | 'cdnp.origin_configured' | 'cdnp.edge_optimized' | 'rtcl.rule_created' | 'rtcl.client_limited' | 'rtcl.limit_updated' | 'rtcl.client_blocked'
  | 'lgst.stream_created'
  | 'lgst.alert_triggered'
  | 'lgst.logs_exported'
  | 'lgst.retention_rotated'
  | 'mhub.metric_registered'
  | 'mhub.alert_fired'
  | 'mhub.metrics_exported'
  | 'mhub.window_aggregated'
  | 'evcr.pattern_detected'
  | 'evcr.incident_created'
  | 'evcr.root_cause_found'
  | 'evcr.incident_resolved'
  | 'trcl.trace_collected'
  | 'trcl.bottleneck_found'
  | 'trcl.service_mapped'
  | 'trcl.traces_exported'
  | 'dshb.panel_created'
  | 'dshb.snapshot_taken'
  | 'dshb.dashboard_shared'
  | 'dshb.template_imported'
  | 'pntr.scan_completed'
  | 'pntr.finding_verified'
  | 'pntr.report_generated'
  | 'pntr.retest_scheduled'
  | 'idgd.intrusion_detected'
  | 'idgd.source_blocked'
  | 'idgd.rule_triggered'
  | 'idgd.event_analyzed'
  | 'rbce.role_created'
  | 'rbce.role_assigned'
  | 'rbce.permission_checked'
  | 'rbce.assignment_revoked'
  | 'siem.events_ingested'
  | 'siem.event_enriched'
  | 'siem.dashboard_created'
  | 'siem.report_exported'
  | 'fran.case_created'
  | 'fran.evidence_collected'
  | 'fran.timeline_analyzed'
  | 'fran.case_closed'
  | 'abtest.experiment_created'
  | 'abtest.variant_assigned'
  | 'abtest.conversion_recorded'
  | 'abtest.experiment_concluded'
  | 'registry.image_pushed'
  | 'registry.scan_completed'
  | 'registry.retention_cleaned'
  | 'registry.vulnerability_found'
  | 'graphql.schema_published'
  | 'graphql.breaking_detected'
  | 'graphql.cache_configured'
  | 'graphql.operation_slow'
  | 'mq.queue_created'
  | 'mq.consumer_registered'
  | 'mq.dlq_threshold'
  | 'mq.message_redriven'
  | 'canary.release_started'
  | 'canary.traffic_shifted'
  | 'canary.promoted'
  | 'canary.rolled_back'
  | 'dbrepl.replica_added'
  | 'dbrepl.lag_alert'
  | 'dbrepl.failover_initiated'
  | 'dbrepl.failover_completed'
  | 'edge.node_provisioned'
  | 'edge.function_deployed'
  | 'edge.latency_alert'
  | 'edge.node_drained'
  | 'apiver.version_published'
  | 'apiver.endpoint_deprecated'
  | 'apiver.compat_checked'
  | 'apiver.version_sunset'
  | 'compliance.policy_created'
  | 'compliance.scan_completed'
  | 'compliance.remediation_assigned'
  | 'compliance.remediation_completed'
  | 'backup.schedule_created'
  | 'backup.snapshot_completed'
  | 'backup.restore_started'
  | 'backup.restore_completed'
  | 'traffic.rule_created'
  | 'traffic.bandwidth_throttled'
  | 'traffic.qos_applied'
  | 'traffic.usage_report'
  | 'logrot.policy_created'
  | 'logrot.logs_archived'
  | 'logrot.retention_completed'
  | 'logrot.storage_report'
  | 'ipallow.list_created'
  | 'ipallow.rule_added'
  | 'ipallow.ip_blocked'
  | 'ipallow.access_report'
  | 'webhook.endpoint_registered'
  | 'webhook.delivery_succeeded'
  | 'webhook.delivery_failed'
  | 'webhook.dead_letter_created'
  | 'storage_tier.tier_created'
  | 'storage_tier.migration_started'
  | 'storage_tier.migration_completed'
  | 'storage_tier.cost_report'
  | 'peering.connection_established'
  | 'peering.route_added'
  | 'peering.gateway_created'
  | 'peering.status_report'
  | 'container_registry.create'
  | 'container_registry.push_image'
  | 'container_registry.scan_vulns'
  | 'container_registry.status_report'
  | 'service_mesh.register'
  | 'service_mesh.create_route'
  | 'service_mesh.create_policy'
  | 'service_mesh.status_report'
  | 'config_drift.create_baseline'
  | 'config_drift.run_scan'
  | 'config_drift.remediate'
  | 'config_drift.status_report'
  | 'incident.create_policy'
  | 'incident.open'
  | 'incident.escalate'
  | 'incident.resolve'
  | 'incident.status_report'
  | 'capacity.create_model'
  | 'capacity.generate_forecast'
  | 'capacity.check_alerts'
  | 'capacity.status_report'
  | 'dns.zone_created' | 'dns.record_created' | 'dns.record_updated' | 'dns.zone_report'
  | 'cert.provisioned' | 'cert.renewed' | 'cert.deployed' | 'cert.expiry_warning'
  | 'vault.secret_stored' | 'vault.secret_rotated' | 'vault.access_logged' | 'vault.sealed'
  | 'compliance.framework_created' | 'compliance.control_assessed' | 'compliance.audit_completed' | 'compliance.finding_reported'
  | 'ratelimit.policy_created' | 'ratelimit.request_blocked' | 'ratelimit.override_added' | 'ratelimit.status_report'
  | 'featureflag.flag_created' | 'featureflag.flag_toggled' | 'featureflag.rollout_changed' | 'featureflag.flag_evaluated'
  | 'healthmon.check_created' | 'healthmon.status_changed' | 'healthmon.sla_breached' | 'healthmon.uptime_report'
  | 'costopt.report_generated' | 'costopt.recommendation_created' | 'costopt.budget_exceeded' | 'costopt.savings_applied'
  | 'datapipe.pipeline_created' | 'datapipe.run_started' | 'datapipe.run_completed' | 'datapipe.transform_added'
  | 'notifrouter.channel_created' | 'notifrouter.notification_sent' | 'notifrouter.escalation_triggered' | 'notifrouter.delivery_failed'
  | 'geofence.zone_created' | 'geofence.rule_triggered' | 'geofence.alert_fired' | 'geofence.policy_updated'
  | 'audittrail.entry_logged' | 'audittrail.snapshot_taken' | 'audittrail.retention_applied' | 'audittrail.search_completed'
  | 'changemgmt.request_submitted' | 'changemgmt.approval_decided' | 'changemgmt.change_completed' | 'changemgmt.rollback_initiated'
  | 'bluegreen.version_deployed' | 'bluegreen.stage_switched' | 'bluegreen.traffic_shifted' | 'bluegreen.rollback_triggered'
  | 'assetmgmt.asset_registered' | 'assetmgmt.asset_transferred' | 'assetmgmt.license_granted' | 'assetmgmt.asset_deprecated'
  | 'tokenmint.token_defined' | 'tokenmint.tokens_minted' | 'tokenmint.tokens_burned' | 'tokenmint.balance_updated'
  | 'sandbox.env_provisioned' | 'sandbox.execution_completed' | 'sandbox.violation_detected' | 'sandbox.env_terminated'
  | 'swarm.cluster_formed' | 'swarm.member_joined' | 'swarm.task_distributed' | 'swarm.cluster_dissolved'
  | 'consensus.proposal_created' | 'consensus.vote_cast' | 'consensus.quorum_reached' | 'consensus.proposal_executed'
  | 'anomaly.detector_created' | 'anomaly.anomaly_detected' | 'anomaly.anomaly_resolved' | 'anomaly.baseline_updated'
  | 'depgraph.graph_created' | 'depgraph.node_added' | 'depgraph.edge_added' | 'depgraph.analysis_completed'
  | 'blueprint.created' | 'blueprint.validated' | 'blueprint.instantiated' | 'blueprint.deprecated'
  | 'signal.sent' | 'signal.delivered' | 'signal.acknowledged' | 'signal.expired'
  | 'throttle.rule_created' | 'throttle.request_throttled' | 'throttle.circuit_opened' | 'throttle.circuit_closed'
  | 'statesync.peer_created' | 'statesync.state_pushed' | 'statesync.state_pulled' | 'statesync.conflict_resolved'
  | 'meshroute.table_created' | 'meshroute.route_added' | 'meshroute.route_evaluated' | 'meshroute.health_updated'
  | 'hotpatch.patch_created' | 'hotpatch.patch_applied' | 'hotpatch.patch_rolled_back' | 'hotpatch.chain_executed'
  | 'inventory.item_acquired' | 'inventory.item_consumed' | 'inventory.item_transferred' | 'inventory.reservation_created'
  | 'discovery.service_registered' | 'discovery.probe_completed' | 'discovery.service_unhealthy' | 'discovery.dependency_mapped'
  | 'federation.peer_registered' | 'federation.link_created' | 'federation.message_sent' | 'federation.state_synced'
  | 'circuit.breaker_created' | 'circuit.state_changed' | 'circuit.trip_recorded' | 'circuit.metrics_collected'
  | 'ratelimit.limiter_created' | 'ratelimit.tokens_consumed' | 'ratelimit.violation_recorded' | 'ratelimit.bucket_refilled'
  | 'canary.deploy_created' | 'canary.traffic_adjusted' | 'canary.metrics_collected' | 'canary.decision_made'
  | 'featureflag.flag_created' | 'featureflag.flag_toggled' | 'featureflag.rule_added' | 'featureflag.flag_evaluated'
  | 'chaos.experiment_created' | 'chaos.fault_injected' | 'chaos.fault_removed' | 'chaos.experiment_completed'
  | 'telemetry.sink_created' | 'telemetry.pipeline_configured' | 'telemetry.batch_exported' | 'telemetry.sink_error'
  | 'costalloc.center_created' | 'costalloc.cost_recorded' | 'costalloc.report_generated' | 'costalloc.budget_exceeded'
  | 'netpolicy.rule_created' | 'netpolicy.traffic_denied' | 'netpolicy.segment_created' | 'netpolicy.audit_logged'
  | 'dr.plan_created' | 'dr.failover_triggered' | 'dr.drill_completed' | 'dr.checkpoint_stale'
  | 'perfprof.profile_started' | 'perfprof.bottleneck_found' | 'perfprof.baseline_set' | 'perfprof.trend_degrading'
  | 'sandbox.created' | 'sandbox.execution_started' | 'sandbox.violation_detected' | 'sandbox.terminated'
  | 'secretrot.policy_created' | 'secretrot.secret_rotated' | 'secretrot.rotation_failed' | 'secretrot.expiring_soon'
  | 'trafficmirror.mirror_created' | 'trafficmirror.diff_detected' | 'trafficmirror.replay_completed' | 'trafficmirror.mirror_stopped'
  | 'compliance.assessment_started' | 'compliance.finding_submitted' | 'compliance.report_generated' | 'compliance.framework_updated'
  | 'capacity.forecast_generated' | 'capacity.breach_warning' | 'capacity.action_proposed' | 'capacity.action_completed'
  | 'topology.scan_started' | 'topology.scan_completed' | 'topology.drift_detected' | 'topology.snapshot_created'
  | 'forensic.case_opened' | 'forensic.evidence_collected' | 'forensic.analysis_completed' | 'forensic.case_concluded'
  | 'patch.advisory_found' | 'patch.test_passed' | 'patch.deployed' | 'patch.rolled_back'
  | 'access.campaign_started' | 'access.review_completed' | 'access.permission_revoked' | 'access.compliance_reported'
  | 'release.train_planned' | 'release.gates_passed' | 'release.train_deployed' | 'release.train_rolled_back'
  | 'cost.budget_created' | 'cost.anomaly_detected' | 'cost.forecast_generated' | 'cost.budget_exceeded'
  | 'drift.baseline_set' | 'drift.drift_detected' | 'drift.remediation_applied' | 'drift.escalated'
  | 'logcorr.rule_triggered' | 'logcorr.incident_opened' | 'logcorr.root_cause_found' | 'logcorr.incident_resolved'
  | 'webhook.endpoint_registered' | 'webhook.delivery_sent' | 'webhook.delivery_failed' | 'webhook.retry_exhausted'
  | 'cert.certificate_imported' | 'cert.renewal_requested' | 'cert.renewal_completed' | 'cert.expiry_warning'
  | 'quota.policy_created' | 'quota.limit_reached' | 'quota.overage_detected' | 'quota.enforcement_applied'
  | 'runbook.runbook_triggered' | 'runbook.step_completed' | 'runbook.execution_finished' | 'runbook.approval_required'
  | 'netscan.scan_started' | 'netscan.host_discovered' | 'netscan.vulnerability_found' | 'netscan.scan_completed'
  | 'dns.zone_created' | 'dns.record_updated' | 'dns.health_check_failed' | 'dns.failover_triggered'
  | 'inventory.asset_discovered' | 'inventory.sync_completed' | 'inventory.conflict_detected' | 'inventory.asset_decommissioned'
  | 'patch.policy_created' | 'patch.release_approved' | 'patch.rollout_completed' | 'patch.compliance_failed'
  | 'firewall.ruleset_created' | 'firewall.rule_added' | 'firewall.threat_blocked' | 'firewall.audit_completed'
  | 'backup.plan_created' | 'backup.job_completed' | 'backup.restore_verified' | 'backup.retention_cleaned'
  | 'storage.analysis_completed' | 'storage.dedup_finished' | 'storage.tier_moved' | 'storage.savings_realized'
  | 'health.endpoint_added' | 'health.check_failed' | 'health.incident_opened' | 'health.incident_resolved'
  | 'credential.store_created' | 'credential.rotated' | 'credential.leaked' | 'credential.audit_completed'
  | 'certificate.ca_created' | 'certificate.issued' | 'certificate.renewed' | 'certificate.revoked'
  | 'vpn.network_created' | 'vpn.peer_connected' | 'vpn.session_established' | 'vpn.tunnel_failed'
  | 'proxy.upstream_added' | 'proxy.route_configured' | 'proxy.health_failed' | 'proxy.traffic_anomaly'
  | 'access.policy_created' | 'access.grant_issued' | 'access.grant_revoked' | 'access.violation_detected'
  | 'log.source_registered' | 'log.entry_ingested' | 'log.pipeline_created' | 'log.anomaly_detected'
  | 'metric.source_added' | 'metric.threshold_breached' | 'metric.alert_fired' | 'metric.trend_detected'
  | 'alert.channel_configured' | 'alert.dispatched' | 'alert.acknowledged' | 'alert.incident_resolved'
  | 'trace.config_created' | 'trace.span_collected' | 'trace.analysis_completed' | 'trace.bottleneck_found'
  | 'config.schema_created' | 'config.validation_passed' | 'config.drift_detected' | 'config.compliance_failed'
  | 'registry.service_registered' | 'registry.service_deregistered' | 'registry.health_changed' | 'registry.endpoint_added'
  | 'ingress.rule_created' | 'ingress.cert_issued' | 'ingress.traffic_spike' | 'ingress.rate_limited'
  | 'fault.experiment_started' | 'fault.experiment_completed' | 'fault.observation_recorded' | 'fault.report_generated'
  | 'pool.created' | 'pool.exhausted' | 'pool.health_degraded' | 'pool.connection_error'
  | 'retry.policy_created' | 'retry.attempt_failed' | 'retry.exhausted' | 'retry.dlq_entry_added'
  | 'stream.source_created' | 'stream.source_active' | 'stream.source_error' | 'stream.sink_delivered'
  | 'schema.definition_created' | 'schema.validation_failed' | 'schema.evolution_checked' | 'schema.compatibility_broken'
  | 'etl.pipeline_created' | 'etl.run_started' | 'etl.run_completed' | 'etl.run_failed'
  | 'catalog.asset_registered' | 'catalog.lineage_traced' | 'catalog.profile_completed' | 'catalog.quality_scored'
  | 'query.analyzed' | 'query.suggestion_generated' | 'query.plan_cached' | 'query.optimization_applied' | 'broker.connection_established' | 'broker.topic_created' | 'broker.subscription_added' | 'broker.message_published' | 'cache.store_provisioned' | 'cache.policy_configured' | 'cache.warmup_completed' | 'cache.invalidation_triggered' | 'traffic.route_created' | 'traffic.rule_applied' | 'traffic.canary_deployed' | 'traffic.analytics_generated' | 'dns.zone_created' | 'dns.record_updated' | 'dns.dnssec_enabled' | 'dns.propagation_verified' | 'config.namespace_created' | 'config.entry_updated' | 'config.secret_encrypted' | 'config.rollback_executed' | 'monitor.check_executed' | 'monitor.alert_triggered' | 'monitor.metric_recorded' | 'monitor.uptime_reported' | 'packet.capture_started' | 'packet.analysis_completed' | 'packet.rule_created' | 'packet.anomaly_detected' | 'bandwidth.policy_created' | 'bandwidth.quota_set' | 'bandwidth.usage_reported' | 'bandwidth.throttle_applied' | 'firewall.ruleset_created' | 'firewall.rule_added' | 'firewall.traffic_evaluated' | 'firewall.threat_detected' | 'proxy.endpoint_created' | 'proxy.access_rule_added' | 'proxy.cache_configured' | 'proxy.traffic_logged' | 'ssl.certificate_issued' | 'ssl.renewal_initiated' | 'ssl.audit_completed' | 'ssl.certificate_revoked' | 'session.created' | 'session.refreshed' | 'session.terminated' | 'session.policy_applied' | 'endpoint.registered' | 'endpoint.health_checked' | 'endpoint.routing_configured' | 'endpoint.deregistered' | 'vuln.scan_completed' | 'vuln.cve_detected' | 'vuln.remediation_applied' | 'vuln.compliance_verified' | 'traffic.capture_started' | 'traffic.pattern_detected' | 'traffic.report_generated' | 'traffic.threat_identified' | 'identity.provider_configured' | 'identity.session_created' | 'identity.mapping_updated' | 'identity.authentication_completed' | 'key.generated' | 'key.rotated' | 'key.revoked' | 'key.usage_logged' | 'audit.log_created' | 'audit.policy_updated' | 'audit.alert_triggered' | 'audit.retention_applied' | 'compliance.framework_added' | 'compliance.check_completed' | 'compliance.report_generated' | 'compliance.violation_detected' | 'threat.rule_created' | 'threat.detected' | 'threat.response_executed' | 'threat.mitigated' | 'policy.created' | 'policy.evaluated' | 'policy.exception_granted' | 'policy.enforcement_changed' | 'data.classified' | 'data.rule_created' | 'data.lineage_tracked' | 'data.reclassified' | 'encryption.channel_created' | 'encryption.operation_performed' | 'encryption.certificate_managed' | 'encryption.keys_rotated' | 'scan.profile_created' | 'scan.completed' | 'scan.remediation_applied' | 'scan.scheduled' | 'incident.created' | 'incident.responded' | 'incident.resolved' | 'incident.postmortem_created' | 'access.logged' | 'access.pattern_detected' | 'access.alert_raised' | 'access.report_generated' | 'permission.role_created' | 'permission.role_assigned' | 'permission.checked' | 'permission.audit_completed' | 'token.config_created' | 'token.issued' | 'token.validated' | 'token.revoked' | 'session.policy_created' | 'session.enforced' | 'session.violation_detected' | 'session.terminated_enforced' | 'firewall_rule.created' | 'firewall_rule.zone_configured' | 'firewall_rule.log_analyzed' | 'firewall_rule.tested' | 'certificate.issued' | 'certificate.renewed' | 'certificate.revoked' | 'certificate.audited' | 'geo.lookup_completed' | 'geo.compliance_checked' | 'geo.restriction_updated' | 'geo.report_generated' | 'ddos.policy_created' | 'ddos.attack_detected' | 'ddos.incident_mitigated' | 'ddos.metrics_reviewed' | 'api_route.created' | 'api_route.consumer_managed' | 'api_route.traffic_analyzed' | 'api_route.versioned' | 'endpoint.added' | 'endpoint.health_checked' | 'endpoint.alert_raised' | 'endpoint.uptime_reported' | 'proxy.configured' | 'proxy.rule_added' | 'proxy.traffic_logged' | 'proxy.health_checked' | 'vpn.tunnel_created' | 'vpn.peer_added' | 'vpn.connection_established' | 'vpn.config_updated' | 'bandwidth.profile_created' | 'bandwidth.allocated' | 'bandwidth.metrics_collected' | 'bandwidth.optimized' | 'latency.target_added' | 'latency.measured' | 'latency.baseline_computed' | 'latency.anomaly_detected' | 'packet.policy_created' | 'packet.capture_started' | 'packet.anomaly_found' | 'packet.analysis_complete' | 'audit.scan_started' | 'audit.finding_added' | 'audit.report_generated' | 'audit.scan_completed' | 'pool.created' | 'pool.resized' | 'pool.drained' | 'pool.metrics_collected' | 'ipam.pool_created' | 'ipam.ip_allocated' | 'ipam.ip_released' | 'ipam.conflict_detected' | 'portscan.started' | 'portscan.completed' | 'portscan.service_detected' | 'portscan.risk_assessed' | 'edge.config_created' | 'edge.route_added' | 'edge.cache_configured' | 'edge.traffic_routed' | 'lb.config_created' | 'lb.backend_added' | 'lb.traffic_distributed' | 'lb.health_checked' | 'healthcheck.target_added' | 'healthcheck.check_completed' | 'healthcheck.incident_opened' | 'healthcheck.incident_resolved' | 'rproxy.config_created' | 'rproxy.upstream_added' | 'rproxy.request_routed' | 'rproxy.ssl_configured' | 'nat.gateway_created' | 'nat.rule_added' | 'nat.translation_logged' | 'nat.rule_removed' | 'shaper.policy_created' | 'shaper.rule_added' | 'shaper.stats_collected' | 'shaper.bandwidth_adjusted' | 'mesh.deployed' | 'mesh.service_registered' | 'mesh.rule_created' | 'mesh.topology_updated' | 'wan.optimizer_created' | 'wan.tunnel_established' | 'wan.savings_reported' | 'wan.metrics_exported' | 'lag.group_created' | 'lag.member_added' | 'lag.failover_triggered' | 'lag.stats_collected' | 'proto.gateway_created' | 'proto.mapping_added' | 'proto.message_translated' | 'proto.metrics_collected' | 'vlan.created' | 'vlan.port_assigned' | 'vlan.acl_applied' | 'vlan.topology_updated'
  | 'topology.scan_started' | 'topology.scan_completed' | 'topology.drift_detected' | 'topology.snapshot_created'
  | 'forensic.case_opened' | 'forensic.evidence_collected' | 'forensic.analysis_completed' | 'forensic.case_concluded'
  | 'patch.advisory_found' | 'patch.test_passed' | 'patch.deployed' | 'patch.rolled_back'
  | 'access.campaign_started' | 'access.review_completed' | 'access.permission_revoked' | 'access.compliance_reported'
  | 'release.train_planned' | 'release.gates_passed' | 'release.train_deployed' | 'release.train_rolled_back'
  | 'cost.budget_created' | 'cost.anomaly_detected' | 'cost.forecast_generated' | 'cost.budget_exceeded'
  | 'drift.baseline_set' | 'drift.drift_detected' | 'drift.remediation_applied' | 'drift.escalated'
  | 'logcorr.rule_triggered' | 'logcorr.incident_opened' | 'logcorr.root_cause_found' | 'logcorr.incident_resolved'
  | 'webhook.endpoint_registered' | 'webhook.delivery_sent' | 'webhook.delivery_failed' | 'webhook.retry_exhausted'
  | 'cert.certificate_imported' | 'cert.renewal_requested' | 'cert.renewal_completed' | 'cert.expiry_warning'
  | 'quota.policy_created' | 'quota.limit_reached' | 'quota.overage_detected' | 'quota.enforcement_applied'
  | 'runbook.runbook_triggered' | 'runbook.step_completed' | 'runbook.execution_finished' | 'runbook.approval_required'
  | 'netscan.scan_started' | 'netscan.host_discovered' | 'netscan.vulnerability_found' | 'netscan.scan_completed'
  | 'dns.zone_created' | 'dns.record_updated' | 'dns.health_check_failed' | 'dns.failover_triggered'
  | 'inventory.asset_discovered' | 'inventory.sync_completed' | 'inventory.conflict_detected' | 'inventory.asset_decommissioned'
  | 'patch.policy_created' | 'patch.release_approved' | 'patch.rollout_completed' | 'patch.compliance_failed'
  | 'firewall.ruleset_created' | 'firewall.rule_added' | 'firewall.threat_blocked' | 'firewall.audit_completed'
  | 'backup.plan_created' | 'backup.job_completed' | 'backup.restore_verified' | 'backup.retention_cleaned'
  | 'storage.analysis_completed' | 'storage.dedup_finished' | 'storage.tier_moved' | 'storage.savings_realized'
  | 'health.endpoint_added' | 'health.check_failed' | 'health.incident_opened' | 'health.incident_resolved'
  | 'credential.store_created' | 'credential.rotated' | 'credential.leaked' | 'credential.audit_completed'
  | 'certificate.ca_created' | 'certificate.issued' | 'certificate.renewed' | 'certificate.revoked'
  | 'vpn.network_created' | 'vpn.peer_connected' | 'vpn.session_established' | 'vpn.tunnel_failed'
  | 'proxy.upstream_added' | 'proxy.route_configured' | 'proxy.health_failed' | 'proxy.traffic_anomaly'
  | 'access.policy_created' | 'access.grant_issued' | 'access.grant_revoked' | 'access.violation_detected'
  | 'log.source_registered' | 'log.entry_ingested' | 'log.pipeline_created' | 'log.anomaly_detected'
  | 'metric.source_added' | 'metric.threshold_breached' | 'metric.alert_fired' | 'metric.trend_detected'
  | 'alert.channel_configured' | 'alert.dispatched' | 'alert.acknowledged' | 'alert.incident_resolved'
  | 'trace.config_created' | 'trace.span_collected' | 'trace.analysis_completed' | 'trace.bottleneck_found'
  | 'config.schema_created' | 'config.validation_passed' | 'config.drift_detected' | 'config.compliance_failed'
  | 'registry.service_registered' | 'registry.service_deregistered' | 'registry.health_changed' | 'registry.endpoint_added'
  | 'ingress.rule_created' | 'ingress.cert_issued' | 'ingress.traffic_spike' | 'ingress.rate_limited'
  | 'fault.experiment_started' | 'fault.experiment_completed' | 'fault.observation_recorded' | 'fault.report_generated'
  | 'pool.created' | 'pool.exhausted' | 'pool.health_degraded' | 'pool.connection_error'
  | 'retry.policy_created' | 'retry.attempt_failed' | 'retry.exhausted' | 'retry.dlq_entry_added'
  | 'stream.source_created' | 'stream.source_active' | 'stream.source_error' | 'stream.sink_delivered'
  | 'schema.definition_created' | 'schema.validation_failed' | 'schema.evolution_checked' | 'schema.compatibility_broken'
  | 'etl.pipeline_created' | 'etl.run_started' | 'etl.run_completed' | 'etl.run_failed'
  | 'catalog.asset_registered' | 'catalog.lineage_traced' | 'catalog.profile_completed' | 'catalog.quality_scored'
  | 'query.analyzed' | 'query.suggestion_generated' | 'query.plan_cached' | 'query.optimization_applied' | 'broker.connection_established' | 'broker.topic_created' | 'broker.subscription_added' | 'broker.message_published' | 'cache.store_provisioned' | 'cache.policy_configured' | 'cache.warmup_completed' | 'cache.invalidation_triggered' | 'traffic.route_created' | 'traffic.rule_applied' | 'traffic.canary_deployed' | 'traffic.analytics_generated' | 'dns.zone_created' | 'dns.record_updated' | 'dns.dnssec_enabled' | 'dns.propagation_verified' | 'config.namespace_created' | 'config.entry_updated' | 'config.secret_encrypted' | 'config.rollback_executed' | 'monitor.check_executed' | 'monitor.alert_triggered' | 'monitor.metric_recorded' | 'monitor.uptime_reported' | 'packet.capture_started' | 'packet.analysis_completed' | 'packet.rule_created' | 'packet.anomaly_detected' | 'bandwidth.policy_created' | 'bandwidth.quota_set' | 'bandwidth.usage_reported' | 'bandwidth.throttle_applied' | 'firewall.ruleset_created' | 'firewall.rule_added' | 'firewall.traffic_evaluated' | 'firewall.threat_detected' | 'proxy.endpoint_created' | 'proxy.access_rule_added' | 'proxy.cache_configured' | 'proxy.traffic_logged' | 'ssl.certificate_issued' | 'ssl.renewal_initiated' | 'ssl.audit_completed' | 'ssl.certificate_revoked' | 'session.created' | 'session.refreshed' | 'session.terminated' | 'session.policy_applied' | 'endpoint.registered' | 'endpoint.health_checked' | 'endpoint.routing_configured' | 'endpoint.deregistered' | 'vuln.scan_completed' | 'vuln.cve_detected' | 'vuln.remediation_applied' | 'vuln.compliance_verified' | 'traffic.capture_started' | 'traffic.pattern_detected' | 'traffic.report_generated' | 'traffic.threat_identified' | 'identity.provider_configured' | 'identity.session_created' | 'identity.mapping_updated' | 'identity.authentication_completed' | 'key.generated' | 'key.rotated' | 'key.revoked' | 'key.usage_logged' | 'audit.log_created' | 'audit.policy_updated' | 'audit.alert_triggered' | 'audit.retention_applied' | 'compliance.framework_added' | 'compliance.check_completed' | 'compliance.report_generated' | 'compliance.violation_detected' | 'threat.rule_created' | 'threat.detected' | 'threat.response_executed' | 'threat.mitigated' | 'policy.created' | 'policy.evaluated' | 'policy.exception_granted' | 'policy.enforcement_changed' | 'data.classified' | 'data.rule_created' | 'data.lineage_tracked' | 'data.reclassified' | 'encryption.channel_created' | 'encryption.operation_performed' | 'encryption.certificate_managed' | 'encryption.keys_rotated' | 'scan.profile_created' | 'scan.completed' | 'scan.remediation_applied' | 'scan.scheduled' | 'incident.created' | 'incident.responded' | 'incident.resolved' | 'incident.postmortem_created' | 'access.logged' | 'access.pattern_detected' | 'access.alert_raised' | 'access.report_generated' | 'permission.role_created' | 'permission.role_assigned' | 'permission.checked' | 'permission.audit_completed' | 'token.config_created' | 'token.issued' | 'token.validated' | 'token.revoked' | 'session.policy_created' | 'session.enforced' | 'session.violation_detected' | 'session.terminated_enforced' | 'firewall_rule.created' | 'firewall_rule.zone_configured' | 'firewall_rule.log_analyzed' | 'firewall_rule.tested' | 'certificate.issued' | 'certificate.renewed' | 'certificate.revoked' | 'certificate.audited' | 'geo.lookup_completed' | 'geo.compliance_checked' | 'geo.restriction_updated' | 'geo.report_generated' | 'ddos.policy_created' | 'ddos.attack_detected' | 'ddos.incident_mitigated' | 'ddos.metrics_reviewed' | 'api_route.created' | 'api_route.consumer_managed' | 'api_route.traffic_analyzed' | 'api_route.versioned' | 'endpoint.added' | 'endpoint.health_checked' | 'endpoint.alert_raised' | 'endpoint.uptime_reported' | 'proxy.configured' | 'proxy.rule_added' | 'proxy.traffic_logged' | 'proxy.health_checked' | 'vpn.tunnel_created' | 'vpn.peer_added' | 'vpn.connection_established' | 'vpn.config_updated' | 'bandwidth.profile_created' | 'bandwidth.allocated' | 'bandwidth.metrics_collected' | 'bandwidth.optimized' | 'latency.target_added' | 'latency.measured' | 'latency.baseline_computed' | 'latency.anomaly_detected' | 'packet.policy_created' | 'packet.capture_started' | 'packet.anomaly_found' | 'packet.analysis_complete' | 'audit.scan_started' | 'audit.finding_added' | 'audit.report_generated' | 'audit.scan_completed' | 'pool.created' | 'pool.resized' | 'pool.drained' | 'pool.metrics_collected' | 'ipam.pool_created' | 'ipam.ip_allocated' | 'ipam.ip_released' | 'ipam.conflict_detected' | 'portscan.started' | 'portscan.completed' | 'portscan.service_detected' | 'portscan.risk_assessed' | 'edge.config_created' | 'edge.route_added' | 'edge.cache_configured' | 'edge.traffic_routed' | 'lb.config_created' | 'lb.backend_added' | 'lb.traffic_distributed' | 'lb.health_checked' | 'healthcheck.target_added' | 'healthcheck.check_completed' | 'healthcheck.incident_opened' | 'healthcheck.incident_resolved' | 'rproxy.config_created' | 'rproxy.upstream_added' | 'rproxy.request_routed' | 'rproxy.ssl_configured' | 'nat.gateway_created' | 'nat.rule_added' | 'nat.translation_logged' | 'nat.rule_removed' | 'shaper.policy_created' | 'shaper.rule_added' | 'shaper.stats_collected' | 'shaper.bandwidth_adjusted' | 'mesh.deployed' | 'mesh.service_registered' | 'mesh.rule_created' | 'mesh.topology_updated' | 'wan.optimizer_created' | 'wan.tunnel_established' | 'wan.savings_reported' | 'wan.metrics_exported' | 'lag.group_created' | 'lag.member_added' | 'lag.failover_triggered' | 'lag.stats_collected' | 'proto.gateway_created' | 'proto.mapping_added' | 'proto.message_translated' | 'proto.metrics_collected' | 'vlan.created' | 'vlan.port_assigned' | 'vlan.acl_applied' | 'vlan.topology_updated'
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
    case 'auto_scaler':
    case 'dns_manager':
    case 'ssl_cert_manager':
    case 'chaos_engineer':
    case 'ab_tester':
    case 'container_registry':
    case 'graphql_gateway':
    case 'message_queue_hub':
    case 'canary_deployer':
    case 'db_replicator':
    case 'edge_node':
    case 'api_version_tower':
    case 'compliance_scanner':
    case 'backup_vault':
    case 'traffic_shaper':
    case 'log_rotator':
    case 'ip_gatekeeper':
    case 'webhook_relay':
    case 'storage_tower':
    case 'peering_bridge':
    case 'translation_hub':
    case 'webhook_relay':
    case 'config_vault':
    case 'health_tower':
    case 'trace_nexus':
    case 'load_balancer':
    case 'validation_hub':
    case 'schema_registry':
    case 'workflow_factory':
    case 'rate_limiter':
    case 'auto_scaler':
    case 'dns_manager':
    case 'ssl_cert_manager':
    case 'chaos_engineer':
    case 'ab_tester':
    case 'container_registry':
    case 'graphql_gateway':
    case 'message_queue_hub':
    case 'canary_deployer':
    case 'db_replicator':
    case 'edge_node':
    case 'api_version_tower':
    case 'compliance_scanner':
    case 'backup_vault':
    case 'traffic_shaper':
    case 'log_rotator':
    case 'ip_gatekeeper':
    case 'webhook_relay':
    case 'storage_tower':
    case 'peering_bridge':
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
    case 'discovery_beacon':
    case 'circuit_tower':
    case 'injection_forge':
    case 'state_engine':
    case 'delivery_hub':
    case 'search_archive':
    case 'event_ledger':
    case 'config_vault':
    case 'health_tower':
    case 'trace_nexus':
    case 'load_balancer':
    case 'validation_hub':
    case 'schema_registry':
    case 'workflow_factory':
    case 'rate_limiter':
    case 'auto_scaler':
    case 'dns_manager':
    case 'ssl_cert_manager':
    case 'chaos_engineer':
    case 'ab_tester':
    case 'container_registry':
    case 'graphql_gateway':
    case 'message_queue_hub':
    case 'canary_deployer':
    case 'db_replicator':
    case 'edge_node':
    case 'api_version_tower':
    case 'compliance_scanner':
    case 'backup_vault':
    case 'traffic_shaper':
    case 'log_rotator':
    case 'ip_gatekeeper':
    case 'webhook_relay':
    case 'storage_tower':
    case 'peering_bridge':
    case 'dns_registry':
    case 'cert_tower':
    case 'audit_hall':
    case 'rate_gate':
    case 'flag_tower':
    case 'health_beacon':
    case 'cost_bureau':
    case 'data_forge':
    case 'alert_hub':
      return 'civic';
    case 'geo_watchtower':
    case 'audit_archive':
    case 'change_bureau':
    case 'deploy_gateway':
    case 'asset_vault':
      return 'civic';
    case 'token_mint':
      return 'market';
    case 'sandbox_chamber':
      return 'civic';
    case 'swarm_nexus':
      return 'civic';
    case 'consensus_forum':
      return 'civic';
    case 'anomaly_watchtower':
      return 'civic';
    case 'dep_graph_lab':
      return 'civic';
    case 'blueprint_forge':
      return 'civic';
    case 'signal_tower':
      return 'civic';
    case 'throttle_station':
      return 'civic';
    case 'sync_bridge':
      return 'civic';
    case 'mesh_router':
      return 'civic';
    case 'patch_workshop':
      return 'civic';
    case 'inventory_vault':
      return 'market';
    case 'discovery_beacon':
      return 'civic';
    case 'federation_hub':
      return 'civic';
    case 'circuit_panel':
      return 'civic';
    case 'rate_gate':
      return 'civic';
    case 'canary_tower':
      return 'civic';
    case 'flag_control':
      return 'civic';
    case 'chaos_arena':
      return 'civic';
    case 'telemetry_hub':
      return 'civic';
    case 'cost_ledger':
      return 'market';
    case 'net_firewall':
      return 'civic';
    case 'recovery_vault':
      return 'civic';
    case 'perf_lab':
      return 'civic';
    case 'sandbox_pod':
      return 'civic';
    case 'secret_rotator':
      return 'civic';
    case 'mirror_tap':
      return 'civic';
    case 'compliance_desk':
      return 'market';
    case 'capacity_planner':
    case 'topology_grid':
      return 'infrastructure';
    case 'forensic_lab':
      return 'civic';
    case 'patch_depot':
      return 'infrastructure';
    case 'access_court':
      return 'civic';
    case 'release_station':
    case 'cost_watchtower':
    case 'correlation_hub':
    case 'webhook_station':
      return 'infrastructure';
    case 'remediation_forge':
    case 'certificate_vault':
      return 'civic';
    case 'quota_gate':
    case 'runbook_forge':
    case 'inventory_depot':
      return 'infrastructure';
    case 'network_scanner':
    case 'dns_tower':
      return 'civic';
    case 'patch_manager':
    case 'backup_orchestrator':
    case 'storage_optimizer':
      return 'infrastructure';
    case 'firewall_controller':
    case 'health_monitor':
      return 'civic';
    case 'credential_manager':
    case 'certificate_manager':
    case 'access_controller':
      return 'civic';
    case 'vpn_gateway':
    case 'proxy_router':
      return 'infrastructure';
    case 'log_aggregator':
    case 'metric_collector':
    case 'trace_analyzer':
      return 'infrastructure';
    case 'alert_dispatcher':
    case 'config_validator':
    case 'service_registry':
    case 'ingress_controller':
    case 'fault_injector':
    case 'connection_pool':
    case 'retry_handler':
      return 'civic';
    case 'stream_processor':
      return 'industrial';
    case 'schema_validator':
      return 'civic';
    case 'etl_processor':
      return 'industrial';
    case 'data_catalog':
      return 'civic';
    case 'query_optimizer':
      return 'civic';
    case 'message_broker':
      return 'industrial';
    case 'cache_manager':
      return 'industrial';
    case 'traffic_router':
      return 'industrial';
    case 'dns_resolver':
      return 'civic';
    case 'config_server':
      return 'civic';
    case 'network_monitor':
      return 'industrial';
    case 'packet_analyzer':
      return 'industrial';
    case 'bandwidth_controller':
      return 'industrial';
    case 'firewall_manager':
      return 'civic';
    case 'proxy_server':
    case 'ssl_manager': return 'civic';
    case 'session_manager': return 'civic';
    case 'endpoint_resolver': return 'industrial';
    case 'vulnerability_scanner': return 'civic';
      case 'traffic_analyzer':
      case 'identity_provider':
      case 'key_manager':
      case 'audit_logger':
      case 'compliance_checker':
      case 'policy_engine':
      case 'data_classifier':
      case 'encryption_gateway':
      case 'security_scanner':
      case 'incident_manager':
      case 'access_auditor':
      case 'permission_manager':
      case 'token_validator':
      case 'session_enforcer':
    case 'certificate_authority':
    case 'geo_locator':
    case 'ddos_protector':
    case 'api_gateway_manager':
    case 'endpoint_monitor':
    case 'proxy_manager':
    case 'vpn_provisioner':
    case 'bandwidth_optimizer':
    case 'latency_analyzer':
    case 'packet_inspector':
    case 'network_auditor':
    case 'connection_pooler':
    case 'ip_allocator':
    case 'port_scanner':
    case 'edge_router':
    case 'load_balancer':
    case 'health_checker':
    case 'reverse_proxy':
    case 'nat_gateway':
    case 'traffic_shaper':
    case 'service_mesh':
    case 'wan_optimizer':
    case 'link_aggregator':
    case 'protocol_gateway':
    case 'vlan_manager':
    case 'network_tap':
    case 'flow_collector':
    case 'sflow_agent':
    case 'netflow_exporter':
    case 'arp_inspector':
    case 'packet_sniffer':
    case 'bandwidth_monitor':
    case 'latency_probe':
    case 'jitter_analyzer':
    case 'packet_loss_tracker':
    case 'traffic_classifier':
    case 'qos_enforcer':
    case 'acl_auditor':
    case 'firewall_policy':
    case 'port_mapper':
    case 'cloud_provisioner':
    case 'vm_orchestrator':
    case 'registry_manager':
    case 'image_builder':
    case 'artifact_store':
    case 'pipeline_runner':
    case 'test_orchestrator':
    case 'deploy_manager':
    case 'rollback_controller':
    case 'release_gatekeeper':
    case 'metric_exporter':
    case 'log_shipper':
    case 'alert_manager':
    case 'incident_responder':
    case 'uptime_monitor':
    case 'schema_migrator':
    case 'query_tuner':
    case 'backup_scheduler':
    case 'replication_manager':
    case 'pool_manager':
    case 'vuln_scanner':
    case 'credential_rotator':
    case 'compliance_auditor':
    case 'rbac_controller':
    case 'policy_enforcer':
    case 'msg_relay':
    case 'stream_ingester':
    case 'event_router':
    case 'queue_manager':
    case 'pubsub_gateway':
    case 'container_builder':
    case 'image_registry':
    case 'orchestrator':
    case 'svc_mesh':
    case 'config_manager':
    case 'search_indexer':
    case 'analytics_engine':
    case 'data_lakehouse':
    case 'etl_pipeline':
    case 'report_generator':
    case 'network_router':
    case 'dns_gateway':
    case 'lb_orchestrator':
    case 'cdn_proxy':
    case 'rate_controller':
    case 'log_streamer':
    case 'metrics_hub':
    case 'event_correlator':
    case 'trace_collector':
    case 'dashboard_builder':
    case 'pentest_runner':
    case 'intrusion_guard':
    case 'rbac_enforcer':
    case 'siem_connector':
    case 'forensic_analyzer':
      case 'network_firewall':
      case 'threat_detector':
      return 'industrial';
  }
}
