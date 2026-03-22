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
import { createLogger } from '../logger.js';
// ──── Gateway API Client ─────────────────────────────────────────────────────
export class GatewayClient {
    baseUrl;
    token;
    static DEFAULT_REQUEST_TIMEOUT_MS = 10000;
    static DEFAULT_READ_RETRY_BASE_MS = 200;
    static DEFAULT_OUTBOX_MAX_RETRIES = 2;
    constructor(baseUrl, token) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.token = token;
    }
    static isRetryableStatus(status) {
        return status === 429 || status >= 500;
    }
    static isRetryableNetworkError(err) {
        const code = String(err?.code || '').toUpperCase();
        const name = String(err?.name || '');
        if (name === 'AbortError')
            return true;
        return (code === 'ECONNRESET' ||
            code === 'ECONNREFUSED' ||
            code === 'ETIMEDOUT' ||
            code === 'EHOSTUNREACH' ||
            code === 'ENETUNREACH');
    }
    static async sleepWithJitter(attempt) {
        const backoff = Math.min(2000, GatewayClient.DEFAULT_READ_RETRY_BASE_MS * (2 ** attempt));
        const jitter = Math.floor(Math.random() * 100);
        await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
    }
    async request(method, path, body, options) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            'X-SVEN-ADAPTER-TOKEN': this.token,
            'Content-Type': 'application/json',
        };
        const timeoutMs = Math.max(1000, Number(options?.timeoutMs ?? GatewayClient.DEFAULT_REQUEST_TIMEOUT_MS));
        const maxRetries = Math.max(0, Math.trunc(Number(options?.maxRetries ?? 0)));
        let attempt = 0;
        for (;;) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetch(url, {
                    method,
                    headers,
                    body: body ? JSON.stringify(body) : undefined,
                    signal: controller.signal,
                });
                if (!res.ok) {
                    if (attempt < maxRetries &&
                        GatewayClient.isRetryableStatus(res.status)) {
                        attempt += 1;
                        await GatewayClient.sleepWithJitter(attempt);
                        continue;
                    }
                    const text = await res.text().catch(() => '');
                    throw new Error(`Gateway ${method} ${path} → ${res.status}: ${text}`);
                }
                const ct = res.headers.get('content-type') || '';
                if (ct.includes('application/json'))
                    return res.json();
                return null;
            }
            catch (err) {
                if (attempt < maxRetries && GatewayClient.isRetryableNetworkError(err)) {
                    attempt += 1;
                    await GatewayClient.sleepWithJitter(attempt);
                    continue;
                }
                throw err;
            }
            finally {
                clearTimeout(timeout);
            }
        }
    }
    // ── Identity ──
    /** Find or create an identity for this channel user */
    async resolveIdentity(channel, channelUserId, displayName) {
        const res = await this.request('POST', '/v1/adapter/identity/resolve', {
            channel,
            channel_user_id: channelUserId,
            display_name: displayName,
        });
        return res.data;
    }
    // ── Chat ──
    /** Find or create a chat for this channel conversation */
    async resolveChat(channel, channelChatId, name, type) {
        const res = await this.request('POST', '/v1/adapter/chat/resolve', {
            channel,
            channel_chat_id: channelChatId,
            name,
            type: type || 'group',
        });
        return res.data;
    }
    /** Ensure a user is a member of a chat */
    async ensureMembership(chatId, userId) {
        await this.request('POST', '/v1/adapter/chat/ensure-member', {
            chat_id: chatId,
            user_id: userId,
        });
    }
    // ── Inbound Events ──
    async sendMessage(channel, payload) {
        const res = await this.request('POST', '/v1/events/message', {
            channel,
            content_type: 'text',
            ...payload,
        });
        return res.data?.event_id;
    }
    async sendFile(channel, payload) {
        const res = await this.request('POST', '/v1/events/file', {
            channel,
            content_type: 'file',
            ...payload,
        });
        return res.data?.event_id;
    }
    async sendAudio(channel, payload) {
        const res = await this.request('POST', '/v1/events/audio', {
            channel,
            content_type: 'audio',
            ...payload,
        });
        return res.data?.event_id;
    }
    // ── Outbox ──
    async fetchOutbox(channel, limit = 10) {
        const res = await this.request('GET', `/v1/outbox/next?channel=${encodeURIComponent(channel)}&limit=${limit}`, undefined, { maxRetries: GatewayClient.DEFAULT_OUTBOX_MAX_RETRIES });
        if (Array.isArray(res?.data)) {
            return res.data;
        }
        return Array.isArray(res?.data?.items) ? res.data.items : [];
    }
    async markSent(outboxId, channel) {
        await this.request('POST', `/v1/outbox/${outboxId}/sent`, { channel });
    }
    async markError(outboxId, error, channel) {
        await this.request('POST', `/v1/outbox/${outboxId}/error`, { channel, error });
    }
}
// ──── Base Adapter ───────────────────────────────────────────────────────────
export class BaseAdapter {
    config;
    gateway;
    logger;
    outboxTimer = null;
    running = false;
    constructor(config) {
        this.config = config;
        this.gateway = new GatewayClient(config.gatewayUrl, config.adapterToken);
        this.logger = createLogger(`adapter-${config.channel}`);
    }
    // ──── Lifecycle ────────────────────────────────────────────────
    /** Start the adapter: connect to platform + start outbox poller */
    async start() {
        this.running = true;
        this.logger.info('Starting adapter', { channel: this.config.channel });
        await this.connect();
        // Start outbox polling
        const pollMs = this.config.outboxPollMs ?? 2000;
        this.outboxTimer = setInterval(() => this.pollOutbox(), pollMs);
        this.logger.info('Adapter started', { channel: this.config.channel });
    }
    /** Stop the adapter gracefully */
    async stop() {
        this.running = false;
        if (this.outboxTimer) {
            clearInterval(this.outboxTimer);
            this.outboxTimer = null;
        }
        await this.disconnect();
        this.logger.info('Adapter stopped', { channel: this.config.channel });
    }
    // ──── Outbox Poller ────────────────────────────────────────────
    async pollOutbox() {
        if (!this.running)
            return;
        try {
            const items = await this.gateway.fetchOutbox(this.config.channel);
            for (const item of items) {
                try {
                    await this.deliverOutboxItem(item);
                    await this.gateway.markSent(item.id, item.channel || this.config.channel);
                }
                catch (err) {
                    this.logger.error('Failed to deliver outbox item', {
                        outbox_id: item.id,
                        error: err.message,
                    });
                    await this.gateway.markError(item.id, err.message, item.channel || this.config.channel).catch(() => { });
                }
            }
        }
        catch (err) {
            // Quiet poll failures — gateway may be temporarily unavailable
            if (err.message?.includes('ECONNREFUSED'))
                return;
            this.logger.warn('Outbox poll failed', { error: err.message });
        }
    }
    /** Deliver a single outbox item to the external platform */
    async deliverOutboxItem(item) {
        switch (item.content_type) {
            case 'text':
                await this.sendText(item.channel_chat_id, item.text || '', item);
                break;
            case 'blocks':
                await this.sendBlocks(item.channel_chat_id, item.blocks || [], item.text, item);
                break;
            case 'file':
                await this.sendFile(item.channel_chat_id, item.file_url || '', item.text, item);
                break;
            case 'audio':
                await this.sendAudio(item.channel_chat_id, item.audio_url || '', item.text, item);
                break;
            default:
                this.logger.warn('Unknown outbox content_type', {
                    content_type: item.content_type,
                });
        }
        // Render approval buttons if present
        if (item.approval_buttons?.length) {
            await this.sendApprovalButtons(item.channel_chat_id, item.approval_buttons, item);
        }
    }
    // ──── Inbound Helpers ──────────────────────────────────────────
    /**
     * Process an inbound message from the external platform.
     * Resolves identity + chat, ensures membership, then forwards to gateway.
     */
    async handleInbound(opts) {
        try {
            // 1. Resolve identity
            const identity = await this.gateway.resolveIdentity(this.config.channel, opts.channelUserId, opts.displayName);
            // 2. Resolve chat
            const chat = await this.gateway.resolveChat(this.config.channel, opts.channelChatId, opts.chatName, opts.chatType);
            // 3. Ensure membership
            await this.gateway.ensureMembership(chat.chat_id, identity.user_id);
            // 4. Forward to gateway
            const payload = {
                channel_message_id: opts.channelMessageId,
                chat_id: chat.chat_id,
                sender_identity_id: identity.identity_id,
                text: opts.text,
                file_url: opts.fileUrl,
                file_name: opts.fileName,
                file_mime: opts.fileMime,
                audio_url: opts.audioUrl,
                metadata: opts.metadata,
            };
            if (opts.audioUrl) {
                await this.gateway.sendAudio(this.config.channel, payload);
            }
            else if (opts.fileUrl) {
                await this.gateway.sendFile(this.config.channel, payload);
            }
            else {
                await this.gateway.sendMessage(this.config.channel, payload);
            }
            this.logger.debug('Inbound message forwarded', {
                channel_message_id: opts.channelMessageId,
                chat_id: chat.chat_id,
            });
        }
        catch (err) {
            this.logger.error('Failed to handle inbound message', {
                error: err.message,
                channel_user_id: opts.channelUserId,
            });
        }
    }
    // ──── Blocks → Text Fallback ───────────────────────────────────
    /** Convert canvas blocks to plain text (for channels without rich rendering) */
    blocksToText(blocks) {
        return blocks
            .map((b) => {
            switch (b.type) {
                case 'markdown':
                    return typeof b.content === 'string' ? b.content : JSON.stringify(b.content);
                case 'code': {
                    const c = b.content;
                    return `\`\`\`${c.language || ''}\n${c.code || ''}\n\`\`\``;
                }
                case 'table': {
                    const t = b.content;
                    if (!t.headers || !t.rows)
                        return '';
                    const header = t.headers.join(' | ');
                    const sep = t.headers.map(() => '---').join(' | ');
                    const rows = t.rows.map((r) => r.join(' | ')).join('\n');
                    return `${header}\n${sep}\n${rows}`;
                }
                case 'tool_card': {
                    const tc = b.content;
                    return `🔧 ${tc.tool_name || 'Tool'} → ${tc.status || 'unknown'}${tc.error ? ` (${tc.error})` : ''}`;
                }
                case 'image': {
                    const img = b.content;
                    return img.caption ? `📷 ${img.caption}` : '📷 [Image]';
                }
                case 'audio': {
                    const aud = b.content;
                    return aud.transcript ? `🎵 ${aud.transcript}` : '🎵 [Audio]';
                }
                case 'file_preview': {
                    const fp = b.content;
                    return `📎 ${fp.name || 'File'}`;
                }
                case 'link': {
                    const lk = b.content;
                    return lk.title ? `🔗 ${lk.title}: ${lk.url}` : `🔗 ${lk.url}`;
                }
                case 'chart':
                    return '📊 [Chart]';
                case 'actions': {
                    const actions = b;
                    const buttons = actions.buttons || actions.content?.buttons || [];
                    if (!Array.isArray(buttons) || buttons.length === 0)
                        return '';
                    const labels = buttons
                        .map((btn) => String(btn?.label || '').trim())
                        .filter(Boolean);
                    if (labels.length === 0)
                        return '';
                    return `Buttons: ${labels.join(', ')}`;
                }
                default:
                    return typeof b.content === 'string' ? b.content : JSON.stringify(b.content);
            }
        })
            .filter(Boolean)
            .join('\n\n');
    }
    /** Send canvas blocks (rich content). Default: convert to text and sendText */
    async sendBlocks(channelChatId, blocks, fallbackText, item) {
        const text = fallbackText || this.blocksToText(blocks);
        await this.sendText(channelChatId, text, item);
    }
    /** Send approval buttons (approve/deny). Default: send text fallback */
    async sendApprovalButtons(channelChatId, buttons, item) {
        const text = buttons
            .map((b) => `→ Reply "${b.action} ${b.approval_id}" to ${b.label.toLowerCase()}`)
            .join('\n');
        await this.sendText(channelChatId, `Vote:\n${text}`, item);
    }
}
// ──── Adapter Runner ─────────────────────────────────────────────────────────
/**
 * Standard main() for adapter services.
 * Reads config from env, creates the adapter, handles shutdown.
 */
export function runAdapter(AdapterClass, extraConfig) {
    const config = {
        channel: process.env.ADAPTER_CHANNEL || 'unknown',
        gatewayUrl: process.env.GATEWAY_URL || 'http://gateway-api:3000',
        adapterToken: process.env.SVEN_ADAPTER_TOKEN || '',
        outboxPollMs: parseInt(process.env.OUTBOX_POLL_MS || '2000', 10),
    };
    const adapter = new AdapterClass({ ...config, ...extraConfig });
    const shutdown = async (signal) => {
        adapter['logger'].info(`Received ${signal}, shutting down…`);
        await adapter.stop();
        process.exit(0);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    adapter.start().catch((err) => {
        adapter['logger'].fatal('Adapter failed to start', { error: err.message });
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map