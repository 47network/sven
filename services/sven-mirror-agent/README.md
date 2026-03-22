# sven-mirror-agent

Lightweight agent that runs on desktop/edge devices and connects them to Sven
as controllable endpoints.

- Linux: full mirror stack (display/camera/audio/sensors/desktop control)
- Windows/macOS: desktop control commands (and camera/audio when local deps are available)

## Features

| Module     | Capabilities                                             |
|------------|----------------------------------------------------------|
| **Display** | Show URLs/HTML/text and scene dashboards via Chromium kiosk |
| **Camera**  | Snapshots, presence detection (OpenCV / picamera2)        |
| **Audio**   | Mic → STT relay, speaker → TTS playback                  |
| **Sensors** | GPIO, I²C, 1-Wire, system metrics (optional, RPi-only)   |
| **Desktop Control** | Open URL/app/path + type text + hotkeys + focus window |

## Quick Start

```bash
# Linux quick install (x86_64 or ARM64)
curl -fsSL https://your-sven-host/install-mirror-agent.sh | bash

# Cross-platform manual run (Windows/Linux/macOS):
pip install -r requirements.txt
python -m sven_mirror_agent \
  --gateway-url https://sven.example.com \
  --device-name "Kitchen Mirror Node"
```

Platform installers from repo source:

```bash
# Linux (systemd)
bash services/sven-mirror-agent/install.sh

# macOS (launchd user agent)
bash services/sven-mirror-agent/install-macos.sh
```

```powershell
# Windows (manual run + optional startup task)
powershell -ExecutionPolicy Bypass -File services\sven-mirror-agent\install.ps1
powershell -ExecutionPolicy Bypass -File services\sven-mirror-agent\install.ps1 -RegisterStartupTask
```

The agent will:
1. Register itself with the gateway (`POST /v1/devices/pair/start`)
2. Display a 6-character pairing code
3. Wait for admin confirmation in the Sven app
4. Receive its API key and begin the heartbeat + command loop

## Environment Variables

| Variable               | Default                          | Description                    |
|------------------------|----------------------------------|--------------------------------|
| `SVEN_GATEWAY_URL`     | `http://localhost:3000`          | Gateway API base URL           |
| `SVEN_ORGANIZATION_ID` | *(required in production pairing)* | Organization id for pair/start |
| `SVEN_PROVISIONING_TOKEN` | *(required for unauth production pairing)* | Value of gateway `DEVICE_PROVISIONING_TOKEN` |
| `SVEN_DEVICE_NAME`     | hostname                         | Display name for this device   |
| `SVEN_DEVICE_TYPE`     | `mirror`                         | mirror / tablet / kiosk / sensor_hub |
| `SVEN_API_KEY`         | *(auto-provisioned)*             | Device API key after pairing   |
| `SVEN_CAPABILITIES`    | `display,camera,speaker,mic`     | Comma-separated capabilities   |
| `SVEN_DATA_DIR`        | `~/.sven-mirror`                 | Persistent state directory     |
| `SVEN_DISPLAY_ENABLED` | `true`                           | Enable Chromium kiosk display  |
| `SVEN_CAMERA_ENABLED`  | `true`                           | Enable camera module           |
| `SVEN_AUDIO_ENABLED`   | `true`                           | Enable audio module            |
| `SVEN_SENSOR_ENABLED`  | `false`                          | Enable GPIO/sensor module      |
| `SVEN_DESKTOP_CONTROL_ENABLED` | `true`                    | Enable open_url/open_app/open_path commands |

## Docker

```bash
docker build -t sven-mirror-agent .
docker run --privileged \
  -e SVEN_GATEWAY_URL=https://sven.example.com \
  -e SVEN_DEVICE_NAME="Living Room Mirror" \
  --device /dev/video0 \
  sven-mirror-agent
```

## Architecture

```
sven_mirror_agent/
├── __main__.py          # Entry point — parse args, start agent
├── agent.py             # Core agent loop (heartbeat, command polling)
├── config.py            # Configuration loading
├── pairing.py           # Initial device pairing flow
├── api_client.py        # HTTP client for gateway API
├── display/
│   ├── __init__.py
│   └── renderer.py      # Chromium kiosk display controller
├── camera/
│   ├── __init__.py
│   └── capture.py       # Camera snapshots + presence detection
├── audio/
│   ├── __init__.py
│   └── player.py        # TTS playback + mic capture
├── desktop/
│   ├── __init__.py
│   └── controller.py    # Cross-platform open_url/open_app/open_path
└── sensors/
    ├── __init__.py
    └── gpio_reader.py   # GPIO / I²C sensor reading (RPi-only)
```

## Desktop Actions (v2)

Supported desktop commands:

- `open_url` → opens URL in default browser
- `open_app` → launches app/process
- `open_path` → opens file/folder with default handler
- `type_text` → types text in currently focused window
- `hotkey` → sends allowlisted hotkeys (`ctrl+s`, `cmd+r`, etc.)
- `focus_window` → focuses app/window by name

Display command payloads also support scene mode:

- `command: "display", payload: { "type": "scene", "scene": "jarvis_main", "slots": {...} }`
- Optional `scene_profile` can define module layout at runtime and persist it locally.

Platform notes:

- Windows: uses PowerShell + WScript shell automation
- macOS: uses `osascript` (`System Events`)
- Linux: uses `xdotool` / `wmctrl` (install these for input/focus commands)

Policy notes (gateway-side per-device config):

- High-risk actions (`type_text`, `hotkey`, `focus_window`) require:
  - `config.desktop_control.enabled = true`
- Optional restrictions:
  - `config.desktop_control.allowed_actions = ["open_url","type_text"]`
  - `config.desktop_control.allowed_hotkeys = ["ctrl+s","cmd+r"]`

## Service Management

- Linux (systemd):
  - `sudo systemctl status sven-mirror-agent`
  - `sudo journalctl -u sven-mirror-agent -f`
- macOS (launchd):
  - `launchctl list | grep com.sven.mirror-agent`
  - `tail -f ~/.sven-mirror-agent/agent.log`
- Windows (scheduled task, optional):
  - `Get-ScheduledTask -TaskName SvenMirrorAgent`
  - runner script path: `%LOCALAPPDATA%\SvenMirrorAgent\run-agent.ps1`
