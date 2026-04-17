/* ── Trading Store (Zustand) ────────────────────────────────── */
import { create } from 'zustand';
import type {
  Position, Order, Signal, Prediction, NewsItem,
  SvenActivity, WatchlistItem, Timeframe, TickerData, Candle,
} from './types';

interface TradingState {
  /* ── Instrument & chart ─────────────────────────────────── */
  activeSymbol: string;
  activeTimeframe: Timeframe;
  watchlist: WatchlistItem[];
  ticker: TickerData | null;
  candles: Candle[];

  /* ── Positions & orders ─────────────────────────────────── */
  positions: Position[];
  orders: Order[];

  /* ── Signals & predictions ──────────────────────────────── */
  signals: Signal[];
  predictions: Prediction[];

  /* ── News ────────────────────────────────────────────────── */
  newsItems: NewsItem[];

  /* ── Sven AI Activity ───────────────────────────────────── */
  activities: SvenActivity[];
  svenStatus: 'idle' | 'analyzing' | 'trading' | 'monitoring';

  /* ── Portfolio ──────────────────────────────────────────── */
  totalCapital: number;
  availableCapital: number;
  totalPnl: number;
  totalPnlPct: number;
  dailyPnl: number;
  dailyPnlPct: number;

  /* ── UI state ───────────────────────────────────────────── */
  sidebarPanel: 'watchlist' | 'positions' | 'orders' | 'activity';
  bottomPanel: 'trades' | 'signals' | 'predictions' | 'news';

  /* ── Actions ────────────────────────────────────────────── */
  setActiveSymbol: (symbol: string) => void;
  setActiveTimeframe: (tf: Timeframe) => void;
  setWatchlist: (items: WatchlistItem[]) => void;
  setTicker: (data: TickerData) => void;
  setCandles: (candles: Candle[]) => void;
  addCandle: (candle: Candle) => void;
  setPositions: (positions: Position[]) => void;
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  setSignals: (signals: Signal[]) => void;
  addSignal: (signal: Signal) => void;
  setPredictions: (predictions: Prediction[]) => void;
  addPrediction: (prediction: Prediction) => void;
  setNewsItems: (items: NewsItem[]) => void;
  addNewsItem: (item: NewsItem) => void;
  addActivity: (activity: SvenActivity) => void;
  setSvenStatus: (status: TradingState['svenStatus']) => void;
  setPortfolio: (p: Pick<TradingState, 'totalCapital' | 'availableCapital' | 'totalPnl' | 'totalPnlPct' | 'dailyPnl' | 'dailyPnlPct'>) => void;
  setSidebarPanel: (panel: TradingState['sidebarPanel']) => void;
  setBottomPanel: (panel: TradingState['bottomPanel']) => void;
}

const MAX_ACTIVITIES = 200;
const MAX_SIGNALS = 100;
const MAX_CANDLES = 500;

export const useTradingStore = create<TradingState>((set) => ({
  activeSymbol: 'BTC/USDT',
  activeTimeframe: '15m',
  watchlist: [],
  ticker: null,
  candles: [],
  positions: [],
  orders: [],
  signals: [],
  predictions: [],
  newsItems: [],
  activities: [],
  svenStatus: 'monitoring',
  totalCapital: 100_000,
  availableCapital: 82_450,
  totalPnl: 5_832.40,
  totalPnlPct: 5.83,
  dailyPnl: 347.20,
  dailyPnlPct: 0.35,
  sidebarPanel: 'watchlist',
  bottomPanel: 'trades',

  setActiveSymbol: (symbol) => set({ activeSymbol: symbol }),
  setActiveTimeframe: (tf) => set({ activeTimeframe: tf }),
  setWatchlist: (items) => set({ watchlist: items }),
  setTicker: (data) => set({ ticker: data }),
  setCandles: (candles) => set({ candles: candles.slice(-MAX_CANDLES) }),
  addCandle: (candle) =>
    set((s) => ({ candles: [...s.candles.slice(-(MAX_CANDLES - 1)), candle] })),
  setPositions: (positions) => set({ positions }),
  setOrders: (orders) => set({ orders }),
  addOrder: (order) => set((s) => ({ orders: [order, ...s.orders] })),
  setSignals: (signals) => set({ signals: signals.slice(-MAX_SIGNALS) }),
  addSignal: (signal) =>
    set((s) => ({ signals: [...s.signals.slice(-(MAX_SIGNALS - 1)), signal] })),
  setPredictions: (predictions) => set({ predictions }),
  addPrediction: (prediction) =>
    set((s) => ({ predictions: [prediction, ...s.predictions].slice(0, 50) })),
  setNewsItems: (items) => set({ newsItems: items }),
  addNewsItem: (item) => set((s) => ({ newsItems: [item, ...s.newsItems].slice(0, 50) })),
  addActivity: (activity) =>
    set((s) => ({ activities: [activity, ...s.activities].slice(0, MAX_ACTIVITIES) })),
  setSvenStatus: (status) => set({ svenStatus: status }),
  setPortfolio: (p) => set(p),
  setSidebarPanel: (panel) => set({ sidebarPanel: panel }),
  setBottomPanel: (panel) => set({ bottomPanel: panel }),
}));
