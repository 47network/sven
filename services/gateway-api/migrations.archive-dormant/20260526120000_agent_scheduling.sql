-- Batch 53: Agent Scheduling & Calendar
-- Time-based scheduling, calendar events, recurring tasks,
-- availability windows, and booking slots for agents.

CREATE TABLE IF NOT EXISTS agent_schedules (
  id               TEXT PRIMARY KEY,
  agent_id         TEXT NOT NULL,
  schedule_type    TEXT NOT NULL DEFAULT 'one_time',
  title            TEXT NOT NULL,
  description      TEXT,
  cron_expr        TEXT,
  timezone         TEXT NOT NULL DEFAULT 'UTC',
  start_at         TIMESTAMPTZ NOT NULL,
  end_at           TIMESTAMPTZ,
  recurrence_rule  TEXT,
  status           TEXT NOT NULL DEFAULT 'active',
  metadata         JSONB DEFAULT '{}',
  last_run_at      TIMESTAMPTZ,
  next_run_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id               TEXT PRIMARY KEY,
  agent_id         TEXT NOT NULL,
  event_type       TEXT NOT NULL DEFAULT 'task',
  title            TEXT NOT NULL,
  description      TEXT,
  location         TEXT,
  start_at         TIMESTAMPTZ NOT NULL,
  end_at           TIMESTAMPTZ NOT NULL,
  all_day          BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule  TEXT,
  status           TEXT NOT NULL DEFAULT 'confirmed',
  priority         TEXT NOT NULL DEFAULT 'normal',
  attendees        JSONB DEFAULT '[]',
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS availability_windows (
  id               TEXT PRIMARY KEY,
  agent_id         TEXT NOT NULL,
  day_of_week      INTEGER NOT NULL,
  start_time       TEXT NOT NULL,
  end_time         TEXT NOT NULL,
  timezone         TEXT NOT NULL DEFAULT 'UTC',
  is_available     BOOLEAN NOT NULL DEFAULT true,
  override_date    DATE,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_slots (
  id               TEXT PRIMARY KEY,
  agent_id         TEXT NOT NULL,
  slot_type        TEXT NOT NULL DEFAULT 'consultation',
  start_at         TIMESTAMPTZ NOT NULL,
  end_at           TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status           TEXT NOT NULL DEFAULT 'available',
  booked_by        TEXT,
  price_tokens     INTEGER DEFAULT 0,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schedule_triggers (
  id               TEXT PRIMARY KEY,
  schedule_id      TEXT NOT NULL REFERENCES agent_schedules(id),
  trigger_type     TEXT NOT NULL DEFAULT 'task',
  action_payload   JSONB NOT NULL DEFAULT '{}',
  retry_count      INTEGER NOT NULL DEFAULT 0,
  max_retries      INTEGER NOT NULL DEFAULT 3,
  last_status      TEXT NOT NULL DEFAULT 'pending',
  last_error       TEXT,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for agent_schedules
CREATE INDEX IF NOT EXISTS idx_schedules_agent ON agent_schedules(agent_id);
CREATE INDEX IF NOT EXISTS idx_schedules_type ON agent_schedules(schedule_type);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON agent_schedules(status);
CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON agent_schedules(next_run_at);
CREATE INDEX IF NOT EXISTS idx_schedules_created ON agent_schedules(created_at);

-- Indexes for calendar_events
CREATE INDEX IF NOT EXISTS idx_cal_events_agent ON calendar_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_cal_events_type ON calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_cal_events_status ON calendar_events(status);
CREATE INDEX IF NOT EXISTS idx_cal_events_start ON calendar_events(start_at);
CREATE INDEX IF NOT EXISTS idx_cal_events_end ON calendar_events(end_at);

-- Indexes for availability_windows
CREATE INDEX IF NOT EXISTS idx_avail_agent ON availability_windows(agent_id);
CREATE INDEX IF NOT EXISTS idx_avail_day ON availability_windows(day_of_week);

-- Indexes for booking_slots
CREATE INDEX IF NOT EXISTS idx_booking_agent ON booking_slots(agent_id);
CREATE INDEX IF NOT EXISTS idx_booking_status ON booking_slots(status);
CREATE INDEX IF NOT EXISTS idx_booking_start ON booking_slots(start_at);

-- Indexes for schedule_triggers
CREATE INDEX IF NOT EXISTS idx_sched_trigger_schedule ON schedule_triggers(schedule_id);
CREATE INDEX IF NOT EXISTS idx_sched_trigger_status ON schedule_triggers(last_status);
