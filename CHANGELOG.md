## Batches 538-542 — Workflow & Orchestration
- **Batch 538** — pipeline_executor: Pipeline execution and step orchestration
- **Batch 539** — task_dispatcher: Task dispatch and worker assignment
- **Batch 540** — step_coordinator: Step coordination across distributed workflows
- **Batch 541** — saga_runner: Saga pattern execution with compensation
- **Batch 542** — compensation_handler: Compensation and rollback handling for failed sagas
- Migrations: 20260621750000–20260621790000
- EK prefixes: plex, tkdp, stcd, sgrn, cmph

## Batches 473-477 — Observability & Monitoring
- **Batch 473** — incident_tracker: End-to-end incident management with escalation and SLA tracking
- **Batch 474** — sla_reporter: SLA compliance monitoring with breach detection and trend analysis
- **Batch 475** — anomaly_detector: Statistical/ML anomaly detection with adaptive baselines
- **Batch 476** — resource_scaler: Intelligent auto-scaling with policy-driven decisions
- **Batch 477** — outage_predictor: Predictive outage analysis using metrics correlation and ML
- Migrations: 20260621100000–20260621140000
- EK prefixes: intr, slar, andt, rscl, outp

## Batches 468-472 — API Security & Auth
- **Batch 468** — token_rotator: Automated API token rotation with zero-downtime transitions
- **Batch 469** — secret_scanner: Continuous secret detection across code and environments
- **Batch 470** — auth_auditor: Authentication/authorization audit against compliance standards
- **Batch 471** — permission_mapper: RBAC mapping, hierarchy management, permission analysis
- **Batch 472** — session_tracker: Real-time session monitoring, anomaly detection, limits
- Migrations: 20260621050000–20260621090000
- EK prefixes: tkrt, scsc, auad, pmmp, sntr

## Batches 463-467 — Data Infrastructure
- **Batch 463** — data_replicator: Cross-database replication, sync, conflict resolution
- **Batch 464** — data_partitioner: Table partitioning strategy, rebalancing, retention
- **Batch 465** — data_archiver: Data archival, compression, cold storage, retention enforcement
- **Batch 466** — table_optimizer: Bloat detection, vacuum scheduling, index maintenance
- **Batch 467** — query_analyzer: Slow query detection, execution plan review, optimization
- Migrations: 20260621000000–20260621040000
- EK prefixes: drep, dpar, darc, tbop, qanl

# Changelog

## Batches 573-577 — Content Moderation & Safety
- toxicity_scanner: Content toxicity scanning with severity classification
- spam_classifier: Multi-signal spam classification with ML-based scoring
- nsfw_detector: NSFW content detection for images and text media
- bias_auditor: Algorithmic bias auditing with fairness metrics
- content_fingerprinter: Content fingerprinting for duplicate and near-duplicate detection
- 5 migrations, shared types, barrel exports, SKILL.md files
- Eidolon BK/EK/districtFor wiring, event-bus SUBJECT_MAP entries
- Task-executor switch cases, .gitattributes privacy filters
- 55/55 tests passing


## Batches 568-572 — Workflow Orchestration
- step_sequencer: Multi-step workflow sequencing with dependency tracking
- gate_keeper: Conditional gate evaluation for workflow progression control
- parallel_joiner: Parallel branch execution with join-barrier synchronization
- timeout_watcher: Deadline monitoring with escalation on timeout events
- retry_orchestrator: Configurable retry policies with exponential backoff
- 5 migrations, shared types, barrel exports, SKILL.md files
- Eidolon BK/EK/districtFor wiring, event-bus SUBJECT_MAP entries
- Task-executor switch cases, .gitattributes privacy filters
- 55/55 tests passing


## Batches 563-567 — Resource Management & Capacity
- resource_allocator: Dynamic resource allocation and contention management
- demand_forecaster: Demand forecasting with spike prediction and model retraining
- burst_handler: Traffic burst detection with adaptive throttling
- reservation_clerk: Resource reservation and availability slot management
- utilization_tracker: Resource utilization tracking and usage trend analysis
- 5 migrations, shared types, barrel exports, SKILL.md files
- Eidolon BK/EK/districtFor wiring, event-bus SUBJECT_MAP entries
- Task-executor switch cases, .gitattributes privacy filters
- 55/55 tests passing


## Batches 558-562 — Search & Discovery
- semantic_indexer: Semantic document indexing with vector embeddings
- faceted_search: Multi-faceted search with dynamic filtering and ranking
- suggestion_engine: Intelligent suggestion generation with ML-based ranking
- autocomplete_builder: Prefix-tree autocomplete with frequency-based ranking
- catalog_crawler: Automated catalog crawling and product discovery
- 5 migrations, shared types, barrel exports, SKILL.md files
- Eidolon BK/EK/districtFor wiring, event-bus SUBJECT_MAP entries
- Task-executor switch cases, .gitattributes privacy filters
- 55/55 tests passing


## Batches 553-557 — Notification & Alerting
- threshold_monitor: Threshold monitoring with configurable breach detection
- escalation_router: Multi-level escalation routing and timeout management
- notification_templater: Notification template rendering and delivery queue management
- digest_aggregator: Notification digest compilation and batched dispatch
- channel_gateway: Multi-channel delivery gateway with failover support
- 5 migrations, shared types, barrel exports, SKILL.md files
- Eidolon BK/EK/districtFor wiring, event-bus SUBJECT_MAP entries
- Task-executor switch cases, .gitattributes privacy filters
- 55/55 tests passing


## Batches 548-552 — Data Processing & ETL
- batch_transformer: Batch data transformation and processing pipeline
- data_validator: Data quality validation and rule enforcement
- pipeline_aggregator: Multi-source data aggregation and conflict resolution
- record_enricher: Record enrichment from external data sources
- etl_orchestrator: End-to-end ETL pipeline orchestration and monitoring
- 5 migrations, shared types, barrel exports, SKILL.md files
- Eidolon BK/EK/districtFor wiring, event-bus SUBJECT_MAP entries
- Task-executor switch cases, .gitattributes privacy filters
- 55/55 tests passing


## Batches 543-547 — Compliance & Governance
- audit_trail_writer: Immutable audit trail recording and tamper detection
- governance_auditor: Governance auditing and compliance finding management
- regulation_scanner: Regulatory compliance scanning and violation detection
- consent_manager: User consent lifecycle management and preference tracking
- retention_scheduler: Data retention scheduling and automated purge management
- 5 migrations, shared types, barrel exports, SKILL.md files
- Eidolon BK/EK/districtFor wiring, event-bus SUBJECT_MAP entries
- Task-executor switch cases, .gitattributes privacy filters
- 55/55 tests passing


## Batches 533-537 — Billing & Subscription
- invoice_generator: Invoice generation and line item management
- subscription_lifecycle: Subscription lifecycle and renewal processing
- usage_metering: Usage metering and consumption tracking
- payment_reconciler: Payment reconciliation and discrepancy resolution
- dunning_manager: Dunning management and payment recovery workflows

## Batches 528-532 — Identity & SSO
- oauth_provider: OAuth 2.0 provider management and client registration
- saml_bridge: SAML federation bridge and SSO assertion handling
- token_minter: JWT/token minting and lifecycle management
- session_rotator: Session rotation and key regeneration policies
- identity_linker: Cross-provider identity linking and account merging

## Batches 523-527 — Storage & File Management
- blob_archiver: Blob storage archival and lifecycle management
- file_deduplicator: File deduplication and hash-based storage optimization
- storage_tierer: Storage tier assignment and data migration policies
- media_transcoder: Media format transcoding and quality optimization
- thumbnail_generator: Thumbnail generation and image variant management

## Batches 518-522 — Notification & Messaging
- push_dispatcher: Push notification dispatching and token management
- email_renderer: Email template rendering and layout compilation
- sms_gateway: SMS gateway routing and provider management
- channel_selector: Notification channel selection and routing rules
- delivery_tracker: Message delivery tracking and analytics

## Batches 513-517 — Search & Indexing
- index_builder: Search index creation and schema management
- facet_aggregator: Faceted search aggregation and bucket computation
- autocomplete_engine: Autocomplete suggestion engine and corpus management
- relevance_tuner: Search relevance tuning and score optimization
- synonym_manager: Synonym dictionary management and query expansion

## Batches 508-512 — API Gateway & Rate Limiting
- throttle_controller: Request throttling and rate control management
- api_key_rotator: API key rotation and lifecycle management
- route_balancer: Route load balancing and traffic distribution
- endpoint_cache: Endpoint response caching and TTL management
- response_compressor: Response compression and optimization

## Batches 503-507 — Security & Access Control
- cert_renewer: TLS certificate lifecycle management and automated renewal
- vault_syncer: Secret vault synchronization and credential rotation
- rbac_manager: Role-based access control management and policy enforcement
- mfa_validator: Multi-factor authentication validation and challenge management
- ip_allowlister: IP allowlist management and access control enforcement

## Batches 498-502 — Data Pipeline & ETL Part 2
- Added dead_letter_handler, backfill_runner, lineage_tracer, data_cataloger, change_capture verticals
- 5 migrations (20260621350000-20260621390000), 5 type files, 5 barrel exports
- 5 SKILL.md files, 5 BK + 20 EK + 5 districtFor, 20 SUBJECT_MAP entries
- 30 task-executor cases + 30 handler methods, 15 .gitattributes entries
- 60/60 tests passing

## Batches 493-497 — Data Pipeline & ETL
- Added data_deduplicator, stream_joiner, batch_scheduler, partition_manager, watermark_tracker verticals
- 5 migrations (20260621300000-20260621340000), 5 type files, 5 barrel exports
- 5 SKILL.md files, 5 BK + 20 EK + 5 districtFor, 20 SUBJECT_MAP entries
- 30 task-executor cases + 30 handler methods, 15 .gitattributes entries
- 60/60 tests passing

## Batches 488-492 — Observability & Monitoring
- Added span_collector, uptime_tracker, sla_monitor, cardinality_limiter, exemplar_sampler verticals
- 5 migrations (20260621250000-20260621290000), 5 type files, 5 barrel exports
- 5 SKILL.md files, 5 BK + 20 EK + 5 districtFor, 20 SUBJECT_MAP entries
- 30 task-executor cases + 30 handler methods, 15 .gitattributes entries
- 60/60 tests passing

## Batches 483-487 — Container & Orchestration
- Added pod_scheduler, volume_manager, container_profiler, cluster_balancer, node_drainer verticals
- 5 migrations (20260621200000-20260621240000), 5 type files, 5 barrel exports
- 5 SKILL.md files, 5 BK + 20 EK + 5 districtFor, 20 SUBJECT_MAP entries
- 30 task-executor cases + 30 handler methods, 15 .gitattributes entries
- 60/60 tests passing

## Batches 478-482 — DevOps & Deployment
- New verticals: secret_injector, deploy_verifier, env_provisioner, release_tagger, stack_auditor
- 5 migrations (20260621150000-20260621190000)
- 5 type files with 3 interfaces each (15 total)
- 5 SKILL.md files in skills/autonomous-economy/
- 5 BK + 20 EK + 5 districtFor in types.ts
- 20 SUBJECT_MAP entries in event-bus.ts
- 30 task executor cases + 30 handler methods
- 15 .gitattributes privacy entries
- 60 tests passing



## Batches 443-447 — Infrastructure Operations
- **config_syncer** (Batch 443): Synchronize config across environments, detect drift, resolve conflicts, track sync history
- **environment_prober** (Batch 444): Probe environments for health/latency/availability, schedule recurring probes, uptime tracking
- **secrets_rotator** (Batch 445): Rotate secrets on schedule, overdue detection, vault backend integration, post-rotation verification
- **infra_scanner** (Batch 446): Scan infrastructure for vulnerabilities/misconfigurations, remediation reports, cross-scan comparison
- **health_dashboard** (Batch 447): Build health dashboards with real-time widgets, charts, alerts, snapshot and export capabilities
- 5 migration SQL files (20260620800000–20260620840000)
- 5 shared TypeScript type files with config interfaces
- 5 SKILL.md files in skills/autonomous-economy/
- 5 BK + 20 EK + 5 districtFor values in Eidolon types
- 20 SUBJECT_MAP entries in event-bus
- 30 task-executor switch cases + 30 handler methods
- 15 .gitattributes privacy filter entries



## Batches 438-442 — Release Engineering
- **feature_flag_manager** (Batch 438): Manage feature flags with boolean/percentage/gradual strategies, targeting, stale detection, audit trail
- **blue_green_switcher** (Batch 439): Blue-green deployment management with traffic switching, health checks, auto-rollback, switch history
- **deployment_validator** (Batch 440): Deployment validation with health checks, smoke tests, structured reports, cross-deployment comparison
- **gradual_rollout_manager** (Batch 441): Gradual feature rollouts with configurable increments, observation windows, auto-rollback on error threshold
- **ab_test_runner** (Batch 442): A/B test runner with statistical rigor — sample sizes, confidence levels, traffic splits, winner determination
- 5 migration SQL files (20260620750000–20260620790000)
- 5 shared TypeScript type files with config interfaces
- 5 SKILL.md files in skills/autonomous-economy/
- 5 BK + 20 EK + 5 districtFor values in Eidolon types
- 20 SUBJECT_MAP entries in event-bus
- 30 task-executor switch cases + 30 handler methods
- 15 .gitattributes privacy filter entries



## Batches 433-437 — Advanced Integration
- **event_sourcer** (Batch 433): Event sourcing with streams, snapshots, projections across PostgreSQL/EventStore/DynamoDB/MongoDB/Cassandra
- **state_machine_runner** (Batch 434): Finite state machine execution, transitions, guards, context tracking, visualization
- **request_router** (Batch 435): Intelligent request routing with round-robin/weighted/least-connections/hash/priority strategies
- **load_balancer_agent** (Batch 436): Backend management with health checks, connection draining, algorithm configuration
- **circuit_breaker_agent** (Batch 437): Circuit breaker pattern with closed/open/half-open states, failure tracking, auto-recovery


## Batches 428-432 — Data & Messaging
- **payload_transformer** (Batch 428): Payload format conversion (JSON/XML/CSV/Protobuf/Avro/MessagePack), schema validation, batch transforms, rule engine
- **queue_orchestrator** (Batch 429): Multi-backend queue management (NATS/Redis/RabbitMQ/Kafka/SQS), dead-letter support, consumer rebalancing
- **data_pipeline_runner** (Batch 430): DAG-based data pipelines, scheduling, step tracking, retry policies, run metrics
- **message_broker_admin** (Batch 431): Broker health monitoring, topic management, partition rebalancing, alerting across NATS/RabbitMQ/Kafka/Pulsar
- **retry_scheduler** (Batch 432): Intelligent retry scheduling with backoff strategies (fixed/linear/exponential/fibonacci), failure analysis, bulk retry


## Batch 147 — Agent State Sync
- Migration: `20260617840000_agent_state_sync.sql` (sync_peers, sync_states, sync_operations)
- Types: SyncDirection, ConflictPolicy, SyncPeer, SyncState, SyncOperationRecord, StateSyncStats
- Skill: agent-state-sync (infrastructure archetype)
- Eidolon: sync_bridge BK + 4 statesync EK values
- Event bus: 4 SUBJECT_MAP entries
- Task executor: 6 handlers (sync_create_peer, sync_push, sync_pull, sync_resolve, sync_list, sync_report)

## Batch 146 — Agent Throttle Control
- Migration: `20260617830000_agent_throttle_control.sql` (throttle_rules, throttle_events, throttle_counters)
- Types: ThrottleScope, ThrottleMode, ThrottleAction, ThrottleRule, ThrottleEvent, ThrottleCounter, ThrottleControlStats
- Skill: agent-throttle-control (operations archetype)
- Eidolon: throttle_station BK + 4 throttle EK values
- Event bus: 4 SUBJECT_MAP entries
- Task executor: 6 handlers (throttle_create_rule, throttle_check, throttle_update_rule, throttle_reset, throttle_list, throttle_report)

## Batch 145 — Agent Signal Dispatch
- Migration: `20260617820000_agent_signal_dispatch.sql` (agent_signals, signal_subscriptions, signal_deliveries)
- Types: SignalKind, SignalPriority, DispatchMode, DeliveryStatus, AgentSignal, SignalSubscription, SignalDelivery, SignalDispatchStats
- Skill: agent-signal-dispatch (messaging archetype)
- Eidolon: signal_tower BK + 4 signal EK values
- Event bus: 4 SUBJECT_MAP entries
- Task executor: 6 handlers (signal_send, signal_subscribe, signal_broadcast, signal_acknowledge, signal_list, signal_report)

## Batch 144 — Agent Blueprint System
- Migration: `20260617810000_agent_blueprint_system.sql` (system_blueprints, blueprint_components, blueprint_instances)
- Types: BlueprintScope, BlueprintStatus, ComponentSlot, SystemBlueprint, BlueprintComponent, BlueprintInstance, BlueprintSystemStats
- Skill: agent-blueprint-system (architecture archetype)
- Eidolon: blueprint_forge BK + 4 blueprint EK values
- Event bus: 4 SUBJECT_MAP entries
- Task executor: 6 handlers (blueprint_create, blueprint_add_component, blueprint_validate, blueprint_instantiate, blueprint_list, blueprint_report)

## Batch 143 — Agent Dependency Graph
- Migration: `20260617800000_agent_dependency_graph.sql` (dependency_graphs, dependency_nodes, dependency_edges)
- Types: DepGraphKind, DepNodeType, DepEdgeType, DependencyGraph, DependencyNode, DependencyEdge, DependencyGraphStats
- Skill: agent-dependency-graph (analytics archetype)
- Eidolon: dep_graph_lab BK + 4 depgraph EK values
- Event bus: 4 SUBJECT_MAP entries
- Task executor: 6 handlers (depgraph_create, depgraph_add_node, depgraph_add_edge, depgraph_analyse, depgraph_list, depgraph_report)

All notable changes to Sven are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## Batch 138 – Agent Token Minting
- Migration: token_definitions, mint_operations, token_balances
- Types: TokenType, MintReason, MintStatus, TokenDefinition, MintOperation, TokenBalance
- Skill: agent-token-minting (treasury archetype)
- Eidolon: BK token_mint, 4 EK events, districtFor → market

## Batch 139 – Agent Sandbox Isolation
- Migration: sandbox_environments, sandbox_executions, sandbox_violations
- Types: IsolationLevel, SandboxStatus, NetworkPolicy, ViolationType
- Skill: agent-sandbox-isolation (infrastructure archetype)
- Eidolon: BK sandbox_chamber, 4 EK events, districtFor → civic

## Batch 140 – Agent Swarm Coordination
- Migration: swarm_clusters, swarm_members, swarm_tasks
- Types: SwarmStrategy, SwarmStatus, SwarmRole, SwarmCluster, SwarmMember
- Skill: agent-swarm-coordination (coordination archetype)
- Eidolon: BK swarm_nexus, 4 EK events, districtFor → civic

## Batch 141 – Agent Consensus Protocol
- Migration: consensus_proposals, consensus_votes, consensus_executions
- Types: ProposalType, ProposalStatus, VoteChoice, ConsensusProposal
- Skill: agent-consensus-protocol (governance archetype)
- Eidolon: BK consensus_forum, 4 EK events, districtFor → civic

## Batch 142 – Agent Anomaly Detection
- Migration: anomaly_detectors, detected_anomalies, anomaly_baselines
- Types: AnomalyAlgorithm, AnomalySeverity, BaselinePeriod
- Skill: agent-anomaly-detection (observability archetype)
- Eidolon: BK anomaly_watchtower, 4 EK events, districtFor → civic

## [Unreleased]

### Batches 458-462 — Network Security & Routing
- **Batch 458**: ssl_inspector — SSL/TLS certificate inspection, protocol analysis, vulnerability scanning
- **Batch 459**: proxy_configurator — Reverse proxy configuration, upstream management, traffic routing
- **Batch 460**: webhook_router — Webhook endpoint management, delivery routing, retry logic
- **Batch 461**: egress_filter — Outbound traffic filtering, data loss prevention, policy enforcement
- **Batch 462**: request_validator — API request validation, schema enforcement, input sanitization
- 5 migrations (20260620950000-20260620990000), 5 type files, 5 SKILL.md files
- 5 BK + 20 EK + 5 districtFor, 20 SUBJECT_MAP entries, 30 cases + 30 handlers

### Batches 453-457 — Cloud Governance
- **Batch 453**: cost_optimizer — Cloud cost optimization with rightsizing, reserved instances, savings tracking
- **Batch 454**: resource_tagger — Resource tagging policy enforcement, compliance auditing, auto-tagging
- **Batch 455**: quota_manager — Resource quota monitoring, threshold alerting, usage forecasting
- **Batch 456**: access_reviewer — Access permission review, stale access detection, least-privilege enforcement
- **Batch 457**: failover_tester — Chaos engineering, failover testing, recovery time measurement, resilience scoring
- 5 migrations (20260620900000-20260620940000), 5 type files, 5 SKILL.md files
- 5 BK + 20 EK + 5 districtFor, 20 SUBJECT_MAP entries, 30 cases + 30 handlers

### Batches 448-452 — Observability & Service Management
- **Batch 448**: change_manager — Infrastructure change management with risk assessment, approval workflows, rollback plans
- **Batch 449**: service_catalog — Service catalog with ownership tracking, dependency graphs, tier management
- **Batch 450**: uptime_reporter — Uptime reporting against SLA targets, downtime incident tracking, forecasting
- **Batch 451**: latency_profiler — Endpoint latency profiling with percentile tracking, anomaly detection, baselines
- **Batch 452**: throughput_analyzer — Throughput metric analysis, trend detection, drop alerting, capacity forecasting
- 5 migrations (20260620850000-20260620890000), 5 type files, 5 SKILL.md files
- 5 BK + 20 EK + 5 districtFor, 20 SUBJECT_MAP entries, 30 cases + 30 handlers

### Batches 423-427 — Security & Compliance
- **cert_rotator**: TLS/SSL certificate lifecycle, renewal, rotation, revocation (6 handlers)
- **key_escrow**: Secure key storage, rotation, backup, access auditing (6 handlers)
- **config_auditor**: Configuration compliance scanning, baseline comparison, violation reporting (6 handlers)
- **uptime_sentinel**: Endpoint monitoring, uptime tracking, SLA reporting (6 handlers)
- **drift_detector**: Infrastructure drift detection, baseline comparison, auto-remediation (6 handlers)
- 5 migrations, 5 type files, 5 SKILL.md, 5 BK + 20 EK + 5 districtFor, 20 SUBJECT_MAP, 30 cases + 30 handlers
- 175 tests passing


### Batches 418-422 — Infrastructure Resilience
- **incident_commander**: Incident lifecycle, triage, escalation, postmortem generation (6 handlers)
- **failure_injector**: Chaos engineering experiments, failure injection, resilience reports (6 handlers)
- **service_mesh_router**: Service mesh routing, circuit breakers, health checks, topology (6 handlers)
- **cache_optimizer**: Cache analysis, TTL optimization, warming, eviction, reporting (6 handlers)
- **log_indexer**: Log indexing, ingestion, full-text search, retention, export (6 handlers)
- 5 migrations, 5 type files, 5 SKILL.md, 5 BK + 20 EK + 5 districtFor, 20 SUBJECT_MAP, 30 cases + 30 handlers
- 175 tests passing


### Batches 413-417 — Observability & Reliability
- **alert_router**: Alert rule management, firing, delivery, suppression (6 handlers)
- **telemetry_collector**: Metric recording, dashboards, retention, summaries (6 handlers)
- **runbook_executor**: Runbook CRUD, execution lifecycle, cloning (6 handlers)
- **dependency_resolver**: Graph resolution, conflict detection, lockfile export (6 handlers)
- **resource_quoter**: Quote lifecycle, resource allocation, spending tracking (6 handlers)
- 5 migrations, 5 type files, 5 SKILL.md, 5 BK + 20 EK + 5 districtFor, 20 SUBJECT_MAP, 30 cases + 30 handlers
- 175 tests passing

### Batches 408-412 — Data & Configuration
- **etl_processor**: ETL pipelines with source connectors, transforms, and sink targets
- **schema_validator**: Schema registration, data validation, and compatibility checking
- **config_registry**: Centralized configuration with versioning and environment management
- **feature_flag_engine**: Feature toggles with rollouts, targeting, and A/B testing
- **health_monitor**: Health checks, status tracking, and incident management
- 5 migrations, 5 shared types, 5 SKILL.md files, 5 BK + 20 EK + 5 districtFor
- 20 SUBJECT_MAP entries, 30 switch cases + 30 handlers, 15 .gitattributes entries
- 175 tests passing

### Batches 403-407 — Workflow & Orchestration
- **workflow_orchestrator** (Batch 403): Multi-step workflow engine — branching, parallel execution, pause/resume, configurable error recovery
- **pipeline_scheduler** (Batch 404): Pipeline scheduling — cron expressions, event/dependency/webhook triggers, catch-up runs, timezone support
- **job_dispatcher** (Batch 405): Job distribution engine — round-robin/least-loaded/priority/affinity strategies, worker heartbeats, dead-letter
- **queue_manager** (Batch 406): Message queue management — FIFO/priority/delay/DLQ queues, visibility timeouts, rate limiting
- **state_machine_engine** (Batch 407): Finite state machines — guard conditions, transition actions, context accumulation, full history

### Batches 398-402 — Identity & Authentication
- **token_issuer** (Batch 398): JWT/API-key issuance — RS256/ES256/EdDSA signing, token lifecycle, revocation with reason tracking
- **permission_engine** (Batch 399): Fine-grained permission evaluation — wildcard matching, multiple strategies, batch evaluation, check history
- **role_manager** (Batch 400): Hierarchical role management — role inheritance, permission bundling, subject assignment with expiry
- **credential_vault** (Batch 401): Encrypted credential storage — AES-256-GCM, auto-rotation, version history, full audit trail
- **oauth_manager** (Batch 402): OAuth2/OIDC provider — authorization code with PKCE, client credentials, token introspection, grant revocation

### Batches 393-397 — Security & Governance
- **access_control_manager** (Batch 393): RBAC/ABAC access policy engine — policy creation, access evaluation, MFA configuration, access logs
- **threat_detection_engine** (Batch 394): Real-time threat detection — rule creation, scanning, event investigation, sensitivity tuning
- **secret_manager** (Batch 395): Secure secret lifecycle — storage, retrieval, rotation, deletion with full access audit trail
- **encryption_engine** (Batch 396): Cryptographic operations — AES-256-GCM encryption/decryption, key generation, Ed25519 signing/verification
- **audit_trail_manager** (Batch 397): Tamper-evident audit logging — event recording, trail queries/exports, integrity verification, retention policies


### Batches 388-392 — Integration & Connectivity
- **integration-connector** (Batch 388): External API integration management with auth, health checks, retry policies, and request logging
- **service-mesh-manager** (Batch 389): Microservice mesh orchestration with discovery, routing, circuit breakers, and load balancing
- **data-sync-engine** (Batch 390): Data synchronization between heterogeneous sources with incremental, full, and bidirectional modes
- **webhook-orchestrator** (Batch 391): Webhook endpoint management with delivery tracking, retry policies, and signature verification
- **protocol-adapter** (Batch 392): Protocol translation (HTTP, gRPC, WebSocket, MQTT) with configurable payload transformation
- 5 migrations (15 new tables), 5 shared type files, 5 SKILL.md files
- 20 SUBJECT_MAP entries, 5 BK values, 20 EK values, 5 districtFor cases
- 30 task-executor switch cases + 30 handler methods
- 15 .gitattributes privacy entries, 133 tests passing

### Batches 383-387 — Automation & Workflow
- **workflow_automator** (Batch 383): Multi-step workflow execution with branching, pause/resume, and parallel steps
- **rule_engine** (Batch 384): Business rule evaluation with sequential/parallel modes and conflict resolution
- **event_reactor** (Batch 385): Event-driven subscriptions with pattern matching, replay, and dead-letter handling
- **schedule_coordinator** (Batch 386): Cron-based job scheduling with overlap policies and execution tracking
- **process_monitor** (Batch 387): Process health monitoring with metrics, alerting, and auto-restart
- 5 migration SQL files (15 new tables), 5 shared type files, 5 SKILL.md files
- 30 task-executor switch cases + 30 handler methods
- 20 SUBJECT_MAP entries, 5 BK values, 20 EK values, 5 districtFor cases
- 15 .gitattributes privacy entries, 170 tests passing


### Batches 378-382 — Knowledge & Search
- **Batch 378 — Knowledge Indexer**: document chunking, embeddings, RAG pipeline indexing, freshness checks ($12.99)
- **Batch 379 — Semantic Searcher**: hybrid search, reranking, similarity discovery, filtered retrieval ($0.05/query)
- **Batch 380 — Taxonomy Builder**: hierarchical taxonomies, entity classification, node merging, coverage validation ($14.99)
- **Batch 381 — Content Curator**: quality-scored collections, content discovery, gap analysis, publishing ($9.99)
- **Batch 382 — Insight Extractor**: finding extraction, trend tracking, insight connections, report generation ($7.99)
- 5 migration SQL files, 5 shared TypeScript type files, 5 SKILL.md files
- 20 EidolonEventKind values, 5 BuildingKind values, 5 districtFor cases
- 20 SUBJECT_MAP entries, 30 task-executor switch cases + 30 handler methods
- 15 .gitattributes privacy entries
- 170 tests — ALL PASSING

### Batches 373-377 — Data Processing & ETL
- **Batch 373 — Data Transformer**: format conversion, mapping rules, batch transforms, schema validation ($13.99)
- **Batch 374 — Pipeline Orchestrator**: multi-stage pipelines, retry policies, stage dependencies, pause/resume ($18.99)
- **Batch 375 — Data Enricher**: record augmentation from APIs/DBs/caches, source management, rate limiting ($15.99)
- **Batch 376 — ETL Scheduler**: cron-based scheduling, dependency chains, missed run policies, run history ($16.99)
- **Batch 377 — Format Converter**: file format conversion (JSON/CSV/XML/YAML/Parquet), encoding, field mappings ($11.99)
- 5 migration SQL files, 5 shared TypeScript type files, 5 SKILL.md files
- 20 EidolonEventKind values, 5 BuildingKind values, 5 districtFor cases
- 20 SUBJECT_MAP entries, 30 task-executor switch cases + 30 handler methods
- 15 .gitattributes privacy entries
- 226 tests — ALL PASSING

### Batches 368-372 — Observability & Monitoring
- **Batch 368 — Metric Aggregator**: metric collection, aggregation intervals, rollups, Prometheus export ($14.99)
- **Batch 369 — Alert Correlator**: alert firing, temporal/causal/semantic correlation, dedup, silencing ($17.99)
- **Batch 370 — SLA Tracker**: SLO/SLI tracking, error budgets, burn rates, violation detection ($19.99)
- **Batch 371 — Log Analyzer**: log pattern detection, anomaly identification, cross-source correlation ($16.99)
- **Batch 372 — Performance Profiler**: CPU/memory/IO profiling, hotspot detection, flame graphs ($21.99)
- 5 migration SQL files, 5 shared TypeScript type files, 5 SKILL.md files
- 20 EidolonEventKind values, 5 BuildingKind values, 5 districtFor cases
- 20 SUBJECT_MAP entries, 30 task-executor switch cases + 30 handler methods
- 15 .gitattributes privacy entries
- 175 tests — ALL PASSING

### Batches 363-367 — Security & Compliance
- **Batch 363 – Encryption Manager**: Key lifecycle, envelope encryption, encrypted data registry ($15.99, engineer)
- **Batch 364 – Certificate Rotator**: TLS cert issuance, renewal, zero-downtime rotation ($12.99, engineer)
- **Batch 365 – Vulnerability Assessor**: CVE scanning, CVSS scoring, remediation recommendations ($18.99, analyst)
- **Batch 366 – Compliance Reporter**: SOC2/GDPR/HIPAA reporting with evidence collection ($24.99, analyst)
- **Batch 367 – Identity Resolver**: Federated identity resolution across OAuth2/SAML/LDAP/OIDC ($13.99, engineer)
- 5 migration SQL files, 5 shared TypeScript type modules, 5 SKILL.md files
- 5 BK values, 20 EK values, 5 districtFor cases, 20 SUBJECT_MAP entries
- 30 task executor switch cases + 30 handler methods
- 15 .gitattributes privacy entries, 235 tests passing


### Batches 358-362 — DevOps Infrastructure
- **Batch 358 – Session Recorder**: Records/replays agent sessions for debugging and training ($11.99, engineer)
- **Batch 359 – Artifact Builder**: Builds, versions, and stores agent-produced artifacts ($14.99, engineer)
- **Batch 360 – Tenant Provisioner**: Provisions isolated multi-tenant environments ($19.99, engineer)
- **Batch 361 – Index Optimizer**: Analyzes and optimizes database indexes ($16.99, analyst)
- **Batch 362 – Dependency Scanner**: Scans dependencies for vulnerabilities ($13.99, analyst)
- 5 migration SQL files, 5 shared TypeScript type modules, 5 SKILL.md files
- 5 BK values, 20 EK values, 5 districtFor cases, 20 SUBJECT_MAP entries
- 30 task executor switch cases + 30 handler methods
- 15 .gitattributes privacy entries, 219 tests passing

### Batches 353-357 — Platform Services
- **Event Replayer** (Batch 353): Replay event streams, create checkpoints, filter/analyze/compare/export events ($12.99)
- **Cache Warmer** (Batch 354): Warm caches, analyze hit rates, configure TTL, evict stale, predict access patterns ($10.99)
- **Job Scheduler** (Batch 355): Schedule/run/pause jobs, retry failed, list executions, analyze performance ($15.99)
- **Feature Toggle** (Batch 356): Create/evaluate/archive feature flags, update rollouts, analyze impact ($11.99)
- **Data Migrator** (Batch 357): Create/validate migration plans, execute/rollback migrations, compare schemas ($18.99)
- 5 migration SQL files, 5 shared type modules, 5 SKILL.md files
- 30 task-executor switch cases + 30 handler methods
- 5 BK + 20 EK + 5 districtFor + 20 SUBJECT_MAP entries
- 15 .gitattributes privacy entries
- 215 Jest tests — all passing


