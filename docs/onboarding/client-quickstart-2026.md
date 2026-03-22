# Sven Client Quickstart (2026)

## Prerequisites
- Node.js 20.x
- Docker + Docker Compose
- Git
- (Desktop) Rust toolchain for Tauri builds

## 1. Bootstrap Core Stack
```bash
npm ci
docker compose up -d postgres nats gateway-api quickstart-static
```

## 2. Web/Admin
```bash
npm run dev:admin
npm run dev:canvas
```

## 3. Mobile (Expo)
```bash
npm run ops:mobile:preflight
npm --prefix apps/companion-mobile ci
npm --prefix apps/companion-mobile run start
```

## 4. Desktop (Tauri)
```bash
npm --prefix apps/companion-desktop-tauri ci
npm --prefix apps/companion-desktop-tauri run tauri:dev
```

## 5. CLI
```bash
npm run test:cli:e2e
node packages/cli/bin/sven.js --help
```

## 6. Health and Smoke
```bash
npm run release:verify:post
npm run release:edge:network:check
```
