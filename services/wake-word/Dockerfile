FROM node:20-bookworm-slim@sha256:a82f40540f5959e0003fb7b3c0f80490def2927be8bdbee7e3e0ac65cce3be92 AS deps

WORKDIR /workspace
COPY package.json package-lock.json* ./
COPY tsconfig.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
RUN npm install --include-workspace-root --workspace=@sven/wake-word

FROM node:20-bookworm-slim@sha256:a82f40540f5959e0003fb7b3c0f80490def2927be8bdbee7e3e0ac65cce3be92 AS builder

WORKDIR /app
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/tsconfig.json ./tsconfig.json
COPY --from=deps /workspace/tsconfig.base.json ./tsconfig.base.json
COPY --from=deps /workspace/package.json ./package.json
COPY --from=deps /workspace/services/wake-word ./services/wake-word
RUN if [ -d services/wake-word/node_modules ]; then cp -R services/wake-word/node_modules/. node_modules/; fi
COPY --from=deps /workspace/packages ./packages
RUN npm run build --workspace=@sven/shared && \
    npm run build --workspace=@sven/wake-word

FROM node:20-bookworm-slim@sha256:a82f40540f5959e0003fb7b3c0f80490def2927be8bdbee7e3e0ac65cce3be92

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/services/wake-word/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

ENV NODE_ENV=production
USER node
CMD ["node", "dist/index.js"]
