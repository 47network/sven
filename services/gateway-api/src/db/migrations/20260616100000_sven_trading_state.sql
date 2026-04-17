-- Sven Trading State Persistence
-- Stores Sven's balance, learning metrics, and circuit breaker state
-- so they survive gateway restarts. Previously in-memory only.
CREATE TABLE IF NOT EXISTS sven_trading_state (
  id          TEXT PRIMARY KEY DEFAULT 'singleton',
  balance     DOUBLE PRECISION NOT NULL DEFAULT 100000,
  peak_balance DOUBLE PRECISION NOT NULL DEFAULT 100000,
  total_pnl   DOUBLE PRECISION NOT NULL DEFAULT 0,
  daily_pnl   DOUBLE PRECISION NOT NULL DEFAULT 0,
  daily_trade_count INTEGER NOT NULL DEFAULT 0,
  daily_reset_date  TEXT NOT NULL DEFAULT '',
  source_weights    JSONB NOT NULL DEFAULT '{"kronos":0.30,"mirofish":0.25,"news-intelligence":0.15,"technical":0.20,"ensemble":0.10}',
  model_accuracy    JSONB NOT NULL DEFAULT '{}',
  learning_iterations INTEGER NOT NULL DEFAULT 0,
  circuit_breaker   JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial state
INSERT INTO sven_trading_state (id) VALUES ('singleton') ON CONFLICT DO NOTHING;
