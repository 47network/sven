FROM node@sha256:09e2b3d9726018aecf269bd35325f46bf75046a643a66d28360ec71132750ec8 AS build

WORKDIR /app

# Copy workspace config and package manifests for layer caching
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY tsconfig.json ./tsconfig.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY services/workflow-executor/package.json ./services/workflow-executor/package.json

# Install dependencies
RUN npm install

# Copy sources
COPY packages/shared ./packages/shared
COPY services/workflow-executor ./services/workflow-executor

# Build shared first (provides @sven/shared types), then workflow-executor
RUN rm -f packages/shared/tsconfig.tsbuildinfo services/workflow-executor/tsconfig.tsbuildinfo
RUN npm run build --workspace=packages/shared && npm run build --workspace=services/workflow-executor

FROM node@sha256:09e2b3d9726018aecf269bd35325f46bf75046a643a66d28360ec71132750ec8 AS runtime

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/workflow-executor/dist ./dist
COPY --from=build /app/packages/shared/dist ./node_modules/@sven/shared/dist
COPY --from=build /app/packages/shared/package.json ./node_modules/@sven/shared/package.json

ENV NODE_ENV=production

USER node
CMD ["node", "dist/index.js"]

