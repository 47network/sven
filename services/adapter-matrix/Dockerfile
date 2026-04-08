FROM node@sha256:7e791fc54bd02fc89fd4fb39eb37e5bea753c75679c8022478d81679367d995a AS build
WORKDIR /app
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY tsconfig.json ./tsconfig.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY services/adapter-matrix/package.json ./services/adapter-matrix/package.json
RUN npm install
COPY packages/shared ./packages/shared
COPY services/adapter-matrix ./services/adapter-matrix
RUN rm -f packages/shared/tsconfig.tsbuildinfo services/adapter-matrix/tsconfig.tsbuildinfo
RUN npm run build --workspace=packages/shared && npm run build --workspace=services/adapter-matrix

FROM node@sha256:80fdb3f57c815e1b638d221f30a826823467c4a56c8f6a8d7aa091cd9b1675ea
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/adapter-matrix/dist ./dist
COPY --from=build /app/packages/shared/dist ./node_modules/@sven/shared/dist
COPY --from=build /app/packages/shared/package.json ./node_modules/@sven/shared/package.json
USER node
CMD ["node", "dist/index.js"]

