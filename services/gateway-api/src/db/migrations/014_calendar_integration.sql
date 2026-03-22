-- 9.2 Calendar Integration
-- Supports Radicale CalDAV and Google Calendar

CREATE TABLE calendar_accounts (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL CHECK (provider IN ('radicale', 'google')),
    account_name    TEXT,           -- display name (e.g., "Work Calendar" or email)
    username        TEXT,           -- for Radicale
    password_ref    TEXT,           -- secret ref (e.g., 'vault://secret/calendar/radicale#user-123') for Radicale
    google_email    TEXT,           -- for Google Calendar
    oauth_token     TEXT,           -- encrypted Google access token
    oauth_refresh   TEXT,           -- encrypted Google refresh token
    oauth_expiry    TIMESTAMPTZ,    -- when access token expires
    readonly        BOOLEAN NOT NULL DEFAULT FALSE,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    last_sync_at    TIMESTAMPTZ,
    sync_error      TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}',  -- provider-specific data (calendar IDs, etc.)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calendar_accounts_user ON calendar_accounts(user_id);
CREATE INDEX idx_calendar_accounts_provider ON calendar_accounts(provider);
CREATE INDEX idx_calendar_accounts_enabled ON calendar_accounts(enabled);

-- Calendar subscriptions (which calendars to sync from each account)
CREATE TABLE calendar_subscriptions (
    id              TEXT PRIMARY KEY,
    account_id      TEXT NOT NULL REFERENCES calendar_accounts(id) ON DELETE CASCADE,
    calendar_id     TEXT NOT NULL,    -- UID for Radicale, calendar ID for Google
    calendar_name   TEXT,
    description     TEXT,
    timezone        TEXT DEFAULT 'UTC',
    color           TEXT,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    readonly        BOOLEAN NOT NULL DEFAULT FALSE,
    sync_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, calendar_id)
);

CREATE INDEX idx_calendar_subscriptions_account ON calendar_subscriptions(account_id);
CREATE INDEX idx_calendar_subscriptions_enabled ON calendar_subscriptions(sync_enabled);

-- Synced calendar events (cached locally for quick access)
CREATE TABLE calendar_events (
    id              TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL REFERENCES calendar_subscriptions(id) ON DELETE CASCADE,
    event_uid       TEXT NOT NULL,    -- provider event ID (iCloud format UID or Google eventId)
    title           TEXT NOT NULL,
    description     TEXT,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    all_day         BOOLEAN NOT NULL DEFAULT FALSE,
    location        TEXT,
    organizer       TEXT,
    attendees       TEXT[],           -- comma-joined list
    is_private      BOOLEAN NOT NULL DEFAULT FALSE,
    rrule           TEXT,             -- recurrence rule if recurring
    status          TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
    external_url    TEXT,             -- link to provider's event
    last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(subscription_id, event_uid)
);

CREATE INDEX idx_calendar_events_subscription ON calendar_events(subscription_id);
CREATE INDEX idx_calendar_events_time ON calendar_events(start_time, end_time);
CREATE INDEX idx_calendar_events_uid ON calendar_events(event_uid);
