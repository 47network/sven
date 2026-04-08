FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687 AS build
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git python3 make g++ && rm -rf /var/lib/apt/lists/*
# Rewrite ssh:// git deps to https:// so the build doesn't need SSH keys
RUN git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"
WORKDIR /app
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY tsconfig.json ./tsconfig.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY services/adapter-whatsapp-personal/package.json ./services/adapter-whatsapp-personal/package.json
RUN npm install
COPY packages/shared ./packages/shared
COPY services/adapter-whatsapp-personal ./services/adapter-whatsapp-personal
RUN npm run build --workspace=packages/shared && \
    npm run build --workspace=services/adapter-whatsapp-personal

FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687
WORKDIR /app

# Baileys needs native deps for media handling
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/adapter-whatsapp-personal/dist ./dist
COPY --from=build /app/packages/shared/dist ./node_modules/@sven/shared/dist
COPY --from=build /app/packages/shared/package.json ./node_modules/@sven/shared/package.json

RUN mkdir -p /data/whatsapp-sessions && chown node:node /data/whatsapp-sessions
VOLUME ["/data/whatsapp-sessions"]

USER node
EXPOSE 8444
CMD ["node", "dist/index.js"]
