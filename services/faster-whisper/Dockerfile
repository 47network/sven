FROM node:20-bookworm-slim@sha256:a82f40540f5959e0003fb7b3c0f80490def2927be8bdbee7e3e0ac65cce3be92 AS deps

WORKDIR /workspace
COPY package.json package-lock.json* ./
COPY tsconfig.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
RUN npm install --include-workspace-root --workspace=@sven/faster-whisper

FROM node:20-bookworm-slim@sha256:a82f40540f5959e0003fb7b3c0f80490def2927be8bdbee7e3e0ac65cce3be92 AS builder

WORKDIR /app
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/tsconfig.json ./tsconfig.json
COPY --from=deps /workspace/tsconfig.base.json ./tsconfig.base.json
COPY --from=deps /workspace/package.json ./package.json
COPY --from=deps /workspace/services/faster-whisper ./services/faster-whisper
COPY --from=deps /workspace/packages ./packages
RUN npm run build --workspace=@sven/faster-whisper

# ── Final Stage: CUDA + Node.js + Python ─────────────────────────────────────
# We use NVIDIA's CUDA runtime image to support GPU acceleration for faster-whisper.
# This requires the host to have NVIDIA drivers and the NVIDIA Container Toolkit installed.
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04@sha256:85fb7ac694079fff1061a0140fd5b5a641997880e12112d92589c3bbb1e8b7ca

# Install Node.js 20, Python 3, FFmpeg
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates gnupg && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        nodejs \
        python3 \
        python3-pip \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create 'node' user (standard in official node images, missing in ubuntu)
RUN groupadd -g 1000 node && \
    useradd -u 1000 -g node -s /bin/bash -m node

COPY --from=builder --chown=node:node /app/services/faster-whisper/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=deps --chown=node:node /workspace/packages ./packages
COPY --chown=node:node services/faster-whisper/transcribe.py ./dist/transcribe.py
COPY --chown=node:node services/faster-whisper/transcribe.py ./transcribe.py

# Install Python dependencies
RUN python3 -m pip install --no-cache-dir faster-whisper

ENV NODE_ENV=production
USER node
CMD ["node", "dist/index.js"]
