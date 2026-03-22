"""
sven-mirror-agent — entry point.

Usage:
    python -m sven_mirror_agent
    python -m sven_mirror_agent --gateway-url https://sven.example.com
    python -m sven_mirror_agent --device-name "Kitchen Mirror" --device-type mirror

Or via environment variables:
    SVEN_GATEWAY_URL=https://sven.example.com python -m sven_mirror_agent
"""

from __future__ import annotations

import argparse
import logging
import sys

from .agent import MirrorAgent
from .api_client import ApiClient
from .config import AgentConfig
from .pairing import run_pairing


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="sven-mirror-agent",
        description="Sven Mirror Agent — connect desktop/edge devices to Sven",
    )
    parser.add_argument(
        "--gateway-url",
        help="Sven gateway URL (default: $SVEN_GATEWAY_URL or http://localhost:3000)",
    )
    parser.add_argument("--device-name", help="Device display name (default: hostname)")
    parser.add_argument(
        "--device-type",
        choices=["mirror", "tablet", "kiosk", "sensor_hub"],
        help="Device type (default: mirror)",
    )
    parser.add_argument(
        "--capabilities",
        help="Comma-separated capabilities (default: display,speaker)",
    )
    parser.add_argument("--api-key", help="Pre-provisioned API key (skip pairing)")
    parser.add_argument(
        "--no-display", action="store_true", help="Disable display module"
    )
    parser.add_argument(
        "--no-camera", action="store_true", help="Disable camera module"
    )
    parser.add_argument(
        "--no-audio", action="store_true", help="Disable audio module"
    )
    parser.add_argument(
        "--sensors", action="store_true", help="Enable GPIO/I²C sensor module"
    )
    parser.add_argument(
        "--no-desktop-control",
        action="store_true",
        help="Disable desktop control module (open_url/open_app/open_path)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Enable debug logging"
    )

    args = parser.parse_args()

    # ── Logging ─────────────────────────────────────────────────────────
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # ── Config ──────────────────────────────────────────────────────────
    config = AgentConfig()

    if args.gateway_url:
        config.gateway_url = args.gateway_url
    if args.device_name:
        config.device_name = args.device_name
    if args.device_type:
        config.device_type = args.device_type
    if args.capabilities:
        config.capabilities = [c.strip() for c in args.capabilities.split(",")]
    if args.api_key:
        config.api_key = args.api_key
    if args.no_display:
        config.display_enabled = False
    if args.no_camera:
        config.camera_enabled = False
    if args.no_audio:
        config.audio_enabled = False
    if args.sensors:
        config.sensor_enabled = True
    if args.no_desktop_control:
        config.desktop_control_enabled = False

    logger = logging.getLogger("sven_mirror_agent")
    logger.info("─" * 60)
    logger.info("Sven Mirror Agent starting")
    logger.info("  Gateway:      %s", config.gateway_url)
    logger.info("  Device name:  %s", config.device_name)
    logger.info("  Device type:  %s", config.device_type)
    logger.info("  Capabilities: %s", ", ".join(config.capabilities))
    logger.info("  Platform:     %s %s", config.platform_info["os"], config.platform_info["arch"])
    logger.info("─" * 60)

    # ── API client ──────────────────────────────────────────────────────
    client = ApiClient(config.gateway_url)

    # ── Pairing or resume ───────────────────────────────────────────────
    state = config.load_state()
    if state and state.get("api_key"):
        # Already paired — resume
        device_id = state["device_id"]
        client.api_key = state["api_key"]
        config.api_key = state["api_key"]
        logger.info("Resuming with device_id=%s", device_id)
    elif config.api_key:
        # API key provided via env/args — skip pairing
        client.api_key = config.api_key
        device_id = "pre-provisioned"
        logger.info("Using pre-provisioned API key")
    else:
        # Fresh device — run pairing flow
        device_id, _ = run_pairing(config, client)

    # ── Start agent ─────────────────────────────────────────────────────
    agent = MirrorAgent(config, client)
    agent.device_id = device_id

    try:
        agent.run()
    except KeyboardInterrupt:
        agent.stop()
    except Exception:
        logger.exception("Agent crashed")
        agent.stop()
        sys.exit(1)


if __name__ == "__main__":
    main()
