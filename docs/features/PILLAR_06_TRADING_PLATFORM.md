# Pillar 6 — Trading Platform & Financial AI

> **Source**: Videos 7, 8, 9 + User Vision
> **Priority**: HIGH | **Complexity**: Extreme
> **DNS**: `trading.sven.systems`
> **Status**: Specification Complete — Implementation Not Started

---

## Executive Summary

Build a full-stack autonomous trading platform where Sven observes live markets, ingests and processes financial data, executes trades, builds his own analytical tools, and learns continuously from market dynamics, news events, and geopolitical signals. The platform operates on an internal currency system for Sven's learning phase, graduating to real positions. External users see a demo-gated view; the 47 administrator has full access.

**User Vision**: "I want a platform because I want him to see the market live, understand it and save all the data needed, trade without limitations of the platform, develop any tools he needs for help, anything that helps him visualize data etc. And I also want him to learn to trade based on the big impact change, the news, since they reflect the price first, and other world problems like wars, etc."

**Key Principle**: "For the trading platform we wanna replicate the big guys."

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Market Data Pipeline](#2-market-data-pipeline)
3. [Kronos Integration — Financial Prediction AI](#3-kronos-integration--financial-prediction-ai)
4. [MiroFish-Style Prediction Engine](#4-mirofish-style-prediction-engine)
5. [Trading Engine Core](#5-trading-engine-core)
6. [Order Management System (OMS)](#6-order-management-system-oms)
7. [Risk Management & Position Sizing](#7-risk-management--position-sizing)
8. [News & Geopolitical Impact Analysis](#8-news--geopolitical-impact-analysis)
9. [Sven Autonomous Trading Loop](#9-sven-autonomous-trading-loop)
10. [Internal Currency & Token System](#10-internal-currency--token-system)
11. [Tool Builder — Sven Self-Creates Trading Tools](#11-tool-builder--sven-self-creates-trading-tools)
12. [Trading UI (trading.sven.systems)](#12-trading-ui-tradingsvensystems)
13. [Data Persistence & Historical Archive](#13-data-persistence--historical-archive)
14. [Agent Swarm for Financial Intelligence](#14-agent-swarm-for-financial-intelligence)
15. [Backtesting & Strategy Simulation](#15-backtesting--strategy-simulation)
16. [Compliance, Audit & Security](#16-compliance-audit--security)
17. [Infrastructure Requirements](#17-infrastructure-requirements)
18. [Implementation Phases](#18-implementation-phases)
19. [Granular Checklist](#19-granular-checklist)

---

## 1. Architecture Overview

```
                          ┌─────────────────────────────────────┐
                          │        trading.sven.systems          │
                          │         (Trading UI / SPA)           │
                          └──────────────┬──────────────────────┘
                                         │ WebSocket + REST
                          ┌──────────────▼──────────────────────┐
                          │         Trading Gateway API          │
                          │  (Auth, Rate Limit, WebSocket Hub)   │
                          └──┬────────┬────────┬────────┬───────┘
                             │        │        │        │
              ┌──────────────▼──┐ ┌───▼────┐ ┌─▼─────┐ ┌▼──────────┐
              │  Trading Engine │ │  OMS   │ │ Risk  │ │  Data     │
              │  (Strategy Exec)│ │        │ │ Mgmt  │ │  Pipeline │
              └────────┬───────┘ └───┬────┘ └──┬────┘ └─────┬─────┘
                       │             │         │             │
              ┌────────▼─────────────▼─────────▼─────────────▼─────┐
              │                    NATS JetStream                    │
              │           (Orders, Fills, Signals, Events)          │
              └──┬──────────┬──────────┬──────────┬────────────────┘
                 │          │          │          │
        ┌────────▼───┐ ┌───▼──────┐ ┌─▼───────┐ ┌▼──────────────┐
        │   Kronos   │ │ MiroFish │ │  News   │ │  Agent Swarm  │
        │ Prediction │ │ Parallel │ │ Impact  │ │  (Specialized │
        │   Engine   │ │ Sim Eng  │ │ Analyzer│ │   Workers)    │
        └──────┬─────┘ └────┬─────┘ └────┬────┘ └───────┬───────┘
               │             │            │              │
        ┌──────▼─────────────▼────────────▼──────────────▼───────┐
        │                PostgreSQL + TimescaleDB                 │
        │  (Market data, orders, positions, predictions, audit)   │
        └────────────────────────────────────────────────────────┘
```

### Service Layout (Monorepo Integration)

```
services/
├── trading-engine/          — Core trading logic, strategy execution, position management
├── trading-gateway/         — REST + WebSocket API for the trading UI
├── prediction-engine/       — Kronos + MiroFish prediction models
├── market-data-ingest/      — Live market data feeds, normalization, storage
└── news-intelligence/       — News aggregation, NLP analysis, impact scoring

apps/
└── trading-ui/              — React SPA at trading.sven.systems

packages/
├── market-data/             — Shared types: candles, orders, instruments, signals
└── trading-common/          — Shared trading utilities, risk calculations

skills/
└── trading/                 — Sven trading skills (place_order, analyze_chart, etc.)

agents/
├── market-analyst/          — Continuous market analysis agent
├── news-aggregator/         — Real-time news impact scoring agent
├── prediction-simulator/    — MiroFish-style multi-agent simulation
├── strategy-optimizer/      — Backtesting and strategy parameter tuning
└── tool-builder/            — Agent that creates new analysis tools on demand
```

---

## 2. Market Data Pipeline

### 2.1 Data Sources

| Source | Type | Protocol | Data | Frequency |
|--------|------|----------|------|-----------|
| Binance/Bybit WebSocket | Crypto | WSS | OHLCV, Orderbook L2, Trades | Real-time |
| Alpha Vantage / Polygon.io | Equities | REST | OHLCV, Fundamentals | 1s–1min |
| Yahoo Finance (yfinance) | Equities | REST/Scrape | OHLCV, Options, Earnings | 1min–1day |
| CoinGecko / CoinMarketCap | Crypto | REST | Prices, Market Cap, Volume | 15s |
| FRED (Federal Reserve) | Macro | REST | Interest rates, CPI, GDP | Daily |
| News APIs (below) | News | REST/WSS | Headlines, Sentiment | Real-time |
| Social Media (Reddit, X) | Sentiment | REST | Mentions, Volume, Sentiment | 1min |

### 2.2 Ingestion Service (`market-data-ingest`)

```
market-data-ingest/
├── src/
│   ├── index.ts                 — Service entry, health check
│   ├── connectors/
│   │   ├── binance-ws.ts        — Binance WebSocket connector
│   │   ├── bybit-ws.ts          — Bybit WebSocket connector
│   │   ├── polygon-rest.ts      — Polygon.io REST poller
│   │   ├── alphavantage.ts      — Alpha Vantage REST poller
│   │   ├── coingecko.ts         — CoinGecko REST poller
│   │   ├── fred.ts              — Federal Reserve economic data
│   │   └── social-sentiment.ts  — Reddit/X sentiment scraper
│   ├── normalizer.ts            — Normalize all feeds to unified candle/tick format
│   ├── storage.ts               — Write to TimescaleDB hypertables
│   ├── broadcaster.ts           — Publish normalized data to NATS
│   └── health.ts                — /healthz, /readyz with per-connector status
├── Dockerfile
└── package.json
```

### 2.3 Data Schema (TimescaleDB)

```sql
-- Hypertable: raw candles (OHLCV) at multiple timeframes
CREATE TABLE market_candles (
  time        TIMESTAMPTZ NOT NULL,
  symbol      TEXT        NOT NULL,
  exchange    TEXT        NOT NULL,
  timeframe   TEXT        NOT NULL,  -- '1m', '5m', '15m', '1h', '4h', '1d'
  open        DOUBLE PRECISION NOT NULL,
  high        DOUBLE PRECISION NOT NULL,
  low         DOUBLE PRECISION NOT NULL,
  close       DOUBLE PRECISION NOT NULL,
  volume      DOUBLE PRECISION NOT NULL,
  quote_vol   DOUBLE PRECISION,
  trades      INTEGER,
  PRIMARY KEY (time, symbol, exchange, timeframe)
);
SELECT create_hypertable('market_candles', 'time');

-- Hypertable: raw tick data for high-frequency analysis
CREATE TABLE market_ticks (
  time        TIMESTAMPTZ NOT NULL,
  symbol      TEXT        NOT NULL,
  exchange    TEXT        NOT NULL,
  price       DOUBLE PRECISION NOT NULL,
  quantity    DOUBLE PRECISION NOT NULL,
  side        TEXT,  -- 'buy' | 'sell'
  trade_id    TEXT
);
SELECT create_hypertable('market_ticks', 'time');

-- Continuous aggregates: auto-rollup 1m → 5m, 15m, 1h, 4h, 1d
CREATE MATERIALIZED VIEW candles_5m WITH (timescaledb.continuous) AS
SELECT time_bucket('5 minutes', time) AS time,
       symbol, exchange, '5m' AS timeframe,
       first(open, time) AS open,
       max(high) AS high,
       min(low) AS low,
       last(close, time) AS close,
       sum(volume) AS volume,
       sum(quote_vol) AS quote_vol,
       sum(trades) AS trades
FROM market_candles
WHERE timeframe = '1m'
GROUP BY time_bucket('5 minutes', time), symbol, exchange;

-- [Similar for 15m, 1h, 4h, 1d continuous aggregates]

-- Orderbook snapshots (L2, top 20 levels)
CREATE TABLE orderbook_snapshots (
  time        TIMESTAMPTZ NOT NULL,
  symbol      TEXT        NOT NULL,
  exchange    TEXT        NOT NULL,
  bids        JSONB       NOT NULL,  -- [{price, qty}]
  asks        JSONB       NOT NULL,
  spread      DOUBLE PRECISION,
  mid_price   DOUBLE PRECISION
);
SELECT create_hypertable('orderbook_snapshots', 'time');

-- Social sentiment scores
CREATE TABLE sentiment_scores (
  time        TIMESTAMPTZ NOT NULL,
  symbol      TEXT        NOT NULL,
  source      TEXT        NOT NULL,  -- 'reddit', 'x', 'news'
  score       DOUBLE PRECISION NOT NULL, -- -1.0 to 1.0
  volume      INTEGER,
  sample_size INTEGER,
  raw_data    JSONB
);
SELECT create_hypertable('sentiment_scores', 'time');

-- Macro economic indicators
CREATE TABLE macro_indicators (
  time        TIMESTAMPTZ NOT NULL,
  indicator   TEXT        NOT NULL,  -- 'fed_rate', 'cpi', 'gdp', 'unemployment'
  value       DOUBLE PRECISION NOT NULL,
  previous    DOUBLE PRECISION,
  forecast    DOUBLE PRECISION,
  surprise    DOUBLE PRECISION  -- actual - forecast
);
SELECT create_hypertable('macro_indicators', 'time');
```

### 2.4 Data Retention Policy

| Data Type | Hot (SSD) | Warm (HDD) | Cold (Archive) |
|-----------|-----------|------------|----------------|
| Tick data | 7 days | 90 days | S3/MinIO |
| 1m candles | 30 days | 1 year | S3/MinIO |
| 5m+ candles | 1 year | Forever | — |
| Orderbook | 3 days | 30 days | S3/MinIO |
| Sentiment | 30 days | 1 year | S3/MinIO |
| Macro | Forever | — | — |

---

## 3. Kronos Integration — Financial Prediction AI

> From Videos 7 & 9: "Kronos converts stock prices into binary ones and negative ones... projects the K line onto a mathematical sphere... Binary Spherical Quantization"

### 3.1 Kronos Model Overview

**Source**: `github.com/ShiyuCoder/Kronos` (Shu Yu, PhD, Tsinghua University)
**Architecture**: Time-series foundation model with Binary Spherical Quantization (BSQ)
**Training Data**: 12 billion+ K-lines from crypto markets
**Performance**: 93%+ improvement over classic time-series models on financial prediction

### 3.2 How Kronos Works (5 Steps from Video 9)

1. **Tokenization via BSQ** — K-lines (OHLCV candles) projected onto a mathematical sphere → unique binary IDs ({-1, +1} strings). Normalizes across price scales (penny stock vs. Berkshire Hathaway).
2. **Spherical Encoding** — Direction and relationship of moves encoded, not raw dollar amounts. This solves the scale invariance problem.
3. **Foundation Model Inference** — Pre-trained transformer processes token sequences to predict next tokens (future candles).
4. **Multi-horizon Prediction** — Outputs predictions at multiple timeframes simultaneously (1h, 4h, 1d, 1w).
5. **Confidence Scoring** — Each prediction carries a confidence score used by the trading engine for position sizing.

### 3.3 Integration Plan

```
prediction-engine/
├── src/
│   ├── index.ts                       — Service entry
│   ├── kronos/
│   │   ├── tokenizer.ts               — BSQ tokenizer: OHLCV → binary sphere tokens
│   │   ├── spherical-quantizer.ts     — Binary Spherical Quantization implementation
│   │   ├── model-runner.ts            — Load & run Kronos model (ONNX/TorchScript)
│   │   ├── prediction-pipeline.ts     — Full pipeline: ingest → tokenize → predict → decode
│   │   ├── multi-horizon.ts           — Multiple timeframe prediction aggregator
│   │   └── confidence-scorer.ts       — Calibrated confidence scoring
│   ├── ensemble/
│   │   ├── model-combiner.ts          — Ensemble Kronos + other prediction models
│   │   └── weighted-vote.ts           — Weighted voting across model predictions
│   └── output/
│       ├── signal-emitter.ts          — Emit prediction signals to NATS
│       └── prediction-store.ts        — Persist predictions for backtest validation
├── models/
│   └── kronos/                        — Model weights (downloaded from HuggingFace)
│       ├── config.json
│       ├── model.safetensors
│       └── tokenizer.json
├── Dockerfile
└── package.json
```

### 3.4 Kronos Prediction Schema

```sql
CREATE TABLE predictions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model           TEXT NOT NULL,           -- 'kronos_v1', 'mirofish', 'ensemble'
  symbol          TEXT NOT NULL,
  exchange        TEXT NOT NULL,
  timeframe       TEXT NOT NULL,           -- '1h', '4h', '1d'
  horizon_candles INTEGER NOT NULL,        -- how many candles ahead
  predicted_open  DOUBLE PRECISION,
  predicted_high  DOUBLE PRECISION,
  predicted_low   DOUBLE PRECISION,
  predicted_close DOUBLE PRECISION NOT NULL,
  predicted_direction TEXT NOT NULL,        -- 'up', 'down', 'neutral'
  confidence      DOUBLE PRECISION NOT NULL, -- 0.0–1.0
  actual_close    DOUBLE PRECISION,         -- filled after horizon passes
  error_pct       DOUBLE PRECISION,         -- filled after evaluation
  metadata        JSONB                     -- model-specific metadata
);
SELECT create_hypertable('predictions', 'created_at');

-- Prediction accuracy tracking
CREATE TABLE prediction_accuracy (
  time            TIMESTAMPTZ NOT NULL,
  model           TEXT NOT NULL,
  symbol          TEXT NOT NULL,
  timeframe       TEXT NOT NULL,
  direction_accuracy DOUBLE PRECISION,     -- % correct direction calls
  mae             DOUBLE PRECISION,        -- mean absolute error
  rmse            DOUBLE PRECISION,        -- root mean squared error
  sharpe_if_traded DOUBLE PRECISION,       -- theoretical Sharpe ratio
  sample_size     INTEGER
);
SELECT create_hypertable('prediction_accuracy', 'time');
```

### 3.5 GPU Requirements

- **Inference**: Kronos runs on VM5 (dual AMD GPUs) or VM13 (fallback)
- **Model size**: ~2GB weights (manageable on consumer GPU)
- **Latency target**: < 500ms per prediction batch
- **Throughput**: Process 50+ symbols per prediction cycle

---

## 4. MiroFish-Style Prediction Engine

> From Video 8: "a versatile prediction tool that runs large scale simulations using multiple independent AI agents, up to a million of them simultaneously... Oasis engine from Camel AI, Graph RAG for Knowledge, Zep Cloud for memory"

### 4.1 Concept

Instead of a single model predicting the future, MiroFish simulates a digital microcosm — thousands of independent AI agents with different strategies, biases, and information sets, all interacting in a simulated market environment. The emergent behavior of these agents produces predictions.

### 4.2 Components

1. **Oasis Simulation Engine** — Multi-agent simulation runtime
   - Spawn 1,000–100,000 independent agents
   - Each agent has unique strategy parameters, risk tolerance, information access
   - Agents trade in a simulated orderbook
   - Emergent price direction = prediction

2. **Graph RAG Knowledge Layer** — Structured knowledge graph connecting:
   - Market events, company financials, macro indicators
   - Historical patterns and their outcomes
   - Cross-asset correlations
   - Geopolitical event chains

3. **Memory Layer (Zep-compatible)** — Long-term agent memory:
   - Each simulation agent remembers past trades and outcomes
   - Population-level memory: which strategies survived which market conditions
   - Evolutionary pressure: successful strategies reproduce, failing ones die

4. **Information Seeding** — Real-world data feeds into the simulation:
   - Live market data from the Data Pipeline
   - News sentiment from the News Intelligence service
   - Social media signals
   - Macro indicators

### 4.3 Implementation Structure

```
prediction-engine/src/mirofish/
├── simulation-engine.ts       — Core multi-agent simulation loop
├── agent-factory.ts           — Spawn agents with varied parameters
├── agent-strategies/
│   ├── momentum.ts            — Momentum-following agents
│   ├── mean-reversion.ts      — Mean-reversion agents
│   ├── sentiment-driven.ts    — News/sentiment-reactive agents
│   ├── fundamental.ts         — Fundamental analysis agents
│   ├── technical.ts           — Technical indicator agents
│   ├── contrarian.ts          — Contrarian agents
│   └── random-walk.ts         — Random/noise agents (market baseline)
├── orderbook-sim.ts           — Simulated limit orderbook
├── knowledge-graph.ts         — Graph RAG knowledge integration
├── memory-store.ts            — Agent memory persistence
├── evolution.ts               — Strategy evolution / genetic selection
├── consensus-extractor.ts     — Extract predictions from simulation emergent behavior
└── visualizer.ts              — Simulation state visualization data for UI
```

### 4.4 MiroFish Prediction Flow

```
Real-world data seed → Agent population spawned → Simulation runs N timesteps
→ Agents trade in simulated orderbook → Emergent price direction extracted
→ Combine with Kronos prediction (ensemble) → Final signal emitted
```

---

## 5. Trading Engine Core

### 5.1 Capabilities

The trading engine is the central decision-maker. It:

- Receives signals from Kronos, MiroFish, news analysis, and Sven's own decisions
- Manages a portfolio of positions across multiple instruments
- Executes orders through exchange connectors or the internal platform
- Applies risk management rules before every trade
- Tracks P&L, drawdown, and strategy performance in real-time
- Logs every decision with full audit trail

### 5.2 Strategy Framework

```typescript
interface TradingStrategy {
  id: string;
  name: string;
  description: string;
  version: string;

  // Strategy lifecycle
  initialize(context: StrategyContext): Promise<void>;
  onCandle(candle: Candle, context: StrategyContext): Promise<Signal[]>;
  onTick(tick: Tick, context: StrategyContext): Promise<Signal[]>;
  onPrediction(prediction: Prediction, context: StrategyContext): Promise<Signal[]>;
  onNews(event: NewsEvent, context: StrategyContext): Promise<Signal[]>;
  cleanup(): Promise<void>;

  // Metadata
  requiredIndicators: string[];
  requiredTimeframes: string[];
  riskParameters: RiskConfig;
}

interface Signal {
  symbol: string;
  direction: 'long' | 'short' | 'close';
  strength: number;        // 0.0–1.0
  source: string;          // strategy/model name
  entry_price?: number;
  take_profit?: number;
  stop_loss?: number;
  size_pct?: number;       // % of available capital
  metadata: Record<string, unknown>;
}
```

### 5.3 Built-in Strategies

| Strategy | Source | Description |
|----------|--------|-------------|
| `kronos-momentum` | Kronos model | Trade Kronos directional predictions above confidence threshold |
| `mirofish-consensus` | MiroFish sim | Trade when simulation consensus exceeds 70% |
| `news-impact` | News Intelligence | React to high-impact news events within configured latency |
| `ensemble-voter` | All models | Weighted vote across all prediction sources |
| `macro-regime` | FRED/Macro | Adjust risk parameters based on macro regime (expansion/recession/crisis) |
| `mean-reversion-bb` | Technical | Bollinger Band mean reversion on shorter timeframes |
| `breakout-volume` | Technical | Volume-confirmed breakout entries |
| `sven-custom-*` | Sven-generated | Strategies Sven creates via the Tool Builder |

---

## 6. Order Management System (OMS)

### 6.1 Order Types

```typescript
type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop' | 'iceberg' | 'twap';

interface Order {
  id: string;
  strategy_id: string;
  symbol: string;
  exchange: string;           // 'internal' | 'binance' | 'bybit'
  side: 'buy' | 'sell';
  type: OrderType;
  quantity: number;
  price?: number;             // for limit/stop_limit
  stop_price?: number;        // for stop/stop_limit
  trail_pct?: number;         // for trailing_stop
  time_in_force: 'GTC' | 'IOC' | 'FOK' | 'GTD';
  status: OrderStatus;
  created_at: Date;
  filled_at?: Date;
  fill_price?: number;
  fill_quantity?: number;
  commission?: number;
  slippage?: number;          // fill_price - expected_price
  parent_order_id?: string;   // for bracket/OCO orders
  audit_trail: AuditEntry[];
}

type OrderStatus = 'pending' | 'submitted' | 'partial' | 'filled' | 'cancelled' | 'rejected' | 'expired';
```

### 6.2 Order Schema

```sql
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id     TEXT NOT NULL,
  symbol          TEXT NOT NULL,
  exchange        TEXT NOT NULL,
  side            TEXT NOT NULL,
  order_type      TEXT NOT NULL,
  quantity        DOUBLE PRECISION NOT NULL,
  price           DOUBLE PRECISION,
  stop_price      DOUBLE PRECISION,
  trail_pct       DOUBLE PRECISION,
  time_in_force   TEXT NOT NULL DEFAULT 'GTC',
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at    TIMESTAMPTZ,
  filled_at       TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  fill_price      DOUBLE PRECISION,
  fill_quantity   DOUBLE PRECISION,
  commission      DOUBLE PRECISION,
  slippage        DOUBLE PRECISION,
  parent_order_id UUID REFERENCES orders(id),
  rejection_reason TEXT,
  exchange_order_id TEXT,
  metadata        JSONB
);

CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_strategy ON orders (strategy_id);
CREATE INDEX idx_orders_symbol ON orders (symbol);

-- Order state transitions (full audit)
CREATE TABLE order_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id),
  event_type  TEXT NOT NULL,  -- 'created','submitted','partial_fill','filled','cancelled','rejected'
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_status  TEXT,
  new_status  TEXT NOT NULL,
  details     JSONB
);
```

### 6.3 Exchange Connectors

```
trading-engine/src/connectors/
├── connector-interface.ts     — Abstract exchange connector
├── internal-exchange.ts       — Internal platform (47 token system)
├── binance-connector.ts       — Binance REST + WebSocket
├── bybit-connector.ts         — Bybit REST + WebSocket
├── paper-connector.ts         — Paper trading (simulated fills)
└── connector-factory.ts       — Factory pattern for connector instantiation
```

**Graduation path**: Paper Trading → Internal Currency → Real Exchange (admin-gated)

---

## 7. Risk Management & Position Sizing

### 7.1 Risk Rules (Enforced Pre-Trade)

| Rule | Description | Default |
|------|-------------|---------|
| Max position size | Maximum % of portfolio in one position | 5% |
| Max total exposure | Maximum % of portfolio deployed | 50% |
| Max daily loss | Stop trading if daily P&L exceeds threshold | -3% |
| Max drawdown | Reduce position sizes if drawdown exceeds threshold | -10% |
| Max correlated exposure | Limit exposure to correlated assets | 20% |
| Minimum confidence | Only trade signals above confidence threshold | 0.65 |
| Stop-loss mandatory | Every position must have a stop-loss | Yes |
| Max slippage tolerance | Reject fills with excessive slippage | 0.5% |
| Cool-down after loss | Wait N minutes after a losing trade | 15min |
| Max open orders | Maximum simultaneous open orders | 20 |
| Max leverage | Maximum leverage allowed | 1x (no leverage initially) |

### 7.2 Position Sizing Models

```typescript
interface PositionSizer {
  // Fixed fractional: risk X% of capital per trade
  fixedFractional(capital: number, riskPct: number, stopDistance: number): number;

  // Kelly Criterion: optimal sizing based on win rate and reward/risk
  kellyCriterion(winRate: number, avgWin: number, avgLoss: number, fraction: number): number;

  // Volatility-based: size inversely proportional to ATR
  volatilityBased(capital: number, atr: number, riskPct: number): number;

  // Confidence-weighted: scale size by prediction confidence
  confidenceWeighted(baseSize: number, confidence: number, minConfidence: number): number;
}
```

### 7.3 Circuit Breakers

```typescript
interface TradingCircuitBreaker {
  // Daily loss limit hit → stop all trading for the day
  dailyLossBreaker: { threshold: number; action: 'halt_trading' };

  // Drawdown limit → reduce position sizes by 50%
  drawdownBreaker: { threshold: number; action: 'reduce_size' };

  // Consecutive losses → pause and re-evaluate
  consecutiveLossBreaker: { count: number; action: 'pause_and_review' };

  // Flash crash detection → close all positions
  flashCrashBreaker: { priceDrop: number; timeWindow: number; action: 'close_all' };

  // Model disagreement → defer to paper trading
  modelDisagreementBreaker: { divergenceThreshold: number; action: 'paper_only' };
}
```

---

## 8. News & Geopolitical Impact Analysis

### 8.1 News Sources

| Source | Type | Data |
|--------|------|------|
| NewsAPI.org | General news | Headlines, descriptions, sentiment |
| Finnhub | Financial news | Earnings, analyst upgrades/downgrades, SEC filings |
| CryptoPanic | Crypto news | Crypto-specific headlines with community voting |
| GDELT Project | Geopolitical | Global events, conflicts, political changes |
| Reddit (r/wallstreetbets, r/cryptocurrency) | Social | Community sentiment, mentions, DD posts |
| X/Twitter | Social | Trending topics, influencer posts, breaking news |

### 8.2 NLP Pipeline

```
Raw News → Deduplication → Entity Extraction → Sentiment Analysis → Impact Scoring → Signal Emission
```

1. **Deduplication** — Same story from multiple sources → single event with source list
2. **Entity Extraction** — Map to known symbols, companies, sectors, countries
3. **Sentiment Analysis** — LLM-based sentiment scoring (-1.0 to +1.0) with financial context
4. **Impact Classification** — Categorize event impact magnitude:
   - **Level 1 (Low)**: Routine earnings, minor analyst notes
   - **Level 2 (Medium)**: Earnings surprise, regulatory filing, sector news
   - **Level 3 (High)**: Major earnings miss/beat, M&A, leadership change
   - **Level 4 (Critical)**: Geopolitical crisis, market crash, black swan event
   - **Level 5 (Extreme)**: War, pandemic, systemic risk event
5. **Signal Emission** — High-impact events emitted as trading signals with urgency

### 8.3 News Event Schema

```sql
CREATE TABLE news_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source          TEXT NOT NULL,
  headline        TEXT NOT NULL,
  summary         TEXT,
  url             TEXT,
  symbols         TEXT[],           -- affected symbols
  sectors         TEXT[],           -- affected sectors
  countries       TEXT[],           -- affected countries
  sentiment       DOUBLE PRECISION, -- -1.0 to +1.0
  impact_level    INTEGER NOT NULL, -- 1–5
  impact_category TEXT,             -- 'earnings', 'geopolitical', 'regulation', 'macro'
  processed_at    TIMESTAMPTZ,
  signals_emitted TEXT[],           -- IDs of signals generated
  raw_data        JSONB
);
SELECT create_hypertable('news_events', 'created_at');
```

### 8.4 Sven's News Analysis (LLM-Powered)

Sven uses his LLM capability to analyze news in context:

```
"Given this breaking news: [headline]
Current market state: [positions, predictions, recent price action]
Historical precedents: [similar events from knowledge graph]

Assess:
1. Which assets are directly affected?
2. Direction and magnitude of expected impact?
3. How quickly will the market price this in?
4. Should I adjust any current positions?
5. Should I open new positions based on this event?
6. What is the second-order effect (spillover to other assets)?"
```

---

## 9. Sven Autonomous Trading Loop

### 9.1 Loop Architecture

```
Every 60s:
  1. Ingest latest market data
  2. Run Kronos predictions on tracked symbols
  3. Run MiroFish simulation (every 15min for compute efficiency)
  4. Check news pipeline for new high-impact events
  5. Aggregate all signals (prediction + news + technical + sentiment)
  6. For each signal above confidence threshold:
     a. Check risk management rules
     b. Calculate position size
     c. Submit order through OMS
     d. Log decision with full reasoning
  7. Monitor open positions:
     a. Adjust stop-losses (trailing)
     b. Check take-profit conditions
     c. Evaluate if thesis still holds
  8. Portfolio rebalancing check (every 1h)
  9. Emit telemetry: positions, P&L, predictions, confidence
```

### 9.2 Decision Logging

Every trade decision logged with full context:

```sql
CREATE TABLE trade_decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decision_type   TEXT NOT NULL,   -- 'enter', 'exit', 'adjust', 'hold', 'skip'
  symbol          TEXT NOT NULL,
  direction       TEXT,            -- 'long', 'short', 'close'
  signals         JSONB NOT NULL,  -- all contributing signals
  confidence      DOUBLE PRECISION NOT NULL,
  risk_check      JSONB NOT NULL,  -- risk rules checked and results
  order_id        UUID REFERENCES orders(id),
  reasoning       TEXT NOT NULL,   -- Sven's written reasoning for the decision
  portfolio_state JSONB,           -- snapshot of portfolio at decision time
  outcome         JSONB            -- filled after position closed
);
SELECT create_hypertable('trade_decisions', 'created_at');
```

### 9.3 Learning Loop

After every closed position:

1. Compare prediction vs. actual outcome
2. Score signal quality for each contributing model
3. Adjust model weights in the ensemble
4. Update strategy parameters if backtested improvement
5. Record lesson learned in Sven's trading memory
6. Weekly full portfolio review with comprehensive analysis

---

## 10. Internal Currency & Token System

### 10.1 Design

| Property | Value |
|----------|-------|
| **Token Name** | 47Token (ticker: `47T`) |
| **Purpose** | Internal platform currency for Sven's trading ecosystem |
| **Initial Supply** | 1,000,000 47T |
| **Sven's Starting Allowance** | 100,000 47T |
| **Exchange Rate** | 1 47T = $1.00 USD (fixed peg during paper phase) |
| **Visibility** | External users see "DEMO" watermark; admin has full access |

### 10.2 Graduation Path

1. **Phase 1 — Paper Trading**: All trades simulated, live market data, no real money
2. **Phase 2 — Internal Currency**: Trades execute on internal exchange, 47T currency
3. **Phase 3 — Real Market (Admin-Gated)**: Sven places real trades on exchanges using real funds (only with explicit admin approval per trade or per strategy)

### 10.3 Token Schema

```sql
CREATE TABLE token_accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner       TEXT NOT NULL UNIQUE,    -- 'sven', 'admin', user IDs
  balance     DOUBLE PRECISION NOT NULL DEFAULT 0,
  frozen      DOUBLE PRECISION NOT NULL DEFAULT 0,  -- locked in open orders
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE token_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_acct   UUID REFERENCES token_accounts(id),
  to_acct     UUID REFERENCES token_accounts(id),
  amount      DOUBLE PRECISION NOT NULL,
  tx_type     TEXT NOT NULL,  -- 'trade', 'fee', 'deposit', 'withdrawal', 'reward'
  reference   TEXT,           -- order_id, strategy_id, etc.
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_token_tx_from ON token_transactions (from_acct);
CREATE INDEX idx_token_tx_to ON token_transactions (to_acct);
```

---

## 11. Tool Builder — Sven Self-Creates Trading Tools

> User Vision: "develop any tools he needs for help, anything that helps him visualize data"

### 11.1 Concept

Sven can create new analytical tools, indicators, and visualization widgets on demand. When Sven identifies a gap in his analysis toolkit, he:

1. Designs the tool specification
2. Generates the implementation code
3. Tests it against historical data
4. Registers it as a new skill or UI widget
5. Uses it in future trading decisions

### 11.2 Tool Types Sven Can Create

| Type | Description | Example |
|------|-------------|---------|
| **Custom Indicator** | Technical indicator not in the standard library | Custom volatility-adjusted RSI |
| **Correlation Scanner** | Cross-asset correlation finder | Find BTC-correlated altcoins |
| **Pattern Recognizer** | Chart pattern detection | Head & shoulders detector |
| **Visualization Widget** | New chart overlay or dashboard widget | Heat map of sector correlations |
| **Alert Rule** | Custom alerting condition | Alert when news impact + price diverge |
| **Backtest Template** | New backtesting strategy template | Seasonal pattern strategy |
| **Data Aggregator** | New data derived from existing sources | Combine sentiment + volume into single score |

### 11.3 Tool Builder Flow

```
Sven identifies analysis gap → Designs tool spec (LLM reasoning)
→ Generates TypeScript/Python code → Runs automated tests
→ Validates against historical data → Registers as skill
→ Deploys to trading-engine → Available for future use
```

### 11.4 Tool Registry Schema

```sql
CREATE TABLE trading_tools (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  description     TEXT NOT NULL,
  tool_type       TEXT NOT NULL,
  code            TEXT NOT NULL,
  language        TEXT NOT NULL DEFAULT 'typescript',
  version         INTEGER NOT NULL DEFAULT 1,
  created_by      TEXT NOT NULL DEFAULT 'sven',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  backtest_result JSONB,          -- performance on historical data
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  usage_count     INTEGER NOT NULL DEFAULT 0,
  last_used_at    TIMESTAMPTZ
);
```

---

## 12. Trading UI (`trading.sven.systems`)

### 12.1 Pages & Layouts

| Page | Description |
|------|-------------|
| **Dashboard** | Portfolio overview, P&L chart, active positions, recent trades |
| **Live Charts** | Multi-chart workspace with TradingView-style charting (lightweight-charts) |
| **Orderbook** | Live L2 orderbook for selected instrument |
| **Predictions** | Kronos + MiroFish predictions with confidence, accuracy history |
| **News Feed** | Real-time news with impact scores, sentiment overlay on charts |
| **Strategies** | List of active/inactive strategies, performance metrics |
| **Backtest** | Strategy backtesting interface with parameter tuning |
| **Tools** | Sven's self-created tools library |
| **Simulation** | MiroFish simulation visualization (agent population dynamics) |
| **Audit Log** | Full trade decision log with Sven's reasoning |
| **Risk** | Risk dashboard: exposure, drawdown, circuit breaker status |
| **Settings** | Exchange connections, risk parameters, notification config |

### 12.2 Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 + TypeScript |
| State | Zustand (consistent with existing apps) |
| Charting | TradingView lightweight-charts + custom overlays |
| Real-time | WebSocket (market data, orders, predictions) |
| Styling | Tailwind CSS + Sven design system |
| Build | Vite (consistent with existing apps) |
| Routing | React Router v7 |

### 12.3 Real-Time Data Flows (WebSocket)

```typescript
// Client subscribes to channels
ws.subscribe('market:BTC/USDT:1m');     // Live candle updates
ws.subscribe('orderbook:BTC/USDT');     // Orderbook updates
ws.subscribe('predictions:BTC/USDT');   // New predictions
ws.subscribe('news:crypto');            // News events
ws.subscribe('orders:*');               // Order status updates
ws.subscribe('portfolio');              // Portfolio P&L updates
ws.subscribe('simulation:mirofish');    // Simulation state
```

### 12.4 Demo Mode (External Users)

- All data is real (live market data)
- All trades shown are Sven's actual internal trades
- "DEMO" watermark on all pages
- Users cannot place trades themselves
- Portfolio values shown in 47T (internal currency)
- Full historical performance visible

---

## 13. Data Persistence & Historical Archive

### 13.1 Data Volumes (Estimated)

| Data Type | Daily Volume | Monthly | Yearly |
|-----------|-------------|---------|--------|
| 1min candles (50 symbols) | ~72,000 rows | 2.16M | 26M |
| Tick data (50 symbols) | ~5M rows | 150M | 1.8B |
| Orderbook snapshots | ~144,000 rows | 4.3M | 52M |
| Predictions | ~7,200 rows | 216K | 2.6M |
| News events | ~500 rows | 15K | 180K |
| Orders | ~100 rows | 3K | 36K |
| Trade decisions | ~200 rows | 6K | 72K |

### 13.2 Storage Architecture

```
TimescaleDB (VM6 / VM-TRADE)
├── Hot storage: SSD, recent data, fast queries
├── Warm: scheduled move to compressed chunks
├── Cold: export to MinIO/S3 for long-term archive
└── Continuous aggregates: auto-refresh materialized views
```

### 13.3 Backup & Recovery

- **WAL streaming** to a standby for point-in-time recovery
- **Daily pg_dump** to MinIO for full backups
- **Retention**: Hot 30 days, compressed 1 year, archived forever
- **RPO**: < 5 minutes (WAL streaming)
- **RTO**: < 30 minutes (restore from standby)

---

## 14. Agent Swarm for Financial Intelligence

### 14.1 Specialized Agents

| Agent | Role | Runs On | Frequency |
|-------|------|---------|-----------|
| `market-analyst` | Continuous technical analysis across all tracked symbols | VM5 | Every 1min |
| `news-aggregator` | Scrape, deduplicate, score news from all sources | VM4 | Continuous |
| `prediction-simulator` | Run MiroFish simulations | VM5/VM13 | Every 15min |
| `strategy-optimizer` | Backtest and tune strategy parameters | VM5 | Daily |
| `correlation-scanner` | Find cross-asset correlations, regime changes | VM4 | Every 1h |
| `tool-builder` | Create new analysis tools when gaps identified | VM5 | On-demand |
| `portfolio-reviewer` | Weekly comprehensive portfolio analysis | VM4 | Weekly |
| `risk-monitor` | Real-time risk threshold monitoring | VM4 | Continuous |

### 14.2 Agent Communication

All agents communicate through NATS JetStream:

```
sven.trading.signals.{symbol}      — Trading signals
sven.trading.predictions.{model}   — Predictions from models
sven.trading.news.{impact_level}   — News events by impact
sven.trading.orders.{status}       — Order lifecycle events
sven.trading.risk.{alert_type}     — Risk alerts
sven.trading.portfolio             — Portfolio state updates
sven.trading.tools.{event}         — Tool creation events
```

---

## 15. Backtesting & Strategy Simulation

### 15.1 Backtesting Engine

```typescript
interface BacktestConfig {
  strategy: TradingStrategy;
  symbols: string[];
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  slippage: number;          // simulated slippage per trade
  commission: number;        // simulated commission per trade
  dataResolution: string;    // '1m', '5m', '1h'
}

interface BacktestResult {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgTradeReturn: number;
  bestTrade: number;
  worstTrade: number;
  equityCurve: { time: Date; equity: number }[];
  drawdownCurve: { time: Date; drawdown: number }[];
  tradeLog: BacktestTrade[];
  monthlyReturns: { month: string; return: number }[];
}
```

### 15.2 Walk-Forward Optimization

Instead of simple backtesting (which is prone to overfitting), use walk-forward analysis:

1. Divide historical data into training and testing windows
2. Optimize parameters on training window
3. Test on subsequent out-of-sample window
4. Slide forward and repeat
5. Only accept parameters that work across multiple test windows

### 15.3 Monte Carlo Simulation

- Random resampling of historical trades to generate thousands of possible equity curves
- Determine confidence intervals for expected return and drawdown
- Stress-test strategies against worst-case scenarios

---

## 16. Compliance, Audit & Security

### 16.1 Audit Trail

Every action logged with:
- Timestamp (UTC)
- Actor (Sven, admin, strategy)
- Action type
- Full context (signals, risk check, portfolio state)
- Outcome

### 16.2 Access Control

| Role | Permissions |
|------|-------------|
| **Admin (47)** | Full access: config, real trading, force-close, strategy deploy |
| **Sven** | Trade within risk limits, create tools, adjust strategies |
| **External User** | View-only demo mode: charts, predictions, P&L |

### 16.3 Security Measures

- Exchange API keys encrypted at rest (AES-256), never logged
- API key rotation support without downtime
- Rate limiting on all trading API endpoints
- IP allowlist for exchange API connections
- Two-factor confirmation for real-money trades
- All WebSocket connections authenticated with JWT
- No PII in trading logs (only account IDs)
- Full TLS encryption on all connections

### 16.4 Financial Compliance Notes

- **No real money handling in initial phases** — paper trading only
- When progressing to real trades: ensure compliance with applicable regulations
- All trade records retained for minimum 7 years
- Admin-gated approval required for real exchange connections
- No investment advice displayed to external demo users

---

## 17. Infrastructure Requirements

### 17.1 New Infrastructure

| Component | Deployment | Purpose |
|-----------|------------|---------|
| **trading-engine** | VM4 (or dedicated VM-TRADE) | Core trading logic, strategy execution |
| **trading-gateway** | VM4 | REST + WebSocket API |
| **market-data-ingest** | VM4 / VM-TRADE | Market data feeds |
| **prediction-engine** | VM5 (GPU) | Kronos + MiroFish |
| **news-intelligence** | VM4 | News scraping + NLP |
| **trading-ui** | Caddy/Nginx (VM4) | Static SPA at trading.sven.systems |
| **TimescaleDB** | VM6 (existing PostgreSQL host) | Financial time-series data |
| **MinIO** | VM6 | Cold storage archive |

### 17.2 DNS

```
trading.sven.systems → VM4 (or VM-TRADE if dedicated)
api.trading.sven.systems → VM4 (trading-gateway)
ws.trading.sven.systems → VM4 (trading-gateway WebSocket)
```

### 17.3 Resource Estimates

| Service | CPU | RAM | Disk | Network |
|---------|-----|-----|------|---------|
| trading-engine | 2 cores | 2GB | 1GB | LAN |
| trading-gateway | 1 core | 1GB | 500MB | WAN |
| market-data-ingest | 2 cores | 2GB | 1GB | WAN (exchange feeds) |
| prediction-engine | GPU + 4 cores | 8GB + 6GB VRAM | 10GB (models) | LAN |
| news-intelligence | 2 cores | 2GB | 1GB | WAN |
| TimescaleDB (delta) | 2 cores | 4GB | 100GB/year | LAN |
| trading-ui (static) | Minimal | 128MB | 50MB | WAN |

---

## 18. Implementation Phases

### Phase 6A — Data Foundation (Weeks 11-12)

- [ ] Set up TimescaleDB hypertables on VM6
- [ ] Build `market-data-ingest` service with Binance + CoinGecko connectors
- [ ] Implement data normalization and NATS broadcasting
- [ ] Create continuous aggregates for multi-timeframe rollups
- [ ] Health checks and monitoring for data pipeline
- [ ] Verify data quality: gap detection, stale data alerts

### Phase 6B — Prediction Layer (Weeks 13-14)

- [ ] Download and integrate Kronos model from HuggingFace
- [ ] Implement BSQ tokenizer in TypeScript
- [ ] Build prediction pipeline: ingest → tokenize → predict → decode
- [ ] Multi-horizon predictions (1h, 4h, 1d)
- [ ] Prediction accuracy tracking and evaluation
- [ ] Begin MiroFish simulation engine (agent factory, orderbook sim)

### Phase 6C — Trading Engine (Weeks 15-16)

- [ ] Build trading-engine service with strategy framework
- [ ] Implement OMS with paper trading connector
- [ ] Build risk management module with circuit breakers
- [ ] Implement position sizing models
- [ ] Decision logging with full context
- [ ] Sven autonomous trading loop (60s cycle)

### Phase 6D — News Intelligence (Weeks 16-17)

- [ ] Build news-intelligence service
- [ ] Integrate news sources (NewsAPI, Finnhub, CryptoPanic)
- [ ] NLP pipeline: dedup → entity extraction → sentiment → impact scoring
- [ ] Sven LLM-powered analysis for high-impact events
- [ ] Connect news signals to trading engine

### Phase 6E — Trading UI (Weeks 17-19)

- [ ] Set up React app at trading.sven.systems
- [ ] Dashboard: portfolio overview, P&L chart, positions
- [ ] Live charts with TradingView lightweight-charts
- [ ] Predictions page with accuracy history
- [ ] News feed with impact scores
- [ ] Strategies page with performance metrics
- [ ] Real-time WebSocket data flow
- [ ] Demo mode for external users

### Phase 6F — Advanced Features (Weeks 19-20)

- [ ] Complete MiroFish simulation engine
- [ ] Tool Builder: Sven self-creates analysis tools
- [ ] Backtesting engine with walk-forward optimization
- [ ] Monte Carlo simulation for strategy stress testing
- [ ] Agent swarm deployment (8 specialized agents)
- [ ] Internal currency system (47Token)
- [ ] Portfolio reviewer agent (weekly comprehensive review)

---

## 19. Granular Checklist

### Data Pipeline

- [ ] TimescaleDB extension installed and configured on VM6
- [ ] `market_candles` hypertable created with proper partitioning
- [ ] `market_ticks` hypertable created
- [ ] `orderbook_snapshots` hypertable created
- [ ] `sentiment_scores` hypertable created
- [ ] `macro_indicators` hypertable created
- [ ] Continuous aggregates: 1m → 5m, 15m, 1h, 4h, 1d
- [ ] Binance WebSocket connector: connect, subscribe, reconnect
- [ ] Bybit WebSocket connector: connect, subscribe, reconnect
- [ ] CoinGecko REST poller: prices, market cap, volume
- [ ] Alpha Vantage REST poller: equities OHLCV
- [ ] FRED REST poller: interest rates, CPI, GDP
- [ ] Social sentiment scraper: Reddit, X
- [ ] Data normalizer: all sources → unified format
- [ ] NATS broadcaster: publish normalized data
- [ ] Data quality monitor: gap detection, staleness alerting
- [ ] Retention policy: automatic tiering hot → warm → cold
- [ ] Health endpoint: /healthz, /readyz per connector
- [ ] Structured logging for all ingestion events
- [ ] Backpressure handling: slow consumer protection
- [ ] Reconnection logic with exponential backoff
- [ ] Symbol configuration: add/remove symbols dynamically

### Kronos Prediction

- [ ] Kronos model downloaded from HuggingFace
- [ ] BSQ tokenizer implemented and tested
- [ ] Spherical quantizer: K-line → sphere projection → binary ID
- [ ] Model runner: load ONNX/TorchScript model, run inference
- [ ] Multi-horizon predictions: 1h, 4h, 1d, 1w
- [ ] Confidence scoring calibrated against historical accuracy
- [ ] `predictions` table with hypertable
- [ ] `prediction_accuracy` tracking: direction accuracy, MAE, RMSE
- [ ] Signal emission to NATS `sven.trading.predictions.kronos`
- [ ] GPU inference on VM5 with fallback to VM13
- [ ] Batch prediction: 50+ symbols in < 500ms
- [ ] Model versioning and weight management
- [ ] Prediction evaluation pipeline: compare predicted vs. actual

### MiroFish Simulation

- [ ] Simulation engine: spawn N agents with varied parameters
- [ ] Agent strategies: momentum, mean-reversion, sentiment, fundamental, technical, contrarian, random
- [ ] Simulated limit orderbook
- [ ] Knowledge graph integration (Graph RAG)
- [ ] Agent memory persistence
- [ ] Evolutionary selection: successful strategies reproduce
- [ ] Consensus extraction: emergent behavior → prediction
- [ ] Simulation visualization data emitted for UI
- [ ] Resource management: memory limits, agent count caps
- [ ] Simulation scheduling: every 15min per tracked symbol

### Trading Engine

- [ ] Strategy framework: interface, lifecycle, signal emission
- [ ] Built-in strategies: kronos-momentum, mirofish-consensus, news-impact, ensemble-voter
- [ ] Strategy registry: activate, deactivate, configure
- [ ] Signal aggregation: weighted combination from all sources
- [ ] OMS: create orders, submit, track status, cancel
- [ ] Order types: market, limit, stop, stop_limit, trailing_stop
- [ ] Paper trading connector: simulated fills with slippage
- [ ] Internal exchange connector: 47Token trading
- [ ] Binance connector: REST + WebSocket order management
- [ ] Bybit connector: REST + WebSocket order management
- [ ] Position tracking: entries, exits, P&L, commission
- [ ] Portfolio state: real-time balance, exposure, unrealized P&L
- [ ] Decision logging: full context per trade decision
- [ ] Sven trading loop: 60s cycle with all signal sources

### Risk Management

- [ ] Max position size enforcement (default 5%)
- [ ] Max total exposure enforcement (default 50%)
- [ ] Max daily loss circuit breaker (default -3%)
- [ ] Max drawdown circuit breaker (default -10%)
- [ ] Max correlated exposure check (default 20%)
- [ ] Minimum confidence threshold (default 0.65)
- [ ] Mandatory stop-loss on every position
- [ ] Slippage tolerance check (default 0.5%)
- [ ] Cool-down after loss (default 15min)
- [ ] Max open orders cap (default 20)
- [ ] Flash crash detection and auto-close
- [ ] Model disagreement breaker → paper-only mode
- [ ] Position sizing: fixed fractional, Kelly, volatility-based
- [ ] Confidence-weighted sizing

### News Intelligence

- [ ] NewsAPI.org connector
- [ ] Finnhub connector
- [ ] CryptoPanic connector
- [ ] GDELT connector for geopolitical events
- [ ] Reddit scraper (r/wallstreetbets, r/cryptocurrency)
- [ ] X/Twitter scraper (trending, influencers)
- [ ] Deduplication engine
- [ ] Entity extraction: symbols, companies, sectors
- [ ] Sentiment analysis: LLM-based, financial context
- [ ] Impact classification: 5-level scale
- [ ] Signal emission for trading engine
- [ ] Sven LLM analysis for Level 3+ events
- [ ] `news_events` hypertable
- [ ] Health endpoint and monitoring
- [ ] Rate limit compliance for all APIs

### Trading UI

- [ ] React 19 + TypeScript project setup
- [ ] Vite build configuration
- [ ] Authentication: JWT-based, admin vs. demo user
- [ ] Dashboard: portfolio overview, P&L curve, positions table
- [ ] Live charts: TradingView lightweight-charts integration
- [ ] Multi-chart workspace: arrange multiple symbols
- [ ] Chart overlays: predictions, signals, news events
- [ ] Orderbook view: L2 depth visualization
- [ ] Predictions page: model accuracy, confidence distribution
- [ ] News feed: real-time, filterable by impact/symbol
- [ ] Strategies page: active strategies, performance metrics
- [ ] Backtest page: configure, run, view results
- [ ] Tools page: Sven-created tools library
- [ ] Simulation page: MiroFish agent visualization
- [ ] Audit log: trade decisions with Sven's reasoning
- [ ] Risk dashboard: exposure, drawdown, circuit breakers
- [ ] Settings page: exchanges, risk params, notifications
- [ ] Real-time WebSocket: market data, orders, predictions
- [ ] Demo mode: watermark, view-only for external users
- [ ] Responsive layout (desktop focus, mobile-aware)
- [ ] Dark theme (trading standard)
- [ ] DNS: trading.sven.systems configured and serving

### Internal Currency

- [ ] `token_accounts` table
- [ ] `token_transactions` table
- [ ] Account creation: sven, admin, demo users
- [ ] Balance management: credit, debit, freeze, unfreeze
- [ ] Transaction atomicity: database transactions
- [ ] Sven starting allowance: 100,000 47T
- [ ] Fee structure: configurable trading fees
- [ ] Balance display in trading UI
- [ ] Transaction history view

### Tool Builder

- [ ] Tool specification generation (Sven LLM)
- [ ] Code generation for custom indicators
- [ ] Automated testing against historical data
- [ ] Tool registration in `trading_tools` table
- [ ] Deployment to trading-engine runtime
- [ ] Usage tracking and effectiveness scoring
- [ ] Version management: update, rollback
- [ ] Admin approval gate for new tools

### Backtesting

- [ ] Backtesting engine: replay historical data through strategy
- [ ] Performance metrics: Sharpe, Sortino, max drawdown, win rate
- [ ] Equity curve generation
- [ ] Trade log with entry/exit details
- [ ] Walk-forward optimization
- [ ] Monte Carlo simulation: random resampling, confidence intervals
- [ ] Parameter grid search with parallelization
- [ ] Comparison view: strategy A vs. B
- [ ] Export results as report (PDF/JSON)

### Agent Swarm

- [ ] market-analyst agent: continuous technical analysis
- [ ] news-aggregator agent: scrape, score, emit
- [ ] prediction-simulator agent: MiroFish scheduling
- [ ] strategy-optimizer agent: daily backtest + tune
- [ ] correlation-scanner agent: cross-asset correlations
- [ ] tool-builder agent: gap identification + tool creation
- [ ] portfolio-reviewer agent: weekly comprehensive review
- [ ] risk-monitor agent: continuous risk threshold monitoring
- [ ] NATS communication for all agents
- [ ] Agent health monitoring and auto-restart

### Security & Compliance

- [ ] Exchange API keys encrypted at rest (AES-256)
- [ ] API key rotation without downtime
- [ ] Rate limiting on trading API endpoints
- [ ] IP allowlist for exchange connections
- [ ] 2FA for real-money trade approval
- [ ] JWT authentication on all WebSocket connections
- [ ] No PII in trading logs
- [ ] Full TLS on all connections
- [ ] Trade records retention: minimum 7 years
- [ ] Admin-gated approval for real exchange connections
- [ ] No investment advice to demo users
- [ ] Audit log tamper-evident (hash chain)

### Observability

- [ ] Prometheus metrics: order count, fill rate, latency, P&L
- [ ] Grafana dashboards: trading performance, system health
- [ ] Structured logging: JSON format, correlation IDs
- [ ] NATS JetStream monitoring
- [ ] Alert rules: data gaps, prediction failures, risk breaches
- [ ] Health endpoints for all services
- [ ] Distributed tracing across trading pipeline

### Infrastructure

- [ ] TimescaleDB provisioned on VM6
- [ ] DNS: trading.sven.systems → VM4
- [ ] TLS certificate for trading.sven.systems
- [ ] Docker containers for all trading services
- [ ] docker-compose.trading.yml integrated into main compose
- [ ] NATS subjects and streams configured
- [ ] GPU allocation for prediction-engine on VM5
- [ ] Backup: TimescaleDB WAL + daily dumps
- [ ] Monitoring: Prometheus targets added
- [ ] WireGuard routes verified for trading services

---

## Cross-References

- **Pillar 2** (Multi-Model): prediction-engine uses local models for inference
- **Pillar 5** (Security): trading security scanning, API key management
- **Pillar 7** (Marketing): trading performance data feeds into marketing content
- **Pillar 8** (Distributed Compute): heavy backtesting/simulation distributed across mesh
- **Master Plan**: `docs/features/EXPANSION_MASTER_PLAN.md`
- **Self-Healing**: trading services integrate with skill-runner v9 pipeline
