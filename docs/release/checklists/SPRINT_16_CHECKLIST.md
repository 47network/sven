# Sprint 16 — User Isolation, Deployment Modes & Magic Mirror Device Control

## Overview

Three pillars:

1. **User Data Isolation** — every user's data is fully sandboxed (client + server)
2. **Single-User vs Multi-User Deployment** — two operational modes
3. **Magic Mirror Device Control** — Sven controls external devices (RPi, screens, cameras, sensors)

---

## Pillar 1 — User Data Isolation

### Current State

| Layer | Status | Notes |
|-------|--------|-------|
| Server-side chats | ✅ Isolated | `chats.organization_id` scoped, enforced in gateway |
| Server-side memories | ✅ Isolated | `memories.user_id` + `visibility` (private/shared/global) |
| Server-side UI prefs | ✅ Isolated | `user_ui_preferences(user_id, ...)` |
| Server-side sessions | ✅ Isolated | `sessions.user_id` |
| Client SharedPreferences | ❌ **GLOBAL** | All keys unscoped — shared between users on same device |
| Client MemoryService | ❌ **GLOBAL** | Facts, name, instructions stored locally, no user prefix |
| Client archive/tags | ❌ **GLOBAL** | `chat.archived_ids`, `chat.thread_tags` not user-scoped |
| Client custom shape | ❌ **GLOBAL** | `ui.custom_shape` not user-scoped |
| Client prompt history | ❌ **GLOBAL** | Prompt templates/history not user-scoped |
| Client token store | ❌ **GLOBAL** | Single token slot in FlutterSecureStorage |
| Logout cleanup | ❌ **Missing** | `clearToken()` does NOT wipe preferences → next user inherits data |

### Tasks

- [ ] **1.1 — Scoped SharedPreferences wrapper**
  Create a `ScopedPreferences` utility that prefixes all keys with the current `userId`.
  - Wraps `SharedPreferences`
  - All reads/writes go through `_keyFor(userId, key)` → `"user.<userId>.<key>"`
  - Falls back gracefully when no user is logged in (read-only defaults)
  - File: `lib/app/scoped_preferences.dart`

- [ ] **1.2 — Scoped TokenStore**
  Update `TokenStore` to support multiple user tokens.
  - Keys become `sven.auth.<userId>.access_token` / `sven.auth.<userId>.refresh_token`
  - Add `activeUserId` key to track which user is logged in
  - On login success, store userId alongside token
  - File: `lib/features/auth/token_store.dart`

- [ ] **1.3 — Migrate AppState to scoped storage**
  Update `AppState.loadPrefs()` and all `set*()` methods to use `ScopedPreferences`.
  - All keys (`ui.visual_mode`, `ui.motion_level`, `ui.avatar_mode`, etc.) scoped to user
  - `customShapeSpec` scoped to user
  - `archivedIds`, `threadTags` scoped to user
  - `onboardingComplete` scoped to user
  - File: `lib/app/app_state.dart`

- [ ] **1.4 — Migrate MemoryService to scoped storage**
  Update `MemoryService` to use `ScopedPreferences`.
  - `sven.memory.facts`, `sven.memory.name`, `sven.memory.instructions.*` scoped to user
  - Consider also syncing local memories to server `memories` table
  - File: `lib/features/memory/memory_service.dart`

- [ ] **1.5 — Migrate PromptTemplatesService to scoped storage**
  - `sven.prompt_templates` scoped to user
  - File: `lib/features/chat/prompt_templates_service.dart`

- [ ] **1.6 — Migrate PromptHistoryService to scoped storage**
  - All prompt history keys scoped to user
  - File: `lib/features/chat/prompt_history_service.dart`

