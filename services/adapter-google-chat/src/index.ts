/**
 * Sven – Google Chat Channel Adapter
 *
 * Uses Google Chat API (Pub/Sub or HTTP endpoint mode).
 * Receives events via HTTP endpoint → forwards to Sven gateway.
 * Polls outbox and delivers replies with Google Chat cards/actions.
 */

import http from 'node:http';
import { google } from 'googleapis';
import {
  BaseAdapter,
  type AdapterConfig,
  type OutboxItem,
  type ApprovalButton,
  type CanvasBlock,
  runAdapter,
  createLogger,
} from '@sven/shared';

const logger = createLogger('adapter-google-chat');
const GOOGLE_CHAT_MAX_WEBHOOK_BYTES = Number(process.env.GOOGLE_CHAT_MAX_WEBHOOK_BYTES || 512 * 1024);

// ──── Google Chat Adapter ────────────────────────────────────────────────────

interface GoogleChatConfig extends AdapterConfig {
  googleServiceAccountKey: string;
  googleChatPort: number;
  googleProjectId: string;
  googleChatVerificationToken: string;
}

class GoogleChatAdapter extends BaseAdapter {
  private server!: http.Server;
  private chatApi: any;
  private googleChatPort: number;
  private googleProjectId: string;
  private googleServiceAccountKey: string;
  private googleChatVerificationToken: string;

  constructor(config: GoogleChatConfig) {
    super({ ...config, channel: 'google_chat' });
    this.googleChatPort = config.googleChatPort || parseInt(process.env.GOOGLE_CHAT_PORT || '8080', 10);
    this.googleProjectId = config.googleProjectId || process.env.GOOGLE_PROJECT_ID || '';
    this.googleServiceAccountKey = config.googleServiceAccountKey || process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
    this.googleChatVerificationToken = String(
      config.googleChatVerificationToken || process.env.GOOGLE_CHAT_VERIFICATION_TOKEN || '',
    ).trim();
  }

