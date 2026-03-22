# Contributing to Sven (companion-user-flutter)

Thanks for wanting to improve Sven! This guide covers everything you need to go from zero to opening a pull request.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Getting the code](#getting-the-code)
3. [Running locally](#running-locally)
4. [Project layout](#project-layout)
5. [Coding conventions](#coding-conventions)
6. [Commit messages](#commit-messages)
7. [Running tests](#running-tests)
8. [Opening a PR](#opening-a-pr)
9. [Release process](#release-process)

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Flutter | ≥ 3.27 (stable) | [flutter.dev/docs/get-started/install](https://flutter.dev/docs/get-started/install) |
| Dart | ships with Flutter | — |
| Android Studio / Xcode | latest | for device emulators |
| `adb` (Android Debug Bridge) | with platform-tools | optional, for physical device |
| Node 20+ | for gateway service | `nvm install 20` |

Verify your setup:
```bash
flutter doctor -v
```

---

## Getting the code

```bash
git clone <repo-url>
cd sven_v0.1.0/apps/companion-user-flutter
flutter pub get
```

---

## Running locally

### Android (physical device)

```bash
# Connect device with USB debugging enabled
adb devices                         # confirm device listed
flutter run -d <device-id>
```

### Android emulator

```bash
flutter emulators --launch <emulator-id>
flutter run
```

### iOS (macOS only)

```bash
open ios/Runner.xcworkspace          # first time: set signing team
flutter run -d <simulator-id>
```

### Hot-reload / hot-restart

Press `r` in the terminal to hot-reload; `R` to hot-restart; `q` to quit.

---

## Project layout

```
lib/
├── app/                     # App bootstrap, routing, theme, feature flags
│   ├── sven_user_app.dart   # Root widget + all pages assembled
│   ├── app_models.dart      # Top-level enums (VisualMode, etc.)
│   ├── feature_flag_service.dart
│   └── sven_tokens.dart     # Design tokens for classic/cinematic theme
│
├── features/
│   ├── auth/                # Sign-in, sign-up, app-lock
│   ├── chat/                # Chat thread, composer, message rendering
│   ├── memory/              # MemoryService, MemoryPage
│   ├── voice/               # VoiceService (STT + TTS pipeline)
│   ├── notifications/       # PushNotificationService + RemindersService
│   └── onboarding/          # Welcome + personalisation flow
│
└── shared/
    └── widgets/             # Reusable widgets used across features

test/
├── a11y_test.dart                  # Accessibility checks
├── widget_screen_test.dart         # Screen-level widget tests
├── integration_smoke_test.dart     # Login → MemoryService end-to-end (mock HTTP)
└── performance_benchmark_test.dart # Regression guard for CPU-sensitive paths

docs/
├── adr/                     # Architecture Decision Records
└── release-process.md       # Step-by-step release guide
```

---

## Coding conventions

- **Dart style**: follow `dart format` (enforced in CI). Run `dart format .` before committing.
- **Linting**: `flutter analyze` must pass with zero issues. Check with `flutter analyze lib test`.
- **Naming**: `camelCase` for variables/methods, `PascalCase` for classes, `snake_case` for files and keys.
- **No magic strings**: use `const` values or enums. Avoid hardcoding API endpoints — use `ApiConfig` constants.
- **State**: read [ADR 001](docs/adr/001-no-state-management-framework.md) before adding new stateful logic.
- **Tests**: all new services should have at least one unit test. UI-only changes should have a widget smoke test.

---

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer: BREAKING CHANGE: ...]
```

**Types:** `feat` · `fix` · `perf` · `refactor` · `test` · `docs` · `chore` · `ci`

**Examples:**

```
feat(memory): add preferred language dropdown to settings
fix(chat): prevent duplicate messages on SSE reconnect
perf(list): add RepaintBoundary per message bubble + cacheExtent
test(memory): widget smoke tests for MemoryPage
chore(ci): add Firebase App Distribution workflow
```

Commits are linted by `commitlint` ([commitlint.config.cjs](../../commitlint.config.cjs)).

---

## Running tests

```bash
# All tests
flutter test

# Single file
flutter test test/widget_screen_test.dart

# Performance benchmarks (may be slow on CI — run locally)
flutter test test/performance_benchmark_test.dart

# With coverage
flutter test --coverage
genhtml coverage/lcov.info -o coverage/html
open coverage/html/index.html
```

CI runs `flutter analyze` + `flutter test` + `dart format --set-exit-if-changed` on every PR.

---

## Opening a PR

1. Fork or create a feature branch: `git checkout -b feat/my-feature`.
2. Make your changes following the conventions above.
3. Run `dart format .` and `flutter analyze` — fix any issues.
4. Add or update tests covering your change.
5. Push and open a PR against `main`.
6. Fill in the PR template (auto-populates from `.github/pull_request_template.md` if present).
7. A CI run will start automatically. All checks must pass before merge.
8. Request review from at least one team member.

---

## Release process

1. Ensure `main` is green (all CI checks passing).
2. Update the version in `pubspec.yaml` (`version: X.Y.Z+BUILD`).
3. Push a tag: `git tag flutter-user-vX.Y.Z && git push origin flutter-user-vX.Y.Z`.
4. CI automatically:
   - Runs analyze + test.
   - Builds the release APK.
   - Uploads to Firebase App Distribution (internal testers).
   - Generates / updates `CHANGELOG.md`.
5. For Play Store / App Store, run the signing pipeline manually (see `scripts/sign_and_upload.sh` — TBD).

---

Questions? Open a discussion or ping the team.
