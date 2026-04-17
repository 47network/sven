-- ---------------------------------------------------------------------------
-- Trading: Alerts + Backtest Results persistence
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trading_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('price','signal','portfolio','drawdown','volatility','news','custom')),
  name            TEXT NOT NULL,
  symbol          TEXT,
  condition       TEXT NOT NULL,
  threshold       NUMERIC(20,8) NOT NULL,
  priority        TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','triggered','expired','disabled')),
  delivery        JSONB NOT NULL DEFAULT '["sse"]',
  cooldown_ms     INTEGER NOT NULL DEFAULT 300000,
  trigger_count   INTEGER NOT NULL DEFAULT 0,
  max_triggers    INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  triggered_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trading_alerts_org ON trading_alerts(org_id, status);

CREATE TABLE IF NOT EXISTS trading_backtest_results (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  strategy           TEXT NOT NULL,
  symbol             TEXT NOT NULL DEFAULT '',
  timeframe          TEXT NOT NULL DEFAULT '1h',
  initial_capital    NUMERIC(20,8) NOT NULL DEFAULT 10000,
  total_trades       INTEGER NOT NULL DEFAULT 0,
  winning_trades     INTEGER NOT NULL DEFAULT 0,
  total_return       NUMERIC(20,8) NOT NULL DEFAULT 0,
  total_return_pct   NUMERIC(10,4) NOT NULL DEFAULT 0,
  max_drawdown       NUMERIC(10,4) NOT NULL DEFAULT 0,
  sharpe_ratio       NUMERIC(10,4) NOT NULL DEFAULT 0,
  profit_factor      NUMERIC(10,4) NOT NULL DEFAULT 0,
  trades             JSONB NOT NULL DEFAULT '[]',
  equity_curve       JSONB NOT NULL DEFAULT '[]',
  monthly_returns    JSONB NOT NULL DEFAULT '[]',
  config             JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trading_backtest_org ON trading_backtest_results(org_id, created_at DESC);
