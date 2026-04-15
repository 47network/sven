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
} as const;
