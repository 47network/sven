/**
 * Sven – WhatsApp Channel Adapter
 *
 * Uses WhatsApp Cloud API (Meta Business Platform).
 * Receives webhooks → forwards to Sven gateway.
 * Polls outbox and delivers replies with template/button messages.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import {
  BaseAdapter,
  type AdapterConfig,
  type OutboxItem,
  type ApprovalButton,
  type CanvasBlock,
  runAdapter,
  createLogger,
} from '@sven/shared';

const logger = createLogger('adapter-whatsapp');
const WHATSAPP_MAX_WEBHOOK_BYTES = Number(process.env.WHATSAPP_MAX_WEBHOOK_BYTES || 512 * 1024);

// ──── WhatsApp Adapter ───────────────────────────────────────────────────────

interface WhatsAppConfig extends AdapterConfig {
  whatsappToken: string;
  whatsappPhoneNumberId: string;
  whatsappVerifyToken: string;
  whatsappAppSecret: string;
  whatsappPort: number;
}

const WA_API_BASE = 'https://graph.facebook.com/v18.0';

class WhatsAppAdapter extends BaseAdapter {
  private server!: http.Server;
  private token: string;
  private phoneNumberId: string;
  private verifyToken: string;
  private appSecret: string;
  private port: number;

  constructor(config: WhatsAppConfig) {
    super({ ...config, channel: 'whatsapp' });
    this.token = config.whatsappToken || process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || '';
    this.phoneNumberId = config.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.verifyToken = config.whatsappVerifyToken || process.env.WHATSAPP_VERIFY_TOKEN || '';
    this.appSecret = config.whatsappAppSecret || process.env.WHATSAPP_APP_SECRET || '';
    this.port = config.whatsappPort || parseInt(process.env.WHATSAPP_PORT || '8443', 10);
  }

  protected async connect(): Promise<void> {
    if (!this.token) throw new Error('WHATSAPP_ACCESS_TOKEN is required');
    if (!this.phoneNumberId) throw new Error('WHATSAPP_PHONE_NUMBER_ID is required');
    if (!this.verifyToken) throw new Error('WHATSAPP_VERIFY_TOKEN is required');

    this.server = http.createServer(async (req, res) => {
      // Webhook verification (GET)
      if (req.method === 'GET' && req.url?.startsWith('/webhook')) {
        const url = new URL(req.url, `http://localhost:${this.port}`);
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');

        if (mode === 'subscribe' && token === this.verifyToken) {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end(challenge);
        } else {
          res.writeHead(403);
          res.end();
        }
        return;
      }

      // Webhook events (POST)
      if (req.method === 'POST' && req.url?.startsWith('/webhook')) {
        const maxBodyBytes = normalizeMaxBodyBytes(WHATSAPP_MAX_WEBHOOK_BYTES);
        const contentLength = Number(req.headers['content-length'] || 0);
        if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
          logger.warn('WhatsApp webhook rejected: content-length over limit', {
            content_length: contentLength,
            max_body_bytes: maxBodyBytes,
          });
          writeJson(res, 413, {
            success: false,
            error: { code: 'PAYLOAD_TOO_LARGE', message: 'WhatsApp webhook body exceeds limit' },
          });
          req.resume();
          return;
        }

        let bytesReceived = 0;
        const chunks: Buffer[] = [];
        let bodyTooLarge = false;
        req.on('data', (chunk: Buffer) => {
          if (bodyTooLarge) return;
          bytesReceived += chunk.length;
          if (bytesReceived > maxBodyBytes) {
            bodyTooLarge = true;
            logger.warn('WhatsApp webhook rejected: body exceeds max bytes', {
              bytes_received: bytesReceived,
              max_body_bytes: maxBodyBytes,
            });
            writeJson(res, 413, {
              success: false,
              error: { code: 'PAYLOAD_TOO_LARGE', message: 'WhatsApp webhook body exceeds limit' },
            });
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });

        req.on('end', async () => {
          if (bodyTooLarge) return;
          const body = Buffer.concat(chunks).toString('utf8');
          // Verify signature if app secret is set
          if (this.appSecret) {
            const signature = req.headers['x-hub-signature-256'] as string;
            const expected = 'sha256=' + crypto
              .createHmac('sha256', this.appSecret)
              .update(body)
              .digest('hex');
            const sigBuf = Buffer.from(String(signature || ''));
            const expBuf = Buffer.from(expected);
            if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
              res.writeHead(401);
              res.end();
              return;
            }
          }

          let payload: any;
          try {
            payload = JSON.parse(body);
          } catch (err: any) {
            logger.warn('WhatsApp webhook payload parse failed', { error: String(err?.message || err) });
            writeJson(res, 400, {
              success: false,
              error: { code: 'INVALID_PAYLOAD', message: 'Malformed webhook JSON payload' },
            });
            return;
          }

          try {
            await this.handleWebhook(payload);
          } catch (err: any) {
            logger.error('Failed to handle WhatsApp webhook', { error: String(err?.message || err) });
            writeJson(res, 502, {
              success: false,
              error: { code: 'WEBHOOK_PROCESSING_FAILED', message: 'Failed to process webhook event' },
            });
            return;
          }

          writeJson(res, 200, { success: true });
        });

        req.on('error', (err: Error) => {
          logger.warn('WhatsApp webhook request stream error', { error: err.message });
        });
        return;
      }

      // Health
      if (req.method === 'GET' && req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', adapter: 'whatsapp' }));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      this.server.listen(this.port, () => {
        logger.info('WhatsApp adapter listening', { port: this.port });
        resolve();
      });
    });
  }

  private async handleWebhook(payload: any): Promise<void> {
    const entries = payload.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        const messages = value.messages || [];
        const contacts = value.contacts || [];

        for (const msg of messages) {
          const contact = contacts.find((c: any) => c.wa_id === msg.from) || {};
          const displayName = contact.profile?.name;

          if (msg.type === 'text') {
            await this.handleInbound({
              channelUserId: msg.from,
              channelChatId: msg.from, // WhatsApp DM is user-based
              channelMessageId: msg.id,
              displayName,
              chatType: 'dm',
              text: msg.text?.body,
            });
          } else if (msg.type === 'image' || msg.type === 'document' || msg.type === 'video') {
            const media = msg[msg.type];
            const mediaUrl = await this.getMediaUrl(media.id);

            await this.handleInbound({
              channelUserId: msg.from,
              channelChatId: msg.from,
              channelMessageId: msg.id,
              displayName,
              chatType: 'dm',
              text: media.caption,
              fileUrl: mediaUrl,
              fileName: media.filename || `${msg.type}_${media.id}`,
              fileMime: media.mime_type,
            });
          } else if (msg.type === 'audio') {
            const audio = msg.audio;
            const mediaUrl = await this.getMediaUrl(audio.id);

            await this.handleInbound({
              channelUserId: msg.from,
              channelChatId: msg.from,
              channelMessageId: msg.id,
              displayName,
              chatType: 'dm',
              audioUrl: mediaUrl,
            });
          } else if (msg.type === 'interactive') {
            // Handle button replies (approvals)
            const interactive = msg.interactive;
            if (interactive?.type === 'button_reply') {
              const buttonId = interactive.button_reply.id || '';
              const [action, approvalId] = buttonId.split(':');
              if (action && approvalId) {
                await this.gateway.sendMessage('whatsapp', {
                  channel_message_id: msg.id,
                  chat_id: '',
                  sender_identity_id: '',
                  text: `${action} ${approvalId}`,
                  metadata: {
                    is_approval_vote: true,
                    approval_id: approvalId,
                    vote: action,
                    voter_wa_id: msg.from,
                  },
                });
              }
            }
          }
        }
      }
    }
  }

  /** Get a download URL for a WhatsApp media ID */
  private async getMediaUrl(mediaId: string): Promise<string> {
    const safeMediaId = String(mediaId).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeMediaId) return '';
    const res = await fetch(`${WA_API_BASE}/${safeMediaId}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    const data: any = await res.json();
    return data.url || '';
  }

  protected async disconnect(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  // ──── WhatsApp Cloud API call ─────────────────────────────────

  private async waApiSend(to: string, messageBody: any): Promise<void> {
    const res = await fetch(
      `${WA_API_BASE}/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          ...messageBody,
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`WhatsApp API error ${res.status}: ${text}`);
    }
  }

  // ──── Outbound: Text ──────────────────────────────────────────

  protected async sendText(
    channelChatId: string,
    text: string,
    _item: OutboxItem,
  ): Promise<void> {
    // WhatsApp max text length: 4096
    const chunks = splitText(text, 4096);
    for (const chunk of chunks) {
      await this.waApiSend(channelChatId, {
        type: 'text',
        text: { body: chunk },
      });
    }
  }

  // ──── Outbound: File ──────────────────────────────────────────

  protected async sendFile(
    channelChatId: string,
    fileUrl: string,
    caption?: string,
    _item?: OutboxItem,
  ): Promise<void> {
    await this.waApiSend(channelChatId, {
      type: 'document',
      document: {
        link: fileUrl,
        caption: caption || undefined,
      },
    });
  }

  // ──── Outbound: Audio ─────────────────────────────────────────

  protected async sendAudio(
    channelChatId: string,
    audioUrl: string,
    _caption?: string,
    _item?: OutboxItem,
  ): Promise<void> {
    await this.waApiSend(channelChatId, {
      type: 'audio',
      audio: { link: audioUrl },
    });
  }

  // ──── Outbound: Approval Buttons (Interactive) ────────────────

  protected override async sendApprovalButtons(
    channelChatId: string,
    buttons: ApprovalButton[],
    _item: OutboxItem,
  ): Promise<void> {
    // WhatsApp interactive buttons (max 3 buttons)
    const waButtons = buttons.slice(0, 3).map((btn) => ({
      type: 'reply',
      reply: {
        id: `${btn.action}:${btn.approval_id}`,
        title: btn.label.slice(0, 20), // max 20 chars
      },
    }));

    await this.waApiSend(channelChatId, {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: '🗳 Approval Required — please vote:' },
        action: { buttons: waButtons },
      },
    });
  }
}

// ──── Helpers ────────────────────────────────────────────────────────────────

function splitText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen / 2) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  return chunks;
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

// ──── Main ───────────────────────────────────────────────────────────────────

runAdapter(WhatsAppAdapter as any, {
  whatsappToken: process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || '',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET || '',
  whatsappPort: parseInt(process.env.WHATSAPP_PORT || '8443', 10),
});
