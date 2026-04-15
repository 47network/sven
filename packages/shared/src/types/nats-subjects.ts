import { RetentionPolicy, StorageType } from 'nats';

/**
 * NATS JetStream subject constants.
 * All subjects follow: {stream}.{action}.{qualifier}
 */

export const NATS_STREAMS = {
  INBOUND: 'INBOUND',
  RUNTIME: 'RUNTIME',
  TOOLS: 'TOOLS',
  APPROVALS: 'APPROVALS',
  OUTBOX: 'OUTBOX',
  RAG: 'RAG',
  NOTIFY: 'NOTIFY',
  TTS: 'TTS',
  AUDIO_INGEST: 'AUDIO_INGEST',
  FEDERATION: 'FEDERATION',
  TREASURY: 'TREASURY',
  EVOLUTION: 'EVOLUTION',
  VIDEO: 'VIDEO',
  COMPANION: 'COMPANION',
  TRAINING: 'TRAINING',
  WALLET: 'WALLET',
  REVENUE: 'REVENUE',
  INFRA: 'INFRA',
  XLVII_BRAND: 'XLVII_BRAND',
  MESH: 'MESH',
  MODEL: 'MODEL',
  SECURITY: 'SECURITY',
  DOCUMENT: 'DOCUMENT',
  MARKETING: 'MARKETING',
} as const;

