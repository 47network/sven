FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687 AS builder
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/marketing-intel/package.json packages/marketing-intel/
COPY services/marketing-intel/package.json services/marketing-intel/

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
  strip('services/marketing-intel/package.json');\
  strip('packages/shared/package.json');\
  strip('packages/marketing-intel/package.json');"

RUN npm install --include=dev

# Copy sources (restores original package.json files)
COPY packages/shared packages/shared
COPY packages/marketing-intel packages/marketing-intel
COPY services/marketing-intel services/marketing-intel

# Build shared
RUN npm run build --workspace=packages/shared

# Build pillar package
RUN cd packages/marketing-intel && npx tsc

# Symlink @sven packages into node_modules
RUN mkdir -p node_modules/@sven \
  && ln -sf /app/packages/shared node_modules/@sven/shared \
  && ln -sf /app/packages/marketing-intel node_modules/@sven/marketing-intel

# Build service
RUN cd services/marketing-intel && npx tsc

# ── Runtime ──
FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages packages
COPY --from=builder /app/services/marketing-intel/dist services/marketing-intel/dist
COPY --from=builder /app/services/marketing-intel/package.json services/marketing-intel/package.json
COPY --from=builder /app/services/marketing-intel/migrations services/marketing-intel/migrations

RUN rm -rf node_modules/@sven && mkdir -p node_modules/@sven \
  && ln -s ../../packages/shared node_modules/@sven/shared \
  && ln -s ../../packages/marketing-intel node_modules/@sven/marketing-intel

USER node
CMD ["node", "services/marketing-intel/dist/index.js"]
