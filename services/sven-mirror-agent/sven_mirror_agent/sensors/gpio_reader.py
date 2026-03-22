"""
Sensor reader — GPIO, I²C, and system metrics.

Works on any Linux device for system metrics (CPU temp, load, disk, memory).
GPIO and I²C sensors are RPi/SBC-only and gracefully degrade on other hardware.

Sensors:
  - System: CPU temperature, load average, memory usage, disk usage
  - GPIO (RPi): PIR motion, reed switches, buttons, LEDs
  - I²C (RPi): BME280 (temp/humidity/pressure), BH1750 (ambient light)
  - 1-Wire (RPi): DS18B20 (temperature probes)
"""

from __future__ import annotations

import logging
import os
import platform
from pathlib import Path
from typing import Any

logger = logging.getLogger("sven_mirror_agent.sensors")


class SensorService:
    """Reads system metrics and optional hardware sensors."""

    def __init__(self) -> None:
        self._gpio_available = self._check_gpio()
        self._i2c_available = self._check_i2c()
        logger.info(
            "Sensors: gpio=%s, i2c=%s, system=always",
            self._gpio_available,
            self._i2c_available,
        )

    @staticmethod
    def _check_gpio() -> bool:
        try:
            import RPi.GPIO  # noqa: F401

            return True
        except (ImportError, RuntimeError):
            return False

    @staticmethod
    def _check_i2c() -> bool:
        return Path("/dev/i2c-1").exists()

    # ── System Metrics (works on any Linux) ─────────────────────────────

    def read_system(self) -> dict[str, Any]:
        """Read system-level metrics available on any Linux device."""
        import psutil

        result: dict[str, Any] = {
            "platform": platform.machine(),
            "os": platform.system(),
        }

        # CPU temperature
        temps = psutil.sensors_temperatures()
        if temps:
            for name, entries in temps.items():
                if entries:
                    result["cpu_temp_c"] = entries[0].current
                    result["cpu_temp_source"] = name
                    break
        else:
            # Fallback: read from thermal zone (common on Linux)
            thermal = Path("/sys/class/thermal/thermal_zone0/temp")
            if thermal.exists():
                try:
                    raw = thermal.read_text().strip()
                    result["cpu_temp_c"] = int(raw) / 1000.0
                    result["cpu_temp_source"] = "thermal_zone0"
                except (ValueError, OSError):
                    pass

        # CPU load
        result["cpu_percent"] = psutil.cpu_percent(interval=0.5)
        result["load_avg"] = list(os.getloadavg()) if hasattr(os, "getloadavg") else []

        # Memory
        mem = psutil.virtual_memory()
        result["memory_total_mb"] = round(mem.total / 1048576, 1)
        result["memory_used_mb"] = round(mem.used / 1048576, 1)
        result["memory_percent"] = mem.percent

        # Disk
        disk = psutil.disk_usage("/")
        result["disk_total_gb"] = round(disk.total / 1073741824, 1)
        result["disk_used_gb"] = round(disk.used / 1073741824, 1)
        result["disk_percent"] = disk.percent

        # Uptime
        result["boot_time"] = psutil.boot_time()

        # Network
        net = psutil.net_io_counters()
        result["net_bytes_sent"] = net.bytes_sent
        result["net_bytes_recv"] = net.bytes_recv

        return result

    # ── GPIO (Raspberry Pi / SBC) ───────────────────────────────────────

    def read_gpio(self, pin: int) -> dict[str, Any]:
        """Read a GPIO pin value. Requires RPi.GPIO."""
        if not self._gpio_available:
            return {"error": "GPIO not available on this platform"}

        try:
            import RPi.GPIO as GPIO

            GPIO.setmode(GPIO.BCM)
            GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)
            value = GPIO.input(pin)
            return {"pin": pin, "value": value, "state": "high" if value else "low"}
        except Exception as exc:
            return {"error": f"GPIO read failed: {exc}"}

    def write_gpio(self, pin: int, value: bool) -> dict[str, Any]:
        """Write a GPIO pin (for LEDs, relays, etc.)."""
        if not self._gpio_available:
            return {"error": "GPIO not available on this platform"}

        try:
            import RPi.GPIO as GPIO

            GPIO.setmode(GPIO.BCM)
            GPIO.setup(pin, GPIO.OUT)
            GPIO.output(pin, GPIO.HIGH if value else GPIO.LOW)
            return {"pin": pin, "value": value, "written": True}
        except Exception as exc:
            return {"error": f"GPIO write failed: {exc}"}

    # ── I²C Sensors ─────────────────────────────────────────────────────

    def read_i2c_bme280(self) -> dict[str, Any]:
        """Read BME280 temperature/humidity/pressure sensor via I²C."""
        if not self._i2c_available:
            return {"error": "I²C not available on this platform"}

        try:
            import smbus2
            import bme280

            bus = smbus2.SMBus(1)
            address = 0x76
            calibration = bme280.load_calibration_params(bus, address)
            data = bme280.sample(bus, address, calibration)
            return {
                "temperature_c": round(data.temperature, 2),
                "humidity_percent": round(data.humidity, 2),
                "pressure_hpa": round(data.pressure, 2),
                "sensor": "bme280",
            }
        except (ImportError, Exception) as exc:
            return {"error": f"BME280 read failed: {exc}"}

    def read_ambient_light(self) -> dict[str, Any]:
        """Read BH1750 ambient light sensor via I²C."""
        if not self._i2c_available:
            return {"error": "I²C not available on this platform"}

        try:
            import smbus2

            bus = smbus2.SMBus(1)
            address = 0x23
            bus.write_byte(address, 0x10)  # Continuous high-res mode
            import time
            time.sleep(0.2)
            data = bus.read_i2c_block_data(address, 0x10, 2)
            lux = round((data[0] * 256 + data[1]) / 1.2, 1)
            return {"lux": lux, "sensor": "bh1750"}
        except (ImportError, Exception) as exc:
            return {"error": f"BH1750 read failed: {exc}"}

    # ── 1-Wire (DS18B20 temperature probes) ─────────────────────────────

    def read_1wire_temps(self) -> dict[str, Any]:
        """Read all DS18B20 temperature sensors on the 1-Wire bus."""
        base = Path("/sys/bus/w1/devices")
        if not base.exists():
            return {"error": "1-Wire bus not available (enable w1-gpio overlay)"}

        sensors: list[dict] = []
        for dev in base.glob("28-*"):
            try:
                raw = (dev / "w1_slave").read_text()
                if "YES" not in raw:
                    continue
                temp_str = raw.split("t=")[-1].strip()
                temp_c = int(temp_str) / 1000.0
                sensors.append({"id": dev.name, "temperature_c": round(temp_c, 2)})
            except (OSError, ValueError):
                continue

        return {"sensors": sensors, "count": len(sensors)}

    # ── Aggregate Read ──────────────────────────────────────────────────

    def read_all(self) -> dict[str, Any]:
        """Read all available sensors and return a combined result."""
        result: dict[str, Any] = {"system": self.read_system()}

        if self._gpio_available:
            result["gpio_available"] = True

        if self._i2c_available:
            bme = self.read_i2c_bme280()
            if "error" not in bme:
                result["environment"] = bme
            light = self.read_ambient_light()
            if "error" not in light:
                result["light"] = light

        temps = self.read_1wire_temps()
        if temps.get("count", 0) > 0:
            result["temperature_probes"] = temps

        return result

    def stop(self) -> None:
        """Clean up GPIO if initialized."""
        if self._gpio_available:
            try:
                import RPi.GPIO as GPIO

                GPIO.cleanup()
            except Exception:
                pass
