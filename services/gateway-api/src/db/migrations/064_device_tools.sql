-- ═══════════════════════════════════════════════════════════════
-- Migration 064 — Device control tools for LLM agent
--
-- Registers device.* tools so the LLM runtime can discover and
-- invoke device commands (display, camera, sensors, TTS, etc.)
-- on any paired Magic Mirror / Kiosk / Sensor Hub.
-- ═══════════════════════════════════════════════════════════════

-- ── device.list ────────────────────────────────────────────────
INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
)
VALUES (
  gen_random_uuid()::text,
  'device.list',
  'List Devices',
  'List all registered devices and their current status. Returns device names, types, online/offline status, capabilities, and last seen timestamp.',
  'devices',
  'trusted',
  'in_process',
  ARRAY['device.read']::text[],
  '{ "type":"object", "properties":{
       "status": {"type":"string", "enum":["online","offline","pairing"], "description":"Filter by device status"},
       "device_type": {"type":"string", "enum":["mirror","tablet","kiosk","sensor_hub"], "description":"Filter by device type"}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "devices": {"type":"array", "items":{"type":"object", "properties":{
         "id":{"type":"string"}, "name":{"type":"string"}, "device_type":{"type":"string"},
         "status":{"type":"string"}, "capabilities":{"type":"array"}, "last_seen_at":{"type":"string"}
       }}}
     }, "required":["devices"] }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
)
ON CONFLICT (name) DO NOTHING;

-- ── device.send_command ────────────────────────────────────────
INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
)
VALUES (
  gen_random_uuid()::text,
  'device.send_command',
  'Send Device Command',
  'Send a command to a specific device. The device agent will execute it and report back. Available commands depend on device capabilities: display, camera_snapshot, camera_motion, tts_speak, audio_record, sensor_read, gpio_write, open_url, open_app, open_path, type_text, hotkey, focus_window, ping, reboot.',
  'devices',
  'trusted',
  'in_process',
  ARRAY['device.write']::text[],
  '{ "type":"object", "properties":{
       "device_id": {"type":"string", "description":"UUID of the target device"},
       "device_name": {"type":"string", "description":"Name of the target device (alternative to device_id)"},
       "command": {"type":"string", "enum":["display","camera_snapshot","camera_motion","tts_speak","audio_record","sensor_read","gpio_write","open_url","open_app","open_path","type_text","hotkey","focus_window","ping","reboot","update_config"], "description":"Command to execute on the device"},
       "payload": {"type":"object", "description":"Command-specific parameters", "properties":{
         "url": {"type":"string", "description":"URL to display (for display command)"},
         "html": {"type":"string", "description":"HTML content to render (for display command)"},
         "text": {"type":"string", "description":"Text to display or speak"},
         "pin": {"type":"integer", "description":"GPIO pin number"},
         "value": {"type":"integer", "enum":[0,1], "description":"GPIO pin value (0=LOW, 1=HIGH)"},
         "sensor_type": {"type":"string", "enum":["system","gpio","environment","light","temperature","all"], "description":"Type of sensor reading to request"},
         "duration": {"type":"number", "description":"Duration in seconds (for audio_record)"}
       }}
     }, "required":["command"], "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "command_id": {"type":"string"},
       "status": {"type":"string"},
       "message": {"type":"string"}
     }, "required":["command_id","status"] }'::jsonb,
  30000, 2, TRUE, TRUE, NOW()
)
ON CONFLICT (name) DO NOTHING;

-- ── device.relay_snapshot ──────────────────────────────────────
INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
)
VALUES (
  gen_random_uuid()::text,
  'device.relay_snapshot',
  'Relay Device Snapshot',
  'Capture a snapshot from a source camera device and relay it to a target display device. Useful for "show kitchen camera on office display" workflows.',
  'devices',
  'trusted',
  'in_process',
  ARRAY['device.write']::text[],
  '{ "type":"object", "properties":{
       "source_device_id": {"type":"string", "description":"UUID of source camera device"},
       "source_device_name": {"type":"string", "description":"Name of source camera device (alternative to source_device_id)"},
       "target_device_id": {"type":"string", "description":"UUID of target display device"},
       "target_device_name": {"type":"string", "description":"Name of target display device (alternative to target_device_id)"},
       "width": {"type":"integer", "minimum":64, "maximum":1920, "description":"Snapshot width (default: 320)"},
       "height": {"type":"integer", "minimum":64, "maximum":1080, "description":"Snapshot height (default: 180)"},
       "timeout_ms": {"type":"integer", "minimum":1000, "maximum":120000, "description":"Max relay wait time (default: 25000)"}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "source_device_id":{"type":"string"},
       "target_device_id":{"type":"string"},
       "snapshot_command_id":{"type":"string"},
       "display_command_id":{"type":"string"},
       "display_status":{"type":"string"},
       "message":{"type":"string"}
     }, "required":["source_device_id","target_device_id","snapshot_command_id","display_command_id"] }'::jsonb,
  60000, 1, TRUE, TRUE, NOW()
)
ON CONFLICT (name) DO NOTHING;

