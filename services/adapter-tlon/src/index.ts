import http from 'node:http';
import {
  BaseAdapter,
  type AdapterConfig,
  type ApprovalButton,
  type OutboxItem,
  runAdapter,
  createLogger,
} from '@sven/shared';

const logger = createLogger('adapter-tlon');
const TLON_MAX_WEBHOOK_BYTES = Number(process.env.TLON_MAX_WEBHOOK_BYTES || 512 * 1024);

interface TlonConfig extends AdapterConfig {
  tlonApiBase: string;
  tlonApiToken?: string;
  tlonWebhookToken?: string;
  tlonPort: number;
}

class TlonAdapter extends BaseAdapter {
  private server!: http.Server;
  private apiBase: string;
  private apiToken: string;
  private webhookToken: string;
  private port: number;

  constructor(config: TlonConfig) {
    super({ ...config, channel: 'tlon' });
    this.apiBase = (config.tlonApiBase || process.env.TLON_API_BASE || '').replace(/\/+$/, '');
    this.apiToken = config.tlonApiToken || process.env.TLON_API_TOKEN || '';
    this.webhookToken = config.tlonWebhookToken || process.env.TLON_WEBHOOK_TOKEN || '';
    this.port = Number(config.tlonPort || process.env.TLON_PORT || 8493);
  }

  protected async connect(): Promise<void> {
    if (!this.apiBase) throw new Error('TLON_API_BASE is required');

    this.server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', adapter: 'tlon' }));
        return;
      }

      if (req.method === 'POST' && req.url === '/webhook') {
        const maxBodyBytes = normalizeMaxBodyBytes(TLON_MAX_WEBHOOK_BYTES);
        const contentLength = Number(req.headers['content-length'] || 0);
        if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
          logger.warn('Tlon webhook rejected: content-length over limit', {
            content_length: contentLength,
            max_body_bytes: maxBodyBytes,
          });
          writeJson(res, 413, {
            success: false,
            error: { code: 'PAYLOAD_TOO_LARGE', message: 'Tlon webhook body exceeds limit' },
          });
          req.resume();
          return;
        }

        let body = '';
        let bytesReceived = 0;
        let bodyTooLarge = false;
        req.on('data', (chunk: Buffer) => {
          if (bodyTooLarge) return;
          bytesReceived += chunk.length;
          if (bytesReceived > maxBodyBytes) {
            bodyTooLarge = true;
            logger.warn('Tlon webhook rejected: body exceeds max bytes', {
              bytes_received: bytesReceived,
              max_body_bytes: maxBodyBytes,
            });
            writeJson(res, 413, {
              success: false,
              error: { code: 'PAYLOAD_TOO_LARGE', message: 'Tlon webhook body exceeds limit' },
            });
            req.destroy();
            return;
          }
          body += chunk.toString('utf8');
        });
        req.on('end', async () => {
          if (bodyTooLarge) return;
          let payload: any;
          try {
            payload = body ? JSON.parse(body) : {};
          } catch (err) {
            logger.warn('Tlon webhook payload parse failed', { error: String(err) });
            writeJson(res, 400, {
              success: false,
              error: { code: 'INVALID_PAYLOAD', message: 'Malformed webhook JSON payload' },
            });
            return;
          }

          if (!this.isAuthorizedWebhookPayload(payload)) {
            logger.warn('Tlon webhook rejected: invalid or missing token');
            writeJson(res, 401, {
              success: false,
              error: { code: 'UNAUTHORIZED', message: 'Invalid Tlon webhook token' },
            });
            return;
          }

          try {
            await this.handleWebhook(payload);
          } catch (err) {
            logger.error('Failed to process Tlon webhook', { error: String(err) });
            writeJson(res, 502, {
              success: false,
              error: { code: 'WEBHOOK_PROCESSING_FAILED', message: 'Failed to process webhook event' },
            });
            return;
          }

          writeJson(res, 200, { success: true });
        });
        req.on('error', (err: Error) => {
          logger.warn('Tlon webhook request stream error', { error: err.message });
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      this.server.listen(this.port, () => {
        logger.info('Tlon adapter listening', { port: this.port });
        resolve();
      });
    });
  }

  protected async disconnect(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  protected async sendText(channelChatId: string, text: string, _item: OutboxItem): Promise<void> {
    const res = await fetch(`${this.apiBase}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {}),
      },
      body: JSON.stringify({
        chat_id: channelChatId,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Tlon send failed (${res.status}): ${body}`);
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

  private isAuthorizedWebhookPayload(payload: any): boolean {
    if (!this.webhookToken) {
      return true;
    }

    const token = String(payload?.token || '').trim();
    if (!token) {
      return false;
    }
    return token === this.webhookToken;
  }

  private async handleWebhook(payload: any): Promise<void> {
    const inbound = extractTlonInbound(payload);
    const senderId = inbound.senderId;
    const chatId = inbound.chatId;
    const text = inbound.text;
    const messageId = inbound.messageId;
    const chatType = inbound.chatType;

    if (!senderId || !chatId || !text) return;

    await this.handleInbound({
      channelUserId: senderId,
      channelChatId: chatId,
      channelMessageId: messageId,
      displayName: senderId,
      chatName: chatId,
      chatType,
      text,
      metadata: {
        source: 'tlon_webhook',
      },
    });
  }
}

export function extractTlonInbound(payload: any): {
  senderId: string;
  chatId: string;
  text: string;
  messageId: string;
  chatType: 'dm' | 'group';
} {
  const senderId = String(payload?.sender_id || payload?.ship || payload?.from || '');
  const chatId = String(payload?.chat_id || payload?.channel || payload?.ship || payload?.to || '');
  const text = String(
    payload?.text
    || payload?.message
    || payload?.payload?.text
    || payload?.payload?.say
    || payload?.payload?.message
    || '',
  ).trim();
  const messageId = String(payload?.message_id || payload?.id || payload?.event_id || Date.now());
  const chatType = String(payload?.chat_type || 'group').toLowerCase() === 'dm' ? 'dm' : 'group';
  return { senderId, chatId, text, messageId, chatType };
}

if (process.env.NODE_ENV !== 'test') {
  runAdapter(TlonAdapter as any, {
    tlonApiBase: process.env.TLON_API_BASE || '',
    tlonApiToken: process.env.TLON_API_TOKEN || '',
    tlonWebhookToken: process.env.TLON_WEBHOOK_TOKEN || '',
    tlonPort: Number(process.env.TLON_PORT || 8493),
  });
}

function normalizeMaxBodyBytes(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 512 * 1024;
  return Math.min(Math.max(Math.floor(raw), 16 * 1024), 10 * 1024 * 1024);
}

function writeJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  if (res.writableEnded) return;
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}
