/**
 * Sven – WhatsApp Personal Adapter (Multi-Session)
 *
 * Manages multiple personal WhatsApp accounts via Baileys.
 * Each Sven user links their own WhatsApp by scanning a QR code once.
 * Sessions are persisted to disk keyed by Sven user ID.
 *
 * HTTP management server (port 8444):
 *   GET  /status              — all sessions summary
 *   GET  /status/:userId      — single session status
 *   GET  /qr/:userId          — HTML QR page for that user
 *   POST /sessions            — { userId } — add a new session
 *   DELETE /sessions/:userId  — stop & wipe a session
 *
 * Env vars:
 *   WHATSAPP_SESSIONS_DIR     — session storage root (default /data/whatsapp-sessions)
 *   WHATSAPP_QR_PORT          — HTTP server port (default 8444)
 *   WHATSAPP_SESSION_USERS    — comma-separated userId list to auto-start on boot
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  BaseAdapter,
  type AdapterConfig,
  type OutboxItem,
  runAdapter,
  createLogger,
} from '@sven/shared';

// Baileys and qrcode are CommonJS — import via createRequire in ESM context
const _require = createRequire(import.meta.url);
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidDecode,
} = _require('@whiskeysockets/baileys') as Record<string, any>;
const qrcode = _require('qrcode') as { toDataURL: (text: string, opts?: object) => Promise<string> };

const logger = createLogger('adapter-whatsapp-personal');

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const SESSIONS_DIR = process.env.WHATSAPP_SESSIONS_DIR || '/data/whatsapp-sessions';
const MGMT_PORT = parseInt(process.env.WHATSAPP_QR_PORT || '8444', 10);
const RECONNECT_DELAY_MS = 5_000;
const MAX_RECONNECT_DELAY_MS = 120_000;
const MAX_RECONNECT_ATTEMPTS = 10;
/** How often to check if the Baileys WebSocket is truly alive (ms). */
const KEEPALIVE_INTERVAL_MS = 60_000;
/** If no message activity in this window, proactively restart the socket (ms). */
const STALE_CONNECTION_MS = 10 * 60_000;
/** Connection must stay open this long before we consider it "stable" and reset attempt counter. */
const STABLE_CONNECTION_MS = 30_000;

// ── Per-session class ─────────────────────────────────────────────────────────

class WhatsAppSession {
  readonly userId: string;
  readonly sessionDir: string;

  sock: any | null = null;
  isConnected = false;
  latestQr: string | null = null;
  /** Cached own phone number from sock.user.id — persists across reconnects. */
  cachedOwnPhone: string = '';
  /** Cached own LID (Linked Identity) from sock.user.lid — used for mention detection. */
  cachedOwnLid: string = '';

  private reconnectAttempts = 0;
  private stopping = false;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  /** Prevents double-reconnect from close handler + forceReconnect timeout. */
  private reconnectScheduled = false;
  /** Timestamp of the last messages.upsert or connection.update activity. */
  private lastActivity = Date.now();
  /** Timestamp when connection last opened (for stability check). */
  private connectedAt = 0;

  /** Called by the adapter when an inbound message arrives on this session. */
  onInbound: (jid: string, senderPhone: string, rawMsg: any) => Promise<void> = async () => {};

  constructor(userId: string, sessionsDir: string) {
    this.userId = userId;
    this.sessionDir = path.join(sessionsDir, userId);
  }

  async start(): Promise<void> {
    fs.mkdirSync(this.sessionDir, { recursive: true });
    await this.startBaileys();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
    this.sock?.end(undefined);
  }

  private async wipeAndRestart(): Promise<void> {
    fs.rmSync(this.sessionDir, { recursive: true, force: true });
    fs.mkdirSync(this.sessionDir, { recursive: true });
    this.reconnectAttempts = 0;
    await this.startBaileys();
  }

