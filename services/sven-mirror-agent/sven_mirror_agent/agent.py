"""
Core agent loop — heartbeat, command polling, and command execution.

The agent runs on any Linux device and bridges it to the Sven gateway.
After pairing, it enters a main loop that:
  1. Sends heartbeat every N seconds
  2. Polls for pending commands
  3. Executes commands via the appropriate module (display, camera, audio, sensors)
  4. Reports events back to the gateway
"""

from __future__ import annotations

import logging
import signal
import sys
import threading
import time
from typing import Any

from .api_client import ApiClient
from .audio.player import AudioService
from .camera.capture import CameraService
from .config import AgentConfig
from .desktop.controller import DesktopController
from .display.renderer import DisplayRenderer
from .sensors.gpio_reader import SensorService

logger = logging.getLogger("sven_mirror_agent.agent")


class MirrorAgent:
    """The main agent that runs on the device."""

    def __init__(self, config: AgentConfig, client: ApiClient) -> None:
        self.config = config
        self.client = client
        self._running = False
        self._device_id: str = ""

        # Initialize modules based on configuration
        self.display: DisplayRenderer | None = None
        self.camera: CameraService | None = None
        self.audio: AudioService | None = None
        self.sensors: SensorService | None = None
        self.desktop: DesktopController | None = None

        if config.display_enabled:
            self.display = DisplayRenderer(config.data_dir)
        if config.camera_enabled:
            self.camera = CameraService(config.data_dir)
        if config.audio_enabled:
            self.audio = AudioService(config.data_dir)
        if config.sensor_enabled:
            self.sensors = SensorService()
        if config.desktop_control_enabled:
            self.desktop = DesktopController(enabled=True)

        logger.info(
            "Agent initialized: display=%s camera=%s audio=%s sensors=%s desktop=%s",
            self.display is not None,
            self.camera is not None,
            self.audio is not None,
            self.sensors is not None,
            self.desktop is not None,
        )

    @property
    def device_id(self) -> str:
        return self._device_id

    @device_id.setter
    def device_id(self, value: str) -> None:
        self._device_id = value

    # ── Main Loop ───────────────────────────────────────────────────────

    def run(self) -> None:
        """Start the agent main loop. Blocks until stopped."""
        self._running = True
        self._setup_signal_handlers()

        # Report boot event
        try:
            self.client.report_event("boot", self.config.platform_info)
        except Exception as exc:
            logger.warning("Failed to report boot event: %s", exc)

        logger.info("Agent running — heartbeat every %ds, commands every %ds",
                     self.config.heartbeat_interval, self.config.command_poll_interval)

        # Start heartbeat in a background thread
        heartbeat_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        heartbeat_thread.start()

        # Main thread runs the command poll loop
        self._command_loop()

    def stop(self) -> None:
        """Gracefully stop the agent."""
        logger.info("Stopping agent...")
        self._running = False

        if self.display:
            self.display.stop()
        if self.camera:
            self.camera.stop()
        if self.audio:
            self.audio.stop()
        if self.sensors:
            self.sensors.stop()

        self.client.close()
        logger.info("Agent stopped.")

    def _setup_signal_handlers(self) -> None:
        def _handler(signum: int, frame: Any) -> None:
            logger.info("Received signal %d, shutting down...", signum)
            self.stop()
            sys.exit(0)

        signal.signal(signal.SIGINT, _handler)
        signal.signal(signal.SIGTERM, _handler)

    # ── Heartbeat ───────────────────────────────────────────────────────

    def _heartbeat_loop(self) -> None:
        """Send periodic heartbeat to the gateway."""
        consecutive_failures = 0
        while self._running:
            try:
                resp = self.client.heartbeat()
                consecutive_failures = 0
                pending = resp.get("data", {}).get("pending_commands", 0)
                if pending > 0:
                    logger.debug("Heartbeat OK — %d pending commands", pending)
            except Exception as exc:
                consecutive_failures += 1
                if consecutive_failures <= 3:
                    logger.warning("Heartbeat failed: %s", exc)
                elif consecutive_failures == 4:
                    logger.error("Heartbeat failing repeatedly — suppressing warnings")

            time.sleep(self.config.heartbeat_interval)

    # ── Command Polling ─────────────────────────────────────────────────

    def _command_loop(self) -> None:
        """Poll for and execute commands."""
        while self._running:
            try:
                commands = self.client.poll_commands()
                for cmd in commands:
                    self._execute_command(cmd)
            except Exception as exc:
                logger.warning("Command poll failed: %s", exc)

            time.sleep(self.config.command_poll_interval)

    def _execute_command(self, cmd: dict[str, Any]) -> None:
        """
        Execute a single command and acknowledge it.

        Supported commands:
          display       — show URL/HTML/text on screen
          camera_snapshot — take a photo
          tts_speak     — speak text aloud
          sensor_read   — read sensor data
          open_url      — open URL in device browser
          open_app      — open an app/process on desktop OS
          open_path     — open file/folder with OS default handler
          type_text     — type text into focused window
          hotkey        — send an allowlisted hotkey chord
          focus_window  — focus app/window by name
          ping          — return pong
          reboot        — reboot the device
          update_config — update device configuration
        """
        command_id = cmd.get("id", "")
        command_name = cmd.get("command", "")
        payload = cmd.get("payload", {})

        logger.info("Executing command: %s (id=%s)", command_name, command_id[:8])

        try:
            result = self._dispatch_command(command_name, payload)
            status = "acknowledged"
            logger.info("Command %s completed: %s", command_name, status)
        except Exception as exc:
            result = {"error": str(exc)}
            status = "failed"
            logger.error("Command %s failed: %s", command_name, exc)

        # Acknowledge the command
        try:
            self.client.ack_command(command_id, status=status, result=result)
        except Exception as exc:
            logger.error("Failed to ack command %s: %s", command_id[:8], exc)

    def _dispatch_command(self, command: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Route a command to the appropriate module handler."""

        match command:
            # ── Display commands ────────────────────────────────────────
            case "display":
                if not self.display:
                    return {"error": "Display module not enabled"}
                content_type = payload.get("type", "url")
                content = payload.get("content", "")
                match content_type:
                    case "url":
                        return self.display.show_url(content)
                    case "html":
                        return self.display.show_html(content)
                    case "text":
                        return self.display.show_text(content, title=payload.get("title", "Sven"))
                    case "scene":
                        scene_name = payload.get("scene")
                        slots = payload.get("slots")
                        scene_profile = payload.get("scene_profile")
                        set_as_active = payload.get("set_as_active", True)
                        return self.display.show_scene(
                            scene_name=scene_name,
                            slots=slots if isinstance(slots, dict) else None,
                            title=payload.get("title", "Sven Mirror"),
                            set_as_active=bool(set_as_active),
                            scene_profile=(
                                scene_profile if isinstance(scene_profile, dict) else None
                            ),
                        )
                    case _:
                        return self.display.show_url(content)

            # ── Camera commands ─────────────────────────────────────────
            case "camera_snapshot":
                if not self.camera:
                    return {"error": "Camera module not enabled"}
                if not self.camera.available:
                    return {"error": "No camera detected"}
                width = payload.get("width", 1280)
                height = payload.get("height", 720)
                return self.camera.snapshot(width=width, height=height)

            case "camera_motion":
                if not self.camera:
                    return {"error": "Camera module not enabled"}
                return self.camera.detect_motion()

            # ── Audio commands ──────────────────────────────────────────
            case "tts_speak":
                if not self.audio:
                    return {"error": "Audio module not enabled"}
                text = payload.get("text", "")
                if not text:
                    return {"error": "No text provided"}
                return self.audio.speak(
                    text,
                    gateway_url=self.config.gateway_url,
                    api_key=self.config.api_key,
                )

            case "audio_record":
                if not self.audio:
                    return {"error": "Audio module not enabled"}
                duration = payload.get("duration", 5)
                return self.audio.record(duration=duration)

            # ── Sensor commands ─────────────────────────────────────────
            case "sensor_read":
                if not self.sensors:
                    return {"error": "Sensor module not enabled"}
                sensor_type = payload.get("sensor_type", "system")
                match sensor_type:
                    case "system":
                        return self.sensors.read_system()
                    case "gpio":
                        pin = payload.get("pin", 0)
                        return self.sensors.read_gpio(pin)
                    case "environment" | "bme280":
                        return self.sensors.read_i2c_bme280()
                    case "light" | "bh1750":
                        return self.sensors.read_ambient_light()
                    case "temperature" | "1wire":
                        return self.sensors.read_1wire_temps()
                    case "all":
                        return self.sensors.read_all()
                    case _:
                        return {"error": f"Unknown sensor type: {sensor_type}"}

            case "gpio_write":
                if not self.sensors:
                    return {"error": "Sensor module not enabled"}
                pin = payload.get("pin", 0)
                value = payload.get("value", False)
                return self.sensors.write_gpio(pin, value)

            # ── Desktop actions ────────────────────────────────────────
            case "open_url":
                if not self.desktop:
                    return {"error": "Desktop control module not enabled"}
                url = str(payload.get("url", "")).strip()
                return self.desktop.open_url(url)

            case "open_app":
                if not self.desktop:
                    return {"error": "Desktop control module not enabled"}
                app = str(payload.get("app", "")).strip()
                args = payload.get("args")
                return self.desktop.open_app(app, args=args)

            case "open_path":
                if not self.desktop:
                    return {"error": "Desktop control module not enabled"}
                path = str(payload.get("path", "")).strip()
                return self.desktop.open_path(path)

            case "type_text":
                if not self.desktop:
                    return {"error": "Desktop control module not enabled"}
                text = str(payload.get("text", ""))
                return self.desktop.type_text(text)

            case "hotkey":
                if not self.desktop:
                    return {"error": "Desktop control module not enabled"}
                keys = payload.get("keys", "")
                return self.desktop.hotkey(keys)

            case "focus_window":
                if not self.desktop:
                    return {"error": "Desktop control module not enabled"}
                target = str(payload.get("target", "")).strip()
                return self.desktop.focus_window(target)

            # ── System commands ─────────────────────────────────────────
            case "ping":
                return {
                    "pong": True,
                    "timestamp": time.time(),
                    "platform": self.config.platform_info,
                    "modules": {
                        "display": self.display.backend if self.display else "disabled",
                        "camera": self.camera.backend if self.camera else "disabled",
                        "audio_play": self.audio.can_play if self.audio else False,
                        "audio_record": self.audio.can_record if self.audio else False,
                        "sensors": self.sensors is not None,
                        "desktop": self.desktop.platform_name if self.desktop else "disabled",
                    },
                }

            case "reboot":
                logger.warning("Reboot command received — rebooting device...")
                self.client.report_event("reboot", {"reason": "command"})
                import subprocess
                subprocess.run(["sudo", "reboot"], check=False)
                return {"rebooting": True}

            case "update_config":
                # Update config is stored on the gateway side;
                # the device re-reads it on next heartbeat
                return {"acknowledged": True, "config_updated": True}

            case _:
                return {"error": f"Unknown command: {command}"}
