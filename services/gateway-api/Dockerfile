FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687 AS builder
WORKDIR /app
COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY services/gateway-api/package.json services/gateway-api/
RUN npm install --include=dev
COPY packages/shared packages/shared
COPY services/gateway-api services/gateway-api
COPY docs/community docs/community
COPY docs/release/status docs/release/status
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=services/gateway-api
RUN cp -r services/gateway-api/src/db/migrations services/gateway-api/dist/db/
RUN cp -r services/gateway-api/src/db/rollbacks services/gateway-api/dist/db/

FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages/shared packages/shared
COPY --from=builder /app/services/gateway-api/dist services/gateway-api/dist
COPY --from=builder /app/services/gateway-api/package.json services/gateway-api/package.json
COPY --from=builder /app/docs/community docs/community
COPY --from=builder /app/docs/release/status docs/release/status
RUN rm -rf node_modules/@sven/shared \
  && mkdir -p node_modules/@sven/shared \
  && cp -r packages/shared/dist node_modules/@sven/shared/dist \
  && cp packages/shared/package.json node_modules/@sven/shared/package.json
EXPOSE 3000
USER node
CMD ["node", "services/gateway-api/dist/index.js"]