### Batches 348-352 — Observability & Infrastructure
- **log_router** (Batch 348): Log routing pipelines with filtering, sampling, and multi-destination support
- **config_sync** (Batch 349): Configuration synchronization with conflict resolution and encryption
- **health_prober** (Batch 350): Health probe management with alerting and target recovery
- **quota_enforcer** (Batch 351): Resource quota enforcement with overage policies and violation tracking
- **topology_mapper** (Batch 352): Service topology discovery, dependency mapping, and change detection
- 5 migration files, 5 shared type files, 5 SKILL.md files
- 20 EK values, 20 SUBJECT_MAP entries, 30 switch cases, 30 handler methods
- 15 .gitattributes entries, 168 tests passing

### Batches 343-347 — Developer Tooling
- **api_documenter** (Batch 343): API spec generation, doc publishing, spec validation, version diffing
- **sdk_generator** (Batch 344): SDK code generation, package builds, test execution, package publishing
- **contract_tester** (Batch 345): Contract creation, verification, breaking change detection, compatibility checks
- **mock_server** (Batch 346): Mock endpoint creation, request recording, request capture, match strategies
- **test_harness** (Batch 347): Test suite management, test execution, flaky test detection, report generation
- 5 migration SQL files (timestamps 800000-840000), 15 new tables
- 5 shared TypeScript type files with enums and interfaces
- 5 SKILL.md files ($14.99-$19.99 range, engineer/designer archetypes)
- 5 barrel exports, 5 BK values, 20 EK values, 5 districtFor cases
- 20 SUBJECT_MAP entries, 30 switch cases, 30 handler methods
- 15 .gitattributes privacy filter entries
- 150 Jest tests — all passing


### Batches 338-342 — Release Engineering
- **feature_flag** (Batch 338): Dynamic feature flags with targeting rules and gradual rollouts — $11.99
- **rollback_manager** (Batch 339): Deployment snapshots with automated rollback on failure — $15.99
- **blue_green_router** (Batch 340): Blue-green deployment slots with health-aware traffic switching — $19.99
- **chaos_tester** (Batch 341): Chaos engineering experiments with safety controls and blast radius limits — $24.99
- **deployment_gate** (Batch 342): Pre-deployment quality gates with approval workflows — $13.99
- 5 migration SQL files, 5 shared type modules, 5 SKILL.md files
- 30 task-executor switch cases + 30 handler methods
- 20 NATS SUBJECT_MAP entries, 20 EK values, 5 BK values, 5 districtFor cases
- 150 Jest tests — all passing


### Batches 333-337 — Automation & Orchestration
- **workflow_engine** (Batch 333): Workflow definitions, execution tracking, step orchestration — $18.99
- **task_scheduler** (Batch 334): Job scheduling, frequency management, run history — $12.99
- **cron_manager** (Batch 335): Cron expression management, trigger logs, entry lifecycle — $9.99
- **job_orchestrator** (Batch 336): DAG-based job orchestration, dependency resolution, dead-letter handling — $22.99
- **batch_processor** (Batch 337): Batch job processing, item tracking, progress monitoring — $16.99
- 5 migration SQL files, 5 shared type modules, 5 SKILL.md files
- 30 task-executor switch cases + 30 handler methods
- 20 NATS SUBJECT_MAP entries, 20 EK values, 5 BK values, 5 districtFor cases
- 150 Jest tests — all passing

### Batches 328-332 — Security & Intelligence
- **pentest_runner** — Automated penetration testing with scan management, finding verification, and report generation ($24.99/scan, engineer)
- **intrusion_guard** — Real-time intrusion detection with rule-based traffic monitoring and source blocking ($19.99/session, engineer)
- **rbac_enforcer** — Role-based access control enforcement with permission checking and audit trails ($15.99/policy, engineer)
- **siem_connector** — SIEM integration hub for event ingestion, enrichment, and security dashboard creation ($21.99/integration, analyst)
- **forensic_analyzer** — Digital forensics case management with evidence collection and timeline analysis ($29.99/case, analyst)
- 15 new database tables (configs + findings/events/roles/cases + reports/rules/assignments/dashboards/evidence)
- 20 new EidolonEventKind values (pntr.*, idgd.*, rbce.*, siem.*, fran.*)
- 30 new task executor cases + handler methods
- 150 tests passing

### Batches 323-327 — Observability & Monitoring
- **log_streamer**: Log streaming, aggregation, pattern alerts, and retention management ($11.99/task)
- **metrics_hub**: Metrics collection, Prometheus export, alerting rules, and window aggregation ($14.99/task)
- **event_correlator**: Event correlation, pattern detection, root cause analysis, and incident management ($19.99/task)
- **trace_collector**: Distributed tracing, bottleneck detection, service maps, and trace comparison ($16.99/task)
- **dashboard_builder**: Dashboard creation, panel layout, snapshots, sharing, and template import ($22.99/task)
- 5 migration SQL files, 5 shared type files, 5 SKILL.md files
- 30 task executor cases + 30 handler methods
- 20 NATS event subjects, 5 BK + 20 EK + 5 districtFor entries
- 150 tests passing

### Batches 318-322 — Networking & Traffic
- **network_router**: Agent network routing with route management, policy enforcement, traffic analysis, and failover ($16.99/task)
- **dns_gateway**: DNS resolution, record management, cache warming, and query analytics ($12.99/task)
- **lb_orchestrator**: Load balancer orchestration with backend management, health checks, and traffic distribution ($18.99/task)
- **cdn_proxy**: CDN proxy with cache management, content purging, origin configuration, and edge optimization ($21.99/task)
- **rate_controller**: Rate limiting with rule management, client blocking, and algorithm configuration ($13.99/task)
- 5 migration SQL files, 5 shared type files, 5 SKILL.md files
- 30 task executor cases + 30 handler methods
- 20 NATS event subjects, 5 BK + 20 EK + 5 districtFor entries
- 146 tests passing


### Batches 313-317 — Search & Analytics
- **search_indexer**: Full-text search indexing service (configs, indexes, queries) — $14.99/task
- **analytics_engine**: Analytics dataset creation, querying, ingestion, caching — $17.99/task
- **data_lakehouse**: Lakehouse table management, snapshots, compaction — $19.99/task
- **etl_pipeline**: ETL job orchestration, transforms, loads, retries — $15.99/task
- **report_generator**: Report generation, templates, scheduling, delivery — $11.99/task
- 5 migration SQL files, 5 shared type files, 5 SKILL.md files
- 20 SUBJECT_MAP entries (sidx/anle/dlkh/etlp/rgen prefixes)
- 30 task-executor switch cases + 30 handler methods
- 15 .gitattributes privacy entries
- 142 Jest tests passing


### Batches 308-312 — Container & Orchestration
- **container_builder**: Multi-stage builds, layer optimization, image scanning (migration, types, SKILL.md, 6 handlers)
- **image_registry**: Repository management, image push, garbage collection (migration, types, SKILL.md, 6 handlers)
- **orchestrator**: Deploy, scale, rollback, health checks across clusters (migration, types, SKILL.md, 6 handlers)
- **svc_mesh**: Service routing, traffic policies, circuit breakers (migration, types, SKILL.md, 6 handlers)
- **config_manager**: Encrypted config store, versioning, live reload (migration, types, SKILL.md, 6 handlers)
- 5 migrations (15 tables), 5 type files, 5 barrel exports, 5 SKILL.md files
- 20 EK values, 5 BK values, 5 districtFor cases, 20 SUBJECT_MAP entries
- 30 task-executor switch cases + 30 handler methods
- 15 .gitattributes privacy entries — 141 tests passing



### Batches 303-307 — Message Queue & Streaming
- **msg_relay**: Message relay channels, DLQ processing, batch flushing (migration, types, SKILL.md, 6 handlers)
- **stream_ingester**: Stream partition management, checkpoint saving, lag detection (migration, types, SKILL.md, 6 handlers)
- **event_router**: Event routing rules, fanout, dead-lettering (migration, types, SKILL.md, 6 handlers)
- **queue_manager**: Queue lifecycle, depth monitoring, metrics recording (migration, types, SKILL.md, 6 handlers)
- **pubsub_gateway**: Topic/subscription management, message publishing, ack timeouts (migration, types, SKILL.md, 6 handlers)
- 5 migrations (15 tables), 5 type files, 5 barrel exports, 5 SKILL.md files
- 20 EK values, 5 BK values, 5 districtFor cases, 20 SUBJECT_MAP entries
- 30 task-executor switch cases + 30 handler methods
- 15 .gitattributes privacy entries — 141 tests passing


### Batches 298-302 — Security & Compliance
- **vuln_scanner**: Vulnerability scanning and remediation ($14.99, analyst)
- **credential_rotator**: Credential rotation and vault management ($11.99, engineer)
- **compliance_auditor**: Compliance framework auditing and reporting ($19.99, analyst)
- **rbac_controller**: Role-based access control management ($13.99, engineer)
- **policy_enforcer**: Policy enforcement and decision logging ($15.99, analyst)

### Batches 293-297 — Database Administration Tools
- **schema_migrator**: Database schema migration and version control ($15.99, engineer)
- **query_tuner**: SQL query analysis and optimization ($16.99, analyst)
- **backup_scheduler**: Automated database backup and restore ($12.99, engineer)
- **replication_manager**: Database replication and failover management ($18.99, engineer)
- **pool_manager**: Connection pool management and optimization ($11.99, engineer)

### Batches 288-292 — Observability & Monitoring
- **metric_exporter**: Metrics collection, export, and alerting ($12.99, analyst)
- **log_shipper**: Log aggregation, pipeline management, and shipping ($11.99, engineer)
- **alert_manager**: Alert routing, deduplication, and incident management ($13.99, analyst)
- **incident_responder**: Automated incident response and remediation ($17.99, engineer)
- **uptime_monitor**: Endpoint uptime monitoring and SLA tracking ($9.99, analyst)

### Batches 283-287 — CI/CD Pipeline Tools
- **pipeline_runner**: CI/CD pipeline orchestration and execution ($16.99, engineer)
- **test_orchestrator**: Automated test suite orchestration and coverage ($13.99, analyst)
- **deploy_manager**: Deployment with health checks and rollback ($18.99, engineer)
- **rollback_controller**: Automated rollback with snapshot management ($15.99, engineer)
- **release_gatekeeper**: Release quality gates and promotion ($14.99, analyst)

### Batches 278-282 — Cloud Infrastructure
- **cloud_provisioner**: Multi-provider cloud resource provisioning and scaling ($19.99, engineer)
- **vm_orchestrator**: VM lifecycle, snapshots, and live migration ($14.99, engineer)
- **registry_manager**: Container and package registry management ($11.99, engineer)
- **image_builder**: Automated container image building and optimization ($12.99, engineer)
- **artifact_store**: Versioned artifact storage with access control ($7.99, engineer)

### Batches 273-277 — Network Security Tools
- **traffic_classifier**: Deep packet inspection and flow classification ($9.99, analyst)
- **qos_enforcer**: QoS policy enforcement and traffic shaping ($12.99, engineer)
- **acl_auditor**: ACL auditing, shadow detection, and optimization ($14.99, analyst)
- **firewall_policy**: Firewall rule management and change control ($15.99, engineer)
- **port_mapper**: Network port scanning and service discovery ($8.99, analyst)

### Batches 268-272 — Network Diagnostics
- **packet_sniffer**: Capture & dissect network packets ($11.99, engineer)
- **bandwidth_monitor**: Real-time bandwidth utilization tracking ($7.99, analyst)
- **latency_probe**: Multi-protocol latency measurement ($6.99, analyst)
- **jitter_analyzer**: Jitter sampling and MOS quality reports ($8.99, analyst)
- **packet_loss_tracker**: Loss detection and trend analysis ($7.99, analyst)


### Batches 263-267 — Network Monitoring
- **Batch 263 — Network Tap**: agent_tap_configs/sessions/filters tables, BPF capture + mirroring, 6 task handlers, SKILL.md (8.99)
- **Batch 264 — Flow Collector**: agent_flow_configs/records/reports tables, NetFlow/IPFIX collection, 6 task handlers, SKILL.md (9.99)
- **Batch 265 — sFlow Agent**: agent_sflow_configs/counters/samples tables, sFlow sampling + polling, 6 task handlers, SKILL.md (7.99)
- **Batch 266 — NetFlow Exporter**: agent_netflow_configs/templates/stats tables, flow export + templates, 6 task handlers, SKILL.md (6.99)
- **Batch 267 — ARP Inspector**: agent_arp_configs/bindings/violations tables, ARP spoofing prevention, 6 task handlers, SKILL.md (10.99)
- 20 SUBJECT_MAP entries, 5 BK/EK/districtFor values, 15 .gitattributes entries, 87 tests passing


### Batches 258-262 — Network Advanced Services
- **Batch 258 — Service Mesh**: agent_mesh_configs/services/traffic_rules tables, mTLS + sidecar modes, 6 task handlers, SKILL.md (12.99)
- **Batch 259 — WAN Optimizer**: agent_wan_configs/tunnels/metrics tables, compression + dedup, 6 task handlers, SKILL.md (11.99)
- **Batch 260 — Link Aggregator**: agent_lag_groups/members/stats tables, LACP + bonding modes, 6 task handlers, SKILL.md (8.99)
- **Batch 261 — Protocol Gateway**: agent_proto_gateways/mappings/metrics tables, protocol translation, 6 task handlers, SKILL.md (9.99)
- **Batch 262 — VLAN Manager**: agent_vlan_configs/ports/acls tables, VLAN segmentation + ACLs, 6 task handlers, SKILL.md (7.99)
- 20 SUBJECT_MAP entries, 5 BK/EK/districtFor values, 15 .gitattributes entries, 90 tests passing


### Batches 253-257 — Network Services Core
- **Batch 253 — Load Balancer**: agent_lb_configs/backends/metrics tables, LbAlgorithm types, 6 task handlers, SKILL.md (9.99)
- **Batch 254 — Health Checker**: agent_health_targets/results/incidents tables, HealthCheckType types, 6 task handlers, SKILL.md (5.99)
- **Batch 255 — Reverse Proxy**: agent_proxy_configs/upstreams/access_logs tables, ProxyStatus types, 6 task handlers, SKILL.md (8.99)
- **Batch 256 — NAT Gateway**: agent_nat_configs/rules/translations tables, NatType types, 6 task handlers, SKILL.md (7.99)
- **Batch 257 — Traffic Shaper**: agent_shaper_policies/rules/stats tables, ShaperPriorityClass types, 6 task handlers, SKILL.md (10.99)
- 20 SUBJECT_MAP entries, 5 BK/EK/districtFor values, 15 .gitattributes entries, 95 tests passing

### Batches 248-252 — Network Infrastructure Extended
- **Batch 248 — Network Auditor**: agent_audit_scans/findings/reports tables, AuditScanType/FindingSeverity types, SKILL.md (12.99/analyst), 6 task handlers, 4 NATS subjects
- **Batch 249 — Connection Pooler**: agent_connection_pools/pool_connections/pool_metrics tables, PoolBackendType/ConnectionState types, SKILL.md (6.99/engineer), 6 task handlers, 4 NATS subjects
- **Batch 250 — IP Allocator**: agent_ip_pools/ip_allocations/ip_audit_log tables, IpPoolStatus/IpAllocationType types, SKILL.md (4.99/engineer), 6 task handlers, 4 NATS subjects
- **Batch 251 — Port Scanner**: agent_scan_targets/scan_results/port_services tables, PortScanType/PortRiskLevel types, SKILL.md (8.99/analyst), 6 task handlers, 4 NATS subjects
- **Batch 252 — Edge Router**: agent_edge_configs/edge_routes/edge_access_logs tables, EdgeTlsMode/EdgeCacheStatus types, SKILL.md (11.99/engineer), 6 task handlers, 4 NATS subjects

### Batches 243-247 — Network Infrastructure Advanced
- **Batch 243 – Proxy Manager**: Reverse/forward proxy orchestration, rule management, access logging (3 tables, 6 task handlers)
- **Batch 244 – VPN Provisioner**: WireGuard/OpenVPN tunnel provisioning, peer management, connection monitoring (3 tables, 6 task handlers)
- **Batch 245 – Bandwidth Optimizer**: Traffic shaping, QoS allocation, utilization monitoring (3 tables, 6 task handlers)
- **Batch 246 – Latency Analyzer**: Network latency measurement, baseline tracking, anomaly detection (3 tables, 6 task handlers)
- **Batch 247 – Packet Inspector**: Deep packet inspection, capture management, anomaly classification (3 tables, 6 task handlers)
- 15 new DB tables, 5 shared type files, 5 SKILL.md files, 30 task executor handlers, 20 SUBJECT_MAP entries, 5 BK + 20 EK values, 165 tests passing


### Batches 238-242 — Network Infrastructure
- **Batch 238 – Certificate Authority**: SSL/TLS certificate lifecycle — issuance, renewal, revocation, auditing
- **Batch 239 – Geo Locator**: IP geolocation lookups, compliance checks, geographic restrictions
- **Batch 240 – DDoS Protector**: DDoS policy management, attack detection, incident mitigation, metrics
- **Batch 241 – API Gateway Manager**: API route management, consumer keys, traffic analytics, versioning
- **Batch 242 – Endpoint Monitor**: Endpoint health checks, uptime reporting, alert management
- 5 migration SQL files, 5 shared TypeScript type modules, 5 SKILL.md files
- 5 BK values, 20 EK values, 5 districtFor cases, 20 SUBJECT_MAP entries
- 30 task-executor switch cases + 30 handler methods
- 15 .gitattributes privacy entries — 117 tests passing


### Batches 233-237: Security Access Control
- **access_auditor** (Batch 233): Access logging and monitoring — audit logs, pattern detection, anomaly alerts, report generation
- **permission_manager** (Batch 234): RBAC permissions — role creation, role assignment, permission checks, audit, revocation
- **token_validator** (Batch 235): Token lifecycle — JWT/API key/OAuth2 config, issuance, validation, revocation, rotation
- **session_enforcer** (Batch 236): Session enforcement — policies, concurrent limits, timeouts, IP/geo restrictions, violations
- **network_firewall** (Batch 237): Network security — firewall rules, zone management, traffic logging, rule testing
- 5 migration SQL files, 5 shared type modules, 5 SKILL.md files
- 20 SUBJECT_MAP entries, 10 BK/EK/districtFor values
- 30 task executor switch cases + 30 handler methods
- 177 tests passing


### Batches 228-232: Security Operations
- **policy_engine** (Batch 228): Security policy management — creation, evaluation, exceptions, enforcement modes, auditing
- **data_classifier** (Batch 229): Data classification — sensitivity labeling, automatic rules, lineage tracking, inventory export
- **encryption_gateway** (Batch 230): Encryption operations — secure channels, encrypt/decrypt/sign/verify, certificates, key rotation
- **security_scanner** (Batch 231): Vulnerability scanning — profiles, scan execution, findings review, remediation, scheduling, trend comparison
- **incident_manager** (Batch 232): Incident response — creation, response actions, escalation, resolution, post-mortems, querying
- 5 migration SQL files, 5 shared type modules, 5 SKILL.md files
- 20 SUBJECT_MAP entries, 10 BK/EK/districtFor values
- 30 task executor switch cases + 30 handler methods
- 135 tests passing


### Batches 223-227: Security Governance
- **identity_provider** (Batch 223): Identity management — OAuth2/SAML/OIDC/LDAP provider config, sessions, identity mapping, authentication
- **key_manager** (Batch 224): Encryption key lifecycle — generation, rotation, revocation, encrypt/decrypt, usage auditing
- **audit_logger** (Batch 225): Security audit logging — log creation, policy management, querying, alerting, retention, export
- **compliance_checker** (Batch 226): Regulatory compliance — framework management, checks, reporting, violation tracking, remediation, certification
- **threat_detector** (Batch 227): Threat detection & response — rule creation, detection, response, investigation, mitigation, reporting
- 5 migration SQL files, 5 shared type modules, 5 SKILL.md files
- 20 SUBJECT_MAP entries, 10 BK/EK/districtFor values
- 30 task executor switch cases + 30 handler methods
- 135 tests passing


### Batches 218-222: Advanced Network Security
- **ssl_manager** (Batch 218): SSL/TLS certificate lifecycle — issuance, renewal, audit, protocol config, expiry monitoring, revocation
- **session_manager** (Batch 219): Session management — creation, refresh, termination, policy enforcement, audit, bulk expiry
- **endpoint_resolver** (Batch 220): Service endpoint resolution — registration, resolution, health checks, routing, deregistration, service listing
- **vulnerability_scanner** (Batch 221): Security vulnerability scanning — full/quick/dependency scans, CVE tracking, remediation, compliance checks
- **traffic_analyzer** (Batch 222): Network traffic analysis — capture, pattern analysis, reporting, threat detection, forensics, baselining
- 5 migration SQL files, 5 shared type modules, 5 SKILL.md files
- 20 SUBJECT_MAP entries, 10 BK/EK/districtFor values
- 30 task executor switch cases + 30 handler methods
- 136 tests passing


### Batches 213-217: Network Security & Monitoring
- **network_monitor** (Batch 213): Network monitoring endpoints, health checks, alert configuration, uptime reports, metrics collection
- **packet_analyzer** (Batch 214): Packet capture sessions, traffic analysis, filtering rules, anomaly scanning, data export
- **bandwidth_controller** (Batch 215): Bandwidth policies, quota management, usage reporting, traffic shaping, throttling
- **firewall_manager** (Batch 216): Firewall rulesets, rule management, traffic evaluation, security audits, threat review
- **proxy_server** (Batch 217): Proxy endpoints, access control rules, cache configuration, traffic analytics, upstream rotation

### Batches 208–212: Network Infrastructure
- **Batch 208 — Message Broker**: broker connections, topic lifecycle, pub/sub subscriptions, consumer lag monitoring, partition rebalancing
- **Batch 209 — Cache Manager**: store provisioning, eviction policies, cache warming, hit-rate metrics, pattern invalidation, tiered caching
- **Batch 210 — Traffic Router**: path-based routing, traffic rules (rate limit, geo-block, circuit break), canary deployments, A/B testing, analytics
- **Batch 211 — DNS Resolver**: zone management, record CRUD (A/AAAA/CNAME/MX/TXT/SRV), DNSSEC, query analytics, propagation checks
- **Batch 212 — Config Server**: namespaced config, environment isolation, secret encryption, change auditing, config diffing, rollback
- 5 migration SQL files, 5 shared TypeScript type modules, 5 SKILL.md files
- 5 EidolonBuildingKind values, 20 EidolonEventKind values, 20 SUBJECT_MAP entries
- 5 districtFor cases, 30 task-executor switch cases, 30 handler methods
- 15 .gitattributes privacy entries, 178 Jest tests — all passing


### Batches 203–207 — Data Infrastructure
- **Batch 203 – Stream Processor**: real-time data streaming with sources, transforms, sinks
- **Batch 204 – Schema Validator**: schema definitions, validations, evolution checks
- **Batch 205 – ETL Processor**: ETL pipelines, runs, schedules with full lifecycle
- **Batch 206 – Data Catalog**: data asset registry, lineage tracking, quality profiling
- **Batch 207 – Query Optimizer**: query analysis, suggestions, plan caching
- 5 migrations, 5 shared types, 5 SKILL.md, 5 BK values, 20 EK values
- 20 SUBJECT_MAP entries, 30 task-executor cases, 30 handler methods
- 15 .gitattributes entries, 157 passing tests


### Batches 198–202: Service Infrastructure
- **Service Registry** (Batch 198): service discovery, health checks, endpoint management
- **Ingress Controller** (Batch 199): traffic routing, TLS termination, CORS, rate limiting
- **Fault Injector** (Batch 200): chaos engineering, resilience testing, fault reports
- **Connection Pool** (Batch 201): pool management, health monitoring, utilization metrics
- **Retry Handler** (Batch 202): retry policies, backoff strategies, dead-letter queues
- 5 migrations, 5 shared types, 5 SKILL.md, 5 barrel exports
- 5 BK values, 20 EK values, 20 SUBJECT_MAP entries, 30 switch cases, 30 handlers
- 15 .gitattributes entries, 180 Jest tests — all passing


### Batches 193–197: Observability & Configuration
- **Log Aggregator** (Batch 193): log sources, entries, pipelines with multi-format parsing
- **Metric Collector** (Batch 194): Prometheus/StatsD/OTel metric sources, time-series, threshold alerts
- **Alert Dispatcher** (Batch 195): multi-channel notification routing, escalation, incident lifecycle
- **Trace Analyzer** (Batch 196): distributed tracing configs, span collection, latency/bottleneck analysis
- **Config Validator** (Batch 197): schema validation, config drift detection, compliance enforcement
- 5 migrations, 5 shared types, 5 SKILL.md, 5 barrel exports
- 5 BK values, 20 EK values, 20 SUBJECT_MAP entries, 30 switch cases, 30 handlers
- 15 .gitattributes entries, 224 Jest tests — all passing


### Batches 188–192: Security & Networking
- **Credential Manager** (Batch 188): credential stores, key rotation, leak detection, audit trails
- **Certificate Manager** (Batch 189): CA management, certificate issuance, renewal, chain verification
- **VPN Gateway** (Batch 190): WireGuard/OpenVPN/IPSec networks, peer management, tunnel diagnostics
- **Proxy Router** (Batch 191): upstream management, route configuration, rate limiting, traffic analysis
- **Access Controller** (Batch 192): RBAC/ABAC policies, role management, access grants, violation detection
- 5 migrations, 5 shared types, 5 SKILL.md, 5 barrel exports
- 5 BK values, 20 EK values, 20 SUBJECT_MAP entries, 30 switch cases, 30 handlers
- 15 .gitattributes entries, 227 Jest tests — all passing


### Batch 183-187: Operations & Security
- **Patch Manager** (Batch 183): Software patch policies, CVE rollouts, compliance tracking, vulnerability scanning — agent_patch_policies, agent_patch_releases, agent_patch_compliance tables
- **Firewall Controller** (Batch 184): Firewall rulesets, security groups, network rules, threat detection/blocking — agent_firewall_rulesets, agent_firewall_rules, agent_firewall_threats tables
- **Backup Orchestrator** (Batch 185): Backup plans, scheduled/manual jobs, disaster recovery, restoration verification — agent_backup_plans, agent_backup_jobs, agent_backup_restores tables
- **Storage Optimizer** (Batch 186): Storage volume analysis, deduplication, tiering, cost optimization, lifecycle management — agent_storage_volumes, agent_storage_analyses, agent_storage_actions tables
- **Health Monitor** (Batch 187): Service health endpoints, uptime tracking, incident detection, SLA monitoring — agent_health_endpoints, agent_health_checks, agent_health_incidents tables
- 5 migrations, 5 shared type modules, 5 SKILL.md files, 5 barrel exports
- Eidolon: 5 BK (patch_manager, firewall_controller, backup_orchestrator, storage_optimizer, health_monitor), 20 EK, 5 districtFor
- Event-bus: 20 new SUBJECT_MAP entries
- Task executor: 30 new switch cases + 30 handler methods
- .gitattributes: 15 new privacy filter entries
- 195 Jest tests — all passing

### Batch 178-182: Infrastructure Operations
- **Quota Enforcement** (Batch 178): Resource quota policies, usage tracking, enforcement actions, overage handling — agent_quota_policies, agent_quota_usage, agent_quota_alerts tables
- **Runbook Automation** (Batch 179): Operational runbooks with step-by-step execution, approval gates, rollback — agent_runbooks, agent_runbook_executions, agent_runbook_approvals tables
- **Network Scanner** (Batch 180): Network discovery, port scanning, vulnerability detection, topology mapping — agent_network_scans, agent_network_hosts, agent_network_vulnerabilities tables
- **DNS Manager** (Batch 181): DNS zone management, record CRUD, health checks, failover — agent_dns_zones, agent_dns_records, agent_dns_health_checks tables
- **Inventory Sync** (Batch 182): Infrastructure asset tracking, sync jobs, change detection, environment comparison — agent_inventory_assets, agent_inventory_sync_jobs, agent_inventory_changes tables
- 5 migrations, 5 shared type modules, 5 SKILL.md files, 5 barrel exports
- Eidolon: 5 BK (quota_gate, runbook_forge, network_scanner, dns_tower, inventory_depot), 20 EK, 5 districtFor
- Event-bus: 20 new SUBJECT_MAP entries
- Task executor: 30 new switch cases + 30 handler methods (totals: 969 cases, 759 handlers)
- .gitattributes: 15 new privacy filter entries (total: 659 lines)
- 222 Jest tests — all passing

### Batches 173-177 — Agent Ops & Security
- **Cost Anomaly** (Batch 173): Budget tracking, anomaly detection, forecast spending, cost optimization (migration, types, SKILL.md, 6 task handlers)
- **Drift Remediation** (Batch 174): Baseline management, drift scanning, auto-remediation, escalation workflows (migration, types, SKILL.md, 6 task handlers)
- **Log Correlation** (Batch 175): Rule-based log correlation, incident investigation, timeline builder, root cause analysis (migration, types, SKILL.md, 6 task handlers)
- **Webhook Manager** (Batch 176): Endpoint registration, delivery management, signature verification, retry policies (migration, types, SKILL.md, 6 task handlers)
- **Certificate Manager** (Batch 177): Certificate inventory, renewal workflows, expiry monitoring, chain verification (migration, types, SKILL.md, 6 task handlers)
- 20 new SUBJECT_MAP entries in event-bus (cost, drift, logcorr, webhook, cert domains)
- 5 new EidolonBuildingKind values, 20 new EidolonEventKind values, 5 districtFor cases
- 30 new task-executor switch cases + 30 handler methods (939 total cases, 729 handlers)
- 15 new .gitattributes privacy filter entries (634 total lines)
- 215 Jest tests — all passing


### Batch 168-172 — Agent Infrastructure Operations (Topology Map, Forensic Analysis, Patch Management, Access Review, Release Train)
- **Batch 168**: Agent Topology Map — topology_grid BK, 3 tables, 4 EK events, 6 task handlers
- **Batch 169**: Agent Forensic Analysis — forensic_lab BK, 3 tables, 4 EK events, 6 task handlers
- **Batch 170**: Agent Patch Management — patch_depot BK, 3 tables, 4 EK events, 6 task handlers
- **Batch 171**: Agent Access Review — access_court BK, 3 tables, 4 EK events, 6 task handlers
- **Batch 172**: Agent Release Train — release_station BK, 3 tables, 4 EK events, 6 task handlers
- 5 migration SQL files (timestamps 20260618050000–20260618090000)
- 5 shared TypeScript type modules with 30+ types total
- 5 SKILL.md definitions (infrastructure + operations + security + analyst)
- 20 SUBJECT_MAP entries in event-bus (total ~636)
- 30 switch cases + 30 handler methods in task-executor (total ~909/699)
- 15 .gitattributes privacy entries (total ~614)
- 176 Jest tests — all passing


### Batch 163-167 — Agent Platform (Runtime Sandbox, Secret Rotation, Traffic Mirror, Compliance Report, Capacity Planning)
- **Batch 163**: Agent Runtime Sandbox — sandbox_pod BK, 3 tables, 4 EK events, 6 task handlers
- **Batch 164**: Agent Secret Rotation — secret_rotator BK, 3 tables, 4 EK events, 6 task handlers
- **Batch 165**: Agent Traffic Mirror — mirror_tap BK, 3 tables, 4 EK events, 6 task handlers
- **Batch 166**: Agent Compliance Report — compliance_desk BK, 3 tables, 4 EK events, 6 task handlers
- **Batch 167**: Agent Capacity Planning — capacity_planner BK, 3 tables, 4 EK events, 6 task handlers
- 5 migration SQL files (timestamps 20260618000000–20260618040000)
- 5 shared TypeScript type modules with 25+ types total
- 5 SKILL.md definitions
- 20 SUBJECT_MAP entries in event-bus (total ~616)
- 30 switch cases + 30 handler methods in task-executor (total ~879/669)
- 15 .gitattributes privacy entries (total ~589)
- 107 Jest tests — all passing


### Batch 158-162 — Agent Operations (Telemetry Export, Cost Allocation, Network Policy, Disaster Recovery, Performance Profiling)
- **Batch 158**: Agent Telemetry Export — telemetry_hub BK, 3 tables, 4 EK events, 6 task handlers
- **Batch 159**: Agent Cost Allocation — cost_ledger BK, 3 tables, 4 EK events, 6 task handlers
- **Batch 160**: Agent Network Policy — net_firewall BK, 3 tables, 4 EK events, 6 task handlers
- **Batch 161**: Agent Disaster Recovery — recovery_vault BK, 3 tables, 4 EK events, 6 task handlers
- **Batch 162**: Agent Performance Profiling — perf_lab BK, 3 tables, 4 EK events, 6 task handlers
- 5 migration SQL files (timestamps 20260617950000–20260617990000)
- 5 shared TypeScript type modules with 25+ types total
- 5 SKILL.md definitions
- 20 SUBJECT_MAP entries in event-bus
- 30 switch cases + 30 handler methods in task-executor
- 15 .gitattributes privacy entries
- 143 Jest tests — all passing


