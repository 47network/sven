import type { NewsArticle, NewsSourceHealth } from './types.js';

export type RecordSourceResult = (source: string, success: boolean) => void;

export function createNewsSourceHealthTracker(): {
  health: Record<string, NewsSourceHealth>;
  record: RecordSourceResult;
} {
  const health: Record<string, NewsSourceHealth> = {};
  const record: RecordSourceResult = (source, success) => {
    if (!health[source]) health[source] = { ok: 0, fail: 0, lastOk: null, lastFail: null };
    if (success) { health[source]!.ok++; health[source]!.lastOk = new Date(); }
    else { health[source]!.fail++; health[source]!.lastFail = new Date(); }
  };
  return { health, record };
}

export async function fetchCryptoPanicNews(
  timeoutMs: number,
  record: RecordSourceResult,
): Promise<NewsArticle[]> {
  const src = 'cryptopanic';
  try {
    const url = 'https://cryptopanic.com/api/free/v1/posts/?auth_token=free&public=true&filter=important&currencies=BTC,ETH,SOL,BNB,XRP';
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) { record(src, false); return []; }
    const data = (await res.json()) as { results?: Array<{ id: number; title: string; source: { domain: string }; published_at: string; url: string; currencies?: Array<{ code: string }>; kind: string; votes?: { positive: number; negative: number } }> };
    const articles: NewsArticle[] = [];
    for (const a of data.results ?? []) {
      const currencies = (a.currencies ?? []).map(c => `${c.code}/USDT`);
      const positive = a.votes?.positive ?? 0;
      const negative = a.votes?.negative ?? 0;
      const voteTotal = positive + negative;
      const sentimentStr = voteTotal > 0 ? (positive > negative ? 'positive' : negative > positive ? 'negative' : 'neutral') : null;
      articles.push({
        id: `cpanic-${a.id}`,
        headline: a.title,
        source: a.source?.domain ?? 'cryptopanic',
        publishedAt: new Date(a.published_at),
        url: a.url,
        currencies,
        kind: a.kind,
        sentiment: sentimentStr,
      });
    }
    record(src, true);
    return articles;
  } catch {
    record(src, false);
    return [];
  }
}

export async function fetchCoinGeckoTrending(
  timeoutMs: number,
  record: RecordSourceResult,
): Promise<NewsArticle[]> {
  const src = 'coingecko';
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/search/trending', { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) { record(src, false); return []; }
    const data = (await res.json()) as { coins?: Array<{ item: { id: string; symbol: string; name: string; market_cap_rank: number; price_btc: number; score: number } }> };
    const articles: NewsArticle[] = [];
    for (const c of data.coins ?? []) {
      const sym = c.item.symbol.toUpperCase();
      articles.push({
        id: `cgecko-trending-${c.item.id}-${new Date().toISOString().slice(0, 13)}`,
        headline: `${c.item.name} (${sym}) is trending on CoinGecko — rank #${c.item.market_cap_rank ?? 'N/A'}, search interest surging`,
        source: 'coingecko-trending',
        publishedAt: new Date(),
        url: `https://www.coingecko.com/en/coins/${c.item.id}`,
        currencies: [`${sym}/USDT`],
        kind: 'trending',
        sentiment: 'positive',
      });
    }
    record(src, true);
    return articles;
  } catch {
    record(src, false);
    return [];
  }
}

export async function fetchBinanceMovers(
  timeoutMs: number,
  record: RecordSourceResult,
): Promise<NewsArticle[]> {
  const src = 'binance-movers';
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr', { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) { record(src, false); return []; }
    const tickers = (await res.json()) as Array<{ symbol: string; priceChangePercent: string; volume: string; quoteVolume: string }>;
    const usdtPairs = tickers
      .filter(t => t.symbol.endsWith('USDT'))
      .map(t => ({ symbol: t.symbol, change: parseFloat(t.priceChangePercent), absChange: Math.abs(parseFloat(t.priceChangePercent)), volume: parseFloat(t.quoteVolume) }))
      .filter(t => t.volume > 10_000_000)
      .sort((a, b) => b.absChange - a.absChange)
      .slice(0, 15);

    const articles: NewsArticle[] = [];
    for (const t of usdtPairs) {
      const base = t.symbol.replace('USDT', '');
      const direction = t.change > 0 ? 'surging' : 'dropping';
      articles.push({
        id: `binance-mover-${t.symbol}-${new Date().toISOString().slice(0, 13)}`,
        headline: `${base} ${direction} ${Math.abs(t.change).toFixed(1)}% in 24h — $${(t.volume / 1_000_000).toFixed(0)}M volume on Binance`,
        source: 'binance-24hr',
        publishedAt: new Date(),
        url: `https://www.binance.com/en/trade/${base}_USDT`,
        currencies: [`${base}/USDT`],
        kind: 'market_data',
        sentiment: t.change > 5 ? 'positive' : t.change < -5 ? 'negative' : 'neutral',
      });
    }
    record(src, true);
    return articles;
  } catch {
    record(src, false);
    return [];
  }
}

