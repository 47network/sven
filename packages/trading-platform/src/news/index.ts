// ---------------------------------------------------------------------------
// @sven/trading-platform — News & Geopolitical Impact Analysis
// ---------------------------------------------------------------------------
// News event types, 5-level impact classification, NLP pipeline types,
// sentiment scoring, entity extraction, geopolitical event classification.
// ---------------------------------------------------------------------------

/* ── News Sources ──────────────────────────────────────────────────────── */

export type NewsSource = 'newsapi' | 'finnhub' | 'cryptopanic' | 'gdelt' | 'reddit' | 'x';

/* ── Impact Classification ─────────────────────────────────────────────── */

export type ImpactLevel = 1 | 2 | 3 | 4 | 5;

export const IMPACT_LABELS: Record<ImpactLevel, string> = {
  1: 'Low — Routine earnings, minor analyst notes',
  2: 'Medium — Earnings surprise, regulatory filing, sector news',
  3: 'High — Major earnings miss/beat, M&A, leadership change',
  4: 'Critical — Geopolitical crisis, market crash, black swan event',
  5: 'Extreme — War, pandemic, systemic risk event',
};

export type ImpactCategory = 'earnings' | 'geopolitical' | 'regulation' | 'macro' | 'technical' | 'social' | 'security' | 'natural_disaster';

/* ── News Event ────────────────────────────────────────────────────────── */

export interface NewsEvent {
  id: string;
  createdAt: Date;
  source: NewsSource;
  headline: string;
  summary?: string;
  url?: string;
  symbols: string[];
  sectors: string[];
  countries: string[];
  sentiment: number;            // -1.0 to 1.0
  impactLevel: ImpactLevel;
  impactCategory: ImpactCategory;
  processedAt?: Date;
  signalsEmitted: string[];
  rawData?: Record<string, unknown>;
}

/* ── Impact Classification Engine ──────────────────────────────────────── */

const CRITICAL_KEYWORDS: Record<ImpactLevel, string[]> = {
  5: ['war', 'pandemic', 'systemic collapse', 'nuclear', 'invasion', 'martial law', 'global crisis'],
  4: ['crash', 'black swan', 'sanctions', 'embargo', 'coup', 'default', 'bank run', 'hyperinflation', 'currency crisis'],
  3: ['merger', 'acquisition', 'm&a', 'ceo resign', 'ceo fired', 'fda approval', 'fda reject', 'earnings miss', 'earnings beat', 'guidance cut', 'rate hike', 'rate cut'],
  2: ['earnings report', 'sec filing', 'regulatory', 'analyst upgrade', 'analyst downgrade', 'ipo', 'stock split', 'buyback'],
  1: ['routine', 'scheduled', 'conference', 'dividend', 'minor', 'forecast'],
};

export function classifyImpact(headline: string, summary?: string): { level: ImpactLevel; category: ImpactCategory } {
  const text = `${headline} ${summary ?? ''}`.toLowerCase();

  // Check from highest to lowest impact
  for (const level of [5, 4, 3, 2, 1] as ImpactLevel[]) {
    for (const kw of CRITICAL_KEYWORDS[level]) {
      if (text.includes(kw)) {
        return { level, category: categorizeEvent(text) };
      }
    }
  }

  return { level: 1, category: categorizeEvent(text) };
}

function categorizeEvent(text: string): ImpactCategory {
  if (/earnings|revenue|profit|guidance|eps|quarterly/.test(text)) return 'earnings';
  if (/war|geopoliti|sanction|coup|invasion|military|conflict|border/.test(text)) return 'geopolitical';
  if (/regulat|sec|fda|law|bill|legislation|compliance|ban/.test(text)) return 'regulation';
  if (/rate|inflation|cpi|gdp|unemployment|fed|ecb|boj|macro/.test(text)) return 'macro';
  if (/breakout|support|resistance|trend|technical|chart/.test(text)) return 'technical';
  if (/reddit|twitter|viral|trending|community|sentiment/.test(text)) return 'social';
  if (/hack|breach|exploit|vulnerability|security/.test(text)) return 'security';
  if (/earthquake|hurricane|flood|wildfire|drought|tsunami/.test(text)) return 'natural_disaster';
  return 'macro';
}

