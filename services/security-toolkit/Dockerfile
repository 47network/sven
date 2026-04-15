FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687 AS build
WORKDIR /app
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/security-toolkit/package.json ./packages/security-toolkit/package.json
COPY services/security-toolkit/package.json ./services/security-toolkit/package.json
RUN npm install
COPY packages/shared ./packages/shared
COPY packages/security-toolkit ./packages/security-toolkit
COPY services/security-toolkit ./services/security-toolkit
RUN npm run build --workspace=packages/shared && npm run build --workspace=packages/security-toolkit && npm run build --workspace=services/security-toolkit

FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687
WORKDIR /app
COPY --from=build /app/services/security-toolkit/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/security-toolkit/dist ./dist
COPY --from=build /app/packages/shared/package.json ./node_modules/@sven/shared/package.json
COPY --from=build /app/packages/shared/dist ./node_modules/@sven/shared/dist
COPY --from=build /app/packages/security-toolkit/package.json ./node_modules/@sven/security-toolkit/package.json
COPY --from=build /app/packages/security-toolkit/dist ./node_modules/@sven/security-toolkit/dist
COPY --from=build /app/services/security-toolkit/migrations ./migrations
USER node
CMD ["node", "dist/index.js"]