export async function fetchBinanceAnnouncements(
  timeoutMs: number,
  record: RecordSourceResult,
): Promise<NewsArticle[]> {
  const src = 'binance-announce';
  try {
    const res = await fetch('https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&catalogId=48&pageNo=1&pageSize=10', { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) { record(src, false); return []; }
    const data = (await res.json()) as { data?: { catalogs?: Array<{ articles?: Array<{ id: number; title: string; releaseDate: number }> }> } };
    const articles: NewsArticle[] = [];
    const rawArticles = data.data?.catalogs?.[0]?.articles ?? [];
    for (const a of rawArticles) {
      const tickerMatches = a.title.match(/\(([A-Z]{2,10})\)/g) ?? [];
      const currencies = tickerMatches.map(m => `${m.replace(/[()]/g, '')}/USDT`);
      articles.push({
        id: `binance-ann-${a.id}`,
        headline: a.title,
        source: 'binance-announcements',
        publishedAt: new Date(a.releaseDate),
        url: `https://www.binance.com/en/support/announcement/${a.id}`,
        currencies,
        kind: 'announcement',
        sentiment: a.title.toLowerCase().includes('delist') ? 'negative' : a.title.toLowerCase().includes('list') ? 'positive' : 'neutral',
      });
    }
    record(src, true);
    return articles;
  } catch {
    record(src, false);
    return [];
  }
}

export async function fetchFearGreedIndex(
  timeoutMs: number,
  record: RecordSourceResult,
): Promise<NewsArticle[]> {
  const src = 'fear-greed';
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) { record(src, false); return []; }
    const data = (await res.json()) as { data?: Array<{ value: string; value_classification: string; timestamp: string }> };
    const entry = data.data?.[0];
    if (!entry) return [];

    const value = parseInt(entry.value, 10);
    const classification = entry.value_classification;
    let sentiment: string | null = 'neutral';
    if (value <= 25) sentiment = 'negative';
    else if (value >= 75) sentiment = 'positive';

    record(src, true);
    return [{
      id: `fng-${entry.timestamp}`,
      headline: `Crypto Fear & Greed Index: ${value}/100 (${classification}) — market sentiment ${value <= 25 ? 'extremely fearful, potential buying opportunity' : value >= 75 ? 'extremely greedy, potential correction ahead' : 'neutral'}`,
      source: 'alternative.me',
      publishedAt: new Date(parseInt(entry.timestamp, 10) * 1000),
      url: 'https://alternative.me/crypto/fear-and-greed-index/',
      currencies: ['BTC/USDT', 'ETH/USDT'],
      kind: 'sentiment_index',
      sentiment,
    }];
  } catch {
    record(src, false);
    return [];
  }
}

export async function fetchCoinGeckoGlobal(
  timeoutMs: number,
  record: RecordSourceResult,
): Promise<NewsArticle[]> {
  const src = 'coingecko-global';
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global', { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) { record(src, false); return []; }
    const data = (await res.json()) as { data?: { total_market_cap?: Record<string, number>; market_cap_change_percentage_24h_usd?: number; active_cryptocurrencies?: number; markets?: number } };
    const g = data.data;
    if (!g) return [];

    const capChangeStr = (g.market_cap_change_percentage_24h_usd ?? 0).toFixed(2);
    const totalCapB = ((g.total_market_cap?.['usd'] ?? 0) / 1e9).toFixed(0);
    const direction = (g.market_cap_change_percentage_24h_usd ?? 0) > 0 ? 'up' : 'down';

    record(src, true);
    return [{
      id: `cgecko-global-${new Date().toISOString().slice(0, 13)}`,
      headline: `Global crypto market cap $${totalCapB}B (${direction} ${Math.abs(parseFloat(capChangeStr))}% in 24h) — ${g.active_cryptocurrencies?.toLocaleString() ?? '?'} active currencies across ${g.markets ?? '?'} markets`,
      source: 'coingecko-global',
      publishedAt: new Date(),
      url: 'https://www.coingecko.com/',
      currencies: [],
      kind: 'market_overview',
      sentiment: parseFloat(capChangeStr) > 2 ? 'positive' : parseFloat(capChangeStr) < -2 ? 'negative' : 'neutral',
    }];
  } catch {
    record(src, false);
    return [];
  }
}