/* ── Sentiment Scoring ─────────────────────────────────────────────────── */

const POSITIVE_WORDS = new Set([
  'surge', 'rally', 'bullish', 'soar', 'gain', 'jump', 'boom', 'upgrade',
  'beat', 'exceed', 'strong', 'record', 'high', 'growth', 'optimistic',
  'recovery', 'profit', 'innovative', 'breakthrough', 'approval',
]);

const NEGATIVE_WORDS = new Set([
  'crash', 'plunge', 'bearish', 'drop', 'fall', 'tank', 'bust', 'downgrade',
  'miss', 'weak', 'low', 'decline', 'pessimistic', 'recession', 'loss',
  'fraud', 'scandal', 'lawsuit', 'default', 'bankruptcy', 'hack', 'exploit',
]);

export function scoreSentiment(text: string): number {
  const words = text.toLowerCase().split(/\W+/);
  let positive = 0;
  let negative = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) positive++;
    if (NEGATIVE_WORDS.has(word)) negative++;
  }

  const total = positive + negative;
  if (total === 0) return 0;
  return (positive - negative) / total;
}

/* ── Entity Extraction ─────────────────────────────────────────────────── */

// Common crypto symbol patterns
const CRYPTO_SYMBOLS = new Set(['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'LINK', 'MATIC', 'SHIB', 'UNI', 'ATOM', 'FIL']);

// Stock ticker pattern: 1-5 uppercase letters preceded/followed by non-alpha
const STOCK_TICKER_RE = /\b([A-Z]{1,5})\b/g;

export interface ExtractedEntities {
  symbols: string[];
  sectors: string[];
  countries: string[];
  organizations: string[];
}

const SECTOR_KEYWORDS: Record<string, string[]> = {
  technology: ['tech', 'software', 'ai', 'semiconductor', 'cloud', 'saas'],
  finance: ['bank', 'financial', 'insurance', 'fintech', 'lending'],
  healthcare: ['pharma', 'biotech', 'healthcare', 'medical', 'drug', 'fda'],
  energy: ['oil', 'gas', 'renewable', 'solar', 'wind', 'energy', 'opec'],
  crypto: ['bitcoin', 'ethereum', 'crypto', 'defi', 'nft', 'blockchain', 'token'],
  real_estate: ['housing', 'mortgage', 'reit', 'property', 'real estate'],
};

const COUNTRY_KEYWORDS: Record<string, string[]> = {
  US: ['united states', 'u.s.', 'america', 'fed', 'congress', 'white house', 'wall street'],
  China: ['china', 'beijing', 'pboc', 'shanghai', 'ccp'],
  EU: ['european union', 'eu', 'ecb', 'eurozone', 'brussels'],
  Japan: ['japan', 'boj', 'tokyo', 'nikkei'],
  UK: ['uk', 'britain', 'boe', 'london', 'ftse'],
  Russia: ['russia', 'kremlin', 'moscow', 'ruble'],
};

export function extractEntities(headline: string, summary?: string): ExtractedEntities {
  const text = `${headline} ${summary ?? ''}`;
  const textLower = text.toLowerCase();

  // Extract crypto symbols
  const symbols: string[] = [];
  for (const sym of CRYPTO_SYMBOLS) {
    if (text.includes(sym) || textLower.includes(sym.toLowerCase())) {
      symbols.push(`${sym}/USDT`);
    }
  }

  // Extract sectors
  const sectors: string[] = [];
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some((kw) => textLower.includes(kw))) {
      sectors.push(sector);
    }
  }

  // Extract countries
  const countries: string[] = [];
  for (const [country, keywords] of Object.entries(COUNTRY_KEYWORDS)) {
    if (keywords.some((kw) => textLower.includes(kw))) {
      countries.push(country);
    }
  }

  return { symbols, sectors, countries, organizations: [] };
}

