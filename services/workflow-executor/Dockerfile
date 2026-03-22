FROM node@sha256:09e2b3d9726018aecf269bd35325f46bf75046a643a66d28360ec71132750ec8 AS build

WORKDIR /app

# Copy workspace
COPY package*.json ./
COPY tsconfig.json tsconfig.base.json ./
COPY services/workflow-executor ./services/workflow-executor
COPY packages ./packages

# Install dependencies
RUN npm ci --workspace=services/workflow-executor

WORKDIR /app/services/workflow-executor

# Build
RUN npm run build

FROM node@sha256:09e2b3d9726018aecf269bd35325f46bf75046a643a66d28360ec71132750ec8 AS runtime

WORKDIR /app

COPY package*.json ./
COPY services/workflow-executor/package*.json ./services/workflow-executor/
RUN npm ci --omit=dev --workspace=services/workflow-executor

COPY --from=build /app/services/workflow-executor/dist ./services/workflow-executor/dist

WORKDIR /app/services/workflow-executor

ENV NODE_ENV=production

# run
USER node
CMD ["npm", "start"]

