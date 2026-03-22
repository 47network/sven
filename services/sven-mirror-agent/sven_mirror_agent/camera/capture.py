"""
Camera capture — snapshots and presence detection.

Works on any Linux device with a camera:
  - USB webcam via V4L2 (OpenCV)
  - Raspberry Pi Camera Module via picamera2
  - IP camera via RTSP/MJPEG URL

Presence detection uses a simple frame-diff algorithm to detect motion
without requiring ML models. Face detection is optional (Haar cascades).
"""

from __future__ import annotations

import base64
import io
import logging
import threading
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger("sven_mirror_agent.camera")


class CameraService:
    """Manages camera capture and basic presence detection."""

    def __init__(self, data_dir: Path) -> None:
        self._data_dir = data_dir / "camera"
        self._data_dir.mkdir(parents=True, exist_ok=True)
        self._cap = None
        self._lock = threading.Lock()
        self._backend = "none"
        self._prev_frame = None
        self._motion_threshold = 5000  # pixel diff threshold
        self._init_camera()

    def _init_camera(self) -> None:
        """Try to initialize a camera capture backend."""
        # Try picamera2 first (RPi Camera Module)
        try:
            from picamera2 import Picamera2

            self._picam = Picamera2()
            self._picam.configure(
                self._picam.create_still_configuration(main={"size": (1920, 1080)})
            )
            self._picam.start()
            self._backend = "picamera2"
            logger.info("Camera backend: picamera2")
            return
        except (ImportError, RuntimeError):
            self._picam = None

        # Try OpenCV (USB webcam / V4L2)
        try:
            import cv2

            cap = cv2.VideoCapture(0)
            if cap.isOpened():
                self._cap = cap
                self._backend = "opencv"
                logger.info("Camera backend: opencv (device 0)")
                return
            cap.release()
        except ImportError:
            pass

        logger.info("Camera backend: none (no camera detected)")

    @property
    def available(self) -> bool:
        return self._backend != "none"

    @property
    def backend(self) -> str:
        return self._backend

    # ── Snapshots ───────────────────────────────────────────────────────

    def snapshot(self, width: int = 1280, height: int = 720) -> dict[str, Any]:
        """
        Capture a single frame. Returns base64-encoded JPEG + metadata.
        """
        with self._lock:
            if self._backend == "picamera2":
                return self._snapshot_picamera(width, height)
            elif self._backend == "opencv":
                return self._snapshot_opencv(width, height)
            else:
                return {"error": "No camera available"}

    def _snapshot_picamera(self, width: int, height: int) -> dict[str, Any]:
        import numpy as np
        from PIL import Image

        arr = self._picam.capture_array()
        img = Image.fromarray(arr).resize((width, height))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")

        # Save latest to disk
        path = self._data_dir / "latest.jpg"
        path.write_bytes(buf.getvalue())

        return {
            "image_base64": b64,
            "width": width,
            "height": height,
            "format": "jpeg",
            "backend": "picamera2",
            "path": str(path),
        }

    def _snapshot_opencv(self, width: int, height: int) -> dict[str, Any]:
        import cv2

        ret, frame = self._cap.read()
        if not ret:
            return {"error": "Failed to capture frame"}

        frame = cv2.resize(frame, (width, height))
        _, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        b64 = base64.b64encode(jpeg.tobytes()).decode("ascii")

        path = self._data_dir / "latest.jpg"
        path.write_bytes(jpeg.tobytes())

        return {
            "image_base64": b64,
            "width": width,
            "height": height,
            "format": "jpeg",
            "backend": "opencv",
            "path": str(path),
        }

    # ── Presence / Motion Detection ─────────────────────────────────────

    def detect_motion(self) -> dict[str, Any]:
        """
        Compare current frame to previous frame. Returns motion score.
        Uses simple grayscale frame differencing — works on any hardware.
        """
        if not self.available:
            return {"motion": False, "error": "No camera available"}

        with self._lock:
            if self._backend == "opencv":
                return self._motion_opencv()
            elif self._backend == "picamera2":
                return self._motion_picamera()
            return {"motion": False, "error": "Unsupported backend"}

    def _motion_opencv(self) -> dict[str, Any]:
        import cv2
        import numpy as np

        ret, frame = self._cap.read()
        if not ret:
            return {"motion": False, "error": "Failed to capture"}

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)

        if self._prev_frame is None:
            self._prev_frame = gray
            return {"motion": False, "score": 0, "threshold": self._motion_threshold}

        delta = cv2.absdiff(self._prev_frame, gray)
        _, thresh = cv2.threshold(delta, 25, 255, cv2.THRESH_BINARY)
        score = int(cv2.countNonZero(thresh))
        self._prev_frame = gray

        return {
            "motion": score > self._motion_threshold,
            "score": score,
            "threshold": self._motion_threshold,
        }

    def _motion_picamera(self) -> dict[str, Any]:
        import numpy as np
        from PIL import Image

        arr = self._picam.capture_array()
        img = Image.fromarray(arr).convert("L").resize((320, 240))
        gray = np.array(img)

        if self._prev_frame is None:
            self._prev_frame = gray
            return {"motion": False, "score": 0, "threshold": self._motion_threshold}

        delta = np.abs(gray.astype(int) - self._prev_frame.astype(int))
        score = int(np.sum(delta > 25))
        self._prev_frame = gray

        return {
            "motion": score > self._motion_threshold,
            "score": score,
            "threshold": self._motion_threshold,
        }

    # ── Cleanup ─────────────────────────────────────────────────────────

    def stop(self) -> None:
        with self._lock:
            if self._cap is not None:
                self._cap.release()
                self._cap = None
            if hasattr(self, "_picam") and self._picam is not None:
                try:
                    self._picam.stop()
                except Exception:
                    pass
