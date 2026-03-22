-- Register calendar tools
INSERT INTO tools (
  name,
  description,
  enabled,
  permissions_required,
  inputs_schema,
  outputs_schema,
  max_memory_mb,
  max_cpu_shares,
  max_bytes,
  timeout_seconds,
  execution_mode,
  created_at
) VALUES
(
  'calendar.list_events',
  'Lists events from a calendar. Supports filtering by calendar, date range, and search text. Returns event summaries with start/end times.',
  true,
  ARRAY[]::TEXT[],
  '{
    "type": "object",
    "properties": {
      "calendar_id": {
        "type": "string",
        "description": "Calendar ID (optional; if not provided, lists from all enabled calendars)"
      },
      "start_date": {
        "type": "string",
        "description": "Start date in YYYY-MM-DD or ISO 8601 format"
      },
      "end_date": {
        "type": "string",
        "description": "End date in YYYY-MM-DD or ISO 8601 format"
      },
      "max_results": {
        "type": "integer",
        "description": "Maximum number of events to return (default 50, max 500)"
      },
      "search": {
        "type": "string",
        "description": "Optional search query to filter events by title/description"
      }
    },
    "additionalProperties": false
  }'::JSONB,
  '{
    "type": "object",
    "properties": {
      "events": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "string" },
            "title": { "type": "string" },
            "start": { "type": "string" },
            "end": { "type": "string" },
            "all_day": { "type": "boolean" },
            "location": { "type": ["string", "null"] },
            "description": { "type": ["string", "null"] },
            "organizer": { "type": ["string", "null"] }
          }
        }
      }
    }
  }'::JSONB,
  128,
  256,
  2097152,
  10,
  'in_process',
  NOW()
),
(
  'calendar.create_event',
  'Creates a new event in a calendar. Supports single events and recurring events (via rrule).',
  true,
  ARRAY[]::TEXT[],
  '{
    "type": "object",
    "properties": {
      "calendar_id": {
        "type": "string",
        "description": "Target calendar ID (must be writable)"
      },
      "title": {
        "type": "string",
        "description": "Event title"
      },
      "start": {
        "type": "string",
        "description": "Start time in ISO 8601 format"
      },
      "end": {
        "type": "string",
        "description": "End time in ISO 8601 format"
      },
      "all_day": {
        "type": "boolean",
        "description": "Whether this is an all-day event (default false)"
      },
      "location": {
        "type": "string",
        "description": "Event location (optional)"
      },
      "description": {
        "type": "string",
        "description": "Event description (optional)"
      },
      "rrule": {
        "type": "string",
        "description": "Recurrence rule (e.g., FREQ=WEEKLY;BYDAY=MO,WE,FR)"
      }
    },
    "required": ["calendar_id", "title", "start", "end"],
    "additionalProperties": false
  }'::JSONB,
  '{
    "type": "object",
    "properties": {
      "event_id": { "type": "string" },
      "title": { "type": "string" },
      "start": { "type": "string" },
      "end": { "type": "string" },
      "calendar_id": { "type": "string" }
    }
  }'::JSONB,
  128,
  256,
  1048576,
  15,
  'in_process',
  NOW()
),
(
  'calendar.update_event',
  'Updates an existing event in a calendar. Specify which fields to update.',
  true,
  ARRAY[]::TEXT[],
  '{
    "type": "object",
    "properties": {
      "event_id": {
        "type": "string",
        "description": "Event ID to update"
      },
      "title": {
        "type": "string",
        "description": "New title (optional)"
      },
      "start": {
        "type": "string",
        "description": "New start time (optional)"
      },
      "end": {
        "type": "string",
        "description": "New end time (optional)"
      },
      "location": {
        "type": "string",
        "description": "New location (optional)"
      },
      "description": {
        "type": "string",
        "description": "New description (optional)"
      }
    },
    "required": ["event_id"],
    "additionalProperties": false
  }'::JSONB,
  '{
    "type": "object",
    "properties": {
      "event_id": { "type": "string" },
      "updated_fields": { "type": "array", "items": { "type": "string" } },
      "event": { "type": "object" }
    }
  }'::JSONB,
  128,
  256,
  1048576,
  15,
  'in_process',
  NOW()
),
(
  'calendar.delete_event',
  'Deletes an event from a calendar.',
  true,
  ARRAY[]::TEXT[],
  '{
    "type": "object",
    "properties": {
      "event_id": {
        "type": "string",
        "description": "Event ID to delete"
      },
      "notify_attendees": {
        "type": "boolean",
        "description": "Whether to send cancellation notifications (default true)"
      }
    },
    "required": ["event_id"],
    "additionalProperties": false
  }'::JSONB,
  '{
    "type": "object",
    "properties": {
      "event_id": { "type": "string" },
      "deleted": { "type": "boolean" }
    }
  }'::JSONB,
  128,
  256,
  1048576,
  10,
  'in_process',
  NOW()
),
(
  'calendar.diff_preview',
  'Shows a preview of what will change when creating/updating an event. Useful for approval workflows.',
  true,
  ARRAY[]::TEXT[],
  '{
    "type": "object",
    "properties": {
      "event_id": {
        "type": "string",
        "description": "Event ID if updating (optional for new events)"
      },
      "title": { "type": "string" },
      "start": { "type": "string" },
      "end": { "type": "string" },
      "location": { "type": ["string", "null"] },
      "description": { "type": ["string", "null"] }
    },
    "required": ["title", "start", "end"],
    "additionalProperties": false
  }'::JSONB,
  '{
    "type": "object",
    "properties": {
      "is_update": { "type": "boolean" },
      "changes": {
        "type": "object",
        "additionalProperties": {
          "type": "object",
          "properties": {
            "from": {},
            "to": {}
          }
        }
      },
      "preview": { "type": "object" }
    }
  }'::JSONB,
  64,
  256,
  1048576,
  5,
  'in_process',
  NOW()
);