/* ── News Pipeline Processing ──────────────────────────────────────────── */

export interface ProcessedNewsItem {
  event: NewsEvent;
  entities: ExtractedEntities;
  sentimentScore: number;
  impact: { level: ImpactLevel; category: ImpactCategory };
  isDuplicate: boolean;
}

export function processNewsItem(
  source: NewsSource,
  headline: string,
  summary?: string,
  url?: string,
  existingHeadlines: Set<string> = new Set(),
): ProcessedNewsItem {
  // Deduplication: simple substring match
  const normalizedHeadline = headline.toLowerCase().trim();
  const isDuplicate = existingHeadlines.has(normalizedHeadline);

  const entities = extractEntities(headline, summary);
  const sentimentScore = scoreSentiment(`${headline} ${summary ?? ''}`);
  const impact = classifyImpact(headline, summary);

  const event: NewsEvent = {
    id: `news-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date(),
    source,
    headline,
    summary,
    url,
    symbols: entities.symbols,
    sectors: entities.sectors,
    countries: entities.countries,
    sentiment: sentimentScore,
    impactLevel: impact.level,
    impactCategory: impact.category,
    signalsEmitted: [],
  };

  return { event, entities, sentimentScore, impact, isDuplicate };
}

/* ── Sven LLM Analysis Prompt Template ─────────────────────────────────── */

export function buildNewsAnalysisPrompt(
  headline: string,
  positions: { symbol: string; side: string; pnl: number }[],
  recentPredictions: { symbol: string; direction: string; confidence: number }[],
): string {
  const positionsStr = positions.length > 0
    ? positions.map((p) => `  ${p.symbol}: ${p.side}, P&L: ${p.pnl.toFixed(2)}`).join('\n')
    : '  No open positions';

  const predictionsStr = recentPredictions.length > 0
    ? recentPredictions.map((p) => `  ${p.symbol}: ${p.direction} (${(p.confidence * 100).toFixed(0)}%)`).join('\n')
    : '  No recent predictions';

  return `Given this breaking news: "${headline}"

Current market state:
${positionsStr}

Recent predictions:
${predictionsStr}

Assess:
1. Which assets are directly affected?
2. Direction and magnitude of expected impact?
3. How quickly will the market price this in?
4. Should I adjust any current positions?
5. Should I open new positions based on this event?
6. What is the second-order effect (spillover to other assets)?

Respond as JSON with fields: affected_symbols, direction, magnitude (low/medium/high), timeToPrice (minutes), positionAdjustments, newPositions, secondOrderEffects.`;
}

/* ── NATS Subject Constants ────────────────────────────────────────────── */

export const TRADING_NATS_SUBJECTS = {
  SIGNAL: 'sven.trading.signals',
  PREDICTION_KRONOS: 'sven.trading.predictions.kronos',
  PREDICTION_MIROFISH: 'sven.trading.predictions.mirofish',
  PREDICTION_ENSEMBLE: 'sven.trading.predictions.ensemble',
  NEWS_LOW: 'sven.trading.news.1',
  NEWS_MEDIUM: 'sven.trading.news.2',
  NEWS_HIGH: 'sven.trading.news.3',
  NEWS_CRITICAL: 'sven.trading.news.4',
  NEWS_EXTREME: 'sven.trading.news.5',
  ORDERS: 'sven.trading.orders',
  RISK_ALERT: 'sven.trading.risk',
  PORTFOLIO: 'sven.trading.portfolio',
  TOOLS: 'sven.trading.tools',
} as const;

export function newsSubjectForLevel(level: ImpactLevel): string {
  return `sven.trading.news.${level}`;
}
