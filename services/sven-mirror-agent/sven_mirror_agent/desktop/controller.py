from __future__ import annotations

import os
import platform
import shutil
import subprocess
from typing import Iterable


class DesktopController:
    def __init__(self, enabled: bool = True) -> None:
        self.enabled = enabled
        self.platform_name = platform.system().lower()

    def open_url(self, url: str) -> dict[str, object]:
        self._ensure_enabled()
        if not url:
          raise ValueError("url is required")
        self._run(self._open_command(url))
        return {"opened": True, "target": url}

    def open_app(self, app: str, args: object = None) -> dict[str, object]:
        self._ensure_enabled()
        if not app:
            raise ValueError("app is required")
        argv = [app]
        if isinstance(args, str) and args.strip():
            argv.extend(args.strip().split())
        elif isinstance(args, Iterable):
            argv.extend(str(value) for value in args if str(value).strip())
        self._run(argv)
        return {"opened": True, "app": app, "args": argv[1:]}

    def open_path(self, path: str) -> dict[str, object]:
        self._ensure_enabled()
        if not path:
            raise ValueError("path is required")
        self._run(self._open_command(path))
        return {"opened": True, "path": path}

    def type_text(self, text: str) -> dict[str, object]:
        self._ensure_enabled()
        if not text:
            raise ValueError("text is required")
        if self.platform_name == "linux" and shutil.which("xdotool"):
            self._run(["xdotool", "type", "--delay", "15", text])
            return {"typed": True, "chars": len(text)}
        raise RuntimeError(f"type_text not supported on {self.platform_name}")

    def hotkey(self, keys: object) -> dict[str, object]:
        self._ensure_enabled()
        chord = self._normalize_hotkey(keys)
        if not chord:
            raise ValueError("keys is required")
        if self.platform_name == "linux" and shutil.which("xdotool"):
            self._run(["xdotool", "key", chord])
            return {"sent": True, "keys": chord}
        raise RuntimeError(f"hotkey not supported on {self.platform_name}")

    def focus_window(self, target: str) -> dict[str, object]:
        self._ensure_enabled()
        if not target:
            raise ValueError("target is required")
        if self.platform_name == "linux" and shutil.which("wmctrl"):
            self._run(["wmctrl", "-a", target])
            return {"focused": True, "target": target}
        raise RuntimeError(f"focus_window not supported on {self.platform_name}")

    def _ensure_enabled(self) -> None:
        if not self.enabled:
            raise RuntimeError("desktop control is disabled")

    def _open_command(self, target: str) -> list[str]:
        if self.platform_name == "linux":
            opener = shutil.which("xdg-open")
            if opener:
                return [opener, target]
        if self.platform_name == "darwin":
            return ["open", target]
        if self.platform_name == "windows":
            return ["cmd", "/c", "start", "", target]
        raise RuntimeError(f"unsupported desktop platform: {self.platform_name}")

    def _normalize_hotkey(self, keys: object) -> str:
        if isinstance(keys, str):
            return keys.strip().lower()
        if isinstance(keys, Iterable):
            return "+".join(str(value).strip().lower() for value in keys if str(value).strip())
        return ""

    def _run(self, argv: list[str]) -> None:
        subprocess.run(
            argv,
            check=True,
            env=os.environ.copy(),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
