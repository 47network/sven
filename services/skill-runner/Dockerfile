FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687 AS build
WORKDIR /app
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY services/skill-runner/package.json ./services/skill-runner/package.json
RUN npm install
COPY packages/shared ./packages/shared
COPY services/skill-runner ./services/skill-runner
RUN npm run build --workspace=packages/shared && npm run build --workspace=services/skill-runner

FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687

# ── System deps + Python ──────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    docker.io \
    python3 python3-pip python3-venv pipx \
    # Playwright / Chromium system deps
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libdbus-glib-1-2 libdrm2 libxshmfence1 \
    # git (aider commits)
    git \
    # curl + jq (handy in skills)
    curl jq \
    && rm -rf /var/lib/apt/lists/*

# ── Python skill dependencies ─────────────────────────────────────────────────
# Install into a venv so pip doesn't complain about the system environment
RUN python3 -m venv /opt/sven-py && \
    /opt/sven-py/bin/pip install --no-cache-dir --upgrade pip && \
    /opt/sven-py/bin/pip install --no-cache-dir \
    # browser-use skill
    "browser-use>=0.4.0" \
    "langchain-openai>=0.3.0" \
    "langchain-google-genai>=2.0.0" \
    "playwright>=1.50.0" \
    # aider skill
    "aider-install>=0.1.0"

# Expose the venv python on PATH so handler.ts can find it via `which python3`
ENV PATH="/opt/sven-py/bin:$PATH"

# ── Playwright browsers ───────────────────────────────────────────────────────
# Install Chromium + its deps into a known path
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN /opt/sven-py/bin/playwright install --with-deps chromium

# ── aider ─────────────────────────────────────────────────────────────────────
# aider-install places the real binary via pipx-style install; run it once
RUN python3 -m aider_install 2>/dev/null || \
    /opt/sven-py/bin/pip install --no-cache-dir "aider-chat>=0.75.0" && \
    aider --version

# ── Gemini CLI ────────────────────────────────────────────────────────────────
# Installed globally via npm so `gemini` is on PATH
RUN npm install -g @google/gemini-cli && gemini --version 2>/dev/null || true

# ── App ───────────────────────────────────────────────────────────────────────
WORKDIR /app
COPY --from=build /app/services/skill-runner/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/skill-runner/dist ./dist
COPY --from=build /app/packages/shared/dist ./node_modules/@sven/shared/dist
COPY --from=build /app/packages/shared/package.json ./node_modules/@sven/shared/package.json

# Skills directory (read-only mount at runtime via docker-compose)
RUN mkdir -p /opt/sven/registry

# Working directory for skills that operate on code
RUN mkdir -p /workspace && chown node:node /workspace
RUN mkdir -p /tmp/browser-downloads && chown node:node /tmp/browser-downloads

EXPOSE 3002

# Run as node for security; browser-use Chromium runs with --no-sandbox
USER node

CMD ["node", "dist/index.js"]

