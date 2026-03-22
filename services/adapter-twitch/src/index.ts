import http from 'node:http';
import tls from 'node:tls';
import {
  BaseAdapter,
  type AdapterConfig,
  type ApprovalButton,
  type OutboxItem,
  runAdapter,
  createLogger,
} from '@sven/shared';

const logger = createLogger('adapter-twitch');

interface TwitchConfig extends AdapterConfig {
  twitchOauthToken: string;
  twitchBotUser: string;
  twitchChannels?: string;
  twitchTriggerPrefix?: string;
  twitchReconnectMs?: number;
  twitchHealthPort?: number;
}

class TwitchAdapter extends BaseAdapter {
  private oauthToken: string;
  private botUser: string;
  private channels: string[];
  private triggerPrefix: string;
  private reconnectMs: number;
  private healthPort: number;

  private socket: tls.TLSSocket | null = null;
  private healthServer: http.Server | null = null;
  private recvBuffer = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private twitchRunning = false;

  constructor(config: TwitchConfig) {
    super({ ...config, channel: 'twitch' });
    this.oauthToken = normalizeOauthToken(config.twitchOauthToken || process.env.TWITCH_OAUTH_TOKEN || '');
    this.botUser = String(config.twitchBotUser || process.env.TWITCH_BOT_USER || '').toLowerCase();
    this.channels = parseChannels(config.twitchChannels || process.env.TWITCH_CHANNELS || '');
    this.triggerPrefix = config.twitchTriggerPrefix || process.env.TWITCH_TRIGGER_PREFIX || '!sven';
    this.reconnectMs = Number(config.twitchReconnectMs || process.env.TWITCH_RECONNECT_MS || 5000);
    this.healthPort = Number(config.twitchHealthPort || process.env.TWITCH_HEALTH_PORT || 8494);
  }

  protected async connect(): Promise<void> {
    if (!this.oauthToken) throw new Error('TWITCH_OAUTH_TOKEN is required');
    if (!this.botUser) throw new Error('TWITCH_BOT_USER is required');

    this.twitchRunning = true;
    this.healthServer = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', adapter: 'twitch', channels: this.channels }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => this.healthServer!.listen(this.healthPort, () => resolve()));

    await this.openSocket();
  }

  protected async disconnect(): Promise<void> {
    this.twitchRunning = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket && !this.socket.destroyed) {
      this.socket.destroy();
    }
    this.socket = null;
    if (this.healthServer) {
      await new Promise<void>((resolve) => this.healthServer!.close(() => resolve()));
      this.healthServer = null;
    }
  }

  protected async sendText(channelChatId: string, text: string, _item: OutboxItem): Promise<void> {
    const channel = normalizeChannel(channelChatId);
    for (const line of splitMessageLines(text, 380)) {
      this.writeLine(`PRIVMSG #${channel} :${line}`);
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

  private async openSocket(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = tls.connect({ host: 'irc.chat.twitch.tv', port: 6697 }, () => {
        this.socket = socket;
        this.recvBuffer = '';
        this.register();
        resolve();
      });

      socket.setEncoding('utf8');
      socket.on('data', (chunk: string) => this.handleData(chunk));
      socket.on('error', (err) => {
        logger.warn('Twitch IRC socket error', { error: String(err) });
      });
      socket.on('close', () => {
        logger.warn('Twitch IRC socket closed');
        this.socket = null;
        if (this.twitchRunning) this.scheduleReconnect();
      });

      setTimeout(() => {
        if (!this.socket || this.socket.destroyed) reject(new Error('Twitch IRC connect timeout'));
      }, 10000);
    });
  }

  private register(): void {
    this.writeLine('CAP REQ :twitch.tv/tags twitch.tv/commands');
    this.writeLine(`PASS ${this.oauthToken}`);
    this.writeLine(`NICK ${this.botUser}`);
    for (const channel of this.channels) {
      this.writeLine(`JOIN #${channel}`);
    }
    logger.info('Twitch IRC connected', { bot: this.botUser, channels: this.channels });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.twitchRunning) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openSocket().catch((err) => {
        logger.warn('Twitch reconnect failed', { error: String(err) });
        this.scheduleReconnect();
      });
    }, this.reconnectMs);
  }

  private handleData(chunk: string): void {
    this.recvBuffer += chunk;
    for (;;) {
      const idx = this.recvBuffer.indexOf('\n');
      if (idx === -1) break;
      const line = this.recvBuffer.slice(0, idx).replace(/\r$/, '');
      this.recvBuffer = this.recvBuffer.slice(idx + 1);
      if (line) this.handleLine(line);
    }
  }

  private handleLine(line: string): void {
    if (line.startsWith('PING ')) {
      this.writeLine(`PONG ${line.slice(5)}`);
      return;
    }

    const parsed = parseIrcLine(line);
    if (!parsed || parsed.command !== 'PRIVMSG') return;

    const sender = String(parsed.prefixNick || '').toLowerCase();
    const target = String(parsed.params[0] || '').toLowerCase();
    const body = String(parsed.trailing || '');
    if (!sender || !target || !body) return;
    if (sender === this.botUser) return;

    const channel = normalizeChannel(target);
    const mention = body.toLowerCase().includes(this.botUser.toLowerCase());
    const prefixed = body.trim().toLowerCase().startsWith(this.triggerPrefix.toLowerCase());
    if (!mention && !prefixed) return;

    let text = body;
    if (prefixed) {
      text = body.slice(this.triggerPrefix.length).trim();
    } else if (mention) {
      text = body.replace(new RegExp(this.botUser, 'ig'), '').replace(/^[:,\s-]+/, '').trim();
    }

    const badges = String(parsed.tags?.badges || '');
    const badgeParts = badges.split(',').map((b) => b.trim()).filter(Boolean);
    const isModerator = badgeParts.some((b) => b.startsWith('moderator/') || b.startsWith('broadcaster/'));
    const isSubscriber = badgeParts.some((b) => b.startsWith('subscriber/')) || String(parsed.tags?.subscriber || '') === '1';

    const channelMessageId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    void this.handleInbound({
      channelUserId: sender,
      channelChatId: channel,
      channelMessageId,
      displayName: sender,
      chatName: `#${channel}`,
      chatType: 'group',
      text,
      metadata: {
        twitch_channel: channel,
        twitch_raw: line,
        twitch_badges: badges,
        twitch_is_moderator: isModerator,
        twitch_is_subscriber: isSubscriber,
      },
    });
  }

  private writeLine(line: string): void {
    if (!this.socket || this.socket.destroyed) throw new Error('Twitch socket not connected');
    this.socket.write(`${line}\r\n`);
  }
}