  private async startBaileys(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
    const { version } = await fetchLatestBaileysVersion();
    const baileysLogger = _require('pino')({ level: 'silent' });

    this.sock = makeWASocket({
      version,
      logger: baileysLogger,
      auth: state,
      printQRInTerminal: false,
      browser: ['Sven', 'Chrome', '124.0.0'],
      getMessage: async () => ({ conversation: '' }),
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.latestQr = qr;
        logger.info('QR ready', { userId: this.userId });
      }

      if (connection === 'open') {
        this.isConnected = true;
        this.reconnectScheduled = false;
        this.latestQr = null;
        this.connectedAt = Date.now();
        this.lastActivity = Date.now();
        // Cache own phone number for reliable mention detection
        const rawId: string = this.sock?.user?.id || '';
        const phoneFromId = rawId.split(':')[0]?.split('@')[0] || '';
        if (phoneFromId) {
          this.cachedOwnPhone = phoneFromId;
        }
        // Cache LID (Linked Identity) — WhatsApp uses LIDs in mentionedJid arrays
        const rawLid: string = this.sock?.user?.lid || '';
        const lidFromUser = rawLid.split(':')[0]?.split('@')[0] || '';
        if (lidFromUser) {
          this.cachedOwnLid = lidFromUser;
        }
        logger.info('Cached own phone for mention detection', {
          userId: this.userId,
          ownPhone: phoneFromId,
          ownLid: lidFromUser || '(none)',
        });
        this.startKeepalive();
        logger.info('Session connected', { userId: this.userId });
      }

      if (connection === 'close') {
        this.isConnected = false;
        this.stopKeepalive();
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        logger.warn('Session disconnected', { userId: this.userId, statusCode, loggedOut });

        if (this.stopping) return;

        if (loggedOut) {
          logger.warn('Logged out — wiping session for re-scan', { userId: this.userId });
          await this.wipeAndRestart();
          return;
        }

        // Only reset counter if connection was stable (open > 30s)
        const uptime = Date.now() - this.connectedAt;
        if (uptime > STABLE_CONNECTION_MS) {
          this.reconnectAttempts = 0;
        }

        if (this.reconnectScheduled) {
          logger.info('Reconnect already scheduled — skipping duplicate', { userId: this.userId });
          return;
        }

        if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          this.reconnectAttempts++;
          this.reconnectScheduled = true;
          const delay = Math.min(
            MAX_RECONNECT_DELAY_MS,
            RECONNECT_DELAY_MS * (2 ** (this.reconnectAttempts - 1)),
          );
          logger.info('Reconnecting session', {
            userId: this.userId,
            attempt: this.reconnectAttempts,
            delayMs: delay,
            prevUptimeMs: uptime,
          });
          setTimeout(() => this.startBaileys(), delay);
        } else {
          logger.error('Max reconnect attempts reached — session halted, will retry in 5 min', {
            userId: this.userId,
          });
          this.reconnectScheduled = true;
          // Don't give up forever — try once more after a long cooldown
          setTimeout(() => {
            this.reconnectAttempts = 0;
            this.reconnectScheduled = false;
            this.startBaileys();
          }, STALE_CONNECTION_MS);
        }
      }
    });

    this.sock.ev.on('messages.upsert', async ({ messages, type }: { messages: any[]; type: string }) => {
      if (type !== 'notify') return;
      this.lastActivity = Date.now();
      for (const rawMsg of messages) {
        try {
          const jid: string = rawMsg.key?.remoteJid || '';
          if (!jid || rawMsg.key?.fromMe) continue;

          const isGroup = jid.endsWith('@g.us');
          const senderJid = (isGroup ? rawMsg.key?.participant : jid) || jid;
          const decoded = jidDecode(senderJid);
          const senderPhone: string = decoded?.user || senderJid.split('@')[0] || senderJid;

          await this.onInbound(jid, senderPhone, rawMsg);
        } catch (err) {
          logger.error('Failed to dispatch inbound message', { userId: this.userId, err: String(err) });
        }
      }
    });
  }

  // ── Keepalive / stale-connection detection ──────────────────────────────

  private startKeepalive(): void {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(() => this.checkHealth(), KEEPALIVE_INTERVAL_MS);
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  /**
   * Proactive health check:
   * 1. If the WebSocket is no longer open, trigger a reconnect.
   * 2. If no activity for STALE_CONNECTION_MS, tear down and reconnect to
   *    avoid the known Baileys "zombie socket" problem where the connection
   *    reports open but messages stop arriving.
   */
  private checkHealth(): void {
    if (this.stopping) return;

    const ws = this.sock?.ws;
    const wsOpen = ws && (ws.readyState === 1 /* OPEN */ || ws.readyState === undefined);

    if (!wsOpen && this.isConnected) {
      logger.warn('Keepalive: WebSocket not open despite isConnected — forcing reconnect', {
        userId: this.userId,
        readyState: ws?.readyState,
      });
      this.forceReconnect();
      return;
    }

    const idle = Date.now() - this.lastActivity;
    if (idle > STALE_CONNECTION_MS && this.isConnected) {
      logger.warn('Keepalive: no activity for stale window — forcing reconnect', {
        userId: this.userId,
        idleMs: idle,
      });
      this.forceReconnect();
    }
  }

  private forceReconnect(): void {
    this.isConnected = false;
    this.stopKeepalive();
    try { this.sock?.end(undefined); } catch { /* ignore */ }
    // The connection.update 'close' handler will schedule the reconnect.
    // Only use this fallback if close event never fires (zombie socket).
    setTimeout(() => {
      if (!this.isConnected && !this.stopping && !this.reconnectScheduled) {
        this.reconnectAttempts++;
        this.reconnectScheduled = true;
        const delay = Math.min(
          MAX_RECONNECT_DELAY_MS,
          RECONNECT_DELAY_MS * (2 ** (this.reconnectAttempts - 1)),
        );
        logger.info('Force-reconnect fallback: close event did not fire, scheduling retry', {
          userId: this.userId,
          attempt: this.reconnectAttempts,
          delayMs: delay,
        });
        setTimeout(() => this.startBaileys(), delay);
      }
    }, 3000);
  }
}

