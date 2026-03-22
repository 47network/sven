FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687 AS build
WORKDIR /app
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY services/rag-git-ingestor/package.json ./services/rag-git-ingestor/package.json
RUN rm -f package-lock.json && npm install
COPY packages/shared ./packages/shared
COPY services/rag-git-ingestor ./services/rag-git-ingestor
RUN npm run build --workspace=packages/shared && npm run build --workspace=services/rag-git-ingestor

FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687
RUN apt-get update && apt-get install -y git --no-install-recommends && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json ./node_modules/@sven/shared/package.json
COPY --from=build /app/packages/shared/dist ./node_modules/@sven/shared/dist
COPY --from=build /app/services/rag-git-ingestor/dist ./dist
USER node
CMD ["node", "dist/index.js"]

