FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687 AS build
WORKDIR /app
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY tsconfig.json ./tsconfig.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY services/adapter-mattermost/package.json ./services/adapter-mattermost/package.json
RUN npm install
COPY packages/shared ./packages/shared
COPY services/adapter-mattermost ./services/adapter-mattermost
RUN npm run build --workspace=packages/shared && npm run build --workspace=services/adapter-mattermost

FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/adapter-mattermost/dist ./dist
COPY --from=build /app/packages/shared/dist ./node_modules/@sven/shared/dist
COPY --from=build /app/packages/shared/package.json ./node_modules/@sven/shared/package.json
USER node
CMD ["node", "dist/index.js"]