// ── Adapter ───────────────────────────────────────────────────────────────────

interface WaPersonalConfig extends AdapterConfig {
  sessionsDir: string;
  mgmtPort: number;
}

class WhatsAppPersonalAdapter extends BaseAdapter {
  private sessions = new Map<string, WhatsAppSession>();
  /** Maps Baileys JID → userId of the session that owns that chat (for outbound routing) */
  private chatOwner = new Map<string, string>();
  private mgmtServer!: http.Server;
  private sessionsDir: string;
  private mgmtPort: number;

  constructor(config: WaPersonalConfig) {
    super({ ...config, channel: 'whatsapp_personal' });
    this.sessionsDir = config.sessionsDir || SESSIONS_DIR;
    this.mgmtPort = config.mgmtPort || MGMT_PORT;
  }

  protected async connect(): Promise<void> {
    fs.mkdirSync(this.sessionsDir, { recursive: true });
    this.startMgmtServer();
    await this.reconnectExisting();
    await this.autoCreateFromEnv();
  }

  protected async disconnect(): Promise<void> {
    for (const session of this.sessions.values()) {
      await session.stop();
    }
    this.mgmtServer?.close();
  }

  // ── Session management ────────────────────────────────────────────────────

  private async createSession(userId: string): Promise<WhatsAppSession> {
    if (this.sessions.has(userId)) return this.sessions.get(userId)!;

    const session = new WhatsAppSession(userId, this.sessionsDir);
    session.onInbound = (jid, senderPhone, rawMsg) =>
      this.onInbound(userId, jid, senderPhone, rawMsg);

    this.sessions.set(userId, session);
    // Fire-and-forget so the caller doesn't block waiting for a QR scan
    session.start().catch((err) =>
      logger.error('Session start failed', { userId, err: String(err) }),
    );
    return session;
  }

  private async deleteSession(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (!session) return;
    await session.stop();
    this.sessions.delete(userId);
    for (const [jid, owner] of this.chatOwner) {
      if (owner === userId) this.chatOwner.delete(jid);
    }
    fs.rmSync(path.join(this.sessionsDir, userId), { recursive: true, force: true });
    logger.info('Session deleted', { userId });
  }

