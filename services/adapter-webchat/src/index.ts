/**
 * Sven – WebChat Channel Adapter
 *
 * Full-feature reference client: HTTP server + WebSocket for realtime.
 * Serves a built-in chat widget OR works with Canvas UI as input.
 * Supports: text, files, audio, approval buttons via WebSocket events.
 *
 * WebSocket protocol:
 *   Client → Server:
 *     Trusted mode:
 *       Signed token preferred:
 *       { type: 'auth', token: '<b64url(payload).b64url(hmac)>', auth?: { ... } }
 *         payload = { user_id: string, chat_id: string, exp: unix_seconds|unix_ms, nonce: string }
 *       Legacy fallback (opt-in via WEBCHAT_ALLOW_LEGACY_TRUSTED_AUTH=true):
 *       { type: 'auth', token: '<adapter token>', user_id: string, chat_id: string }
 *       { type: 'auth', auth: { token: string, user_id: string, chat_id: string } }
 *       { type: 'auth', auth: { token: '<adapter token>', user_id: string, chat_id: string } }
 *     Widget mode:
 *       { type: 'auth', widget_api_key: string }
 *     { type: 'message', chat_id: string, text: string }
 *     { type: 'file', chat_id: string, file_url: string, file_name: string, file_mime: string }
 *     { type: 'audio', chat_id: string, audio_url: string }
 *     { type: 'vote', approval_id: string, action: 'approve' | 'deny' }
 *
 *   Server → Client:
 *     { type: 'message', chat_id: string, text: string, blocks?: CanvasBlock[], from: 'assistant' }
 *     { type: 'file', chat_id: string, file_url: string }
 *     { type: 'audio', chat_id: string, audio_url: string }
 *     { type: 'approval', chat_id: string, approval_id: string, buttons: ApprovalButton[] }
 *     { type: 'error', message: string }
 */

import http from 'node:http';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import {
  BaseAdapter,
  type AdapterConfig,
  type OutboxItem,
  type ApprovalButton,
  type CanvasBlock,
  runAdapter,
  createLogger,
} from '@sven/shared';

const logger = createLogger('adapter-webchat');

// ──── Types ──────────────────────────────────────────────────────────────────

interface WebChatConfig extends AdapterConfig {
  webchatPort: number;
}

interface AuthenticatedSocket {
  ws: WebSocket;
  userId: string;
  chatId: string; // Active chat
  widgetApiKey?: string;
}

type AuthResult = {
  ok: true;
  userId: string;
  chatId: string;
  widgetApiKey?: string;
} | {
  ok: false;
  message: string;
};

type TrustedAuthClaims = {
  user_id: string;
  chat_id: string;
  exp: number;
  nonce: string;
};

// ──── WebChat Adapter ────────────────────────────────────────────────────────

class WebChatAdapter extends BaseAdapter {
  private server!: http.Server;
  private wss!: WebSocketServer;
  private port: number;
  /** Map channel_chat_id → connected sockets */
  private chatSockets = new Map<string, Set<AuthenticatedSocket>>();
  /** Map ws → authenticated info */
  private socketAuth = new Map<WebSocket, AuthenticatedSocket>();
  /** replay-protection cache for trusted auth nonces */
  private trustedAuthNonceCache = new Map<string, number>();

  constructor(config: WebChatConfig) {
    super({ ...config, channel: 'webchat' });
    this.port = config.webchatPort || parseInt(process.env.WEBCHAT_PORT || '3100', 10);
  }

