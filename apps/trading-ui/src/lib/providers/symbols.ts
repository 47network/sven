/* ── Symbol Registry & Provider Mapping ───────────────────── */

export type MarketProvider = 'binance' | 'yahoo';

export interface SymbolConfig {
  /** Display symbol (e.g. BTC/USD) */
  symbol: string;
  /** Human-readable name */
  name: string;
  /** Which provider to fetch from */
  provider: MarketProvider;
  /** Provider-specific symbol (e.g. BTCUSDT for Binance, AAPL for Yahoo) */
  providerSymbol: string;
  /** Binance WS stream name (only for provider=binance) */
  wsStream?: string;
  /** Price decimal places for display */
  pricePrecision: number;
  /** Asset class tag */
  assetClass: 'crypto' | 'stock' | 'forex' | 'commodity' | 'index';
}

/**
 * Default watchlist — crypto via Binance (free, no key),
 * stocks/forex/commodities via Yahoo Finance (server-side proxy).
 */
export const SYMBOL_REGISTRY: SymbolConfig[] = [
  /* ── Crypto (Binance) ─────────────────────────────────────── */
  { symbol: 'BTC/USDT', name: 'Bitcoin', provider: 'binance', providerSymbol: 'BTCUSDT', wsStream: 'btcusdt', pricePrecision: 2, assetClass: 'crypto' },
  { symbol: 'ETH/USDT', name: 'Ethereum', provider: 'binance', providerSymbol: 'ETHUSDT', wsStream: 'ethusdt', pricePrecision: 2, assetClass: 'crypto' },
  { symbol: 'SOL/USDT', name: 'Solana', provider: 'binance', providerSymbol: 'SOLUSDT', wsStream: 'solusdt', pricePrecision: 2, assetClass: 'crypto' },
  { symbol: 'BNB/USDT', name: 'BNB', provider: 'binance', providerSymbol: 'BNBUSDT', wsStream: 'bnbusdt', pricePrecision: 2, assetClass: 'crypto' },
  { symbol: 'XRP/USDT', name: 'Ripple', provider: 'binance', providerSymbol: 'XRPUSDT', wsStream: 'xrpusdt', pricePrecision: 4, assetClass: 'crypto' },
  { symbol: 'ADA/USDT', name: 'Cardano', provider: 'binance', providerSymbol: 'ADAUSDT', wsStream: 'adausdt', pricePrecision: 4, assetClass: 'crypto' },
  { symbol: 'AVAX/USDT', name: 'Avalanche', provider: 'binance', providerSymbol: 'AVAXUSDT', wsStream: 'avaxusdt', pricePrecision: 2, assetClass: 'crypto' },
  { symbol: 'DOGE/USDT', name: 'Dogecoin', provider: 'binance', providerSymbol: 'DOGEUSDT', wsStream: 'dogeusdt', pricePrecision: 5, assetClass: 'crypto' },
  { symbol: 'LINK/USDT', name: 'Chainlink', provider: 'binance', providerSymbol: 'LINKUSDT', wsStream: 'linkusdt', pricePrecision: 2, assetClass: 'crypto' },
  { symbol: 'DOT/USDT', name: 'Polkadot', provider: 'binance', providerSymbol: 'DOTUSDT', wsStream: 'dotusdt', pricePrecision: 3, assetClass: 'crypto' },

  /* ── Stocks (Yahoo Finance) ───────────────────────────────── */
  { symbol: 'AAPL', name: 'Apple Inc', provider: 'yahoo', providerSymbol: 'AAPL', pricePrecision: 2, assetClass: 'stock' },
  { symbol: 'NVDA', name: 'NVIDIA Corp', provider: 'yahoo', providerSymbol: 'NVDA', pricePrecision: 2, assetClass: 'stock' },
  { symbol: 'TSLA', name: 'Tesla Inc', provider: 'yahoo', providerSymbol: 'TSLA', pricePrecision: 2, assetClass: 'stock' },
  { symbol: 'MSFT', name: 'Microsoft', provider: 'yahoo', providerSymbol: 'MSFT', pricePrecision: 2, assetClass: 'stock' },
  { symbol: 'AMZN', name: 'Amazon', provider: 'yahoo', providerSymbol: 'AMZN', pricePrecision: 2, assetClass: 'stock' },

  /* ── Forex (Yahoo Finance) ────────────────────────────────── */
  { symbol: 'EUR/USD', name: 'Euro', provider: 'yahoo', providerSymbol: 'EURUSD=X', pricePrecision: 4, assetClass: 'forex' },
  { symbol: 'GBP/USD', name: 'British Pound', provider: 'yahoo', providerSymbol: 'GBPUSD=X', pricePrecision: 4, assetClass: 'forex' },

  /* ── Commodities (Yahoo Finance) ──────────────────────────── */
  { symbol: 'XAU/USD', name: 'Gold', provider: 'yahoo', providerSymbol: 'GC=F', pricePrecision: 2, assetClass: 'commodity' },

  /* ── Indices (Yahoo Finance) ──────────────────────────────── */
  { symbol: 'SPX500', name: 'S&P 500', provider: 'yahoo', providerSymbol: '^GSPC', pricePrecision: 2, assetClass: 'index' },
];

/** Look up a symbol config by display symbol */
export function getSymbolConfig(symbol: string): SymbolConfig | undefined {
  return SYMBOL_REGISTRY.find((s) => s.symbol === symbol);
}

/** Map internal timeframe to Binance interval */
export function toBinanceInterval(tf: string): string {
  const map: Record<string, string> = {
    '1m': '1m', '5m': '5m', '15m': '15m',
    '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w',
  };
  return map[tf] ?? '15m';
}

/** Map internal timeframe to Yahoo Finance range + interval */
export function toYahooParams(tf: string): { range: string; interval: string } {
  const map: Record<string, { range: string; interval: string }> = {
    '1m': { range: '1d', interval: '1m' },
    '5m': { range: '5d', interval: '5m' },
    '15m': { range: '5d', interval: '15m' },
    '1h': { range: '1mo', interval: '1h' },
    '4h': { range: '3mo', interval: '1d' },   /* Yahoo doesn't have 4h, use 1d as fallback */
    '1d': { range: '1y', interval: '1d' },
    '1w': { range: '5y', interval: '1wk' },
  };
  return map[tf] ?? { range: '5d', interval: '15m' };
}
