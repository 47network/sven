FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687 AS build
WORKDIR /app
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY services/rag-notes-ingestor/package.json ./services/rag-notes-ingestor/package.json
RUN rm -f package-lock.json && npm install
COPY packages/shared ./packages/shared
COPY services/rag-notes-ingestor ./services/rag-notes-ingestor
RUN npm run build --workspace=packages/shared && npm run build --workspace=services/rag-notes-ingestor

FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json ./node_modules/@sven/shared/package.json
COPY --from=build /app/packages/shared/dist ./node_modules/@sven/shared/dist
COPY --from=build /app/services/rag-notes-ingestor/dist ./dist
USER node
CMD ["node", "dist/index.js"]

