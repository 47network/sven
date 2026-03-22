import { RetentionPolicy, StorageType } from 'nats';
/**
 * NATS JetStream subject constants.
 * All subjects follow: {stream}.{action}.{qualifier}
 */
export declare const NATS_STREAMS: {
    readonly INBOUND: "INBOUND";
    readonly RUNTIME: "RUNTIME";
    readonly TOOLS: "TOOLS";
    readonly APPROVALS: "APPROVALS";
    readonly OUTBOX: "OUTBOX";
    readonly RAG: "RAG";
    readonly NOTIFY: "NOTIFY";
    readonly TTS: "TTS";
    readonly AUDIO_INGEST: "AUDIO_INGEST";
};
export declare const NATS_SUBJECTS: {
    readonly INBOUND_MESSAGE: "inbound.message.*";
    readonly inboundMessage: (channel: string) => string;
    readonly AUDIO_INGEST: "audio.ingest";
    readonly WAKE_WORD_DETECTED: "wake.word.detected";
    readonly RUNTIME_DISPATCH: "runtime.dispatch";
    readonly TOOL_RUN_REQUEST: "tool.run.request";
    readonly TOOL_RUN_RESULT: "tool.run.result";
    readonly APPROVAL_CREATED: "approval.created";
    readonly APPROVAL_UPDATED: "approval.updated";
    readonly OUTBOX_ENQUEUE: "outbox.enqueue";
    readonly TTS_OUTBOX_ENQUEUE: "tts.enqueue";
    readonly RAG_INDEX_REQUEST: "rag.index.request";
    readonly RAG_INDEX_RESULT: "rag.index.result";
    readonly NOTIFY_PUSH: "notify.push";
};
export declare const STREAM_CONFIGS: {
    readonly INBOUND: {
        readonly name: "INBOUND";
        readonly subjects: string[];
        readonly retention: RetentionPolicy.Limits;
        readonly max_age: number;
        readonly storage: StorageType.File;
    };
    readonly AUDIO_INGEST: {
        readonly name: "AUDIO_INGEST";
        readonly subjects: string[];
        readonly retention: RetentionPolicy.Workqueue;
        readonly storage: StorageType.File;
    };
    readonly RUNTIME: {
        readonly name: "RUNTIME";
        readonly subjects: string[];
        readonly retention: RetentionPolicy.Workqueue;
        readonly storage: StorageType.File;
    };
    readonly TOOLS: {
        readonly name: "TOOLS";
        readonly subjects: string[];
        readonly retention: RetentionPolicy.Limits;
        readonly max_age: number;
        readonly storage: StorageType.File;
    };
    readonly APPROVALS: {
        readonly name: "APPROVALS";
        readonly subjects: string[];
        readonly retention: RetentionPolicy.Limits;
        readonly max_age: number;
        readonly storage: StorageType.File;
    };
    readonly OUTBOX: {
        readonly name: "OUTBOX";
        readonly subjects: string[];
        readonly retention: RetentionPolicy.Workqueue;
        readonly storage: StorageType.File;
    };
    readonly TTS: {
        readonly name: "TTS";
        readonly subjects: string[];
        readonly retention: RetentionPolicy.Limits;
        readonly storage: StorageType.File;
    };
    readonly RAG: {
        readonly name: "RAG";
        readonly subjects: string[];
        readonly retention: RetentionPolicy.Workqueue;
        readonly storage: StorageType.File;
    };
    readonly NOTIFY: {
        readonly name: "NOTIFY";
        readonly subjects: string[];
        readonly retention: RetentionPolicy.Limits;
        readonly max_age: number;
        readonly storage: StorageType.File;
    };
};
//# sourceMappingURL=nats-subjects.d.ts.map