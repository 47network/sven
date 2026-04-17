/**
 * Batch 9E: Binance WebSocket feed for real-time price updates.
 *
 * Connects to Binance combined stream for all tracked symbols, subscribing
 * to miniTicker and kline updates. Maintains an in-memory price cache that
 * the trading loop reads from — eliminating per-symbol REST calls for price.
 *
 * Features:
 * - Combined stream for 15+ symbols on a single connection
 * - Auto-reconnect with exponential backoff (1s → 30s max)
 * - Dynamic symbol subscription (add/remove without reconnect)
 * - Graceful shutdown
 * - Heartbeat ping/pong monitoring
 */
import WebSocket from 'ws';

export interface WsPriceUpdate {
  symbol: string;       // e.g. "BTCUSDT"
  price: number;
  volume24h: number;
  change24hPct: number;
  updatedAt: number;    // Unix ms
}

export interface BinanceWsConfig {
  /** Logger with info/warn/error/debug methods */
  logger: {
    info: (msg: string, data?: Record<string, unknown>) => void;
    warn: (msg: string, data?: Record<string, unknown>) => void;
    error: (msg: string, data?: Record<string, unknown>) => void;
    debug: (msg: string, data?: Record<string, unknown>) => void;
  };
  /** Called on each price update */
  onPriceUpdate?: (update: WsPriceUpdate) => void;
}

const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/stream';
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const PING_INTERVAL_MS = 60_000;      // Binance expects pings within 180s
const STALE_THRESHOLD_MS = 120_000;   // Consider feed stale after 2min no data

export class BinanceWsFeed {
  private ws: WebSocket | null = null;
  private symbols = new Set<string>();  // lowercase binance symbols, e.g. "btcusdt"
  private priceCache = new Map<string, WsPriceUpdate>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private lastMessageAt = 0;
  private shuttingDown = false;
  private config: BinanceWsConfig;
  private idCounter = 1;

  constructor(config: BinanceWsConfig) {
    this.config = config;
  }

  /** Get cached price for a Binance symbol (e.g. "BTCUSDT"). Returns null if no update received yet. */
  getPrice(binanceSymbol: string): WsPriceUpdate | null {
    return this.priceCache.get(binanceSymbol.toUpperCase()) ?? null;
  }

  /** Get all cached prices. */
  getAllPrices(): Map<string, WsPriceUpdate> {
    return new Map(this.priceCache);
  }

  /** Check if feed is connected and receiving data. */
  isHealthy(): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    if (this.lastMessageAt === 0) return true; // just connected, no data yet
    return (Date.now() - this.lastMessageAt) < STALE_THRESHOLD_MS;
  }

  /** Start the WebSocket feed with initial symbols. */
  start(binanceSymbols: string[]): void {
    this.shuttingDown = false;
    for (const s of binanceSymbols) this.symbols.add(s.toLowerCase());
    this.connect();
  }

  /** Graceful shutdown. */
  stop(): void {
    this.shuttingDown = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN) this.ws.close(1000, 'shutdown');
      this.ws = null;
    }
    this.config.logger.info('Binance WS feed stopped');
  }

  /** Add symbols to the subscription (dynamic watchlist changes). */
  addSymbols(binanceSymbols: string[]): void {
    const newSyms = binanceSymbols.filter(s => !this.symbols.has(s.toLowerCase()));
    if (newSyms.length === 0) return;
    for (const s of newSyms) this.symbols.add(s.toLowerCase());
    this.subscribe(newSyms.map(s => `${s.toLowerCase()}@miniTicker`));
    this.config.logger.info('Binance WS added symbols', { symbols: newSyms });
  }

  /** Remove symbols from the subscription. */
  removeSymbols(binanceSymbols: string[]): void {
    const removing = binanceSymbols.filter(s => this.symbols.has(s.toLowerCase()));
    if (removing.length === 0) return;
    for (const s of removing) {
      this.symbols.delete(s.toLowerCase());
      this.priceCache.delete(s.toUpperCase());
    }
    this.unsubscribe(removing.map(s => `${s.toLowerCase()}@miniTicker`));
    this.config.logger.info('Binance WS removed symbols', { symbols: removing });
  }

  // ── Internal ────────────────────────────────────────────────────

  private connect(): void {
    if (this.shuttingDown) return;

    // Build initial stream list
    const streams = [...this.symbols].map(s => `${s}@miniTicker`);
    if (streams.length === 0) {
      this.config.logger.warn('Binance WS: no symbols to subscribe');
      return;
    }

    const url = `${BINANCE_WS_BASE}?streams=${streams.join('/')}`;
    this.config.logger.info('Binance WS connecting', { symbols: this.symbols.size, url: BINANCE_WS_BASE });

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.reconnectAttempts = 0;
      this.lastMessageAt = Date.now();
      this.startPingInterval();
      this.config.logger.info('Binance WS connected', { symbols: this.symbols.size });
    });

    this.ws.on('message', (data) => {
      this.lastMessageAt = Date.now();
      try {
        const msg = JSON.parse(data.toString()) as { stream?: string; data?: Record<string, unknown> };
        if (msg.stream && msg.data) {
          this.handleStreamMessage(msg.stream, msg.data);
        }
      } catch {
        // Ignore malformed messages
      }
    });

    this.ws.on('close', (code, reason) => {
      this.config.logger.warn('Binance WS closed', { code, reason: reason.toString() });
      this.cleanup();
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      this.config.logger.error('Binance WS error', { err: (err as Error).message });
      // 'close' event will fire after error, triggering reconnect
    });

    this.ws.on('pong', () => {
      this.config.logger.debug('Binance WS pong received');
    });
  }

  private handleStreamMessage(stream: string, data: Record<string, unknown>): void {
    // miniTicker format: { e: '24hrMiniTicker', s: 'BTCUSDT', c: '67000.00', v: '1234.56', ... }
    if (stream.endsWith('@miniTicker') && data['e'] === '24hrMiniTicker') {
      const symbol = data['s'] as string;
      const price = parseFloat(data['c'] as string);
      const volume = parseFloat(data['v'] as string);
      const openPrice = parseFloat(data['o'] as string);
      const changePct = openPrice > 0 ? ((price - openPrice) / openPrice) * 100 : 0;

      const update: WsPriceUpdate = {
        symbol,
        price,
        volume24h: volume,
        change24hPct: changePct,
        updatedAt: Date.now(),
      };

      this.priceCache.set(symbol, update);
      this.config.onPriceUpdate?.(update);
    }
  }

  private subscribe(streams: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || streams.length === 0) return;
    this.ws.send(JSON.stringify({
      method: 'SUBSCRIBE',
      params: streams,
      id: this.idCounter++,
    }));
  }

  private unsubscribe(streams: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || streams.length === 0) return;
    this.ws.send(JSON.stringify({
      method: 'UNSUBSCRIBE',
      params: streams,
      id: this.idCounter++,
    }));
  }

  private startPingInterval(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, PING_INTERVAL_MS);
  }

  private cleanup(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.shuttingDown) return;
    const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempts), RECONNECT_MAX_MS);
    this.reconnectAttempts++;
    this.config.logger.info('Binance WS reconnecting', { attempt: this.reconnectAttempts, delayMs: delay });
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
