"""
Configuration — loaded from environment variables, CLI args, or config file.
"""

from __future__ import annotations

import json
import logging
import os
import platform
import socket
from pathlib import Path
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


def _default_capabilities() -> List[str]:
    caps = os.environ.get("SVEN_CAPABILITIES", "display,speaker")
    return [c.strip() for c in caps.split(",") if c.strip()]


class AgentConfig(BaseSettings):
    """Mirror-agent configuration. All values can be overridden via env vars."""

    model_config = {"env_prefix": "SVEN_"}

    # ── Gateway connection ──────────────────────────────────────────────
    gateway_url: str = Field(
        default="http://localhost:3000",
        description="Base URL of the Sven gateway API",
    )
    organization_id: str = Field(
        default="",
        description="Target organization id required by production pair/start",
    )
    provisioning_token: str = Field(
        default="",
        description="Provisioning token for unauthenticated production pair/start",
    )

    # ── Device identity ─────────────────────────────────────────────────
    device_name: str = Field(
        default_factory=lambda: socket.gethostname(),
        description="Human-readable device name",
    )
    device_type: str = Field(
        default="mirror",
        description="Device type: mirror | tablet | kiosk | sensor_hub",
    )
    capabilities: List[str] = Field(
        default_factory=_default_capabilities,
        description="Device capabilities",
    )

    # ── Persisted API key (set after successful pairing) ────────────────
    api_key: str = Field(default="", description="Device API key (auto-provisioned)")

    # ── Module toggles ──────────────────────────────────────────────────
    display_enabled: bool = Field(default=True)
    camera_enabled: bool = Field(default=True)
    audio_enabled: bool = Field(default=True)
    sensor_enabled: bool = Field(default=False)
    desktop_control_enabled: bool = Field(default=True)

    # ── Timings ─────────────────────────────────────────────────────────
    heartbeat_interval: int = Field(default=30, description="Heartbeat interval in seconds")
    command_poll_interval: int = Field(default=3, description="Command poll interval in seconds")

    # ── Storage ─────────────────────────────────────────────────────────
    data_dir: Path = Field(
        default_factory=lambda: Path.home() / ".sven-mirror",
        description="Persistent state directory",
    )

    # ── Derived ─────────────────────────────────────────────────────────
    @property
    def state_file(self) -> Path:
        return self.data_dir / "state.json"

    @property
    def platform_info(self) -> dict:
        return {
            "os": platform.system(),
            "arch": platform.machine(),
            "hostname": socket.gethostname(),
            "python": platform.python_version(),
        }

    # ── Persistence helpers ─────────────────────────────────────────────
    def save_state(self, device_id: str, api_key: str) -> None:
        """Persist device_id and api_key after successful pairing."""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._harden_data_dir_permissions()
        self.state_file.write_text(
            json.dumps({"device_id": device_id, "api_key": api_key}, indent=2)
        )
        self._harden_state_file_permissions()
        self.api_key = api_key

    def load_state(self) -> dict | None:
        """Load persisted state. Returns None if not paired yet."""
        if not self.state_file.exists():
            return None
        self._check_state_file_permissions()
        try:
            data = json.loads(self.state_file.read_text())
            if data.get("api_key"):
                self.api_key = data["api_key"]
            return data
        except (json.JSONDecodeError, OSError):
            return None

    def _harden_data_dir_permissions(self) -> None:
        if os.name != "posix":
            return
        try:
            self.data_dir.chmod(0o700)
        except OSError as err:
            logger.warning("Failed to enforce secure mirror data dir permissions: %s", err)

    def _harden_state_file_permissions(self) -> None:
        if os.name != "posix":
            return
        try:
            self.state_file.chmod(0o600)
        except OSError as err:
            logger.warning("Failed to enforce secure mirror state file permissions: %s", err)

    def _check_state_file_permissions(self) -> None:
        if os.name != "posix":
            return
        try:
            current_mode = self.state_file.stat().st_mode & 0o777
        except OSError as err:
            logger.warning("Failed to inspect mirror state file permissions: %s", err)
            return

        if current_mode & 0o077:
            msg = (
                f"Insecure mirror state file permissions ({oct(current_mode)}); expected owner-only mode 0o600"
            )
            strict = os.environ.get("SVEN_STRICT_STATE_FILE_PERMISSIONS", "").strip().lower() in {
                "1",
                "true",
                "yes",
                "on",
            }
            if strict:
                raise PermissionError(msg)
            logger.warning(msg)
