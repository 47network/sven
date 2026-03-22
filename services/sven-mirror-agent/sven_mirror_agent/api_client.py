"""
HTTP client for the Sven gateway device API.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger("sven_mirror_agent.api")


class ApiClient:
    """Wraps device-facing endpoints on the Sven gateway."""

    def __init__(self, base_url: str, api_key: str = "") -> None:
        self._base = base_url.rstrip("/")
        self._api_key = api_key
        self._http = httpx.Client(timeout=30.0)

    def close(self) -> None:
        self._http.close()

    @property
    def api_key(self) -> str:
        return self._api_key

    @api_key.setter
    def api_key(self, value: str) -> None:
        self._api_key = value

    def _headers(self) -> dict[str, str]:
        h: dict[str, str] = {"Content-Type": "application/json"}
        if self._api_key:
            h["Authorization"] = f"Bearer {self._api_key}"
        return h

    # ── Pairing ─────────────────────────────────────────────────────────

    def pair_start(
        self,
        name: str,
        device_type: str,
        capabilities: list[str],
        organization_id: str = "",
        provisioning_token: str = "",
        platform_info: dict | None = None,
    ) -> dict[str, Any]:
        """POST /v1/devices/pair/start — initiate pairing (no auth)."""
        body: dict[str, Any] = {
            "name": name,
            "device_type": device_type,
            "capabilities": capabilities,
        }
        if organization_id:
            body["organization_id"] = organization_id
        if platform_info:
            body["platform"] = platform_info
        headers = {"Content-Type": "application/json"}
        if provisioning_token:
            headers["x-sven-device-provisioning-token"] = provisioning_token
        resp = self._http.post(
            f"{self._base}/v1/devices/pair/start",
            json=body,
            headers=headers,
        )
        resp.raise_for_status()
        return resp.json()

    # ── Authenticated endpoints (require api_key) ──────────────────────

    def heartbeat(self) -> dict[str, Any]:
        """POST /v1/devices/heartbeat"""
        resp = self._http.post(
            f"{self._base}/v1/devices/heartbeat",
            json={},
            headers=self._headers(),
        )
        resp.raise_for_status()
        return resp.json()

    def get_me(self) -> dict[str, Any]:
        """GET /v1/devices/me — device self-info."""
        resp = self._http.get(
            f"{self._base}/v1/devices/me",
            headers=self._headers(),
        )
        resp.raise_for_status()
        return resp.json()

    def poll_commands(self) -> list[dict[str, Any]]:
        """GET /v1/devices/commands — fetch + mark delivered."""
        resp = self._http.get(
            f"{self._base}/v1/devices/commands",
            headers=self._headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("data", [])

    def ack_command(self, command_id: str, status: str = "acknowledged", result: dict | None = None) -> None:
        """POST /v1/devices/commands/:id/ack"""
        body: dict[str, Any] = {"status": status}
        if result:
            body["result"] = result
        resp = self._http.post(
            f"{self._base}/v1/devices/commands/{command_id}/ack",
            json=body,
            headers=self._headers(),
        )
        resp.raise_for_status()

    def report_event(self, event_type: str, payload: dict | None = None) -> None:
        """POST /v1/devices/events — report a device event."""
        resp = self._http.post(
            f"{self._base}/v1/devices/events",
            json={"event_type": event_type, "payload": payload or {}},
            headers=self._headers(),
        )
        resp.raise_for_status()
