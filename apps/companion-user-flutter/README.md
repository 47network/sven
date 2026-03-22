# Sven User Flutter App

User-facing app target for:
- iOS
- Android
- Flutter Web

Admin UI remains in Next.js (`apps/admin-ui`).

## UX Direction

- Default visual mode: futuristic 2026 cinematic HUD.
- Optional mode: classic premium.
- Motion can be disabled for accessibility/performance.

## Local bootstrap

```bash
flutter pub get
flutter analyze
flutter test
```

## Run

```bash
flutter run
```

Run against local backend (`192.168.10.172`):

```bash
flutter run \
  --flavor dev \
  --target lib/main_dev.dart \
  --dart-define=SVEN_FLAVOR=dev \
  --dart-define=SVEN_API_BASE=http://192.168.10.172:3000 \
  --dart-define=SVEN_ENV=development
```

Patrol against local backend:

```bash
patrol test \
  --flavor dev \
  --target lib/main_dev.dart \
  --dart-define=SVEN_FLAVOR=dev \
  --dart-define=SVEN_API_BASE=http://192.168.10.172:3000 \
  --dart-define=SVEN_ENV=development
```

## Build web

```bash
flutter build web --release
```
