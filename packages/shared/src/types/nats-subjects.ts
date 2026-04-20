import { RetentionPolicy, StorageType, StreamConfig, DiscardPolicy } from 'nats';

export const NATS_SUBJECTS = {
  RUNTIME_DISPATCH: 'runtime.dispatch',
  NOTIFY_PUSH: 'notify.push',
  RAG_INDEX_REQUEST: 'rag.index.request',
  TOOL_RUN_REQUEST: 'tool.run.request',
  FEDERATION_HANDSHAKE: 'federation.handshake',
  FEDERATION_MESSAGE: 'federation.message.*',
  FEDERATION_HEALTH: 'federation.health.*',
  FEDERATION_DELEGATION: 'federation.delegation.*',
  RAG_INDEX_RESULT: 'rag.index.result',
  TTS_OUTBOX_ENQUEUE: 'tts.outbox.enqueue',
  OUTBOX_ENQUEUE: 'outbox.enqueue',
  QUANTUM_JOB_COMPLETED: 'quantum.job.completed',
  QUANTUM_JOB_FAILED: 'quantum.job.failed',
  QUANTUM_JOB_SUBMIT: 'quantum.job.submit',
  QUANTUM_JOB_CANCEL: 'quantum.job.cancel',
  AUDIO_INGEST: 'audio.ingest',
  APPROVAL_UPDATED: 'approval.updated',
  TOOL_RUN_RESULT: 'tool.run.result',
  MESH_DEVICE_REGISTER: 'mesh.device.register',
  MESH_DEVICE_HEARTBEAT: 'mesh.device.heartbeat',
  MESH_DEVICE_DEREGISTER: 'mesh.device.deregister',
  APPROVAL_CREATED: 'approval.created',
  MODEL_VRAM_ALERT: 'model.vram.alert',
  MODEL_FLEET_HEALTH: 'model.fleet.health',
  MODEL_REGISTERED: 'model.registered',
  MODEL_UNREGISTERED: 'model.unregistered',
  MODEL_STATUS_CHANGED: 'model.status.changed',
  MODEL_ROUTE_DECISION: 'model.route.decision',
  MODEL_HOTSWAP_RESULT: 'model.hotswap.result',
  MODEL_BENCHMARK_COMPLETE: 'model.benchmark.complete',
  MODEL_DEPLOY_STATUS: 'model.deploy.status',
  WAKE_WORD_DETECTED: 'wake.word.detected',
  INBOUND_MESSAGE: 'inbound.message.*',

  // Security
  SECURITY_SAST_COMPLETE: 'security.sast.complete',
  SECURITY_SECRET_SCAN_COMPLETE: 'security.secret.scan.complete',
  SECURITY_SECRET_FOUND: 'security.secret.found',
  SECURITY_DEP_AUDIT_COMPLETE: 'security.dep.audit.complete',
  SECURITY_INFRA_AUDIT_COMPLETE: 'security.infra.audit.complete',
  SECURITY_PENTEST_COMPLETE: 'security.pentest.complete',
  SECURITY_POSTURE_GENERATED: 'security.posture.generated',
  SECURITY_CRITICAL_FINDING: 'security.critical.finding',

  // Document
  DOCUMENT_OCR_COMPLETE: 'document.ocr.complete',
  DOCUMENT_PIPELINE_COMPLETE: 'document.pipeline.complete',
  DOCUMENT_PIPELINE_FAILED: 'document.pipeline.failed',
  DOCUMENT_BATCH_COMPLETE: 'document.batch.complete',
  DOCUMENT_ENTITIES_EXTRACTED: 'document.entities.extracted',
  DOCUMENT_SUMMARY_GENERATED: 'document.summary.generated',
  DOCUMENT_PII_DETECTED: 'document.pii.detected',

  // Proactive
  NOTIFY_PROACTIVE: 'notify.proactive',
  NOTIFY_PROACTIVE_FEEDBACK: 'notify.proactive.feedback',

  federationMessage: (peerId: string) => `federation.message.${peerId}`,
  federationHealth: (peerId: string) => `federation.health.${peerId}`,
  federationDelegation: (peerId: string) => `federation.delegation.${peerId}`,
  quantumJobStatus: (jobId: string) => `quantum.job.status.${jobId}`,
  inboundMessage: (channel: string) => `inbound.message.${channel}`,
  meshJobStatus: (jobId: string) => `mesh.job.status.${jobId}`,
  modelNodeProbe: (nodeId: string) => `model.node.probe.${nodeId}`,
};

export enum NatsSubject {
  MARKETING_INTEL_RELOAD = 'marketing_intel_reload',
  MARKETING_INTEL_UPDATE = 'marketing_intel_update',
  ADMIN_RELOAD = 'admin_reload',
  QUANTUM_STATE_SYNC = 'quantum_state_sync',
  MODEL_ROUTER_RELOAD = 'model_router_reload'
}

export const STREAM_CONFIGS: Record<string, StreamConfig> = {
  SVEN_EVENTS: {
    name: 'SVEN_EVENTS',
    subjects: ['runtime.dispatch', 'tool.run.result'],
    retention: RetentionPolicy.Limits,
    storage: StorageType.File,
    max_consumers: -1,
    max_msgs: -1,
    max_bytes: -1,
    max_age: 0,
    max_msg_size: -1,
    num_replicas: 1,
    duplicate_window: 120000000000,
    sealed: false,
    deny_delete: false,
    deny_purge: false,
    allow_rollup_hdrs: false,
    discard: DiscardPolicy.Old,
  } as any
};