  private async reconnectExisting(): Promise<void> {
    if (!fs.existsSync(this.sessionsDir)) return;
    const entries = fs.readdirSync(this.sessionsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        logger.info('Restoring existing session', { userId: entry.name });
        await this.createSession(entry.name);
      }
    }
  }

  private async autoCreateFromEnv(): Promise<void> {
    const userList = (process.env.WHATSAPP_SESSION_USERS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const userId of userList) {
      if (!this.sessions.has(userId)) {
        logger.info('Auto-creating session from env', { userId });
        await this.createSession(userId);
      }
    }
  }

  // ── Inbound callback ──────────────────────────────────────────────────────

  private async onInbound(
    ownerUserId: string,
    jid: string,
    senderPhone: string,
    rawMsg: any,
  ): Promise<void> {
    // Record which session owns this chat for outbound routing
    this.chatOwner.set(jid, ownerUserId);

    const isGroup = jid.endsWith('@g.us');
    const message = rawMsg.message;
    let text: string =
      message?.conversation ||
      message?.extendedTextMessage?.text ||
      message?.imageMessage?.caption ||
      message?.videoMessage?.caption ||
      '';

    if (!text) return;

    // ── Group mention detection ───────────────────────────────────────────
    let triggerMatched = false;
    if (isGroup) {
      const session = this.sessions.get(ownerUserId);
      // Use cached phone number (survives reconnects) with live fallback
      const liveId: string = session?.sock?.user?.id || '';
      const livePhone = liveId.split(':')[0]?.split('@')[0] || '';
      const ownPhone = session?.cachedOwnPhone || livePhone;
      const ownJid = ownPhone ? `${ownPhone}@s.whatsapp.net` : '';

      // LID (Linked Identity) — WhatsApp may use LIDs in mentionedJid arrays
      const liveLid: string = session?.sock?.user?.lid || '';
      const liveLidPhone = liveLid.split(':')[0]?.split('@')[0] || '';
      const ownLid = session?.cachedOwnLid || liveLidPhone;

      logger.info('Group mention check', {
        userId: ownerUserId,
        ownPhone,
        ownLid: ownLid || '(none)',
        textSnippet: text.substring(0, 80),
        hasMentionedJid: !!(message?.extendedTextMessage?.contextInfo?.mentionedJid?.length),
      });

      // Check Baileys mentionedJid array against phone JID and LID
      const mentionedJid: string[] =
        message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (ownPhone && mentionedJid.some((m: string) => m.startsWith(ownPhone))) {
        triggerMatched = true;
      }
      if (!triggerMatched && ownLid && mentionedJid.some((m: string) => m.startsWith(ownLid))) {
        triggerMatched = true;
      }

      // Fallback: check if text contains @<ownPhone> or @<ownLid>
      if (!triggerMatched && ownPhone && text.includes(`@${ownPhone}`)) {
        triggerMatched = true;
      }
      if (!triggerMatched && ownLid && text.includes(`@${ownLid}`)) {
        triggerMatched = true;
      }

      // Also check for "sven" keyword (case insensitive) for consistency
      if (!triggerMatched && text.toLowerCase().includes('sven')) {
        triggerMatched = true;
      }

      // Strip the @phone/@lid mention from text so the agent sees clean input
      if (triggerMatched) {
        if (ownPhone) {
          text = text.replace(new RegExp(`@${ownPhone}\\b`, 'g'), '').trim();
        }
        if (ownLid) {
          text = text.replace(new RegExp(`@${ownLid}\\b`, 'g'), '').trim();
        }
      }
    }

    const pushName = String(rawMsg.pushName || senderPhone);

    await this.handleInbound({
      channelUserId: senderPhone,
      channelChatId: jid,
      channelMessageId: rawMsg.key?.id || `${Date.now()}`,
      displayName: pushName,
      chatType: isGroup ? 'group' : 'dm',
      text,
      metadata: {
        is_group: isGroup,
        jid,
        push_name: pushName,
        session_user_id: ownerUserId,
        ...(triggerMatched ? { trigger_matched: true } : {}),
      },
    });
  }

  // ── Outbound delivery ─────────────────────────────────────────────────────

  private resolveSocket(channelChatId: string): any | null {
    const ownerUserId = this.chatOwner.get(channelChatId);
    if (ownerUserId) {
      const session = this.sessions.get(ownerUserId);
      if (session?.isConnected) return session.sock;
    }
    // Fallback: first connected session
    for (const session of this.sessions.values()) {
      if (session.isConnected) return session.sock;
    }
    return null;
  }

  protected async sendText(channelChatId: string, text: string, _item: OutboxItem): Promise<void> {
    const sock = this.resolveSocket(channelChatId);
    if (!sock) throw new Error(`No connected WhatsApp session for chat ${channelChatId}`);
    logger.info('Delivering outbox text message', {
      outbox_id: _item.id,
      channelChatId,
      textLength: text.length,
      textSnippet: text.slice(0, 60),
    });
    await sock.sendMessage(channelChatId, { text });
    logger.info('Outbox text message delivered', { outbox_id: _item.id, channelChatId });
  }

  protected async sendFile(
    channelChatId: string,
    fileUrl: string,
    caption?: string,
    _item?: OutboxItem,
  ): Promise<void> {
    const sock = this.resolveSocket(channelChatId);
    if (!sock) throw new Error(`No connected WhatsApp session for chat ${channelChatId}`);
    const msg = caption ? `${caption}\n${fileUrl}` : fileUrl;
    await sock.sendMessage(channelChatId, { text: msg });
  }

  protected async sendAudio(
    channelChatId: string,
    audioUrl: string,
    _caption?: string,
    _item?: OutboxItem,
  ): Promise<void> {
    const sock = this.resolveSocket(channelChatId);
    if (!sock) throw new Error(`No connected WhatsApp session for chat ${channelChatId}`);
    await sock.sendMessage(channelChatId, { text: audioUrl });
  }

  // ── HTTP management server ────────────────────────────────────────────────

  private startMgmtServer(): void {
    this.mgmtServer = http.createServer(async (req, res) => {
      const rawUrl = req.url?.split('?')[0] || '/';
      const method = req.method || 'GET';

      try {
        await this.handleMgmtRequest(method, rawUrl, req, res);
      } catch (err) {
        logger.error('Management server error', { err: String(err) });
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      }
    });

    this.mgmtServer.listen(this.mgmtPort, '0.0.0.0', () => {
      logger.info('Management server listening', { port: this.mgmtPort });
    });
  }

  private async handleMgmtRequest(
    method: string,
    url: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    // GET /status
    if (method === 'GET' && url === '/status') {
      const sessions: Record<string, object> = {};
      for (const [uid, s] of this.sessions) {
        sessions[uid] = { connected: s.isConnected, qr_pending: s.latestQr !== null };
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ channel: 'whatsapp_personal', session_count: this.sessions.size, sessions }));
      return;
    }

    // GET /status/:userId
    const statusMatch = url.match(/^\/status\/(.+)$/);
    if (method === 'GET' && statusMatch) {
      const userId = decodeURIComponent(statusMatch[1]);
      const s = this.sessions.get(userId);
      if (!s) { res.writeHead(404); res.end('Session not found'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ userId, connected: s.isConnected, qr_pending: s.latestQr !== null }));
      return;
    }

    // GET /qr/:userId
    const qrMatch = url.match(/^\/qr\/(.+)$/);
    if (method === 'GET' && qrMatch) {
      const userId = decodeURIComponent(qrMatch[1]);
      const s = this.sessions.get(userId);
      if (!s) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`<html><body style="font-family:sans-serif;padding:40px;text-align:center">
<h2>Session not found</h2>
<p>Create it first: <code>POST /sessions</code> with <code>{"userId":"${escapeHtml(userId)}"}</code></p>
</body></html>`);
        return;
      }
      await this.serveQrPage(res, s);
      return;
    }

    // POST /sessions
    if (method === 'POST' && url === '/sessions') {
      const body = await readBody(req);
      let parsed: any;
      try { parsed = JSON.parse(body); } catch { res.writeHead(400); res.end('Invalid JSON'); return; }
      const userId = String(parsed?.userId || '').trim();
      if (!userId) { res.writeHead(400); res.end('userId is required'); return; }
      await this.createSession(userId);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, userId, qr_url: `/qr/${encodeURIComponent(userId)}` }));
      return;
    }

    // DELETE /sessions/:userId
    const deleteMatch = url.match(/^\/sessions\/(.+)$/);
    if (method === 'DELETE' && deleteMatch) {
      const userId = decodeURIComponent(deleteMatch[1]);
      await this.deleteSession(userId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, userId }));
      return;
    }

    // Default: redirect to /status
    res.writeHead(302, { Location: '/status' });
    res.end();
  }

  private async serveQrPage(res: http.ServerResponse, session: WhatsAppSession): Promise<void> {
    const { userId, isConnected, latestQr } = session;

    if (isConnected) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:40px;text-align:center;background:#f5f5f5">
  <h2>&#x2705; WhatsApp connected</h2>
  <p>User <b>${escapeHtml(userId)}</b> is linked. No QR needed.</p>
</body></html>`);
      return;
    }

    if (!latestQr) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:40px;text-align:center;background:#f5f5f5">
  <h2>&#x23F3; Waiting for QR&hellip;</h2>
  <p>User: <b>${escapeHtml(userId)}</b></p>
  <p>Page auto-refreshes in 3 seconds.</p>
  <script>setTimeout(()=>location.reload(),3000)</script>
</body></html>`);
      return;
    }

    try {
      const dataUrl = await qrcode.toDataURL(latestQr, { width: 320, margin: 2 });
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html><head><title>Sven – WhatsApp QR (${escapeHtml(userId)})</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px;background:#f5f5f5">
  <h2>Scan with WhatsApp to link Sven</h2>
  <p>User: <b>${escapeHtml(userId)}</b></p>
  <p>Open WhatsApp &rarr; <b>Linked Devices</b> &rarr; <b>Link a Device</b></p>
  <img src="${dataUrl}" style="border:8px solid white;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.15)" />
  <p style="color:#888;font-size:13px">QR expires in ~20s &mdash; page auto-refreshes</p>
  <script>setTimeout(()=>location.reload(),18000)</script>
</body></html>`);
    } catch {
      res.writeHead(500); res.end('QR generation failed');
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

// Baileys can throw unhandled rejections from internal operations like
// uploadPreKeysToServerIfRequired — catch them to prevent process crash.
process.on('unhandledRejection', (err: any) => {
  logger.error('Unhandled rejection (Baileys internal)', { error: String(err?.message || err) });
});

runAdapter(WhatsAppPersonalAdapter as any, {
  sessionsDir: SESSIONS_DIR,
  mgmtPort: MGMT_PORT,
});
