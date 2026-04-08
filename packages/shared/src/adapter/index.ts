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

export * from './heartbeat.js';

import { createLogger, type Logger } from '../logger.js';
import type { CanvasBlock, OutboxEnqueueEvent } from '../types/events.js';

// ──── Types ──────────────────────────────────────────────────────────────────

export interface AdapterConfig {
  /** Unique channel name (e.g. 'discord', 'slack', 'telegram') */
  channel: string;
  /** Gateway API base URL (e.g. http://gateway-api:3000) */
  gatewayUrl: string;
  /** Shared adapter token */
  adapterToken: string;
  /** Organization ID — sent as X-SVEN-ORG-ID on every gateway request */
  organizationId?: string;
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

// ──── Gateway API Client ─────────────────────────────────────────────────────

export class GatewayClient {
  private baseUrl: string;
  private token: string;
  private orgId: string;
  private static readonly DEFAULT_REQUEST_TIMEOUT_MS = 10000;
  /** Identity resolution can create users in the DB — allow more time. */
  private static readonly IDENTITY_RESOLVE_TIMEOUT_MS = 30000;
  private static readonly DEFAULT_READ_RETRY_BASE_MS = 200;
  private static readonly DEFAULT_OUTBOX_MAX_RETRIES = 2;

  constructor(baseUrl: string, token: string, orgId?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.orgId = orgId || '';
  }

  private static isRetryableStatus(status: number): boolean {
    return status === 429 || status >= 500;
  }

  private static isRetryableNetworkError(err: unknown): boolean {
    const code = String((err as { code?: string })?.code || '').toUpperCase();
    const name = String((err as { name?: string })?.name || '');
    if (name === 'AbortError') return true;
    return (
      code === 'ECONNRESET' ||
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT' ||
      code === 'EHOSTUNREACH' ||
      code === 'ENETUNREACH'
    );
  }

