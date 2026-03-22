# Mobile Push Notification Check

Generated: 2026-02-21T20:04:47.158Z
Status: pass

## Checks
- [x] android_post_notifications_permission_declared: apps/companion-user-flutter/android/app/src/main/AndroidManifest.xml
- [x] android_firebase_messaging_plugin_wired: apps/companion-user-flutter/android/app/build.gradle.kts
- [x] android_push_runtime_handlers_wired: apps/companion-user-flutter/lib/app/sven_user_app.dart
- [x] ios_url_scheme_for_app_callbacks_present: apps/companion-user-flutter/ios/Runner/Info.plist
- [x] ios_push_entitlement_configured: apps/companion-user-flutter/ios/Runner/Runner.entitlements + apps/companion-user-flutter/ios/Runner.xcodeproj/project.pbxproj
- [x] push_manager_handles_token_and_foreground_messages: apps/companion-user-flutter/lib/features/notifications/push_notification_manager.dart
- [x] android_firebase_config_present_for_all_flavors: android/app/src/{dev,staging,prod}/google-services.json
- [x] ios_firebase_production_values_configurable: apps/companion-user-flutter/lib/firebase_options.dart uses dart-define iOS production config keys
- [x] both_platform_runtime_test_evidence_present: requires Android+iOS push test evidence docs

