BEGIN;

CREATE TABLE IF NOT EXISTS anomaly_detectors (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id        UUID NOT NULL,
  name            TEXT NOT NULL,
  metric_source   TEXT NOT NULL,
  algorithm       TEXT NOT NULL DEFAULT 'zscore' CHECK (algorithm IN ('zscore','isolation_forest','autoencoder','moving_avg','percentile','prophet')),
  sensitivity     NUMERIC(5,2) NOT NULL DEFAULT 2.00,
  window_size     INTEGER NOT NULL DEFAULT 60,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS detected_anomalies (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  detector_id     UUID NOT NULL REFERENCES anomaly_detectors(id) ON DELETE CASCADE,
  severity        TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  metric_value    NUMERIC NOT NULL,
  expected_value  NUMERIC NOT NULL,
  deviation_score NUMERIC(10,4) NOT NULL,
  context         JSONB DEFAULT '{}',
  acknowledged    BOOLEAN NOT NULL DEFAULT false,
  resolved        BOOLEAN NOT NULL DEFAULT false,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS anomaly_baselines (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  detector_id     UUID NOT NULL REFERENCES anomaly_detectors(id) ON DELETE CASCADE,
  period          TEXT NOT NULL DEFAULT 'hourly' CHECK (period IN ('minutely','hourly','daily','weekly','monthly')),
  mean_value      NUMERIC NOT NULL,
  std_deviation   NUMERIC NOT NULL,
  sample_count    INTEGER NOT NULL DEFAULT 0,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_det_agent ON anomaly_detectors(agent_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_det_enabled ON anomaly_detectors(enabled);
CREATE INDEX IF NOT EXISTS idx_detected_anom_detector ON detected_anomalies(detector_id);
CREATE INDEX IF NOT EXISTS idx_detected_anom_severity ON detected_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_anomaly_base_detector ON anomaly_baselines(detector_id);
CREATE INDEX IF NOT EXISTS idx_detected_anom_resolved ON detected_anomalies(resolved);

COMMIT;
