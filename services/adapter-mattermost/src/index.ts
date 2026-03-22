import http from 'node:http';
import { basename } from 'node:path';
import {
  BaseAdapter,
  type AdapterConfig,
  type ApprovalButton,
  type OutboxItem,
  runAdapter,
  createLogger,
} from '@sven/shared';

const logger = createLogger('adapter-mattermost');
const MATTERMOST_MAX_WEBHOOK_BYTES = Number(process.env.MATTERMOST_MAX_WEBHOOK_BYTES || 512 * 1024);

interface MattermostConfig extends AdapterConfig {
  mattermostUrl: string;
  mattermostBotToken: string;
  mattermostPort: number;
  mattermostWebhookToken?: string;
}

class MattermostAdapter extends BaseAdapter {
  private server!: http.Server;
  private mmUrl: string;
  private botToken: string;
  private port: number;
  private webhookToken: string;

  constructor(config: MattermostConfig) {
    super({ ...config, channel: 'mattermost' });
    this.mmUrl = (config.mattermostUrl || process.env.MATTERMOST_URL || '').replace(/\/+$/, '');
    this.botToken = config.mattermostBotToken || process.env.MATTERMOST_BOT_TOKEN || '';
    this.port = Number(config.mattermostPort || process.env.MATTERMOST_PORT || 8491);
    this.webhookToken = config.mattermostWebhookToken || process.env.MATTERMOST_WEBHOOK_TOKEN || '';
  }

  protected async connect(): Promise<void> {
    if (!this.mmUrl) throw new Error('MATTERMOST_URL is required');
    if (!this.botToken) throw new Error('MATTERMOST_BOT_TOKEN is required');

    this.server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', adapter: 'mattermost' }));
        return;
      }

