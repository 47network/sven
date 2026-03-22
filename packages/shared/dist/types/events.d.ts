/**
 * NATS JetStream event envelope and event types.
 * Every message on NATS carries this envelope.
 */
export interface EventEnvelope<T = unknown> {
    /** JSON Schema version for this payload */
    schema_version: string;
    /** Unique event ID (UUIDv7 preferred) */
    event_id: string;
    /** ISO-8601 timestamp when the event occurred */
    occurred_at: string;
    /** The typed payload */
    data: T;
}
export interface InboundMessageEvent {
    channel: string;
    channel_message_id: string;
    chat_id: string;
    sender_identity_id: string;
    agent_id?: string;
    agent_session_id?: string;
    content_type: 'text' | 'file' | 'audio';
    text?: string;
    file_url?: string;
    file_name?: string;
    file_mime?: string;
    audio_url?: string;
    metadata?: Record<string, unknown>;
}
export interface AudioIngestEvent {
    channel: string;
    channel_message_id: string;
    chat_id: string;
    sender_identity_id: string;
    message_id: string;
    audio_url: string;
    audio_mime?: string;
    metadata?: {
        transcribe?: boolean;
        language?: string;
        [key: string]: unknown;
    };
}
export interface WakeWordDetectionEvent {
    chat_id: string;
    channel: string;
    channel_message_id?: string;
    sender_identity_id?: string;
    message_id?: string;
    audio_url?: string;
    audio_mime?: string;
    wake_word: string;
    confidence?: number;
    language?: string;
    mode?: string;
    metadata?: Record<string, unknown>;
}
export interface RuntimeDispatchEvent {
    kind: 'workflow.execute' | 'workflow.retry_step';
    run_id: string;
    step_id?: string;
    workflow_id?: string;
    workflow_version?: number;
    chat_id?: string;
    user_id?: string;
    message_id?: string;
    trigger?: 'mention' | 'dm' | 'prefix' | 'allowlisted_room' | 'hq';
}
export interface ToolRunRequestEvent {
    run_id: string;
    correlation_id?: string;
    tool_name: string;
    chat_id: string;
    user_id: string;
    approval_id?: string;
    inputs: Record<string, unknown>;
    justification: {
        user_message_ids?: string[];
        rag_citations?: string[];
    };
}
export interface ToolRunResultEvent {
    run_id: string;
    correlation_id?: string;
    tool_name: string;
    chat_id: string;
    user_id: string;
    status: string;
    outputs?: Record<string, unknown>;
    error?: string;
    run_hash?: string;
    prev_hash?: string;
    canonical_io_sha256?: string;
    duration_ms?: number;
}
export interface ApprovalCreatedEvent {
    approval_id: string;
    chat_id: string;
    tool_name: string;
    scope: string;
    requester_user_id: string;
    quorum_required: number;
    expires_at: string;
    details: Record<string, unknown>;
}
export interface ApprovalUpdatedEvent {
    approval_id: string;
    voter_user_id: string;
    vote: 'approve' | 'deny';
    status: 'pending' | 'approved' | 'denied' | 'expired';
}
export interface OutboxEnqueueEvent {
    outbox_id: string;
    chat_id: string;
    channel: string;
    channel_chat_id: string;
    content_type: 'text' | 'blocks' | 'file' | 'audio';
    text?: string;
    blocks?: CanvasBlock[];
    file_url?: string;
    audio_url?: string;
    idempotency_key: string;
    metadata?: Record<string, unknown>;
}
export interface RagIndexRequestEvent {
    source: string;
    source_type: 'nas' | 'git' | 'notes' | 'file';
    title?: string;
    content: string;
    visibility?: 'global' | 'chat' | 'user';
    allow_users?: string[];
    allow_chats?: string[];
    metadata?: Record<string, unknown>;
}
export interface RagIndexResultEvent {
    doc_id: string;
    source: string;
    chunks_indexed: number;
    status: 'completed' | 'skipped' | 'error';
    error?: string;
}
export interface NotifyPushEvent {
    type: string;
    recipient_user_id?: string;
    target_user_ids?: string[];
    channel?: string;
    channels?: string[];
    title: string;
    body?: string;
    data?: Record<string, unknown>;
    action_url?: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
}
export interface CanvasBlock {
    type: 'markdown' | 'table' | 'chart' | 'code' | 'tool_card' | 'file_preview' | 'image' | 'audio' | 'link' | 'actions';
    content: unknown;
    metadata?: Record<string, unknown>;
}
//# sourceMappingURL=events.d.ts.map