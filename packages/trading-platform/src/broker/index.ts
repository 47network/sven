// ---------------------------------------------------------------------------
// @sven/trading-platform — Broker Connector Layer
// ---------------------------------------------------------------------------
// Unified interface for routing orders to external brokers (Alpaca, CCXT)
// and internal paper trading. Each connector implements the same interface.
// ---------------------------------------------------------------------------

import type { Order, OrderSide, OrderType, TimeInForce, Position } from '../oms/index.js';
import { createHmac } from 'node:crypto';

/* Node 18+ global fetch — type shim for non-DOM tsconfig */
declare function fetch(input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<any> }>;
declare class URLSearchParams { constructor(init?: Record<string, string>); set(name: string, value: string): void; toString(): string; }
/* ── Broker Types ──────────────────────────────────────────────────────── */

export type BrokerName = 'alpaca' | 'ccxt_binance' | 'ccxt_bybit' | 'paper';

export interface BrokerCredentials {
  apiKey: string;
  apiSecret: string;
  isPaper: boolean;
  endpoint?: string;
}

export interface BrokerAccount {
  id: string;
  broker: BrokerName;
  equity: number;
  cash: number;
  buyingPower: number;
  currency: string;
  status: 'active' | 'restricted' | 'disabled';
  pdt: boolean;           // pattern day trader flag (Alpaca-specific)
  dayTradeCount: number;
  lastSync: Date;
}

export interface BrokerOrderResult {
  success: boolean;
  exchangeOrderId?: string;
  status: 'submitted' | 'rejected' | 'filled';
  fillPrice?: number;
  fillQuantity?: number;
  message?: string;
  latencyMs: number;
}

export interface BrokerPositionData {
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  assetClass: string;
}

export interface BrokerBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/* ── Broker Connector Interface ────────────────────────────────────────── */

export interface BrokerConnector {
  name: BrokerName;
  getAccount(): Promise<BrokerAccount>;
  submitOrder(params: BrokerSubmitParams): Promise<BrokerOrderResult>;
  cancelOrder(exchangeOrderId: string): Promise<{ success: boolean; message?: string }>;
  getPositions(): Promise<BrokerPositionData[]>;
  getOpenOrders(): Promise<BrokerOrderSummary[]>;
  getBars(symbol: string, timeframe: string, limit: number): Promise<BrokerBar[]>;
  healthCheck(): Promise<{ ok: boolean; latencyMs: number }>;
}

export interface BrokerSubmitParams {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce: TimeInForce;
  clientOrderId: string;
}

export interface BrokerOrderSummary {
  exchangeOrderId: string;
  clientOrderId: string;
  symbol: string;
  side: OrderSide;
  type: string;
  quantity: number;
  filledQuantity: number;
  price?: number;
  status: string;
  createdAt: Date;
}

/* ── Alpaca Connector ──────────────────────────────────────────────────── */

const ALPACA_PAPER_URL = 'https://paper-api.alpaca.markets';
const ALPACA_LIVE_URL = 'https://api.alpaca.markets';
const ALPACA_DATA_URL = 'https://data.alpaca.markets';

