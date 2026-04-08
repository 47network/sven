"""
Audio player — TTS playback and microphone capture.

Uses system audio tools that work on any Linux:
  - aplay / paplay for playback
  - arecord / parecord for capture
  - pyttsx3 as fallback TTS engine
  - Optional: forwards audio to/from Sven's faster-whisper / piper services
"""

from __future__ import annotations

import io
import logging
import os
import shutil
import subprocess
import tempfile
import threading
from pathlib import Path
from typing import Any

logger = logging.getLogger("sven_mirror_agent.audio")


class AudioService:
    """Manages audio playback and microphone capture."""

    def __init__(self, data_dir: Path) -> None:
        self._data_dir = data_dir / "audio"
        self._data_dir.mkdir(parents=True, exist_ok=True)
        self._playback_proc: subprocess.Popen | None = None
        self._lock = threading.Lock()

        # Detect available audio tools
        self._player = self._detect_player()
        self._recorder = self._detect_recorder()
        logger.info("Audio player: %s, recorder: %s", self._player, self._recorder)

    @staticmethod
    def _detect_player() -> str:
        for cmd in ("paplay", "aplay", "mpv", "ffplay"):
            if shutil.which(cmd):
                return cmd
        return "none"

    @staticmethod
    def _detect_recorder() -> str:
        for cmd in ("parecord", "arecord"):
            if shutil.which(cmd):
                return cmd
        return "none"

    @property
    def can_play(self) -> bool:
        return self._player != "none"

    @property
    def can_record(self) -> bool:
        return self._recorder != "none"

    # ── TTS Speak ───────────────────────────────────────────────────────

    def speak(self, text: str, gateway_url: str = "", api_key: str = "") -> dict[str, Any]:
        """
        Speak text aloud. Strategy:
        1. If gateway TTS is reachable, use Sven's piper service
        2. Fallback to pyttsx3 local TTS
        3. Fallback to speech-dispatcher / espeak
        """
        # Try gateway TTS (piper) first
        if gateway_url and api_key:
            result = self._speak_via_gateway(text, gateway_url, api_key)
            if result.get("spoken"):
                return result

        # Fallback: pyttsx3
        try:
            import pyttsx3

            engine = pyttsx3.init()
            engine.say(text)
            engine.runAndWait()
            return {"spoken": True, "engine": "pyttsx3", "text": text}
        except (ImportError, RuntimeError):
            pass

        # Fallback: speech-dispatcher
        spd_say = shutil.which("spd-say")
        if spd_say:
            subprocess.run([spd_say, text], capture_output=True)
            return {"spoken": True, "engine": "spd-say", "text": text}

        # Fallback: espeak
        espeak = shutil.which("espeak") or shutil.which("espeak-ng")
        if espeak:
            subprocess.run([espeak, text], capture_output=True)
            return {"spoken": True, "engine": "espeak", "text": text}

        return {"spoken": False, "error": "No TTS engine available"}

    def _speak_via_gateway(self, text: str, gateway_url: str, api_key: str) -> dict[str, Any]:
        """Request TTS audio from Sven's piper service and play it."""
        try:
            import httpx

            # Use the gateway's TTS endpoint (if it exists)
            resp = httpx.post(
                f"{gateway_url.rstrip('/')}/v1/tts/synthesize",
                json={"text": text},
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=30.0,
            )
            if resp.status_code == 200:
                # Save and play the audio
                audio_path = self._data_dir / "tts_latest.wav"
                audio_path.write_bytes(resp.content)
                self._play_file(str(audio_path))
                return {"spoken": True, "engine": "piper", "text": text}
        except Exception as exc:
            logger.debug("Gateway TTS failed: %s", exc)
        return {"spoken": False}

    def _play_file(self, path: str) -> None:
        """Play an audio file using the detected player."""
        with self._lock:
            if self._player == "paplay":
                subprocess.run(["paplay", path], capture_output=True)
            elif self._player == "aplay":
                subprocess.run(["aplay", path], capture_output=True)
            elif self._player == "mpv":
                subprocess.run(["mpv", "--no-video", path], capture_output=True)
            elif self._player == "ffplay":
                subprocess.run(["ffplay", "-nodisp", "-autoexit", path], capture_output=True)

    # ── Microphone Capture ──────────────────────────────────────────────

    def record(self, duration: int = 5, sample_rate: int = 16000) -> dict[str, Any]:
        """
        Record audio from microphone. Returns path to WAV file.
        Duration in seconds.
        """
        if not self.can_record:
            return {"error": "No recording tool available"}

        output = self._data_dir / "recording.wav"

        try:
            if self._recorder == "parecord":
                cmd = [
                    "parecord",
                    f"--rate={sample_rate}",
                    "--channels=1",
                    "--format=s16le",
                    f"--process-time-msec={duration * 1000}",
                    str(output),
                ]
            else:  # arecord
                cmd = [
                    "arecord",
                    "-f", "S16_LE",
                    "-r", str(sample_rate),
                    "-c", "1",
                    "-d", str(duration),
                    str(output),
                ]

            subprocess.run(cmd, capture_output=True, timeout=duration + 5)
            return {
                "recorded": True,
                "path": str(output),
                "duration": duration,
                "sample_rate": sample_rate,
                "recorder": self._recorder,
            }
        except (subprocess.TimeoutExpired, OSError) as exc:
            return {"recorded": False, "error": str(exc)}

    # ── Cleanup ─────────────────────────────────────────────────────────

    def stop(self) -> None:
        with self._lock:
            if self._playback_proc and self._playback_proc.poll() is None:
                self._playback_proc.terminate()