type ParsedLine = {
  tags?: Record<string, string>;
  prefix?: string;
  prefixNick?: string;
  command: string;
  params: string[];
  trailing?: string;
};

export function parseIrcLine(line: string): ParsedLine | null {
  let rest = line;
  let tags: Record<string, string> | undefined;
  if (rest.startsWith('@')) {
    const space = rest.indexOf(' ');
    if (space === -1) return null;
    const rawTags = rest.slice(1, space);
    tags = {};
    for (const pair of rawTags.split(';')) {
      const eq = pair.indexOf('=');
      if (eq === -1) {
        tags[pair] = '';
      } else {
        const k = pair.slice(0, eq);
        const v = pair.slice(eq + 1);
        tags[k] = v;
      }
    }
    rest = rest.slice(space + 1);
  }

  let prefix: string | undefined;
  if (rest.startsWith(':')) {
    const space = rest.indexOf(' ');
    if (space === -1) return null;
    prefix = rest.slice(1, space);
    rest = rest.slice(space + 1);
  }

  let trailing: string | undefined;
  const trailingIdx = rest.indexOf(' :');
  if (trailingIdx >= 0) {
    trailing = rest.slice(trailingIdx + 2);
    rest = rest.slice(0, trailingIdx);
  }

  const parts = rest.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const command = parts[0].toUpperCase();
  const params = parts.slice(1);
  const prefixNick = prefix ? prefix.split('!')[0] : undefined;
  return { tags, prefix, prefixNick, command, params, trailing };
}

export function parseChannels(raw: string): string[] {
  return String(raw || '')
    .split(',')
    .map((v) => normalizeChannel(v))
    .filter(Boolean);
}

export function normalizeChannel(raw: string): string {
  return String(raw || '').trim().replace(/^#/, '').toLowerCase();
}

export function normalizeOauthToken(raw: string): string {
  const token = String(raw || '').trim();
  if (!token) return '';
  return token.startsWith('oauth:') ? token : `oauth:${token}`;
}

export function splitMessageLines(text: string, maxLen: number): string[] {
  const clean = String(text || '').replace(/\r/g, '');
  const out: string[] = [];
  for (const rawLine of clean.split('\n')) {
    let line = rawLine || ' ';
    while (line.length > maxLen) {
      out.push(line.slice(0, maxLen));
      line = line.slice(maxLen);
    }
    out.push(line);
  }
  return out;
}

if (process.env.NODE_ENV !== 'test') {
  runAdapter(TwitchAdapter as any, {
    twitchOauthToken: process.env.TWITCH_OAUTH_TOKEN || '',
    twitchBotUser: process.env.TWITCH_BOT_USER || '',
    twitchChannels: process.env.TWITCH_CHANNELS || '',
    twitchTriggerPrefix: process.env.TWITCH_TRIGGER_PREFIX || '!sven',
    twitchReconnectMs: Number(process.env.TWITCH_RECONNECT_MS || 5000),
    twitchHealthPort: Number(process.env.TWITCH_HEALTH_PORT || 8494),
  });
}
