FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687 AS builder
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/quantum-sim/package.json packages/quantum-sim/
COPY services/quantum-sim/package.json services/quantum-sim/

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
  strip('services/quantum-sim/package.json');\
  strip('packages/shared/package.json');\
  strip('packages/quantum-sim/package.json');"

RUN npm install --include=dev

# Copy sources (restores original package.json files)
COPY packages/shared packages/shared
COPY packages/quantum-sim packages/quantum-sim
COPY services/quantum-sim services/quantum-sim

# Build shared
RUN npm run build --workspace=packages/shared

# Build pillar package
RUN cd packages/quantum-sim && npx tsc

# Symlink @sven packages into node_modules
RUN mkdir -p node_modules/@sven \
  && ln -sf /app/packages/shared node_modules/@sven/shared \
  && ln -sf /app/packages/quantum-sim node_modules/@sven/quantum-sim

# Build service
RUN cd services/quantum-sim && npx tsc

# ── Runtime ──
FROM node@sha256:c6585df72c34172bebd8d36abed961e231d7d3b5cee2e01294c4495e8a03f687
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages packages
COPY --from=builder /app/services/quantum-sim/dist services/quantum-sim/dist
COPY --from=builder /app/services/quantum-sim/package.json services/quantum-sim/package.json
COPY --from=builder /app/services/quantum-sim/migrations services/quantum-sim/migrations

RUN rm -rf node_modules/@sven && mkdir -p node_modules/@sven \
  && ln -s ../../packages/shared node_modules/@sven/shared \
  && ln -s ../../packages/quantum-sim node_modules/@sven/quantum-sim

USER node
CMD ["node", "services/quantum-sim/dist/index.js"]
