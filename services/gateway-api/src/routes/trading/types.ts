import type { TradingEvent } from '@sven/trading-platform/autonomous';

export interface GpuNode {
  name: string;
  endpoint: string;
  model: string;
  role: 'fast' | 'power';
  apiFormat: 'ollama' | 'openai';
  healthy: boolean;
  lastCheck: number;
  lastLatencyMs: number;
  consecutiveFailures: number;
}

export interface GpuUtilization {
  node: GpuNode;
  activeRequests: number;
  maxConcurrent: number;
  lastResponseMs: number;
  taskPriority: GpuTaskPriority;
}

export type GpuTaskPriority = 'user' | 'trading' | 'backtest' | 'learning';

export interface SvenMessage {
  id: string;
  type: 'trade_alert' | 'market_insight' | 'scheduled' | 'system';
  title: string;
  body: string;
  symbol?: string;
  severity: 'info' | 'warning' | 'critical';
  read: boolean;
  createdAt: string;
}

export interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  publishedAt: Date;
  url: string;
  currencies: string[];
  kind: string;
  sentiment: string | null;
}

export interface GoalMilestone {
  id: string;
  name: string;
  targetBalance: number;
  reward: string;
  achieved: boolean;
  achievedAt: Date | null;
}

export interface PositionSignals {
  kronos: 'long' | 'short' | 'neutral';
  mirofish: 'long' | 'short' | 'neutral';
  technical: 'long' | 'short' | 'neutral';
  news: 'long' | 'short' | 'neutral';
  tradeSide: 'long' | 'short';
}

export interface DynamicSymbol {
  symbol: string;
  binanceSymbol: string;
  discoveredFrom: string;
  addedAt: Date;
  expiresAt: Date;
  newsScore: number;
  trades: number;
}

export interface TradeLogEntry {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  confidence: number;
  reasoning: string;
  llmNode: string;
  executedAt: string;
}

export interface ScheduledMessage {
  id: string;
  message: string;
  scheduledFor: Date;
  delivered: boolean;
}

export interface NewsSourceHealth {
  ok: number;
  fail: number;
  lastOk: Date | null;
  lastFail: Date | null;
}

export interface NewsDigest {
  summary: string;
  timestamp: Date;
  keyThemes: string[];
}

export interface LlmCallResult {
  ok: boolean;
  content: string;
  status: number;
}
