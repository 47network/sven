// lib/features/home_widget/home_widget_service.dart
//
// Thin Flutter-side service that writes shared data via the `home_widget`
// package and triggers a native widget refresh on both Android and iOS.
//
// Usage:
//   HomeWidgetService.instance.updateLastMessage(
//     text: 'Your AI response here...',
//     username: 'Ada',
//   );
//
// The service is intentionally silent on errors so widget failures never
// crash the main application.

import 'dart:io';

import 'package:home_widget/home_widget.dart';

/// iOS widget group identifier (WidgetKit App Group).
const _kIosAppGroupId = 'group.com.sven.companion.user.widget';

/// Android widget provider class path.
const _kAndroidWidgetProvider = 'com.sven.companion.user.SvenWidgetProvider';

/// Key names mirrored in the native layouts.
const _kKeyLastMessage = 'sven_last_message';
const _kKeyUsername = 'sven_username';
const _kKeyUpdatedAt = 'sven_updated_at';
const _kKeyUnreadCount = 'sven_unread_count';

/// Singleton service for updating the platform home-screen / lock-screen widget.
class HomeWidgetService {
  HomeWidgetService._();

  static final HomeWidgetService instance = HomeWidgetService._();

  bool _initialised = false;

  // ── Initialisation ──────────────────────────────────────────────────────────

  /// Call once at app start (e.g. in [AppState.bind]).
  Future<void> initialise() async {
    if (_initialised) return;
    try {
      await HomeWidget.setAppGroupId(_kIosAppGroupId);
      _initialised = true;
    } catch (_) {
      // Non-fatal — widget features are purely additive.
    }
  }

  // ── Data writes ─────────────────────────────────────────────────────────────

  /// Update the widget with the latest AI response text.
  ///
  /// [text]     – the assistant reply (will be truncated to 140 chars on
  ///              Android RemoteViews / iOS Text).
  /// [username] – display name shown in the widget header.
  /// [unread]   – optional badge count; defaults to 0 (no badge).
  Future<void> updateLastMessage({
    required String text,
    required String username,
    int unread = 0,
  }) async {
    await _silently(() async {
      await initialise();

      final preview = text.length > 140 ? '${text.substring(0, 137)}…' : text;
      final now = _timeLabel();

      await HomeWidget.saveWidgetData<String>(_kKeyLastMessage, preview);
      await HomeWidget.saveWidgetData<String>(_kKeyUsername, username);
      await HomeWidget.saveWidgetData<String>(_kKeyUpdatedAt, now);
      await HomeWidget.saveWidgetData<int>(_kKeyUnreadCount, unread);

      await _triggerUpdate();
    });
  }

  /// Clear the widget content (call on logout).
  Future<void> clear() async {
    await _silently(() async {
      await HomeWidget.saveWidgetData<String>(_kKeyLastMessage, '');
      await HomeWidget.saveWidgetData<String>(_kKeyUsername, '');
      await HomeWidget.saveWidgetData<String>(_kKeyUpdatedAt, '');
      await HomeWidget.saveWidgetData<int>(_kKeyUnreadCount, 0);
      await _triggerUpdate();
    });
  }

  // ── Interactivity (widget tap → open app) ───────────────────────────────────

  /// Register a callback for widget taps that pass a URI back (iOS / Android).
  /// The callback receives the URI the widget was configured with.
  void registerInteractivity(void Function(Uri) onUri) {
    HomeWidget.widgetClicked.listen((uri) {
      if (uri != null) onUri(uri);
    });
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  Future<void> _triggerUpdate() async {
    if (Platform.isAndroid) {
      await HomeWidget.updateWidget(
        androidName: _kAndroidWidgetProvider,
      );
    } else if (Platform.isIOS) {
      await HomeWidget.updateWidget(
        iOSName: 'SvenWidget',
      );
    }
  }

  /// Format: "h:mm a" – e.g. "3:42 PM".
  String _timeLabel() {
    final now = DateTime.now();
    final hour = now.hour % 12 == 0 ? 12 : now.hour % 12;
    final min = now.minute.toString().padLeft(2, '0');
    final amPm = now.hour < 12 ? 'AM' : 'PM';
    return '$hour:$min $amPm';
  }

  Future<void> _silently(Future<void> Function() fn) async {
    try {
      await fn();
    } catch (_) {
      // Widget updates are non-critical; swallow all errors silently.
    }
  }
}
