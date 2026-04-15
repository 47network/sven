FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687 AS build
WORKDIR /app
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/marketing-intel/package.json ./packages/marketing-intel/package.json
COPY services/marketing-intel/package.json ./services/marketing-intel/package.json
RUN npm install
COPY packages/shared ./packages/shared
COPY packages/marketing-intel ./packages/marketing-intel
COPY services/marketing-intel ./services/marketing-intel
RUN npm run build --workspace=packages/shared && npm run build --workspace=packages/marketing-intel && npm run build --workspace=services/marketing-intel

FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687
WORKDIR /app
COPY --from=build /app/services/marketing-intel/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/marketing-intel/dist ./dist
COPY --from=build /app/packages/shared/package.json ./node_modules/@sven/shared/package.json
COPY --from=build /app/packages/shared/dist ./node_modules/@sven/shared/dist
COPY --from=build /app/packages/marketing-intel/package.json ./node_modules/@sven/marketing-intel/package.json
COPY --from=build /app/packages/marketing-intel/dist ./node_modules/@sven/marketing-intel/dist
COPY --from=build /app/services/marketing-intel/migrations ./migrations
USER node
CMD ["node", "dist/index.js"]
