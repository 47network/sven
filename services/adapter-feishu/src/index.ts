import http from 'node:http';
import crypto from 'node:crypto';
import {
  BaseAdapter,
  type AdapterConfig,
  type ApprovalButton,
  type CanvasBlock,
  type OutboxItem,
  runAdapter,
  createLogger,
} from '@sven/shared';

const logger = createLogger('adapter-feishu');
const trimSlash = (s: string) => { let i = s.length; while (i > 0 && s[i - 1] === '/') i--; return s.slice(0, i); };
const FEISHU_MAX_WEBHOOK_BYTES = Number(process.env.FEISHU_MAX_WEBHOOK_BYTES || 512 * 1024);

function safeTokenEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

interface FeishuConfig extends AdapterConfig {
  feishuAppId: string;
  feishuAppSecret: string;
  feishuEncryptKey?: string;
  feishuVerifyToken?: string;
  feishuPort: number;
  feishuApiBase?: string;
}

class FeishuWebhookAuthError extends Error {}

class FeishuAdapter extends BaseAdapter {
  private server!: http.Server;
  private appId: string;
  private appSecret: string;
  private encryptKey: string;
  private verifyToken: string;
  private port: number;
  private apiBase: string;

  private tenantAccessToken = '';
  private tenantAccessTokenExpiresAt = 0;

  constructor(config: FeishuConfig) {
    super({ ...config, channel: 'feishu' });
    this.appId = config.feishuAppId || process.env.FEISHU_APP_ID || '';
    this.appSecret = config.feishuAppSecret || process.env.FEISHU_APP_SECRET || '';
    this.encryptKey = config.feishuEncryptKey || process.env.FEISHU_ENCRYPT_KEY || '';
    this.verifyToken = config.feishuVerifyToken || process.env.FEISHU_VERIFY_TOKEN || '';
    this.port = Number(config.feishuPort || process.env.FEISHU_PORT || 8489);
    this.apiBase = trimSlash(config.feishuApiBase || process.env.FEISHU_API_BASE || 'https://open.feishu.cn');
  }

  protected async connect(): Promise<void> {
    if (!this.appId) throw new Error('FEISHU_APP_ID is required');
    if (!this.appSecret) throw new Error('FEISHU_APP_SECRET is required');

    this.server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', adapter: 'feishu' }));
        return;
      }

