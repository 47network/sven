import Fastify from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BaseAdapter,
  createLogger,
  runAdapter,
  type AdapterConfig,
  type OutboxItem,
  type ApprovalButton,
} from '@sven/shared';

const logger = createLogger('adapter-line');

type LineConfig = AdapterConfig & {
  lineChannelAccessToken: string;
  lineChannelSecret: string;
  linePort: number;
  lineHost: string;
};

class LineAdapter extends BaseAdapter {
  private readonly accessToken: string;
  private readonly channelSecret: string;
  private readonly apiBase: string;
  private readonly port: number;
  private readonly host: string;
  private app: ReturnType<typeof Fastify> | null = null;

  constructor(config: LineConfig) {
    super({ ...config, channel: 'line' });
    this.accessToken = config.lineChannelAccessToken;
    this.channelSecret = config.lineChannelSecret;
    this.apiBase = String(process.env.LINE_API_BASE || 'https://api.line.me').replace(/\/+$/, '');
    this.port = config.linePort;
    this.host = config.lineHost;
  }

  private verifySignature(rawBody: Buffer, signature: string): boolean {
    const computed = createHmac('sha256', this.channelSecret).update(rawBody).digest();
    const provided = Buffer.from(String(signature || '').trim(), 'base64');
    try {
      if (computed.length !== provided.length) return false;
      return timingSafeEqual(computed, provided);
    } catch {
      return false;
    }
  }

  private normalizeRawBody(rawBody: unknown): Buffer | null {
    if (Buffer.isBuffer(rawBody)) return rawBody;
    if (rawBody instanceof Uint8Array) return Buffer.from(rawBody);
    if (typeof rawBody === 'string') return Buffer.from(rawBody, 'utf8');
    return null;
  }

  protected async connect(): Promise<void> {
    if (!this.accessToken || !this.channelSecret) {
      throw new Error('LINE_CHANNEL_ACCESS_TOKEN and LINE_CHANNEL_SECRET are required');
    }

    this.app = Fastify({
      logger: false,
      bodyLimit: 4 * 1024 * 1024,
    });

    this.app.removeContentTypeParser('application/json');
    this.app.addContentTypeParser(
      /^application\/json\b/i,
      { parseAs: 'buffer' },
      (request: any, body: Buffer, done: (err: Error | null, body?: unknown) => void) => {
        request.rawBody = body;
        try {
          done(null, JSON.parse(body.toString('utf8')));
        } catch (error) {
          done(error as Error);
        }
      },
    );

    this.app.get('/healthz', async () => ({ success: true, service: 'adapter-line' }));

    this.app.post('/webhook', async (request: any, reply: any) => {
      const rawBody = this.normalizeRawBody(request.rawBody);
      const signature = String(request.headers['x-line-signature'] || '');
      if (!signature || !rawBody || !this.verifySignature(rawBody, signature)) {
        return reply.status(401).send({ success: false, error: 'Invalid LINE signature' });
      }

      const events = Array.isArray(request.body?.events) ? request.body.events : [];
      for (const event of events) {
        if (!event || event.type !== 'message') continue;
        const source = event.source || {};
        const message = event.message || {};
        const channelChatId = String(source.groupId || source.roomId || source.userId || '');
        const channelUserId = String(source.userId || source.groupId || source.roomId || channelChatId);
        if (!channelChatId || !channelUserId) continue;

        const chatType = source.groupId || source.roomId ? 'group' : 'dm';
        const msgType = String(message.type || '');
        if (msgType === 'text') {
          await this.handleInbound({
            channelUserId,
            channelChatId,
            channelMessageId: String(message.id || event.webhookEventId || Date.now()),
            displayName: 'LINE User',
            chatName: chatType === 'dm' ? `LINE DM ${channelUserId}` : `LINE Group ${channelChatId}`,
            chatType,
            text: String(message.text || ''),
            metadata: {
              line_event_id: event.webhookEventId || null,
              line_reply_token: event.replyToken || null,
            },
          });
          continue;
        }

        // LINE media fetch requires content API download; for now, keep full audit trace in text.
        await this.handleInbound({
          channelUserId,
          channelChatId,
          channelMessageId: String(message.id || event.webhookEventId || Date.now()),
          displayName: 'LINE User',
          chatName: chatType === 'dm' ? `LINE DM ${channelUserId}` : `LINE Group ${channelChatId}`,
          chatType,
          text: `[LINE ${msgType} message received: ${message.id || 'unknown-id'}]`,
          metadata: {
            line_event_id: event.webhookEventId || null,
            line_message_type: msgType,
            line_message_id: message.id || null,
          },
        });
      }

      reply.send({ success: true });
    });

    await this.app.listen({ host: this.host, port: this.port });
    this.logger.info('LINE adapter webhook listening', { host: this.host, port: this.port });
  }

  protected async disconnect(): Promise<void> {
    if (this.app) {
      await this.app.close();
      this.app = null;
    }
  }

  private async linePush(to: string, messages: Array<Record<string, unknown>>): Promise<void> {
    const res = await fetch(`${this.apiBase}/v2/bot/message/push`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, messages }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`LINE push failed (${res.status}): ${text}`);
    }
  }

  protected async sendText(channelChatId: string, text: string, _item: OutboxItem): Promise<void> {
    await this.linePush(channelChatId, [{ type: 'text', text: text || ' ' }]);
  }

  protected async sendFile(channelChatId: string, fileUrl: string, caption?: string, _item?: OutboxItem): Promise<void> {
    const text = caption ? `${caption}\n${fileUrl}` : fileUrl;
    await this.linePush(channelChatId, [{ type: 'text', text }]);
  }

  protected async sendAudio(channelChatId: string, audioUrl: string, caption?: string, _item?: OutboxItem): Promise<void> {
    const text = caption ? `${caption}\n${audioUrl}` : audioUrl;
    await this.linePush(channelChatId, [{ type: 'text', text: `Audio: ${text}` }]);
  }

  protected async sendApprovalButtons(
    channelChatId: string,
    buttons: ApprovalButton[],
    _item: OutboxItem,
  ): Promise<void> {
    const quickReplyItems = buttons.slice(0, 10).map((btn) => ({
      type: 'action',
      action: {
        type: 'message',
        label: btn.label.slice(0, 20),
        text: `${btn.action} ${btn.approval_id}`,
      },
    }));
    await this.linePush(channelChatId, [
      {
        type: 'text',
        text: 'Approval required. Choose an action:',
        quickReply: { items: quickReplyItems },
      },
    ]);
  }
}

runAdapter(LineAdapter as any, {
  channel: 'line',
  lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  lineChannelSecret: process.env.LINE_CHANNEL_SECRET || '',
  linePort: Number(process.env.LINE_PORT || 8488),
  lineHost: process.env.LINE_HOST || '0.0.0.0',
});
