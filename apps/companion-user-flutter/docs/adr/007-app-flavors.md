# ADR 007 — App Flavors: dev / staging / prod

**Date:** 2026-02-20
**Status:** Accepted
**Deciders:** Sven Engineering

---

## Context

The app previously had a single build target with no environment separation.
All environment-specific values (API base URL, Sentry DSN, analytics) were
either hardcoded to production or injected ad-hoc via `--dart-define` without
a structured convention.  This made it impossible to:

* Install dev/staging/prod side-by-side on a test device.
* Distinguish builds in Firebase App Distribution, Sentry, or crash logs.
* Use distinct API endpoints per environment without manual flag juggling.
* Let CI/CD reliably target the right backend for each branch/tag.

---

## Decision

Introduce **three named Android product flavors** (`dev`, `staging`, `prod`)
backed by Flutter's `--flavor` / `--target` mechanism, plus a central
`EnvConfig` class as the single source of truth for all compile-time values.

### Structure

```
lib/
  config/
    env_config.dart        ← EnvConfig compile-time constants
  main.dart                ← prod entry point (default, backward-compat)
  main_dev.dart            ← dev entry point
  main_staging.dart        ← staging entry point
android/app/build.gradle.kts
  └── productFlavors { dev, staging, prod }
android/app/src/
  dev/google-services.json      ← package: ...sven_user_flutter.dev
  staging/google-services.json  ← package: ...sven_user_flutter.staging
  prod/google-services.json     ← package: ...sven_user_flutter (prod)
```

> **Note:** dev/staging `google-services.json` files share the prod Firebase project
> entry temporarily (the `mobilesdk_app_id` is the same).  Full separation requires
> registering `com.fortyseven.thesven.dev` and `.staging` in the Firebase
> console and downloading their own config files.

### EnvConfig

`abstract final class EnvConfig` exposes:

| Constant | `--dart-define` key | dev default | staging default | prod default |
|---|---|---|---|---|
| `flavor` | `SVEN_FLAVOR` | `dev` | `staging` | `prod` |
| `apiBase` | `SVEN_API_BASE` | `https://dev.sven.example.com` | `https://staging.sven.example.com` | `https://app.sven.example.com` |
| `sentryDsn` | `SENTRY_DSN` | `''` (no-op) | `''` | `<prod dsn>` |
| `sentryEnv` | `SVEN_ENV` | `development` | `staging` | `production` |
| `allowFlagOverrides` | (derived) | `true` | `true` | `false` |

### Android application IDs

| Flavor | Application ID | App label |
|---|---|---|
| `dev` | `com.fortyseven.thesven.dev` | Sven Dev |
| `staging` | `com.fortyseven.thesven.staging` | Sven Staging |
| `prod` | `com.fortyseven.thesven` | Sven |

Dev and staging builds can be installed alongside the production app.

### Build commands

```bash
# dev
flutter build apk --flavor dev --target lib/main_dev.dart \
  --dart-define=SVEN_FLAVOR=dev \
  --dart-define=SVEN_API_BASE=https://dev.sven.example.com \
  --dart-define=SVEN_ENV=development

# staging
flutter build apk --flavor staging --target lib/main_staging.dart \
  --dart-define=SVEN_FLAVOR=staging \
  --dart-define=SVEN_API_BASE=https://staging.sven.example.com \
  --dart-define=SVEN_ENV=staging

# prod
flutter build apk --flavor prod --target lib/main.dart \
  --dart-define=SVEN_FLAVOR=prod \
  --dart-define=SVEN_ENV=production \
  --dart-define=SENTRY_DSN=<dsn>
```

### APK output paths (with flavors)

| Flavor | APK path |
|---|---|
| dev | `build/app/outputs/flutter-apk/app-dev-release.apk` |
| staging | `build/app/outputs/flutter-apk/app-staging-release.apk` |
| prod | `build/app/outputs/flutter-apk/app-prod-release.apk` |

---

## Alternatives considered

### 1. Separate repository / workspace per environment

Rejected — high maintenance, divergent code, no shared CI.

### 2. Runtime environment switching via SharedPreferences

Rejected — insecure (any user could point the prod app at a dev backend).
`String.fromEnvironment` values are compile-time constants; they cannot be
overridden at runtime.

### 3. `.env` files / `flutter_dotenv`

Rejected — `flutter_dotenv` reads from bundled assets at runtime; secrets are
visible in the APK.  Compile-time `--dart-define` is tree-shaken from release
builds and never appears in the asset bundle.

### 4. Firebase Remote Config for API base URL

Not needed at this stage — Remote Config is appropriate for gradual rollouts,
not for security-sensitive endpoint separation.

---

## Consequences

### Positive

* Dev/staging/prod can be installed side-by-side on any device.
* Sentry, Firebase Analytics, and crash logs are tagged per environment.
* CI pipelines can reliably target the correct backend for branch/tag builds.
* `EnvConfig.allowFlagOverrides` prevents accidental feature-flag tampering in
  production.
* Clear build recipes reduce onboarding friction.

### Negative

* Flutter's `--flavor` mechanism requires a flavor name on every build command.
  Builds without `--flavor` will fail once product flavors are defined.
  (Mitigated: CI workflows updated; docs/release-process.md should be updated.)
* dev/staging `google-services.json` files are placed in flavor source-set
  directories (`android/app/src/{flavor}/`) so the Google Services Gradle plugin
  finds the correct file per build variant.  Package names match the flavor's
  `applicationId` so the build succeeds.  However, `mobilesdk_app_id` is
  temporarily shared with prod — full Firebase analytics/crash isolation requires
  separate app registrations in the Firebase console.
* APK output path changed from `app-release.apk` → `app-prod-release.apk`.
  Any scripts referencing the old path need updating.

---

## References

* [Flutter — Using flavors](https://docs.flutter.dev/deployment/flavors)
* [Android — Product flavors](https://developer.android.com/build/build-variants#product-flavors)
* [Dart — fromEnvironment](https://api.dart.dev/stable/dart-core/String/String.fromEnvironment.html)
