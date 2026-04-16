/**
 * Sven – Zalo OA Adapter
 *
 * Receives Zalo OA webhook events and forwards to gateway.
 * Polls outbox and delivers text/file replies via Zalo OA send API.
 * Approval actions are supported through text commands in Zalo chat.
 */

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

const logger = createLogger('adapter-zalo');
const trimSlash = (s: string) => { let i = s.length; while (i > 0 && s[i - 1] === '/') i--; return s.slice(0, i); };
const ZALO_MAX_WEBHOOK_BYTES = Number(process.env.ZALO_MAX_WEBHOOK_BYTES || 512 * 1024);

interface ZaloConfig extends AdapterConfig {
  zaloAccessToken: string;
  zaloWebhookSecret?: string;
  zaloPort: number;
  zaloApiBase?: string;
}

class ZaloAdapter extends BaseAdapter {
  private server!: http.Server;
  private accessToken: string;
  private webhookSecret: string;
  private port: number;
  private apiBase: string;

  constructor(config: ZaloConfig) {
    super({ ...config, channel: 'zalo' });
    this.accessToken = config.zaloAccessToken || process.env.ZALO_ACCESS_TOKEN || '';
    this.webhookSecret = config.zaloWebhookSecret || process.env.ZALO_WEBHOOK_SECRET || '';
    this.port = config.zaloPort || parseInt(process.env.ZALO_PORT || '8484', 10);
    this.apiBase = trimSlash(config.zaloApiBase || process.env.ZALO_API_BASE || 'https://openapi.zalo.me/v3.0/oa');
  }

  protected async connect(): Promise<void> {
    if (!this.accessToken) throw new Error('ZALO_ACCESS_TOKEN is required');

    this.server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', adapter: 'zalo' }));
        return;
      }