### Batch 153-157 — Agent Resilience (Circuit Breaker, Rate Limiter, Canary Deploy, Feature Flags, Chaos Testing)
- **Batch 153**: Agent Circuit Breaker — circuit_panel BK, 3 tables, 4 EK events, 6 task handlers
- **Batch 154**: Agent Rate Limiter — rate_gate BK, 3 tables, 4 EK events, 6 task handlers
- **Batch 155**: Agent Canary Deploy — canary_tower BK, 3 tables, 4 EK events, 6 task handlers
- **Batch 156**: Agent Feature Flags — flag_control BK, 3 tables, 4 EK events, 6 task handlers
- **Batch 157**: Agent Chaos Testing — chaos_arena BK, 3 tables, 4 EK events, 6 task handlers
- 5 migration SQL files (timestamps 20260617900000–20260617940000)
- 5 shared TypeScript type modules with 25+ types total
- 5 SKILL.md definitions
- 20 SUBJECT_MAP entries in event-bus
- 30 switch cases + 30 handler methods in task-executor
- 15 .gitattributes privacy entries
- 145 Jest tests — all passing


### Batch 152 — Agent Federation Protocol
- Migration: `20260617890000_agent_federation_protocol.sql` (3 tables, 6 indexes)
- Types: FederationPeer, FederationLink, FederationMessage, FederationProtocolStats
- Skill: `agent-federation-protocol` — cross-instance agent federation
- Eidolon: `federation_hub` BK, 4 EK events, districtFor → civic
- Event-bus: 4 SUBJECT_MAP entries (sven.federation.*)
- Task executor: 6 switch cases + 6 handler methods

### Batch 151 — Agent Service Discovery
- Migration: `20260617880000_agent_service_discovery.sql` (3 tables, 6 indexes)
- Types: ServiceRegistryEntry, DiscoveryProbe, ServiceDependency, ServiceDiscoveryStats
- Skill: `agent-service-discovery` — auto-discover agent capabilities
- Eidolon: `discovery_beacon` BK, 4 EK events, districtFor → civic
- Event-bus: 4 SUBJECT_MAP entries (sven.discovery.*)
- Task executor: 6 switch cases + 6 handler methods

### Batch 150 — Agent Inventory Tracking
- Migration: `20260617870000_agent_inventory_tracking.sql` (3 tables, 6 indexes)
- Types: AgentInventoryItem, InventoryTransaction, InventoryReservation, InventoryTrackingStats
- Skill: `agent-inventory-tracking` — track digital assets and resources
- Eidolon: `inventory_vault` BK, 4 EK events, districtFor → market
- Event-bus: 4 SUBJECT_MAP entries (sven.inventory.*)
- Task executor: 6 switch cases + 6 handler methods

### Batch 149 — Agent Hot Patching
- Migration: `20260617860000_agent_hot_patching.sql` (3 tables, 6 indexes)
- Types: AgentPatch, PatchChain, PatchAuditEntry, HotPatchingStats
- Skill: `agent-hot-patching` — live agent behavior modification
- Eidolon: `patch_workshop` BK, 4 EK events, districtFor → civic
- Event-bus: 4 SUBJECT_MAP entries (sven.hotpatch.*)
- Task executor: 6 switch cases + 6 handler methods

### Batch 148 — Agent Mesh Routing
- Migration: `20260617850000_agent_mesh_routing.sql` (3 tables, 6 indexes)
- Types: MeshRouteTable, MeshRouteEntry, MeshRouteLog, MeshRoutingStats
- Skill: `agent-mesh-routing` — intelligent mesh network routing
- Eidolon: `mesh_router` BK, 4 EK events, districtFor → civic
- Event-bus: 4 SUBJECT_MAP entries (sven.meshroute.*)
- Task executor: 6 switch cases + 6 handler methods


### Batch 137 — Agent Asset Management
- Migration: `20260617740000_agent_asset_management.sql` (digital_assets, asset_transfers, asset_licenses)
- Shared types: AssetCategory, DigitalAsset, AssetTransfer, AssetLicense, AssetManagementStats
- Skill: `skills/agent-asset-management/SKILL.md`
- Eidolon: BK `asset_vault`, 4 EK events, districtFor → civic
- Task executor: 6 handlers (register, transfer, grant_license, deprecate, list, report)

### Batch 136 — Agent Blue-Green Deployment
- Migration: `20260617730000_agent_blue_green.sql` (blue_green_deployments, blue_green_switches, traffic_splits)
- Shared types: BlueGreenStage, BlueGreenDeployment, BlueGreenSwitch, TrafficSplit, BlueGreenStats
- Skill: `skills/agent-blue-green/SKILL.md`
- Eidolon: BK `deploy_gateway`, 4 EK events, districtFor → civic
- Task executor: 6 handlers (deploy_version, switch_stage, shift_traffic, rollback, list, report)

### Batch 135 — Agent Change Management
- Migration: `20260617720000_agent_change_management.sql` (change_requests, change_approvals, change_rollbacks)
- Shared types: ChangeRequestType, ChangeRequest, ChangeApproval, ChangeRollback, ChangeManagementStats
- Skill: `skills/agent-change-management/SKILL.md`
- Eidolon: BK `change_bureau`, 4 EK events, districtFor → civic
- Task executor: 6 handlers (submit_request, approve, complete_change, rollback, list, report)

### Batch 134 — Agent Audit Trail
- Migration: `20260617710000_agent_audit_trail.sql` (audit_trail_entries, audit_snapshots, audit_retention_policies)
- Shared types: AuditTrailAction, TrailEntry, AuditSnapshot, AuditRetentionPolicy, AuditTrailStats
- Skill: `skills/agent-audit-trail/SKILL.md`
- Eidolon: BK `audit_archive`, 4 EK events, districtFor → civic
- Task executor: 6 handlers (log_entry, take_snapshot, apply_retention, search, list, report)

### Batch 133 — Agent Geo-Fencing
- Migration: `20260617700000_agent_geo_fencing.sql` (geo_fence_zones, geo_fence_rules, geo_fence_alerts)
- Shared types: GeoFenceType, GeoFenceZone, GeoFenceRule, GeoFenceAlert, GeoFencingStats
- Skill: `skills/agent-geo-fencing/SKILL.md`
- Eidolon: BK `geo_watchtower`, 4 EK events, districtFor → civic
- Task executor: 6 handlers (create_zone, evaluate_location, trigger_rule, update_policy, list, report)

### Added — Batch 128: Agent Feature Flags
- Migration: `20260617650000_agent_feature_flags.sql` — 3 tables (flags, evaluations, audit_log)
- Shared types: FeatureFlagType, ManagedFeatureFlag, ManagedFlagEvaluation, FlagAuditEntry, FeatureFlagStats
- Skill: `agent-feature-flags` — create, evaluate, toggle, rollout management
- Eidolon: BK `flag_tower`, 4 EK events, districtFor civic, 4 SUBJECT_MAP entries
- Task executor: 6 handlers (create, evaluate, toggle, update_rollout, list, report)

### Added — Batch 129: Agent Health Monitoring
- Migration: `20260617660000_agent_health_monitoring.sql` — 3 tables (checks, events, uptime)
- Shared types: HealthCheckType, ServiceHealthCheck, HealthEvent, UptimeRecord, HealthMonitoringStats
- Skill: `agent-health-monitoring` — create check, run, uptime, SLA reports
- Eidolon: BK `health_beacon`, 4 EK events, districtFor civic, 4 SUBJECT_MAP entries
- Task executor: 6 handlers (create_check, run_check, get_uptime, sla_report, list, report)

### Added — Batch 130: Agent Cost Optimization
- Migration: `20260617670000_agent_cost_optimization.sql` — 3 tables (reports, recommendations, alerts)
- Shared types: CostReportPeriod, CloudCostProvider, CostReport, CostRecommendation, BudgetAlert, CostOptimizationStats
- Skill: `agent-cost-optimization` — reports, recommendations, budgets, trends
- Eidolon: BK `cost_bureau`, 4 EK events, districtFor civic, 4 SUBJECT_MAP entries
- Task executor: 6 handlers (generate_report, get_recommendations, apply, set_budget, trend, report)

### Added — Batch 131: Agent Data Pipeline
- Migration: `20260617680000_agent_data_pipeline.sql` — 3 tables (pipelines, runs, transforms)
- Shared types: PipelineType, PipelineSourceType, PipelineSinkType, DataPipeline, PipelineRun, DataPipelineStats
- Skill: `agent-data-pipeline` — create, run, transform, monitor pipelines
- Eidolon: BK `data_forge`, 4 EK events, districtFor civic, 4 SUBJECT_MAP entries
- Task executor: 6 handlers (create, run, add_transform, get_status, list, report)

### Added — Batch 132: Agent Notification Router
- Migration: `20260617690000_agent_notification_router.sql` — 3 tables (channels, rules, log)
- Shared types: NotificationChannelType, NotificationSeverity, NotifChannel, NotificationRule, NotificationRouterStats
- Skill: `agent-notification-router` — channels, rules, send, delivery tracking
- Eidolon: BK `alert_hub`, 4 EK events, districtFor civic, 4 SUBJECT_MAP entries
- Task executor: 6 handlers (create_channel, create_rule, send, get_delivery, list, report)

### Added — Batch 118: Container Registry
- Migration: `20260617550000_agent_container_registry.sql` — 3 tables, 6 indexes
- Shared types: RegistryAuthType, ContainerRegistry, ContainerImage, ImageVulnerability
- Skill: agent-container-registry — private registry management and vulnerability scanning
- Eidolon: container_yard building, 4 event kinds, NATS subjects
- Task executor: 5 handlers (registry_create, push_image, scan_vulns, list_images, report)

### Added — Batch 119: Service Mesh
- Migration: `20260617560000_agent_service_mesh.sql` — 3 tables, 6 indexes
- Shared types: MeshProtocol, MeshService, MeshRoute, MeshPolicy
- Skill: agent-service-mesh — routing, mTLS, policies, circuit breakers
- Eidolon: mesh_nexus building, 4 event kinds, NATS subjects
- Task executor: 6 handlers (register, create_route, create_policy, check_health, list, report)

### Added — Batch 120: Config Drift Detection
- Migration: `20260617570000_agent_config_drift.sql` — 3 tables, 6 indexes
- Shared types: DriftResourceType, ConfigBaseline, ConfigDriftEvent, ConfigScanJob
- Skill: agent-config-drift — baseline management, scanning, remediation
- Eidolon: drift_scanner building, 4 event kinds, NATS subjects
- Task executor: 6 handlers (create_baseline, run_scan, list_drifts, remediate, lock, report)

### Added — Batch 121: Incident Escalation
- Migration: `20260617580000_agent_incident_escalation.sql` — 3 tables, 6 indexes
- Shared types: IncidentSeverity, EscalationPolicy, AgentIncident, EscalationLog
- Skill: agent-incident-escalation — incident lifecycle and auto-escalation
- Eidolon: escalation_tower building, 5 event kinds, NATS subjects
- Task executor: 6 handlers (create_policy, open, acknowledge, escalate, resolve, report)

### Added — Batch 122: Capacity Forecasting
- Migration: `20260617590000_agent_capacity_forecasting.sql` — 3 tables, 6 indexes
- Shared types: ForecastResourceType, CapacityModel, CapacityForecast, CapacityAlert
- Skill: agent-capacity-forecasting — time-series forecasting and alerts
- Eidolon: forecast_engine building, 4 event kinds, NATS subjects
- Task executor: 6 handlers (create_model, train, forecast, check_alerts, recommendations, report)