      if (req.method === 'POST' && req.url === '/webhook') {
        const maxBodyBytes = normalizeMaxBodyBytes(MATTERMOST_MAX_WEBHOOK_BYTES);
        const contentLength = Number(req.headers['content-length'] || 0);
        if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
          logger.warn('Mattermost webhook rejected: content-length over limit', {
            content_length: contentLength,
            max_body_bytes: maxBodyBytes,
          });
          writeJson(res, 413, {
            success: false,
            error: { code: 'PAYLOAD_TOO_LARGE', message: 'Mattermost webhook body exceeds limit' },
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
            logger.warn('Mattermost webhook rejected: body exceeds max bytes', {
              bytes_received: bytesReceived,
              max_body_bytes: maxBodyBytes,
            });
            writeJson(res, 413, {
              success: false,
              error: { code: 'PAYLOAD_TOO_LARGE', message: 'Mattermost webhook body exceeds limit' },
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
            logger.warn('Mattermost webhook payload parse failed', { error: String(err) });
            writeJson(res, 400, {
              success: false,
              error: { code: 'INVALID_PAYLOAD', message: 'Malformed webhook JSON payload' },
            });
            return;
          }

          if (!this.isAuthorizedWebhookPayload(payload)) {
            logger.warn('Mattermost webhook rejected: invalid or missing token');
            writeJson(res, 401, {
              success: false,
              error: { code: 'UNAUTHORIZED', message: 'Invalid Mattermost webhook token' },
            });
            return;
          }

          try {
            await this.handleWebhook(payload);
          } catch (err) {
            logger.error('Failed to process Mattermost webhook', { error: String(err) });
            writeJson(res, 502, {
              success: false,
              error: { code: 'WEBHOOK_PROCESSING_FAILED', message: 'Failed to process webhook event' },
            });
            return;
          }

          writeJson(res, 200, { success: true });
        });
        req.on('error', (err: Error) => {
          logger.warn('Mattermost webhook request stream error', { error: err.message });
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      this.server.listen(this.port, () => {
        logger.info('Mattermost adapter listening', { port: this.port });
        resolve();
      });
    });
  }

  protected async disconnect(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  protected async sendText(channelChatId: string, text: string, _item: OutboxItem): Promise<void> {
    await this.sendPost(channelChatId, text);
  }

  protected async sendFile(channelChatId: string, fileUrl: string, caption?: string, item?: OutboxItem): Promise<void> {
    const fileId = await this.uploadFile(channelChatId, fileUrl, caption || undefined);
    if (!fileId) {
      await this.sendText(channelChatId, [caption || 'File', fileUrl].filter(Boolean).join(' - '), item as OutboxItem);
      return;
    }
    await this.sendPost(channelChatId, caption || 'File', [fileId]);
  }

  protected async sendAudio(channelChatId: string, audioUrl: string, caption?: string, item?: OutboxItem): Promise<void> {
    const fileId = await this.uploadFile(channelChatId, audioUrl, caption || undefined);
    if (!fileId) {
      await this.sendText(channelChatId, [caption || 'Audio', audioUrl].filter(Boolean).join(' - '), item as OutboxItem);
      return;
    }
    await this.sendPost(channelChatId, caption || 'Audio', [fileId]);
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
    const postPayload = payload?.post ? parsePostPayload(String(payload.post)) : null;
    const text = String(payload?.text || postPayload?.message || '').trim();
    const userId = String(payload?.user_id || postPayload?.user_id || payload?.user_name || '');
    const channelId = String(payload?.channel_id || postPayload?.channel_id || payload?.channel_name || '');
    const postId = String(payload?.post_id || postPayload?.id || Date.now());
    const channelType = String(payload?.channel_type || postPayload?.channel_type || '').toUpperCase();

    if (!text || !userId || !channelId) return;

    const direct = channelType === 'D' || channelId.startsWith('dm_');
    await this.handleInbound({
      channelUserId: userId,
      channelChatId: channelId,
      channelMessageId: postId,
      displayName: String(payload?.user_name || userId),
      chatName: String(payload?.channel_name || channelId),
      chatType: direct ? 'dm' : 'group',
      text,
      metadata: {
        team_domain: payload?.team_domain,
        trigger_word: payload?.trigger_word,
        mattermost_channel_type: channelType || undefined,
      },
    });
  }

  private async sendPost(channelId: string, message: string, fileIds?: string[]): Promise<void> {
    const res = await fetch(`${this.mmUrl}/api/v4/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel_id: channelId,
        message,
        ...(Array.isArray(fileIds) && fileIds.length > 0 ? { file_ids: fileIds } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Mattermost post failed (${res.status}): ${text}`);
    }
  }

  private async uploadFile(channelId: string, fileUrl: string, caption?: string): Promise<string | null> {
    try {
      const fetched = await fetch(fileUrl);
      if (!fetched.ok) return null;
      const arrayBuffer = await fetched.arrayBuffer();
      const contentType = fetched.headers.get('content-type') || 'application/octet-stream';
      const urlPath = new URL(fileUrl).pathname;
      const fileName = basename(urlPath) || 'attachment.bin';

      const form = new FormData();
      form.set('channel_id', channelId);
      if (caption) form.set('filename', fileName);
      form.append('files', new Blob([arrayBuffer], { type: contentType }), fileName);

      const res = await fetch(`${this.mmUrl}/api/v4/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.botToken}`,
        },
        body: form,
      });
      if (!res.ok) return null;
      const data = await res.json() as any;
      const ids = Array.isArray(data?.file_infos)
        ? data.file_infos.map((f: any) => String(f?.id || '')).filter(Boolean)
        : [];
      return ids[0] || null;
    } catch {
      return null;
    }
  }
}

export function parsePostPayload(raw: string): { id?: string; user_id?: string; channel_id?: string; channel_type?: string; message?: string } | null {
  try {
    const data = JSON.parse(raw) as any;
    return {
      id: data?.id,
      user_id: data?.user_id,
      channel_id: data?.channel_id,
      channel_type: data?.channel_type,
      message: data?.message,
    };
  } catch {
    return null;
  }
}

if (process.env.NODE_ENV !== 'test') {
  runAdapter(MattermostAdapter as any, {
    mattermostUrl: process.env.MATTERMOST_URL || '',
    mattermostBotToken: process.env.MATTERMOST_BOT_TOKEN || '',
    mattermostPort: Number(process.env.MATTERMOST_PORT || 8491),
    mattermostWebhookToken: process.env.MATTERMOST_WEBHOOK_TOKEN || '',
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