export async function fetchDefiLlamaTvl(
  timeoutMs: number,
  record: RecordSourceResult,
): Promise<NewsArticle[]> {
  const src = 'defillama';
  try {
    const res = await fetch('https://api.llama.fi/protocols', { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) { record(src, false); return []; }
    const protocols = (await res.json()) as Array<{ name: string; symbol: string; tvl: number; change_1d: number; category: string; chains: string[] }>;
    const movers = protocols
      .filter(p => p.tvl > 100_000_000 && typeof p.change_1d === 'number' && Math.abs(p.change_1d) > 3)
      .sort((a, b) => Math.abs(b.change_1d) - Math.abs(a.change_1d))
      .slice(0, 10);

    const articles: NewsArticle[] = [];
    for (const p of movers) {
      const sym = p.symbol?.toUpperCase() ?? '';
      const direction = p.change_1d > 0 ? 'surging' : 'dropping';
      articles.push({
        id: `defillama-${p.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 13)}`,
        headline: `${p.name}${sym ? ` (${sym})` : ''} TVL ${direction} ${Math.abs(p.change_1d).toFixed(1)}% — $${(p.tvl / 1e9).toFixed(2)}B locked in ${p.category}`,
        source: 'defillama',
        publishedAt: new Date(),
        url: `https://defillama.com/protocol/${p.name.toLowerCase().replace(/\s+/g, '-')}`,
        currencies: sym ? [`${sym}/USDT`] : [],
        kind: 'defi_tvl',
        sentiment: p.change_1d > 5 ? 'positive' : p.change_1d < -5 ? 'negative' : 'neutral',
      });
    }
    record(src, true);
    return articles;
  } catch {
    record(src, false);
    return [];
  }
}

export async function fetchRssNewsSource(
  feedUrl: string,
  sourceName: string,
  timeoutMs: number,
  record: RecordSourceResult,
): Promise<NewsArticle[]> {
  const src = `rss-${sourceName}`;
  try {
    const res = await fetch(feedUrl, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'SvenTradingBot/1.0 (news aggregator)' },
    });
    if (!res.ok) { record(src, false); return []; }
    const xml = await res.text();

    const items: Array<{ title: string; link: string; pubDate: string; description: string }> = [];
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
    for (const itemXml of itemMatches.slice(0, 20)) {
      const title = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() ?? '';
      const link = itemXml.match(/<link>([\s\S]*?)<\/link>/i)?.[1]?.trim() ?? '';
      const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ?? '';
      const description = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim() ?? '';
      if (title) items.push({ title, link, pubDate, description });
    }

    const articles: NewsArticle[] = [];
    for (const item of items) {
      const combinedText = `${item.title} ${item.description}`.toUpperCase();
      const currencies: string[] = [];

      const seen = new Set<string>();
      for (const [kw, pair] of Object.entries(CRYPTO_KEYWORDS)) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        if (regex.test(combinedText) && !seen.has(pair)) {
          currencies.push(pair);
          seen.add(pair);
        }
      }

      const lower = item.title.toLowerCase();
      let sentiment: string | null = null;
      if (/surge|soar|rally|bull|gain|record high|breakout|pump|approved|adoption/i.test(lower)) sentiment = 'positive';
      else if (/crash|plunge|dump|bear|hack|exploit|sec |lawsuit|ban|fraud|collapse/i.test(lower)) sentiment = 'negative';

      let kind = 'news';
      if (/regulation|sec |cftc|law|bill|ban|sanction/i.test(lower)) kind = 'regulation';
      else if (/hack|exploit|breach|vulnerability|rug.?pull/i.test(lower)) kind = 'security';
      else if (/etf|institutional|blackrock|fidelity|grayscale/i.test(lower)) kind = 'institutional';
      else if (/defi|dex|lending|yield|staking/i.test(lower)) kind = 'defi';
      else if (/nft|metaverse|gaming/i.test(lower)) kind = 'nft';

      const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
      if (isNaN(pubDate.getTime())) continue;

      articles.push({
        id: `rss-${sourceName}-${Buffer.from(item.title).toString('base64').slice(0, 32)}`,
        headline: item.title,
        source: sourceName,
        publishedAt: pubDate,
        url: item.link,
        currencies,
        kind,
        sentiment,
      });
    }

    record(src, true);
    return articles;
  } catch {
    record(src, false);
    return [];
  }
}

