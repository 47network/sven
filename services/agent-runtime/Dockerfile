FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687 AS builder
WORKDIR /app
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/shared/package.json packages/shared/
COPY services/agent-runtime/package.json services/agent-runtime/
RUN npm install
COPY packages/shared packages/shared
COPY services/agent-runtime services/agent-runtime
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=services/agent-runtime

FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/shared/package.json packages/shared/package.json
COPY --from=builder /app/services/agent-runtime/dist services/agent-runtime/dist
COPY --from=builder /app/services/agent-runtime/package.json services/agent-runtime/package.json
USER node
CMD ["node", "services/agent-runtime/dist/index.js"]