      if (req.method === 'POST' && req.url === '/webhook') {
        const maxBodyBytes = normalizeMaxBodyBytes(FEISHU_MAX_WEBHOOK_BYTES);
        const contentLength = Number(req.headers['content-length'] || 0);
        if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
          logger.warn('Feishu webhook rejected: content-length over limit', {
            content_length: contentLength,
            max_body_bytes: maxBodyBytes,
          });
          writeJson(res, 413, {
            success: false,
            error: { code: 'PAYLOAD_TOO_LARGE', message: 'Feishu webhook body exceeds limit' },
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
            logger.warn('Feishu webhook rejected: body exceeds max bytes', {
              bytes_received: bytesReceived,
              max_body_bytes: maxBodyBytes,
            });
            writeJson(res, 413, {
              success: false,
              error: { code: 'PAYLOAD_TOO_LARGE', message: 'Feishu webhook body exceeds limit' },
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
            logger.warn('Feishu webhook payload parse failed', { error: String(err) });
            writeJson(res, 400, {
              success: false,
              error: { code: 'INVALID_PAYLOAD', message: 'Malformed webhook JSON payload' },
            });
            return;
          }

          try {
            const result = await this.handleWebhook(payload, body, req.headers);
            writeJson(res, 200, result);
          } catch (err) {
            if (err instanceof FeishuWebhookAuthError) {
              logger.warn('Feishu webhook rejected: invalid auth', { error: err.message });
              writeJson(res, 401, {
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Invalid Feishu webhook auth' },
              });
              return;
            }
            logger.error('Failed to process Feishu webhook', { error: String(err) });
            writeJson(res, 502, {
              success: false,
              error: { code: 'WEBHOOK_PROCESSING_FAILED', message: 'Failed to process webhook event' },
            });
          }
        });
        req.on('error', (err: Error) => {
          logger.warn('Feishu webhook request stream error', { error: err.message });
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      this.server.listen(this.port, () => {
        logger.info('Feishu adapter listening', { port: this.port });
        resolve();
      });
    });
  }

  protected async disconnect(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  protected async sendText(channelChatId: string, text: string, _item: OutboxItem): Promise<void> {
    await this.sendFeishuMessage(channelChatId, { text });
  }

  protected override async sendBlocks(
    channelChatId: string,
    blocks: CanvasBlock[],
    fallbackText?: string,
    item?: OutboxItem,
  ): Promise<void> {
    const lines = blocks.map((block) => canvasBlockToText(block)).filter(Boolean);
    if (lines.length === 0) {
      await this.sendText(channelChatId, fallbackText || this.blocksToText(blocks), item!);
      return;
    }
    await this.sendFeishuPostCard(channelChatId, lines, fallbackText || 'Sven');
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

  private async handleWebhook(payload: any, rawBody: string, headers: http.IncomingHttpHeaders): Promise<Record<string, unknown>> {
    if (this.verifyToken) {
      const token = String(payload?.token || payload?.header?.token || '').trim();
      if (!token || !safeTokenEqual(token, this.verifyToken)) {
        throw new FeishuWebhookAuthError('invalid verify token');
      }
    }

    if (this.encryptKey) {
      const timestamp = String(headers['x-lark-request-timestamp'] || headers['x-feishu-request-timestamp'] || '').trim();
      const nonce = String(headers['x-lark-request-nonce'] || headers['x-feishu-request-nonce'] || '').trim();
      const signature = String(headers['x-lark-signature'] || headers['x-feishu-signature'] || '').trim();
      if (!timestamp || !nonce || !signature) {
        throw new FeishuWebhookAuthError('missing signature headers');
      }

      const expected = crypto
        .createHmac('sha256', this.encryptKey)
        .update(`${timestamp}${nonce}${rawBody}`)
        .digest('base64');
      if (!safeTokenEqual(signature, expected)) {
        throw new FeishuWebhookAuthError('invalid signature');
      }
    }

    // URL verification handshake
    if (payload?.type === 'url_verification' && payload?.challenge) {
      return { challenge: payload.challenge };
    }

    const event = payload?.event || payload;
    const message = event?.message || {};
    const sender = event?.sender || {};
    const chatId = String(message?.chat_id || event?.open_chat_id || '');
    const senderId = String(sender?.sender_id?.open_id || sender?.sender_id?.user_id || event?.open_id || '');
    const messageType = String(message?.message_type || '').toLowerCase();
    const messageId = String(message?.message_id || event?.message_id || Date.now());
    const chatTypeRaw = String(event?.chat?.chat_type || event?.chat_type || 'group').toLowerCase();
    const chatType: 'dm' | 'group' = chatTypeRaw === 'p2p' || chatTypeRaw === 'dm' ? 'dm' : 'group';

    if (!chatId || !senderId) return { code: 0, msg: 'ok' };

    let text = '';
    if (messageType === 'text') {
      const contentRaw = String(message?.content || '{}');
      try {
        const content = JSON.parse(contentRaw);
        text = String(content?.text || '').trim();
      } catch {
        text = contentRaw;
      }
    } else {
      text = describeNonTextMessage(messageType, message?.content);
    }

    await this.handleInbound({
      channelUserId: senderId,
      channelChatId: chatId,
      channelMessageId: messageId,
      displayName: sender?.sender_id?.user_id || senderId,
      chatName: chatId,
      chatType,
      text: text || '[non-text message]',
      metadata: {
        feishu_message_type: messageType || 'unknown',
        feishu_chat_type: chatTypeRaw,
      },
    });

    return { code: 0, msg: 'ok' };
  }

  private async ensureTenantAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tenantAccessToken && now < this.tenantAccessTokenExpiresAt - 30_000) {
      return this.tenantAccessToken;
    }

    const res = await fetch(`${this.apiBase}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: this.appId, app_secret: this.appSecret }),
    });
    const data = await res.json() as any;
    if (!res.ok || data.code !== 0 || !data.tenant_access_token) {
      throw new Error(`Failed to fetch tenant access token: ${JSON.stringify(data)}`);
    }

    this.tenantAccessToken = String(data.tenant_access_token);
    this.tenantAccessTokenExpiresAt = now + Number(data.expire || 7200) * 1000;
    return this.tenantAccessToken;
  }

  private async sendFeishuMessage(chatId: string, content: { text: string }): Promise<void> {
    const token = await this.ensureTenantAccessToken();
    const body = {
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify({ text: content.text }),
    };

    const res = await fetch(`${this.apiBase}/open-apis/im/v1/messages?receive_id_type=chat_id`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.code !== 0) {
      throw new Error(`Feishu send failed: ${JSON.stringify(data)}`);
    }
  }

  private async sendFeishuPostCard(chatId: string, lines: string[], title: string): Promise<void> {
    const token = await this.ensureTenantAccessToken();
    const body = {
      receive_id: chatId,
      msg_type: 'post',
      content: JSON.stringify({
        post: {
          en_us: {
            title,
            content: lines.map((line) => [{ tag: 'text', text: line }]),
          },
        },
      }),
    };

    const res = await fetch(`${this.apiBase}/open-apis/im/v1/messages?receive_id_type=chat_id`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.code !== 0) {
      throw new Error(`Feishu post card send failed: ${JSON.stringify(data)}`);
    }
  }
}

export function canvasBlockToText(block: CanvasBlock): string {
  switch (block.type) {
    case 'markdown':
      return typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
    case 'code': {
      const c = block.content as { language?: string; code?: string };
      return `Code${c.language ? ` (${c.language})` : ''}: ${String(c.code || '').slice(0, 600)}`;
    }
    case 'tool_card': {
      const tc = block.content as { tool_name?: string; status?: string; error?: string };
      return `Tool ${tc.tool_name || 'unknown'} -> ${tc.status || 'unknown'}${tc.error ? ` (${tc.error})` : ''}`;
    }
    case 'link': {
      const lk = block.content as { url?: string; title?: string };
      return lk.title ? `${lk.title}: ${lk.url || ''}` : String(lk.url || '');
    }
    case 'file_preview': {
      const fp = block.content as { name?: string };
      return `File: ${fp.name || 'attachment'}`;
    }
    case 'image':
      return 'Image attachment';
    case 'audio':
      return 'Audio attachment';
    case 'table':
      return 'Table content';
    case 'chart':
      return 'Chart content';
    default:
      return typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
  }
}

export function describeNonTextMessage(messageType: string, content: unknown): string {
  if (!content) return `[${messageType || 'non-text'} message]`;
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    if (messageType === 'file') return `[file] ${String((parsed as any)?.file_name || '')}`.trim();
    if (messageType === 'image') return '[image]';
    if (messageType === 'audio') return '[audio]';
    if (messageType === 'media') return '[media]';
    return `[${messageType}]`;
  } catch {
    return `[${messageType || 'non-text'} message]`;
  }
}

if (process.env.NODE_ENV !== 'test') {
  runAdapter(FeishuAdapter as any, {
    feishuAppId: process.env.FEISHU_APP_ID || '',
    feishuAppSecret: process.env.FEISHU_APP_SECRET || '',
    feishuEncryptKey: process.env.FEISHU_ENCRYPT_KEY || '',
    feishuVerifyToken: process.env.FEISHU_VERIFY_TOKEN || '',
    feishuPort: Number(process.env.FEISHU_PORT || 8489),
    feishuApiBase: process.env.FEISHU_API_BASE || 'https://open.feishu.cn',
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
