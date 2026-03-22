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
};
export const NATS_SUBJECTS = {
    // Inbound
    INBOUND_MESSAGE: 'inbound.message.*', // inbound.message.{channel}
    inboundMessage: (channel) => `inbound.message.${channel}`,
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
};
export const STREAM_CONFIGS = {
    INBOUND: {
        name: NATS_STREAMS.INBOUND,
        subjects: ['inbound.>', 'wake.word.detected'],
        retention: RetentionPolicy.Limits,
        max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days in nanoseconds
        storage: StorageType.File,
    },
    AUDIO_INGEST: {
        name: NATS_STREAMS.AUDIO_INGEST,
        subjects: ['audio.ingest'],
        retention: RetentionPolicy.Workqueue,
        storage: StorageType.File,
    },
    RUNTIME: {
        name: NATS_STREAMS.RUNTIME,
        subjects: ['runtime.>', 'agent.>'],
        retention: RetentionPolicy.Workqueue,
        storage: StorageType.File,
    },
    TOOLS: {
        name: NATS_STREAMS.TOOLS,
        subjects: ['tool.>'],
        retention: RetentionPolicy.Limits,
        max_age: 30 * 24 * 60 * 60 * 1_000_000_000, // 30 days
        storage: StorageType.File,
    },
    APPROVALS: {
        name: NATS_STREAMS.APPROVALS,
        subjects: ['approval.>'],
        retention: RetentionPolicy.Limits,
        max_age: 90 * 24 * 60 * 60 * 1_000_000_000, // 90 days
        storage: StorageType.File,
    },
    OUTBOX: {
        name: NATS_STREAMS.OUTBOX,
        subjects: ['outbox.>'],
        retention: RetentionPolicy.Workqueue,
        storage: StorageType.File,
    },
    TTS: {
        name: NATS_STREAMS.TTS,
        subjects: ['tts.enqueue'],
        retention: RetentionPolicy.Limits,
        storage: StorageType.File,
    },
    RAG: {
        name: NATS_STREAMS.RAG,
        subjects: ['rag.>'],
        retention: RetentionPolicy.Workqueue,
        storage: StorageType.File,
    },
    NOTIFY: {
        name: NATS_STREAMS.NOTIFY,
        subjects: ['notify.>'],
        retention: RetentionPolicy.Limits,
        max_age: 30 * 24 * 60 * 60 * 1_000_000_000, // 30 days
        storage: StorageType.File,
    },
};
//# sourceMappingURL=nats-subjects.js.map