- [ ] **1.7 — Logout data wipe**
  On logout:
  - Clear current user's tokens from secure storage
  - Optionally: keep preferences (they're user-scoped now, so safe)
  - Reset `AppState` to defaults
  - Clear `MemoryService` local cache
  - Navigate to login screen
  - File: `lib/features/auth/auth_service.dart`, `lib/app/sven_user_app.dart`

- [ ] **1.8 — User ID propagation**
  After login, the app needs to know the current `userId`:
  - Gateway login response should include `user_id` (verify it does)
  - Store `userId` in `AppState` alongside `token`
  - Pass `userId` to `ScopedPreferences` on initialization
  - File: `lib/features/auth/auth_service.dart`, `lib/app/app_state.dart`

- [ ] **1.9 — Server-side: verify chat endpoint isolation**
  Confirm the public `/v1/chats` endpoint (used by Flutter) properly filters by `organization_id`:
  - Check that `GET /v1/chats` uses `request.orgId`
  - Check that `POST /v1/chats/:id/messages` verifies ownership
  - Audit all chat-related routes for org scoping
  - File: `services/gateway-api/src/routes/admin/chats.ts`

- [ ] **1.10 — Server-side: memory visibility enforcement**
  Verify `memories` queries respect `user_id` + `visibility`:
  - `user_private` → only visible to owning user
  - `chat_shared` → visible to chat participants
  - `global` → visible to all in org
  - File: `services/gateway-api/src/services/MemoryStore.ts`

---

## Pillar 2 — Single-User vs Multi-User Deployment Modes

### Concept

| Mode | Description |
|------|-------------|
| **Personal** (single-user) | One person's Sven — no login required after first setup, simplified UI, direct access |
| **Household / Team** (multi-user) | Multiple users — login required, per-user isolation, admin can manage users |

### Tasks

- [ ] **2.1 — Deployment mode config (server)**
  Add `deployment_mode` to `settings_global` or env var:
  - Values: `personal` | `multi_user`
  - Expose via `GET /v1/config/deployment` (public, no auth required)
  - In `personal` mode: auto-login as the single user, skip device approval flow
  - File: new migration + `services/gateway-api/src/routes/config.ts`

- [ ] **2.2 — Deployment mode config (client)**
  Flutter app fetches deployment mode on startup:
  - If `personal` → auto-login flow (stored credentials or single-user token)
  - If `multi_user` → show login/device-auth screen
  - Store mode in `AppState`
  - File: `lib/app/app_state.dart`, `lib/app/sven_user_app.dart`

- [ ] **2.3 — Personal mode: auto-login**
  In personal mode:
  - First launch: show one-time setup (set name, optional password)
  - After setup: store credentials, auto-login on every launch
  - No user-switching UI
  - Skip auth screens entirely after first setup
  - File: `lib/features/auth/auto_login_service.dart` (new)

- [ ] **2.4 — Personal mode: simplified server setup**
  - `personal` mode auto-creates a single admin user if none exists
  - Skip organization setup — use the default personal org
  - Optionally disable TOTP, device approval flows
  - File: `services/gateway-api/src/db/migrations/` (new), `services/gateway-api/src/routes/auth.ts`

- [ ] **2.5 — Multi-user mode: user-switching UI**
  - Add user avatar/name in app bar
  - "Switch user" / "Sign out" options
  - Show which user is active
  - Admin users see "Manage users" option
  - File: `lib/app/sven_user_app.dart`, new widget

- [ ] **2.6 — Multi-user mode: invitation flow**
  - Admin can invite users (generate invite link / code)
  - New user signs up with invite
  - Assign to organization
  - File: `services/gateway-api/src/routes/auth.ts`, new Flutter screens

- [ ] **2.7 — Setup wizard**
  First-launch wizard that asks:
  - "Is Sven just for you, or for your household/team?"
  - Personal → create admin user, skip multi-user setup
  - Multi-user → create admin, set org name, optional invite flow
  - File: `lib/features/onboarding/` (extend existing onboarding)

---

## Pillar 3 — Magic Mirror Device Control

### Concept

Sven can "inhabit" external devices (Raspberry Pi, smart mirrors, tablets, etc.) and:

- Display content on their screen (dashboard, face, notifications, weather, etc.)
- Use their camera (face recognition, gesture detection, presence)
- Read sensors (touch, proximity, temperature, ambient light)
- Control peripherals (LEDs, speakers, relays)
- Multi-device: Sven runs on many devices simultaneously, each with its own capabilities

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Sven Gateway (existing)                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  /v1/devices/*   — Device registry + control endpoints     │ │
│  │  /v1/devices/:id/display  — Push display content            │ │
│  │  /v1/devices/:id/sensors  — Read sensor data                │ │
│  │  /v1/devices/:id/camera   — Camera feed / snapshots         │ │
│  │  /v1/devices/:id/command  — Execute device commands         │ │
│  └─────────────────────────────────────────────────────────────┘ │
│              ▲                                                   │
│              │ NATS / WebSocket / SSE                             │
│              ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  sven-mirror-agent  (runs on each RPi / device)            │ │
│  │   ├── Display renderer (Chromium kiosk / Flutter)           │ │
│  │   ├── Camera service (picamera2 / OpenCV)                   │ │
│  │   ├── Sensor service (GPIO / I2C / touchscreen events)      │ │
│  │   ├── Audio service (mic + speaker)                         │ │
│  │   └── Heartbeat / health reporting                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Tasks

#### 3A — Device Registry (Server)

- [x] **3A.1 — Device registry DB schema**
  Migration: `services/gateway-api/src/db/migrations/063_device_registry.sql`
  - `devices` table: UUID id, organization_id, name, device_type, status, capabilities JSONB, config JSONB, last_seen_at, paired_at, api_key_hash, pairing_code, pairing_expires, created_by, timestamps
  - `device_events` table: id, device_id FK CASCADE, event_type, payload JSONB, created_at
  - `device_commands` table: id, device_id FK CASCADE, command, payload JSONB, status, sent_by, timestamps

- [x] **3A.2 — Device API routes**
  Admin CRUD in `services/gateway-api/src/routes/admin/devices.ts` (~431 lines):
  - `GET /v1/admin/devices` — list all devices (org-scoped, filterable)
  - `GET /v1/admin/devices/:id` — device detail + recent events/commands
  - `POST /v1/admin/devices` — register new device (starts pairing)
  - `PATCH /v1/admin/devices/:id` — update config
  - `DELETE /v1/admin/devices/:id` — remove device
  - `POST /v1/admin/devices/:id/command` — send command to device
  - `POST /v1/admin/devices/:id/pair/confirm` — confirm pairing
  - `POST /v1/admin/devices/:id/pair/regenerate` — regenerate pairing code

- [x] **3A.3 — Device pairing flow**
  Device agent endpoints in `services/gateway-api/src/routes/devices.ts` (~323 lines):
  - `authenticateDevice()` middleware: Bearer `sven_dev_xxx` → bcrypt compare
  - `POST /v1/devices/pair/start` — register device, get pairing code
  - `POST /v1/devices/pair/confirm` — admin confirms with code → generates API key
  - Pairing code expires after 15 minutes

- [x] **3A.4 — Device heartbeat & status**
  - `POST /v1/devices/heartbeat` — device heartbeat, updates last_seen_at
  - `GET /v1/devices/me` — device self-info
  - `POST /v1/devices/events` — report events
  - `GET /v1/devices/commands` — poll pending commands
  - `POST /v1/devices/commands/:id/ack` — acknowledge command
  - `GET /v1/devices/events/stream` — SSE for real-time events

#### 3B — Mirror Agent (New Service)

- [x] **3B.1 — sven-mirror-agent scaffold**
  New Python service: `services/sven-mirror-agent/`
  - Cross-platform: works on **any Linux** (x86_64, ARM64, ARMv7, RPi, NUC, cloud VM)
  - Config via pydantic-settings with env vars + CLI args
  - API client wrapping all device gateway endpoints
  - Pairing flow with ASCII art code display
  - Core agent loop: heartbeat thread + command poll + dispatch
  - Files: `__init__.py`, `__main__.py`, `config.py`, `api_client.py`, `pairing.py`, `agent.py`

- [x] **3B.2 — Display renderer**
  `services/sven-mirror-agent/sven_mirror_agent/display/renderer.py`
  - Auto-detects backend: Chromium kiosk → framebuffer → none
  - `show_url()`, `show_html()`, `show_text()`, `show_pairing_code()`, `clear()`, `stop()`
  - Chromium: kiosk mode, --no-first-run, --start-fullscreen, --autoplay-policy
  - Framebuffer: Pillow → /dev/fb0 PPM direct write

- [x] **3B.3 — Camera service**
  `services/sven-mirror-agent/sven_mirror_agent/camera/capture.py`
  - Auto-detects backend: picamera2 → OpenCV → none
  - `snapshot()`: Returns base64 JPEG + metadata
  - `detect_motion()`: Frame-diff algorithm (grayscale → GaussianBlur → absdiff → threshold)
  - Graceful degradation when no camera available

- [x] **3B.4 — Sensor service**
  `services/sven-mirror-agent/sven_mirror_agent/sensors/gpio_reader.py`
  - System metrics via psutil (works on ANY Linux): CPU temp, load, memory, disk, uptime, network
  - Optional RPi GPIO: digital read/write via RPi.GPIO
  - Optional I²C: BME280 (temp/humidity/pressure), ambient light sensors
  - Optional 1-Wire: DS18B20 temperature probes
  - `read_all()`: Aggregate all available sensors

- [x] **3B.5 — Audio service**
  `services/sven-mirror-agent/sven_mirror_agent/audio/player.py`
  - TTS playback: gateway TTS → pyttsx3 → espeak fallback chain
  - Audio player detection: paplay → aplay → mpv → ffplay
  - Mic recording: parecord → arecord fallback
  - `speak()`: Text-to-speech with configurable engine
  - `record()`: Capture audio, returns WAV path

- [x] **3B.6 — Docker / deployment config**
  - `services/sven-mirror-agent/Dockerfile` — Python 3.11 slim, Chromium, ffmpeg, v4l-utils
  - `services/sven-mirror-agent/install.sh` — One-line installer for any Linux (apt/dnf/pacman/apk)
  - Docker-compose service `sven-mirror-agent` (profile: `["mirror"]`, networks: `[core]`)
  - Systemd service unit created by install script
  - Supports x86_64, aarch64, armv7l architectures

#### 3C — Flutter App Integration

- [x] **3C.1 — Device management UI**
  `lib/features/devices/device_manager_page.dart`
  - List devices with status indicators (online/offline/pairing)
  - "Add Device" FAB → bottom sheet (name, type chips, capability chips)
  - Pairing dialog with code display + confirm form
  - API key dialog (shown once after pairing, copy button)
  - Delete confirmation dialog
  - Wired into settings via "Devices" tile in `sven_user_app.dart`

- [x] **3C.2 — Device control panel**
  `lib/features/devices/device_control_page.dart`
  - Device info card with status/capabilities
  - Quick actions: Display, Camera, Speak, Ping, Reboot
  - Command history + event timeline tiles
  - Service: `lib/features/devices/device_service.dart` (~372 lines)
    - Models: Device, DeviceCommand, DeviceEvent, DeviceDetail
    - Methods: fetchDevices, fetchDevice, registerDevice, confirmPairing, sendCommand, updateDevice, deleteDevice

- [x] **3C.3 — Multi-device avatar presence**
  `lib/features/devices/device_presence_service.dart`
  - `DevicePresenceState`: holds device list, counts (online/offline/pairing), filter methods
  - `DevicePresenceService`: extends ValueNotifier, polls every 15s, exposes live state
  - `detectNewlyOnline()`: compares previous vs current for greeting triggers
  - Auto-started by SvenHubPage when deviceService is available

- [x] **3C.4 — Device in hub page**
  Added DEVICES tab to `sven_hub_page.dart`:
  - `_HubTab.devices` enum value with `Icons.devices_rounded`
  - `_DevicesView`: live device list via `ValueListenableBuilder<DevicePresenceState>`
  - `_DeviceStatusBar`: online/offline/pairing count summary
  - `_DeviceCard`: per-device card with type icon, status glow, capabilities chips, tap → DeviceControlPage
  - Pull-to-refresh, empty state, last-refresh timestamp
  - `deviceService` parameter wired through `SvenHubPage` → `_AppShell` → hub

#### 3D — LLM Tool Integration

- [x] **3D.1 — Device control tools for LLM**
  Migration: `services/gateway-api/src/db/migrations/064_device_tools.sql`
  7 tools registered: `device.list`, `device.send_command`, `device.camera_snapshot`, `device.sensor_read`, `device.display`, `device.speak`, `device.get_events`
  - Each with proper input/output JSON Schema, `in_process` execution mode
  - Skill-runner handlers in `services/skill-runner/src/index.ts` — 7 new cases in `executeInProcess()` switch
  - Supports device lookup by name or ID
  - Commands queued via `device_commands` table, agent polls and executes

- [x] **3D.2 — Device awareness in system prompt**
  `services/agent-runtime/src/index.ts` — `buildDeviceContextPrompt()`:
  - Queries `devices` table by org (from `chats.organization_id`)
  - Injects into system prompt: "Connected devices you can control via device.* tools:"
  - Lists each device with name, type, status, capabilities, last seen
  - Tells Sven which tool names to use for interaction
  - Injected after `buildAvailableToolsPrompt()`, before prompt drift check

---

## Priority Order

### Phase 1 — User Isolation (Critical, do first)

1.1 → 1.8 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 → 1.2 → 1.9 → 1.10

### Phase 2 — Deployment Modes

2.1 → 2.2 → 2.7 → 2.3 → 2.4 → 2.5 → 2.6

### Phase 3 — Magic Mirror (can parallelize with Phase 2)

3A.1 → 3A.2 → 3A.3 → 3A.4 → 3B.1 → 3B.2 → 3B.3 → 3B.4 → 3B.5 → 3B.6 → 3C.1 → 3C.2 → 3C.3 → 3C.4 → 3D.1 → 3D.2

---

## Summary

| Pillar | Tasks | Estimated Scope |
|--------|-------|-----------------|
| 1 — User Isolation | 10 tasks | Medium — mostly client-side, server already solid |
| 2 — Deployment Modes | 7 tasks | Medium — config + UI + server setup logic |
| 3 — Magic Mirror | 16 tasks | Large — new service, hardware integration, multi-device |
| **Total** | **33 tasks** | |

## Key Files to Touch

### Client (Flutter)

- `lib/app/scoped_preferences.dart` (NEW)
- `lib/app/app_state.dart`
- `lib/features/auth/token_store.dart`
- `lib/features/auth/auth_service.dart`
- `lib/features/auth/auto_login_service.dart` (NEW)
- `lib/features/memory/memory_service.dart`
- `lib/features/chat/prompt_templates_service.dart`
- `lib/features/chat/prompt_history_service.dart`
- `lib/features/devices/` (NEW — device management screens)
- `lib/features/onboarding/` (extend for deployment mode)
- `lib/app/sven_user_app.dart`

### Server (Gateway)

- `services/gateway-api/src/db/migrations/062_device_registry.sql` (NEW)
- `services/gateway-api/src/routes/admin/devices.ts` (NEW)
- `services/gateway-api/src/routes/devices.ts` (NEW)
- `services/gateway-api/src/routes/config.ts` (NEW)
- `services/gateway-api/src/routes/auth.ts` (extend)
- `services/gateway-api/src/routes/admin/chats.ts` (audit)

### New Service

- `services/sven-mirror-agent/` (NEW — entire service)
