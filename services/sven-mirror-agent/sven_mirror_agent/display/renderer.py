"""
Display renderer — controls what's shown on the device screen.

Supports multiple backends:
  - chromium: Opens Chromium in kiosk mode (any Linux with X11/Wayland)
  - framebuffer: Direct framebuffer rendering via Pillow (headless / RPi)
  - none: Display commands are acknowledged but not rendered (headless)

The renderer is controlled entirely via commands from the gateway.
"""

from __future__ import annotations

import html
import json
import logging
import os
import shutil
import subprocess
import threading
from pathlib import Path
from typing import Any

logger = logging.getLogger("sven_mirror_agent.display")


class DisplayRenderer:
    """Manages the device display via Chromium kiosk or framebuffer."""

    def __init__(self, data_dir: Path) -> None:
        self._data_dir = data_dir
        self._display_dir = self._data_dir / "display"
        self._display_dir.mkdir(parents=True, exist_ok=True)
        self._scene_profiles_path = self._display_dir / "scene-profiles.json"
        self._scene_state_path = self._display_dir / "scene-state.json"
        self._chromium_proc: subprocess.Popen | None = None
        self._current_url: str = ""
        self._backend = self._detect_backend()
        self._lock = threading.Lock()
        logger.info("Display backend: %s", self._backend)

    # ── Backend detection ───────────────────────────────────────────────

    @staticmethod
    def _detect_backend() -> str:
        """Auto-detect the best available display backend."""
        display = os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")
        if display:
            # Check for chromium / chromium-browser / google-chrome
            for name in ("chromium-browser", "chromium", "google-chrome", "google-chrome-stable"):
                if shutil.which(name):
                    return "chromium"
        # Check for framebuffer
        if Path("/dev/fb0").exists():
            return "framebuffer"
        return "none"

    @property
    def backend(self) -> str:
        return self._backend

    # ── Public API ──────────────────────────────────────────────────────

    def show_url(self, url: str) -> dict[str, Any]:
        """Display a URL on screen."""
        with self._lock:
            self._current_url = url
            if self._backend == "chromium":
                return self._chromium_navigate(url)
            elif self._backend == "framebuffer":
                return self._fb_message(f"Displaying: {url}")
            else:
                logger.info("Display (noop): %s", url)
                return {"displayed": True, "backend": "none", "url": url}

    def show_html(self, html: str) -> dict[str, Any]:
        """Render raw HTML on screen."""
        page = self._display_dir / "current.html"
        page.write_text(html, encoding="utf-8")
        return self.show_url(f"file://{page}")

    def show_text(self, text: str, title: str = "Sven") -> dict[str, Any]:
        """Render plain text as a styled HTML page."""
        escaped = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body {{ background:#040712; color:#e0e6f0; font-family:Inter,sans-serif;
         display:flex; align-items:center; justify-content:center;
         height:100vh; margin:0; padding:40px; text-align:center; }}
  h1 {{ color:#00e5ff; margin-bottom:24px; font-size:2rem; }}
  p  {{ font-size:1.5rem; line-height:1.6; max-width:800px; }}
</style></head>
<body><div><h1>{title}</h1><p>{escaped}</p></div></body></html>"""
        return self.show_html(html)

    def show_scene(
        self,
        scene_name: str | None = None,
        slots: dict[str, Any] | None = None,
        title: str = "Sven Mirror",
        set_as_active: bool = True,
        scene_profile: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Render a named scene with slot data.

        Scene profiles are persisted locally and can be updated at runtime.
        Slots are merged into the active scene state and reused on later calls.
        """
        profiles = self._load_scene_profiles()
        if scene_name is None or not str(scene_name).strip():
            scene_name = self._load_scene_state().get("active_scene", "jarvis_main")
        scene_name = str(scene_name).strip()

        if scene_profile and isinstance(scene_profile, dict):
            profiles[scene_name] = scene_profile
            self._save_scene_profiles(profiles)

        profile = profiles.get(scene_name)
        if not isinstance(profile, dict):
            profile = profiles.get("jarvis_main", self._default_scene_profiles()["jarvis_main"])
            scene_name = "jarvis_main"

        state = self._load_scene_state()
        profile_slots_raw = state.get("profile_slots", {})
        profile_slots = (
            dict(profile_slots_raw) if isinstance(profile_slots_raw, dict) else {}
        )
        previous_slots = profile_slots.get(scene_name, {})
        merged_slots: dict[str, Any] = (
            dict(previous_slots) if isinstance(previous_slots, dict) else {}
        )
        if slots and isinstance(slots, dict):
            merged_slots.update(slots)
        profile_slots[scene_name] = merged_slots

        if set_as_active:
            state["active_scene"] = scene_name
        state["profile_slots"] = profile_slots
        self._save_scene_state(state)

        scene_html = self._render_scene_html(
            scene_name=scene_name,
            profile=profile,
            slots=merged_slots,
            title=title,
        )
        display_result = self.show_html(scene_html)
        return {
            **display_result,
            "scene_displayed": True,
            "scene": scene_name,
            "active_scene": state.get("active_scene", scene_name),
            "slots_count": len(merged_slots),
        }

    def _default_scene_profiles(self) -> dict[str, dict[str, Any]]:
        return {
            "jarvis_main": {
                "layout": "grid-2x2",
                "modules": [
                    {"slot": "clock", "type": "clock", "title": "Time"},
                    {"slot": "weather", "type": "weather", "title": "Weather"},
                    {"slot": "calendar", "type": "calendar", "title": "Calendar"},
                    {"slot": "camera", "type": "camera", "title": "Camera Feed"},
                ],
            },
            "ops_dashboard": {
                "layout": "split",
                "modules": [
                    {"slot": "clock", "type": "clock", "title": "Time"},
                    {"slot": "summary", "type": "cards", "title": "Status"},
                    {"slot": "alerts", "type": "cards", "title": "Alerts"},
                ],
            },
        }

    def _load_scene_profiles(self) -> dict[str, dict[str, Any]]:
        profiles = self._default_scene_profiles()
        if not self._scene_profiles_path.exists():
            self._save_scene_profiles(profiles)
            return profiles
        try:
            raw = json.loads(self._scene_profiles_path.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                for key, value in raw.items():
                    if isinstance(value, dict):
                        profiles[str(key)] = value
        except Exception as exc:
            logger.warning("Failed to load scene profiles: %s", exc)
        return profiles

    def _save_scene_profiles(self, profiles: dict[str, dict[str, Any]]) -> None:
        try:
            self._scene_profiles_path.write_text(
                json.dumps(profiles, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
        except Exception as exc:
            logger.warning("Failed to save scene profiles: %s", exc)

    def _load_scene_state(self) -> dict[str, Any]:
        default_state = {"active_scene": "jarvis_main", "profile_slots": {}}
        if not self._scene_state_path.exists():
            self._save_scene_state(default_state)
            return default_state
        try:
            raw = json.loads(self._scene_state_path.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                merged = dict(default_state)
                merged.update(raw)
                return merged
        except Exception as exc:
            logger.warning("Failed to load scene state: %s", exc)
        return default_state

    def _save_scene_state(self, state: dict[str, Any]) -> None:
        try:
            self._scene_state_path.write_text(
                json.dumps(state, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
        except Exception as exc:
            logger.warning("Failed to save scene state: %s", exc)

    def _render_scene_html(
        self,
        scene_name: str,
        profile: dict[str, Any],
        slots: dict[str, Any],
        title: str,
    ) -> str:
        modules = profile.get("modules", [])
        if not isinstance(modules, list):
            modules = []

        module_html: list[str] = []
        for module in modules:
            if not isinstance(module, dict):
                continue
            slot_name = str(module.get("slot", "unknown"))
            module_type = str(module.get("type", "cards")).lower()
            module_title = str(module.get("title", slot_name.title()))
            slot_data = slots.get(slot_name)
            content = self._render_scene_module_content(module_type, slot_data)
            module_html.append(
                (
                    '<section class="card">'
                    f'<header>{html.escape(module_title)}</header>'
                    f'<div class="content">{content}</div>'
                    "</section>"
                )
            )

        if not module_html:
            module_html.append(
                '<section class="card"><header>Scene</header><div class="content empty">No modules configured.</div></section>'
            )

        safe_title = html.escape(title)
        safe_scene = html.escape(scene_name)
        return f"""<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>{safe_title}</title>
    <style>
      :root {{
        --bg:#040712;
        --panel:#0c1428;
        --panel2:#0f1a34;
        --text:#e0e6f0;
        --muted:#8da3c7;
        --accent:#00e5ff;
        --warn:#ffb74d;
      }}
      * {{ box-sizing:border-box; }}
      body {{
        margin:0;
        min-height:100vh;
        font-family:Inter,Segoe UI,system-ui,sans-serif;
        color:var(--text);
        background:
          radial-gradient(circle at 20% 10%, rgba(0,229,255,0.18), transparent 40%),
          radial-gradient(circle at 80% 90%, rgba(100,181,246,0.18), transparent 45%),
          var(--bg);
      }}
      .shell {{
        padding:24px;
        display:flex;
        flex-direction:column;
        gap:16px;
      }}
      .topbar {{
        display:flex;
        justify-content:space-between;
        align-items:center;
        border:1px solid rgba(0,229,255,0.2);
        background:rgba(12,20,40,0.55);
        border-radius:12px;
        padding:12px 16px;
      }}
      .scene {{
        font-weight:700;
        letter-spacing:0.8px;
        text-transform:uppercase;
        color:var(--accent);
      }}
      .grid {{
        display:grid;
        gap:14px;
        grid-template-columns:repeat(2,minmax(0,1fr));
      }}
      .card {{
        border:1px solid rgba(141,163,199,0.22);
        background:linear-gradient(180deg, rgba(15,26,52,0.78), rgba(12,20,40,0.82));
        border-radius:14px;
        min-height:220px;
        overflow:hidden;
      }}
      .card header {{
        padding:12px 14px;
        border-bottom:1px solid rgba(141,163,199,0.2);
        font-size:0.9rem;
        color:var(--muted);
        text-transform:uppercase;
        letter-spacing:0.9px;
      }}
      .card .content {{
        padding:14px;
      }}
      .clock {{
        font-size:2.4rem;
        font-weight:700;
        color:var(--accent);
      }}
      .subtle {{ color:var(--muted); }}
      .empty {{ color:var(--muted); font-style:italic; }}
      .camera-img {{
        width:100%;
        border-radius:10px;
        border:1px solid rgba(141,163,199,0.2);
        display:block;
      }}
      ul {{ margin:0; padding-left:18px; }}
      li {{ margin:0 0 6px; }}
      .chip {{
        display:inline-block;
        padding:5px 9px;
        border-radius:999px;
        border:1px solid rgba(0,229,255,0.35);
        color:var(--accent);
        font-size:0.78rem;
      }}
      @media (max-width: 900px) {{
        .grid {{ grid-template-columns:1fr; }}
      }}
    </style>
  </head>
  <body>
    <main class="shell">
      <div class="topbar">
        <div>
          <div class="scene">{safe_title}</div>
          <div class="subtle">Scene: {safe_scene}</div>
        </div>
        <div class="chip" id="clock-chip">--:--</div>
      </div>
      <div class="grid">
        {''.join(module_html)}
      </div>
    </main>
    <script>
      const now = () => new Date().toLocaleTimeString([], {{hour: '2-digit', minute: '2-digit'}});
      const el = document.getElementById('clock-chip');
      if (el) {{
        el.textContent = now();
        setInterval(() => {{ el.textContent = now(); }}, 1000);
      }}
      const clocks = document.querySelectorAll('[data-clock-now]');
      clocks.forEach((c) => {{
        c.textContent = now();
        setInterval(() => {{ c.textContent = now(); }}, 1000);
      }});
    </script>
  </body>
</html>"""

    def _render_scene_module_content(self, module_type: str, slot_data: Any) -> str:
        if module_type == "clock":
            timezone = "Local"
            if isinstance(slot_data, dict) and slot_data.get("timezone"):
                timezone = str(slot_data.get("timezone"))
            return (
                '<div class="clock" data-clock-now>--:--</div>'
                f'<div class="subtle">{html.escape(timezone)}</div>'
            )

        if module_type == "weather":
            if isinstance(slot_data, dict):
                temp = slot_data.get("temperature", "--")
                cond = slot_data.get("condition", "Unknown")
                location = slot_data.get("location", "Unknown")
                return (
                    f'<div class="clock" style="font-size:2rem;">{html.escape(str(temp))}&deg;</div>'
                    f'<div>{html.escape(str(cond))}</div>'
                    f'<div class="subtle">{html.escape(str(location))}</div>'
                )
            return '<div class="empty">No weather data.</div>'

        if module_type == "calendar":
            events = []
            if isinstance(slot_data, dict) and isinstance(slot_data.get("events"), list):
                events = slot_data.get("events")
            if not events:
                return '<div class="empty">No upcoming events.</div>'
            rows = []
            for entry in events[:8]:
                if isinstance(entry, dict):
                    label = entry.get("title") or entry.get("name") or "Event"
                    when = entry.get("time") or entry.get("start") or ""
                    row = html.escape(str(label))
                    if when:
                        row += f' <span class="subtle">({html.escape(str(when))})</span>'
                    rows.append(f"<li>{row}</li>")
                else:
                    rows.append(f"<li>{html.escape(str(entry))}</li>")
            return f"<ul>{''.join(rows)}</ul>"

        if module_type == "camera":
            if isinstance(slot_data, dict):
                image_b64 = slot_data.get("image_base64")
                label = slot_data.get("label", "Live snapshot")
                if isinstance(image_b64, str) and image_b64.strip():
                    return (
                        f'<img class="camera-img" alt="{html.escape(str(label))}" '
                        f'src="data:image/jpeg;base64,{image_b64.strip()}"/>'
                    )
                url = slot_data.get("url")
                if isinstance(url, str) and url.strip():
                    return (
                        f'<img class="camera-img" alt="{html.escape(str(label))}" '
                        f'src="{html.escape(url.strip())}"/>'
                    )
            return '<div class="empty">No camera snapshot.</div>'

        # default cards module
        if isinstance(slot_data, dict):
            items = slot_data.get("items")
            if isinstance(items, list) and items:
                rows = [f"<li>{html.escape(str(item))}</li>" for item in items[:10]]
                return f"<ul>{''.join(rows)}</ul>"
            if "text" in slot_data:
                return f"<div>{html.escape(str(slot_data.get('text')))}</div>"
        if isinstance(slot_data, list) and slot_data:
            rows = [f"<li>{html.escape(str(item))}</li>" for item in slot_data[:10]]
            return f"<ul>{''.join(rows)}</ul>"
        if isinstance(slot_data, str) and slot_data.strip():
            return f"<div>{html.escape(slot_data.strip())}</div>"
        return '<div class="empty">No data.</div>'

    def show_pairing_code(self, code: str) -> dict[str, Any]:
        """Display the pairing code prominently."""
        html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body {{ background:#040712; color:#e0e6f0; font-family:Inter,sans-serif;
         display:flex; flex-direction:column; align-items:center;
         justify-content:center; height:100vh; margin:0; }}
  .code {{ font-size:6rem; font-weight:800; letter-spacing:12px;
           color:#00e5ff; font-family:monospace; margin:32px 0;
           text-shadow: 0 0 40px rgba(0,229,255,0.4); }}
  .label {{ font-size:1.2rem; opacity:0.6; }}
  .instruct {{ font-size:1rem; opacity:0.4; margin-top:24px; max-width:500px;
               text-align:center; line-height:1.5; }}
</style></head>
<body>
  <div class="label">SVEN PAIRING CODE</div>
  <div class="code">{code}</div>
  <div class="instruct">Open the Sven app → Settings → Devices → confirm this code</div>
</body></html>"""
        return self.show_html(html)

    def clear(self) -> dict[str, Any]:
        """Clear the display / show idle screen."""
        return self.show_text("", title="Sven — Ready")

    def stop(self) -> None:
        """Shut down the display renderer."""
        with self._lock:
            if self._chromium_proc and self._chromium_proc.poll() is None:
                self._chromium_proc.terminate()
                try:
                    self._chromium_proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self._chromium_proc.kill()
                self._chromium_proc = None

    # ── Chromium backend ────────────────────────────────────────────────

    def _find_chromium(self) -> str:
        for name in ("chromium-browser", "chromium", "google-chrome", "google-chrome-stable"):
            path = shutil.which(name)
            if path:
                return path
        raise FileNotFoundError("No Chromium / Chrome binary found on PATH")

    def _chromium_navigate(self, url: str) -> dict[str, Any]:
        """Launch Chromium in kiosk mode or navigate to a new URL."""
        if self._chromium_proc is None or self._chromium_proc.poll() is not None:
            self._chromium_start(url)
        else:
            # Use Chrome DevTools Protocol to navigate without restarting
            # For simplicity, restart Chromium (works for mirrors)
            self._chromium_proc.terminate()
            try:
                self._chromium_proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self._chromium_proc.kill()
            self._chromium_start(url)

        return {"displayed": True, "backend": "chromium", "url": url}

    def _chromium_start(self, url: str) -> None:
        chromium = self._find_chromium()
        user_dir = self._data_dir / "chromium-profile"
        user_dir.mkdir(parents=True, exist_ok=True)

        cmd = [
            chromium,
            "--kiosk",
            "--noerrdialogs",
            "--disable-infobars",
            "--disable-session-crashed-bubble",
            "--disable-translate",
            "--no-first-run",
            "--start-fullscreen",
            "--autoplay-policy=no-user-gesture-required",
            f"--user-data-dir={user_dir}",
            url,
        ]
        # Disable GPU if no GPU detected (common on headless / RPi)
        if not Path("/dev/dri").exists():
            cmd.insert(1, "--disable-gpu")

        logger.info("Launching Chromium kiosk: %s", url)
        self._chromium_proc = subprocess.Popen(
            cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )

    # ── Framebuffer backend ─────────────────────────────────────────────

    def _fb_message(self, text: str) -> dict[str, Any]:
        """Basic framebuffer text rendering (requires Pillow + fbcp)."""
        try:
            from PIL import Image, ImageDraw, ImageFont

            img = Image.new("RGB", (1920, 1080), color=(4, 7, 18))
            draw = ImageDraw.Draw(img)
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 48)
            except OSError:
                font = ImageFont.load_default()
            draw.text((100, 480), text, fill=(0, 229, 255), font=font)
            img.save("/dev/fb0", "PPM")
            return {"displayed": True, "backend": "framebuffer", "text": text}
        except Exception as exc:
            logger.warning("Framebuffer render failed: %s", exc)
            return {"displayed": False, "backend": "framebuffer", "error": str(exc)}
