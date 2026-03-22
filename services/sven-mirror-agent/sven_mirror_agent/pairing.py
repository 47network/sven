"""
Pairing flow — registers the device with the gateway and waits for admin
confirmation. Displays a 6-character pairing code on stdout (and optionally
on the device display).
"""

from __future__ import annotations

import logging
import time

from .api_client import ApiClient
from .config import AgentConfig

logger = logging.getLogger("sven_mirror_agent.pairing")

# How often to check whether pairing was confirmed (seconds)
POLL_INTERVAL = 3
# Maximum time to wait for pairing confirmation (seconds)
PAIRING_TIMEOUT = 900  # 15 minutes


def run_pairing(config: AgentConfig, client: ApiClient) -> tuple[str, str]:
    """
    Execute the pairing flow:
    1. POST /v1/devices/pair/start → get device_id + pairing_code
    2. Display pairing code and wait for admin to confirm
    3. On confirmation the heartbeat succeeds → save credentials
    Returns (device_id, api_key).
    """

    logger.info("Starting device pairing with gateway %s ...", config.gateway_url)

    data = client.pair_start(
        name=config.device_name,
        device_type=config.device_type,
        capabilities=config.capabilities,
        organization_id=config.organization_id,
        provisioning_token=config.provisioning_token,
        platform_info=config.platform_info,
    )

    device_info = data.get("data", data)
    device_id = device_info["id"]
    pairing_code = device_info.get("pairing_code", "??????")

    _display_pairing_code(pairing_code)

    # The gateway pair/start endpoint returns the API key in the response
    # but only after admin confirmation. The pair/start may return the key
    # immediately if auto-approve is enabled. Otherwise we need to wait
    # for the admin to call pair/confirm from the Flutter app, which
    # generates and stores the API key. The device doesn't get the key
    # directly — it was designed for admin-in-the-loop confirmation.
    #
    # Strategy: the device keeps trying heartbeat until it succeeds,
    # meaning the admin confirmed pairing & set the API key.
    # But we don't have the key yet! So we poll the pair/start
    # endpoint periodically. In our architecture the pair/start
    # won't return the key.
    #
    # Better approach: the pairing code is displayed, and the admin
    # confirms via POST /v1/admin/devices/:id/pair/confirm which
    # returns the API key to the admin. The admin sees the key and
    # can either:
    #   a) Manually enter it on the device, or
    #   b) The device polls a "pairing status" endpoint
    #
    # For now we implement a simple poll: the device re-checks its
    # registration status. We'll add a dedicated pairing-status
    # endpoint. For now the agent waits for the user to set the
    # SVEN_API_KEY env var or the key in state.json after the admin
    # copies it.
    #
    # ALTERNATIVELY: we add a no-auth endpoint the device can poll
    # to check if pairing is complete: GET /v1/devices/pair/status/:id
    logger.info(
        "Waiting for admin to confirm pairing in the Sven app...\n"
        "  Device ID:    %s\n"
        "  Pairing Code: %s",
        device_id,
        pairing_code,
    )

    api_key = _wait_for_key(config, device_id)

    # Persist so we don't pair again on restart
    config.save_state(device_id, api_key)
    client.api_key = api_key

    logger.info("✓ Pairing complete! Device '%s' is now connected.", config.device_name)
    return device_id, api_key


def _display_pairing_code(code: str) -> None:
    """Print visually prominent pairing code to terminal."""
    border = "╔══════════════════════════════════╗"
    bottom = "╚══════════════════════════════════╝"
    print()
    print(border)
    print("║    SVEN DEVICE PAIRING CODE      ║")
    print("║                                  ║")
    print(f"║          {code:^6s}                  ║")
    print("║                                  ║")
    print("║  Open Sven app → Settings →      ║")
    print("║  Devices → confirm this code     ║")
    print(bottom)
    print()


def _wait_for_key(config: AgentConfig, device_id: str) -> str:
    """
    Block until an API key appears in state.json or SVEN_API_KEY env var.
    In a production setup this would poll a gateway endpoint.
    """
    import os

    deadline = time.monotonic() + PAIRING_TIMEOUT
    while time.monotonic() < deadline:
        # Check env var (operator might set it after admin confirms)
        env_key = os.environ.get("SVEN_API_KEY", "").strip()
        if _validate_api_key(config, device_id, env_key):
            return env_key

        # Check state file (operator might paste the key there)
        state = config.load_state()
        state_key = str((state or {}).get("api_key", "")).strip()
        if _validate_api_key(config, device_id, state_key):
            return state_key

        time.sleep(POLL_INTERVAL)

    raise TimeoutError(
        f"Pairing was not confirmed within {PAIRING_TIMEOUT}s. "
        "Please confirm in the Sven app, copy the API key, "
        "and set SVEN_API_KEY or paste it into "
        f"{config.state_file}"
    )


def _validate_api_key(config: AgentConfig, expected_device_id: str, candidate_key: str) -> bool:
    if not candidate_key:
        return False

    probe = ApiClient(config.gateway_url, candidate_key)
    try:
        me = probe.get_me()
        payload = me.get("data", me)
        returned_device_id = str(payload.get("id", "")).strip()
        return bool(returned_device_id) and returned_device_id == expected_device_id
    except Exception as err:
        logger.debug("Pairing key probe failed: %s", err)
        return False
    finally:
        probe.close()
