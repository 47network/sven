FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687 AS builder
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY services/sven-eidolon/package.json services/sven-eidolon/

# Strip workspace:* and catalog: protocols that npm cannot handle
RUN node -e " \
  const fs=require('fs'); \
  function strip(file){\
    const p=JSON.parse(fs.readFileSync(file,'utf8'));\
    for(const sec of ['dependencies','devDependencies']){\
      for(const k of Object.keys(p[sec]||{})){\
        const v=String(p[sec][k]);\
        if(v.startsWith('workspace:')||v.startsWith('catalog:'))delete p[sec][k];\
      }\
    }\
    fs.writeFileSync(file,JSON.stringify(p,null,2));\
  }\
  strip('services/sven-eidolon/package.json');\
  strip('packages/shared/package.json');"

RUN npm install --include=dev

# Copy sources (restores original package.json files)
COPY packages/shared packages/shared
COPY services/sven-eidolon services/sven-eidolon

# Build shared → service
RUN npm run build --workspace=packages/shared

RUN mkdir -p node_modules/@sven \
  && ln -sf /app/packages/shared node_modules/@sven/shared

RUN cd services/sven-eidolon && npx tsc

# ── Runtime ──
FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages packages
COPY --from=builder /app/services/sven-eidolon/dist services/sven-eidolon/dist
COPY --from=builder /app/services/sven-eidolon/package.json services/sven-eidolon/package.json

RUN rm -rf node_modules/@sven && mkdir -p node_modules/@sven \
  && ln -s ../../packages/shared node_modules/@sven/shared

USER node
EXPOSE 9479
CMD ["node", "services/sven-eidolon/dist/index.js"]