-- ── device.camera_snapshot ─────────────────────────────────────
INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
)
VALUES (
  gen_random_uuid()::text,
  'device.camera_snapshot',
  'Device Camera Snapshot',
  'Take a camera snapshot from a device. Returns the image as base64-encoded JPEG. The device must have camera capability enabled.',
  'devices',
  'trusted',
  'in_process',
  ARRAY['device.read']::text[],
  '{ "type":"object", "properties":{
       "device_id": {"type":"string", "description":"UUID of the target device"},
       "device_name": {"type":"string", "description":"Name of the target device (alternative to device_id)"}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "command_id": {"type":"string"},
       "status": {"type":"string"},
       "message": {"type":"string"}
     }, "required":["command_id","status"] }'::jsonb,
  30000, 2, TRUE, TRUE, NOW()
)
ON CONFLICT (name) DO NOTHING;

-- ── device.sensor_read ─────────────────────────────────────────
INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
)
VALUES (
  gen_random_uuid()::text,
  'device.sensor_read',
  'Read Device Sensors',
  'Read sensor data from a device. Returns system metrics (CPU, memory, temperature, disk, network) and optionally hardware sensor data (GPIO, I²C, 1-Wire) if available on the device.',
  'devices',
  'trusted',
  'in_process',
  ARRAY['device.read']::text[],
  '{ "type":"object", "properties":{
       "device_id": {"type":"string", "description":"UUID of the target device"},
       "device_name": {"type":"string", "description":"Name of the target device (alternative to device_id)"},
       "sensor_type": {"type":"string", "enum":["system","gpio","environment","light","temperature","all"], "description":"Type of sensor data to read (default: system)"}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "command_id": {"type":"string"},
       "status": {"type":"string"},
       "message": {"type":"string"}
     }, "required":["command_id","status"] }'::jsonb,
  15000, 4, TRUE, TRUE, NOW()
)
ON CONFLICT (name) DO NOTHING;

-- ── device.display ─────────────────────────────────────────────
INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
)
VALUES (
  gen_random_uuid()::text,
  'device.display',
  'Device Display',
  'Show content on a device display. Can show a URL (web page), raw HTML, or plain text. The device must have display capability. Supports Magic Mirrors, kiosks, and any device with a screen.',
  'devices',
  'trusted',
  'in_process',
  ARRAY['device.write']::text[],
  '{ "type":"object", "properties":{
       "device_id": {"type":"string", "description":"UUID of the target device"},
       "device_name": {"type":"string", "description":"Name of the target device (alternative to device_id)"},
       "url": {"type":"string", "description":"URL to display in kiosk mode"},
       "html": {"type":"string", "description":"Raw HTML to render on screen"},
       "text": {"type":"string", "description":"Plain text to display"}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "command_id": {"type":"string"},
       "status": {"type":"string"},
       "message": {"type":"string"}
     }, "required":["command_id","status"] }'::jsonb,
  15000, 2, TRUE, TRUE, NOW()
)
ON CONFLICT (name) DO NOTHING;

-- ── device.speak ───────────────────────────────────────────────
INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
)
VALUES (
  gen_random_uuid()::text,
  'device.speak',
  'Device Speak',
  'Make a device speak text aloud via text-to-speech. The device must have speaker capability. Uses the best available TTS engine on the device (gateway TTS → pyttsx3 → espeak fallback).',
  'devices',
  'trusted',
  'in_process',
  ARRAY['device.write']::text[],
  '{ "type":"object", "properties":{
       "device_id": {"type":"string", "description":"UUID of the target device"},
       "device_name": {"type":"string", "description":"Name of the target device (alternative to device_id)"},
       "text": {"type":"string", "description":"Text to speak aloud"}
     }, "required":["text"], "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "command_id": {"type":"string"},
       "status": {"type":"string"},
       "message": {"type":"string"}
     }, "required":["command_id","status"] }'::jsonb,
  30000, 1, TRUE, TRUE, NOW()
)
ON CONFLICT (name) DO NOTHING;

-- ── device.get_events ──────────────────────────────────────────
INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
)
VALUES (
  gen_random_uuid()::text,
  'device.get_events',
  'Get Device Events',
  'Get recent events from a device. Events include presence detection, touch events, sensor readings, boot events, and errors. Useful for checking what happened on a device.',
  'devices',
  'trusted',
  'in_process',
  ARRAY['device.read']::text[],
  '{ "type":"object", "properties":{
       "device_id": {"type":"string", "description":"UUID of the target device"},
       "device_name": {"type":"string", "description":"Name of the target device (alternative to device_id)"},
       "event_type": {"type":"string", "description":"Filter by event type"},
       "limit": {"type":"integer", "minimum":1, "maximum":100, "description":"Max events to return (default: 20)"}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "events": {"type":"array", "items":{"type":"object", "properties":{
         "id":{"type":"string"}, "event_type":{"type":"string"},
         "payload":{"type":"object"}, "created_at":{"type":"string"}
       }}}
     }, "required":["events"] }'::jsonb,
  10000, 4, TRUE, TRUE, NOW()
)
ON CONFLICT (name) DO NOTHING;