  protected async connect(): Promise<void> {
    if (!this.googleChatVerificationToken) {
      logger.error(
        'Google Chat verification token is not configured; inbound webhook requests will be rejected',
      );
    }

    // Initialize Google Chat API client
    let auth: any;
    if (this.googleServiceAccountKey) {
      try {
        const key = JSON.parse(this.googleServiceAccountKey);
        auth = new google.auth.GoogleAuth({
          credentials: key,
          scopes: ['https://www.googleapis.com/auth/chat.bot'],
        });
      } catch {
        auth = new google.auth.GoogleAuth({
          keyFile: this.googleServiceAccountKey,
          scopes: ['https://www.googleapis.com/auth/chat.bot'],
        });
      }
    } else {
      // Application default credentials
      auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/chat.bot'],
      });
    }

    this.chatApi = google.chat({ version: 'v1', auth });

    // HTTP endpoint for Google Chat events
    this.server = http.createServer(async (req, res) => {
      if (req.method === 'POST' && req.url === '/') {
        const maxBodyBytes = normalizeMaxBodyBytes(GOOGLE_CHAT_MAX_WEBHOOK_BYTES);
        const contentLength = Number(req.headers['content-length'] || 0);
        if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
          logger.warn('Google Chat webhook rejected: content-length over limit', {
            content_length: contentLength,
            max_body_bytes: maxBodyBytes,
          });
          writeJson(res, 413, {
            success: false,
            error: { code: 'PAYLOAD_TOO_LARGE', message: 'Google Chat webhook body exceeds limit' },
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
            logger.warn('Google Chat webhook rejected: body exceeds max bytes', {
              bytes_received: bytesReceived,
              max_body_bytes: maxBodyBytes,
            });
            writeJson(res, 413, {
              success: false,
              error: { code: 'PAYLOAD_TOO_LARGE', message: 'Google Chat webhook body exceeds limit' },
            });
            req.destroy();
            return;
          }
          body += chunk.toString();
        });
        req.on('end', async () => {
          if (bodyTooLarge) return;
          let event: any;
          try {
            event = JSON.parse(body);
          } catch (err: any) {
            logger.warn('Google Chat webhook payload parse failed', { error: String(err?.message || err) });
            writeJson(res, 400, {
              success: false,
              error: { code: 'INVALID_PAYLOAD', message: 'Malformed webhook JSON payload' },
            });
            return;
          }

          if (!this.isAuthorizedGoogleChatRequest(req, event)) {
            logger.warn('Google Chat webhook rejected: invalid verification token');
            writeJson(res, 401, {
              success: false,
              error: { code: 'UNAUTHORIZED', message: 'Invalid Google Chat verification token' },
            });
            return;
          }

          try {
            await this.handleEvent(event);
          } catch (err: any) {
            logger.error('Failed to handle Google Chat event', { error: String(err?.message || err) });
            writeJson(res, 502, {
              success: false,
              error: { code: 'WEBHOOK_PROCESSING_FAILED', message: 'Failed to process webhook event' },
            });
            return;
          }

          writeJson(res, 200, {});
        });
        req.on('error', (err: Error) => {
          logger.warn('Google Chat webhook request stream error', { error: err.message });
        });
      } else if (req.method === 'GET' && req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', adapter: 'google_chat' }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      this.server.listen(this.googleChatPort, () => {
        logger.info('Google Chat adapter listening', { port: this.googleChatPort });
        resolve();
      });
    });
  }

  private isAuthorizedGoogleChatRequest(req: http.IncomingMessage, event: any): boolean {
    const expected = this.googleChatVerificationToken;
    if (!expected) {
      return false;
    }

    const authHeaderRaw = String(req.headers.authorization || '').trim();
    if (authHeaderRaw && !/^Bearer\s+\S+$/i.test(authHeaderRaw)) {
      return false;
    }
    const authBearer = authHeaderRaw.toLowerCase().startsWith('bearer ')
      ? authHeaderRaw.slice(7).trim()
      : '';
    const headerToken = String(req.headers['x-goog-chat-token'] || '').trim();
    const payloadToken = String(event?.token || '').trim();

    return (
      (authBearer.length > 0 && authBearer === expected) ||
      (headerToken.length > 0 && headerToken === expected) ||
      (payloadToken.length > 0 && payloadToken === expected)
    );
  }

  private async handleEvent(event: any): Promise<void> {
    const type = event.type;

    if (type === 'MESSAGE') {
      const msg = event.message;
      const sender = event.user || msg.sender;
      const space = event.space;
      const isDM = space?.type === 'DM';

      // Extract text, removing @mentions
      let text = msg.argumentText || msg.text || '';
      text = text.trim();

      // Handle attachments
      const attachment = msg.attachment?.[0];
      const fileUrl = attachment?.downloadUri;
      const fileName = attachment?.name;
      const fileMime = attachment?.contentType;

      await this.handleInbound({
        channelUserId: sender?.name || sender?.displayName || 'unknown',
        channelChatId: space?.name || '',
        channelMessageId: msg.name || Date.now().toString(),
        displayName: sender?.displayName,
        chatName: isDM ? `DM` : (space?.displayName || 'Google Chat Space'),
        chatType: isDM ? 'dm' : 'group',
        text: text || undefined,
        fileUrl,
        fileName,
        fileMime,
        metadata: {
          space_type: space?.type,
          thread_name: msg.thread?.name,
        },
      });
    } else if (type === 'CARD_CLICKED') {
      // Handle card action clicks (approval buttons)
      const action = event.action;
      const params = action?.actionMethodName;
      const values = action?.parameters?.reduce(
        (acc: any, p: any) => ({ ...acc, [p.key]: p.value }),
        {},
      ) || {};

      if (params === 'approval_vote' && values.action && values.approval_id) {
        try {
          await this.gateway.sendMessage('google_chat', {
            channel_message_id: event.eventTime || Date.now().toString(),
            chat_id: '',
            sender_identity_id: '',
            text: `${values.action} ${values.approval_id}`,
            metadata: {
              is_approval_vote: true,
              approval_id: values.approval_id,
              vote: values.action,
              voter_google_id: event.user?.name,
            },
          });
        } catch (err: any) {
          logger.error('Failed to process approval vote', { error: err.message });
        }
      }
    }
  }

  protected async disconnect(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  // ──── Outbound: Text ──────────────────────────────────────────

  protected async sendText(
    channelChatId: string,
    text: string,
    _item: OutboxItem,
  ): Promise<void> {
    await this.chatApi.spaces.messages.create({
      parent: channelChatId,
      requestBody: { text },
    });
  }

  // ──── Outbound: Blocks → Google Chat Cards ────────────────────

  protected override async sendBlocks(
    channelChatId: string,
    blocks: CanvasBlock[],
    fallbackText?: string,
    item?: OutboxItem,
  ): Promise<void> {
    const sections = blocks.map((b) => canvasBlockToSection(b)).filter(Boolean);

    if (sections.length === 0) {
      await this.sendText(channelChatId, fallbackText || this.blocksToText(blocks), item!);
      return;
    }

    await this.chatApi.spaces.messages.create({
      parent: channelChatId,
      requestBody: {
        text: fallbackText || '',
        cardsV2: [{
          cardId: `sven-${Date.now()}`,
          card: {
            header: { title: 'Sven', imageUrl: '', imageType: 'CIRCLE' },
            sections,
          },
        }],
      },
    });
  }

  // ──── Outbound: File ──────────────────────────────────────────

  protected async sendFile(
    channelChatId: string,
    fileUrl: string,
    caption?: string,
    item?: OutboxItem,
  ): Promise<void> {
    await this.sendText(channelChatId, `${caption ? caption + '\n' : ''}📎 ${fileUrl}`, item!);
  }

  // ──── Outbound: Audio ─────────────────────────────────────────

  protected async sendAudio(
    channelChatId: string,
    audioUrl: string,
    caption?: string,
    item?: OutboxItem,
  ): Promise<void> {
    await this.sendText(channelChatId, `${caption ? caption + '\n' : ''}🎵 ${audioUrl}`, item!);
  }

  // ──── Outbound: Approval Buttons (Google Chat Cards) ──────────

  protected override async sendApprovalButtons(
    channelChatId: string,
    buttons: ApprovalButton[],
    _item: OutboxItem,
  ): Promise<void> {
    const buttonWidgets = buttons.map((btn) => ({
      buttonList: {
        buttons: [{
          text: btn.label,
          onClick: {
            action: {
              actionMethodName: 'approval_vote',
              parameters: [
                { key: 'action', value: btn.action },
                { key: 'approval_id', value: btn.approval_id },
              ],
            },
          },
          color: btn.action === 'approve'
            ? { red: 0.2, green: 0.7, blue: 0.3, alpha: 1 }
            : { red: 0.8, green: 0.2, blue: 0.2, alpha: 1 },
        }],
      },
    }));

    await this.chatApi.spaces.messages.create({
      parent: channelChatId,
      requestBody: {
        cardsV2: [{
          cardId: `approval-${Date.now()}`,
          card: {
            header: { title: '🗳 Approval Required' },
            sections: [{ widgets: buttonWidgets }],
          },
        }],
      },
    });
  }
}

// ──── Helpers ────────────────────────────────────────────────────────────────

function canvasBlockToSection(block: CanvasBlock): any | null {
  switch (block.type) {
    case 'markdown': {
      const text = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
      return { widgets: [{ textParagraph: { text } }] };
    }
    case 'code': {
      const c = block.content as { language?: string; code?: string };
      return {
        header: c.language || 'Code',
        widgets: [{ textParagraph: { text: `<pre>${c.code || ''}</pre>` } }],
      };
    }
    case 'tool_card': {
      const tc = block.content as { tool_name?: string; status?: string };
      return {
        widgets: [{
          decoratedText: {
            topLabel: 'Tool',
            text: `🔧 ${tc.tool_name || 'Unknown'} → ${tc.status || ''}`,
          },
        }],
      };
    }
    default:
      return null;
  }
}

// ──── Main ───────────────────────────────────────────────────────────────────

runAdapter(GoogleChatAdapter as any, {
  googleServiceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '',
  googleChatPort: parseInt(process.env.GOOGLE_CHAT_PORT || '8080', 10),
  googleProjectId: process.env.GOOGLE_PROJECT_ID || '',
  googleChatVerificationToken: process.env.GOOGLE_CHAT_VERIFICATION_TOKEN || '',
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
