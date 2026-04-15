FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687 AS builder
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/document-intel/package.json packages/document-intel/
COPY services/document-intel/package.json services/document-intel/

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
  strip('services/document-intel/package.json');\
  strip('packages/shared/package.json');\
  strip('packages/document-intel/package.json');"

RUN npm install --include=dev

# Copy sources (restores original package.json files)
COPY packages/shared packages/shared
COPY packages/document-intel packages/document-intel
COPY services/document-intel services/document-intel

# Build shared
RUN npm run build --workspace=packages/shared

# Build pillar package
RUN cd packages/document-intel && npx tsc

# Symlink @sven packages into node_modules
RUN mkdir -p node_modules/@sven \
  && ln -sf /app/packages/shared node_modules/@sven/shared \
  && ln -sf /app/packages/document-intel node_modules/@sven/document-intel

# Build service
RUN cd services/document-intel && npx tsc

# ── Runtime ──
FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages packages
COPY --from=builder /app/services/document-intel/dist services/document-intel/dist
COPY --from=builder /app/services/document-intel/package.json services/document-intel/package.json
COPY --from=builder /app/services/document-intel/migrations services/document-intel/migrations

RUN rm -rf node_modules/@sven && mkdir -p node_modules/@sven \
  && ln -s ../../packages/shared node_modules/@sven/shared \
  && ln -s ../../packages/document-intel node_modules/@sven/document-intel

USER node
CMD ["node", "services/document-intel/dist/index.js"]
