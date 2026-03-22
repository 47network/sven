// lib/main_dev.dart
//
// Entry point for the **dev** flavor.
//
// All runtime behavior differences are controlled by --dart-define values
// passed at build time — this file simply delegates to the shared bootstrap.
//
// Build command:
//   flutter build apk \
//     --flavor dev \
//     --target lib/main_dev.dart \
//     --dart-define=SVEN_FLAVOR=dev \
//     --dart-define=SVEN_API_BASE=http://192.168.10.172:3000 \
//     --dart-define=SVEN_ENV=development
//
// Run command (local device):
//   flutter run \
//     --flavor dev \
//     --target lib/main_dev.dart \
//     --dart-define=SVEN_FLAVOR=dev \
//     --dart-define=SVEN_API_BASE=http://192.168.10.172:3000 \
//     --dart-define=SVEN_ENV=development

// --dart-define constants are compile-time and apply to the entire
// compilation unit regardless of entry point, so this file simply
// delegates to the shared bootstrap in main.dart.

import 'main.dart' as app_entry;

void main() => app_entry.main();
