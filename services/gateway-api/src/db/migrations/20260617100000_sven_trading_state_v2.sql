-- Batch 9B: Persist critical in-memory trading state to survive restarts
-- Previously, trailing stop peaks, profit ladder triggers, position signal
-- attributions, dynamic watchlist, and win streak were lost on restart —
-- causing incorrect trailing-stop behavior and broken source attribution.

ALTER TABLE sven_trading_state
  ADD COLUMN IF NOT EXISTS consecutive_wins     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trailing_stop_peaks  JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS profit_ladder_state  JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS position_signal_map  JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dynamic_watchlist    JSONB NOT NULL DEFAULT '[]';