export const RSS_FEEDS: Array<{ url: string; name: string }> = [
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', name: 'coindesk' },
  { url: 'https://www.theblock.co/rss.xml', name: 'theblock' },
  { url: 'https://decrypt.co/feed', name: 'decrypt' },
  { url: 'https://cointelegraph.com/rss', name: 'cointelegraph' },
  { url: 'https://bitcoinmagazine.com/feed', name: 'bitcoinmagazine' },
  { url: 'https://www.newsbtc.com/feed/', name: 'newsbtc' },
  { url: 'https://cryptoslate.com/feed/', name: 'cryptoslate' },
  { url: 'https://cryptonews.com/news/feed/', name: 'cryptonews' },
  { url: 'https://feeds.reuters.com/reuters/businessNews', name: 'reuters-biz' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', name: 'bbc-biz' },
];

export const CRYPTO_KEYWORDS: Record<string, string> = {
  'BITCOIN': 'BTC/USDT', 'BTC': 'BTC/USDT',
  'ETHEREUM': 'ETH/USDT', 'ETH': 'ETH/USDT', 'ETHER': 'ETH/USDT',
  'SOLANA': 'SOL/USDT', 'SOL': 'SOL/USDT',
  'XRP': 'XRP/USDT', 'RIPPLE': 'XRP/USDT',
  'BNB': 'BNB/USDT', 'BINANCE COIN': 'BNB/USDT',
  'CARDANO': 'ADA/USDT', 'ADA': 'ADA/USDT',
  'DOGECOIN': 'DOGE/USDT', 'DOGE': 'DOGE/USDT',
  'POLKADOT': 'DOT/USDT', 'DOT': 'DOT/USDT',
  'AVALANCHE': 'AVAX/USDT', 'AVAX': 'AVAX/USDT',
  'CHAINLINK': 'LINK/USDT', 'LINK': 'LINK/USDT',
  'POLYGON': 'MATIC/USDT', 'MATIC': 'MATIC/USDT',
  'UNISWAP': 'UNI/USDT', 'UNI': 'UNI/USDT',
  'LITECOIN': 'LTC/USDT', 'LTC': 'LTC/USDT',
  'NEAR PROTOCOL': 'NEAR/USDT', 'NEAR': 'NEAR/USDT',
  'APTOS': 'APT/USDT', 'APT': 'APT/USDT',
  'ARBITRUM': 'ARB/USDT', 'ARB': 'ARB/USDT',
  'OPTIMISM': 'OP/USDT', 'SUI': 'SUI/USDT',
  'INJECTIVE': 'INJ/USDT', 'INJ': 'INJ/USDT',
  'PEPE': 'PEPE/USDT', 'SHIBA': 'SHIB/USDT', 'SHIB': 'SHIB/USDT',
  'TONCOIN': 'TON/USDT', 'TON': 'TON/USDT',
  'RENDER': 'RENDER/USDT', 'FETCH.AI': 'FET/USDT', 'FET': 'FET/USDT',
  'CELESTIA': 'TIA/USDT', 'TIA': 'TIA/USDT',
  'AAVE': 'AAVE/USDT', 'MAKER': 'MKR/USDT', 'MKR': 'MKR/USDT',
};

export const KNOWN_ALTS: Record<string, string> = {
  'DOGE': 'DOGE/USDT', 'ADA': 'ADA/USDT', 'AVAX': 'AVAX/USDT',
  'DOT': 'DOT/USDT', 'LINK': 'LINK/USDT', 'MATIC': 'MATIC/USDT',
  'SHIB': 'SHIB/USDT', 'UNI': 'UNI/USDT', 'LTC': 'LTC/USDT',
  'ATOM': 'ATOM/USDT', 'NEAR': 'NEAR/USDT', 'FTM': 'FTM/USDT',
  'APT': 'APT/USDT', 'ARB': 'ARB/USDT', 'OP': 'OP/USDT',
  'SUI': 'SUI/USDT', 'SEI': 'SEI/USDT', 'TIA': 'TIA/USDT',
  'INJ': 'INJ/USDT', 'PEPE': 'PEPE/USDT', 'WIF': 'WIF/USDT',
  'JUP': 'JUP/USDT', 'RENDER': 'RENDER/USDT', 'FET': 'FET/USDT',
  'ONDO': 'ONDO/USDT', 'TAO': 'TAO/USDT', 'TRX': 'TRX/USDT',
  'TON': 'TON/USDT', 'XLM': 'XLM/USDT', 'ALGO': 'ALGO/USDT',
  'FIL': 'FIL/USDT', 'AAVE': 'AAVE/USDT', 'GRT': 'GRT/USDT',
  'IMX': 'IMX/USDT', 'MANA': 'MANA/USDT', 'SAND': 'SAND/USDT',
  'CRV': 'CRV/USDT', 'MKR': 'MKR/USDT', 'SNX': 'SNX/USDT',
  'RUNE': 'RUNE/USDT', 'COMP': 'COMP/USDT', 'LDO': 'LDO/USDT',
  'STX': 'STX/USDT', 'KAS': 'KAS/USDT', 'BONK': 'BONK/USDT',
  'WLD': 'WLD/USDT', 'PYTH': 'PYTH/USDT', 'JTO': 'JTO/USDT',
  'ENA': 'ENA/USDT', 'PENDLE': 'PENDLE/USDT', 'STRK': 'STRK/USDT',
  'HBAR': 'HBAR/USDT', 'XMR': 'XMR/USDT', 'ETC': 'ETC/USDT',
};
