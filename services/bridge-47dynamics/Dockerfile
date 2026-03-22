FROM node:22-slim AS builder
WORKDIR /build

# Copy workspace-level files for dependency resolution
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY services/bridge-47dynamics/package.json services/bridge-47dynamics/

RUN corepack enable && pnpm install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY services/bridge-47dynamics/ services/bridge-47dynamics/

RUN pnpm --filter @sven/shared build && \
    pnpm --filter @sven/bridge-47dynamics build

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime
RUN addgroup --system sven && adduser --system --ingroup sven sven

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/packages/shared/dist ./packages/shared/dist
COPY --from=builder /build/packages/shared/package.json ./packages/shared/
COPY --from=builder /build/services/bridge-47dynamics/dist ./dist
COPY --from=builder /build/services/bridge-47dynamics/package.json ./

# Copy proto for runtime resolution
COPY contracts/grpc/sven-bridge/v1/sven_bridge.proto ./proto/sven_bridge.proto

USER sven
EXPOSE 4020

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "const g=require('@grpc/grpc-js');const c=new(g.loadPackageDefinition(require('@grpc/proto-loader').loadSync('./proto/sven_bridge.proto',{keepCase:true})).fortyseven.sven.bridge.v1.SvenBridge)('localhost:4020',g.credentials.createInsecure());c.HealthCheck({tenant:{tenant_id:'healthcheck'}},(_,r)=>{process.exit(r?.overall==='SERVICE_HEALTH_HEALTHY'?0:1)})"

CMD ["node", "dist/index.js"]