export const NATS_SUBJECTS = {
  // Inbound
  INBOUND_MESSAGE: 'inbound.message.*', // inbound.message.{channel}
  inboundMessage: (channel: string) => `inbound.message.${channel}`,

  // Audio ingestion (STT)
  AUDIO_INGEST: 'audio.ingest',
  WAKE_WORD_DETECTED: 'wake.word.detected',

  // Runtime
  RUNTIME_DISPATCH: 'runtime.dispatch',

  // Tools
  TOOL_RUN_REQUEST: 'tool.run.request',
  TOOL_RUN_RESULT: 'tool.run.result',

  // Approvals
  APPROVAL_CREATED: 'approval.created',
  APPROVAL_UPDATED: 'approval.updated',

  // Outbox
  OUTBOX_ENQUEUE: 'outbox.enqueue',
  TTS_OUTBOX_ENQUEUE: 'tts.enqueue',

  // RAG
  RAG_INDEX_REQUEST: 'rag.index.request',
  RAG_INDEX_RESULT: 'rag.index.result',

  // Notify
  NOTIFY_PUSH: 'notify.push',
  NOTIFY_PROACTIVE: 'notify.proactive',
  NOTIFY_PROACTIVE_FEEDBACK: 'notify.proactive.feedback',

  // Federation
  FEDERATION_HANDSHAKE: 'federation.handshake',
  FEDERATION_MESSAGE: 'federation.message.*',
  FEDERATION_HEALTH: 'federation.health.*',
  FEDERATION_DELEGATION: 'federation.delegation.*',
  federationMessage: (peerId: string) => `federation.message.${peerId}`,
  federationHealth: (peerId: string) => `federation.health.${peerId}`,
  federationDelegation: (peerId: string) => `federation.delegation.${peerId}`,

  // Council (LLM multi-model deliberation)
  COUNCIL_REQUEST: 'runtime.council.request',
  COUNCIL_RESULT: 'runtime.council.result',

  // Treasury (autonomous economy)
  TREASURY_PROPOSAL_CREATED: 'treasury.proposal.created',
  TREASURY_PROPOSAL_RESOLVED: 'treasury.proposal.resolved',
  TREASURY_TRANSACTION: 'treasury.transaction',
  TREASURY_EMERGENCY: 'treasury.emergency',

  // Evolution (self-improving research loop)
  EVOLUTION_RUN_STARTED: 'evolution.run.started',
  EVOLUTION_RUN_COMPLETED: 'evolution.run.completed',
  EVOLUTION_STEP_COMPLETED: 'evolution.step.completed',
  EVOLUTION_KNOWLEDGE_INJECTED: 'evolution.knowledge.injected',

  // Video (programmatic video generation)
  VIDEO_RENDER_QUEUED: 'video.render.queued',
  VIDEO_RENDER_STARTED: 'video.render.started',
  VIDEO_RENDER_COMPLETED: 'video.render.completed',
  VIDEO_RENDER_FAILED: 'video.render.failed',

  // Companion (desktop character state sync)
  COMPANION_STATE_CHANGED: 'companion.state.changed',
  COMPANION_SESSION_CREATED: 'companion.session.created',
  COMPANION_SESSION_DESTROYED: 'companion.session.destroyed',
  COMPANION_WALK_TICK: 'companion.walk.tick',

  // Training (model fine-tuning pipeline)
  TRAINING_JOB_CREATED: 'training.job.created',
  TRAINING_JOB_STARTED: 'training.job.started',
  TRAINING_JOB_PROGRESS: 'training.job.progress',
  TRAINING_JOB_COMPLETED: 'training.job.completed',
  TRAINING_JOB_FAILED: 'training.job.failed',
  TRAINING_EXPORT_REGISTERED: 'training.export.registered',

  // Wallet (crypto wallet management)
  WALLET_CREATED: 'wallet.created',
  WALLET_TX_SUBMITTED: 'wallet.tx.submitted',
  WALLET_TX_CONFIRMED: 'wallet.tx.confirmed',
  WALLET_TX_FAILED: 'wallet.tx.failed',
  WALLET_BALANCE_ALERT: 'wallet.balance.alert',
  WALLET_MULTISIG_READY: 'wallet.multisig.ready',

  // Revenue (pipeline management)
  REVENUE_EVENT: 'revenue.event',
  REVENUE_PIPELINE_ACTIVATED: 'revenue.pipeline.activated',
  REVENUE_PAYOUT: 'revenue.payout',
  REVENUE_MERCH_ORDER: 'revenue.merch.order',

  // Infrastructure (self-management)
  INFRA_HEALTH_CHECK: 'infra.health.check',
  INFRA_SCALING_DECISION: 'infra.scaling.decision',
  INFRA_PROPOSAL_CREATED: 'infra.proposal.created',
  INFRA_DEPLOYMENT_STATUS: 'infra.deployment.status',
  INFRA_GOAL_UPDATED: 'infra.goal.updated',

  // XLVII Brand (e-commerce + fulfillment)
  BRAND_PRODUCT_CREATED: 'brand.product.created',
  BRAND_ORDER_CREATED: 'brand.order.created',
  BRAND_ORDER_STATUS: 'brand.order.status',
  BRAND_FULFILLMENT_STATUS: 'brand.fulfillment.status',
  BRAND_CAMPAIGN_ACTIVATED: 'brand.campaign.activated',
  BRAND_DESIGN_APPROVED: 'brand.design.approved',

  // Compute Mesh (distributed workload orchestration)
  MESH_DEVICE_REGISTER: 'mesh.device.register',
  MESH_DEVICE_HEARTBEAT: 'mesh.device.heartbeat',
  MESH_DEVICE_CAPABILITIES: 'mesh.device.capabilities',
  MESH_DEVICE_DEREGISTER: 'mesh.device.deregister',
  MESH_JOB_SUBMIT: 'mesh.job.submit',
  MESH_JOB_CANCEL: 'mesh.job.cancel',
  meshJobStatus: (jobId: string) => `mesh.job.status.${jobId}`,
  meshUnitAssign: (deviceId: string) => `mesh.unit.assign.${deviceId}`,
  meshUnitResult: (jobId: string) => `mesh.unit.result.${jobId}`,
  meshUnitStatus: (unitId: string) => `mesh.unit.status.${unitId}`,
  meshUnitError: (unitId: string) => `mesh.unit.error.${unitId}`,
  MESH_METRICS: 'mesh.metrics',

  // Model Router (inference routing, fleet health, benchmarks)
  MODEL_REGISTERED: 'model.registered',
  MODEL_UNREGISTERED: 'model.unregistered',
  MODEL_STATUS_CHANGED: 'model.status.changed',
  MODEL_ROUTE_DECISION: 'model.route.decision',
  MODEL_FLEET_HEALTH: 'model.fleet.health',
  MODEL_FLEET_NODE_PROBE: 'model.fleet.node.probe',
  MODEL_HOTSWAP_RESULT: 'model.hotswap.result',
  MODEL_BENCHMARK_COMPLETE: 'model.benchmark.complete',
  MODEL_DEPLOY_STATUS: 'model.deploy.status',
  MODEL_VRAM_ALERT: 'model.vram.alert',
  modelNodeProbe: (nodeId: string) => `model.fleet.node.probe.${nodeId}`,

  // Security Toolkit
  SECURITY_SAST_COMPLETE: 'security.sast.complete',
  SECURITY_SECRET_SCAN_COMPLETE: 'security.secret.scan.complete',
  SECURITY_SECRET_FOUND: 'security.secret.found',
  SECURITY_DEP_AUDIT_COMPLETE: 'security.dep.audit.complete',
  SECURITY_INFRA_AUDIT_COMPLETE: 'security.infra.audit.complete',
  SECURITY_PENTEST_COMPLETE: 'security.pentest.complete',
  SECURITY_POSTURE_GENERATED: 'security.posture.generated',
  SECURITY_CRITICAL_FINDING: 'security.critical.finding',

  // Document Intelligence (OCR, pipeline, entity extraction, summarisation)
  DOCUMENT_OCR_COMPLETE: 'document.ocr.complete',
  DOCUMENT_PIPELINE_COMPLETE: 'document.pipeline.complete',
  DOCUMENT_PIPELINE_FAILED: 'document.pipeline.failed',
  DOCUMENT_BATCH_COMPLETE: 'document.batch.complete',
  DOCUMENT_ENTITIES_EXTRACTED: 'document.entities.extracted',
  DOCUMENT_SUMMARY_GENERATED: 'document.summary.generated',
  DOCUMENT_PII_DETECTED: 'document.pii.detected',

  // Marketing Intelligence (competitive intel, brand voice, content, campaigns, analytics)
  MARKETING_COMPETITOR_ADDED: 'marketing.competitor.added',
  MARKETING_SIGNAL_DETECTED: 'marketing.signal.detected',
  MARKETING_REPORT_GENERATED: 'marketing.report.generated',
  MARKETING_BRAND_CHECK_COMPLETE: 'marketing.brand.check.complete',
  MARKETING_CONTENT_CREATED: 'marketing.content.created',
  MARKETING_CAMPAIGN_CREATED: 'marketing.campaign.created',
  MARKETING_CAMPAIGN_SCORED: 'marketing.campaign.scored',
  MARKETING_COACHING_DEBRIEF: 'marketing.coaching.debrief',
  MARKETING_ANALYTICS_REPORT: 'marketing.analytics.report',
  MARKETING_THREAT_MATRIX_BUILT: 'marketing.threat.matrix.built',

  // Quantum Sim (circuit simulation, job management, algorithm execution)
  QUANTUM_JOB_SUBMIT: 'quantum.job.submit',
  QUANTUM_JOB_CANCEL: 'quantum.job.cancel',
  QUANTUM_JOB_COMPLETED: 'quantum.job.completed',
  QUANTUM_JOB_FAILED: 'quantum.job.failed',
  quantumJobStatus: (jobId: string) => `quantum.job.status.${jobId}`,
} as const;

