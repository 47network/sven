import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import {
  BaseAdapter,
  type AdapterConfig,
  type ApprovalButton,
  type OutboxItem,
  runAdapter,
  createLogger,
} from '@sven/shared';

const logger = createLogger('adapter-irc');

interface IrcConfig extends AdapterConfig {
  ircServer: string;
  ircPort: number;
  ircNick: string;
  ircUsername: string;
  ircRealname: string;
  ircPassword?: string;
  ircUseTls?: boolean;
  ircChannels?: string;
  ircTriggerPrefix?: string;
  ircReconnectMs?: number;
  ircNickservPassword?: string;
  ircHealthPort?: number;
}

class IrcAdapter extends BaseAdapter {
  private server: string;
  private port: number;
  private nick: string;
  private username: string;
  private realname: string;
  private password: string;
  private useTls: boolean;
  private channels: string[];
  private triggerPrefix: string;
  private reconnectMs: number;
  private nickservPassword: string;
  private healthPort: number;

  private socket: net.Socket | tls.TLSSocket | null = null;
  private healthServer: http.Server | null = null;
  private recvBuffer = '';
  private registered = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private ircRunning = false;

  constructor(config: IrcConfig) {
    super({ ...config, channel: 'irc' });
    this.server = config.ircServer || process.env.IRC_SERVER || '';
    this.port = Number(config.ircPort || process.env.IRC_PORT || 6667);
    this.nick = config.ircNick || process.env.IRC_NICK || 'sven';
    this.username = config.ircUsername || process.env.IRC_USERNAME || this.nick;
    this.realname = config.ircRealname || process.env.IRC_REALNAME || 'Sven IRC Adapter';
    this.password = config.ircPassword || process.env.IRC_PASSWORD || '';
    this.useTls = Boolean(config.ircUseTls ?? ((process.env.IRC_USE_TLS || 'false') === 'true'));
    this.channels = String(config.ircChannels || process.env.IRC_CHANNELS || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    this.triggerPrefix = config.ircTriggerPrefix || process.env.IRC_TRIGGER_PREFIX || '/sven';
    this.reconnectMs = Number(config.ircReconnectMs || process.env.IRC_RECONNECT_MS || 5000);
    this.nickservPassword = config.ircNickservPassword || process.env.IRC_NICKSERV_PASSWORD || '';
    if (this.nickservPassword && !this.useTls) {
      logger.warn('NickServ password is set but TLS is disabled — credentials will be sent in plaintext');
    }
    this.healthPort = Number(config.ircHealthPort || process.env.IRC_HEALTH_PORT || 8496);
  }

  protected async connect(): Promise<void> {
    if (!this.server) throw new Error('IRC_SERVER is required');
    this.ircRunning = true;
    this.healthServer = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', adapter: 'irc', server: this.server }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => this.healthServer!.listen(this.healthPort, () => resolve()));
    await this.openSocket();
  }

  protected async disconnect(): Promise<void> {
    this.ircRunning = false;
    this.registered = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket && !this.socket.destroyed) {
      for (const channel of this.channels) {
        this.writeLine(`PART ${channel}`);
      }
      this.writeLine('QUIT :Sven adapter shutting down');
      this.socket.destroy();
    }
    this.socket = null;
    if (this.healthServer) {
      await new Promise<void>((resolve) => this.healthServer!.close(() => resolve()));
      this.healthServer = null;
    }
  }

  protected async sendText(channelChatId: string, text: string, _item: OutboxItem): Promise<void> {
    for (const line of splitMessageLines(text, 380)) {
      this.writeLine(`PRIVMSG ${channelChatId} :${line}`);
    }
  }

  protected async sendFile(channelChatId: string, fileUrl: string, caption?: string, item?: OutboxItem): Promise<void> {
    const text = [caption || 'File', fileUrl].filter(Boolean).join(' - ');
    await this.sendText(channelChatId, text, item as OutboxItem);
  }

  protected async sendAudio(channelChatId: string, audioUrl: string, caption?: string, item?: OutboxItem): Promise<void> {
    const text = [caption || 'Audio', audioUrl].filter(Boolean).join(' - ');
    await this.sendText(channelChatId, text, item as OutboxItem);
  }

  protected override async sendApprovalButtons(channelChatId: string, buttons: ApprovalButton[], item: OutboxItem): Promise<void> {
    const lines = buttons.map((b) => `${b.label}: ${b.action} ${b.approval_id}`);
    const fallback = `Approval required | ${lines.join(' | ')}`;
    await this.sendText(channelChatId, item.text ? `${item.text} | ${fallback}` : fallback, item);
  }

