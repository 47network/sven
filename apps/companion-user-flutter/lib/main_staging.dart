// lib/main_staging.dart
//
// Entry point for the **staging** flavor.
//
// Build command:
//   flutter build apk \
//     --flavor staging \
//     --target lib/main_staging.dart \
//     --dart-define=SVEN_FLAVOR=staging \
//     --dart-define=SVEN_API_BASE=https://staging.sven.example.com \
//     --dart-define=SVEN_ENV=staging
//
// Run command (local device):
//   flutter run \
//     --flavor staging \
//     --target lib/main_staging.dart \
//     --dart-define=SVEN_FLAVOR=staging \
//     --dart-define=SVEN_API_BASE=https://staging.sven.example.com \
//     --dart-define=SVEN_ENV=staging

import 'main.dart' as app_entry;

void main() => app_entry.main();