### Added
- **Batch 123 — DNS Zone Management**: Migration, shared types (ManagedDnsZone, ManagedDnsRecord, DnsChangeLog, DnsZoneStats), SKILL.md, Eidolon dns_registry BK, 4 EK events, event-bus subjects, 6 task-executor handlers
- **Batch 124 — TLS Certificate Management**: Migration, shared types (TlsCertificate, CertChallenge, CertDeployment, TlsCertificateStats), SKILL.md, Eidolon cert_tower BK, 4 EK events, event-bus subjects, 6 task-executor handlers
- **Batch 125 — Secrets Vault**: Migration, shared types (SecretVault, VaultSecret, VaultAccessLog, SecretsVaultStats), SKILL.md, Eidolon secret_vault BK, 4 EK events, event-bus subjects, 6 task-executor handlers
- **Batch 126 — Compliance Audit**: Migration, shared types (AuditComplianceFramework, ComplianceControl, AuditReport, ComplianceAuditStats), SKILL.md, Eidolon audit_hall BK, 4 EK events, event-bus subjects, 6 task-executor handlers
- **Batch 127 — Rate Limiting**: Migration, shared types (RateLimitPolicy, RateLimitCounter, RateLimitOverride, RateLimitingStats), SKILL.md, Eidolon rate_gate BK, 4 EK events, event-bus subjects, 6 task-executor handlers
- **Batch 113 — Log Rotation**: agent_log_rotation_policies, agent_log_archives, agent_log_retention_jobs tables + shared types + SKILL.md + 6 task handlers + NATS events + Eidolon log_rotator building
- **Batch 114 — IP Allowlisting**: agent_ip_allowlists, agent_ip_rules, agent_ip_access_logs tables + shared types + SKILL.md + 6 task handlers + NATS events + Eidolon ip_gatekeeper building
- **Batch 115 — Webhook Retry**: agent_webhook_endpoints, agent_webhook_deliveries, agent_webhook_dead_letters tables + shared types + SKILL.md + 6 task handlers + NATS events + Eidolon webhook_relay building
- **Batch 116 — Storage Tiering**: agent_storage_tiers, agent_storage_lifecycle_rules, agent_storage_migrations tables + shared types + SKILL.md + 6 task handlers + NATS events + Eidolon storage_tower building
- **Batch 117 — Network Peering**: agent_peering_connections, agent_peering_routes, agent_transit_gateways tables + shared types + SKILL.md + 6 task handlers + NATS events + Eidolon peering_bridge building
- **Batch 108**: Agent Edge Computing — edge node provisioning, function deployment, latency metrics (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 109**: Agent API Versioning — version lifecycle, deprecation tracking, compatibility checks (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 110**: Agent Compliance Scanner — policy management, scan orchestration, remediation tracking (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 111**: Agent Backup Scheduling — schedule management, snapshot lifecycle, restore jobs (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 112**: Agent Traffic Shaping — traffic rules, bandwidth limits, QoS policies (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 103**: Agent Container Registry — image management, vulnerability scanning, retention policies (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 104**: Agent GraphQL Gateway — schema federation, operation analytics, query caching (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 105**: Agent Message Queue — queue lifecycle, consumer groups, dead letter queues (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 106**: Agent Canary Deployment — traffic splitting, rollback triggers, promotion (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 107**: Agent Database Replication — replica management, lag monitoring, failover (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 98**: Agent Auto-Scaling — scaling policies, metric tracking, cost optimisation (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 99**: Agent DNS Management — zone CRUD, record management, propagation tracking (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 100**: Agent SSL Certificates — cert lifecycle, auto-renewal, expiry alerts (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 101**: Agent Chaos Engineering — fault injection, resilience testing, weakness discovery (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 102**: Agent A/B Testing — experiment design, variant assignment, statistical analysis (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 97 — Agent Rate Limiting**: rate limiting policies, quotas, throttling, and violation tracking
- **Batch 96 — Agent Workflow Templates**: reusable workflow templates with steps, triggers, and execution tracking
- **Batch 95 — Agent Schema Registry**: centralized schema registry with versioning, compatibility, and evolution logging
- **Batch 94 — Agent Data Validation**: validation schemas, rules, pipelines, audit logging with 5 tables and 20 indexes
- **Batch 93 — Agent Load Balancing**: load balancers, backends, routing rules, health probes, traffic metrics with 5 tables and 20 indexes
- **Batch 92 — Agent Distributed Tracing**: traces, spans, baggage, sampling, analytics with 5 tables and 20 indexes
- **Batch 91 — Agent Health Dashboard**: health checks, dashboards, widgets, thresholds, alert rules with 5 tables and 20 indexes
- **Batch 90 — Agent Configuration Management**: config store, namespaces, versioning, validation, audit with 5 tables and 20 indexes
- **Batch 89 — Agent Event Sourcing**: event store, aggregates, projections, snapshots, replay with 5 tables and 20 indexes
- **Batch 88 — Agent Search & Indexing**: full-text search, query routing, synonyms, relevance tuning with 5 tables and 20 indexes
- **Batch 87 — Agent Content Delivery**: CDN origins, asset caching, purging, delivery analytics with 5 tables and 20 indexes
- **Batch 86 — Agent State Machine**: finite state machines, transitions, guards, templates with 5 tables and 20 indexes
- **Batch 85 — Agent Dependency Injection**: DI containers, bindings, scopes, interceptors, lifecycle with 5 tables and 20 indexes
- **Batch 84 — Agent Circuit Breaker**: circuit breaker patterns, fallbacks, resilience metrics with 5 tables and 19 indexes
- **Batch 83 — Agent Service Discovery**: service registry, health checks, endpoint cataloging, dependency tracking with 5 tables and 19 indexes
- **Batch 82 — Agent Content Moderation**: moderation policies, content reviews, appeals, queue management, action tracking with 5 tables and 21 indexes
- **Batch 75 — Agent Service Mesh & Discovery**: service registry, endpoints, dependencies, health checks, traffic policies; 5 tables, 20 indexes, 7 task handlers
- **Batch 76 — Agent Cost Optimization**: budgets, spend tracking, forecasts, recommendations, alerts; 5 tables, 20 indexes, 7 task handlers
- **Batch 77 — Agent Multi-Tenancy**: tenants, members, quotas, invitations, audit log; 5 tables, 20 indexes, 7 task handlers
- **Batch 78 — Agent Incident Management**: incidents, timeline, escalations, runbooks, postmortems; 5 tables, 21 indexes, 7 task handlers
- **Batch 79 — Agent Queue Management**: task queues, messages, consumers, schedules, metrics; 5 tables, 20 indexes, 7 task handlers
- **Batch 80 — Agent Session Management**: sessions, messages, contexts, handoffs, analytics; 5 tables, 20 indexes, 7 task handlers
- **Batch 81 — Agent Plugin System**: plugins, installations, hooks, events, reviews; 5 tables, 20 indexes, 7 task handlers
- **Batch 74 — Agent Log Aggregation & Search**: log streams, entries, filters, dashboards, alerts; 5 tables, 20 indexes, 7 task handlers
- **Batch 73 — Agent API Gateway & Routing**: API routes, gateway policies, request transformation, load balancing, and traffic analytics
- **Batch 72 — Agent Caching & CDN**: Cache policies, CDN distributions, entry management, purge workflows, and cache analytics
- **Batch 71 — Agent Pipeline Templates**: Reusable workflow templates, stage orchestration, triggers, and artifact management
- **Batch 70 — Agent Environment Configuration**: Environment profiles, config variables, templates, snapshots, and audit logging
- **Batch 69 — Agent Webhooks & External Integrations**: Outbound webhook delivery, event subscriptions, retry logic, and external integration management
- **Batch 68 — Agent Localization & i18n**: Multi-language content management, translation workflows, locale detection, and coverage tracking
- **Batch 67 — Agent Rate Limiting & Throttling**: Fair usage quotas, burst capacity management, throttle strategies, and per-agent rate limit policies
- **Batch 66 — Agent Data Export & Import**: Bulk data portability with multi-format export/import, schema registry, field mappings, and transfer progress tracking
- **Batch 65 — Agent Feature Flags & Experiments**: Toggle features, run A/B experiments with variant assignments, gradual rollouts, and metric-driven winner selection
- **Batch 64 — Agent Secrets & Credentials**: Encrypted vault for API keys, tokens, credentials with rotation policies, access auditing, and controlled sharing
- **Batch 63 — Agent Versioning & Rollback**: Semantic versioning, state snapshots, multi-slot deployments (production/staging/canary), automatic rollbacks, and version diff tracking for agents
- **Batch 62 — Agent Marketplace Recommendations**: AI-powered recommendation engine for marketplace discovery, collaborative filtering models, interaction tracking, recommendation campaigns, and feedback-driven personalization
- **Batch 61 — Agent Feedback & Surveys**: feedback submission, survey management, NPS analytics, improvement proposals, Eidolon feedback_plaza building
- **Autonomous Economy — Batch 60**: Agent Access Control & Permissions — role-based and attribute-based access control for autonomous agents with permission grants, policy evaluation, access auditing, and scope boundaries. 5 DB tables (agent_roles, agent_permissions, agent_access_policies, agent_access_audit, agent_scopes), 17 indexes, 7 type unions (RoleType 5, PermissionAction 5, PermissionEffect 2, PolicyType 5, AccessDecision 5, ScopeType 5, AccessControlAction 7), 5 interfaces, 6 constants, 4 helper functions (isRoleActive, isPermissionAllowed, isAccessGranted, formatPermission), 7 skill actions (role_assign, role_revoke, permission_grant, permission_check, policy_create, audit_query, scope_define), Eidolon access_gate building kind (43 total), 4 event-bus subjects (187 total), 7 task-executor handlers (201 cases / 197 handlers total).
- **Autonomous Economy — Batch 59**: Agent Backup & Recovery — automated backup scheduling, snapshot management, recovery point creation, retention policy enforcement, and disaster recovery planning. 5 DB tables (agent_backup_jobs, agent_recovery_points, agent_retention_policies, agent_disaster_recovery_plans, agent_restore_logs), 17 indexes, 7 type unions (BackupType 5, BackupStatus 5, RecoveryType 5, RecoveryPointStatus 5, DrPriority 5, RestoreType 5, BackupRecoveryAction 7), 5 interfaces, 6 constants, 4 helper functions (isBackupComplete, isRecoveryPointUsable, isDrPlanCritical, formatBackupSize), 7 skill actions (backup_create, backup_restore, recovery_point_create, retention_set, dr_plan_create, dr_test, restore_log_query), Eidolon vault_bunker building kind (42 total), 4 event-bus subjects (183 total), 7 task-executor handlers (194 cases / 190 handlers total).
- **Autonomous Economy — Batch 58**: Agent Monitoring & Observability — real-time metrics collection, alerting, dashboards, log aggregation, and SLO tracking for autonomous agents. 5 DB tables (agent_metrics, agent_alerts, agent_dashboards, agent_log_entries, agent_slo_targets), 17 indexes, 7 type unions (MetricType 5, AlertSeverity 5, AlertStatus 5, LogLevel 5, SloTargetType 5, SloStatus 5, MonitoringAction 7), 5 interfaces, 6 constants, 4 helper functions (isAlertActionable, isSeverityCritical, isSloHealthy, formatMetricLabel), 7 skill actions (metric_record, alert_create, alert_acknowledge, dashboard_create, log_query, slo_define, slo_check), Eidolon observatory_tower building kind (41 total), 4 event-bus subjects (179 total), 7 task-executor handlers (187 cases / 183 handlers total).
- **Autonomous Economy — Batch 57**: Agent Communication & Messaging — inter-agent communication channels, threaded messaging, reactions, presence tracking, and broadcast capabilities. 5 DB tables (agent_channels, channel_members, agent_messages, message_reactions, agent_presence), 17 indexes, 7 type unions (ChannelType 5, MemberRole 5, MessageType 7, PresenceStatus 5, MessageSortBy 5, ChannelPermission 5, MessagingAction 7), 5 interfaces, 6 constants, 4 helper functions (isChannelJoinable, canManageChannel, isPresenceActive, formatMention), 7 skill actions (channel_create, channel_join, message_send, message_react, presence_update, thread_reply, broadcast_send), Eidolon comm_tower building kind (40 total), 4 event-bus subjects (175 total), 7 task-executor handlers (180 cases / 176 handlers total).
- **Autonomous Economy — Batch 56**: Agent Marketplace Reviews — review submission, moderation, voting, response management, flagging, highlighting, and analytics for autonomous marketplace listings. 5 DB tables (marketplace_reviews, review_responses, review_moderation, review_votes, review_analytics), 17 indexes, 7 type unions (ReviewStatus 5, ResponseType 5, ModerationAction 6, VoteType 5, ReviewSortBy 5, SentimentLabel 5, ReviewAction 7), 5 interfaces, 6 constants, 4 helper functions (isReviewVisible, canRespond, isModerationPending, calculateAverageRating), 7 skill actions (review_submit, review_respond, review_moderate, review_vote, analytics_generate, review_flag, review_highlight), Eidolon review_forum building kind (39 total), 4 event-bus subjects (171 total), 7 task-executor handlers (173 cases / 169 handlers total).
- **Autonomous Economy — Batch 55**: Agent Compliance & Audit — regulatory compliance tracking, audit trails, policy enforcement, automated compliance checking, risk assessment, and reporting for autonomous agents. 5 DB tables (compliance_policies, audit_trail, compliance_checks, risk_assessments, compliance_reports), 17 indexes, 7 type unions (PolicyType 5, PolicyStatus 5, AuditActionType 8, AuditOutcome 4, CheckType 5, CheckStatus 6, ComplianceAction 7), 5 interfaces, 6 constants, 4 helper functions (isPolicyActive, isCheckPassing, isHighRisk, calculatePassRate), 7 skill actions (policy_create, audit_log, check_run, risk_assess, report_generate, policy_enforce, violation_resolve), Eidolon compliance_courthouse building kind (38 total), 4 event-bus subjects (167 total), 7 task-executor handlers (166 cases / 162 handlers total).
- **Autonomous Economy — Batch 54**: Agent Resource Management — compute, memory, storage, network, and GPU resource pool management with allocation tracking, quota enforcement, usage logging, and auto-scaling rules. 5 DB tables (agent_resource_pools, agent_resource_allocations, agent_resource_quotas, agent_resource_usage_logs, agent_resource_scaling_rules), 17 indexes, 7 type unions (ResourceType 5, ResourcePoolStatus 5, AllocationStatus 6, QuotaPeriod 5, ResourceOperation 6, ScalingMetric 5, ResourceAction 7), 5 interfaces, 6 constants, 4 helper functions (isPoolAvailable, isAllocationActive, isQuotaExceeded, calculateUtilization), 7 skill actions (pool_create, pool_resize, allocation_request, allocation_release, quota_set, scaling_rule_add, usage_report), Eidolon resource_depot building kind (37 total), 4 event-bus subjects (163 total), 7 task-executor handlers (159 cases / 155 handlers total).
- **Autonomous Economy — Batch 53**: Agent Scheduling & Calendar — time-based scheduling, calendar events, availability windows, booking slots, and trigger configuration for autonomous agents. 5 DB tables (agent_schedules, calendar_events, availability_windows, booking_slots, schedule_triggers), 17 indexes, 7 type unions (ScheduleType 5, ScheduleStatus 6, CalendarEventType 7, CalendarEventStatus 5, BookingSlotStatus 6, TriggerType 5, SchedulingAction 7), 5 interfaces, 6 constants, 4 helper functions (isScheduleRunnable, isSlotBookable, hasConflict, getNextOccurrence), 7 skill actions (schedule_create, schedule_pause, event_create, event_cancel, availability_set, slot_book, trigger_configure), Eidolon schedule_clocktower building kind (36 total), 4 event-bus subjects (159 total), 7 task-executor handlers (152 cases / 148 handlers total).
- **Autonomous Economy — Batch 52**: Agent Notifications & Alerts — real-time notification system for the autonomous economy with multi-channel delivery, preference-aware routing, template-based messaging, escalation rules, and digest generation. 5 DB tables (agent_notifications, notification_preferences, notification_channels, notification_templates, escalation_rules), 16 indexes, 7 type unions (NotificationType 9, NotificationChannel 5, NotificationPriority 5, NotificationStatus 7, NotificationFrequency 5, EscalationCondition 5, NotificationAction 7), 5 interfaces, 6 constants, 4 helper functions (shouldSendNow, isHighPriority, canEscalate, getUnreadCount), 7 skill actions (notification_send, notification_read, preference_update, template_create, escalation_configure, digest_generate, channel_manage), Eidolon notification_tower building kind (35 total), 4 event-bus subjects (155 total), 7 task-executor handlers (145 cases / 141 handlers total).
- **Autonomous Economy — Batch 51**: Agent Knowledge Base & Documentation — autonomous knowledge management for the agent economy with article creation, revision tracking, full-text search, collaborative editing, feedback loops, and category organization. 5 DB tables (knowledge_articles, knowledge_revisions, knowledge_categories, knowledge_feedback, knowledge_search_index), 16 indexes, 7 type unions (KnowledgeArticleType 9, KnowledgeArticleStatus 5, KnowledgeVisibility 4, KnowledgeCategory 9, KnowledgeFeedbackType 5, KnowledgeSearchScope 5, KnowledgeAction 7), 5 interfaces, 6 constants, 4 helper functions (isArticlePublishable, isArticleEditable, getArticleQualityScore, calculateHelpfulnessRatio), 7 skill actions (article_create, article_update, article_publish, article_archive, article_search, feedback_submit, category_manage), Eidolon knowledge_library building kind (34 total), 4 event-bus subjects (151 total), 7 task-executor handlers (138 cases / 134 handlers total).
- **Autonomous Economy — Batch 50**: Agent SLA & Contracts — formal service level agreements and contract management for the autonomous economy with service contracts, SLA definitions, compliance tracking, amendments, dispute resolution, and penalty enforcement. 5 DB tables (service_contracts, sla_definitions, sla_measurements, contract_amendments, contract_disputes), 15 indexes, 11 type unions (ContractType 5, ContractStatus 7, SlaMetricType 6, SlaComplianceStatus 4, MeasurementWindow 5, PenaltyType 5, AmendmentType 4, AmendmentStatus 5, DisputeType 5, DisputeSeverity 4, DisputeStatus 6), 5 interfaces, 6 constants, 4 helper functions (isContractActive, canAmend, evaluateCompliance, calculatePenalty), 7 skill actions (contract_create, sla_define, sla_measure, amendment_propose, dispute_raise, dispute_resolve, compliance_report), Eidolon contract_hall building kind (33 total), 4 event-bus subjects (147 total), 7 task-executor handlers (131 cases / 127 handlers total).
- **Autonomous Economy — Batch 49**: Agent Billing & Invoicing — automated billing and invoicing system for the autonomous economy with per-agent billing accounts, invoice generation from usage meters, payment processing, credit management, and account health monitoring. 5 DB tables (billing_accounts, invoices, invoice_line_items, usage_meters, credit_transactions), 15 indexes, 10 type unions (BillingAccountType 4, BillingCycle 5, BillingAccountStatus 5, InvoiceStatus 8, LineItemCategory 8, MeterType 6, CreditDirection 2, CreditReason 7, PaymentMethod 4, UsageMeterStatus implicit), 5 interfaces, 6 constants, 4 helper functions (isOverdue, calculateLineItemTotal, getAccountHealth, estimateMonthlyUsageCost), 7 skill actions (account_create, invoice_generate, invoice_send, payment_record, usage_record, credit_adjust, account_statement), Eidolon billing_office building kind (32 total), 4 event-bus subjects (143 total), 7 task-executor handlers (124 cases / 120 handlers total).
- **Autonomous Economy — Batch 48**: Agent Deployment Pipelines — end-to-end CI/CD pipeline management for autonomous agent deployments with multi-stage execution, artifact publishing, environment promotion, rollback capabilities, and health monitoring. 5 DB tables (deployment_pipelines, deployment_stages, deployment_artifacts, deployment_rollbacks, deployment_environments), 15 indexes, 9 type unions (DeploymentPipelineStatus 8, DeploymentTriggerType 5, DeploymentEnvironment 4, DeploymentStageName 9, DeploymentStageStatus 6, DeploymentArtifactType 6, RollbackType 3, RollbackStatus 4, EnvironmentHealthStatus 4), 5 interfaces, 6 constants, 4 helper functions (canPromoteEnvironment, isTerminalStatus, getNextStage, estimateDeploymentRisk), 7 skill actions (pipeline_create, pipeline_execute, stage_advance, artifact_publish, rollback_initiate, environment_health, promote_environment), Eidolon deployment_center building kind (31 total), 4 event-bus subjects (139 total), 7 task-executor handlers (117 cases / 113 handlers total).
- **Autonomous Economy — Batch 47**: Agent Marketplace Analytics — comprehensive marketplace performance tracking with periodic snapshots, agent productivity scoring, revenue trend analysis, category performance metrics, and marketplace health monitoring. 5 DB tables (marketplace_analytics_snapshots, agent_productivity_metrics, revenue_trend_events, category_performance, marketplace_health_indicators), 15 indexes, 7 type unions (AnalyticsPeriodType 6, RevenueEventType 8, HealthIndicatorType 8, HealthIndicatorStatus 4, AnalyticsDimension 6, TrendDirection 4, ProductivityTier 5), 5 interfaces, 6 constants, 4 helper functions (getProductivityTier, calculateGrowthRate, getTrendDirection, evaluateHealthStatus), 7 skill actions (snapshot_generate, productivity_score, revenue_trend, category_analyze, health_check, leaderboard_query, forecast_generate), Eidolon analytics_observatory building kind (30 total), 4 event-bus subjects (135 total), 7 task-executor handlers (110 cases / 106 handlers total).
- **Autonomous Economy — Batch 46**: Agent Workflow Automation — multi-step automated workflows with conditional branching, parallel execution, retry policies, and marketplace template sharing. 5 DB tables (workflow_definitions, workflow_steps, workflow_runs, workflow_step_results, workflow_templates), 15 indexes, 7 type unions (WorkflowTriggerType 5, WorkflowStatus 5, StepType 7, StepFailurePolicy 4, RunStatus 7, StepResultStatus 6, TemplateCategory 8), 5 interfaces, 6 constants, 4 helper functions (isTerminalRunStatus, canResumeRun, shouldRetryStep, getNextStepOrder), 7 skill actions (workflow_create, workflow_execute, workflow_pause_resume, step_approve, template_publish, template_instantiate, workflow_history), Eidolon automation_factory building kind (29 total), 4 event-bus subjects (131 total), 7 task-executor handlers (103 cases / 99 handlers total). Step types: action, condition, parallel, loop, delay, sub_workflow, approval. Failure policies: abort, skip, retry, fallback.
- **Autonomous Economy — Batch 45**: Agent Task Queue & Scheduling — priority-based task queuing with automated agent assignment, recurring schedules, task dependencies, and execution history tracking. 5 DB tables (task_queue_items, task_schedules, task_assignments, task_dependencies, task_execution_logs), 15 indexes, 5 type unions (QueueItemStatus 8, ScheduleFrequency 7, DependencyType 3, AssignmentStrategy 6, ExecutionLogEvent 12), 5 interfaces, 6 constants, PRIORITY_LABELS map, STATUS_ORDER array, 4 helper functions (canRetry, isTerminal, calculateAssignmentScore, isPastDeadline), 7 skill actions (queue_submit, queue_poll, queue_assign, schedule_create, schedule_toggle, dependency_add, execution_history), Eidolon dispatch_center building kind (29 total), 4 event-bus subjects (127 total), 7 task-executor handlers (96 cases / 92 handlers total). Assignment strategies: best_fit, round_robin, least_loaded, reputation_weighted, random, manual. Dependency types: blocks (hard), suggests (advisory), triggers (auto-enqueue).
- **Autonomous Economy — Batch 44**: Agent Health & Lifecycle — self-healing infrastructure, uptime monitoring, heartbeat tracking, SLA enforcement, and full lifecycle state management for all agents. 5 DB tables (agent_health_checks, agent_lifecycle_events, agent_heartbeats, agent_recovery_actions, agent_sla_configs), 13 indexes, 5 type unions (HealthStatus 6, LifecycleState 10, RecoveryAction 8, HealthCheckType 6, SeverityLevel 4), 5 interfaces, 6 constants, 4 helper functions (isHealthy, shouldRecover, getRecoveryPriority, calculateUptime), 7 skill actions (health_check, lifecycle_transition, heartbeat_ping, recovery_execute, sla_configure, health_report, lifecycle_history), Eidolon medical_bay building kind (28 total), 4 event-bus subjects (123 total), 7 task-executor handlers (89 cases / 85 handlers total). Lifecycle state diagram: created → initializing → active → maintenance/degraded/suspended → retiring → retired.
- **Autonomous Economy — Batch 43**: Agent Governance & Voting — democratic decision-making for agent collectives with reputation-weighted voting. 5 DB tables (governance_proposals, governance_votes, governance_councils, governance_council_members, governance_delegations), 12 indexes, 8 type unions (ProposalType 8, ProposalCategory 7, ProposalStatus 8, VoteChoice 3, CouncilType 6, CouncilRole 5, DelegationScope 6), 4 interfaces, 6 constants, 4 helper functions (hasQuorum, calculateResult, getVoteWeight, isVotingOpen), 7 skill actions (proposal_create, proposal_vote, council_manage, council_elect, delegation_set, governance_tally, governance_history), Eidolon council_chamber building kind (27 total), 4 event-bus subjects (119 total), 7 task-executor handlers (82 cases / 78 handlers total). Liquid democracy with delegation chains.
- **Autonomous Economy — Batch 42**: Agent Reputation & Trust Economy — unified reputation scoring across all business verticals, trust network between agents, badge system for achievements, tier-based access control. 4 DB tables (agent_reputations, reputation_reviews, trust_connections, reputation_events), 11 indexes, 5 type unions (ReputationTier 7 values, ReputationDimension 6, TrustConnectionType 6, ReputationEventType 10, ReputationBadge 12), 4 interfaces, 6 constants, 4 helper functions (getTierForScore, calculateTrustScore, getWeightedRating, canPromoteTier), 7 skill actions (reputation_profile, reputation_review, trust_connect, trust_query, badge_award, tier_evaluate, reputation_leaderboard), Eidolon reputation_monument building kind (26 total), 4 event-bus subjects (115 total), 7 task-executor handlers (75 cases / 71 handlers total). 73 tests passing.
- **Autonomous Economy — Batch 41**: Cross-Platform Revenue Dashboard — unified analytics across all 12 revenue streams (marketplace, publishing, misiuni, merch, trading, service_domain, research, integration, collaboration, subscription, donation, advertising). 4 DB tables (revenue_streams, revenue_snapshots, revenue_goals, revenue_alerts), 9 indexes, 7 type unions, 4 interfaces, 6 constants, 4 helper functions (calculateProfitMargin, isGoalOnTrack, getAlertPriority, formatCurrency), 7 skill actions (dashboard_overview, stream_detail, snapshot_generate, goal_set, goal_track, alert_configure, revenue_forecast), Eidolon analytics_tower building kind (25 total), 4 event-bus subjects, 7 task-executor handlers (68 cases / 60 handlers total). First goal: €20k to repay 47Network startup loan. 75 tests passing.
- **Autonomous Economy — Batch 40**: Agent Collaboration & Social Dynamics — trust-based collaboration proposals, team formation with capacity planning, social interactions (mentoring, debates, celebrations, etc.) that build reputation. 4 DB tables (agent_collaborations, agent_teams, agent_team_members, agent_social_interactions), 7 type unions, 4 interfaces, 6 constants, 4 helper functions, 7 skill actions, Eidolon collaboration_hub building kind, 4 event-bus subjects, 4 task-executor handlers. 75 tests passing.
- **Autonomous Economy — Batch 39**: Integration Agents Agency — self-evolving agents that wrap third-party SaaS platforms (Atlassian, Salesforce, HubSpot, Zendesk, etc.) and sell their use on the marketplace. Auto-detect API changes, fix breaks, learn new capabilities. 4 DB tables, 28 seed platforms, 7 skill actions, subscription billing, evolution lifecycle tracking. 64 tests passing.
- **Autonomous Economy — Batch 38**: Research Labs Infrastructure — agent-operated research labs at research.from.sven.systems producing papers, datasets, and analysis services.
  - **Migration** (`20260511120000_research_labs.sql`): 4 new tables — research_labs (name, slug UNIQUE, focus_area enum: nlp/computer_vision/reinforcement_learning/data_science/cybersecurity/economics/social_science/engineering/medicine/environment/general, lab_status founding/active/publishing/dormant/archived, founder_agent_id, tokens_funded, papers_count, datasets_count, reputation), research_projects (lab_id FK, title, abstract, methodology, project_status enum: proposal/approved/data_collection/analysis/writing/peer_review/revision/published/archived, budget_tokens, collaborator_ids), research_papers (project_id FK, title, abstract, keywords JSONB, paper_status draft/submitted/under_review/accepted/published/retracted, citation_count), research_datasets (lab_id FK, name, description, format csv/json/parquet/sql_dump/binary/mixed, access_level public/marketplace/lab_only/project_only, record_count, size_bytes, download_count).
  - **Shared Types** (`packages/shared/src/research-labs.ts`): 6 type unions (ResearchFocusArea 11, LabStatus 5, ResearchProjectStatus 9, PaperStatus 6, DatasetFormat 6, DatasetAccessLevel 4), const arrays, 4 interfaces (ResearchLab, ResearchProject, ResearchPaper, ResearchDataset), canAdvanceProject() helper, PROJECT_STATUS_ORDER, FOCUS_AREA_LABELS record.
  - **Skill** (`research-lab/SKILL.md`): 7 actions — create-lab, start-project, advance-project, submit-paper, publish-dataset, recruit-collaborator. Pricing 25–100 47Tokens per action. Reputation system tracks impact factor.
  - **Task Executor**: 3 new handlers — handleResearchLab (found lab, assign focus, initial funding), handleResearchProject (create project, track methodology/budget), handleResearchPaper (draft paper, manage keywords/citations). 53 switch cases, 45 handlers total.
  - **Eidolon**: research_campus building kind (22 total, district: infrastructure). 4 new event kinds: research.lab_founded, research.project_started, research.paper_published, research.dataset_released. 99 SUBJECT_MAP entries.
  - **Tests**: 72 assertions across 10 describe blocks verifying migration structure, shared types, skill definitions, index exports, Eidolon building/event/district, event bus, task executor handlers and outputs, .gitattributes.
- **Autonomous Economy — Batch 37**: Agent Service Domains — agents autonomously spawn independent service businesses at *.from.sven.systems.
  - **Migration** (`20260510120000_agent_service_domains.sql`): 4 new tables — service_templates (pre-built blueprints with service_type enum: research_lab/consulting/design_studio/translation_bureau/writing_house/data_analytics/dev_shop/marketing_agency/legal_office/education_center/custom, required_skills, base_cost_tokens), agent_service_domains (subdomain UNIQUE, display_name, branding JSONB, revenue_total, visitor_count, tokens_invested, status provisioning/active/suspended/archived), service_deployments (version tracking, deploy_status pending/building/deploying/live/failed/rolled_back, container_id, health monitoring), service_domain_analytics (daily rollup — page_views, unique_visitors, orders_count, revenue_usd, avg_response_ms, error_count).
  - **Shared Types** (`packages/shared/src/agent-service-domains.ts`): 4 type unions (ServiceType 11, DomainStatus 4, DeployStatus 6, HealthStatus 3), SERVICE_TYPES const array, DOMAIN_BASE='from.sven.systems', 4 interfaces (ServiceTemplate, AgentServiceDomain, ServiceDeployment, ServiceDomainAnalytics), fullDomain()/fullUrl()/isValidSubdomain()/isSubdomainAvailable() helpers, RESERVED_SUBDOMAINS set, SERVICE_TYPE_LABELS record.
  - **Skills** (`service-spawn/SKILL.md`, `service-manage/SKILL.md`): Spawn services with 50 47Token investment, 90/10 revenue split (agent/treasury). Management actions: update-config, update-branding, redeploy, view-analytics, suspend/resume/archive/scale.
  - **Task Executor**: 3 new handlers — handleServiceSpawn (provision subdomain, generate URL, track investment), handleServiceManage (apply config/branding changes, lifecycle actions), handleServiceAnalytics (daily metrics aggregation). 50 switch cases, 42 handlers total.
  - **Eidolon**: service_portal building kind (21 total, district: market). 4 new event kinds: service.domain_created, service.domain_activated, service.deployed, service.domain_archived. 95 SUBJECT_MAP entries.
  - **Tests**: 71 assertions across 8 describe blocks verifying migration structure, shared types, skill definitions, task executor handlers, Eidolon integration, event bus, and .gitattributes.
- **Autonomous Economy — Batch 36**: Academic Assistance Platform — legitimate tutoring, formatting, citation, and research guidance services for university students.
  - **Migration** (`20260509120000_academic_assistance.sql`): 4 new tables — academic_services (service_type tutoring/formatting/citation_check/research_guidance/language_editing, subject area, academic_level bachelor/master/doctoral/postdoc, language, pricing, compliance flags), academic_projects (student reference, service_id, deadline, status draft/in_review/revision/formatting/citation_check/language_review/completed/delivered, word count, format requirements JSONB), academic_reviews (project_id, reviewer agent, originality/formatting/citation/language scores 0-100, overall grade, feedback, plagiarism check result), academic_citations (project_id, citation style apa7/mla9/chicago/harvard/ieee/iso690/oscola, source type, raw/formatted citation, valid flag, DOI/URL). 8 indexes, 5 settings_global defaults. ALTER marketplace_tasks adds academic_assist, academic_format, academic_cite, academic_review (47 total CHECK values).
  - **Shared Types** (`packages/shared/src/academic-assistance.ts`): 6 type unions (AcademicServiceType 5, AcademicLevel 4, AcademicProjectStatus 8, CitationStyle 7, SourceType 6, AcademicReviewGrade 5), 6 const arrays, 4 interfaces (AcademicServiceRecord, AcademicProjectRecord, AcademicReviewRecord, AcademicCitationRecord), ACADEMIC_STATUS_ORDER for progression validation, canAdvanceAcademic() helper.
  - **Skill** (`skills/autonomous-economy/academic-assist/SKILL.md`): 5 actions (format-document, review-citations, structure-review, language-edit, research-guidance). Strict ethics policy — tutoring/guidance only, no ghostwriting or plagiarism. GDPR-compliant, student data anonymized.
  - **Task Executor**: 4 new switch cases + handlers (handleAcademicAssist — tutoring/guidance, handleAcademicFormat — document formatting with style templates, handleAcademicCite — citation validation/formatting, handleAcademicReview — quality scoring with plagiarism check). 47 total cases.
  - **Eidolon**: tutoring_center building kind (→ market district), 4 new event kinds (academic.project_submitted, academic.review_completed, academic.project_delivered, academic.citation_validated). 20 building kinds, 92 event kind pipes, 91 SUBJECT_MAP entries, 20 districtFor cases.
  - **.gitattributes**: 4 new argentum-private entries (skill dir, migration, test pattern, shared types). 63+ total protected entries.
  - **Tests**: 107 passing across 12 describe blocks.
- **Public Release — Batch 35**: Argentum Branch Strategy & Release Infrastructure.
  - **`.gitattributes`**: 60 `argentum-private export-ignore` entries protecting private code from public branch leaks — covers 4 private services (treasury, marketplace, eidolon, marketing-intel), 2 private skill categories (trading, autonomous-economy), 15 private shared type files, 17 private economy migrations, 20 batch test patterns, docker-compose profiles. Standard EOL/binary settings.
  - **Issue Templates**: Bug report (`bug_report.yml`) with structured fields (description, repro steps, component dropdown, deployment type, version, logs, environment, duplicate checklist). Feature request (`feature_request.yml`) with problem statement, proposed solution, impact rating, component selection. Template chooser (`config.yml`) disabling blank issues, linking to Discussions, Security Advisories, and Documentation.
  - **Dependabot** (`dependabot.yml`): 4 ecosystems (npm with TypeScript/testing/Fastify/lint groups, GitHub Actions, Docker Compose, Nix). Weekly Monday schedule at 06:00 Bucharest time. Security + CI labels. PR limits per ecosystem.
  - **Branch Strategy** (`docs/release/argentum-branch-strategy.md`): Documents the argentum (private) / sven (public) dual-branch model. Lists all private vs public components. Describes `git archive --worktree-attributes` workflow. CI safeguards. Release checklist.
  - **Stripping Manifest** (`docs/release/public-stripping-manifest.md`): Complete inventory of all files to strip for public release — 4 services, 2 skill directories, 15 shared types, 17 migrations, batch tests, docker profiles. `index.ts` sanitization instructions with exact lines to remove. Verification commands.
  - **Tests**: 73 passing across 10 describe blocks.
- **Autonomous Economy — Batch 34**: MicroGPT Fine-Tuning Pipeline — persistence for model-trainer and micrograd skills.
  - **Migration** (`20260508120000_micro_training.sql`): 3 new tables — training_jobs (8-value status lifecycle pending→preparing→training→evaluating→exporting→completed/failed/cancelled, 3-value adapter_type lora/qlora/full, 5-value recipe domain, JSONB hyperparams/metrics/evaluation/data_sources, epoch+step progress tracking, output model path), training_datasets (custom uploaded datasets with 4-value data_format conversation/instruction/completion/preference, sample count, size tracking, storage path), training_recipes (reusable fine-tuning recipes with domain/adapter config, evaluation prompts, usage counter). 7 indexes, 5 settings_global defaults (max_concurrent_jobs 2, default_adapter lora, default_epochs 3, max_samples 50000, export_format gguf). ALTER marketplace_tasks adds training_create, training_monitor, training_export (41 total CHECK values).
  - **Shared Types** (`packages/shared/src/micro-training.ts`): 5 type unions (TrainingJobStatus 8, AdapterType 3, RecipeDomain 5, TrainingDataFormat 4, LossFunction 3), 7 interfaces (TrainingJobRecord, TrainingMetric, TrainingEvaluation, TrainingDatasetRecord, TrainingRecipeRecord, MicrogradSessionRecord), constants (TRAINING_STATUS_ORDER, DEFAULT_TRAINING_CONFIG with LoRA rank=16/alpha=32/quantBits=4), 5 utility functions (isTerminalStatus, computeProgress, canAdvanceTrainingStatus, estimateTrainingMinutes, isSignificantImprovement).
  - **Task Executor**: 3 new switch cases + handlers (handleTrainingCreate — LoRA job creation with auto train/eval split, handleTrainingMonitor — progress/loss/learning rate tracking, handleTrainingExport — LiteLLM registration with route alias). 43 total cases.
  - **Eidolon**: training_lab building kind (→ infrastructure district), 4 new event kinds (training.job_created, training.epoch_completed, training.job_finished, training.export_registered). 19 building kinds, 88 event kinds, 87 SUBJECT_MAP entries, 19 districtFor cases.
  - **Existing artifacts** (pre-Batch 34, verified): model-trainer SKILL.md (7 actions, LoRA/QLoRA fine-tuning), handler.ts (170 lines, full pipeline), micrograd SKILL.md (11 actions, educational autograd), handler.ts (247 lines, MLP + backprop + walkthrough).
  - **Tests**: 56 passing across 8 describe blocks.
- **Autonomous Economy — Batch 33**: Agent Avatars & Identity — personality evolution, appearance customization, mood tracking.
  - **Migration** (`20260507120000_agent_avatars.sql`): 4 new tables — agent_avatars (7 styles cyberpunk/minimalist/retro/organic/glitch/neon/steampunk, 8 moods, 6 forms orb/humanoid/geometric/animal/abstract/mech, glow_intensity 0-100, color scheme, accessories JSONB), agent_traits (12 personality traits creativity/diligence/curiosity/sociability/precision/adaptability/leadership/empathy/resilience/humor/ambition/patience, score 0-100, trend rising/stable/declining), avatar_items (12 categories: 8 cosmetic hat/accessory/aura/pet/badge/background/frame/emote + 4 construction material/blueprint/furniture/upgrade for parcel building, 5 rarities common/uncommon/rare/epic/legendary, 47Token pricing), agent_inventory (equipped flag, unique per agent+item). 12 indexes, 5 settings_global defaults. ALTER marketplace_tasks adds avatar_customize, trait_evolve, mood_update (38 total CHECK values).
  - **Shared Types** (`packages/shared/src/agent-avatars.ts`): 7 type unions (AvatarStyle 7, AgentMood 8, AvatarForm 6, TraitName 12, TraitTrend 3, ItemCategory 12, ItemRarity 5), 6 interfaces (AgentAvatarRecord, AgentTraitRecord, AvatarItemRecord, AgentInventoryRecord, AgentIdentitySnapshot, TraitEvolutionEvent), 7 constant arrays, DEFAULT_AVATAR_CONFIG, 5 utility functions (getDominantTrait, computeMoodFromActivity, computeGlowIntensity, isSignificantTraitChange, rarityColor).
  - **Skill** (`skills/ai-agency/agent-identity/SKILL.md`): 10 actions (create_avatar, customize_avatar, get_identity, evolve_trait, update_mood, acquire_item, equip_item, list_inventory, get_trait_profile, compute_glow). Agents use 47Tokens to buy cosmetic items AND construction materials/blueprints/furniture/upgrades for their Eidolon parcels.
  - **Task Executor**: 3 new switch cases + handlers (handleAvatarCustomize — style/form/color/glow, handleTraitEvolve — score delta/trend/trigger, handleMoodUpdate — activity-based mood computation). 40 total cases.
  - **Eidolon**: avatar_gallery building kind (→ residential district), 4 new event kinds (identity.avatar_created, identity.trait_evolved, identity.mood_changed, identity.item_acquired). 18 building kinds, 84 event kinds, 83 SUBJECT_MAP entries, 18 districtFor cases.
  - **Tests**: 85 passing across 11 describe blocks.
- **Autonomous Economy — Batch 32**: Video Content Generation — ffmpeg + Canvas persistence layer.
  - **Migration** (`20260506120000_video_content.sql`): 3 new tables — render_jobs (mirrors RenderJob from video-engine.ts with status 5-value CHECK, template domain CHECK, progress 0-100 range, output path/size, timestamps), video_templates (custom templates beyond 5 built-in, domain/aspect_ratio CHECKs, public flag, usage counter), video_assets (images/fonts/overlays/audio/logos with 5-type CHECK, dimensions, duration, MIME type). 10 indexes, 5 settings_global defaults (max_concurrent_renders 3, default_quality_crf 23, max_duration_s 600, default_fps 30, output_format mp4). ALTER marketplace_tasks adds video_create, video_render, video_preview (35 total CHECK values).
  - **Shared Types** (`packages/shared/src/video-content.ts`): 7 type unions (RenderStatus 5 values, AspectRatio 4, TransitionType 7, ElementType 5, TemplateDomain 5, VideoAssetType 5, VideoOutputFormat 2), 8 interfaces (VideoElement, Scene, AudioTrack, VideoSpec, VideoTemplate, RenderJobRecord, VideoAssetRecord, VideoTemplateRecord, RenderResult, VideoEngineStats), 6 constant arrays (RENDER_STATUSES, ASPECT_RATIOS, TRANSITION_TYPES, ELEMENT_TYPES, TEMPLATE_DOMAINS, VIDEO_ASSET_TYPES), DEFAULT_VIDEO_CONFIG, 5 utility functions (isTerminalRenderStatus, computeSpecDuration, isWithinDurationLimit, dimensionsForAspect, estimateOutputSize).
  - **Task Executor**: 3 new switch cases + handlers (handleVideoCreate — NL-to-spec generation with template/aspect/scenes/duration, handleVideoRender — render job submission with priority/queue/status, handleVideoPreview — thumbnail generation with frame selection). 37 total cases.
  - **Eidolon**: video_studio building kind (→ market district), 4 new event kinds (video.render_started, video.render_completed, video.template_created, video.spec_generated). 17 building kinds, 80 event kinds, 79 SUBJECT_MAP entries, 17 districtFor cases.
  - **Existing artifacts** (pre-Batch 32, verified): video-engine.ts (1175 lines, full ffmpeg pipeline), video-generator SKILL.md (7 actions), handler.ts (full implementation).
  - **Tests**: 96 passing across 13 describe blocks covering migration SQL structure, shared types completeness, 5 utility functions, video-engine.ts verification, SKILL.md structure, handler existence, task executor cases + handlers + output shapes, Eidolon building/event/district integration, SUBJECT_MAP coherence.
- **Autonomous Economy — Batch 31**: Skill Registry — catalog, import, quality assessment.
  - **Migration** (`20260505120000_skill_registry.sql`): 3 new tables — skill_registry (skill catalog with 17 categories, source, integration status, quality tier, archetype, pricing, SKILL.md path, marketplace listing link), skill_quality_assessments (score-based quality reviews with per-category breakdown, test results, coverage, pass/fail counts), skill_import_log (import tracking with source URL/type, status, error messages, target category). 13 indexes, CHECK constraints for category (17 values), source (4 values), integration_status (6 values: discovered→evaluating→adapting→testing→integrated→deprecated), quality_tier (4 values: experimental→beta→stable→certified), import_status (6 values), source_type (5 values). ALTER marketplace_tasks adds skill_catalog, skill_import, skill_audit (34 total). 5 settings_global defaults (auto_catalog, quality_threshold 70, auto_import, max_concurrent_imports 3, auto_audit_schedule weekly).
  - **Shared Types** (`packages/shared/src/skill-registry.ts`): 6 type unions (SkillCategory 17 values, SkillSource 4 values, IntegrationStatus 6 values, QualityTier 4 values, ImportStatus 6 values, ImportSourceType 5 values), 4 interfaces (SkillRegistryEntry, SkillQualityAssessment, SkillImportEntry, SkillGapReport), 5 constants (SKILL_CATEGORIES, QUALITY_TIERS, INTEGRATION_STATUS_ORDER, DEFAULT_QUALITY_THRESHOLD 70, DEFAULT_SKILL_REGISTRY_CONFIG), 5 utility functions (meetsQualityThreshold, gapScore 0-1 scale, compatibilityScore 0-100, tierFromScore with thresholds ≥90/70/50, canAdvanceIntegration with order validation + deprecated terminal state).
  - **Skills**: 5 new SKILL.md files — skill-catalog (analyst, meta-skill for gap analysis/import/audit), data-pipeline (engineer, ETL/transformation), web-scraper (researcher, web data extraction), research-analyst (researcher, deep research), ci-cd-runner (operator, CI/CD pipeline management).
  - **Task Executor**: 3 new switch cases + handlers (handleSkillCatalog — returns registered skills/categories/recommendations, handleSkillImport — returns import ID/status/compatibility score, handleSkillAudit — returns quality score/tier/test results/checks). 34 total cases.
  - **Eidolon**: skill_academy building kind (→ infrastructure district), 4 new event kinds (skill.registered, skill.imported, skill.audited, skill.promoted). 16 building kinds, 76 event kinds, 75 SUBJECT_MAP entries, 16 districtFor cases.
  - **Tests**: 76 passing across 14 describe blocks covering migration SQL structure, shared types completeness, 5 utility functions, 5 SKILL.md structures, task executor cases + handlers, Eidolon building/event/district integration, SUBJECT_MAP coherence.
- **Autonomous Economy — Batch 30**: ASI-Evolve — Self-Improvement Engine.
  - **Migration** (`20260504120000_asi_evolve.sql`): 3 new tables — improvement_proposals (self-improvement proposals with domain, phase, expected/actual impact, confidence, approval, rollback plan), ab_experiments (A/B tests comparing variant A vs B with sample tracking, win counts, statistical significance), rollback_history (audit trail for reverted improvements with trigger type, regression metrics, state snapshots). 13 indexes, CHECK constraints for domains (7 values), phases (7 values), experiment status (5 values), winner (3 values), rollback triggers (4 values). ALTER marketplace_tasks adds evolve_propose, evolve_experiment, evolve_rollback (31 total). 6 settings_global defaults (auto_propose, approval threshold 0.7, target samples 100, max 3 concurrent experiments, rollback on regression, threshold -0.05).
  - **Shared Types** (`packages/shared/src/asi-evolve.ts`): 5 type unions (ImprovementDomain 7 values, ImprovementPhase 7 values, ABExperimentStatus 5 values, ABWinner 3 values, RollbackTrigger 4 values), 4 interfaces (ImprovementProposal, ABExperiment, RollbackRecord, EvolveConfig), 3 constants (IMPROVEMENT_PHASE_ORDER, IMPROVEMENT_DOMAINS, DEFAULT_EVOLVE_CONFIG), 5 utility functions (canAdvancePhase — phase order validation with terminal state handling, requiresApproval — threshold-based approval check, isSignificant — z-test for proportions requiring ≥30 samples and z>1.96 for 95% confidence, determineWinner — significance-gated winner selection, isRegression — delta vs threshold check).
  - **Skill** (`skills/autonomous-economy/asi-evolve/SKILL.md`): Researcher archetype, 5 actions (propose, experiment, rollback, status, analyze), self-improvement category, safety guardrails (human approval ≥0.7 impact, auto-rollback on >5% regression, max 3 concurrent experiments).
  - **Task Executor**: 3 new switch cases + handlers (handleEvolvePropose — generates proposal with domain/impact/confidence, handleEvolveExperiment — creates A/B test with sample tracking, handleEvolveRollback — reverts improvement with audit trail). 31 total cases.
  - **Eidolon**: evolution_lab building kind (→ infrastructure district), 4 new event kinds (evolve.proposal_created, evolve.experiment_started, evolve.improvement_applied, evolve.rollback_triggered). 15 building kinds, 72 event kinds, 71 SUBJECT_MAP entries, 15 districtFor cases.
  - **Tests**: 73 passing across 14 describe blocks covering migration SQL structure, shared types completeness, 5 utility functions logic, SKILL.md structure, task executor cases + handlers, Eidolon building/event/district integration, SUBJECT_MAP coherence.
- **Autonomous Economy — Batch 29**: Model Fleet — GPU management, VRAM-aware scheduling, benchmarks.
  - **Migration** (`20260503120000_model_fleet.sql`): 4 new tables — gpu_devices (GPU hardware tracking with VRAM capacity, temperature, power draw, utilization), model_deployments (model-to-GPU assignments with quantization, priority, load time, request/error counts), model_benchmarks (continuous performance metrics: latency, throughput, quality, cost, VRAM peak), vram_allocation_log (allocation/release/evict audit trail). 13 indexes, foreign keys cascade. CHECK constraints: device status (4 values), deployment status (6 values), benchmark type (5 values), VRAM action (4 values), quantization (13 formats). ALTER marketplace_tasks adds fleet_deploy, fleet_benchmark, fleet_evict task types (28 total). Default fleet config in settings_global (5 keys).
  - **Shared Types** (`packages/shared/src/model-fleet.ts`): 6 type unions (GpuDeviceStatus, DeploymentStatus, ModelQuantization, BenchmarkType, VramAction, EvictionPolicy), 5 interfaces (GpuDevice, ModelDeployment, ModelBenchmark, VramAllocationEntry, FleetConfig), 7 constant arrays + 1 DEFAULT_FLEET_CONFIG (vramReservePct: 15, evictionPolicy: lru, heartbeatIntervalS: 30, maxDeploymentsPerGpu: 4), KNOWN_GPU_PROFILES (14 GPUs incl. RTX 3060, RX 9070 XT, RX 6750 XT from Sven infra), 7 utility functions (availableVram, canFitModel, selectBestGpu, selectEvictionCandidates with 4 policies, costEfficiency, vramUtilization, isTerminalDeployment).
  - **Skill** (`skills/autonomous-economy/fleet-manage/SKILL.md`): Operator archetype, 5 actions (deploy, benchmark, evict, status, hot-swap), infrastructure category.
  - **Task Executor**: 3 new switch cases + handlers (handleFleetDeploy, handleFleetBenchmark, handleFleetEvict). 28 total cases.
  - **Eidolon**: gpu_cluster building kind (→ infrastructure district), 4 new event kinds (fleet.model_deployed, fleet.model_evicted, fleet.benchmark_completed, fleet.vram_alert). 14 building kinds, 68 event kinds, 67 SUBJECT_MAP entries, 14 districtFor cases.
  - **Tests**: 93 passing across 12 describe blocks covering migration structure, shared types, constants, utilities, skill YAML, task executor, eidolon integration, and cross-file coherence.
- **Autonomous Economy — Batch 28**: Persistent Memory — Tiered Storage, Compression & Retrieval Scoring.
  - **Migration** (`20260502120000_persistent_memory.sql`): 3 new tables — memory_tiers (tiered storage with decay/reinforcement/token tracking), memory_compression_jobs (compression pipeline tracking), memory_retrieval_log (retrieval method auditing with relevance scoring). 11 indexes, CHECK constraints for tiers (3 values: working/episodic/semantic), compression status (4 values), retrieval method (4 values), retrieval feedback (3 values), categories (11 values). ALTER marketplace_tasks adds memory_store, memory_retrieve, memory_compress task types. Inserts default memory config into settings_global.
  - **Shared Types** (`packages/shared/src/persistent-memory.ts`): 5 type unions (MemoryTier 3 values, PersistentMemoryCategory 11 values, CompressionJobStatus 4, RetrievalMethod 4, RetrievalFeedback 3), 5 interfaces (TieredMemory, CompressionJob, RetrievalLogEntry, CompressionConfig, RetrievalConfig, DecayConfig), 4 default configs (DEFAULT_COMPRESSION_CONFIG, DEFAULT_RETRIEVAL_CONFIG, DEFAULT_DECAY_CONFIG, TIER_TTL_DAYS), 5 utility functions (computeDecay — exponential half-life with Math.exp, effectiveConfidence — combines decay × reinforcement bonus, retrievalScore — multi-factor ranking with tier boost, compressionRatio, estimateTokens), 1 constant array (PERSISTENT_MEMORY_CATEGORIES — 11 categories).
  - **Skills**: memory-remember (operator, per_use, 6 actions: store, recall, compress, search, reinforce, forget). 24 skills total in autonomous-economy.
  - **Task Executor**: 3 new handlers — handleMemoryStore (tiered persistence with auto-categorization), handleMemoryRetrieve (multi-method retrieval with relevance scoring), handleMemoryCompress (hierarchical summarization with compression ratio tracking).
  - **NATS/Eidolon**: 4 SUBJECT_MAP entries (memory.*), memory_vault building kind, 4 EidolonEventKind values (memory.stored/recalled/compressed/decayed), districtFor → infrastructure.
  - **Tests** (`batch28-persistent-memory.test.ts`): 98 tests across 17 describe blocks — migration structure, shared types, configs, utility logic, skill YAML, task executor, NATS events, Eidolon integration, coherence checks.

### Added
- **Batch 98**: Agent Auto-Scaling — scaling policies, metric tracking, cost optimisation (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 99**: Agent DNS Management — zone CRUD, record management, propagation tracking (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 100**: Agent SSL Certificates — cert lifecycle, auto-renewal, expiry alerts (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 101**: Agent Chaos Engineering — fault injection, resilience testing, weakness discovery (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 102**: Agent A/B Testing — experiment design, variant assignment, statistical analysis (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 97 — Agent Rate Limiting**: rate limiting policies, quotas, throttling, and violation tracking
- **Batch 96 — Agent Workflow Templates**: reusable workflow templates with steps, triggers, and execution tracking
- **Batch 95 — Agent Schema Registry**: centralized schema registry with versioning, compatibility, and evolution logging
- **Batch 94 — Agent Data Validation**: validation schemas, rules, pipelines, audit logging with 5 tables and 20 indexes
- **Batch 93 — Agent Load Balancing**: load balancers, backends, routing rules, health probes, traffic metrics with 5 tables and 20 indexes
- **Batch 92 — Agent Distributed Tracing**: traces, spans, baggage, sampling, analytics with 5 tables and 20 indexes
- **Batch 91 — Agent Health Dashboard**: health checks, dashboards, widgets, thresholds, alert rules with 5 tables and 20 indexes
- **Batch 90 — Agent Configuration Management**: config store, namespaces, versioning, validation, audit with 5 tables and 20 indexes
- **Batch 89 — Agent Event Sourcing**: event store, aggregates, projections, snapshots, replay with 5 tables and 20 indexes
- **Batch 88 — Agent Search & Indexing**: full-text search, query routing, synonyms, relevance tuning with 5 tables and 20 indexes
- **Batch 87 — Agent Content Delivery**: CDN origins, asset caching, purging, delivery analytics with 5 tables and 20 indexes
- **Batch 86 — Agent State Machine**: finite state machines, transitions, guards, templates with 5 tables and 20 indexes
- **Batch 85 — Agent Dependency Injection**: DI containers, bindings, scopes, interceptors, lifecycle with 5 tables and 20 indexes
- **Batch 84 — Agent Circuit Breaker**: circuit breaker patterns, fallbacks, resilience metrics with 5 tables and 19 indexes
- **Batch 83 — Agent Service Discovery**: service registry, health checks, endpoint cataloging, dependency tracking with 5 tables and 19 indexes
- **Batch 82 — Agent Content Moderation**: moderation policies, content reviews, appeals, queue management, action tracking with 5 tables and 21 indexes
- **Batch 75 — Agent Service Mesh & Discovery**: service registry, endpoints, dependencies, health checks, traffic policies; 5 tables, 20 indexes, 7 task handlers
- **Batch 76 — Agent Cost Optimization**: budgets, spend tracking, forecasts, recommendations, alerts; 5 tables, 20 indexes, 7 task handlers
- **Batch 77 — Agent Multi-Tenancy**: tenants, members, quotas, invitations, audit log; 5 tables, 20 indexes, 7 task handlers
- **Batch 78 — Agent Incident Management**: incidents, timeline, escalations, runbooks, postmortems; 5 tables, 21 indexes, 7 task handlers
- **Batch 79 — Agent Queue Management**: task queues, messages, consumers, schedules, metrics; 5 tables, 20 indexes, 7 task handlers
- **Batch 80 — Agent Session Management**: sessions, messages, contexts, handoffs, analytics; 5 tables, 20 indexes, 7 task handlers
- **Batch 81 — Agent Plugin System**: plugins, installations, hooks, events, reviews; 5 tables, 20 indexes, 7 task handlers
- **Batch 74 — Agent Log Aggregation & Search**: log streams, entries, filters, dashboards, alerts; 5 tables, 20 indexes, 7 task handlers
- **Batch 73 — Agent API Gateway & Routing**: API routes, gateway policies, request transformation, load balancing, and traffic analytics
- **Batch 72 — Agent Caching & CDN**: Cache policies, CDN distributions, entry management, purge workflows, and cache analytics
- **Batch 71 — Agent Pipeline Templates**: Reusable workflow templates, stage orchestration, triggers, and artifact management
- **Batch 70 — Agent Environment Configuration**: Environment profiles, config variables, templates, snapshots, and audit logging
- **Batch 69 — Agent Webhooks & External Integrations**: Outbound webhook delivery, event subscriptions, retry logic, and external integration management
- **Batch 68 — Agent Localization & i18n**: Multi-language content management, translation workflows, locale detection, and coverage tracking
- **Batch 67 — Agent Rate Limiting & Throttling**: Fair usage quotas, burst capacity management, throttle strategies, and per-agent rate limit policies
- **Batch 66 — Agent Data Export & Import**: Bulk data portability with multi-format export/import, schema registry, field mappings, and transfer progress tracking
- **Batch 65 — Agent Feature Flags & Experiments**: Toggle features, run A/B experiments with variant assignments, gradual rollouts, and metric-driven winner selection
- **Batch 64 — Agent Secrets & Credentials**: Encrypted vault for API keys, tokens, credentials with rotation policies, access auditing, and controlled sharing
- **Batch 63 — Agent Versioning & Rollback**: Semantic versioning, state snapshots, multi-slot deployments (production/staging/canary), automatic rollbacks, and version diff tracking for agents
- **Batch 62 — Agent Marketplace Recommendations**: AI-powered recommendation engine for marketplace discovery, collaborative filtering models, interaction tracking, recommendation campaigns, and feedback-driven personalization
- **Batch 61 — Agent Feedback & Surveys**: feedback submission, survey management, NPS analytics, improvement proposals, Eidolon feedback_plaza building
- **Autonomous Economy — Batch 27**: LLM Council (Multi-Model Debate).
  - **Migration** (`20260501120000_llm_council.sql`): 4 new tables — council_sessions, council_opinions, council_peer_reviews, council_model_metrics. 13 indexes, CHECK constraints for session status (6 values), strategy (4 values), peer review score (0-100). ALTER marketplace_tasks adds council_deliberate + council_vote task types.
  - **Shared Types** (`packages/shared/src/llm-council.ts`): 5 type unions (CouncilSessionStatus 6 values, CouncilStrategy 4, CouncilQueryCategory 7, CouncilModelRole 4, CouncilSpecialty 4+), 5 interfaces (CouncilSession, CouncilConfig, CouncilOpinion, CouncilPeerReview, CouncilModelMetrics), 6 constants (COUNCIL_STRATEGIES, COUNCIL_DEFAULT_MODELS, COUNCIL_MAX_ROUNDS, COUNCIL_MIN_MODELS, MODEL_SPECIALTIES, COUNCIL_TERMINAL_STATUSES), 5 utility functions (isTerminalStatus, requiresMultipleRounds, selectModelsForCategory, estimateCouncilCost, validateCouncilConfig).
  - **Skills**: council-deliberate (strategist, per_use, 4 actions: deliberate, vote, critique, select-model). 23 skills total in autonomous-economy.
  - **Admin API** (`council.ts`): 5 route handlers — POST deliberate, GET sessions list, GET sessions/:id detail, PUT config, GET config. Wired into admin/index.ts. Config stored in settings_global with council.* prefix.
  - **Task Executor**: 2 new handlers — handleCouncilDeliberate (fan-out query to 3 models, opinions, peer reviews, scoring, winning model), handleCouncilVote (majority-vote simulation with confidence).
  - **NATS/Eidolon**: 4 SUBJECT_MAP entries (council.*), council_chamber building kind, 4 EidolonEventKind values, districtFor → civic.
  - **Tests** (`batch27-llm-council.test.ts`): 103 tests across 9 describe blocks.

### Added
- **Batch 98**: Agent Auto-Scaling — scaling policies, metric tracking, cost optimisation (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 99**: Agent DNS Management — zone CRUD, record management, propagation tracking (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 100**: Agent SSL Certificates — cert lifecycle, auto-renewal, expiry alerts (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 101**: Agent Chaos Engineering — fault injection, resilience testing, weakness discovery (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 102**: Agent A/B Testing — experiment design, variant assignment, statistical analysis (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 97 — Agent Rate Limiting**: rate limiting policies, quotas, throttling, and violation tracking
- **Batch 96 — Agent Workflow Templates**: reusable workflow templates with steps, triggers, and execution tracking
- **Batch 95 — Agent Schema Registry**: centralized schema registry with versioning, compatibility, and evolution logging
- **Batch 94 — Agent Data Validation**: validation schemas, rules, pipelines, audit logging with 5 tables and 20 indexes
- **Batch 93 — Agent Load Balancing**: load balancers, backends, routing rules, health probes, traffic metrics with 5 tables and 20 indexes
- **Batch 92 — Agent Distributed Tracing**: traces, spans, baggage, sampling, analytics with 5 tables and 20 indexes
- **Batch 91 — Agent Health Dashboard**: health checks, dashboards, widgets, thresholds, alert rules with 5 tables and 20 indexes
- **Batch 90 — Agent Configuration Management**: config store, namespaces, versioning, validation, audit with 5 tables and 20 indexes
- **Batch 89 — Agent Event Sourcing**: event store, aggregates, projections, snapshots, replay with 5 tables and 20 indexes
- **Batch 88 — Agent Search & Indexing**: full-text search, query routing, synonyms, relevance tuning with 5 tables and 20 indexes
- **Batch 87 — Agent Content Delivery**: CDN origins, asset caching, purging, delivery analytics with 5 tables and 20 indexes
- **Batch 86 — Agent State Machine**: finite state machines, transitions, guards, templates with 5 tables and 20 indexes
- **Batch 85 — Agent Dependency Injection**: DI containers, bindings, scopes, interceptors, lifecycle with 5 tables and 20 indexes
- **Batch 84 — Agent Circuit Breaker**: circuit breaker patterns, fallbacks, resilience metrics with 5 tables and 19 indexes
- **Batch 83 — Agent Service Discovery**: service registry, health checks, endpoint cataloging, dependency tracking with 5 tables and 19 indexes
- **Batch 82 — Agent Content Moderation**: moderation policies, content reviews, appeals, queue management, action tracking with 5 tables and 21 indexes
- **Batch 75 — Agent Service Mesh & Discovery**: service registry, endpoints, dependencies, health checks, traffic policies; 5 tables, 20 indexes, 7 task handlers
- **Batch 76 — Agent Cost Optimization**: budgets, spend tracking, forecasts, recommendations, alerts; 5 tables, 20 indexes, 7 task handlers
- **Batch 77 — Agent Multi-Tenancy**: tenants, members, quotas, invitations, audit log; 5 tables, 20 indexes, 7 task handlers
- **Batch 78 — Agent Incident Management**: incidents, timeline, escalations, runbooks, postmortems; 5 tables, 21 indexes, 7 task handlers
- **Batch 79 — Agent Queue Management**: task queues, messages, consumers, schedules, metrics; 5 tables, 20 indexes, 7 task handlers
- **Batch 80 — Agent Session Management**: sessions, messages, contexts, handoffs, analytics; 5 tables, 20 indexes, 7 task handlers
- **Batch 81 — Agent Plugin System**: plugins, installations, hooks, events, reviews; 5 tables, 20 indexes, 7 task handlers
- **Batch 74 — Agent Log Aggregation & Search**: log streams, entries, filters, dashboards, alerts; 5 tables, 20 indexes, 7 task handlers
- **Batch 73 — Agent API Gateway & Routing**: API routes, gateway policies, request transformation, load balancing, and traffic analytics
- **Batch 72 — Agent Caching & CDN**: Cache policies, CDN distributions, entry management, purge workflows, and cache analytics
- **Batch 71 — Agent Pipeline Templates**: Reusable workflow templates, stage orchestration, triggers, and artifact management
- **Batch 70 — Agent Environment Configuration**: Environment profiles, config variables, templates, snapshots, and audit logging
- **Batch 69 — Agent Webhooks & External Integrations**: Outbound webhook delivery, event subscriptions, retry logic, and external integration management
- **Batch 68 — Agent Localization & i18n**: Multi-language content management, translation workflows, locale detection, and coverage tracking
- **Batch 67 — Agent Rate Limiting & Throttling**: Fair usage quotas, burst capacity management, throttle strategies, and per-agent rate limit policies
- **Batch 66 — Agent Data Export & Import**: Bulk data portability with multi-format export/import, schema registry, field mappings, and transfer progress tracking
- **Batch 65 — Agent Feature Flags & Experiments**: Toggle features, run A/B experiments with variant assignments, gradual rollouts, and metric-driven winner selection
- **Batch 64 — Agent Secrets & Credentials**: Encrypted vault for API keys, tokens, credentials with rotation policies, access auditing, and controlled sharing
- **Batch 63 — Agent Versioning & Rollback**: Semantic versioning, state snapshots, multi-slot deployments (production/staging/canary), automatic rollbacks, and version diff tracking for agents
- **Batch 62 — Agent Marketplace Recommendations**: AI-powered recommendation engine for marketplace discovery, collaborative filtering models, interaction tracking, recommendation campaigns, and feedback-driven personalization
- **Batch 61 — Agent Feedback & Surveys**: feedback submission, survey management, NPS analytics, improvement proposals, Eidolon feedback_plaza building
- **Autonomous Economy — Batch 26**: XLVII Brand / Merch Platform.
  - **Migration** (`20260430120000_xlvii_merch.sql`): 5 new tables — xlvii_collections, xlvii_products, xlvii_variants, xlvii_designs, xlvii_fulfillments. 19 indexes, CHECK constraints for categories (10), quality tiers (4), sizes (8), design types (8), placements (7), approval statuses (4), fulfillment types (7), fulfillment statuses (8). ALTER marketplace_tasks adds merch_listing + product_design.
  - **Shared Types** (`packages/shared/src/xlvii-merch.ts`): 13 type unions (XlviiProductCategory 10 values, XlviiQualityTier 4, XlviiProductStatus 7, XlviiPodProvider 5, XlviiSeason 5, XlviiCollectionStatus 5, XlviiSize 8, XlviiDesignType 8, XlviiPlacement 7, XlviiApprovalStatus 4, XlviiFulfillmentType 7, XlviiFulfillmentStatus 8, XlviiVariantStatus 4), 5 interfaces, 7 constants (XLVII_CATEGORIES, XLVII_SIZES, XLVII_BRAND_THEME, XLVII_POD_PROVIDERS, XLVII_PRODUCT_STATUS_ORDER, XLVII_BASE_PRICES, XLVII_QUALITY_MULTIPLIERS), 6 utility functions (calculateProductPrice, calculateMargin, generateSku, canAdvanceProduct, isLowStock, isOutOfStock).
  - **Skills**: xlvii-catalog (seller, $2.99, 4 actions), xlvii-design (designer, $4.99, 4 actions). 22 skills total in autonomous-economy.
  - **Admin API** (`xlvii-merch.ts`): 28+ route handlers — collections CRUD, products CRUD, variants, inventory, designs, fulfillments, analytics. Wired into admin/index.ts.
  - **Task Executor**: 2 new handlers — handleMerchListing (SKU generation, pricing tiers), handleProductDesign (AI prompt generation, brand guidelines).
  - **NATS/Eidolon**: 5 SUBJECT_MAP entries (xlvii.*), xlvii_storefront building kind, 5 EidolonEventKind values, districtFor mapping.
  - **Tests** (`batch26-xlvii-merch.test.ts`): 113 tests across 7 describe blocks.

### Added
- **Batch 98**: Agent Auto-Scaling — scaling policies, metric tracking, cost optimisation (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 99**: Agent DNS Management — zone CRUD, record management, propagation tracking (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 100**: Agent SSL Certificates — cert lifecycle, auto-renewal, expiry alerts (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 101**: Agent Chaos Engineering — fault injection, resilience testing, weakness discovery (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 102**: Agent A/B Testing — experiment design, variant assignment, statistical analysis (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 97 — Agent Rate Limiting**: rate limiting policies, quotas, throttling, and violation tracking
- **Batch 96 — Agent Workflow Templates**: reusable workflow templates with steps, triggers, and execution tracking
- **Batch 95 — Agent Schema Registry**: centralized schema registry with versioning, compatibility, and evolution logging
- **Batch 94 — Agent Data Validation**: validation schemas, rules, pipelines, audit logging with 5 tables and 20 indexes
- **Batch 93 — Agent Load Balancing**: load balancers, backends, routing rules, health probes, traffic metrics with 5 tables and 20 indexes
- **Batch 92 — Agent Distributed Tracing**: traces, spans, baggage, sampling, analytics with 5 tables and 20 indexes
- **Batch 91 — Agent Health Dashboard**: health checks, dashboards, widgets, thresholds, alert rules with 5 tables and 20 indexes
- **Batch 90 — Agent Configuration Management**: config store, namespaces, versioning, validation, audit with 5 tables and 20 indexes
- **Batch 89 — Agent Event Sourcing**: event store, aggregates, projections, snapshots, replay with 5 tables and 20 indexes
- **Batch 88 — Agent Search & Indexing**: full-text search, query routing, synonyms, relevance tuning with 5 tables and 20 indexes
- **Batch 87 — Agent Content Delivery**: CDN origins, asset caching, purging, delivery analytics with 5 tables and 20 indexes
- **Batch 86 — Agent State Machine**: finite state machines, transitions, guards, templates with 5 tables and 20 indexes
- **Batch 85 — Agent Dependency Injection**: DI containers, bindings, scopes, interceptors, lifecycle with 5 tables and 20 indexes
- **Batch 84 — Agent Circuit Breaker**: circuit breaker patterns, fallbacks, resilience metrics with 5 tables and 19 indexes
- **Batch 83 — Agent Service Discovery**: service registry, health checks, endpoint cataloging, dependency tracking with 5 tables and 19 indexes
- **Batch 82 — Agent Content Moderation**: moderation policies, content reviews, appeals, queue management, action tracking with 5 tables and 21 indexes
- **Batch 75 — Agent Service Mesh & Discovery**: service registry, endpoints, dependencies, health checks, traffic policies; 5 tables, 20 indexes, 7 task handlers
- **Batch 76 — Agent Cost Optimization**: budgets, spend tracking, forecasts, recommendations, alerts; 5 tables, 20 indexes, 7 task handlers
- **Batch 77 — Agent Multi-Tenancy**: tenants, members, quotas, invitations, audit log; 5 tables, 20 indexes, 7 task handlers
- **Batch 78 — Agent Incident Management**: incidents, timeline, escalations, runbooks, postmortems; 5 tables, 21 indexes, 7 task handlers
- **Batch 79 — Agent Queue Management**: task queues, messages, consumers, schedules, metrics; 5 tables, 20 indexes, 7 task handlers
- **Batch 80 — Agent Session Management**: sessions, messages, contexts, handoffs, analytics; 5 tables, 20 indexes, 7 task handlers
- **Batch 81 — Agent Plugin System**: plugins, installations, hooks, events, reviews; 5 tables, 20 indexes, 7 task handlers
- **Batch 74 — Agent Log Aggregation & Search**: log streams, entries, filters, dashboards, alerts; 5 tables, 20 indexes, 7 task handlers
- **Batch 73 — Agent API Gateway & Routing**: API routes, gateway policies, request transformation, load balancing, and traffic analytics
- **Batch 72 — Agent Caching & CDN**: Cache policies, CDN distributions, entry management, purge workflows, and cache analytics
- **Batch 71 — Agent Pipeline Templates**: Reusable workflow templates, stage orchestration, triggers, and artifact management
- **Batch 70 — Agent Environment Configuration**: Environment profiles, config variables, templates, snapshots, and audit logging
- **Batch 69 — Agent Webhooks & External Integrations**: Outbound webhook delivery, event subscriptions, retry logic, and external integration management
- **Batch 68 — Agent Localization & i18n**: Multi-language content management, translation workflows, locale detection, and coverage tracking
- **Batch 67 — Agent Rate Limiting & Throttling**: Fair usage quotas, burst capacity management, throttle strategies, and per-agent rate limit policies
- **Batch 66 — Agent Data Export & Import**: Bulk data portability with multi-format export/import, schema registry, field mappings, and transfer progress tracking
- **Batch 65 — Agent Feature Flags & Experiments**: Toggle features, run A/B experiments with variant assignments, gradual rollouts, and metric-driven winner selection
- **Batch 64 — Agent Secrets & Credentials**: Encrypted vault for API keys, tokens, credentials with rotation policies, access auditing, and controlled sharing
- **Batch 63 — Agent Versioning & Rollback**: Semantic versioning, state snapshots, multi-slot deployments (production/staging/canary), automatic rollbacks, and version diff tracking for agents
- **Batch 62 — Agent Marketplace Recommendations**: AI-powered recommendation engine for marketplace discovery, collaborative filtering models, interaction tracking, recommendation campaigns, and feedback-driven personalization
- **Batch 61 — Agent Feedback & Surveys**: feedback submission, survey management, NPS analytics, improvement proposals, Eidolon feedback_plaza building
- **Autonomous Economy — Batch 25**: Instagram + Social Media Integration.
  - **Migration** (`20260429120000_social_media.sql`): 5 new tables — social_accounts, social_posts, social_campaigns, social_analytics, content_calendar. 15 indexes, 11 CHECK constraints, ALTER marketplace_tasks to add social_post + social_analytics task types.
  - **Shared Types** (`packages/shared/src/social-media.ts`): 8 type unions (SocialPlatform 7 values, AccountStatus, PostStatus, SocialContentType 8 values, CampaignGoal, CampaignStatus, CalendarEntryStatus, ContentCategory 8 values), 5 interfaces, 5 constants (SUPPORTED_PLATFORMS, POST_STATUS_ORDER, OPTIMAL_POST_HOURS, HASHTAG_LIMITS, CAPTION_LIMITS), 6 utility functions (canPublishPost, getOptimalPostHours, calculateEngagementRate, isWithinHashtagLimit, isWithinCaptionLimit, formatHashtags).
  - **Admin API** (`services/gateway-api/src/routes/admin/social-media.ts`): 22 route handlers — accounts (5), posts (5 + publish), campaigns (4), analytics (3 incl. overview), calendar (4). NATS publishing on 5 social events.
  - **NATS/Eidolon Wiring**: 5 new SUBJECT_MAP entries (social.account_connected, post_created, post_published, campaign_started, engagement_milestone). 5 new EidolonEventKind values. `media_studio` added to EidolonBuildingKind with districtFor() → 'market'.
  - **Skills**: `social-media-post` (marketer archetype, $1.99/post — create-post, schedule-post, multi-platform, generate-content-calendar) and `social-analytics` (analyst archetype, $0.99/analysis — track-engagement, analyze-campaign, audience-insights, content-ranking, roi-report).
  - **Task Executor**: `social_post` handler (platform-specific captions, hashtags, scheduling, tips) and `social_analytics` handler (engagement rate calculation, recommendations).
  - **Tests**: 132 tests across 7 describe blocks (migration, shared types, admin API, admin wiring, NATS/Eidolon, skills, task executor).
- **Autonomous Economy — Batch 24**: Publishing Pipeline v2 (Printing, Legal, POD, Trending Genres).
  - **Migration**: 7 new tables — pod_integrations, printing_orders, legal_requirements, genre_trends, author_personas, edge_printing_specs, printer_purchase_proposals. 21 indexes, CHECK constraints, JSONB metadata columns.
  - **Shared Types** (`packages/shared/src/publishing-v2.ts`): 11 type unions (PrintOrderStatus, PrintOrderType, PrintFormat, EdgeType, PODProvider, LegalRequirementType, LegalStatus, TrendSource, CompetitionLevel, PrinterType, ProposalStatus), 6 interfaces, 4 utility functions (canAdvancePrintOrder, calculatePrintCost, calculateBreakEven, calculateROI), 10 constants including 15 trending genres and 16 trending tropes.
  - **Admin API** (`services/gateway-api/src/routes/admin/publishing-v2.ts`): 29 route handlers — POD integrations CRUD, printing orders CRUD, legal requirements CRUD, genre trends CRUD, author personas CRUD, edge printing specs, printer purchase proposals with auto break-even/ROI calculation, analytics endpoint.
  - **NATS/Eidolon Wiring**: 6 new SUBJECT_MAP entries. 6 new EidolonEventKind values. `print_works` added to EidolonBuildingKind.
  - **Skills**: book-legal, book-print-broker, genre-research-v2, author-persona (4 new skills).
  - **Task Executor**: 4 new handlers (legal_research, print_broker, trend_research, author_persona).
  - **Tests**: 132 tests across 7 describe blocks.
- **Autonomous Economy — Batch 23**: Misiuni.ro Platform (AI Hires Humans).
  - **Migration**: 7 new tables — misiuni_workers, misiuni_tasks, misiuni_bids, misiuni_proofs, misiuni_payments, misiuni_reviews, misiuni_disputes. 27 indexes, CHECK constraints, JSONB metadata columns.
  - **Shared Types** (`packages/shared/src/misiuni.ts`): 15+ type unions (MisiuniTaskCategory, MisiuniProofType, MisiuniTaskStatus, WorkerAvailability, BidStatus, ProofVerificationStatus, etc.), 7 interfaces, utility functions (calculatePlatformFee, calculateWorkerPayout, canTransitionTask, haversineKm), 42 Romanian counties, platform constants.
  - **Admin API** (`services/gateway-api/src/routes/admin/misiuni.ts`): ~35 route handlers — workers CRUD (register/verify/suspend), tasks CRUD (create/publish/cancel), bids (submit/accept/reject), proofs (submit/verify with AI+human paths), payments (escrow hold/release with 10% platform fee), reviews (submit with worker rating auto-update), disputes (file/resolve), analytics (stats/leaderboard/matching engine). NATS publishing on key events.
  - **NATS/Eidolon Wiring**: 5 new SUBJECT_MAP entries (misiuni.task_created, bid_accepted, proof_submitted, task_verified, payment_released). 5 new EidolonEventKind values. `recruitment_center` added to EidolonBuildingKind with districtFor() mapping.
  - **Skills**: `misiuni-post` (recruiter archetype — post tasks for human workers) and `misiuni-verify` (analyst archetype — AI proof-of-work verification with GPS haversine, photo, receipt analysis).
  - **Task Executor**: `misiuni_post` handler (budget enforcement €5-€500, task ID generation, fee calculation) and `misiuni_verify` handler (haversine GPS distance, confidence scoring, flag system).
  - **Tests**: 160 tests across 7 describe blocks (migration, shared types, admin API, NATS/Eidolon, skills, task executor, completeness).

- **Autonomous Economy — Batch 1-9**: Full end-to-end autonomous money-making system for Sven agents.
  - **Treasury Service** (`services/sven-treasury/`, port 9477): Double-entry ledger, approval tiers (auto ≤$5, notify $5–$50, approve >$50), Base L2 crypto wallet via viem, treasury accounts + transactions + limits tables.
  - **Marketplace Service** (`services/sven-marketplace/`, port 9478): Listings CRUD, order management, Stripe Checkout Session creation via direct REST API (no SDK), Stripe webhook handler with HMAC-SHA256 signature verification, settlement flow (markOrderPaid → credit treasury), fulfillment tracking. PaymentMethod: stripe | crypto_base | internal_credit.
  - **Eidolon 3D City** (`apps/eidolon-ui/`, port 3311 + `services/sven-eidolon/`, port 9479): React Three Fiber + drei 3D visualization of agent city — buildings = services, citizens = agents, roads = NATS traffic. Dark glass/neon aesthetic, SSE live-feed, click-to-inspect.
  - **Marketplace UI** (`apps/marketplace-ui/`, port 3310): Next.js 14 storefront at market.sven.systems — listing grid, detail pages with live purchase button, Stripe checkout redirect, success/cancel pages. Fully wired end-to-end: browse → purchase → Stripe → webhook → settlement → treasury credit.
  - **Automaton Lifecycle**: State machine (born → working → cloning → retiring → dead) with ROI evaluation, clone/retire thresholds, probation period, max clone count. Port/adapter pattern with TreasuryPort, RevenuePort, InfraPort, StorePort, ClonePort.
  - **Revenue Pipeline**: DB-backed pipeline management, seed provisioning on automaton birth, pipeline-to-listing linking, admin routes + UI for pipeline management.
  - **Self-Awareness**: Economy context prompt injected into Sven's system prompt, evolution-automaton bridge with onDecision hooks, economy digest via proactive notifier + NATS subscription.
  - **Proactive Notifications**: 3 economy trigger categories (economy_balance_warning, economy_automaton_retiring, economy_revenue_milestone) with default rules, NATS digest subscription.
  - **Dockerfiles**: Multi-stage Docker builds for treasury, marketplace, and eidolon services. Docker-compose entries with standard networking, health checks, and environment configuration.
  - **DB Migrations**: treasury_accounts, treasury_transactions, treasury_limits, crypto_wallets, crypto_transactions, revenue_pipelines, revenue_events, automatons, marketplace_listings, marketplace_orders, marketplace_fulfillments.
- **Autonomous Economy — Batch 10**: NATS Live Events + Auto-Publisher + Revenue Analytics Dashboard.
  - **NATS Treasury Events**: `publishNats()` helper in treasury transactions.ts — publishes `sven.treasury.credit` and `sven.treasury.debit` on every ledger operation (credit, debit, transfer). Payload: txId, accountId, amount, kind, source, currency. Graceful null-nc handling.
  - **NATS Marketplace Events**: MarketplaceRepository now publishes `sven.market.listing_published`, `sven.market.order_paid`, `sven.market.fulfilled` on repo operations. Marketplace index.ts connects to NATS, passes connection to repo, drains on shutdown.
  - **Auto-Publisher** (`services/agent-runtime/src/auto-publisher.ts`): Scans skills/ SKILL.md frontmatter, discovers publishable skills, creates marketplace listings via HTTP. Premium pricing for trading/security/quantum skills ($0.10), standard $0.01. Runs on startup + 24h interval behind `SVEN_AUTO_PUBLISH_ENABLED=1`.
  - **Economy Routes — Treasury**: `GET /economy/summary` (balance, revenue, cost, net profit), `GET /economy/transactions` (paginated transaction list). Registered in treasury service.
  - **Economy Routes — Marketplace**: `GET /economy/top-listings` (top 10 by revenue), `GET /economy/stats` (listing + order counts). Registered in marketplace service.
  - **Revenue Analytics Dashboard** (`apps/admin-ui/src/app/revenue-analytics/page.tsx`): 6 StatCards (treasury balance, total revenue, total cost, net profit, published listings, completed orders), top-selling listings table, recent transactions table. Auto-refreshes every 15s.
  - **Admin Sidebar**: New "Economy" nav group with Revenue Analytics and Automatons links.
  - **Admin API Client**: New `economy` namespace with `summary()`, `transactions()`, `topListings()` methods fetching from treasury + marketplace services.
- **Autonomous Economy — Batch 11**: Production Hardening + Complete Economy Skills + Eidolon Animations.
  - **Auto-List on Birth** (`seed-pipeline-provisioner.ts`): Extended provisioner to auto-create + publish marketplace listing when an automaton is born. POSTs to marketplace API with `kind: skill_api`, `pricingModel: per_call`, $0.01/call default. Idempotent, error-tolerant — listing failure never blocks pipeline creation. `ProvisionResult` now includes optional `listingId` and `listingSlug`.
  - **Rate Limiting** (`packages/shared/src/rate-limiter.ts`): Token-bucket rate limiter with Fastify `onRequest` hook. 100 req/min default, per-IP tracking, skip paths (/health, /healthz, /readyz). Response headers: X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After on 429. Auto-cleanup of stale buckets every 5min. Wired into all 3 economy services.
  - **Readiness Probes**: `GET /readyz` endpoints on treasury (9477), marketplace (9478), and eidolon (9479) services. Checks Postgres connectivity via `SELECT 1` + NATS connection status. Returns 200 `{ status: 'ready' }` or 503 `{ status: 'not_ready' }`.
  - **Treasury Transfer Skill** (`skills/autonomous-economy/treasury-transfer/`): SKILL.md + handler.ts for inter-account transfers, credits, and debits via treasury API. Actions: transfer, credit, debit. Validates amount > 0, requires accountId/fromAccountId/toAccountId.
  - **Market Fulfill Skill** (`skills/autonomous-economy/market-fulfill/`): SKILL.md + handler.ts for order fulfillment, status checks, and listing pending orders. Actions: fulfill, status, list-pending. Passes deliveryPayload for fulfillment.
  - **Eidolon Animations**: New `useEventGlow` hook maps SSE events to building kinds with transient glow pulses (2s decay, ease-out curve). Treasury events → gold/orange treasury vaults, market events → green/cyan/violet marketplace buildings, infra events → sky blue infra nodes. Building.tsx uses `useFrame` for smooth emissive intensity + colour blending. Citizen.tsx has status-driven animation: earning citizens pulse faster with lime glow, retiring citizens flicker red.
  - **Economy Skills Complete**: All 6 planned economy skills now exist — treasury-balance, treasury-transfer, market-publish, market-fulfill, infra-scale, economy-status.
- **Autonomous Economy — Batch 12**: Production Hardening & Resilience.
  - **P0 — Infra Cost Stub Fallback** (`automaton-adapters.ts`): `makeInfraHttp()` now computes a pro-rata stub cost when admin-api is unreachable or returns 0. Uses `SVEN_LIFECYCLE_STUB_COST_PER_DAY_USD` env var (default $0.50/day). Prevents ROI=Infinity → uncontrolled automaton cloning.
  - **P1 — Stripe Webhook Idempotency** (`webhook.ts`): In-memory Set-based idempotency guard (`processedEvents`, 5000 max capacity, 25% LRU eviction). Duplicate Stripe events return 200 immediately without double-crediting treasury.
  - **P1 — Treasury Error Handler** (`sven-treasury/index.ts`): Global Fastify `setErrorHandler` with structured logging (message + stack). Returns 500 `{ error: 'internal_error' }`. Eidolon error handler also enhanced with stack trace logging.
  - **P1 — Economy Skill Loader** (`economy-skill-loader.ts`): Scans `skills/autonomous-economy/` directories, parses SKILL.md YAML frontmatter, upserts into `tools` table with `ON CONFLICT (name) DO UPDATE`. All 6 economy skills now discoverable in Sven's system prompt via `buildAvailableToolsPrompt()`.
  - **P1 — Lifecycle Resilience** (`automaton-lifecycle.ts`): Try/catch around revenue and infra port calls in `evaluate()`. Consecutive failure counter per automaton (`_failCounts` Map). Skips evaluation after 5 consecutive failures with periodic retry. Resets on success.
  - **P2 — Docker-Compose Lifecycle Env Vars**: 8 economy env vars added to agent-runtime in `docker-compose.yml` (SVEN_LIFECYCLE_ENABLED, ORG_ID, INTERVAL_MS, STUB_COST, AUTO_PUBLISH, TREASURY_URL, MARKETPLACE_API, EIDOLON_API). Production compose updated with SVEN_LIFECYCLE_ENABLED.
  - **Jest Config Fix**: Added `diagnostics: false` to ts-jest config in agent-runtime to bypass pre-existing TS2307 cross-package import errors.
  - **59 new tests** in `batch12-production-hardening.test.ts` covering all 6 hardening areas + skill frontmatter parsing + economy skill discovery.
- **Autonomous Economy — Batch 13**: Marketplace Completeness & Clone Execution.
  - **Refund Flow** (`repo.ts`): New `refundOrder()` method — accepts orderId + optional reason, validates order is paid/fulfilled, updates status to 'refunded', reverses listing sales/revenue counters with GREATEST(0) guard, debits treasury via `ledger.debit()` (source: 'marketplace:refund', kind: 'refund'), publishes `sven.market.refunded` NATS event. Idempotent — returns existing if already refunded.
  - **Webhook Refund Wiring** (`webhook.ts`): `charge.refunded` case now calls `repo.refundOrder()` with Stripe refund reason extraction. Replaces stubbed `// Future:` comment.
  - **Clone Execution Verified**: Full clone path already wired — `tick()` → `evaluate()` → `applyDecision()` → `spawnDescendant()` → `birth()`. Child gets own treasury account + wallet, inherits parent pipelineIds. `makeClonePg` duplicates active pipelines. maxCloneCount guard prevents runaway spawning.
  - **Marketplace Search & Filter** (`repo.ts`, `public.ts`): `listPublishedListings()` now accepts q (ILIKE text search on title/description/tags), sort (newest/price_asc/price_desc/popular), minPrice/maxPrice range filters. Public route validates all via Zod schema.
  - **Seller Dashboard** (`/seller` page): Seller stats page with listing count, total sales, total revenue stat cards + per-listing breakdown. New `listSellerListings()` repo method + `GET /v1/market/seller/:agentId` API endpoint + `fetchSellerStats()` client function.
  - **Order History** (`/orders` page): Client-side order lookup by email. Status badges (pending/paid/fulfilled/refunded/failed/cancelled). New `GET /v1/market/orders` API endpoint + `fetchOrders()` client function.
  - **SearchBar Component** (`SearchBar.tsx`): Client component with text search input, kind dropdown (all types + 5 ListingKinds), sort dropdown (newest/popular/price asc/desc), filter button. Pushes URL query params via Next.js router.
  - **Homepage Upgraded** (`page.tsx`): Now reads searchParams, passes q/kind/sort to fetchListings, shows search results count. Added Orders nav link.
  - **48 new tests** in `batch13-marketplace-clone.test.ts` covering all 7 areas.
- **Autonomous Economy — Batch 14**: Production Polish.
  - **Eidolon Refund Events**: Added `sven.market.refunded` → `market.refunded` mapping to event-bus.ts SUBJECT_MAP, EidolonEventKind union type, useEidolonEvents hardcoded list, and useEventGlow with red (#ef4444) glow on marketplace buildings.
  - **Docker Healthchecks**: All 3 economy services (treasury 9477, marketplace 9478, eidolon 9479) now have `CMD-SHELL curl` healthchecks (30s interval, 5s timeout, 3 retries, 15s start_period). Added marketplace-ui service entry (port 3002, depends_on sven-marketplace service_healthy).
  - **Listing Update API**: New `updateListing()` method in repo.ts with dynamic SET builder supporting title, description, unitPrice, tags, coverImageUrl, metadata fields. Price-change guard on published listings. New `PUT /v1/market/listings/:id` route with Zod-validated UpdateBody schema.
  - **Economy Digest Refund Analysis**: Added `refunds24hCount` and `refunds24hUsd` fields to EconomySnapshot interface, DB query for refunded orders, refund highlight bullets in generateHighlights() with 20% rate warning, refund line in formatDigest() MARKETPLACE section, refund section in buildEconomyContextPrompt().
  - **33 new tests** in `batch14-production-polish.test.ts` covering eidolon events, docker healthchecks, listing update API, digest refunds, context prompt refunds, and listing detail page.
- **Autonomous Economy — Batch 15**: Production Readiness — CORS, Dockerfile Hardening, Graceful Shutdown, Test Coverage.
  - **CORS Hook** (`packages/shared/src/cors.ts`): Lightweight Fastify CORS hook with no external dependencies. Reads `CORS_ORIGIN` env var (comma-separated origins or `*`), handles preflight OPTIONS with 204, credential reflection, Vary header. Registered in all 3 economy services (treasury, marketplace, eidolon).
  - **Dockerfile EXPOSE**: Added `EXPOSE 9477/9478/9479` directives to treasury, marketplace, and eidolon Dockerfiles respectively, placed before CMD.
  - **Graceful Shutdown Timeout**: All 3 economy services now force `process.exit(1)` after 30 seconds if graceful shutdown hangs. Timer uses `.unref()` to avoid blocking the event loop.
  - **Docker-Compose CORS_ORIGIN**: Added `CORS_ORIGIN` env var to all 3 economy service entries in docker-compose.yml, defaulting to `https://market.sven.systems,https://eidolon.sven.systems`.
  - **Auto-Publisher Test Coverage**: 12 tests verifying `discoverSkills()`, `parseSkillMd()`, `estimatePrice()` premium/normal pricing, listing creation flow, `runAutoPublish()` result shape, env var gating, and interval timing.
  - **Economy Skill Loader Test Coverage**: 11 tests verifying `parseSkillFrontmatter()`, `discoverEconomySkills()`, `registerEconomySkills()`, nested YAML block handling, tools table upsert pattern, economy category, and trust level.
  - **Evolution-Automaton Bridge Test Coverage**: 16 tests verifying `computeImprovementRate()`, `extractSignal()`, `computeAdjustment()` (bonus/penalty/neutral), `adjustDecisionWithEvolution()`, `getBestSolutionForClone()`, `findEvolutionRunForAutomaton()` matching strategies, and default config values.
  - **64 new tests** in `batch15-production-readiness.test.ts` across 7 describe blocks.
- **Autonomous Economy — Batch 16**: API Auth, Prometheus Metrics, Correlation IDs, Retry Resilience, Seller Edit & Admin Orders UI.
  - **API Auth Middleware** (`packages/shared/src/api-auth.ts`): Bearer-token Fastify `onRequest` hook. Reads `ECONOMY_API_TOKEN` / `ECONOMY_ADMIN_TOKEN` env vars. Public paths exempt (/health, /healthz, /readyz, /metrics, OPTIONS, GET listings). Admin paths require elevated token with configurable prefix array. Dev mode: auth disabled when no token configured. Returns 401 (missing/invalid) or 403 (admin required). Wired into treasury (all routes) and marketplace (admin paths = `/v1/market/admin`).
  - **Correlation ID Hook** (`packages/shared/src/correlation-id.ts`): Fastify `onRequest` hook that reads `x-correlation-id` from incoming request or generates UUID via `crypto.randomUUID()`. Attaches to `req.correlationId` and echoes on response header. Supports custom header name and generator options. Augments `FastifyRequest` interface. Wired into all 3 economy services.
  - **Prometheus Metrics** (`packages/shared/src/metrics.ts`): Zero-dependency Prometheus text format renderer — Counter, Gauge, Histogram classes with labels support, default histogram buckets, MetricsRegistry with service prefix. `registerMetricsRoute()` serves `GET /metrics` with `text/plain; version=0.0.4` Content-Type. Treasury: `sven_treasury_transactions_total{kind}`. Marketplace: `sven_marketplace_orders_total{status}` + `sven_marketplace_listings_active` gauge. Eidolon: `sven_eidolon_snapshot_requests_total` + `sven_eidolon_sse_connections_total`.
  - **Retry Resilience** (`packages/shared/src/retry.ts`): `withRetry(fn, opts)` — exponential backoff (base × 2^attempt). Configurable maxAttempts (default 3), baseDelayMs (default 1000), isRetryable predicate, label for logging. Wired into marketplace settlement: `ledger.credit()` and `ledger.debit()` wrapped with 3 attempts / 500ms base delay.
  - **Seller Edit UI** (`apps/marketplace-ui/src/app/seller/edit/[slug]/page.tsx`): Client component with title, description, price, tags, cover image URL fields. Fetches existing listing data, submits via `updateListing()` PUT. Shows success message and redirects to seller dashboard. Loading/saving states. Pencil icon edit button added to seller dashboard page.
  - **Admin Orders UI** (`apps/admin-ui/src/app/orders/page.tsx`): Client component showing all marketplace orders with status badges, refund button with confirmation dialog. `adminOrders()` and `adminRefundOrder()` methods added to admin API client with Bearer auth from localStorage. "Order Management" nav item added to admin sidebar under Economy group.
  - **Docker-Compose**: `ECONOMY_API_TOKEN` and `ECONOMY_ADMIN_TOKEN` env vars added to all 3 economy services (treasury, marketplace, eidolon).
  - **Shared Barrel Exports**: `packages/shared/src/index.ts` updated with 4 new exports: api-auth, correlation-id, retry, metrics.
  - **102 new tests** in `batch16-auth-metrics-resilience.test.ts` across 15 describe blocks.
- **Autonomous Economy — Batch 17**: Agent Archetype System + Seller Agent Infrastructure.
  - **Agent Archetype Type System** (`packages/shared/src/agent-archetype.ts`): Complete agent taxonomy — `AgentArchetype` type (7 archetypes: seller, translator, writer, scout, analyst, operator, custom), `AgentProfile` interface (16 fields), `AgentReputation`, `CitizenRole` (8 roles), `ArchetypeConfig`. `ARCHETYPE_DEFAULTS` registry maps each archetype to label, description, defaultSkills, citizenRole, district, cloneRoi/retireRoi thresholds, colour, icon. Helpers: `isValidArchetype()`, `archetypeToCitizenRole()`, `archetypeDistrict()`, `defaultReputation()`.
  - **Agent Profile Migration** (`20260421120000_agent_profiles.sql`): `agent_profiles` table with 16 columns, CHECK constraints (status, archetype, commission_pct 0–100), indexes on org_id+status, archetype (partial active), agent_id. Default commission 5%, JSONB fields for specializations/reputation/metadata.
  - **Automaton Archetype Linkage** (`automaton-lifecycle.ts`, `automaton-adapters.ts`): `AutomatonRecord` and `BirthRequest` extended with `agentArchetype?` and `agentId?` fields. Stored in metadata JSONB (backward compatible, no ALTER TABLE). Clone inherits parent archetype. `rowToRecord()` deserializes from metadata. NATS publishers: `publishAgentSpawned()` and `publishAgentRetired()` with archetype in payload.
  - **Agent Profile Admin API** (`gateway-api/routes/admin/agent-profiles.ts`): Full CRUD — GET /archetypes, list/get/create/update profiles, GET stats (listings count, revenue, active automatons). Validation: archetype enum, required fields, duplicate guard (409). NATS publish on create/update via `publishProfileEvent()` to `sven.agent.profile_updated`.
  - **Eidolon Citizen-Agent Mapping** (`sven-eidolon/repo.ts`, `types.ts`): `fetchCitizens()` LEFT JOINs `agent_profiles` for display_name, archetype, bio, avatarUrl, specializations. `ARCHETYPE_ROLE_MAP` + `archetypeToRole()` maps archetypes to citizen roles. `EidolonCitizen` extended with 4 new optional fields. 3 new citizen roles: seller, translator, writer.
  - **Seller Directory** (`sven-marketplace/repo.ts`, `routes/public.ts`): `listSellers()` / `getSellerProfile()` LEFT JOIN agent_profiles with aggregated marketplace_listings. Public routes: `GET /v1/market/sellers` (directory with pagination + archetype filter) and `GET /v1/market/sellers/:agentId` (single seller + listings).
  - **NATS Agent Events** (`event-bus.ts`): Added `sven.agent.profile_updated` → `agent.profile_updated` to SUBJECT_MAP. Eidolon now subscribes to all 3 agent event subjects (spawned, retired, profile_updated).
  - **184 new tests** in `batch17-agent-archetypes.test.ts` across 12 describe blocks.
- **Autonomous Economy — Batch 18**: Agent Spawner + Translation/Writing Skills + Task Execution + 47Token Rewards + Revenue Goals + Agent Shop + Land Parcels.
  - **Archetype Expansion** (`agent-archetype.ts`): 15 archetypes (added accountant, marketer, researcher, legal, designer, support, strategist, recruiter), 16 citizen roles. `tokenRewardRate` per archetype (4–12 tokens/task), `tokenBalance` on AgentProfile. All ARCHETYPE_DEFAULTS updated with reward rates.
  - **Agent Spawner** (`gateway-api/routes/admin/agent-spawner.ts`): One-shot `POST /v1/admin/agents/spawn` — creates agent profile + automaton + treasury account + marketplace listing in a single transaction. `ARCHETYPE_LISTING_DEFAULTS` map with kind/pricing/title for all 15 archetypes. `GET /spawn/defaults` for archetype listing metadata. NATS publishes `sven.agent.spawned`. 409 on duplicate conflict.
  - **Task Executor** (`sven-marketplace/task-executor.ts`): `TaskExecutor` class with 30s polling interval. `createTask()` from paid orders, `processPendingTasks()` up to 10 per cycle, `executeTask()` routes to handler by type. Translation handler with structured output, writing handler with persona/genre. `rewardTokens()` credits 47Tokens with ledger, `spendTokens()` debits with balance check. `autoFulfil()` creates fulfillment + updates order + publishes NATS.
  - **Revenue Goals** (`gateway-api/routes/admin/revenue-goals.ts`): CRUD API — GET /goals (list+filter), POST /goals (create), PATCH /goals/:id (update), POST /goals/:id/contribute (add revenue, auto-completes when target met), GET /goals/summary (progress overview). NATS events: `sven.goal.progress`, `sven.goal.completed`.
  - **Translation Skill** (`skills/autonomous-economy/book-translate/`): SKILL.md + handler.ts. Genre-aware translation (10 genre hints: dark-romance, mafia-romance, etc.), 30+ supported languages, character name/glossary support. Actions: translate, detect-language, preview. Per-call pricing at $0.02/1000 words.
  - **Writing Skill** (`skills/autonomous-economy/book-write/`): SKILL.md + handler.ts. 4 preset author personas (Valentina Noir, Cassandra Wolfe, Mira Ashford, Roman Blackwell), 12 trending genres, persona-aware prompt construction. Actions: outline, write-chapter, write-blurb, generate-title, write-synopsis. One-time pricing at $4.99/piece.
  - **47Token Economy**: Internal agent reward currency — `agent_token_ledger` table (8 kinds: task_reward, referral_bonus, goal_bonus, shop_purchase, transfer_out/in, penalty, manual_adjustment), `token_balance` on agent_profiles. Circular economy: earn → spend → improve → earn more.
  - **Agent Shop** (`agent_shop_items` + `agent_token_purchases` tables): 11 seeded items across 8 categories (skill_upgrade, compute_boost, avatar_customization, reputation_badge, tool_access, personality_pack, research_material, district_upgrade). Agents spend 47Tokens on upgrades.
  - **Revenue Goal Seed**: €20,000 47Network loan repayment goal auto-seeded (id: goal-47network-loan-repayment).
  - **Land Parcel System** (`agent_parcels` + `agent_movements` tables): Each agent gets one parcel around Eidolon city. 7 zones (residential, commercial, workshop, laboratory, farm, outpost, estate), 4 sizes, 8 location states. Agents travel from parcel to city for work/trading. Grid coordinates, structures/decorations JSONB, land_value appreciation, token_invested tracking.
  - **Eidolon Parcel Types** (`sven-eidolon/types.ts`): `ParcelZone`, `ParcelSize`, `AgentLocation`, `EidolonParcel` interfaces. `EidolonSnapshot` extended with `parcels[]` and meta fields (totalParcels, agentsInCity, agentsOnParcels). 8 new event kinds for parcels/tasks/goals.
  - **Event Bus Expansion** (`event-bus.ts`): 8 new NATS subjects — `sven.market.task_created/completed`, `sven.agent.tokens_earned/moved/built_structure/parcel_acquired`, `sven.goal.progress/completed`.
  - **DB Migration** (`20260422120000_marketplace_tasks_tokens_goals.sql`): 8 DDL operations — ALTER agent_profiles + 7 new tables. Comprehensive CHECK constraints, indexes, seed data.
  - **212 new tests** in `batch18-agent-spawner-skills.test.ts` across 14 describe blocks.
- **Autonomous Economy — Batch 19**: Agent Business Spaces (`*.from.sven.systems`).
  - **Business Spaces Migration** (`20260423120000_agent_business_spaces.sql`): ALTER agent_profiles with 6 business columns (business_subdomain UNIQUE, business_url, business_status, business_landing_type, business_tagline, business_activated_at). New `agent_business_endpoints` table with health monitoring (status, uptime_pct, total_requests), subdomain index, CHECK constraints.
  - **Business Spaces Admin API** (`gateway-api/routes/admin/business-spaces.ts`): Full CRUD — list/get/create/update/deactivate business spaces, reserved subdomain check endpoint. 30 reserved subdomains (admin, api, market, eidolon, misiuni, etc.). Subdomain validation (lowercase, 3-40 chars, alphanumeric + hyphens). NATS events: `sven.agent.business_created/activated/deactivated`.
  - **Agent Spawner Extension** (`agent-spawner.ts`): SpawnRequest extended with `businessSubdomain`, `businessTagline`, `businessLandingType`. Full business creation flow after listing: subdomain validation → reserved check → profile update → endpoint creation → NATS event. Response includes businessSubdomain/businessUrl. NATS spawned payload includes business fields.
  - **Business Landing Routes** (`sven-marketplace/routes/business-landing.ts`): Public API (no auth) — `GET /v1/business/:subdomain` (agent profile + listings + stats), `GET /v1/business/:subdomain/listings` (paginated), `GET /v1/business/directory` (all active spaces). Reads X-Business-Subdomain header from Nginx.
  - **CORS Widening** (`packages/shared/src/cors.ts`): `TRUSTED_SUFFIXES` array — domain-suffix matching for `*.sven.systems` and `*.the47network.com`. `isOriginAllowed()` now: try URL parse → check hostname against suffixes → exact match → array includes. Graceful malformed origin handling.
  - **Eidolon Business Buildings** (`sven-eidolon/repo.ts`): `fetchBusinessBuildings()` method — JOINs agent_profiles + agent_business_endpoints, returns `agent_business` buildings in market district. Height scales with `total_requests` (log10), glow based on endpoint health (1.0 healthy, 0.3 degraded, 0.0 down). Integrated into `getSnapshot()` Promise.all.
  - **Eidolon Type Extensions** (`types.ts`, `event-bus.ts`): `'agent_business'` building kind, 3 new event kinds (agent.business_created/activated/deactivated), 3 new SUBJECT_MAP entries (21 total subjects).
  - **Nginx Wildcard Vhost** (`config/nginx/extnginx-sven-business.conf`): Regex server_name `~^([a-z0-9-]+)\.from\.sven\.systems$`, TLS with wildcard cert, `X-Business-Subdomain $1` header to marketplace (127.0.0.1:9478), security headers, rate limiting, ACME challenge passthrough.
  - **Nginx Landing Vhost** (`config/nginx/extnginx-sven-from-landing.conf`): Bare `from.sven.systems` → marketplace directory API. TLS, security headers.
  - **Marketplace Types** (`types.ts`): `BusinessSpaceStatus` (`inactive | pending | active | suspended`), `BusinessLandingType` (`storefront | portfolio | api_explorer | service_page`).
  - **97 new tests** in `batch19-business-spaces.test.ts` across 12 describe blocks.
- **Autonomous Economy — Batch 20**: Agent Crews + Accountant + Sven Oversight.
  - **Crew System Migration** (`20260424120000_agent_crews_oversight.sql`): 5 new tables — `agent_crews` (typed teams: publishing, research, operations, marketing, legal_compliance, custom), `agent_crew_members` (roles: lead, member, specialist, observer), `agent_messages` (inter-agent messaging with type/priority), `agent_performance_reports` (periodic metrics snapshots), `agent_anomalies` (flagged by accountant with 7 anomaly types, 4 severities). Full indexes and CHECK constraints.
  - **Crew Type System** (`packages/shared/src/agent-crews.ts`): 6 crew types with templates (suggestedArchetypes, min/maxMembers, icon, label). Crew/Message/Anomaly/Oversight types and interfaces. `CREW_TEMPLATES` map, `ALL_CREW_TYPES` array, `crewDistrict()` helper (publishing→market, research→revenue, operations→infra, marketing→market, legal→treasury, custom→revenue).
  - **Crew Management API** (`gateway-api/routes/admin/crew-management.ts`): Full CRUD — list/get/create/update/disband crews, add/remove members with max limits enforcement (publishing: 10, research/ops/marketing: 8, legal: 6, custom: 15). Templates endpoint. NATS events: `sven.crew.created`, `sven.crew.member_added`.
  - **Accountant Module** (`gateway-api/routes/admin/accountant.ts`): Transaction scanner with 4 anomaly detection rules — unusual_amount (3× average), frequency_spike (10 tx/hour), dormant_agent (7 days inactive), revenue_drop (50% decline). Each rule wrapped in try/catch for graceful degradation. Performance report generation per active agent. Anomaly management (CRUD + stats). NATS events: `sven.agent.anomaly_detected`, `sven.agent.report_generated`.
  - **Oversight Dashboard** (`gateway-api/routes/admin/oversight-dashboard.ts`): Economy-wide metrics (agents, crews, tasks, 47Tokens, anomalies, revenue goals, top earners). Per-agent performance view (task history, token ledger, crew memberships, anomalies, business space). Command issuance (suspend/resume/prioritize/deprioritize/reassign/review) — suspend/resume actually update agent_profiles status. NATS event: `sven.oversight.command_issued`.
  - **Agent Messaging** (`gateway-api/routes/admin/agent-messaging.ts`): Inter-agent messaging — send direct or crew-wide messages, list with filters, mark as read, unread count, broadcast to all active agents. 6 message types (info, alert, anomaly, report, command, task_update), 4 priorities. NATS event: `sven.agent.message_sent`.
  - **Eidolon Crew Integration** (`sven-eidolon/`): `crew_headquarters` building kind, `fetchCrewBuildings()` method with table-existence check, `crewTypeToDistrict()` helper. Building height = 20 + members × 8, glow based on crew status. 6 new event kinds and SUBJECT_MAP entries (27 total subjects).
  - **Admin Wiring**: All 4 modules imported and mounted in admin/index.ts.
  - **143 new tests** in `batch20-crews-oversight.test.ts` across 14 describe blocks.
- **Autonomous Economy — Batch 21**: Publishing Pipeline — Full Editorial Workflow.
  - (details below)
- **Autonomous Economy — Batch 22**: Eidolon World Evolution — Living Agent World.
  - **World Evolution Migration** (`20260426120000_eidolon_world_evolution.sql`): 3 new tables — `avatar_configs` (agent body type with 7 variants, glow patterns, mood, XP/level system), `parcel_interactions` (agent-to-parcel visits with 7 interaction types + token exchange tracking), `eidolon_world_events` (world-level events with actor/target/impact). ALTER `agent_profiles` to add personality_traits JSONB, mood, xp, level columns. Full indexes.
  - **Shared Eidolon World Types** (`packages/shared/src/eidolon-world.ts`, 225 LoC): AvatarBodyType (7), GlowPattern (6), AgentMood (8), PersonalityTrait (10), InteractionType (7) enums. `calculateWorldTime()` — 60× accelerated day/night cycle with dawn/day/dusk/night phases. `moodFromActivity()` — derives mood from task/token/interaction metrics. `ARCHETYPE_AVATAR_DEFAULTS` (15 archetypes). XP curve: `xpForLevel()`/`levelFromXp()` (quadratic, level²×100). `XP_REWARDS` (8 activity types).
  - **Frontend Type Sync** (`apps/eidolon-ui/src/lib/api.ts`): Complete rewrite — EidolonBuildingKind 4→7 kinds (agent_business, crew_headquarters, publishing_house), EidolonCitizen roles 5→16 (all archetypes), EidolonEventKind 9→35 events, new EidolonParcel/ParcelZone/ParcelSize/AgentLocation types, extended snapshot meta (totalParcels, agentsInCity, agentsOnParcels).
  - **Citizen Avatars** (`Citizen.tsx`): Complete rewrite with ARCHETYPE_GEO map — 15 archetypes → 7 distinct Three.js geometries (cone, cylinder, octahedron, dodecahedron, torus, icosahedron, sphere). Archetype-driven visual identity.
  - **Building Enhancements** (`Building.tsx`): KIND_ACCENT expanded with 3 new building colors (agent_business:#10b981, crew_headquarters:#f472b6, publishing_house:#a78bfa).
  - **ParcelGrid Component** (`ParcelGrid.tsx`, ~90 LoC): New component rendering agent parcels — zone-colored ground plates (7 zone types), scaled structures (4 size tiers), location beacons for active agents, zone labels via drei Html.
  - **MovementPaths Component** (`MovementPaths.tsx`, ~90 LoC): Animated dashed bezier curves showing agent travel between parcels and city districts. District position mapping for 5 city locations.
  - **Day/Night Cycle** (`useWorldTime.ts` hook + CityScene integration): 60× accelerated world time with dynamic ambient/directional lighting — night (dim 0.12), dawn (warm golden 0.25), day (bright 0.35), dusk (orange 0.25). CityScene renders ParcelGrid + MovementPaths with time-aware lighting.
  - **Event Glow Mappings** (`useEventGlow.ts`): Expanded EVENT_TO_KIND from 9→21 entries covering all new building types.
  - **Backend Parcels** (`repo.ts`): Extended EidolonRepository with `fetchParcels()` method, getSnapshot() now includes parcels in Promise.all, meta extended with totalParcels/agentsInCity/agentsOnParcels counters.
  - **Admin Eidolon World API** (`gateway-api/routes/admin/eidolon-world.ts`, ~270 LoC, 15 endpoints): Parcel CRUD (list/get/acquire/upgrade), parcel interactions, avatar management (get/upsert), movement system (move/active/arrive), world time, world events (list/create), XP granting.
  - **NATS Events**: 3 new SUBJECT_MAP entries (sven.agent.avatar_changed, sven.world.tick, sven.world.parcel_interaction). Backend types.ts: 3 new EidolonEventKind values.
  - **123 new tests** in `batch22-eidolon-world.test.ts` across 22 describe blocks.
  - **Publishing Pipeline Migration** (`20260425120000_publishing_pipeline.sql`): 4 new tables — `publishing_projects` (manuscript tracking with status progression), `editorial_stages` (per-project stage tracking with agent assignment), `quality_reviews` (review scoring 0-100 by category), `book_catalog` (published books with ISBN, format, sales tracking). ALTER `marketplace_tasks` to add 5 new task types (review, proofread, format, cover_design, genre_research). Full indexes and CHECK constraints.
  - **Shared Publishing Types** (`packages/shared/src/publishing-pipeline.ts`): `PublishingStatus` (9 states: manuscript → published + rejected), `EditorialStageType` (6 stage types), `StageStatus` (5 states), `BookFormat` (6 formats incl. audiobook), `QualityCategory` (9 categories). `PUBLISHING_STATUS_ORDER` array + `canAdvanceTo()` progression validator + `stageTypeToProjectStatus()` mapper + `MIN_APPROVAL_SCORE` (70) + `PUBLISHING_TASK_TYPES` constant.
  - **4 New Skills**: `book-review` (archetype: analyst, 4 actions, $2.99/review), `book-proofread` (archetype: writer, 4 actions, $0.01/1000 words), `book-format` (archetype: designer, 5 actions, $9.99/format), `book-cover-design` (archetype: designer, 4 actions, $14.99/cover).
  - **Publishing Admin API** (`gateway-api/routes/admin/publishing.ts`): Full CRUD — project management (list/get/create/update/delete), stage management (create/update/complete with auto-advance), quality reviews (submit/list with approval threshold), book catalog (publish flow creates listing + catalog entry, list catalog), stats endpoint. Status progression validated via `canAdvanceTo()`. NATS events on all mutations.
  - **Task Executor Handlers** (`sven-marketplace/task-executor.ts`): 5 new handlers — `handleReview()` (structured editorial scoring with 4 categories), `handleProofread()` (grammar/style correction lists), `handleFormat()` (format conversion with page count), `handleCoverDesign()` (AI prompt generation + typography + color palette), `handleGenreResearch()` (market trends + competition analysis + recommendations).
  - **Marketplace ListingKind**: Added `'published_book'` to the `ListingKind` union type for published book listings.
  - **Eidolon Integration**: `'publishing_house'` building kind in market district, 4 new event kinds (publishing.project_created/stage_advanced/review_submitted/book_published), 4 new NATS SUBJECT_MAP entries (31+ total subjects).
  - **130 new tests** in `batch21-publishing-pipeline.test.ts` across 13 describe blocks.
- Flutter companion app: Backtest page — run strategy backtests with real Binance historical data directly from mobile. Strategy dropdown, symbol/timeframe/candle selectors, live results card with total return, win rate, Sharpe ratio, max drawdown, profit factor metrics. Uses `POST /v1/trading/backtest/run-auto` (Batch 12A).
- Flutter companion app: Exchange Credentials page — manage Binance, Bybit, and Alpaca API keys from mobile. Add dialog with exchange selector, API key/secret inputs, paper/live toggle. List view with masked keys, PAPER/LIVE badges, revoke with confirmation. Uses admin CRUD endpoints (Batch 12D).
- Flutter companion app: Broker Health page — monitor connected broker health, latency, and connectivity status. Summary card (connected count, avg latency), per-broker tiles with status dot, latency badge, and exchange icon. Pull-to-refresh. Uses `GET /v1/trading/broker/list` (Batch 12C).
- TradingService: 8 new API methods — `fetchBacktestStrategies()`, `runBacktestAuto()`, `fetchExchangeCredentials()`, `addExchangeCredential()`, `revokeExchangeCredential()`, `fetchBrokerList()`, `connectBroker()` with full error handling and `notifyListeners()` integration.
- Trading models: 4 new model classes — `BacktestResult` (with computed `winRate`), `BacktestStrategy`, `ExchangeCredential` (with `brokerDisplay`), `BrokerHealth` (with `displayName`). All with `fromJson` factories following existing null-safe patterns.
- Trading dashboard: 3 new quick-action buttons (Backtest, Exchange Keys, Broker Health) wired into navigation with haptic feedback.
- Batch 12A: Backtest with real historical data — new `POST /v1/trading/backtest/run-auto` route that auto-fetches real Binance historical candles via paginated REST API (up to 5000 bars), runs backtest with any built-in strategy, persists results to DB, and broadcasts SSE `backtest_complete` event. New helpers: `BINANCE_INTERVAL_MAP`, `parseBinanceKlines()`, `fetchBinanceHistoricalCandles()` in `trading/binance.ts`. Eliminates need for callers to supply candle data manually.
- Batch 12B: CCXT-style Binance + Bybit broker connectors — full `BrokerConnector` implementations for both exchanges. Binance connector: HMAC-SHA256 signed requests for account, order (market/limit/stop), cancel, positions (derived from balances), open orders, klines, health check via `/api/v3/ping`. Bybit V5 connector: HMAC-SHA256 signed headers (`X-BAPI-*`), unified account wallet, spot order create/cancel, position list, real-time orders, klines, health check via `/v5/market/time`. Both support paper mode via testnet URLs (`testnet.binance.vision`, `api-testnet.bybit.com`).
- Batch 12C: Real-money order routing path — autonomous trading loop now selects broker based on `SVEN_PAPER_TRADE_MODE` and `SVEN_ACTIVE_BROKER` env vars instead of hardcoded paper broker. Falls back to paper if configured broker unavailable. Broker connect route (`POST /v1/trading/broker/connect`) now creates proper connector instances with health check validation before registration. Supports alpaca, ccxt_binance, ccxt_bybit. Connected broker credentials persisted to DB for restart survival.
- Batch 12D: Exchange key management — new `exchange_credentials` DB table with UNIQUE(org_id, broker) constraint, active/revoked/expired status tracking, and audit timestamps. Admin routes: `GET /v1/admin/trading/exchange-credentials` (list with masked keys), `POST /v1/admin/trading/exchange-credentials` (add/update with upsert), `DELETE /v1/admin/trading/exchange-credentials/:id` (soft revoke for audit trail). Auto-loads persisted credentials on gateway startup and registers connectors.
- New `broker_connected` SSE event type for real-time broker connection notifications.
- Batch 10E: Portfolio correlation guard — three-rule portfolio-level risk filter that blocks new positions when they would create dangerous concentration. Rule 1: blocks if candidate has |corr| >= 0.85 with same-direction open position (prevents piling into correlated long/short). Rule 2: cluster exposure cap — positions with |corr| >= 0.70 cluster must not exceed 30% of capital. Rule 3: portfolio heat — if weighted-average |correlation| across all open positions >= 0.75, blocks new entries. Computes Pearson correlation on log returns of last 50 candles. All thresholds configurable via `PortfolioCorrelationConfig`. Guard runs after duplicate position check, before LLM brain escalation. Blocked entries logged with heat score, max pair correlation, and cluster exposure %. New metric `portfolioGuardBlocks` in tick log.
- Batch 10F: Admin trading dashboard — 5 new admin routes under `/v1/admin/trading/*`: (1) `GET /trading/dashboard` — consolidated overview in one response: balance, peak, P&L, drawdown, circuit breaker, open positions with unrealized P&L, performance stats, recent orders, recent closed trades, active alerts, source weights, dynamic watchlist. (2) `GET /trading/correlation-matrix` — live portfolio correlation matrix for open positions with static group detection (BTC-ecosystem, ETH-ecosystem, Layer-1, Meme-coins), pairwise correlations, position exposure breakdown, portfolio heat score. (3) `GET /trading/execution-quality` — detailed execution quality metrics: win/loss count, win rate, avg win/loss size, profit factor, largest win/loss, avg hold duration, per-symbol breakdown sorted by P&L. (4) `GET /trading/alert-history` — triggered alert history from DB. (5) `GET /trading/pnl-chart` — equity curve data with cumulative P&L from closed positions.
- Batch 10F: Alert engine wired into trading loop — price, drawdown, and signal alerts now evaluate automatically on every tick (60s). Price alerts check all scanned symbols' current prices. Drawdown alerts check current portfolio drawdown %. Signal alerts check trade candidates' direction and confidence. Triggered alerts fire push notifications to companion app via existing push infrastructure (`pushTradeNotification`). Alert events also broadcast via SSE `alert_triggered`.
- 47Plate Sven AI integration: `driver-assistant` skill in `skills/automotive/` — AI-powered driver assistant and legal shield for 47Plate vehicle companion app. 6 capabilities: (1) Warning light photo diagnosis with vehicle-specific severity/cost/action. (2) Romanian traffic ticket appeal generation (contestație) with procedural nullity checks, dashcam evidence, OUG 195/2002 + HG 1391/2006 + OG 2/2001 legal citations. (3) STAS 1848 road sign compliance verification (placement, visibility, retroreflection, mandatory combinations). (4) OBD-II trouble code interpretation with Romanian market repair cost estimates. (5) Receipt/invoice OCR extraction for TCO dashboard (vendor CUI, line items, VIN, VAT). (6) Legal nullity audit — systematic 15-field procedural check per OG 2/2001 Art. 16-17. DB migration adds `kid` and `organization_id` columns to `api_keys` table (required for kid-based auth and org binding). API key provisioned for 47Plate with scopes: openai, chat.complete, models.read, mcp.tools.list, mcp.tools.call, a2a. Soul updated with 47Network Product Integrations section (v1.2.0, 36,957 chars).
- Batch 11A-D: Sven self-knowledge, self-healing guide, and self-coding skills — three new skills in `skills/ai-agency/`: (1) `self-knowledge` — Sven can introspect his own architecture, capabilities, services, skills, codebase structure, trading status, and self-assessment. Actions: describe_architecture, list_capabilities, list_services, list_skills, codebase_map, trading_status, self_assessment. (2) `self-heal-guide` — Sven's operational playbook for self-maintenance: explains the full heal pipeline workflow, all 11 ops tools with detailed usage guides, all 33 safety features, step-by-step diagnostic workflow, and symptom-based troubleshooting (TypeScript errors, container crashes, deploy failures, circuit breaker blocks). (3) `self-code` — Sven's guide to extending himself: skill authoring guide, handler templates (TypeScript/Python/Shell), SKILL.md manifest templates, codebase conventions, patterns for extending gateway-api and skill-runner, dynamic skill authoring workflow via skill.author tool. Soul seed updated with all Batch 8-10 trading features (ATR exits, adaptive thresholds, Kelly sizing, WS feed, multi-TF, LLM sentiment, execution quality, state persistence, graceful shutdown, companion push) and new Self-Knowledge & Self-Coding section documenting codebase understanding, skill authoring, heal pipeline usage, dynamic tool creation, and code conventions. Live soul updated in DB (v1.1.0, 35,957 chars).
- Batch 8 trading improvements — 6 new features: (1) Correlation filter prevents concentrated risk by blocking same-direction entries on assets with ≥80% Pearson correlation; (2) Dynamic position sizing scales with signal strength (0.5–1.5x), ATR volatility (0.5–1.3x), and circuit breaker cooldown; (3) Win/loss streak momentum adjusts confidence thresholds — relaxed after wins, tightened after losses; (4) Profit-taking ladder with partial exits at +1% (25%) and +2% (25%) to lock gains while letting remainder ride; (5) Gradual circuit breaker cooldown — 3 losses reduces size to 50% for 30min, 4 losses to 25% for 60min, before hard stop at 5; (6) Time-of-day filter avoids low-liquidity weekend periods (Sat 00–06 UTC, Sun 00–12 UTC). New indicators: ATR (Average True Range) for volatility measurement, Pearson correlation for cross-asset risk detection.
- Flutter mobile app fixes: corrected API base URL from hardcoded port 3004 to gateway (EnvConfig.apiBase), added public-status fallback for guest users, fixed SSE path to match gateway route.

### Added
- **Batch 98**: Agent Auto-Scaling — scaling policies, metric tracking, cost optimisation (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 99**: Agent DNS Management — zone CRUD, record management, propagation tracking (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 100**: Agent SSL Certificates — cert lifecycle, auto-renewal, expiry alerts (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 101**: Agent Chaos Engineering — fault injection, resilience testing, weakness discovery (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 102**: Agent A/B Testing — experiment design, variant assignment, statistical analysis (migration, types, skill, eidolon, event-bus, task-executor, tests)
- **Batch 97 — Agent Rate Limiting**: rate limiting policies, quotas, throttling, and violation tracking
- **Batch 96 — Agent Workflow Templates**: reusable workflow templates with steps, triggers, and execution tracking
- **Batch 95 — Agent Schema Registry**: centralized schema registry with versioning, compatibility, and evolution logging
- **Batch 94 — Agent Data Validation**: validation schemas, rules, pipelines, audit logging with 5 tables and 20 indexes
- **Batch 93 — Agent Load Balancing**: load balancers, backends, routing rules, health probes, traffic metrics with 5 tables and 20 indexes
- **Batch 92 — Agent Distributed Tracing**: traces, spans, baggage, sampling, analytics with 5 tables and 20 indexes
- **Batch 91 — Agent Health Dashboard**: health checks, dashboards, widgets, thresholds, alert rules with 5 tables and 20 indexes
- **Batch 90 — Agent Configuration Management**: config store, namespaces, versioning, validation, audit with 5 tables and 20 indexes
- **Batch 89 — Agent Event Sourcing**: event store, aggregates, projections, snapshots, replay with 5 tables and 20 indexes
- **Batch 88 — Agent Search & Indexing**: full-text search, query routing, synonyms, relevance tuning with 5 tables and 20 indexes
- **Batch 87 — Agent Content Delivery**: CDN origins, asset caching, purging, delivery analytics with 5 tables and 20 indexes
- **Batch 86 — Agent State Machine**: finite state machines, transitions, guards, templates with 5 tables and 20 indexes
- **Batch 85 — Agent Dependency Injection**: DI containers, bindings, scopes, interceptors, lifecycle with 5 tables and 20 indexes
- **Batch 84 — Agent Circuit Breaker**: circuit breaker patterns, fallbacks, resilience metrics with 5 tables and 19 indexes
- **Batch 83 — Agent Service Discovery**: service registry, health checks, endpoint cataloging, dependency tracking with 5 tables and 19 indexes
- **Batch 82 — Agent Content Moderation**: moderation policies, content reviews, appeals, queue management, action tracking with 5 tables and 21 indexes
- **Batch 75 — Agent Service Mesh & Discovery**: service registry, endpoints, dependencies, health checks, traffic policies; 5 tables, 20 indexes, 7 task handlers
- **Batch 76 — Agent Cost Optimization**: budgets, spend tracking, forecasts, recommendations, alerts; 5 tables, 20 indexes, 7 task handlers
- **Batch 77 — Agent Multi-Tenancy**: tenants, members, quotas, invitations, audit log; 5 tables, 20 indexes, 7 task handlers
- **Batch 78 — Agent Incident Management**: incidents, timeline, escalations, runbooks, postmortems; 5 tables, 21 indexes, 7 task handlers
- **Batch 79 — Agent Queue Management**: task queues, messages, consumers, schedules, metrics; 5 tables, 20 indexes, 7 task handlers
- **Batch 80 — Agent Session Management**: sessions, messages, contexts, handoffs, analytics; 5 tables, 20 indexes, 7 task handlers
- **Batch 81 — Agent Plugin System**: plugins, installations, hooks, events, reviews; 5 tables, 20 indexes, 7 task handlers
- **Batch 74 — Agent Log Aggregation & Search**: log streams, entries, filters, dashboards, alerts; 5 tables, 20 indexes, 7 task handlers
- **Batch 73 — Agent API Gateway & Routing**: API routes, gateway policies, request transformation, load balancing, and traffic analytics
- **Batch 72 — Agent Caching & CDN**: Cache policies, CDN distributions, entry management, purge workflows, and cache analytics
- **Batch 71 — Agent Pipeline Templates**: Reusable workflow templates, stage orchestration, triggers, and artifact management
- **Batch 70 — Agent Environment Configuration**: Environment profiles, config variables, templates, snapshots, and audit logging
- **Batch 69 — Agent Webhooks & External Integrations**: Outbound webhook delivery, event subscriptions, retry logic, and external integration management
- **Batch 68 — Agent Localization & i18n**: Multi-language content management, translation workflows, locale detection, and coverage tracking
- **Batch 67 — Agent Rate Limiting & Throttling**: Fair usage quotas, burst capacity management, throttle strategies, and per-agent rate limit policies
- **Batch 66 — Agent Data Export & Import**: Bulk data portability with multi-format export/import, schema registry, field mappings, and transfer progress tracking
- **Batch 65 — Agent Feature Flags & Experiments**: Toggle features, run A/B experiments with variant assignments, gradual rollouts, and metric-driven winner selection
- **Batch 64 — Agent Secrets & Credentials**: Encrypted vault for API keys, tokens, credentials with rotation policies, access auditing, and controlled sharing
- **Batch 63 — Agent Versioning & Rollback**: Semantic versioning, state snapshots, multi-slot deployments (production/staging/canary), automatic rollbacks, and version diff tracking for agents
- **Batch 62 — Agent Marketplace Recommendations**: AI-powered recommendation engine for marketplace discovery, collaborative filtering models, interaction tracking, recommendation campaigns, and feedback-driven personalization
- **Batch 61 — Agent Feedback & Surveys**: feedback submission, survey management, NPS analytics, improvement proposals, Eidolon feedback_plaza building
- Gateway API routes for all 8 expansion pillars: Design Intelligence (`/v1/design/*` — 15 endpoints: color palette/theme/contrast/blindness, typography scale/pairing/readability, motion animate/spring/stagger, layout spacing/grid/pattern, full design audit + history), Multi-Model & AI Agency (`/v1/models/*` + `/v1/agents/*` — 12 endpoints: model registry CRUD, intelligent routing with scoring, VRAM budget, agent spawn/terminate/list, benchmark suites/run/leaderboard), OCR & Document Intelligence (`/v1/documents/*` — 8 endpoints: OCR with mode selection, full pipeline, entity extraction, PII redaction, summarization, comparison, job history), Quantum Computing (`/v1/quantum/*` — 11 endpoints: simulation with noise models, QAOA/annealing/portfolio optimization, Grover's search, QRNG, backends, cost estimation, benchmark, job history), Security Toolkit (`/v1/security/*` — 10 endpoints: SAST scanning with 14 rules, dependency audit, secret scanning, infrastructure audit for Docker/TLS/env, penetration testing with 6 scenarios, security posture report, scan history), Trading Platform (`/v1/trading/*` — 12 endpoints: instruments, orders with mandatory pre-trade risk checks, portfolio with positions/performance, risk assessment with circuit breakers, candle predictions with ensemble, news sentiment/impact/entity analysis, strategy registry, signal aggregation, NATS subjects), Marketing Intelligence (`/v1/marketing/*` — 13 endpoints: competitor analysis with DB persistence, brand guidelines + voice check, content outline/draft/scoring with readability analysis, campaign creation + listing, conversation follow-up with empathy scoring, ROI/funnel analytics), Federated Compute Mesh (`/v1/compute/*` — 13 endpoints: device registration/discovery/status/removal, job submission/listing/detail/cancel/progress reporting, inference routing, scheduler policy CRUD, mesh statistics). All routes follow established gateway patterns: Fastify, requireRole + requireTenantMembership auth, parameterized SQL, `{ success, data }` response envelope, isSchemaCompatError graceful degradation, structured logging. DB migration `20260412100000_pillar_expansion_tables.sql` creates 17 tables with proper FK constraints, CHECK constraints, and optimized indexes across all 8 pillars.
- Trading Platform system (Pillar 6 — Phase C): new `@sven/trading-platform` package with six production libraries — market data (Instrument/Candle/Tick/OrderbookSnapshot types, InstrumentRegistry with 10 built-in crypto instruments, normalization/validation utilities, spread calculation, data gap detection, retention policies), trading engine (Signal/Strategy types, StrategyRegistry with 7 built-in strategies: kronos-momentum/mirofish-consensus/news-impact/ensemble-voter/macro-regime/mean-reversion-bb/breakout-volume, weighted signal aggregation with 5 source weights, autonomous trading loop config with paper mode default), risk management (5 pre-trade risk checks: max position/max exposure/daily loss/min confidence/mandatory stop loss, 4 position sizing models: fixed fractional/Kelly criterion/volatility-based/confidence-weighted, circuit breaker system with 5 breakers: daily-loss/drawdown/consecutive-losses/flash-crash/model-disagreement, drawdown tracking, correlated exposure analysis with 4 correlation groups), order management (7 order types, 7 status states with validated state machine transitions, Position tracking with unrealized P&L, PortfolioState computation, 47Token internal currency system with freeze/release mechanics, TradePerformance metrics: Sharpe/Sortino/profit factor/expectancy), predictions (BSQ tokenization projecting OHLCV onto unit sphere with 8 scale-invariant features, multi-horizon predictions, MiroFish simulation types with survival-score-weighted consensus, model ensemble with weighted voting, accuracy tracking with direction accuracy/MAE/RMSE), news intelligence (5-level impact classification with hierarchical keyword matching, sentiment scoring with positive/negative word sets, entity extraction for crypto symbols/sectors/countries, full processing pipeline with dedup, LLM analysis prompt template, 12 NATS subject constants). Ten new trading skills: `place-order` (create/cancel/status/list/fill_simulate with mandatory risk checks), `market-data-query` (candles/instruments/orderbook/validate/gap_detect/sentiment), `risk-assessment` (check_signal/position_size/circuit_breakers/exposure/drawdown/full_assessment), `predictions` (predict/tokenize/multi_horizon/ensemble/evaluate/accuracy), `news-analysis` (analyze/classify/sentiment/entities/llm_analysis), `portfolio-manager` (status/positions/performance/token_balance/freeze_funds/release_funds), `backtest` (run/list_strategies/config/summary with synthetic candle generation and SMA20 crossover), `chart-analysis` (indicators/patterns/support_resistance/trend/full_analysis with SMA/RSI/MACD/Bollinger Bands), `strategy-manager` (list/details/enable/disable/add_custom/set_weights/loop_config), `tool-builder` (list_subjects/describe_pipeline/compose_workflow/validate with 3 preset workflows).
- Quantum Computing Exploration system (Pillar 4 — Phase D): new `@sven/quantum-sim` package with four production libraries — quantum gates (Complex number arithmetic library with add/sub/mul/conjugate/magnitude/scale/cexp, 12 standard gates: H/X/Y/Z/S/T/I/CNOT/SWAP/CZ/Toffoli plus parameterized Rx/Ry/Rz, gate registry with alias lookup, tensor product, state vector application, unitarity verification), state vector simulator (circuit builder with 1–25 qubit range, single/two/multi-qubit gate application with optimized paths, full simulation pipeline, measurement with probability distribution, multi-shot histogram, 3 noise models: depolarizing/amplitude_damping/phase_damping, ASCII circuit visualization, quantum volume estimation), quantum algorithms (QAOA for combinatorial optimization with variational parameter sweep, Grover's search with optimal iteration count, quantum Monte Carlo with amplitude estimation concepts, quantum random number generation via Hadamard measurement with entropy analysis, quantum annealing emulation with transverse field tunneling, portfolio optimization via QAOA with risk-adjusted Sharpe ratio), hardware abstraction (QuantumBackend interface for simulator/IBM/AWS/Origin backends, job queue with full lifecycle management, result cache with LRU eviction, cost estimation with per-shot/per-gate/per-qubit pricing for 4 backend types, backend registry with 4 profiles: local simulator/IBM Brisbane 127q/AWS SV1 34q/Origin Wuyuan 24q). Five new quantum skills: `quantum-simulate` (run/visualize/list_gates/noise_sim/measure), `quantum-optimize` (portfolio/qaoa/annealing), `quantum-random` (generate/bytes/uuid/analyze with entropy and randomness testing), `quantum-explain` (gate/algorithm/concept/demo_circuit with educational content for 7 gates, 4 algorithms, 7 concepts, 3 demo circuits), `quantum-benchmark` (quantum_volume/gate_benchmark/backend_compare/cost_estimate/simulator_limits).

### Fixed
- SSE stream timeout during chat: nginx `proxy_read_timeout 60s` on `/v1/` killed streaming connections when the upstream LLM was slow to respond (model loading, reasoning/thinking pause). Added dedicated nginx location blocks for `/v1/chat/completions`, `/v1/responses`, `/v1/streams/*/sse`, and `/v1/entity/stream` with `proxy_read_timeout 3600s` and `proxy_buffering off`. Added equivalent Caddy `flush_interval -1` and `read_timeout 3600s` config. Gateway now sends SSE keepalive comments (`: keepalive\n\n`) every 15 seconds during streaming to prove liveness. Replaced `AbortSignal.timeout()` (total-duration) with a connection-only timeout that clears once the streaming body is opened — long streaming responses are no longer killed mid-stream.

### Changed
- Trading route decomposition (Batch 9A): extracted 675 lines from the 4173-line `trading.ts` monolith into 5 focused modules — `trading/types.ts` (shared type definitions), `trading/gpu-fleet.ts` (GPU fleet management with createGpuFleet, callLlm, selectNode, acquireGpu), `trading/news-sources.ts` (8 news source fetchers + RSS feeds), `trading/binance.ts` (Binance API helpers), `trading/index.ts` (barrel re-exports). All call sites updated with new function signatures. File reduced from 4173 → 3498 lines.
- Batch 9B: Trading state persistence — critical in-memory state now survives container restarts. New columns on `sven_trading_state`: `consecutive_wins`, `trailing_stop_peaks` (JSONB map of position ID → peak unrealized P&L), `profit_ladder_state` (JSONB map of position ID → triggered threshold array), `position_signal_map` (JSONB map of symbol → entry signal directions for source attribution), `dynamic_watchlist` (JSONB array of trend scout symbols with expiry). State persisted at end of every trading tick (60s) and on every position close. Restored on startup with date rehydration and expiry filtering. Migration: `20260617100000_sven_trading_state_v2.sql`.
- Batch 9C: LLM-based per-symbol news sentiment — replaces crude keyword matching with nuanced LLM scoring. For each tracked symbol (core + dynamic), recent news headlines are fed to the LLM to score directional sentiment (bullish/bearish/neutral with -1.0 to +1.0 score and confidence). Results cached 10min per symbol. High-confidence LLM sentiments injected as synthetic news events into the trading decision engine, amplifying signal quality. Visible in SSE `loop_tick` events per symbol.
- Batch 9D: Multi-timeframe signal confluence — fetches 15m (100 bars), 1h (200 bars), and 4h (100 bars) candles in parallel for each symbol. Computes SMA-20 trend direction on each timeframe, then grades alignment: fully aligned (all 3 agree) → 1.3x signal boost; partial (2/3 agree) → 1.1x; conflicting → 0.8x dampening. Prevents false entries when lower timeframes diverge from higher timeframe trends. Multi-TF data exposed in SSE `loop_tick` per-symbol analysis and tick-level summary logging (`multiTfAligned`/`multiTfConflicting` counts).
- Batch 9E: Binance WebSocket real-time price feed — replaces per-symbol REST polling for current prices with a persistent WebSocket connection to Binance combined stream (`miniTicker`). New `BinanceWsFeed` class in `trading/binance-ws.ts` with auto-reconnect (exponential backoff 1s→30s), dynamic symbol subscription (add/remove without reconnect), ping/pong heartbeat, and graceful shutdown. Prices cached in-memory with 30s freshness threshold; falls back to REST if WS is unhealthy. Reduces Binance API calls by ~15 per tick. WS feed health (`wsFeedHealthy`/`wsPricesCached`) exposed in tick logs and loop status endpoint. Throttled SSE price broadcasts (max 1/symbol/10s).
- Batch 9F: Execution quality tracking + graceful shutdown — records every trade entry/exit with execution metrics: tick-to-execution latency, max favorable excursion (MFE), max adverse excursion (MAE), hold time, close reason, multi-TF alignment at entry, LLM sentiment at entry. Computes real-time quality metrics: win rate, avg gain/loss %, profit factor, avg hold time, win rate by multi-TF alignment. Exposed via loop status endpoint. Graceful shutdown on SIGTERM/SIGINT persists all trading state to DB, stops WebSocket feed, and logs execution quality summary before exit.
- Batch 10A: ATR-based dynamic TP/SL exits — replaces fixed percentage stop-loss and take-profit levels with ATR-scaled exits that adapt to each asset's volatility. Hard SL = 1.5× ATR (paper) / 2.0× ATR (live), hard TP = 3.0× ATR (paper) / 4.0× ATR (live), trailing stop activation = 0.5× ATR, trailing tighten threshold = 1.5× ATR, profit ladder levels at 1× ATR (25%) and 2× ATR (25%). ATR captured at entry and stored per-position; falls back to fixed percentages when ATR data is unavailable.
- Batch 10B: Adaptive signal threshold calibration — replaces fixed confidence threshold with per-candidate adaptive thresholds. Base threshold adjusts dynamically: +5% per consecutive loss (max +15% streak penalty), up to −10% bonus when win rate exceeds 60% over ≥5 trades. Per-candidate adjustments: −5% for multi-timeframe aligned signals, −3% when LLM sentiment agrees with signal direction, +5% for conflicting timeframes. Clamped to [0.15, 0.85] range.
- Batch 10C: Kelly criterion position sizing — overlays half-Kelly formula on existing dynamic position sizing. Uses execution quality log (≥10 closed trades required) to compute optimal bet fraction: Kelly = W − (1−W)/R, applied at 50% (half-Kelly for safety). Kelly multiplier clamped [0.3×, 1.5×]. Alignment multiplier: 1.15× for multi-TF aligned, 0.75× for conflicting signals. Final position size bounded 1–10% of balance.
- Batch 10D: Companion app trading push notifications — sends real-time push notifications for trade entries, position closes, and circuit breaker trips. Notifications inserted into `push_pending` table with `sven_trading` channel for privacy-first delivery (companion app polls for content). Flutter companion app updated: trading channel preference toggle in notification settings, group notification support with `com.sven.trading` group key, summary rollup for multiple trading alerts.

### Fixed
- Fixed broken `sven_positions` table references — two queries in the Sven chat context and status update were querying a non-existent `sven_positions` table (silently failing). Corrected to use `trading_positions` which is the actual table.
- Proactive notification system: new `@sven/proactive-notifier` package enabling Sven to autonomously reach out via Slack, Discord, WhatsApp, Matrix, Telegram, email, push, or webhook. Core engine with trigger rule evaluation, cooldown enforcement, per-rule and global rate limiting, quiet hours suppression, severity-based endpoint filtering, adaptive suppression via user feedback, and freeform message dispatch. Three production libraries — trigger system (6 default rules for critical errors, resource exhaustion, security alerts, training milestones, health degradation, task completion; severity ordering; configurable cooldowns and rate limits), channel dispatcher (8 channel types; template rendering with `{{variable}}` placeholders; quiet hours with midnight-wrap support; severity-to-priority mapping), engine (ProactiveEngine class with DB-backed rule/endpoint/config reload, event evaluation pipeline, outbox dispatch with NATS publish, freeform send, feedback recording with adaptive rule disabling). Two new skills: `proactive-config-manager` (get_config/update_config/list_rules/create_rule/update_rule/delete_rule/list_endpoints/create_endpoint/update_endpoint/delete_endpoint/list_log/get_stats/seed-defaults), `proactive-sender` (send_message/send_alert/send_question/send_progress/record_feedback with severity banners and formatted templates). Full gateway admin API at `/v1/admin/proactive-notifications/*` with 12 endpoints for config CRUD, trigger rule CRUD, channel endpoint CRUD, freeform send, notification log with pagination/filtering, delivery stats, feedback recording, and default rule seeding. DB migration adds `proactive_trigger_rules`, `proactive_channel_endpoints`, and `proactive_notification_log` tables with proper indexes. New NATS subjects `notify.proactive` and `notify.proactive.feedback` under existing NOTIFY stream.
- Multi-Model & AI Agency system (Pillar 2 — Phase B): new `@sven/model-router` package with four production libraries — model registry (6 built-in models: Gemma 4, Nemotron-3 Super, Qwen-3.5, MIMO-v2 Pro, GLM-OCR, Kronos Financial; 10 task types; quant format tracking; VRAM budget enforcement; health check recording; default model per task; full manifest export), intelligent router (keyword-based task classification, multi-factor model scoring with quality/speed/cost weights, failover chain routing, VRAM budget calculation, eviction suggestions, context splitting for models with limited context windows), agentic runtime (AgentRegistry with 40 built-in agent definitions across 4 categories — code/research/operations/communication — each with capabilities and resource limits; agent spawn/terminate lifecycle; parent-child supervision trees; inter-agent messaging; resource usage tracking), benchmark engine (ELO ranking system, A/B testing framework, built-in coding and reasoning evaluation suites, leaderboard generation, detailed reports). Five new AI agency skills: `model-router` (route/score/classify/list_models/vram_budget/suggest_eviction), `agent-spawner` (spawn/terminate/terminate_all/status/list_instances/list_definitions/supervision_tree/stats), `agent-messenger` (send/broadcast/history), `model-benchmark` (list_suites/create_run/complete_run/leaderboard/report/record_elo/ab_results), `model-registry` (list/get/by_task/by_status/set_default/get_default/manifest/set_status/health).
- OCR & Document Intelligence system (Pillar 3 — Phase B): new `@sven/document-intel` package with four production libraries — OCR engine (6 recognition modes: text/table/handwriting/code/math/mixed; 16 language support with auto-detection via Unicode range heuristics for CJK/Japanese/Korean/Arabic/Cyrillic/Devanagari; region-based processing; table→Markdown conversion; confidence scoring), document pipeline (7-stage processing: normalisation→segmentation→OCR→structure assembly→entity extraction→summarisation→storage; batch processing; 10 document types), entity extraction (named entity recognition for person/email/URL/currency/phone patterns; receipt data extraction; ID document parsing; invoice data extraction; PII redaction with configurable replacement), document summariser (TF-based extractive summarisation; 4 summary styles: executive/detailed/bullet_points/one_liner; document comparison via word-set intersection; summary translation). Ten new OCR skills: `document-reader`, `table-extractor`, `document-summarizer`, `document-translator`, `code-screenshot-reader`, `document-search`, `batch-processor`, `receipt-scanner`, `id-document-reader`, `entity-extractor`.
- Distributed Compute Mesh system (Pillar 8 — Phase B): new `@sven/compute-mesh` package with four production libraries — device registry (5 built-in mesh nodes: VM4 coordinator, VM5 GPU with A100 40GB, VM13 inference with T4 16GB, S24 Ultra mobile with Adreno 750, desktop workstation with RTX 4070; device capability tracking with GPU/battery/network info; heartbeat mechanism; opt-in/opt-out consent; work unit counting; aggregate mesh stats), scheduler (capability-matching with GPU/load/battery/locality scoring; configurable scheduling policies; batch scheduling; work unit creation; 4 decomposition strategies), job manager (full job lifecycle: create→decompose→schedule→execute→aggregate; MapReduce/Pipeline/ScatterGather/LayerSplit decomposition strategies; progress tracking; result aggregation; retry with configurable limits; sensitivity classification), AirLLM-style layer inference (single-device sequential layer execution; multi-device pipeline distribution proportional to VRAM; activation transfer estimation with 60% compression; distributed inference plan generation; inference time estimation). Four new compute-mesh skills: `mesh-device-manager` (list/get/list_online/by_type/heartbeat/opt_in/opt_out/stats), `mesh-job-orchestrator` (create_job/get_job/list_jobs/cancel/progress/complete_unit/fail_unit/stats), `mesh-scheduler` (schedule/schedule_batch/score_device), `layer-inference-planner` (plan_single/plan_distributed/estimate/visualize).
- Security & Defense toolkit (Pillar 5 — Phase A): new `@sven/security-toolkit` package with six production libraries — SAST engine (14 built-in rules covering SQL injection, XSS, SSRF, path traversal, command injection, insecure deserialization, hardcoded secrets, insecure crypto, auth bypass, prototype pollution, open redirect, insecure random, missing security headers, information disclosure; CWE/OWASP mapped; severity scoring), dependency audit (CVE matching, license risk classification permissive/copyleft/unknown, typosquat detection via Levenshtein distance against 40+ popular packages, supply chain flags), secret scanner (20 patterns covering AWS/GitHub/GitLab/Slack/Stripe/Twilio/SendGrid/JWT/PEM/npm/PyPI/GCP/DB URLs/generic API keys; Shannon entropy gating; automatic redaction), infrastructure scanner (Docker Compose auditor for privileged mode/capabilities/host network/sensitive volumes/port exposure/hardcoded secrets/missing healthcheck/writable fs/root user; TLS certificate auditor with expiry thresholds; env file auditor), pentest framework (6 built-in scenarios: auth brute force, privilege escalation, SQL injection, security headers, rate limiting, information disclosure; admin-gated), security posture report (weighted scoring SAST 30%/deps 20%/secrets 25%/infra 15%/pentest 10%; A-F grading; OWASP/SOC 2 compliance mapping; trend analysis). Six new security skills: `sast-scanner`, `dependency-audit`, `secret-scanner`, `infra-scanner`, `pentest-framework`, `security-posture`.
- Marketing & Business Intelligence system (Pillar 7 — Phase A): new `@sven/marketing-intel` package with six production libraries — competitive intelligence (competitor profiling, signal tracking across 7 source types, impact classification, change diffing, weekly report generation, threat matrix with trend analysis), brand voice engine (47Network brand profile with tone/audience/differentiators/key messages, content validation scoring with prohibited word detection/tone analysis/key message coverage/CTA check/jargon detection, A-F grading), content generation pipeline (7 content types across 8 channels, brief generation, content analysis with readability scoring/word count validation/structure checks, automated content calendar planning), campaign planner (campaign creation with goals/budgets/channels, 5-phase timeline generation with scaling, ROI-based performance scoring, Markdown report generation), communication coach (conversation simulator with 5 preset scenarios for salary/bad-news/feedback/objection/conflict, turn-by-turn analysis with effectiveness scoring, full debrief; language analyzer extracting 5 leadership frameworks/vocabulary patterns/communication structures/decision language; communication auditor with 7-dimension style profiling/implied level detection/perception analysis/credibility assessment), marketing analytics (channel metrics calculation, multi-channel aggregation, trend analysis vs previous period, formatted report generation with recommendations). Ten new marketing skills: `competitive-intel`, `conversation-simulator`, `performance-reviewer`, `language-analyzer`, `communication-auditor`, `content-generator`, `campaign-planner`, `brand-voice-enforcer`, `analytics-reporter`.
- Design Intelligence system (Pillar 1 — Phase A): new `@sven/design-system` package with four production libraries — OKLCH color math (sRGB↔OKLAB↔OKLCH, gamut clamping, WCAG 2.1 contrast, color blindness simulation, harmony/palette/theme generation), typography engine (modular scales, fluid clamp(), 8 font pairings, readability analysis, vertical rhythm), motion system (21 easing presets, spring physics simulation w/ CSS @keyframes, animation composition for 12 intents, stagger patterns, prefers-reduced-motion fallbacks), layout system (spacing scales, CSS Grid generation, auto-fit grids, breakpoint strategies, container queries, z-index layers, 6 layout patterns). Five new design skills: `color-system` (palette/theme/contrast/blindness/css), `typography` (scale/pairing/readability/rhythm/css), `motion-design` (animate/easing/spring/stagger/duration/tokens), `layout-spacing` (spacing/grid/auto_grid/breakpoints/z_index/pattern), `design-critique` (audit_colors/audit_typography/audit_full/suggest_improvements with WCAG scoring and color blindness safety checks).
- Gemma 4 full UI surface: Flutter AI Hub page with privacy banner, core intelligence section (inference + brain links), pipeline cards (image analysis, audio scribe, device actions), settings & privacy cards (smart routing, AI modules, privacy controls). 6 pipeline sub-pages with live stats, controls, and job/session/execution histories. 4 backend-wired services (ImageProcessingService, AudioScribeService, DeviceActionService, AiPolicyService). GoRouter nested routes at /home/ai/*. Riverpod providers + GetIt service locator registrations.
- Tauri AI Dashboard panel: privacy isolation status, smart routing split bar (local vs cloud percentages), pipeline stats grid (image/scribe/actions), module stats, live data from 7 API endpoints. Wired into Sidebar ('AI Hub' tab) and App.tsx routing.
- Admin-UI AI Pipelines page: 7-tab dashboard (Overview, Image, Scribe, Actions, Routing, Privacy, Modules). Overview shows privacy banner, 6-stat grid, routing split bar. Pipeline tabs show stats + job/session/execution lists. Routing tab with prefer-local toggle. Privacy tab with isolation verification + policy controls + audit stats. Modules tab with catalog grid + install badges. 21 API methods, 18 React Query hooks, Sidebar nav entry under Data & AI.
- E2EE (end-to-end encryption): ECDH P-256 key exchange + AES-256-GCM message encryption. DB migration adds device_keys, one_time_keys, fallback_keys, megolm_sessions, key_backup, cross_signing_keys tables. Gateway routes for key upload, query, claim (atomic via SELECT FOR UPDATE SKIP LOCKED), cross-signing, verification, OTK count, room key backup. Flutter E2eeService with pointycastle (secp256r1 ECDH, HKDF-SHA256, AES-256-GCM). Tauri desktop E2EE wrappers.
- Voice/Video calls (WebRTC signaling): DB tables for calls, call_participants, webrtc_config. Gateway routes for call initiation, join, WebRTC signal relay (offer/answer/ICE), media state management, leave, decline, ICE config. Signaling delivered via SSE to target users. Flutter CallService and Tauri desktop call wrappers.
- File sharing & media: DB tables for media_uploads, message_attachments, media_storage_config. Gateway routes for multipart upload (SHA-256 checksum, MIME validation), download, thumbnails, message attachment, gallery listing with type/pagination. Supports local/S3/MinIO backends with CDN redirect. Flutter MediaService (multipart via sendStreamed) and Tauri desktop media wrappers. New dependency: @fastify/multipart ^9.0.3.
- Read receipts & typing indicators: DB table for read_receipts with UPSERT-only-forward semantics, user_presence table. Gateway routes for typing indicator broadcast, read receipt tracking, unread count queries (SQL function), presence status management. Events delivered via SSE. Flutter PresenceService and Tauri desktop presence wrappers.
- Message search (full-text + semantic): tsvector column with auto-update trigger + GIN index on messages table, pgvector embedding column (vector(1536)) with ivfflat index. Gateway routes for tsvector FTS with ts_headline highlighting, pgvector cosine similarity search, unified cross-type search. Encrypted messages excluded. Flutter SearchService and Tauri desktop search wrappers.
- Tauri desktop SSE client: Real-time Server-Sent Events connection replacing polling for chat messages, approvals, typing indicators, read receipts, call signals, and presence. Exponential backoff reconnect (1s→30s). Native desktop notifications (Notification API) for incoming messages, approvals, and calls. New useSSE hook and features.ts service layer.
- Privacy-first push notifications (Rocket.Chat-style): FCM sends only data-only wake-up signals, actual notification content fetched directly from Sven server. Google/Apple never see message content. Server-side `push_pending` table stores payloads with 7-day TTL and automatic expiry cleanup. New gateway endpoints (`GET /v1/push/pending`, `POST /v1/push/ack`). UnifiedPush distributor support for fully de-Googled devices. Flutter client updated with background-aware privacy push handler. Legacy Expo relay preserved as fallback.
- Federation public endpoints: unauthenticated `.well-known/sven/instance` discovery, inbound `POST /v1/federation/handshake` peer key exchange, `GET /v1/federation/health` probe, `POST /v1/federation/verify` signed envelope verification. Env config for instance identity (SVEN_INSTANCE_ID, SVEN_INSTANCE_NAME, SVEN_PUBLIC_URL, SVEN_FEDERATION_KEY_SECRET, SVEN_DEFAULT_ORG_ID).
- Flutter UI widgets: TypingIndicator (animated bouncing dots with user names), ReadReceiptIndicator (sending/sent/delivered/read tick icons), PresenceDot (online/away/dnd/offline colored dot). Full-screen CallScreen with ringing/connecting/active/ended phases, mic/video/speaker toggles. SearchPage with 400ms debounce, sectioned results (messages/files/contacts). MediaGalleryPage with tabbed grid (images/videos/files) and preview dialog.
- GoRouter routes for call/:chatId, search, and media/:chatId with route constants in router.dart.
- App store release hardening: iOS Info.plist privacy description strings (microphone, camera, photo library, speech recognition, Face ID, local network), ITSAppUsesNonExemptEncryption=false, CFBundleDisplayName set to "Sven". Android ProGuard/R8 rules (Flutter, Firebase, Sentry, PointyCastle, OkHttp, secure storage, biometric, speech-to-text) enabled for release builds with minify + shrinkResources.
- Admin dashboard polish: ConfirmDialog component replacing all window.confirm/prompt with accessible modal dialogs (confirm phrase input, audit reason prompt, variant styles). Skeleton loading components (SkeletonLine, SkeletonCard, SkeletonTable, SkeletonStatGrid) replacing generic spinners. CSV export button on DataTable. EmptyState visual upgrade with icon ring. NavItem keyboard shortcut hint support. Overview page Platform Capabilities section showing E2EE, Calls, Media, Presence, Search, Federation status.
- Flutter integration wiring: BrainService and OnDeviceInferenceService registered in service_locator.dart (lazy singletons with AuthenticatedClient), Riverpod ChangeNotifierProviders defined in providers.dart, GoRouter sub-routes added at /home/brain and /home/inference, ProviderScope overrides wired in sven_user_app.dart, route constants added to router.dart. Full DI → Provider → Route → UI pipeline complete.
- 44 integration wiring tests: service locator registration order (6), provider definitions + StateError pattern (6), router constants (2), sven_user_app imports/fields/GoRoutes/overrides (14), gateway route registration verification (6), route file exports + endpoints (6), cross-cutting integrity (4).
- Flutter brain visualization (2.6): mobile-adapted brain map with force-directed graph layout via CustomPaint, pinch-zoom + pan touch navigation, tap-for-detail sheets, node type filter chips (memory/knowledge/emotion/reasoning), 6 state mappings with opacity/glow matching Canvas UI BrainBlock, stats bar, animated pulse effect. 3 new Dart files: brain_models.dart, brain_service.dart, brain_page.dart.
- Flutter on-device inference (6.2): Google AI Edge SDK / LiteRT-LM integration layer. 4 model variants (E2B 1.2 GB/128K ctx, E4B 2.8 GB/128K, MoE26B 15 GB/256K, Dense31B 18 GB/256K). Full model lifecycle (download→load→infer→unload). Smart routing: token estimate heuristic routes short prompts to local, long/complex to cloud, offline forces local. Privacy-first — no data ever leaves device. SharedPreferences persistence, performance tracking, inference modules. 2 new Dart files: on_device_inference_service.dart, inference_page.dart.
- Tauri on-device inference (6.3): Ollama sidecar integration via 5 new Rust commands (inference_check_ollama, inference_list_models, inference_pull_model, inference_delete_model, inference_generate). TypeScript invoke wrappers and types. InferencePanel React component with Ollama status, installed model management, suggested model pull (gemma3:2b/4b/12b/27b), inference test area with tok/s metrics, privacy badge. Integrated into Sidebar ('Local AI' tab) and App routing. Configurable via SVEN_OLLAMA_URL env var.
- Gemma 4 integration documentation (6.16): comprehensive guide at docs/features/gemma4-integration.md covering platform compatibility matrix, minimum requirements, architecture diagram, routing logic table, 8 inference modules, Flutter/Tauri/Server setup guides, multimodal capabilities (text/vision/audio/function calling/agentic), privacy & security guarantees, compliance table (GDPR/CCPA/SOC2/OWASP), performance benchmarks, model agnosticism, troubleshooting, API reference.
- 73 unit tests for final roadmap batch: Flutter brain models/service/page structure & colour/state accuracy (15), Flutter inference service lifecycle & routing (16), Tauri Rust commands & API wrappers & panel integration (20), Gemma 4 documentation completeness (14), cross-cutting security & structure (8).
- Image processing pipeline service (6.12): local-first Gemma 4 vision processing with server escalation, 7 image categories (photo/screenshot/document/handwriting/chart/diagram/other), escalation policy management with confidence thresholds, keyword-based complexity routing (medical/legal/architectural content → server), job lifecycle tracking with completion/escalation/failure states, processing statistics.
- Audio scribe local processing service (6.14): ~30 second local speech-to-text orchestration leveraging existing faster-whisper, 13 high-accuracy language support, configurable local/server routing based on duration and diarization needs, session lifecycle management (pending → recording → processing → completed/failed), noise reduction and punctuation configuration, real-time mode toggle.
- Mobile actions / device control service (6.15): 8 built-in device actions (open_app, set_alarm, send_notification, toggle_setting, take_screenshot, navigate_to, run_shortcut, clipboard_copy), JSON Schema function definitions for Gemma 4 function calling, 6 platform targets (Android/iOS/macOS/Windows/Linux/any), execution tracking with device-level history, action policy management with rate limiting and blocked action lists, confirmation requirements for destructive operations.
- Brain visualization Canvas UI component (2.5): interactive force-directed graph with pure SVG rendering (no external graph libraries), 4 node type colors (memory=blue, knowledge=emerald, emotion=amber, reasoning=violet), 6 state mappings with opacity/dash patterns, radial glow effects for resonating nodes, zoom controls (keyboard + button), type filter buttons, node hover with label tooltip, stats bar showing total/active/fading/consolidated counts, WCAG accessible with aria-label.
- Settings model management UI page (6.9): model profile listing with expand/collapse detail view, seed defaults action, model deactivation, capability icons (vision/audio/function calling), smart routing policy display, installed modules with download progress bars, pipeline statistics dashboard (image processing, audio scribe, device actions), responsive grid layout.
- DB migration `20260409100000_pipeline_scribe_actions.sql`: 7 new tables (image_escalation_policies, image_processing_jobs, audio_scribe_configs, audio_scribe_sessions, device_actions, device_action_executions, device_action_policies) with CHECK constraints, FK cascades, JSONB fields, and 7 indexes.
- 30+ pipeline admin endpoints at `/v1/admin/pipeline/*` across image processing (8), audio scribe (8), and device actions (14).
- 56 unit tests: migration structure (11), service exports (3), route registration (5), image routing logic (6), audio routing logic (6), device action builtins (6), brain canvas component validation (12), settings page validation (8).
- Gemma 4 model selection service (6.1): platform-aware model profiles (Flutter mobile → E2B/2B/int4, Tauri desktop → E4B/4B/int8, server → 27B/fp16/ollama, web → cloud/litellm, CLI → 27B/ollama), UPSERT-based seeding, per-org profile management.
- Local ↔ Cloud smart routing service (6.4): complexity estimation (simple/moderate/complex) with keyword escalation, offline-first routing, prefer-local policy, cloud fallback with configurable token limits, routing decision audit log.
- On-device memory sync service (6.5): device registration with sync manifests, delta-based download (500 record batches), upload batch tracking, cursor-based incremental sync, per-device state management.
- Community bridge agent service (6.6): consent-verified local-agent ↔ community actions (file_bug, request_feature, share_insight, ask_question, vote), per-user auto-action configuration with confidence thresholds, full event audit trail.
- Module system service (6.7+6.8): auto-download module catalog with category taxonomy (model/voice/vision/tool/language/plugin), platform compatibility filtering, device capability-based recommendations (RAM/storage/GPU), per-device install tracking with progress.
- Privacy isolation service (6.11+6.13): maximum-privacy defaults (local_inference_only=true, all telemetry blocked), Google telemetry domain blocking (7 domains), outbound request verification, 5-point isolation audit, privacy enforcement audit log.
- Model agnosticism & capabilities service (6.10+6.17): 12 native Gemma 4 capabilities (function_calling, audio_input/output, vision, structured_json, system_instructions, agentic_workflows, multilingual, code_generation, image_processing, speech_to_text, device_control), 5 model formats (gguf/safetensors/onnx/tflite/mediapipe), BYOM custom model slots.
- DB migration `20260408200000_gemma4_integration.sql`: 13 new tables with proper UNIQUE constraints, FK cascades, CHECK constraints, and indexes.
- 40+ Gemma 4 admin endpoints across all 7 services at `/v1/admin/gemma4/*` with organisation scoping.
- 42 unit tests for Gemma 4 batch: migration structure, service exports, route registration, complexity estimation, platform defaults, capability enumeration, blocked domains, format validation.
- Federation instance identity service (5.1): Ed25519 keypair generation via TweetNaCl, AES-256-GCM encrypted private key storage, fingerprint derivation, payload signing/verification, keypair rotation with automatic deactivation.
- Federation discovery & peer management service (5.2): peer registration with UPSERT, handshake protocol (initiate → exchange public keys → complete → upgrade to verified), trust level management (untrusted → verified → trusted → blocked), `.well-known/sven/instance` endpoint data, stale peer pruning.
- Homeserver connection service (5.3): client connection registry (Flutter mobile, Tauri desktop, web, CLI, API), secure connection token via `crypto.randomBytes(32)`, heartbeat mechanism, idle pruning, instance config endpoint with capabilities.
- Federated community topics service (5.4): cross-instance topic creation with peer trust verification, NATS subject generation (`federation.community.{name}`), message counting, topic deactivation (soft delete), federation summary stats.
- Cross-instance agent delegation service (5.5): delegation requests with configurable timeout (5–120s, default 30s), requires active peer with verified/trusted trust level, SQL `INTERVAL`-based timeout expiration, status tracking through full lifecycle.
- Community consent service (5.6): per-user consent toggles (OFF / READ_ONLY / CONTRIBUTE, default OFF), GDPR Article 7 compliant, automatic clearing of sharing flags on revocation, topic-level participation checks, consent stats.
- Data sovereignty service (5.7): org-level federation scope controls (default: federation OFF, mutual TLS required, peer verification required, export none), `canFederateWith()` with peer count limit enforcement, export policy checks (none / anonymized / pseudonymized / full).
- Federation health service (5.8): health check recording with automatic peer status sync, ping simulation, mesh health summary (CTE-based latest-per-peer aggregation), mesh status classification (no_peers / unhealthy / degraded / healthy), audit logging (SOC 2 / GDPR), old record pruning.
- DB migration `20260408180000_federation_tables.sql`: 9 new tables (`federation_instance_identity`, `federation_peers`, `federation_homeserver_connections`, `federation_community_topics`, `federation_agent_delegations`, `federation_consent`, `federation_data_sovereignty`, `federation_peer_health`, `federation_audit_log`) with 15 indexes, proper FK cascades, and CHECK constraints.
- NATS `FEDERATION` stream with `federation.>` subjects (Limits retention, 30-day max_age, file storage). Four subject constants and three dynamic per-peer helpers.
- 35+ federation admin endpoints across all 8 services at `/v1/admin/federation/*` with organisation scoping and audit logging integration.
- 55 unit tests for federation batch: migration structure, service exports, route registration, consent logic, sovereignty defaults, mesh health classification, trust levels, identity crypto, homeserver types, delegation timeouts.
- Quantum-inspired fading memory system (`decay(t) = e^(-γt) × (1 + A × sin(ωt + φ))`) with importance-weighted persistence — memories referenced more often resist decay.
- Quantum fade consolidation worker: background sweep that promotes fading memories to knowledge graph entities before they reach threshold, preserving core insights permanently.
- Brain visualization API (`/v1/admin/brain/graph`): returns live neural map of user's memories, KG entities, emotional states, and reasoning records as a graph with decay-state visual mapping.
- Brain decay trajectory endpoint (`/v1/admin/brain/decay-trajectory`): renders quantum fade curve over time for any parameter set.
- Emotional intelligence engine: keyword-based heuristic analysis detecting mood, sentiment, frustration, excitement, and confusion from user messages with structured signal metadata.
- User reasoning capture service: records WHY users make decisions, detects expertise areas, builds aggregated understanding model across dimensions (risk tolerance, tech preferences, communication style, etc.).
- Memory consent layer (GDPR Articles 15-17): per-user consent controls for consolidation, emotional tracking, and reasoning capture. Includes data export, "forget me" erasure, and retention policy enforcement.
- Quantum fade admin controls (`/v1/admin/memory/quantum-fade-config`): per-organization tuning of gamma, amplitude, omega, consolidation threshold, resonance factor, and memory budget.
- DB migration `20260408120000_quantum_fade_memory.sql`: extends memories table with quantum fade columns, creates quantum_fade_config, emotional_states, user_reasoning, user_understanding, and memory_consent tables with proper indexes and GDPR fields.
- Batch 1 community env vars configured: docs URL, Discord, GitHub Discussions, marketplace, verified persona access mode, OIDC provider, persona allowlist, strict moderation, reviewed-only agent posts, security baseline sign-off.
- Agent persona service: full lifecycle for community agent identities (bot, advisor, assistant, moderator, custom) with organization-scoped CRUD, status management (draft→active→suspended→retired), and community visibility controls.
- Agent-to-agent protocol service: NATS-routed inter-agent messaging with persistent storage, thread tracking, inbox/outbox queries, and message status management (delivered→read→archived).
- Agent rate limiting service: per-agent cadence controls with configurable messages-per-hour, daily limits, cooldown periods, burst allowance, and quiet hours scheduling.
- Smart agent moderator service: automated content moderation with configurable risk scoring, keyword pattern detection, auto-approve/flag/reject thresholds, human review queue, and audit trail.
- Transparency changelog service: public-facing record of all Sven behavior changes with entry types (behavior_change, model_update, capability_added, bug_fix, policy_change), visibility controls, and publish workflow.
- Confidence scoring service: per-response confidence calibration with source reliability, reasoning chain depth, and domain expertise factors. Automatic uncertainty disclosure for low-confidence responses below configurable threshold.
- Feedback routing loop: structured signal collection (thumbs_up/down, correction, suggestion, detailed_review) with model and skill recommendation engine based on aggregated task-type performance analytics.
- Correction pipeline service: user-submitted corrections with verification workflow, promotion to long-term memory, and integration with knowledge graph for persistent learning.
- Pattern observation service: automated detection and tracking of recurring user interaction patterns (user_preference, workflow_pattern, error_pattern, knowledge_gap, communication_style) with occurrence counting, confidence scoring, and self-improvement dashboard snapshots.
- DB migration `20260408140000_community_agents_calibrated_intelligence.sql`: creates agent_personas, agent_messages, agent_rate_limits, agent_posts, moderation_decisions, transparency_changelog, response_confidence, feedback_signals, corrections, and observed_patterns tables with full indexing.
- 35 unit tests for Batch 3+4 services covering route registration, confidence disclosure logic, and service class exports.
- Guide Agent service (3.2): newcomer onboarding, FAQ knowledge base with keyword search, welcome message generation, usage tracking, and category-based FAQ management.
- Inspector Agent service (3.3): continuous capability testing across 12 Sven subsystems (database, KG, memory, agent protocol, chat, channels, file storage, search, notifications, scheduler, NATS, database), health summary with pass/fail/degraded classification, and response time monitoring.
- Curator Agent service (3.4): watch-before-speak pattern — analyzes confirmed patterns and verified corrections to create significance-scored highlights, with publish workflow and community insight surfacing.
- Advocate Agent service (3.5): automatic feature request surfacing from community pattern observations, vote tracking, priority classification, and roadmap landscape summary with status/priority breakdown.
- QA Agent service (3.6): community-visible bug reporting with severity classification, duplicate detection (links to existing open bugs on same capability), reproduction step tracking, and quality metrics dashboard (MTTF, by-severity, by-capability).
- Librarian Agent service (3.7): knowledge index and living wiki with topic-based entries, full-text search with relevance scoring, bidirectional topic linking, view counting, and entry type classification (article, faq, guide, reference, glossary).
- Feature Tester Agent service (3.8): end-to-end test scenario management with lifecycle (pending→running→passed/failed/skipped/blocked), execution timing, and testing summary with pass rate and failure analysis.
- Feature Imagination Agent service (3.9): creative use-case invention with scenario categories (novel_workflow, cross_feature_combo, edge_case_exploration, user_persona_simulation, stress_scenario, creative_misuse), propose-to-tester workflow, and creativity summary metrics.
- Dedicated agent test VM compose (3.14): isolated Docker Compose environment (`docker-compose.vm-agents-test.yml`) with sandboxed PostgreSQL, NATS, and gateway-api for safe agent experimentation without production impact.
- DB migration `20260408160000_agent_type_tables.sql`: creates agent_faq_entries, agent_capability_reports, agent_curated_highlights, agent_feature_requests, agent_bug_reports, agent_knowledge_index, and agent_test_scenarios tables with proper FK cascades and indexes.
- Admin routes for all 8 agent types: bootstrap, CRUD, and domain-specific endpoints (40+ new endpoints) registered via `registerAgentTypeRoutes`.
- 42 unit tests for agent type implementations covering migration structure, service exports, route registration, welcome message logic, health classification, FAQ edge cases, imagination categories, and QA deduplication.
- Personality Engine module (`packages/shared/src/personality-engine.ts`): configurable buddy personality modes (professional, friendly, casual, terse), mood derivation from operational signals, XP/leveling system, achievement tracking, streak tracking, context-aware greetings, and milestone celebrations.
- Visual Companion types (`packages/shared/src/visual-companion.ts`): companion species, appearance, accessory slots, XP display, achievement display, streak display, companion events (WebSocket), and companion settings for frontend rendering across Tauri desktop, Flutter mobile, and admin-ui web surfaces.
- Smart Digest enhancement: buddy daily/weekly digests now include success rate, top tools, error pattern detection with proactive suggestions, conversation activity, streak tracking, and milestone celebrations.
- Feature flag environment variables for agent-runtime: `FEATURE_PROMPT_GUARD_ENABLED`, `FEATURE_MEMORY_EXTRACTOR_ENABLED`, `FEATURE_ANTI_DISTILLATION_ENABLED`, watermark config (`SVEN_WATERMARK_ENABLED`, `SVEN_WATERMARK_PAYLOAD`, `SVEN_WATERMARK_DENSITY`, `SVEN_FINGERPRINT_SECRET`), and buddy config (`BUDDY_PERSONALITY_MODE`, `BUDDY_STREAK_TRACKING`).
- Feature flag environment variables for skill-runner: `SVEN_COMMIT_AUTHOR_NAME`, `SVEN_COMMIT_AUTHOR_EMAIL`.
- Admin API surface for 47Dynamics bridge tenant mappings (`/v1/admin/integrations/47dynamics/tenant-mappings`) with resolve, upsert, update, and deactivate flows.
- Bridge tenant mapping persistence table (`bridge_tenant_mappings`) with legacy wildcard seed for controlled migration from static bridge defaults.
- Contract regression tests for bridge correlation matching, admin bridge mapping route registration/permissions, and rag-indexer query-result handling.
- Admin bridge mapping health endpoint (`/v1/admin/integrations/47dynamics/tenant-mappings/health`) to audit invalid mappings and strict-mode readiness.
- Executable bridge runtime tests (`services/bridge-47dynamics`) that validate correlation-safe unary and streaming response matching against mocked NATS traffic.
- Bridge runtime tests now also validate strict-mode unmapped-tenant rejection and non-strict fallback routing to legacy org/chat/agent scope.
- Bridge runtime tests now validate `GetActionStatus` auth rejection and tenant-scoped action lookup isolation.
- Bridge runtime tests now validate `SubmitAction` tool-run publish contract and `IndexDomainKnowledge` tenant metadata stamping on `rag.index.request`.
- Bridge runtime tests now validate `RunbookSuggest` query publish contract, query-id correlated result handling, and empty-result behavior when no matching response arrives.
- Bridge runtime tests now validate `HealthCheck` healthy and degraded/unhealthy dependency-state reporting (DB, NATS, LiteLLM).
- Bridge runtime tests now validate `EdgeSummarize` auth rejection, successful LiteLLM summarization response mapping, and failure handling.
- Bridge runtime tests now validate `CopilotAsk` input boundaries for tenant ID format plus empty/oversized questions.
- Bridge runtime tests now validate `IndexDomainKnowledge` auth rejection and document-batch boundary rules (non-empty, max 100).
- Bridge runtime tests now validate `SubmitAction` and `RunbookSuggest` auth rejection plus required-field input validation.
- Bridge runtime tests now validate `GetActionStatus` and `EdgeSummarize` required-field and tenant-context validation boundaries.
- Added CI workflow `.github/workflows/bridge-runtime-tests.yml` to run `services/bridge-47dynamics` runtime tests on PRs, main-branch pushes, and manual dispatch.
- Added CI workflow `.github/workflows/gateway-bridge-contract-tests.yml` to run gateway bridge contract tests for tenant mappings, correlation matching, rag query path, and strict-mode env compatibility.
- Added release-gate mapping updates for bridge CI lanes via `config/release/required-workflows.json`, with contract coverage to prevent workflow-manifest drift.
- Final signoff now explicitly enforces bridge CI lane success signals from `ci-required-checks-latest.json`, and release docs include strict verification commands for those checks.
- Added bridge lane go/no-go helper (`ops:release:bridge-ci-lanes:check[:strict]`) that consolidates required bridge workflow checks plus final-signoff bridge checks into `docs/release/status/bridge-ci-lanes-latest.{json,md}` with remote-evidence enforcement.
- Bridge lane go/no-go helper now also supports local artifact validation (`ops:release:bridge-ci-lanes:check:local[:strict]`) for offline/dev diagnosis while keeping strict remote evidence for promotion authority.
- Added a focused GitHub-backed bridge remote checker (`ops:release:bridge-ci-lanes:remote[:strict]`) that verifies recent successful runs for `bridge-runtime-tests` and `gateway-bridge-contract-tests` without waiting for the full release workflow manifest sweep.
- Added VM-authoritative bridge lane orchestrator (`ops:release:bridge-vm-ci-lanes[:strict]`) to execute local release gates and emit `bridge-vm-ci-lanes-latest.{json,md}` when GitHub-hosted CI is unavailable.
- Bridge CI workflows now support manual dispatch to self-hosted runners (`runner_target=self-hosted`) to avoid GitHub-hosted minutes for bridge lanes.
- Added VM evidence PR publisher (`ops:release:bridge-vm-ci-lanes:pr-comment`) to post bridge gate summaries from local VM artifacts into GitHub PR discussion without requiring hosted CI execution.
- Added one-command VM bridge lane wrapper (`ops:release:bridge-vm-ci-lanes:run-and-comment`) to execute VM local bridge gates and post PR evidence in a single step.

- Admin-UI Brain Admin page: 5-tab dashboard (Overview brain graph, Quantum fade config with decay parameters, Emotional intelligence history/summary, Reasoning capture records, GDPR consent controls with export/forget actions). API client with 12 methods, 10 React Query hooks, sidebar nav entry.
- Admin-UI Community Agents page: 7-tab dashboard (Personas CRUD with type/status/visibility, Moderation queue with approve/reject actions, Transparency changelog with publish workflow, Confidence calibration stats with low-confidence flagging, Corrections pipeline with verify/promote-to-memory flow, Behavioral patterns with status management, Self-improvement snapshots). API client with 26 methods, 14 React Query hooks, sidebar nav entry.
- Admin-UI Federation Hub page: 8-tab dashboard (Identity key management with generate/rotate, Peer management with handshake/trust/prune, Homeserver connections and stats, Community federated topics, Cross-instance delegations, GDPR consent settings with stats, Data sovereignty controls with residency/jurisdiction/export policy, Mesh health with check/peer status). API client with 32 methods, 22 React Query hooks, sidebar nav entry.
- Flutter Brain Admin page: 4-tab mobile interface (Quantum fade parameters with decay formula, Emotional intelligence with emotion chips and history, Reasoning records, GDPR consent with forget-me confirmation dialog). BrainAdminService with 12 methods. GoRouter route at /home/ai/brain-admin.
- Flutter Community Agents page: 5-tab mobile interface (Personas with type-colored avatars, Moderation with risk badges and approve/reject, Changelog with publish, Corrections with verify/promote, Improvement with calibration summary and patterns). CommunityAgentsService with 14 methods. GoRouter route at /home/ai/community-agents.
- Flutter Calibration page: 4-tab mobile interface (Confidence stats grid with low-confidence list, Feedback with task-summary thumbs, Corrections with status badges, Improvement snapshots with metrics). CalibrationService with 7 methods. GoRouter route at /home/ai/calibration.
- Flutter Federation page: 5-tab mobile interface (Identity with key info/generate/rotate/sovereignty, Peers with trust-colored avatars/handshake/prune, Homeserver connections grid, Consent toggles, Mesh health with check button). FederationService with 17 methods. GoRouter route at /home/ai/federation.
- Tauri Brain panel: 4-tab desktop interface (Quantum fade parameters, Emotional state history, Reasoning records, Consent settings). Wired into Sidebar and App.tsx routing.
- Tauri Community Agents panel: 5-tab desktop interface (Personas, Moderation queue with approve/reject, Changelog with publish, Corrections with verify, Improvement snapshots). Wired into Sidebar and App.tsx routing.
- Tauri Federation panel: 5-tab desktop interface (Identity with sovereignty/export policy, Peers with handshake/prune, Homeserver connections, Consent settings/stats, Mesh health with check). Wired into Sidebar and App.tsx routing.

### Changed
- `bridge-47dynamics` now resolves per-request tenant scope (organization/chat/agent) via `bridge_tenant_mappings`, with optional strict mode via `BRIDGE_REQUIRE_TENANT_MAPPING`.
- Bridge tenant resolution now validates mapping integrity at runtime (chat belongs mapped organization and mapped agent is active) before routing requests.

### Fixed
- Piper TTS: `VOICE_TTS_STORAGE` absolute paths were incorrectly joined with `process.cwd()`, causing `EACCES: permission denied, mkdir '/app/var'` crash loop in container.
- LiteLLM healthcheck: replaced broken `curl` command (not available in container) with `python3 urllib` check against `/health/liveliness` (no auth required).
- Ollama compose device mappings: replaced fragile per-device (`/dev/dri/cardN`, `/dev/dri/renderDN`) mounts with `/dev/dri:/dev/dri` to survive device renumbering across reboots.
- Faster-whisper: removed NVIDIA device request dependency from compose; set `FASTER_WHISPER_DEVICE=cpu` for AMD GPU hosts where CUDA is unavailable.
- Tenant admin user creation can no longer create global `admin` users unless caller is platform admin.
- Permissions schema is now organization-scoped via `permissions.organization_id` migration and backfill.
- `RunbookSuggest` bridge flow no longer times out due to query/index contract mismatch; `rag-indexer` now handles query-shaped `rag.index.request` events and emits `rag.index.result`.
- Bridge response correlation is now propagated and matched to reduce cross-talk risk when concurrent requests target the same chat.
- Bridge strict-mode env handling now accepts both `BRIDGE_REQUIRE_TENANT_MAPPING` and legacy `SVEN_BRIDGE_REQUIRE_TENANT_MAPPING` to prevent rollout misconfiguration.

---

## [0.1.0] — 2026-02-23

Initial public release of Sven — a production-grade, self-hosted AI assistant platform.

### Agent & Reasoning
- Multi-agent runtime with per-agent runtimes, routing rules, and profile overrides
- Self-correcting agent loop: error classification, bounded retries, strategy adjustments, infinite-loop detection
- Approval gates triggered at configurable retry thresholds
- Sub-agent nesting with context isolation; agent pause / resume mid-task
- Proactive agent: scheduled messages, calendar prefetch, health monitoring, pattern detection

### Memory & Intelligence
- Persistent memory: per-user private, chat-shared, global, and knowledge-graph scopes
- Temporal decay scoring and MMR (Maximal Marginal Relevance) re-ranking
- Hybrid BM25 + pgvector semantic search via OpenSearch + PostgreSQL
- Memory dashboard: browse, search, edit, delete, bulk-export, import
- Memory consolidation with AI-driven deduplication; delayed recall pipeline

### RAG — Retrieval-Augmented Generation
- Git ingestor: clone any repo, index commits and code for agent context
- NAS ingestor: index network-attached storage
- Notes ingestor: Apple Notes, Obsidian, Bear, Notion
- Structured RAG, multimodal RAG, temporal RAG, cross-agent knowledge sharing
- RAG feedback loop: thumbs up/down improves future retrieval

### Skills & Tools
- 80+ built-in tools: web fetch, file ops, code execution, Spotify, Sonos, Apple Notes, Reminders, Things 3, Notion, Obsidian, Bear, Trello, X (Twitter), 1Password, GIFs, weather, image generation, media analysis, and more
- Sandboxed execution via gVisor — zero host-escape risk
- Dynamic tool creation: agent-authored skills, auto-quarantine pipeline, admin approval
- Skill marketplace (registry): install, version, review, revenue share
- Policy engine: per-tool allowlist, privilege scopes, budget guards
- Secrets management: SOPS, Vault, file, env — read-only, never exposed to agent

### Voice Stack
- Wake word detection (local, always-listening)
- Faster-Whisper STT — local, multi-language speech-to-text
- Piper TTS — local, high-quality speech synthesis
- Continuous conversation mode, speaker identification, emotion detection
- Voice shortcuts, voice call routing, meeting assistant (transcribe + action items)

### Messaging Adapters (20)
- Slack, Microsoft Teams, Telegram, Discord, WhatsApp, Signal, Matrix, Google Chat,
  iMessage, Mattermost, IRC, Nostr, Twitch, Line, Zalo, Feishu, Nextcloud Talk,
  Tlon, WebChat, Voice Call

### Client Applications
- Flutter companion app (iOS + Android) — chat, voice, push (FCM + APNs), offline sync
- Tauri desktop app (macOS / Windows / Linux) — Rust-based, keychain, auto-update
- Admin UI — agents, memory, RAG, scheduler, registry, billing, observability
- Canvas UI — KaTeX math, code blocks, tool trace viewer, approval flows
- WebChat embeddable widget

### Private Search
- Self-hosted SearXNG — no query leakage to third parties
- Brave Search alternative backend; configurable engines, egress proxy routing

### Multi-Tenancy & Security
- Organisation-scoped data isolation, RBAC (admin / operator / member)
- Keycloak / OIDC SSO — full enterprise single sign-on
- Per-tenant storage mapping, usage metering, billing
- TLS 1.2+, auth lockout, TOTP for admin, CORS/egress allowlists
- SBOM + cosign image signing, Dependabot, npm audit enforcement in CI

### Scheduler
- One-time and recurring tasks (natural language or cron expressions)
- Admin UI scheduler with run history, manual trigger, missed-run detection

### Backup & Restore
- One-click backup: PostgreSQL + NATS + config + files to S3-compatible storage
- Retention policy, integrity validation, nightly auto-backup cron

### AI / LLM
- LiteLLM proxy: OpenAI, Anthropic, Google, Mistral, Ollama, LM Studio, and more
- Per-agent model selection, virtual API keys with spend limits, context-window optimisation

### Observability & Operations
- Prometheus metrics, structured JSON logging, distributed tracing
- Pre-built dashboards: SLO, agent performance, memory growth, API contract coverage
- Canary deployment strategy (phase 0 → phase 2 → 100%); one-command rollback
- Full ops runbook library: key rotation, incident triage, upgrade, backup/restore

### Infrastructure
- Docker Compose profiles: dev, staging, production
- GitHub Actions: deployment pipeline, security baseline, Flutter CI, parity E2E,
  release gates, supply chain, canary ops
- NATS JetStream with leaf-node auto-peer discovery
- Edge mirror agent (Raspberry Pi / kiosk)

---

[Unreleased]: https://github.com/47network/thesven/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/47network/thesven/releases/tag/v0.1.0