  protected async connect(): Promise<void> {
    // HTTP server (serves health + static widget)
    this.server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          adapter: 'webchat',
          connections: this.socketAuth.size,
        }));
        return;
      }

      // Serve embedded chat widget HTML
      if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(WIDGET_HTML);
        return;
      }

      // Serve embeddable widget bootstrap script
      if (req.method === 'GET' && req.url?.startsWith('/widget.js')) {
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        res.end(WIDGET_BOOTSTRAP_JS);
        return;
      }

      res.writeHead(404);
      res.end();
    });

    // WebSocket server
    this.wss = new WebSocketServer({ server: this.server, maxPayload: 65_536 });

    this.wss.on('connection', (ws: WebSocket, request: http.IncomingMessage) => {
      const originPolicy = this.validateSocketOrigin(request);
      if (!originPolicy.ok) {
        logger.warn('WebSocket origin rejected', {
          origin: request.headers.origin || null,
          host: request.headers.host || null,
          reason: originPolicy.reason,
        });
        ws.close(1008, originPolicy.reason);
        return;
      }
      logger.debug('WebSocket connected');

      ws.on('message', async (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          await this.handleWsMessage(ws, msg);
        } catch (err: any) {
          this.wsSend(ws, { type: 'error', message: err.message });
        }
      });

      ws.on('close', () => {
        const auth = this.socketAuth.get(ws);
        if (auth) {
          const sockets = this.chatSockets.get(auth.chatId);
          sockets?.delete(auth);
          if (sockets?.size === 0) this.chatSockets.delete(auth.chatId);
          this.socketAuth.delete(ws);
        }
        logger.debug('WebSocket disconnected');
      });
    });

    await new Promise<void>((resolve) => {
      this.server.listen(this.port, () => {
        logger.info('WebChat adapter listening', { port: this.port });
        resolve();
      });
    });
  }

  private async handleWsMessage(ws: WebSocket, msg: any): Promise<void> {
    switch (msg.type) {
      case 'auth': {
        const auth = this.authenticateWebSocketSession(msg);
        if (!auth.ok) {
          this.wsSend(ws, { type: 'error', message: auth.message });
          ws.close(1008, auth.message);
          return;
        }

        // Resolve identity and chat
        const identity = await this.gateway.resolveIdentity(
          'webchat',
          auth.userId,
          msg.display_name || auth.userId,
        );
        const chat = await this.gateway.resolveChat(
          'webchat',
          auth.chatId,
          msg.chat_name || 'WebChat',
          'dm',
        );
        await this.gateway.ensureMembership(chat.chat_id, identity.user_id);

        const authSocket: AuthenticatedSocket = {
          ws,
          userId: identity.user_id,
          chatId: chat.chat_id,
          widgetApiKey: auth.widgetApiKey,
        };

        this.socketAuth.set(ws, authSocket);

        // Track by channel_chat_id (which is the chat_id in this case)
        if (!this.chatSockets.has(auth.chatId)) {
          this.chatSockets.set(auth.chatId, new Set());
        }
        this.chatSockets.get(auth.chatId)!.add(authSocket);

        this.wsSend(ws, {
          type: 'auth_ok',
          user_id: identity.user_id,
          identity_id: identity.identity_id,
          chat_id: chat.chat_id,
        });
        break;
      }

      case 'message': {
        const auth = this.socketAuth.get(ws);
        if (!auth) {
          this.wsSend(ws, { type: 'error', message: 'Not authenticated' });
          return;
        }
        const text = String(msg.text || '').slice(0, 8000);
        if (!text) {
          this.wsSend(ws, { type: 'error', message: 'text is required' });
          return;
        }

        await this.gateway.sendMessage('webchat', {
          channel_message_id: `wc_${Date.now()}`,
          chat_id: auth.chatId,
          sender_identity_id: auth.userId,
          text,
          metadata: auth.widgetApiKey ? { widget_instance_key: auth.widgetApiKey } : undefined,
        });
        break;
      }

      case 'file': {
        const auth = this.socketAuth.get(ws);
        if (!auth) return;
        const fileUrl = String(msg.file_url || '').slice(0, 2048);
        const fileName = String(msg.file_name || '').slice(0, 255);
        const fileMime = String(msg.file_mime || '').slice(0, 127);
        if (!fileUrl) {
          this.wsSend(ws, { type: 'error', message: 'file_url is required' });
          return;
        }

        await this.gateway.sendFile('webchat', {
          channel_message_id: `wc_${Date.now()}`,
          chat_id: auth.chatId,
          sender_identity_id: auth.userId,
          file_url: fileUrl,
          file_name: fileName,
          file_mime: fileMime,
          metadata: auth.widgetApiKey ? { widget_instance_key: auth.widgetApiKey } : undefined,
        });
        break;
      }

      case 'audio': {
        const auth = this.socketAuth.get(ws);
        if (!auth) return;
        const audioUrl = String(msg.audio_url || '').slice(0, 2048);
        if (!audioUrl) {
          this.wsSend(ws, { type: 'error', message: 'audio_url is required' });
          return;
        }

        await this.gateway.sendAudio('webchat', {
          channel_message_id: `wc_${Date.now()}`,
          chat_id: auth.chatId,
          sender_identity_id: auth.userId,
          audio_url: audioUrl,
          metadata: auth.widgetApiKey ? { widget_instance_key: auth.widgetApiKey } : undefined,
        });
        break;
      }

      case 'vote': {
        const auth = this.socketAuth.get(ws);
        if (!auth) return;

        await this.gateway.sendMessage('webchat', {
          channel_message_id: `wc_vote_${Date.now()}`,
          chat_id: auth.chatId,
          sender_identity_id: auth.userId,
          text: `${msg.action} ${msg.approval_id}`,
          metadata: {
            is_approval_vote: true,
            approval_id: msg.approval_id,
            vote: msg.action,
          },
        });
        break;
      }
    }
  }

  private parseOriginAllowlist(raw: string): string[] {
    return raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  }

  private isOriginAllowlisted(origin: string, allowlist: string[]): boolean {
    if (allowlist.length === 0) return false;
    const normalized = origin.toLowerCase();
    return allowlist.some((entry) => {
      if (entry === normalized) return true;
      if (entry.startsWith('*.')) {
        const suffix = entry.slice(1);
        return normalized.endsWith(suffix);
      }
      return false;
    });
  }

  private validateSocketOrigin(request: http.IncomingMessage): { ok: true } | { ok: false; reason: string } {
    const origin = String(request.headers.origin || '').trim();
    if (!origin) {
      return { ok: false, reason: 'Missing Origin header' };
    }

    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      return { ok: false, reason: 'Invalid Origin header' };
    }
    if (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:') {
      return { ok: false, reason: 'Unsupported Origin scheme' };
    }

    const allowlist = this.parseOriginAllowlist(String(process.env.WEBCHAT_ALLOWED_ORIGINS || ''));
    if (allowlist.length > 0) {
      if (!this.isOriginAllowlisted(origin, allowlist)) {
        return { ok: false, reason: 'Origin not allowlisted' };
      }
      return { ok: true };
    }

    const hostHeader = String(request.headers.host || '').trim().toLowerCase();
    const hostOnly = hostHeader.split(':')[0];
    if (!hostOnly) {
      return { ok: false, reason: 'Missing Host header' };
    }
    if (parsedOrigin.hostname.toLowerCase() !== hostOnly) {
      return { ok: false, reason: 'Origin host does not match Host header' };
    }
    return { ok: true };
  }

  private authenticateWebSocketSession(msg: any): AuthResult {
    const authToken = String(msg?.token || msg?.auth?.token || '').trim();
    const widgetApiKey = String(msg?.widget_api_key || '').trim();

    // Trusted mode:
    //  - Preferred: signed short-lived token claims (user/chat/exp/nonce)
    //  - Legacy fallback (explicit opt-in): adapter token + caller-supplied user_id/chat_id
    if (authToken) {
      const trustedSecret = String(process.env.WEBCHAT_SIGNED_AUTH_SECRET || '').trim();
      const claims = trustedSecret ? this.verifyTrustedAuthToken(authToken, trustedSecret) : null;
      if (claims) {
        return {
          ok: true,
          userId: claims.user_id,
          chatId: claims.chat_id,
          widgetApiKey: widgetApiKey || undefined,
        };
      }

      const allowLegacyTrusted = this.isTruthy(process.env.WEBCHAT_ALLOW_LEGACY_TRUSTED_AUTH);
      if (!allowLegacyTrusted || authToken !== this.config.adapterToken) {
        return { ok: false, message: 'Invalid auth token' };
      }

      const userId = String(msg?.user_id || msg?.auth?.user_id || '').trim();
      const chatId = String(msg?.chat_id || msg?.auth?.chat_id || '').trim();
      if (!userId || !chatId) {
        return { ok: false, message: 'Trusted auth requires user_id and chat_id' };
      }
      return { ok: true, userId, chatId, widgetApiKey: widgetApiKey || undefined };
    }

    // Public widget mode: require widget key and derive immutable ids server-side.
    if (!widgetApiKey) {
      return { ok: false, message: 'Authentication required (token or widget_api_key)' };
    }
    const widgetHash = createHash('sha256').update(widgetApiKey).digest('hex').slice(0, 24);
    return {
      ok: true,
      userId: `webchat_widget_user_${widgetHash}`,
      chatId: `webchat_widget_chat_${widgetHash}`,
      widgetApiKey,
    };
  }

  private verifyTrustedAuthToken(token: string, secret: string): TrustedAuthClaims | null {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, signatureB64] = parts;
    if (!payloadB64 || !signatureB64) return null;

    const expectedSig = this.toBase64Url(createHmac('sha256', secret).update(payloadB64).digest());
    if (!this.safeEqualString(signatureB64, expectedSig)) return null;

    let payloadRaw = '';
    try {
      payloadRaw = Buffer.from(payloadB64, 'base64url').toString('utf8');
    } catch {
      return null;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(payloadRaw);
    } catch {
      return null;
    }
    const userId = String(parsed?.user_id || '').trim();
    const chatId = String(parsed?.chat_id || '').trim();
    const nonce = String(parsed?.nonce || '').trim();
    const expRaw = Number(parsed?.exp || 0);
    if (!userId || !chatId || !nonce || !Number.isFinite(expRaw)) return null;
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(nonce)) return null;

    // Accept exp in either Unix seconds or milliseconds.
    const expMs = expRaw < 1_000_000_000_000 ? Math.floor(expRaw * 1000) : Math.floor(expRaw);
    if (Date.now() >= expMs) return null;
    if (!this.markTrustedAuthNonceOnce(nonce, expMs)) return null;

    return {
      user_id: userId,
      chat_id: chatId,
      exp: expMs,
      nonce,
    };
  }

  private markTrustedAuthNonceOnce(nonce: string, expMs: number): boolean {
    const now = Date.now();
    for (const [cachedNonce, cachedExp] of this.trustedAuthNonceCache.entries()) {
      if (cachedExp <= now) {
        this.trustedAuthNonceCache.delete(cachedNonce);
      }
    }
    if (this.trustedAuthNonceCache.has(nonce)) {
      return false;
    }
    this.trustedAuthNonceCache.set(nonce, expMs);
    return true;
  }

  private toBase64Url(buffer: Buffer): string {
    return buffer.toString('base64url');
  }

  private safeEqualString(a: string, b: string): boolean {
    const aBytes = Buffer.from(a, 'utf8');
    const bBytes = Buffer.from(b, 'utf8');
    if (aBytes.length !== bBytes.length) return false;
    return timingSafeEqual(aBytes, bBytes);
  }

  private isTruthy(value: string | undefined): boolean {
    if (!value) return false;
    const normalized = String(value).trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
  }

  private wsSend(ws: WebSocket, data: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /** Broadcast to all sockets in a chat */
  private broadcast(channelChatId: string, data: any): void {
    const sockets = this.chatSockets.get(channelChatId);
    if (!sockets) return;
    const payload = JSON.stringify(data);
    for (const { ws } of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  protected async disconnect(): Promise<void> {
    this.wss.close();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  // ──── Outbound: Text ──────────────────────────────────────────

  protected async sendText(
    channelChatId: string,
    text: string,
    item: OutboxItem,
  ): Promise<void> {
    this.broadcast(channelChatId, {
      type: 'message',
      chat_id: item.chat_id,
      text,
      from: 'assistant',
    });
  }

  // ──── Outbound: Blocks ────────────────────────────────────────

  protected override async sendBlocks(
    channelChatId: string,
    blocks: CanvasBlock[],
    fallbackText?: string,
    item?: OutboxItem,
  ): Promise<void> {
    this.broadcast(channelChatId, {
      type: 'message',
      chat_id: item?.chat_id,
      text: fallbackText || this.blocksToText(blocks),
      blocks,
      from: 'assistant',
    });
  }

  // ──── Outbound: File ──────────────────────────────────────────

  protected async sendFile(
    channelChatId: string,
    fileUrl: string,
    caption?: string,
    item?: OutboxItem,
  ): Promise<void> {
    this.broadcast(channelChatId, {
      type: 'file',
      chat_id: item?.chat_id,
      file_url: fileUrl,
      caption,
      from: 'assistant',
    });
  }

  // ──── Outbound: Audio ─────────────────────────────────────────

  protected async sendAudio(
    channelChatId: string,
    audioUrl: string,
    caption?: string,
    item?: OutboxItem,
  ): Promise<void> {
    this.broadcast(channelChatId, {
      type: 'audio',
      chat_id: item?.chat_id,
      audio_url: audioUrl,
      caption,
      from: 'assistant',
    });
  }

  // ──── Outbound: Approval Buttons ──────────────────────────────

  protected override async sendApprovalButtons(
    channelChatId: string,
    buttons: ApprovalButton[],
    item: OutboxItem,
  ): Promise<void> {
    this.broadcast(channelChatId, {
      type: 'approval',
      chat_id: item.chat_id,
      buttons,
    });
  }
}

// ──── Embedded Chat Widget HTML ──────────────────────────────────────────────

const WIDGET_BOOTSTRAP_JS = `(function () {
  const script = document.currentScript;
  const cfg = Object.assign(
    {
      endpoint: '',
      apiKey: '',
      title: 'Sven',
      position: 'bottom-right',
      primaryColor: '#2563eb',
      backgroundColor: '#0f172a',
      avatarUrl: '',
      welcomeText: 'Hi, how can I help?'
    },
    (window).SvenWidgetConfig || {}
  );
  if (script) {
    const d = script.dataset || {};
    if (d.endpoint) cfg.endpoint = d.endpoint;
    if (d.apiKey) cfg.apiKey = d.apiKey;
    if (d.title) cfg.title = d.title;
    if (d.position) cfg.position = d.position;
    if (d.primaryColor) cfg.primaryColor = d.primaryColor;
    if (d.backgroundColor) cfg.backgroundColor = d.backgroundColor;
    if (d.avatarUrl) cfg.avatarUrl = d.avatarUrl;
    if (d.welcomeText) cfg.welcomeText = d.welcomeText;
  }
  if (!cfg.endpoint || !cfg.apiKey) return;

  const endpoint = String(cfg.endpoint).replace(/\\/+$/, '');
  const sidKey = 'sven_widget_session_' + cfg.apiKey.slice(-8);
  let session = null;
  try {
    session = JSON.parse(localStorage.getItem(sidKey) || 'null');
  } catch {}
  if (!session || !session.user_id || !session.chat_id) {
    const rnd = Math.random().toString(36).slice(2, 10);
    session = {
      user_id: 'widget_user_' + rnd,
      chat_id: 'widget_chat_' + rnd
    };
    try { localStorage.setItem(sidKey, JSON.stringify(session)); } catch {}
  }

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.zIndex = '2147483000';
  container.style.bottom = '20px';
  if (cfg.position === 'bottom-left') container.style.left = '20px';
  else container.style.right = '20px';
  container.style.width = 'min(380px, calc(100vw - 32px))';
  container.style.maxWidth = '100vw';
  container.style.fontFamily = '"Segoe UI", system-ui, sans-serif';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = cfg.title || 'Sven';
  button.style.width = '100%';
  button.style.border = '0';
  button.style.borderRadius = '999px';
  button.style.padding = '12px 16px';
  button.style.cursor = 'pointer';
  button.style.fontWeight = '600';
  button.style.color = '#fff';
  button.style.background = cfg.primaryColor;
  button.style.boxShadow = '0 8px 28px rgba(0,0,0,0.24)';

  const panel = document.createElement('div');
  panel.style.marginTop = '10px';
  panel.style.width = '100%';
  panel.style.height = 'min(640px, calc(100vh - 110px))';
  panel.style.borderRadius = '14px';
  panel.style.overflow = 'hidden';
  panel.style.boxShadow = '0 14px 48px rgba(0,0,0,0.34)';
  panel.style.display = 'none';
  panel.style.background = cfg.backgroundColor;

  const iframe = document.createElement('iframe');
  iframe.title = cfg.title || 'Sven';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = '0';
  const q = new URLSearchParams({
    user_id: session.user_id,
    chat_id: session.chat_id,
    display_name: cfg.title || 'Visitor',
    widget_api_key: cfg.apiKey,
    title: cfg.title || 'Sven',
    primary_color: cfg.primaryColor || '#2563eb',
    background_color: cfg.backgroundColor || '#0f172a',
    avatar_url: cfg.avatarUrl || '',
    welcome_text: cfg.welcomeText || 'Hi, how can I help?'
  });
  iframe.src = endpoint + '/?' + q.toString();
  panel.appendChild(iframe);

  button.addEventListener('click', function () {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  container.appendChild(button);
  container.appendChild(panel);
  document.body.appendChild(container);
})();`;

const WIDGET_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Sven WebChat</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--sven-bg);color:#e2e8f0;height:100vh;display:flex;flex-direction:column}
#header{background:#1e293b;padding:12px 16px;border-bottom:1px solid #334155;display:flex;align-items:center;gap:8px}
#header h1{font-size:16px;font-weight:600}
#header .dot{width:8px;height:8px;border-radius:50%;background:#22c55e}
#messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}
.msg{max-width:80%;padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.5;word-wrap:break-word;white-space:pre-wrap}
.msg.user{align-self:flex-end;background:var(--sven-accent);color:#fff;border-bottom-right-radius:4px}
.msg.assistant{align-self:flex-start;background:#1e293b;border:1px solid #334155;border-bottom-left-radius:4px}
.msg .meta{font-size:11px;opacity:0.6;margin-top:4px}
.approval-btns{display:flex;gap:8px;margin-top:8px}
.approval-btns button{padding:6px 14px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500}
.approval-btns .approve{background:#22c55e;color:#fff}
.approval-btns .deny{background:#ef4444;color:#fff}
#compose{background:#1e293b;padding:12px 16px;border-top:1px solid #334155;display:flex;gap:8px}
#compose input{flex:1;padding:10px 14px;border:1px solid #334155;border-radius:8px;background:#0f172a;color:#e2e8f0;font-size:14px;outline:none}
#compose input:focus{border-color:var(--sven-accent)}
#compose button{padding:10px 20px;background:var(--sven-accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:500;font-size:14px}
#compose button:hover{background:#2563eb}
#status{font-size:12px;color:#94a3b8;padding:4px 16px;text-align:center}
:root{
  --sven-accent:#3b82f6;
  --sven-bg:#0f172a;
}
</style>
</head>
<body>
<div id="header"><div class="dot" id="statusDot"></div><h1 id="title">Sven</h1></div>
<div id="status" id="statusText">Connecting…</div>
<div id="messages"></div>
<div id="compose">
<input type="text" id="input" placeholder="Type a message…" autocomplete="off"/>
<button onclick="send()">Send</button>
</div>
<script>
const messagesEl=document.getElementById('messages');
const inputEl=document.getElementById('input');
const statusEl=document.getElementById('status');
const dotEl=document.getElementById('statusDot');
const titleEl=document.getElementById('title');
const params=new URLSearchParams(location.search);
const userId=params.get('user_id')||'webchat_user';
const chatId=params.get('chat_id')||('webchat_'+userId);
const displayName=params.get('display_name')||'WebChat User';
const widgetApiKey=params.get('widget_api_key')||'';
const title=params.get('title')||'Sven';
const accent=params.get('primary_color')||'#3b82f6';
const bg=params.get('background_color')||'#0f172a';
const welcomeText=params.get('welcome_text')||'';
titleEl.textContent=title;
document.documentElement.style.setProperty('--sven-accent',accent);
document.documentElement.style.setProperty('--sven-bg',bg);
if(welcomeText){
  const welcome=document.createElement('div');
  welcome.className='msg assistant';
  welcome.textContent=welcomeText;
  messagesEl.appendChild(welcome);
}
let ws;

function connect(){
  const proto=location.protocol==='https:'?'wss:':'ws:';
  ws=new WebSocket(proto+'//'+location.host);
  ws.onopen=()=>{
    statusEl.textContent='Connected';
    dotEl.style.background='#22c55e';
    ws.send(JSON.stringify({type:'auth',user_id:userId,chat_id:chatId,display_name:displayName,widget_api_key:widgetApiKey}));
  };
  ws.onmessage=(e)=>{
    const msg=JSON.parse(e.data);
    if(msg.type==='auth_ok'){statusEl.textContent='Ready';return;}
    if(msg.type==='message'){addMessage(msg.text,'assistant');return;}
    if(msg.type==='file'){addMessage('📎 '+msg.file_url,'assistant');return;}
    if(msg.type==='audio'){addMessage('🎵 Audio message','assistant');return;}
    if(msg.type==='approval'){
      const div=document.createElement('div');div.className='msg assistant';
      const heading=document.createTextNode('🗳 Approval Required');
      div.appendChild(heading);
      const btnContainer=document.createElement('div');btnContainer.className='approval-btns';
      (msg.buttons||[]).forEach(b=>{
        const btn=document.createElement('button');
        btn.className=String(b.action||'').replace(/[^a-zA-Z0-9_-]/g,'');
        btn.textContent=b.label||'';
        btn.addEventListener('click',()=>vote(b.approval_id,b.action));
        btnContainer.appendChild(btn);
      });
      div.appendChild(btnContainer);
      messagesEl.appendChild(div);messagesEl.scrollTop=messagesEl.scrollHeight;
      return;
    }
    if(msg.type==='error'){statusEl.textContent='Error: '+msg.message;return;}
  };
  ws.onclose=()=>{
    statusEl.textContent='Disconnected. Reconnecting…';
    dotEl.style.background='#ef4444';
    setTimeout(connect,3000);
  };
}

function addMessage(text,role){
  const div=document.createElement('div');
  div.className='msg '+role;
  div.textContent=text;
  const meta=document.createElement('div');
  meta.className='meta';
  meta.textContent=new Date().toLocaleTimeString();
  div.appendChild(meta);
  messagesEl.appendChild(div);
  messagesEl.scrollTop=messagesEl.scrollHeight;
}

function send(){
  const text=inputEl.value.trim();
  if(!text||!ws||ws.readyState!==1)return;
  ws.send(JSON.stringify({type:'message',text}));
  addMessage(text,'user');
  inputEl.value='';
}

function vote(approvalId,action){
  if(!ws||ws.readyState!==1)return;
  ws.send(JSON.stringify({type:'vote',approval_id:approvalId,action}));
}

inputEl.addEventListener('keydown',(e)=>{if(e.key==='Enter')send();});
connect();
</script>
</body>
</html>`;

// ──── Main ───────────────────────────────────────────────────────────────────

runAdapter(WebChatAdapter as any, {
  webchatPort: parseInt(process.env.WEBCHAT_PORT || '3100', 10),
});
