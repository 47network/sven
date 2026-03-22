/**
 * Shared adapter framework.
 * Every channel adapter extends BaseAdapter and implements the platform-specific
 * connect / disconnect / sendText / sendBlocks / sendFile / sendAudio methods.
 *
 * The base class handles:
 *   - Gateway API client (adapter token auth)
 *   - Identity resolution / auto-creation
 *   - Chat resolution / auto-creation
 *   - Inbound forwarding (POST /v1/events/*)
 *   - Outbox polling loop (GET /v1/outbox/next → deliver → confirm)
 *   - Buttons support helpers (approve/deny)
 *   - Graceful shutdown
 */
import { type Logger } from '../logger.js';
import type { CanvasBlock } from '../types/events.js';
export interface AdapterConfig {
    /** Unique channel name (e.g. 'discord', 'slack', 'telegram') */
    channel: string;
    /** Gateway API base URL (e.g. http://gateway-api:3000) */
    gatewayUrl: string;
    /** Shared adapter token */
    adapterToken: string;
    /** Outbox poll interval in ms (default 2000) */
    outboxPollMs?: number;
}
/** Resolved identity from the gateway */
export interface ResolvedIdentity {
    identity_id: string;
    user_id: string;
}
/** Resolved chat from the gateway */
export interface ResolvedChat {
    chat_id: string;
}
/** Outbox item returned by GET /v1/outbox/next */
export interface OutboxItem {
    id: string;
    chat_id: string;
    channel: string;
    channel_chat_id: string;
    content_type: 'text' | 'blocks' | 'file' | 'audio';
    text?: string;
    blocks?: CanvasBlock[];
    file_url?: string;
    audio_url?: string;
    created_at: string;
    metadata?: Record<string, unknown>;
    /** Optional approval buttons to render */
    approval_buttons?: ApprovalButton[];
}
/** Approval button payload attached to an outbox item */
export interface ApprovalButton {
    approval_id: string;
    label: string;
    action: 'approve' | 'deny';
}
/** Inbound message to forward to the gateway */
export interface InboundPayload {
    channel_message_id: string;
    chat_id: string;
    sender_identity_id: string;
    text?: string;
    file_url?: string;
    file_name?: string;
    file_mime?: string;
    audio_url?: string;
    metadata?: Record<string, unknown>;
}
export declare class GatewayClient {
    private baseUrl;
    private token;
    private static readonly DEFAULT_REQUEST_TIMEOUT_MS;
    private static readonly DEFAULT_READ_RETRY_BASE_MS;
    private static readonly DEFAULT_OUTBOX_MAX_RETRIES;
    constructor(baseUrl: string, token: string);
    private static isRetryableStatus;
    private static isRetryableNetworkError;
    private static sleepWithJitter;
    private request;
    /** Find or create an identity for this channel user */
    resolveIdentity(channel: string, channelUserId: string, displayName?: string): Promise<ResolvedIdentity>;
    /** Find or create a chat for this channel conversation */
    resolveChat(channel: string, channelChatId: string, name?: string, type?: 'dm' | 'group'): Promise<ResolvedChat>;
    /** Ensure a user is a member of a chat */
    ensureMembership(chatId: string, userId: string): Promise<void>;
    sendMessage(channel: string, payload: InboundPayload): Promise<string>;
    sendFile(channel: string, payload: InboundPayload): Promise<string>;
    sendAudio(channel: string, payload: InboundPayload): Promise<string>;
    fetchOutbox(channel: string, limit?: number): Promise<OutboxItem[]>;
    markSent(outboxId: string, channel: string): Promise<void>;
    markError(outboxId: string, error: string, channel: string): Promise<void>;
}
export declare abstract class BaseAdapter {
    protected readonly config: AdapterConfig;
    protected readonly gateway: GatewayClient;
    protected readonly logger: Logger;
    private outboxTimer;
    private running;
    constructor(config: AdapterConfig);
    /** Start the adapter: connect to platform + start outbox poller */
    start(): Promise<void>;
    /** Stop the adapter gracefully */
    stop(): Promise<void>;
    private pollOutbox;
    /** Deliver a single outbox item to the external platform */
    private deliverOutboxItem;
    /**
     * Process an inbound message from the external platform.
     * Resolves identity + chat, ensures membership, then forwards to gateway.
     */
    protected handleInbound(opts: {
        channelUserId: string;
        channelChatId: string;
        channelMessageId: string;
        displayName?: string;
        chatName?: string;
        chatType?: 'dm' | 'group';
        text?: string;
        fileUrl?: string;
        fileName?: string;
        fileMime?: string;
        audioUrl?: string;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
    /** Convert canvas blocks to plain text (for channels without rich rendering) */
    protected blocksToText(blocks: CanvasBlock[]): string;
    /** Connect to the external platform (e.g. WebSocket, long-poll, webhook server) */
    protected abstract connect(): Promise<void>;
    /** Disconnect from the external platform */
    protected abstract disconnect(): Promise<void>;
    /** Send a plain text message to a channel conversation */
    protected abstract sendText(channelChatId: string, text: string, item: OutboxItem): Promise<void>;
    /** Send canvas blocks (rich content). Default: convert to text and sendText */
    protected sendBlocks(channelChatId: string, blocks: CanvasBlock[], fallbackText?: string, item?: OutboxItem): Promise<void>;
    /** Send a file to a channel conversation */
    protected abstract sendFile(channelChatId: string, fileUrl: string, caption?: string, item?: OutboxItem): Promise<void>;
    /** Send an audio message to a channel conversation */
    protected abstract sendAudio(channelChatId: string, audioUrl: string, caption?: string, item?: OutboxItem): Promise<void>;
    /** Send approval buttons (approve/deny). Default: send text fallback */
    protected sendApprovalButtons(channelChatId: string, buttons: ApprovalButton[], item: OutboxItem): Promise<void>;
}
/**
 * Standard main() for adapter services.
 * Reads config from env, creates the adapter, handles shutdown.
 */
export declare function runAdapter(AdapterClass: new (config: AdapterConfig & Record<string, any>) => BaseAdapter, extraConfig?: Record<string, any>): void;
//# sourceMappingURL=index.d.ts.map