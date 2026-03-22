import http from 'node:http';
import {
  BaseAdapter,
  type AdapterConfig,
  type ApprovalButton,
  type OutboxItem,
  runAdapter,
  createLogger,
} from '@sven/shared';

const logger = createLogger('adapter-nostr');

interface NostrConfig extends AdapterConfig {
  nostrRelayUrl: string;
  nostrSubKinds?: string;
  nostrSubAuthors?: string;
  nostrSubTagsP?: string;
  nostrPublishEndpoint?: string;
  nostrHealthPort?: number;
}

type NostrEvent = {
  id?: string;
  pubkey?: string;
  created_at?: number;
  kind?: number;
  tags?: string[][];
  content?: string;
};

class NostrAdapter extends BaseAdapter {
  private relayUrl: string;
  private subKinds: number[];
  private subAuthors: string[];
  private subTagsP: string[];
  private publishEndpoint: string;
  private healthPort: number;

  private ws: WebSocket | null = null;
  private subId = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private relayRunning = false;
  private healthServer: http.Server | null = null;

  constructor(config: NostrConfig) {
    super({ ...config, channel: 'nostr' });
    this.relayUrl = config.nostrRelayUrl || process.env.NOSTR_RELAY_URL || '';
    this.subKinds = parseIntList(config.nostrSubKinds || process.env.NOSTR_SUB_KINDS || '1');
    this.subAuthors = parseStringList(config.nostrSubAuthors || process.env.NOSTR_SUB_AUTHORS || '');
    this.subTagsP = parseStringList(config.nostrSubTagsP || process.env.NOSTR_SUB_TAGS_P || '');
    this.publishEndpoint = config.nostrPublishEndpoint || process.env.NOSTR_PUBLISH_ENDPOINT || '';
    this.healthPort = Number(config.nostrHealthPort || process.env.NOSTR_HEALTH_PORT || 8492);
  }

  protected async connect(): Promise<void> {
    if (!this.relayUrl) throw new Error('NOSTR_RELAY_URL is required');
    this.relayRunning = true;

    this.healthServer = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', adapter: 'nostr', relay: this.relayUrl }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => {
      this.healthServer!.listen(this.healthPort, () => resolve());
    });

    this.openRelay();
  }

  protected async disconnect(): Promise<void> {
    this.relayRunning = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.healthServer) {
      await new Promise<void>((resolve) => this.healthServer!.close(() => resolve()));
      this.healthServer = null;
    }
  }

  protected async sendText(channelChatId: string, text: string, _item: OutboxItem): Promise<void> {
    if (!this.publishEndpoint) {
      throw new Error('NOSTR_PUBLISH_ENDPOINT is required for outbound posting');
    }
    const res = await fetch(this.publishEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'nostr',
        target: channelChatId,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Nostr publish endpoint failed (${res.status}): ${body}`);
    }
  }

  protected async sendFile(channelChatId: string, fileUrl: string, caption?: string, item?: OutboxItem): Promise<void> {
    await this.sendText(channelChatId, [caption || 'File', fileUrl].filter(Boolean).join(' - '), item as OutboxItem);
  }

  protected async sendAudio(channelChatId: string, audioUrl: string, caption?: string, item?: OutboxItem): Promise<void> {
    await this.sendText(channelChatId, [caption || 'Audio', audioUrl].filter(Boolean).join(' - '), item as OutboxItem);
  }

  protected override async sendApprovalButtons(channelChatId: string, buttons: ApprovalButton[], item: OutboxItem): Promise<void> {
    const lines = buttons.map((b) => `${b.label}: ${b.action} ${b.approval_id}`);
    const fallback = `Approval required | ${lines.join(' | ')}`;
    await this.sendText(channelChatId, item.text ? `${item.text} | ${fallback}` : fallback, item);
  }

  private openRelay(): void {
    logger.info('Connecting to nostr relay', { relay: this.relayUrl });
    this.ws = new WebSocket(this.relayUrl);
    this.subId = `sven-${Math.random().toString(36).slice(2, 10)}`;

    this.ws.onopen = () => {
      const filter: Record<string, unknown> = {
        kinds: this.subKinds,
        limit: 100,
      };
      if (this.subAuthors.length > 0) filter.authors = this.subAuthors;
      if (this.subTagsP.length > 0) filter['#p'] = this.subTagsP;
      this.sendRelay(['REQ', this.subId, filter]);
      logger.info('Nostr relay subscription active', { sub_id: this.subId, kinds: this.subKinds });
    };

    this.ws.onmessage = (event) => {
      try {
        const raw = String(event.data || '');
        const msg = JSON.parse(raw) as unknown[];
        this.handleRelayMessage(msg);
      } catch (err) {
        logger.warn('Failed to parse relay message', { error: String(err) });
      }
    };

    this.ws.onerror = (event) => {
      logger.warn('Nostr relay socket error', { event: String(event.type || 'error') });
    };

    this.ws.onclose = () => {
      logger.warn('Nostr relay disconnected');
      this.ws = null;
      if (this.relayRunning) this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.relayRunning) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openRelay();
    }, 5000);
  }

  private handleRelayMessage(msg: unknown[]): void {
    if (!Array.isArray(msg) || msg.length < 2) return;
    const type = String(msg[0] || '');
    if (type !== 'EVENT') return;
    const event = msg[2] as NostrEvent;
    if (!event || typeof event !== 'object') return;
    const kind = Number(event.kind || 0);
    if (!this.subKinds.includes(kind)) return;

    const pubkey = String(event.pubkey || '');
    const text = String(event.content || '').trim();
    if (!pubkey || !text) return;

    const channelChatId = resolveNostrChatId(event);
    const channelMessageId = String(event.id || `${Date.now()}-${pubkey.slice(0, 8)}`);

    void this.handleInbound({
      channelUserId: pubkey,
      channelChatId,
      channelMessageId,
      displayName: pubkey,
      chatName: channelChatId,
      chatType: channelChatId === 'nostr-global' ? 'group' : 'dm',
      text,
      metadata: {
        nostr_kind: kind,
        nostr_tags: event.tags || [],
      },
    });
  }

  private sendRelay(payload: unknown[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }
}

export function resolveNostrChatId(event: NostrEvent): string {
  const tags = Array.isArray(event.tags) ? event.tags : [];
  const threadTag = tags.find((t) => Array.isArray(t) && t[0] === 'e' && typeof t[1] === 'string');
  if (threadTag?.[1]) return `nostr-thread:${threadTag[1]}`;
  const peerTag = tags.find((t) => Array.isArray(t) && t[0] === 'p' && typeof t[1] === 'string');
  if (peerTag?.[1]) return `nostr-peer:${peerTag[1]}`;
  return 'nostr-global';
}

export function parseStringList(input: string): string[] {
  return String(input || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function parseIntList(input: string): number[] {
  return parseStringList(input)
    .map((v) => Number.parseInt(v, 10))
    .filter((n) => Number.isFinite(n));
}

if (process.env.NODE_ENV !== 'test') {
  runAdapter(NostrAdapter as any, {
    nostrRelayUrl: process.env.NOSTR_RELAY_URL || '',
    nostrSubKinds: process.env.NOSTR_SUB_KINDS || '1',
    nostrSubAuthors: process.env.NOSTR_SUB_AUTHORS || '',
    nostrSubTagsP: process.env.NOSTR_SUB_TAGS_P || '',
    nostrPublishEndpoint: process.env.NOSTR_PUBLISH_ENDPOINT || '',
    nostrHealthPort: Number(process.env.NOSTR_HEALTH_PORT || 8492),
  });
}