      if (req.method === 'POST' && req.url === '/webhook') {
        const maxBodyBytes = normalizeMaxBodyBytes(ZALO_MAX_WEBHOOK_BYTES);
        const contentLength = Number(req.headers['content-length'] || 0);
        if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
          logger.warn('Zalo webhook rejected: content-length over limit', {
            content_length: contentLength,
            max_body_bytes: maxBodyBytes,
          });
          writeJson(res, 413, {
            success: false,
            error: { code: 'PAYLOAD_TOO_LARGE', message: 'Zalo webhook body exceeds limit' },
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
            logger.warn('Zalo webhook rejected: body exceeds max bytes', {
              bytes_received: bytesReceived,
              max_body_bytes: maxBodyBytes,
            });
            writeJson(res, 413, {
              success: false,
              error: { code: 'PAYLOAD_TOO_LARGE', message: 'Zalo webhook body exceeds limit' },
            });
            req.destroy();
            return;
          }
          body += chunk.toString();
        });
        req.on('end', async () => {
          if (bodyTooLarge) return;
          try {
            if (this.webhookSecret) {
              const signature = String(req.headers['x-zalo-signature'] || '');
              const expected = crypto
                .createHmac('sha256', this.webhookSecret)
                .update(body)
                .digest('hex');
              const provided = signature.trim().toLowerCase();
              const canonicalExpected = expected.trim().toLowerCase();
              const providedBuf = Buffer.from(provided, 'utf8');
              const expectedBuf = Buffer.from(canonicalExpected, 'utf8');
              const signatureValid =
                provided.length > 0
                && providedBuf.length === expectedBuf.length
                && crypto.timingSafeEqual(providedBuf, expectedBuf);
              if (!signatureValid) {
                writeJson(res, 401, {
                  success: false,
                  error: { code: 'INVALID_SIGNATURE', message: 'Zalo webhook signature invalid' },
                });
                return;
              }
            }

            let payload: any;
            try {
              payload = body ? JSON.parse(body) : {};
            } catch (err: any) {
              logger.warn('Zalo webhook payload parse failed', { error: String(err?.message || err) });
              writeJson(res, 400, {
                success: false,
                error: { code: 'INVALID_PAYLOAD', message: 'Malformed webhook JSON payload' },
              });
              return;
            }

            try {
              await this.handleWebhook(payload);
            } catch (err: any) {
              logger.error('Failed to process Zalo webhook', { error: String(err?.message || err) });
              writeJson(res, 502, {
                success: false,
                error: { code: 'WEBHOOK_PROCESSING_FAILED', message: 'Failed to process webhook event' },
              });
              return;
            }

            writeJson(res, 200, { success: true });
          } catch (err: any) {
            logger.error('Failed to process Zalo webhook', { error: String(err?.message || err) });
            writeJson(res, 502, {
              success: false,
              error: { code: 'WEBHOOK_PROCESSING_FAILED', message: 'Failed to process webhook event' },
            });
          }
        });
        req.on('error', (err: Error) => {
          logger.warn('Zalo webhook request stream error', { error: err.message });
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      this.server.listen(this.port, () => {
        logger.info('Zalo adapter listening', { port: this.port });
        resolve();
      });
    });
  }

  protected async disconnect(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  protected async sendText(channelChatId: string, text: string, item: OutboxItem): Promise<void> {
    await this.sendZaloMessage(channelChatId, { text }, item);
  }

  protected async sendFile(
    channelChatId: string,
    fileUrl: string,
    caption?: string,
    item?: OutboxItem,
  ): Promise<void> {
    await this.sendZaloMessage(channelChatId, {
      attachment: {
        type: 'file',
        payload: {
          url: fileUrl,
        },
      },
      text: caption || '',
    }, item);
  }

  protected async sendAudio(
    channelChatId: string,
    audioUrl: string,
    caption?: string,
    item?: OutboxItem,
  ): Promise<void> {
    await this.sendZaloMessage(channelChatId, {
      attachment: {
        type: 'audio',
        payload: {
          url: audioUrl,
        },
      },
      text: caption || '',
    }, item);
  }

  protected override async sendApprovalButtons(
    channelChatId: string,
    buttons: ApprovalButton[],
    item: OutboxItem,
  ): Promise<void> {
    const lines = buttons.map((b) => `- ${b.label}: ${b.action} ${b.approval_id}`);
    const fallback = `Approval required\n${lines.join('\n')}`;
    await this.sendText(channelChatId, item.text ? `${item.text}\n\n${fallback}` : fallback, item);
  }

  private async handleWebhook(payload: any): Promise<void> {
    const eventName = String(payload?.event_name || '');
    const senderId = String(payload?.sender?.id || payload?.sender?.uid || '');
    const recipientId = String(payload?.recipient?.id || payload?.recipient?.uid || '');
    const message = payload?.message || {};
    const text = String(message?.text || message?.msg || '');
    const msgId = String(message?.msg_id || message?.id || Date.now());
    const replyTo = String(message?.quote_msg_id || '');

    if (!senderId || !recipientId) return;
    if (!eventName.includes('message')) return;

    const approvalMatch = text.match(/^(approve|deny)\s+(\S+)/i);
    if (approvalMatch) {
      const action = approvalMatch[1].toLowerCase();
      const approvalId = approvalMatch[2];
      await this.gateway.sendMessage('zalo', {
        channel_message_id: msgId,
        chat_id: '',
        sender_identity_id: '',
        text: `${action} ${approvalId}`,
        metadata: {
          is_approval_vote: true,
          approval_id: approvalId,
          vote: action,
          voter_zalo_id: senderId,
        },
      });
      return;
    }

    const attachment = Array.isArray(message?.attachments) ? message.attachments[0] : message?.attachment;
    const attachmentType = String(attachment?.type || '').toLowerCase();
    const attachmentUrl = String(attachment?.payload?.url || attachment?.url || '');
    const chatId = senderId;
    const metadata: Record<string, unknown> = {};
    if (replyTo) metadata.reply_to_message_id = replyTo;

    if ((attachmentType.includes('audio') || attachmentType.includes('voice')) && attachmentUrl) {
      await this.handleInbound({
        channelUserId: senderId,
        channelChatId: chatId,
        channelMessageId: msgId,
        displayName: senderId,
        chatType: 'dm',
        audioUrl: attachmentUrl,
        metadata,
      });
      return;
    }

    if (attachmentUrl) {
      await this.handleInbound({
        channelUserId: senderId,
        channelChatId: chatId,
        channelMessageId: msgId,
        displayName: senderId,
        chatType: 'dm',
        text: text || undefined,
        fileUrl: attachmentUrl,
        fileName: String(attachment?.payload?.name || attachment?.name || 'file'),
        fileMime: String(attachment?.payload?.mime_type || attachment?.mime_type || ''),
        metadata,
      });
      return;
    }

    await this.handleInbound({
      channelUserId: senderId,
      channelChatId: chatId,
      channelMessageId: msgId,
      displayName: senderId,
      chatType: 'dm',
      text: text || undefined,
      metadata,
    });
  }

  private async sendZaloMessage(
    userId: string,
    message: Record<string, unknown>,
    item?: OutboxItem,
  ): Promise<void> {
    const metadataRaw = (item as any)?.metadata;
    const replyTo = metadataRaw && typeof metadataRaw === 'object'
      ? String((metadataRaw as Record<string, unknown>).reply_to_message_id || '')
      : '';

    const payload = {
      recipient: { user_id: userId },
      message,
      ...(replyTo ? { quote: { msg_id: replyTo } } : {}),
    };
    const res = await fetch(`${this.apiBase}/message`, {
      method: 'POST',
      headers: {
        access_token: this.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Zalo send failed (${res.status}): ${text}`);
    }
  }
}

runAdapter(ZaloAdapter as any, {
  zaloAccessToken: process.env.ZALO_ACCESS_TOKEN || '',
  zaloWebhookSecret: process.env.ZALO_WEBHOOK_SECRET || '',
  zaloPort: parseInt(process.env.ZALO_PORT || '8484', 10),
  zaloApiBase: process.env.ZALO_API_BASE || 'https://openapi.zalo.me/v3.0/oa',
});

function normalizeMaxBodyBytes(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 512 * 1024;
  return Math.min(Math.max(Math.floor(raw), 16 * 1024), 10 * 1024 * 1024);
}

function writeJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  if (res.writableEnded) return;
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}
