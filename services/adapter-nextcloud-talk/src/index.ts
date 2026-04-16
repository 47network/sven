import http from 'node:http';
import crypto from 'node:crypto';
import {
  BaseAdapter,
  type AdapterConfig,
  type ApprovalButton,
  type OutboxItem,
  runAdapter,
  createLogger,
} from '@sven/shared';

const logger = createLogger('adapter-nextcloud-talk');
const trimSlash = (s: string) => { let i = s.length; while (i > 0 && s[i - 1] === '/') i--; return s.slice(0, i); };
const NEXTCLOUD_TALK_MAX_WEBHOOK_BYTES = Number(process.env.NEXTCLOUD_TALK_MAX_WEBHOOK_BYTES || 512 * 1024);

interface NextcloudTalkConfig extends AdapterConfig {
  ncBaseUrl: string;
  ncUser: string;
  ncAppPassword: string;
  ncPort: number;
  ncWebhookToken?: string;
}

class NextcloudTalkAdapter extends BaseAdapter {
  private server!: http.Server;
  private baseUrl: string;
  private user: string;
  private appPassword: string;
  private port: number;
  private webhookToken: string;

  constructor(config: NextcloudTalkConfig) {
    super({ ...config, channel: 'nextcloud_talk' });
    this.baseUrl = trimSlash(config.ncBaseUrl || process.env.NEXTCLOUD_BASE_URL || '');
    this.user = config.ncUser || process.env.NEXTCLOUD_USER || '';
    this.appPassword = config.ncAppPassword || process.env.NEXTCLOUD_APP_PASSWORD || '';
    this.port = Number(config.ncPort || process.env.NEXTCLOUD_TALK_PORT || 8495);
    this.webhookToken = config.ncWebhookToken || process.env.NEXTCLOUD_WEBHOOK_TOKEN || '';
  }

  protected async connect(): Promise<void> {
    if (!this.baseUrl) throw new Error('NEXTCLOUD_BASE_URL is required');
    if (!this.user) throw new Error('NEXTCLOUD_USER is required');
    if (!this.appPassword) throw new Error('NEXTCLOUD_APP_PASSWORD is required');

    this.server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', adapter: 'nextcloud-talk' }));
        return;
      }

      if (req.method === 'POST' && req.url === '/webhook') {
        const maxBodyBytes = normalizeMaxBodyBytes(NEXTCLOUD_TALK_MAX_WEBHOOK_BYTES);
        const contentLength = Number(req.headers['content-length'] || 0);
        if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
          logger.warn('Nextcloud webhook rejected: content-length over limit', {
            content_length: contentLength,
            max_body_bytes: maxBodyBytes,
          });
          writeJson(res, 413, {
            success: false,
            error: { code: 'PAYLOAD_TOO_LARGE', message: 'Nextcloud webhook body exceeds limit' },
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
            logger.warn('Nextcloud webhook rejected: body exceeds max bytes', {
              bytes_received: bytesReceived,
              max_body_bytes: maxBodyBytes,
            });
            writeJson(res, 413, {
              success: false,
              error: { code: 'PAYLOAD_TOO_LARGE', message: 'Nextcloud webhook body exceeds limit' },
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
            logger.warn('Nextcloud webhook payload parse failed', { error: String(err) });
            writeJson(res, 400, {
              success: false,
              error: { code: 'INVALID_PAYLOAD', message: 'Malformed webhook JSON payload' },
            });
            return;
          }

          if (!this.isAuthorizedWebhookPayload(payload)) {
            logger.warn('Nextcloud webhook rejected: invalid or missing token');
            writeJson(res, 401, {
              success: false,
              error: { code: 'UNAUTHORIZED', message: 'Invalid Nextcloud webhook token' },
            });
            return;
          }

          try {
            await this.handleWebhook(payload);
          } catch (err) {
            logger.error('Failed to process Nextcloud Talk webhook', { error: String(err) });
            writeJson(res, 502, {
              success: false,
              error: { code: 'WEBHOOK_PROCESSING_FAILED', message: 'Failed to process webhook event' },
            });
            return;
          }

          writeJson(res, 200, { success: true });
        });
        req.on('error', (err: Error) => {
          logger.warn('Nextcloud webhook request stream error', { error: err.message });
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      this.server.listen(this.port, () => {
        logger.info('Nextcloud Talk adapter listening', { port: this.port });
        resolve();
      });
    });
  }

  protected async disconnect(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  protected async sendText(channelChatId: string, text: string, _item: OutboxItem): Promise<void> {
    const url = `${this.baseUrl}/ocs/v2.php/apps/spreed/api/v4/chat/${encodeURIComponent(channelChatId)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.user}:${this.appPassword}`).toString('base64')}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'OCS-APIRequest': 'true',
      },
      body: JSON.stringify({ message: text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Nextcloud Talk send failed (${res.status}): ${body}`);
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

    const token = String(payload?.token || payload?.webhookToken || '').trim();
    if (!token) {
      return false;
    }
    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(this.webhookToken);
    if (tokenBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(tokenBuf, expectedBuf);
  }

  private async handleWebhook(payload: any): Promise<void> {
    const inbound = extractNextcloudInbound(payload);
    const actorId = inbound.actorId;
    const roomId = inbound.roomId;
    const message = inbound.message;
    const messageId = inbound.messageId;

    if (!actorId || !roomId || !message) return;

    await this.handleInbound({
      channelUserId: actorId,
      channelChatId: roomId,
      channelMessageId: messageId,
      displayName: actorId,
      chatName: roomId,
      chatType: 'group',
      text: message,
      metadata: {
        source: 'nextcloud_talk_webhook',
      },
    });
  }
}

export function extractNextcloudInbound(payload: any): {
  actorId: string;
  roomId: string;
  message: string;
  messageId: string;
} {
  return {
    actorId: String(payload?.actor?.id || payload?.actorId || ''),
    roomId: String(payload?.room?.token || payload?.roomToken || payload?.chatId || ''),
    message: String(payload?.message?.message || payload?.message || '').trim(),
    messageId: String(payload?.message?.id || payload?.messageId || Date.now()),
  };
}

if (process.env.NODE_ENV !== 'test') {
  runAdapter(NextcloudTalkAdapter as any, {
    ncBaseUrl: process.env.NEXTCLOUD_BASE_URL || '',
    ncUser: process.env.NEXTCLOUD_USER || '',
    ncAppPassword: process.env.NEXTCLOUD_APP_PASSWORD || '',
    ncPort: Number(process.env.NEXTCLOUD_TALK_PORT || 8495),
    ncWebhookToken: process.env.NEXTCLOUD_WEBHOOK_TOKEN || '',
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