  private async openSocket(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const onConnect = () => {
        logger.info('IRC connected', { server: this.server, port: this.port, tls: this.useTls });
        this.registered = false;
        this.recvBuffer = '';
        this.performRegistration();
        resolve();
      };

      const socket = this.useTls
        ? tls.connect({ host: this.server, port: this.port }, onConnect)
        : net.connect({ host: this.server, port: this.port }, onConnect);

      socket.setEncoding('utf8');
      socket.on('data', (chunk: string) => this.handleSocketData(chunk));
      socket.on('error', (err) => {
        logger.warn('IRC socket error', { error: String(err) });
      });
      socket.on('close', () => {
        logger.warn('IRC socket closed');
        this.socket = null;
        if (this.ircRunning) this.scheduleReconnect();
      });

      this.socket = socket;

      setTimeout(() => {
        if (!this.socket || this.socket.destroyed) {
          reject(new Error('IRC connect timeout'));
        }
      }, 10000);
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.ircRunning) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openSocket().catch((err) => {
        logger.warn('IRC reconnect failed', { error: String(err) });
        this.scheduleReconnect();
      });
    }, this.reconnectMs);
  }

  private performRegistration(): void {
    if (this.password) this.writeLine(`PASS ${this.password}`);
    this.writeLine(`NICK ${this.nick}`);
    this.writeLine(`USER ${this.username} 0 * :${this.realname}`);
  }

  private writeLine(line: string): void {
    if (!this.socket || this.socket.destroyed) throw new Error('IRC socket not connected');
    this.socket.write(`${line}\r\n`);
  }

  private handleSocketData(chunk: string): void {
    this.recvBuffer += chunk;
    for (;;) {
      const idx = this.recvBuffer.indexOf('\n');
      if (idx === -1) break;
      const line = this.recvBuffer.slice(0, idx).replace(/\r$/, '');
      this.recvBuffer = this.recvBuffer.slice(idx + 1);
      if (line) this.handleIrcLine(line);
    }
  }

  private handleIrcLine(line: string): void {
    if (line.startsWith('PING ')) {
      this.writeLine(`PONG ${line.slice(5)}`);
      return;
    }

    const parsed = parseIrcLine(line);
    if (!parsed) return;

    if (parsed.command === '001' && !this.registered) {
      this.registered = true;
      if (this.nickservPassword) {
        this.writeLine(`PRIVMSG NickServ :IDENTIFY ${this.nickservPassword}`);
      }
      for (const channel of this.channels) {
        this.writeLine(`JOIN ${channel}`);
      }
      return;
    }

    if (parsed.command !== 'PRIVMSG') return;

    const from = parsed.prefixNick || '';
    const target = parsed.params[0] || '';
    const body = parsed.trailing || '';
    if (!from || !target || !body) return;

    const isDm = !target.startsWith('#');
    const isMention = body.toLowerCase().includes(this.nick.toLowerCase());
    const hasPrefix = body.trim().toLowerCase().startsWith(this.triggerPrefix.toLowerCase());
    if (!isDm && !isMention && !hasPrefix) return;

    let text = body;
    if (hasPrefix) {
      text = body.slice(this.triggerPrefix.length).trim();
    } else if (isMention) {
      text = body.replace(new RegExp(this.nick, 'ig'), '').replace(/^[:,\s-]+/, '').trim();
    }

    const channelChatId = isDm ? from : target;
    const chatType: 'dm' | 'group' = isDm ? 'dm' : 'group';
    const channelMessageId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    void this.handleInbound({
      channelUserId: from,
      channelChatId,
      channelMessageId,
      displayName: from,
      chatName: isDm ? from : target,
      chatType,
      text,
      metadata: {
        irc_target: target,
        irc_raw: line,
      },
    });
  }
}

type ParsedLine = {
  prefix?: string;
  prefixNick?: string;
  command: string;
  params: string[];
  trailing?: string;
};

export function parseIrcLine(line: string): ParsedLine | null {
  let rest = line;
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

  return { prefix, prefixNick, command, params, trailing };
}

export function splitMessageLines(text: string, maxLen: number): string[] {
  const clean = String(text || '').replace(/\r/g, '');
  const result: string[] = [];
  for (const rawLine of clean.split('\n')) {
    let line = rawLine;
    if (!line) {
      result.push(' ');
      continue;
    }
    while (line.length > maxLen) {
      result.push(line.slice(0, maxLen));
      line = line.slice(maxLen);
    }
    result.push(line);
  }
  return result;
}

if (process.env.NODE_ENV !== 'test') {
  runAdapter(IrcAdapter as any, {
    ircServer: process.env.IRC_SERVER || '',
    ircPort: Number(process.env.IRC_PORT || 6667),
    ircNick: process.env.IRC_NICK || 'sven',
    ircUsername: process.env.IRC_USERNAME || (process.env.IRC_NICK || 'sven'),
    ircRealname: process.env.IRC_REALNAME || 'Sven IRC Adapter',
    ircPassword: process.env.IRC_PASSWORD || '',
    ircUseTls: (process.env.IRC_USE_TLS || 'false') === 'true',
    ircChannels: process.env.IRC_CHANNELS || '',
    ircTriggerPrefix: process.env.IRC_TRIGGER_PREFIX || '/sven',
    ircReconnectMs: Number(process.env.IRC_RECONNECT_MS || 5000),
    ircNickservPassword: process.env.IRC_NICKSERV_PASSWORD || '',
    ircHealthPort: Number(process.env.IRC_HEALTH_PORT || 8496),
  });
}
