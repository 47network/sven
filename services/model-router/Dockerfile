# ── Build stage ─────────────────────────────────────────────────────────
FROM node:22-slim@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687 AS build

WORKDIR /app

# Copy root workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Copy shared package
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src packages/shared/src

# Copy model-router library package
COPY packages/model-router/package.json packages/model-router/tsconfig.json packages/model-router/
COPY packages/model-router/src packages/model-router/src

# Copy this service
COPY services/model-router/package.json services/model-router/tsconfig.json services/model-router/
COPY services/model-router/src services/model-router/src

# Install pnpm and dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile --filter @sven/shared --filter @sven/model-router --filter @sven/model-router-service

# Build all three workspaces
RUN pnpm --filter @sven/shared run build \
 && pnpm --filter @sven/model-router run build \
 && pnpm --filter @sven/model-router-service run build

# ── Production stage ────────────────────────────────────────────────────
FROM node:22-slim@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687

WORKDIR /app
ENV NODE_ENV=production

# Copy built artifacts
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/model-router/dist packages/model-router/dist
COPY --from=build /app/packages/model-router/package.json packages/model-router/
COPY --from=build /app/services/model-router/dist services/model-router/dist
COPY --from=build /app/services/model-router/package.json services/model-router/
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json ./

# Copy migrations
COPY services/model-router/migrations services/model-router/migrations

# Symlink workspace packages
RUN mkdir -p node_modules/@sven \
 && ln -sf /app/packages/shared node_modules/@sven/shared \
 && ln -sf /app/packages/model-router node_modules/@sven/model-router

USER node

EXPOSE 9471

CMD ["node", "services/model-router/dist/index.js"]