export const STREAM_CONFIGS = {
  INBOUND: {
    name: NATS_STREAMS.INBOUND,
    subjects: ['inbound.>', 'wake.word.detected'] as string[],
    retention: RetentionPolicy.Limits,
    max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days in nanoseconds
    storage: StorageType.File,
  },

  AUDIO_INGEST: {
    name: NATS_STREAMS.AUDIO_INGEST,
    subjects: ['audio.ingest'] as string[],
    retention: RetentionPolicy.Workqueue,
    storage: StorageType.File,
  },
  RUNTIME: {
    name: NATS_STREAMS.RUNTIME,
    subjects: ['runtime.>', 'agent.>'] as string[],
    retention: RetentionPolicy.Workqueue,
    storage: StorageType.File,
  },
  TOOLS: {
    name: NATS_STREAMS.TOOLS,
    subjects: ['tool.>'] as string[],
    retention: RetentionPolicy.Limits,
    max_age: 30 * 24 * 60 * 60 * 1_000_000_000, // 30 days
    storage: StorageType.File,
  },
  APPROVALS: {
    name: NATS_STREAMS.APPROVALS,
    subjects: ['approval.>'] as string[],
    retention: RetentionPolicy.Limits,
    max_age: 90 * 24 * 60 * 60 * 1_000_000_000, // 90 days
    storage: StorageType.File,
  },
  OUTBOX: {
    name: NATS_STREAMS.OUTBOX,
    subjects: ['outbox.>'] as string[],
    retention: RetentionPolicy.Workqueue,
    storage: StorageType.File,
  },
  TTS: {
    name: NATS_STREAMS.TTS,
    subjects: ['tts.enqueue'] as string[],
    retention: RetentionPolicy.Limits,
    storage: StorageType.File,
  },
  RAG: {
    name: NATS_STREAMS.RAG,
    subjects: ['rag.>'] as string[],
    retention: RetentionPolicy.Workqueue,
    storage: StorageType.File,
  },
  NOTIFY: {
    name: NATS_STREAMS.NOTIFY,
    subjects: ['notify.>'] as string[],
    retention: RetentionPolicy.Limits,
    max_age: 30 * 24 * 60 * 60 * 1_000_000_000, // 30 days
    storage: StorageType.File,
  },
  FEDERATION: {
    name: NATS_STREAMS.FEDERATION,
    subjects: ['federation.>'] as string[],
    retention: RetentionPolicy.Limits,
    max_age: 30 * 24 * 60 * 60 * 1_000_000_000, // 30 days
    storage: StorageType.File,
  },
  TREASURY: {
    name: NATS_STREAMS.TREASURY,
    subjects: ['treasury.>'] as string[],
    retention: RetentionPolicy.Limits,
    max_age: 365 * 24 * 60 * 60 * 1_000_000_000, // 1 year — financial audit retention
    storage: StorageType.File,
  },
  EVOLUTION: {
    name: NATS_STREAMS.EVOLUTION,
    subjects: ['evolution.>'] as string[],
    retention: RetentionPolicy.Limits,
    max_age: 90 * 24 * 60 * 60 * 1_000_000_000, // 90 days — evolution experiment retention
    storage: StorageType.File,
  },
  VIDEO: {
    name: NATS_STREAMS.VIDEO,
    subjects: ['video.>'] as string[],
    retention: RetentionPolicy.Limits,
    max_age: 30 * 24 * 60 * 60 * 1_000_000_000, // 30 days — video render job retention
    storage: StorageType.File,
  },
  COMPANION: {
    name: NATS_STREAMS.COMPANION,
    subjects: ['companion.>'] as string[],
    retention: RetentionPolicy.Limits,
    max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days — companion state retention
    storage: StorageType.Memory,
  },
  TRAINING: {
    name: NATS_STREAMS.TRAINING,
    subjects: ['training.>'] as string[],
    retention: RetentionPolicy.Limits,
    max_age: 90 * 24 * 60 * 60 * 1_000_000_000, // 90 days — training job retention
    storage: StorageType.File,
  },
  WALLET: {
    name: NATS_STREAMS.WALLET,
    subjects: ['wallet.>'] as string[],
    retention: RetentionPolicy.Limits,
    max_age: 365 * 24 * 60 * 60 * 1_000_000_000, // 1 year — financial audit
    storage: StorageType.File,
  },
  REVENUE: {
    name: NATS_STREAMS.REVENUE,
    subjects: ['revenue.>'] as string[],
    retention: RetentionPolicy.Limits,
    max_age: 365 * 24 * 60 * 60 * 1_000_000_000, // 1 year — financial audit
    storage: StorageType.File,
  },
  INFRA: {
    name: NATS_STREAMS.INFRA,
    subjects: ['infra.>'] as string[],
    retention: RetentionPolicy.Limits,
    max_age: 90 * 24 * 60 * 60 * 1_000_000_000, // 90 days — infra logs
    storage: StorageType.File,
  },
  XLVII_BRAND: {
    name: NATS_STREAMS.XLVII_BRAND,
    subjects: ['brand.>'] as string[],
    retention: RetentionPolicy.Limits,
    max_age: 365 * 24 * 60 * 60 * 1_000_000_000, // 1 year — e-commerce order retention
    storage: StorageType.File,
  },
  MESH: {
    name: NATS_STREAMS.MESH,
    subjects: ['mesh.>'] as string[],
    retention: RetentionPolicy.Workqueue,
    storage: StorageType.File,
  },
  MODEL: {
    name: NATS_STREAMS.MODEL,
    subjects: ['model.>'] as string[],
    retention: RetentionPolicy.Limits,
    max_age: 30 * 24 * 60 * 60 * 1_000_000_000, // 30 days — routing decision + fleet health audit
    storage: StorageType.File,
  },
  SECURITY: {
    name: NATS_STREAMS.SECURITY,
    subjects: ['security.>'] as string[],
    retention: RetentionPolicy.Limits,
    max_age: 90 * 24 * 60 * 60 * 1_000_000_000, // 90 days — security scan audit trail
    storage: StorageType.File,
  },
  DOCUMENT: {
    name: NATS_STREAMS.DOCUMENT,
    subjects: ['document.>'] as string[],
    retention: RetentionPolicy.Limits,
    max_age: 30 * 24 * 60 * 60 * 1_000_000_000, // 30 days — document processing audit trail
    storage: StorageType.File,
  },
  MARKETING: {
    name: NATS_STREAMS.MARKETING,
    subjects: ['marketing.>'] as string[],
    retention: RetentionPolicy.Limits,
    max_age: 90 * 24 * 60 * 60 * 1_000_000_000, // 90 days — marketing campaign and analytics audit trail
    storage: StorageType.File,
  },
} as const;
