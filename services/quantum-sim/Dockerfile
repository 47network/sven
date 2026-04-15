FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687 AS build
WORKDIR /app
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/quantum-sim/package.json ./packages/quantum-sim/package.json
COPY services/quantum-sim/package.json ./services/quantum-sim/package.json
RUN npm install
COPY packages/shared ./packages/shared
COPY packages/quantum-sim ./packages/quantum-sim
COPY services/quantum-sim ./services/quantum-sim
RUN npm run build --workspace=packages/shared && npm run build --workspace=packages/quantum-sim && npm run build --workspace=services/quantum-sim

FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687
WORKDIR /app
COPY --from=build /app/services/quantum-sim/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/quantum-sim/dist ./dist
COPY --from=build /app/packages/shared/package.json ./node_modules/@sven/shared/package.json
COPY --from=build /app/packages/shared/dist ./node_modules/@sven/shared/dist
COPY --from=build /app/packages/quantum-sim/package.json ./node_modules/@sven/quantum-sim/package.json
COPY --from=build /app/packages/quantum-sim/dist ./node_modules/@sven/quantum-sim/dist
COPY --from=build /app/services/quantum-sim/migrations ./migrations
USER node
CMD ["node", "dist/index.js"]
