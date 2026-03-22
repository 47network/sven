import 'dart:async';
import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart'
    show TargetPlatform, debugPrint, defaultTargetPlatform, kIsWeb;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../../app/app_state.dart';
import 'notifications_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// Notification channel constants
// ═══════════════════════════════════════════════════════════════════════════

/// Android notification channel identifiers and display metadata.
///
/// These IDs must match the `channelId` sent in FCM payloads and the value
/// configured in the `com.google.firebase.messaging.default_notification_channel_id`
/// manifest meta-data.
abstract class SvenNotificationChannels {
  /// Inbound chat messages from the AI or other users.
  static const String messages = 'sven_messages';
  static const String messagesName = 'Messages';
  static const String messagesDesc = 'Chat messages from Sven';

  /// Device approval requests (requires attention from user).
  static const String approvals = 'sven_approvals';
  static const String approvalsName = 'Approvals';
  static const String approvalsDesc = 'Device and account approval requests';

  /// Scheduled reminders and proactive suggestions.
  static const String reminders = 'sven_reminders';
  static const String remindersName = 'Reminders';
  static const String remindersDesc =
      'Scheduled reminders and suggestions from Sven';
}

// ═══════════════════════════════════════════════════════════════════════════

/// A lightweight model for an in-app notification shown while the app is
/// foregrounded (FCM does not show a system notification in that case).
class InAppNotification {
  const InAppNotification({
    required this.title,
    required this.body,
    this.chatId,
    this.channel = SvenNotificationChannels.messages,
  });

  final String title;
  final String body;

  /// Optional chat ID carried from `message.data['chat_id']` — lets the shell
  /// navigate directly when the user taps the banner.
  final String? chatId;

  /// The notification channel this notification belongs to.
  final String channel;
}

/// Push notification manager for FCM (mobile) and VAPID (web).
///
/// Handles push token acquisition, registration, lifecycle management, and
/// Android notification channel creation.
///
/// Three channels are created on Android:
/// - `sven_messages`  — chat messages (high importance)
/// - `sven_approvals` — approval requests (high importance)
/// - `sven_reminders` — scheduled reminders (default importance)
///
/// Notifications are grouped per-channel so multiple messages bundle into
/// a single summary notification on Android.
class PushNotificationManager {
  PushNotificationManager._({NotificationsService? service})
      : _service = service ?? NotificationsService();

  static final PushNotificationManager _instance = PushNotificationManager._();
  static PushNotificationManager get instance => _instance;

  final NotificationsService _service;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  String? _currentToken;
  String? _currentPlatform;
  bool _initialized = false;

  /// Reference to AppState for DND schedule checks. Set by the app shell.
  AppState? appState;

  /// Tracks the last N notification lines per group for the inbox summary.
  static const _maxGroupLines = 6;
  static const _groupKeyMessages = 'com.sven.messages';
  static const _groupKeyApprovals = 'com.sven.approvals';
  static const _groupKeyReminders = 'com.sven.reminders';

  /// Fixed notification IDs used for the group summary notifications (one per channel).
  static const _summaryIdMessages = 90001;
  static const _summaryIdApprovals = 90002;
  static const _summaryIdReminders = 90003;
  final List<String> _recentMessageLines = [];
  final List<String> _recentApprovalLines = [];
  final List<String> _recentReminderLines = [];

  /// Callback to navigate to a specific chat. Set by the app shell.
  void Function(String chatId)? onNavigateToChat;

  /// Reads the current sound profile from [appState] (falls back to 'default').
  String get _effectiveSoundProfile => appState?.notifSound ?? 'default';

  /// Track notifications received while the app was backgrounded.
  final List<InAppNotification> _missedWhileAway = [];
  bool _isInBackground = false;

  /// Called by the app shell when the app goes to background.
  void onAppBackgrounded() => _isInBackground = true;

  /// Called when the app comes back to foreground. Returns the summary of
  /// missed notifications (if any) and clears the buffer.
  List<InAppNotification> consumeMissedSummary() {
    _isInBackground = false;
    if (_missedWhileAway.isEmpty) return const [];
    final copy = List<InAppNotification>.from(_missedWhileAway);
    _missedWhileAway.clear();
    return copy;
  }

  final _inAppController = StreamController<InAppNotification>.broadcast();