  private static async sleepWithJitter(attempt: number): Promise<void> {
    const backoff = Math.min(
      2000,
      GatewayClient.DEFAULT_READ_RETRY_BASE_MS * (2 ** attempt),
    );
    const jitter = Math.floor(Math.random() * 100);
    await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
    options?: { timeoutMs?: number; maxRetries?: number },
  ): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'X-SVEN-ADAPTER-TOKEN': this.token,
      'Content-Type': 'application/json',
    };
    if (this.orgId) headers['X-SVEN-ORG-ID'] = this.orgId;
    const timeoutMs = Math.max(
      1000,
      Number(options?.timeoutMs ?? GatewayClient.DEFAULT_REQUEST_TIMEOUT_MS),
    );
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
          if (
            attempt < maxRetries &&
            GatewayClient.isRetryableStatus(res.status)
          ) {
            attempt += 1;
            await GatewayClient.sleepWithJitter(attempt);
            continue;
          }
          const text = await res.text().catch(() => '');
          throw new Error(`Gateway ${method} ${path} → ${res.status}: ${text}`);
        }
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) return res.json();
        return null;
      } catch (err) {
        if (attempt < maxRetries && GatewayClient.isRetryableNetworkError(err)) {
          attempt += 1;
          await GatewayClient.sleepWithJitter(attempt);
          continue;
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  // ── Identity ──

  /** Find or create an identity for this channel user */
  async resolveIdentity(
    channel: string,
    channelUserId: string,
    displayName?: string,
  ): Promise<ResolvedIdentity> {
    const res = await this.request('POST', '/v1/adapter/identity/resolve', {
      channel,
      channel_user_id: channelUserId,
      display_name: displayName,
    }, { timeoutMs: GatewayClient.IDENTITY_RESOLVE_TIMEOUT_MS });
    return res.data;
  }

  // ── Chat ──

  /** Find or create a chat for this channel conversation */
  async resolveChat(
    channel: string,
    channelChatId: string,
    name?: string,
    type?: 'dm' | 'group',
  ): Promise<ResolvedChat> {
    const res = await this.request('POST', '/v1/adapter/chat/resolve', {
      channel,
      channel_chat_id: channelChatId,
      name,
      type: type || 'group',
    });
    return res.data;
  }

  /** Ensure a user is a member of a chat */
  async ensureMembership(chatId: string, userId: string): Promise<void> {
    await this.request('POST', '/v1/adapter/chat/ensure-member', {
      chat_id: chatId,
      user_id: userId,
    });
  }

  // ── Inbound Events ──

  async sendMessage(channel: string, payload: InboundPayload): Promise<string> {
    const res = await this.request('POST', '/v1/events/message', {
      channel,
      content_type: 'text',
      ...payload,
    });
    return res.data?.event_id;
  }

  async sendFile(channel: string, payload: InboundPayload): Promise<string> {
    const res = await this.request('POST', '/v1/events/file', {
      channel,
      content_type: 'file',
      ...payload,
    });
    return res.data?.event_id;
  }

  async sendAudio(channel: string, payload: InboundPayload): Promise<string> {
    const res = await this.request('POST', '/v1/events/audio', {
      channel,
      content_type: 'audio',
      ...payload,
    });
    return res.data?.event_id;
  }

  // ── Outbox ──

  async fetchOutbox(channel: string, limit = 10): Promise<OutboxItem[]> {
    const res = await this.request(
      'GET',
      `/v1/outbox/next?channel=${encodeURIComponent(channel)}&limit=${limit}`,
      undefined,
      { maxRetries: GatewayClient.DEFAULT_OUTBOX_MAX_RETRIES },
    );
    if (Array.isArray(res?.data)) {
      return res.data as OutboxItem[];
    }
    return Array.isArray(res?.data?.items) ? res.data.items : [];
  }

  async markSent(outboxId: string, channel: string): Promise<void> {
    await this.request('POST', `/v1/outbox/${outboxId}/sent`, { channel });
  }

  async markError(outboxId: string, error: string, channel: string): Promise<void> {
    await this.request('POST', `/v1/outbox/${outboxId}/error`, { channel, error });
  }
}

// ──── Base Adapter ───────────────────────────────────────────────────────────

export abstract class BaseAdapter {
  protected readonly config: AdapterConfig;
  protected readonly gateway: GatewayClient;
  protected readonly logger: Logger;
  private outboxTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(config: AdapterConfig) {
    this.config = config;
    this.gateway = new GatewayClient(config.gatewayUrl, config.adapterToken, config.organizationId);
    this.logger = createLogger(`adapter-${config.channel}`);
  }

  // ──── Lifecycle ────────────────────────────────────────────────

  /** Start the adapter: connect to platform + start outbox poller */
  async start(): Promise<void> {
    this.running = true;
    this.logger.info('Starting adapter', { channel: this.config.channel });

    await this.connect();

    // Start outbox polling
    const pollMs = this.config.outboxPollMs ?? 2000;
    this.outboxTimer = setInterval(() => this.pollOutbox(), pollMs);

    this.logger.info('Adapter started', { channel: this.config.channel });
  }

  /** Stop the adapter gracefully */
  async stop(): Promise<void> {
    this.running = false;
    if (this.outboxTimer) {
      clearInterval(this.outboxTimer);
      this.outboxTimer = null;
    }
    await this.disconnect();
    this.logger.info('Adapter stopped', { channel: this.config.channel });
  }

  // ──── Outbox Poller ────────────────────────────────────────────

  private async pollOutbox(): Promise<void> {
    if (!this.running) return;
    try {
      const items = await this.gateway.fetchOutbox(this.config.channel);
      for (const item of items) {
        try {
          await this.deliverOutboxItem(item);
          await this.gateway.markSent(item.id, item.channel || this.config.channel);
        } catch (err: any) {
          this.logger.error('Failed to deliver outbox item', {
            outbox_id: item.id,
            error: err.message,
          });
          await this.gateway.markError(item.id, err.message, item.channel || this.config.channel).catch(() => {});
        }
      }
    } catch (err: any) {
      // Quiet poll failures — gateway may be temporarily unavailable
      if (err.message?.includes('ECONNREFUSED')) return;
      this.logger.warn('Outbox poll failed', { error: err.message });
    }
  }

  /** Deliver a single outbox item to the external platform */
  private async deliverOutboxItem(item: OutboxItem): Promise<void> {
    switch (item.content_type) {
      case 'text':
        await this.sendText(item.channel_chat_id, item.text || '', item);
        break;
      case 'blocks':
        await this.sendBlocks(
          item.channel_chat_id,
          item.blocks || [],
          item.text,
          item,
        );
        break;
      case 'file':
        await this.sendFile(
          item.channel_chat_id,
          item.file_url || '',
          item.text,
          item,
        );
        break;
      case 'audio':
        await this.sendAudio(
          item.channel_chat_id,
          item.audio_url || '',
          item.text,
          item,
        );
        break;
      default:
        this.logger.warn('Unknown outbox content_type', {
          content_type: item.content_type,
        });
    }

    // Render approval buttons if present
    if (item.approval_buttons?.length) {
      await this.sendApprovalButtons(
        item.channel_chat_id,
        item.approval_buttons,
        item,
      );
    }
  }

  // ──── Inbound Helpers ──────────────────────────────────────────

  /**
   * Process an inbound message from the external platform.
   * Resolves identity + chat, ensures membership, then forwards to gateway.
   */
  protected async handleInbound(opts: {
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
  }): Promise<void> {
    try {
      // 1. Resolve identity
      const identity = await this.gateway.resolveIdentity(
        this.config.channel,
        opts.channelUserId,
        opts.displayName,
      );

      // 2. Resolve chat
      const chat = await this.gateway.resolveChat(
        this.config.channel,
        opts.channelChatId,
        opts.chatName,
        opts.chatType,
      );

      // 3. Ensure membership
      await this.gateway.ensureMembership(chat.chat_id, identity.user_id);

      // 4. Forward to gateway
      const payload: InboundPayload = {
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
      } else if (opts.fileUrl) {
        await this.gateway.sendFile(this.config.channel, payload);
      } else {
        await this.gateway.sendMessage(this.config.channel, payload);
      }

      this.logger.debug('Inbound message forwarded', {
        channel_message_id: opts.channelMessageId,
        chat_id: chat.chat_id,
      });
    } catch (err: any) {
      this.logger.error('Failed to handle inbound message', {
        error: err.message,
        channel_user_id: opts.channelUserId,
      });
    }
  }

  // ──── Blocks → Text Fallback ───────────────────────────────────

  /** Convert canvas blocks to plain text (for channels without rich rendering) */
  protected blocksToText(blocks: CanvasBlock[]): string {
    return blocks
      .map((b) => {
        switch (b.type) {
          case 'markdown':
            return typeof b.content === 'string' ? b.content : JSON.stringify(b.content);
          case 'code': {
            const c = b.content as { language?: string; code?: string };
            return `\`\`\`${c.language || ''}\n${c.code || ''}\n\`\`\``;
          }
          case 'table': {
            const t = b.content as { headers?: string[]; rows?: string[][] };
            if (!t.headers || !t.rows) return '';
            const header = t.headers.join(' | ');
            const sep = t.headers.map(() => '---').join(' | ');
            const rows = t.rows.map((r) => r.join(' | ')).join('\n');
            return `${header}\n${sep}\n${rows}`;
          }
          case 'tool_card': {
            const tc = b.content as { tool_name?: string; status?: string; error?: string };
            return `🔧 ${tc.tool_name || 'Tool'} → ${tc.status || 'unknown'}${tc.error ? ` (${tc.error})` : ''}`;
          }
          case 'image': {
            const img = b.content as { src?: string; caption?: string };
            return img.caption ? `📷 ${img.caption}` : '📷 [Image]';
          }
          case 'audio': {
            const aud = b.content as { transcript?: string };
            return aud.transcript ? `🎵 ${aud.transcript}` : '🎵 [Audio]';
          }
          case 'file_preview': {
            const fp = b.content as { name?: string; size?: number };
            return `📎 ${fp.name || 'File'}`;
          }
          case 'link': {
            const lk = b.content as { url?: string; title?: string };
            return lk.title ? `🔗 ${lk.title}: ${lk.url}` : `🔗 ${lk.url}`;
          }
          case 'chart':
            return '📊 [Chart]';
          case 'actions': {
            const actions = b as { content?: { buttons?: Array<{ label?: string }> }; buttons?: Array<{ label?: string }> };
            const buttons = actions.buttons || actions.content?.buttons || [];
            if (!Array.isArray(buttons) || buttons.length === 0) return '';
            const labels = buttons
              .map((btn) => String(btn?.label || '').trim())
              .filter(Boolean);
            if (labels.length === 0) return '';
            return `Buttons: ${labels.join(', ')}`;
          }
          default:
            return typeof b.content === 'string' ? b.content : JSON.stringify(b.content);
        }
      })
      .filter(Boolean)
      .join('\n\n');
  }

  // ──── Abstract Methods (implement per platform) ────────────────

  /** Connect to the external platform (e.g. WebSocket, long-poll, webhook server) */
  protected abstract connect(): Promise<void>;

  /** Disconnect from the external platform */
  protected abstract disconnect(): Promise<void>;

  /** Send a plain text message to a channel conversation */
  protected abstract sendText(
    channelChatId: string,
    text: string,
    item: OutboxItem,
  ): Promise<void>;

  /** Send canvas blocks (rich content). Default: convert to text and sendText */
  protected async sendBlocks(
    channelChatId: string,
    blocks: CanvasBlock[],
    fallbackText?: string,
    item?: OutboxItem,
  ): Promise<void> {
    const text = fallbackText || this.blocksToText(blocks);
    await this.sendText(channelChatId, text, item!);
  }

  /** Send a file to a channel conversation */
  protected abstract sendFile(
    channelChatId: string,
    fileUrl: string,
    caption?: string,
    item?: OutboxItem,
  ): Promise<void>;

  /** Send an audio message to a channel conversation */
  protected abstract sendAudio(
    channelChatId: string,
    audioUrl: string,
    caption?: string,
    item?: OutboxItem,
  ): Promise<void>;

  /** Send approval buttons (approve/deny). Default: send text fallback */
  protected async sendApprovalButtons(
    channelChatId: string,
    buttons: ApprovalButton[],
    item: OutboxItem,
  ): Promise<void> {
    const text = buttons
      .map(
        (b) => `→ Reply "${b.action} ${b.approval_id}" to ${b.label.toLowerCase()}`,
      )
      .join('\n');
    await this.sendText(channelChatId, `Vote:\n${text}`, item);
  }
}

// ──── Adapter Runner ─────────────────────────────────────────────────────────

/**
 * Standard main() for adapter services.
 * Reads config from env, creates the adapter, handles shutdown.
 */
export function runAdapter(
  AdapterClass: new (config: AdapterConfig & Record<string, any>) => BaseAdapter,
  extraConfig?: Record<string, any>,
): void {
  const config: AdapterConfig = {
    channel: process.env.ADAPTER_CHANNEL || 'unknown',
    gatewayUrl: process.env.GATEWAY_URL || 'http://gateway-api:3000',
    adapterToken: process.env.SVEN_ADAPTER_TOKEN || '',
    organizationId: process.env.SVEN_ORG_ID || '',
    outboxPollMs: parseInt(process.env.OUTBOX_POLL_MS || '2000', 10),
  };

  const adapter = new AdapterClass({ ...config, ...extraConfig });

  const shutdown = async (signal: string) => {
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