export function createAlpacaConnector(creds: BrokerCredentials): BrokerConnector {
  const baseUrl = creds.isPaper ? ALPACA_PAPER_URL : ALPACA_LIVE_URL;
  const headers = {
    'APCA-API-KEY-ID': creds.apiKey,
    'APCA-API-SECRET-KEY': creds.apiSecret,
    'Content-Type': 'application/json',
  };

  async function alpacaFetch(path: string, opts: { method?: string; body?: string; headers?: Record<string, string> } = {}): Promise<any> {
    const start = Date.now();
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, { ...opts, headers: { ...headers, ...opts.headers } });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Alpaca ${res.status}: ${body} (${latencyMs}ms)`);
    }
    const data = await res.json();
    return { data, latencyMs };
  }

  async function alpacaDataFetch(path: string): Promise<any> {
    const url = `${ALPACA_DATA_URL}${path}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Alpaca data ${res.status}`);
    return res.json();
  }

  const connector: BrokerConnector = {
    name: 'alpaca',

    async getAccount(): Promise<BrokerAccount> {
      const { data, latencyMs } = await alpacaFetch('/v2/account');
      return {
        id: data.id,
        broker: 'alpaca',
        equity: parseFloat(data.equity),
        cash: parseFloat(data.cash),
        buyingPower: parseFloat(data.buying_power),
        currency: data.currency,
        status: data.status === 'ACTIVE' ? 'active' : 'restricted',
        pdt: data.pattern_day_trader,
        dayTradeCount: data.daytrade_count,
        lastSync: new Date(),
      };
    },

    async submitOrder(params: BrokerSubmitParams): Promise<BrokerOrderResult> {
      const body: Record<string, unknown> = {
        symbol: params.symbol.replace('/', ''),
        side: params.side,
        type: params.type === 'stop_limit' ? 'stop_limit' : params.type,
        qty: params.quantity.toString(),
        time_in_force: params.timeInForce.toLowerCase(),
        client_order_id: params.clientOrderId,
      };
      if (params.price != null) body.limit_price = params.price.toString();
      if (params.stopPrice != null) body.stop_price = params.stopPrice.toString();

      try {
        const { data, latencyMs } = await alpacaFetch('/v2/orders', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        return {
          success: true,
          exchangeOrderId: data.id,
          status: data.status === 'filled' ? 'filled' : 'submitted',
          fillPrice: data.filled_avg_price ? parseFloat(data.filled_avg_price) : undefined,
          fillQuantity: data.filled_qty ? parseFloat(data.filled_qty) : undefined,
          latencyMs,
        };
      } catch (err: any) {
        return { success: false, status: 'rejected', message: err.message, latencyMs: 0 };
      }
    },

    async cancelOrder(exchangeOrderId: string) {
      try {
        await alpacaFetch(`/v2/orders/${encodeURIComponent(exchangeOrderId)}`, { method: 'DELETE' });
        return { success: true };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    },

    async getPositions(): Promise<BrokerPositionData[]> {
      const { data } = await alpacaFetch('/v2/positions');
      return data.map((p: any) => ({
        symbol: p.symbol,
        side: parseFloat(p.qty) >= 0 ? 'long' as const : 'short' as const,
        quantity: Math.abs(parseFloat(p.qty)),
        entryPrice: parseFloat(p.avg_entry_price),
        currentPrice: parseFloat(p.current_price),
        marketValue: parseFloat(p.market_value),
        unrealizedPnl: parseFloat(p.unrealized_pl),
        unrealizedPnlPct: parseFloat(p.unrealized_plpc) * 100,
        assetClass: p.asset_class,
      }));
    },

    async getOpenOrders(): Promise<BrokerOrderSummary[]> {
      const { data } = await alpacaFetch('/v2/orders?status=open');
      return data.map((o: any) => ({
        exchangeOrderId: o.id,
        clientOrderId: o.client_order_id,
        symbol: o.symbol,
        side: o.side as OrderSide,
        type: o.type,
        quantity: parseFloat(o.qty),
        filledQuantity: parseFloat(o.filled_qty || '0'),
        price: o.limit_price ? parseFloat(o.limit_price) : undefined,
        status: o.status,
        createdAt: new Date(o.created_at),
      }));
    },

    async getBars(symbol: string, timeframe: string, limit: number): Promise<BrokerBar[]> {
      const sym = symbol.replace('/', '');
      const tfMap: Record<string, string> = {
        '1m': '1Min', '5m': '5Min', '15m': '15Min', '1h': '1Hour', '4h': '4Hour', '1d': '1Day',
      };
      const tf = tfMap[timeframe] ?? '1Day';
      const data = await alpacaDataFetch(
        `/v2/stocks/${encodeURIComponent(sym)}/bars?timeframe=${tf}&limit=${limit}&feed=iex`,
      );
      return (data.bars ?? []).map((b: any) => ({
        timestamp: new Date(b.t).getTime(),
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
        volume: b.v,
      }));
    },

    async healthCheck() {
      const start = Date.now();
      try {
        await alpacaFetch('/v2/account');
        return { ok: true, latencyMs: Date.now() - start };
      } catch {
        return { ok: false, latencyMs: Date.now() - start };
      }
    },
  };

  return connector;
}

/* ── CCXT-Style Binance Connector ──────────────────────────────────────── */

const BINANCE_LIVE_URL = 'https://api.binance.com';
const BINANCE_TESTNET_URL = 'https://testnet.binance.vision';

function binanceSign(queryString: string, secret: string): string {
  return createHmac('sha256', secret).update(queryString).digest('hex');
}

export function createBinanceConnector(creds: BrokerCredentials): BrokerConnector {
  const baseUrl = creds.isPaper ? BINANCE_TESTNET_URL : BINANCE_LIVE_URL;

  async function binanceFetch(path: string, params: Record<string, string> = {}, method = 'GET', signed = false): Promise<any> {
    const start = Date.now();
    const qs = new URLSearchParams(params);
    if (signed) {
      qs.set('timestamp', Date.now().toString());
      qs.set('recvWindow', '5000');
      qs.set('signature', binanceSign(qs.toString(), creds.apiSecret));
    }
    const url = method === 'GET'
      ? `${baseUrl}${path}?${qs.toString()}`
      : `${baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        'X-MBX-APIKEY': creds.apiKey,
        ...(method !== 'GET' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      ...(method !== 'GET' ? { body: qs.toString() } : {}),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Binance ${res.status}: ${body} (${latencyMs}ms)`);
    }
    return { data: await res.json(), latencyMs };
  }

  const connector: BrokerConnector = {
    name: 'ccxt_binance',

    async getAccount(): Promise<BrokerAccount> {
      const { data } = await binanceFetch('/api/v3/account', {}, 'GET', true);
      const balances = (data.balances ?? []) as Array<{ asset: string; free: string; locked: string }>;
      const usdtBal = balances.find((b) => b.asset === 'USDT');
      const equity = balances.reduce(
        (sum: number, b: any) => sum + parseFloat(b.free) + parseFloat(b.locked), 0,
      );
      return {
        id: `binance-${creds.apiKey.slice(0, 8)}`,
        broker: 'ccxt_binance',
        equity,
        cash: parseFloat(usdtBal?.free ?? '0'),
        buyingPower: parseFloat(usdtBal?.free ?? '0'),
        currency: 'USDT',
        status: data.canTrade ? 'active' : 'restricted',
        pdt: false,
        dayTradeCount: 0,
        lastSync: new Date(),
      };
    },

    async submitOrder(params: BrokerSubmitParams): Promise<BrokerOrderResult> {
      const start = Date.now();
      const orderParams: Record<string, string> = {
        symbol: params.symbol.replace('/', ''),
        side: params.side.toUpperCase(),
        type: params.type === 'market' ? 'MARKET'
            : params.type === 'limit' ? 'LIMIT'
            : params.type === 'stop' ? 'STOP_LOSS_LIMIT' : 'LIMIT',
        quantity: params.quantity.toString(),
        newClientOrderId: params.clientOrderId,
      };
      if (params.type !== 'market') {
        orderParams.timeInForce = params.timeInForce.toUpperCase();
      }
      if (params.price != null) orderParams.price = params.price.toString();
      if (params.stopPrice != null) orderParams.stopPrice = params.stopPrice.toString();

      try {
        const { data, latencyMs } = await binanceFetch('/api/v3/order', orderParams, 'POST', true);
        return {
          success: true,
          exchangeOrderId: String(data.orderId),
          status: data.status === 'FILLED' ? 'filled' : 'submitted',
          fillPrice: data.fills?.length > 0
            ? data.fills.reduce((s: number, f: any) => s + parseFloat(f.price) * parseFloat(f.qty), 0)
              / data.fills.reduce((s: number, f: any) => s + parseFloat(f.qty), 0)
            : undefined,
          fillQuantity: parseFloat(data.executedQty || '0') || undefined,
          latencyMs,
        };
      } catch (err: any) {
        return { success: false, status: 'rejected', message: err.message, latencyMs: Date.now() - start };
      }
    },

    async cancelOrder(exchangeOrderId: string) {
      try {
        await binanceFetch('/api/v3/order', { orderId: exchangeOrderId }, 'DELETE', true);
        return { success: true };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    },

    async getPositions(): Promise<BrokerPositionData[]> {
      const { data } = await binanceFetch('/api/v3/account', {}, 'GET', true);
      const balances = (data.balances ?? []) as Array<{ asset: string; free: string; locked: string }>;
      return balances
        .filter((b) => parseFloat(b.free) + parseFloat(b.locked) > 0 && b.asset !== 'USDT')
        .map((b) => ({
          symbol: `${b.asset}USDT`,
          side: 'long' as const,
          quantity: parseFloat(b.free) + parseFloat(b.locked),
          entryPrice: 0,
          currentPrice: 0,
          marketValue: 0,
          unrealizedPnl: 0,
          unrealizedPnlPct: 0,
          assetClass: 'crypto',
        }));
    },

    async getOpenOrders(): Promise<BrokerOrderSummary[]> {
      const { data } = await binanceFetch('/api/v3/openOrders', {}, 'GET', true);
      return (data as any[]).map((o) => ({
        exchangeOrderId: String(o.orderId),
        clientOrderId: o.clientOrderId,
        symbol: o.symbol,
        side: o.side.toLowerCase() as OrderSide,
        type: o.type,
        quantity: parseFloat(o.origQty),
        filledQuantity: parseFloat(o.executedQty),
        price: parseFloat(o.price) || undefined,
        status: o.status,
        createdAt: new Date(o.time),
      }));
    },

    async getBars(symbol: string, timeframe: string, limit: number): Promise<BrokerBar[]> {
      const tfMap: Record<string, string> = {
        '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d',
      };
      const { data } = await binanceFetch('/api/v3/klines', {
        symbol: symbol.replace('/', ''), interval: tfMap[timeframe] ?? '1h', limit: String(limit),
      });
      return (data as any[][]).map((k) => ({
        timestamp: k[0] as number,
        open: parseFloat(k[1] as string),
        high: parseFloat(k[2] as string),
        low: parseFloat(k[3] as string),
        close: parseFloat(k[4] as string),
        volume: parseFloat(k[5] as string),
      }));
    },

    async healthCheck() {
      const start = Date.now();
      try {
        await binanceFetch('/api/v3/ping');
        return { ok: true, latencyMs: Date.now() - start };
      } catch {
        return { ok: false, latencyMs: Date.now() - start };
      }
    },
  };

  return connector;
}

/* ── CCXT-Style Bybit Connector ───────────────────────────────────────── */

const BYBIT_LIVE_URL = 'https://api.bybit.com';
const BYBIT_TESTNET_URL = 'https://api-testnet.bybit.com';

function bybitSign(timestamp: string, apiKey: string, queryString: string, secret: string): string {
  const preSign = `${timestamp}${apiKey}5000${queryString}`;
  return createHmac('sha256', secret).update(preSign).digest('hex');
}

export function createBybitConnector(creds: BrokerCredentials): BrokerConnector {
  const baseUrl = creds.isPaper ? BYBIT_TESTNET_URL : BYBIT_LIVE_URL;

  async function bybitFetch(path: string, params: Record<string, string> = {}, method = 'GET'): Promise<any> {
    const start = Date.now();
    const timestamp = Date.now().toString();
    const qs = method === 'GET' ? new URLSearchParams(params).toString() : JSON.stringify(params);
    const sign = bybitSign(timestamp, creds.apiKey, qs, creds.apiSecret);

    const headers: Record<string, string> = {
      'X-BAPI-API-KEY': creds.apiKey,
      'X-BAPI-SIGN': sign,
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': '5000',
      'Content-Type': 'application/json',
    };

    const url = method === 'GET' && qs
      ? `${baseUrl}${path}?${qs}` : `${baseUrl}${path}`;

    const res = await fetch(url, {
      method, headers,
      ...(method !== 'GET' ? { body: JSON.stringify(params) } : {}),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Bybit ${res.status}: ${body} (${latencyMs}ms)`);
    }
    const data = await res.json();
    if (data.retCode !== 0) throw new Error(`Bybit API error ${data.retCode}: ${data.retMsg}`);
    return { data: data.result, latencyMs };
  }

  const connector: BrokerConnector = {
    name: 'ccxt_bybit',

    async getAccount(): Promise<BrokerAccount> {
      const { data } = await bybitFetch('/v5/account/wallet-balance', { accountType: 'UNIFIED' });
      const account = data.list?.[0];
      return {
        id: `bybit-${creds.apiKey.slice(0, 8)}`,
        broker: 'ccxt_bybit',
        equity: parseFloat(account?.totalEquity ?? '0'),
        cash: parseFloat(account?.totalAvailableBalance ?? '0'),
        buyingPower: parseFloat(account?.totalAvailableBalance ?? '0'),
        currency: 'USDT',
        status: 'active',
        pdt: false,
        dayTradeCount: 0,
        lastSync: new Date(),
      };
    },

    async submitOrder(params: BrokerSubmitParams): Promise<BrokerOrderResult> {
      const start = Date.now();
      const orderParams: Record<string, string> = {
        category: 'spot',
        symbol: params.symbol.replace('/', ''),
        side: params.side === 'buy' ? 'Buy' : 'Sell',
        orderType: params.type === 'market' ? 'Market' : 'Limit',
        qty: params.quantity.toString(),
        orderLinkId: params.clientOrderId,
      };
      if (params.price != null) orderParams.price = params.price.toString();
      if (params.timeInForce) orderParams.timeInForce = params.timeInForce.toUpperCase();

      try {
        const { data, latencyMs } = await bybitFetch('/v5/order/create', orderParams, 'POST');
        return {
          success: true,
          exchangeOrderId: data.orderId,
          status: 'submitted',
          latencyMs,
        };
      } catch (err: any) {
        return { success: false, status: 'rejected', message: err.message, latencyMs: Date.now() - start };
      }
    },

    async cancelOrder(exchangeOrderId: string) {
      try {
        await bybitFetch('/v5/order/cancel', { category: 'spot', orderId: exchangeOrderId }, 'POST');
        return { success: true };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    },

    async getPositions(): Promise<BrokerPositionData[]> {
      const { data } = await bybitFetch('/v5/position/list', { category: 'spot' });
      return (data.list ?? []).map((p: any) => ({
        symbol: p.symbol,
        side: p.side === 'Buy' ? 'long' as const : 'short' as const,
        quantity: parseFloat(p.size || '0'),
        entryPrice: parseFloat(p.avgPrice || '0'),
        currentPrice: parseFloat(p.markPrice || '0'),
        marketValue: parseFloat(p.positionValue || '0'),
        unrealizedPnl: parseFloat(p.unrealisedPnl || '0'),
        unrealizedPnlPct: 0,
        assetClass: 'crypto',
      }));
    },

    async getOpenOrders(): Promise<BrokerOrderSummary[]> {
      const { data } = await bybitFetch('/v5/order/realtime', { category: 'spot' });
      return (data.list ?? []).map((o: any) => ({
        exchangeOrderId: o.orderId,
        clientOrderId: o.orderLinkId,
        symbol: o.symbol,
        side: o.side === 'Buy' ? 'buy' as OrderSide : 'sell' as OrderSide,
        type: o.orderType,
        quantity: parseFloat(o.qty),
        filledQuantity: parseFloat(o.cumExecQty || '0'),
        price: parseFloat(o.price) || undefined,
        status: o.orderStatus,
        createdAt: new Date(parseInt(o.createdTime)),
      }));
    },

    async getBars(symbol: string, timeframe: string, limit: number): Promise<BrokerBar[]> {
      const tfMap: Record<string, string> = {
        '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': 'D',
      };
      const { data } = await bybitFetch('/v5/market/kline', {
        category: 'spot', symbol: symbol.replace('/', ''),
        interval: tfMap[timeframe] ?? '60', limit: String(limit),
      });
      return (data.list ?? []).map((k: any) => ({
        timestamp: parseInt(k[0]),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));
    },

    async healthCheck() {
      const start = Date.now();
      try {
        const res = await fetch(`${baseUrl}/v5/market/time`);
        return { ok: res.ok, latencyMs: Date.now() - start };
      } catch {
        return { ok: false, latencyMs: Date.now() - start };
      }
    },
  };

  return connector;
}

/* ── Paper Trading Connector (local simulation) ───────────────────────── */

export function createPaperConnector(initialBalance: number = 100_000): BrokerConnector {
  let cash = initialBalance;
  const positions = new Map<string, BrokerPositionData>();
  const orders = new Map<string, BrokerOrderSummary>();

  const connector: BrokerConnector = {
    name: 'paper',

    async getAccount(): Promise<BrokerAccount> {
      let equity = cash;
      for (const p of positions.values()) {
        equity += p.marketValue;
      }
      return {
        id: 'paper-account',
        broker: 'paper',
        equity,
        cash,
        buyingPower: cash * 2,
        currency: 'USD',
        status: 'active',
        pdt: false,
        dayTradeCount: 0,
        lastSync: new Date(),
      };
    },

    async submitOrder(params: BrokerSubmitParams): Promise<BrokerOrderResult> {
      const start = Date.now();
      const price = params.price ?? params.stopPrice ?? 0;
      const cost = price * params.quantity;

      if (params.side === 'buy' && cost > cash) {
        return { success: false, status: 'rejected', message: 'Insufficient funds', latencyMs: Date.now() - start };
      }

      // Instant fill for paper trading
      const orderId = `paper-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      if (params.side === 'buy') {
        cash -= cost;
        const existing = positions.get(params.symbol);
        if (existing) {
          const totalQty = existing.quantity + params.quantity;
          const avgPrice = (existing.entryPrice * existing.quantity + price * params.quantity) / totalQty;
          positions.set(params.symbol, { ...existing, quantity: totalQty, entryPrice: avgPrice, marketValue: totalQty * price });
        } else {
          positions.set(params.symbol, {
            symbol: params.symbol,
            side: 'long',
            quantity: params.quantity,
            entryPrice: price,
            currentPrice: price,
            marketValue: cost,
            unrealizedPnl: 0,
            unrealizedPnlPct: 0,
            assetClass: 'us_equity',
          });
        }
      } else {
        const existing = positions.get(params.symbol);
        if (existing) {
          const remaining = existing.quantity - params.quantity;
          cash += price * params.quantity;
          if (remaining <= 0) {
            positions.delete(params.symbol);
          } else {
            positions.set(params.symbol, { ...existing, quantity: remaining, marketValue: remaining * price });
          }
        }
      }

      orders.set(orderId, {
        exchangeOrderId: orderId,
        clientOrderId: params.clientOrderId,
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: params.quantity,
        filledQuantity: params.quantity,
        price,
        status: 'filled',
        createdAt: new Date(),
      });

      return {
        success: true,
        exchangeOrderId: orderId,
        status: 'filled',
        fillPrice: price,
        fillQuantity: params.quantity,
        latencyMs: Date.now() - start,
      };
    },

    async cancelOrder(exchangeOrderId: string) {
      orders.delete(exchangeOrderId);
      return { success: true };
    },

    async getPositions(): Promise<BrokerPositionData[]> {
      return Array.from(positions.values());
    },

    async getOpenOrders(): Promise<BrokerOrderSummary[]> {
      return Array.from(orders.values()).filter((o) => o.status !== 'filled');
    },

    async getBars(): Promise<BrokerBar[]> {
      return []; // Paper connector defers to real data providers
    },

    async healthCheck() {
      return { ok: true, latencyMs: 0 };
    },
  };

  return connector;
}

/* ── Broker Registry ───────────────────────────────────────────────────── */

export interface BrokerConfig {
  name: BrokerName;
  credentials?: BrokerCredentials;
  enabled: boolean;
}

export class BrokerRegistry {
  private connectors = new Map<BrokerName, BrokerConnector>();

  register(name: BrokerName, connector: BrokerConnector): void {
    this.connectors.set(name, connector);
  }

  get(name: BrokerName): BrokerConnector | undefined {
    return this.connectors.get(name);
  }

  getDefault(): BrokerConnector {
    return this.connectors.get('paper') ?? createPaperConnector();
  }

  list(): BrokerName[] {
    return Array.from(this.connectors.keys());
  }

  async healthCheckAll(): Promise<Record<BrokerName, { ok: boolean; latencyMs: number }>> {
    const results: Record<string, { ok: boolean; latencyMs: number }> = {};
    for (const [name, conn] of this.connectors) {
      results[name] = await conn.healthCheck();
    }
    return results as Record<BrokerName, { ok: boolean; latencyMs: number }>;
  }
}

export function createDefaultBrokerRegistry(): BrokerRegistry {
  const registry = new BrokerRegistry();
  registry.register('paper', createPaperConnector());
  return registry;
}
