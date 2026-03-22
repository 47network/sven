FROM node:20-bookworm-slim@sha256:a82f40540f5959e0003fb7b3c0f80490def2927be8bdbee7e3e0ac65cce3be92 AS deps

WORKDIR /workspace
COPY package.json package-lock.json* ./
COPY tsconfig.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
RUN npm install --include-workspace-root --workspace=@sven/piper

FROM node:20-bookworm-slim@sha256:a82f40540f5959e0003fb7b3c0f80490def2927be8bdbee7e3e0ac65cce3be92 AS builder

WORKDIR /app
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/tsconfig.json ./tsconfig.json
COPY --from=deps /workspace/tsconfig.base.json ./tsconfig.base.json
COPY --from=deps /workspace/package.json ./package.json
COPY --from=deps /workspace/services/piper ./services/piper
COPY --from=deps /workspace/packages ./packages
RUN npm run build --workspace=@sven/piper

FROM node:20-bookworm-slim@sha256:a82f40540f5959e0003fb7b3c0f80490def2927be8bdbee7e3e0ac65cce3be92

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/services/piper/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=deps /workspace/packages ./packages

ENV NODE_ENV=production
USER node
CMD ["node", "dist/index.js"]