  String _mobilePlatformTag() {
    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
      case TargetPlatform.macOS:
        return 'ios';
      default:
        return 'android';
    }
  }

  /// Stream of notifications received while the app is in the foreground.
  ///
  /// FCM suppresses the system tray notification when the app is foregrounded,
  /// so callers should listen here and show an in-app banner/snackbar.
  Stream<InAppNotification> get foregroundNotifications =>
      _inAppController.stream;

  /// Initialize push notifications.
  ///
  /// Requests permissions, creates Android notification channels, and registers
  /// the push token with the backend.
  Future<void> initialize() async {
    if (_initialized) return;

    try {
      if (!kIsWeb) {
        await _createAndroidChannels();
      }

      if (kIsWeb) {
        await _initializeWebPush();
      } else {
        await _initializeMobilePush();
      }
      _initialized = true;
      debugPrint('✅ PushNotificationManager: initialized');
    } catch (e) {
      debugPrint('⚠️  PushNotificationManager: initialization failed: $e');
      _initialized = true; // Mark as initialized even on failure
    }
  }

  /// Create the three Android notification channels.
  ///
  /// Safe to call on iOS/macOS — `flutter_local_notifications` is a no-op on
  /// those platforms for channel creation.
  Future<void> _createAndroidChannels() async {
    const initSettings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    );
    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onLocalNotificationTap,
    );

    final androidPlugin =
        _localNotifications.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    if (androidPlugin == null) return;

    await androidPlugin.createNotificationChannel(
      const AndroidNotificationChannel(
        SvenNotificationChannels.messages,
        SvenNotificationChannels.messagesName,
        description: SvenNotificationChannels.messagesDesc,
        importance: Importance.high,
        enableVibration: true,
        playSound: true,
      ),
    );

    await androidPlugin.createNotificationChannel(
      const AndroidNotificationChannel(
        SvenNotificationChannels.approvals,
        SvenNotificationChannels.approvalsName,
        description: SvenNotificationChannels.approvalsDesc,
        importance: Importance.high,
        enableVibration: true,
        playSound: true,
      ),
    );

    await androidPlugin.createNotificationChannel(
      const AndroidNotificationChannel(
        SvenNotificationChannels.reminders,
        SvenNotificationChannels.remindersName,
        description: SvenNotificationChannels.remindersDesc,
        importance: Importance.defaultImportance,
        enableVibration: false,
        playSound: true,
      ),
    );

    debugPrint('✅ Android notification channels created');
  }

  /// Initialize web push with VAPID.
  Future<void> _initializeWebPush() async {
    final messaging = FirebaseMessaging.instance;
    final permission = await messaging.requestPermission();

    if (permission.authorizationStatus == AuthorizationStatus.authorized) {
      try {
        final vapidKey = await _service.getVapidPublicKey();
        final token = await messaging.getToken(vapidKey: vapidKey);
        if (token != null) {
          _currentToken = token;
          await _registerToken(token, 'web');
        }
      } catch (e) {
        debugPrint('⚠️  Web push setup failed: $e');
      }

      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        _currentToken = newToken;
        _registerToken(newToken, 'web');
      });

      FirebaseMessaging.onMessage.listen(_handleMessage);
    }
  }

  /// Initialize mobile push with FCM.
  Future<void> _initializeMobilePush() async {
    final messaging = FirebaseMessaging.instance;
    final permission = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (permission.authorizationStatus == AuthorizationStatus.authorized) {
      final token = await messaging.getToken();
      if (token != null) {
        _currentToken = token;
        await _registerToken(token, _mobilePlatformTag());
        debugPrint('✅ FCM Token: $token');
      }

      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        _currentToken = newToken;
        _registerToken(newToken, _mobilePlatformTag());
      });

      FirebaseMessaging.onMessage.listen(_handleMessage);

      // Note: onMessageOpenedApp and getInitialMessage are handled
      // by the app shell (_initFcmTapHandlers) for navigation routing.
    }
  }

  /// Register push token with backend.
  Future<void> _registerToken(String token, String platform) async {
    try {
      await _service.registerToken(token: token, platform: platform);
      _currentPlatform = platform;
      debugPrint('✅ Push token registered: $platform');
    } catch (e) {
      debugPrint('❌ Failed to register push token: $e');
    }
  }

  /// Retry token registration (useful after login when initial registration failed).
  Future<void> retryRegistration() async {
    if (_currentToken == null) {
      debugPrint('⚠️  No FCM token available to retry registration');
      return;
    }
    final platform = _currentPlatform ?? (kIsWeb ? 'web' : _mobilePlatformTag());
    debugPrint('🔄 Retrying FCM token registration after login...');
    await _registerToken(_currentToken!, platform);
  }

  /// Handle incoming push message while the app is foregrounded.
  void _handleMessage(RemoteMessage message) {
    final title = message.notification?.title ?? 'Sven';
    final body = message.notification?.body ?? '';
    final chatId = message.data['chat_id'] as String?;
    final channel = (message.data['channel'] as String?) ??
        SvenNotificationChannels.messages;

    if (!_inAppController.isClosed) {
      _inAppController.add(InAppNotification(
        title: title,
        body: body,
        chatId: chatId,
        channel: channel,
      ));
    }

    // Track for notification summary when app is backgrounded
    if (_isInBackground) {
      _missedWhileAway.add(InAppNotification(
        title: title,
        body: body,
        chatId: chatId,
        channel: channel,
      ));
    }

    // Also show a local notification so it appears in the notification shade
    // and supports tap-to-navigate
    if (!kIsWeb && chatId != null) {
      _showLocalNotification(
        title: title,
        body: body,
        chatId: chatId,
        channel: channel,
      );
    }
  }

  /// Show a local notification that carries the chatId in its payload
  /// so tapping it navigates to the right conversation.
  /// Notifications are grouped by channel — after each individual notification,
  /// a summary notification is posted/updated with InboxStyleInformation.
  Future<void> _showLocalNotification({
    required String title,
    required String body,
    required String chatId,
    required String channel,
  }) async {
    // DND scheduling — suppress notifications during quiet hours
    if (appState != null && appState!.isDndActive()) {
      debugPrint('🔕 Notification suppressed (DND active): $title');
      return;
    }

    final payload = jsonEncode({'chat_id': chatId, 'channel': channel});
    final id = chatId.hashCode.abs() % 100000;

    // Determine group key and tracked lines list for this channel.
    final String groupKey;
    final List<String> lines;
    final int summaryId;
    if (channel == SvenNotificationChannels.approvals) {
      groupKey = _groupKeyApprovals;
      lines = _recentApprovalLines;
      summaryId = _summaryIdApprovals;
    } else if (channel == SvenNotificationChannels.reminders) {
      groupKey = _groupKeyReminders;
      lines = _recentReminderLines;
      summaryId = _summaryIdReminders;
    } else {
      groupKey = _groupKeyMessages;
      lines = _recentMessageLines;
      summaryId = _summaryIdMessages;
    }

    // Track line for inbox summary
    lines.add('$title: $body');
    if (lines.length > _maxGroupLines) lines.removeAt(0);

    // 1) Show the individual notification (belongs to the group)
    await _localNotifications.show(
      id,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          channel,
          channel == SvenNotificationChannels.approvals
              ? SvenNotificationChannels.approvalsName
              : channel == SvenNotificationChannels.reminders
                  ? SvenNotificationChannels.remindersName
                  : SvenNotificationChannels.messagesName,
          importance: _effectiveSoundProfile == 'subtle'
              ? Importance.defaultImportance
              : Importance.high,
          priority: Priority.high,
          groupKey: groupKey,
          playSound: _effectiveSoundProfile != 'silent',
          enableVibration: _effectiveSoundProfile != 'silent',
        ),
      ),
      payload: payload,
    );

    // 2) Post / update the group summary notification so the OS
    //    bundles individual notifications under one expandable group.
    if (lines.length > 1) {
      final channelName = channel == SvenNotificationChannels.approvals
          ? SvenNotificationChannels.approvalsName
          : channel == SvenNotificationChannels.reminders
              ? SvenNotificationChannels.remindersName
              : SvenNotificationChannels.messagesName;

      await _localNotifications.show(
        summaryId,
        'Sven',
        '${lines.length} new notifications',
        NotificationDetails(
          android: AndroidNotificationDetails(
            channel,
            channelName,
            importance: Importance.high,
            priority: Priority.high,
            groupKey: groupKey,
            setAsGroupSummary: true,
            styleInformation: InboxStyleInformation(
              lines,
              contentTitle: 'Sven — ${lines.length} new',
              summaryText: channelName,
            ),
          ),
        ),
      );
    }
  }

  /// Handle tap on a local notification (flutter_local_notifications).
  /// Routes to the chat via the onNavigateToChat callback.
  void _onLocalNotificationTap(NotificationResponse response) {
    final payload = response.payload;
    if (payload == null || payload.isEmpty) return;

    try {
      final data = jsonDecode(payload) as Map<String, dynamic>;
      final chatId = data['chat_id'] as String?;
      if (chatId != null && onNavigateToChat != null) {
        debugPrint('📲 Local notification tapped → chat $chatId');
        onNavigateToChat!(chatId);
      }
    } catch (e) {
      debugPrint('⚠️  Failed to parse local notification payload: $e');
    }
  }

  /// Unregister current token and disable push notifications.
  Future<void> unregister() async {
    if (_currentToken != null) {
      try {
        await _service.unregisterToken(token: _currentToken!);
        await FirebaseMessaging.instance.deleteToken();
        _currentToken = null;
        debugPrint('✅ Push token unregistered');
      } catch (e) {
        debugPrint('❌ Failed to unregister push token: $e');
      }
    }
  }

  /// Get current push token (null if not registered).
  String? get currentToken => _currentToken;

  /// Check if push notifications are initialized and enabled.
  bool get isEnabled => _initialized && _currentToken != null;
}
