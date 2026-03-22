# ─────────────────────────────────────────────────────────────
#  sven-mirror-agent — Dockerfile
#
#  Multi-stage build for any Linux device (x86_64 / arm64 / armv7).
#  Includes Chromium (kiosk display), ffmpeg, and optional camera support.
# ─────────────────────────────────────────────────────────────

FROM python:3.11-slim-bookworm@sha256:97b0eafb29f5ebfba254be840115b2f3bc24ff6ff3de9b905e04b74ee7227ba6 AS build

LABEL maintainer="47matrix / sven-team"

WORKDIR /app

COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

FROM python:3.11-slim-bookworm@sha256:97b0eafb29f5ebfba254be840115b2f3bc24ff6ff3de9b905e04b74ee7227ba6 AS runtime

LABEL maintainer="47matrix / sven-team"

# ── System deps ─────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    pulseaudio-utils \
    alsa-utils \
    espeak-ng \
    ffmpeg \
    v4l-utils \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
COPY --from=build /wheels /wheels
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels
RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin appuser \
    && mkdir -p /data \
    && chown -R appuser:appuser /app /data

# ── Application code ────────────────────────────────────────
COPY sven_mirror_agent/ sven_mirror_agent/

# ── Runtime ─────────────────────────────────────────────────
ENV PYTHONUNBUFFERED=1
ENV SVEN_DATA_DIR=/data

VOLUME ["/data"]
USER appuser

ENTRYPOINT ["python", "-m", "sven_mirror_agent"]
