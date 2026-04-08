// lib/config/env_config.dart
//
// Single source of truth for all build-time environment configuration.
//
// Values are injected at compile time via --dart-define.  Nothing in this
// file changes at runtime; all getters are compile-time constants or
// simple derivations of them.
//
// Build recipes per flavor:
//
//   dev:
//     flutter build apk --flavor dev --target lib/main_dev.dart \
//       --dart-define=SVEN_FLAVOR=dev \
//       --dart-define=SVEN_API_BASE=http://192.168.10.172:3000 \
//       --dart-define=SVEN_ENV=development
//
//   staging:
//     flutter build apk --flavor staging --target lib/main_staging.dart \
//       --dart-define=SVEN_FLAVOR=staging \
//       --dart-define=SVEN_API_BASE=https://staging.sven.systems \
//       --dart-define=SVEN_ENV=staging
//
//   prod:
//     flutter build apk --flavor prod --target lib/main.dart \
//       --dart-define=SVEN_FLAVOR=prod \
//       --dart-define=SVEN_API_BASE=https://app.sven.systems \
//       --dart-define=SENV_ENV=production \
//       --dart-define=SENTRY_DSN=<dsn>
//
// See docs/adr/007-app-flavors.md for rationale.

// ignore_for_file: constant_identifier_names

/// Compile-time environment configuration for the current build flavor.
abstract final class EnvConfig {
  // ── Flavor ────────────────────────────────────────────────────────────────

  /// The active build flavor: `'dev'`, `'staging'`, or `'prod'`.
  ///
  /// Default is `'prod'` so that builds without `--dart-define=SVEN_FLAVOR`
  /// behave as production (safe fallback).
  static const String flavor = String.fromEnvironment(
    'SVEN_FLAVOR',
    defaultValue: 'prod',
  );

  static bool get isDev => flavor == 'dev';
  static bool get isStaging => flavor == 'staging';
  static bool get isProd => flavor == 'prod';

  // ── API ───────────────────────────────────────────────────────────────────

  /// Base URL for all API calls.  Override per flavor via
  /// `--dart-define=SVEN_API_BASE=<url>`.
  static const String _apiBaseOverride = String.fromEnvironment(
    'SVEN_API_BASE',
    defaultValue: '',
  );

  /// API base by flavor:
  /// - explicit `SVEN_API_BASE` define always wins
  /// - dev default points to local gateway on LAN
  /// - non-dev fallback remains production ingress
  static String get apiBase {
    if (_apiBaseOverride.isNotEmpty) return _apiBaseOverride;
    if (isDev) return 'http://192.168.10.172:3000';
    return 'https://app.sven.systems';
  }

  // ── Sentry ────────────────────────────────────────────────────────────────

  /// Sentry DSN.  Empty string → Sentry runs in no-op mode.
  static const String sentryDsn = String.fromEnvironment(
    'SENTRY_DSN',
    defaultValue: '',
  );

  /// Sentry environment tag.  Shown in the Sentry dashboard.
  static const String sentryEnv = String.fromEnvironment(
    'SVEN_ENV',
    defaultValue: 'production',
  );

  // ── Feature-flag dev overrides ─────────────────────────────────────────────

  /// When `true`, [FeatureFlagService] allows SharedPreferences overrides
  /// (i.e. the dev-tools flag toggle in Settings is active).
  ///
  /// Always `false` in prod to prevent accidental flag tampering.
  static bool get allowFlagOverrides => !isProd;

  // ── Display helpers ────────────────────────────────────────────────────────

  /// Human-readable label used in dev/staging banners.
  static String get flavorBadge => switch (flavor) {
        'dev' => 'DEV',
        'staging' => 'STAGING',
        _ => '',
      };
}
