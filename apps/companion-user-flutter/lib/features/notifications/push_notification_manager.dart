import 'dart:async';
import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart'
    show TargetPlatform, debugPrint, defaultTargetPlatform, kIsWeb;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../../app/app_state.dart';
import '../../app/authenticated_client.dart';
import '../../app/service_locator.dart';
import '../chat/chat_service.dart';
import '../chat/messages_repository.dart';
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

  /// Trading alerts — trade executions, market insights, circuit breaker trips.
  static const String trading = 'sven_trading';
  static const String tradingName = 'Trading Alerts';
  static const String tradingDesc =
      'Trade executions, market insights, and trading alerts from Sven';
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
  bool _permissionRequested = false;
  Completer<void>? _initCompleter;

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

  /// Callback invoked when the user replies inline from a notification.
  /// Set by the app shell or handled internally.
  void Function(String chatId, String replyText)? onNotificationReply;

  /// Action ID for the inline-reply input on Android notifications.
  static const _replyActionId = 'sven_inline_reply';

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

  /// Initialize push notification infrastructure.
  ///
  /// Creates Android notification channels and sets up message listeners.
  /// Does NOT request the POST_NOTIFICATIONS permission — that is deferred
  /// to [requestPermissionAndRegister] which should be called after the user
  /// logs in, to avoid native Android crashes from showing a permission
  /// dialog while the widget tree is still bootstrapping.
  Future<void> initialize() async {
    if (_initialized) return;

    // Guard against concurrent callers (main + session-restore paths).
    if (_initCompleter != null) {
      await _initCompleter!.future;
      return;
    }
    _initCompleter = Completer<void>();

    try {
      if (!kIsWeb) {
        await _createAndroidChannels();
      }

      // Set up foreground message listener eagerly so messages arriving
      // after permission is granted are handled immediately.
      if (!kIsWeb) {
        // Wait for Firebase before subscribing to the messaging stream.
        if (await _waitForFirebase()) {
          FirebaseMessaging.onMessage.listen(_handleMessage);
        }
      }

      _initialized = true;
      debugPrint('✅ PushNotificationManager: initialized (permission deferred)');
    } catch (e) {
      debugPrint('⚠️  PushNotificationManager: initialization failed: $e');
      _initialized = true;
    } finally {
      _initCompleter!.complete();
    }
  }

  /// Request notification permission and register the FCM token.
  ///
  /// Call this after login when the widget tree is stable. Safe to call
  /// multiple times — permission is only requested once, subsequent calls
  /// just ensure the token is registered.
  ///
  /// The actual permission request is deferred to the next frame with a
  /// short delay to guarantee the Android Activity is fully in the RESUMED
  /// state. Calling `ActivityCompat.requestPermissions()` before the
  /// Activity is resumed crashes with `IllegalStateException`.
  Future<void> requestPermissionAndRegister() async {
    if (!_initialized) await initialize();
    if (_permissionRequested) return;
    _permissionRequested = true;

    // Ensure Firebase is ready — _initializeFirebaseAndPush() in main.dart
    // runs concurrently and may not have completed yet.
    if (!await _waitForFirebase()) {
      debugPrint('⚠️  Firebase not ready — skipping push permission request');
      _permissionRequested = false;
      return;
    }

    // Wait for the next frame + a short settling delay so the Android
    // Activity is guaranteed to be in RESUMED state before we pop a
    // system permission dialog.
    await Future<void>.delayed(const Duration(milliseconds: 500));

    try {
      if (kIsWeb) {
        await _initializeWebPush();
      } else {
        await _initializeMobilePush();
      }
    } catch (e) {
      debugPrint('⚠️  PushNotificationManager: permission/register failed: $e');
      _permissionRequested = false; // Allow retry on next login
    }
  }

  /// Poll until Firebase has been initialised (up to ~3 s).
  Future<bool> _waitForFirebase() async {
    const maxAttempts = 12;
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      if (Firebase.apps.isNotEmpty) return true;
      await Future<void>.delayed(const Duration(milliseconds: 250));
    }
    return Firebase.apps.isNotEmpty;
  }

  /// Create the three Android notification channels.
  ///
  /// Safe to call on iOS/macOS — `flutter_local_notifications` is a no-op on
  /// those platforms for channel creation.
  Future<void> _createAndroidChannels() async {
    const initSettings = InitializationSettings(
      android: AndroidInitializationSettings(
        '@mipmap/ic_launcher',
      ),
    );
    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationResponse,
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

    await androidPlugin.createNotificationChannel(
      const AndroidNotificationChannel(
        SvenNotificationChannels.trading,
        SvenNotificationChannels.tradingName,
        description: SvenNotificationChannels.tradingDesc,
        importance: Importance.high,
        enableVibration: true,
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

      // Note: onMessage listener is set up in initialize(), not here,
      // to avoid duplicate listeners.
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
  ///
  /// If permission has not been requested yet (first login), this will
  /// trigger [requestPermissionAndRegister] to show the POST_NOTIFICATIONS
  /// dialog and obtain the FCM token.
  Future<void> retryRegistration() async {
    if (_currentToken == null) {
      // Permission not yet requested — do it now (post-login, widget tree stable).
      await requestPermissionAndRegister();
      if (_currentToken == null) {
        debugPrint('⚠️  No FCM token available after permission request');
        return;
      }
    }
    final platform = _currentPlatform ?? (kIsWeb ? 'web' : _mobilePlatformTag());
    debugPrint('🔄 Retrying FCM token registration after login...');
    await _registerToken(_currentToken!, platform);
  }

  /// Handle a privacy-first push wake-up in the background isolate.
  ///
  /// Called from the top-level background message handler when a data-only
  /// FCM message with `type: "sven_push"` is received. Fetches the actual
  /// notification content from the Sven server and shows a local notification.
  Future<void> handleBackgroundPrivacyPush() async {
    try {
      if (!_initialized) {
        await _createAndroidChannels();
      }
      await _handlePrivacyPush();
    } catch (e) {
      debugPrint('⚠️  Background privacy push failed: $e');
    }
  }

  /// Handle incoming push message while the app is foregrounded.
  ///
  /// Supports two modes:
  /// 1. **Privacy-first (data-only)**: FCM delivers `{ type: "sven_push", nid: "..." }`.
  ///    The actual notification content is fetched directly from the Sven server.
  ///    Google/Apple never see the notification content.
  /// 2. **Legacy (notification payload)**: FCM delivers title/body directly.
  ///    Used as fallback when FCM server key is not configured on the backend.
  void _handleMessage(RemoteMessage message) {
    // Privacy-first: data-only wake-up from Sven server
    if (message.data['type'] == 'sven_push') {
      _handlePrivacyPush();
      return;
    }

    // Legacy: notification content delivered via FCM
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

  /// Privacy-first push handler: fetch actual notification content from our
  /// server after receiving a content-free FCM/UnifiedPush wake-up.
  ///
  /// This keeps Google and Apple completely out of the notification content
  /// path — they only know that *a notification exists*, not what it says.
  /// Similar to Rocket.Chat's push gateway approach.
  Future<void> _handlePrivacyPush() async {
    try {
      final pending = await _service.fetchPending();
      if (pending.isEmpty) return;

      final ackIds = <String>[];
      for (final notif in pending) {
        ackIds.add(notif.id);
        final chatId = notif.data['chat_id'] as String?;
        final channel = notif.channel;

        if (!_inAppController.isClosed) {
          _inAppController.add(InAppNotification(
            title: notif.title,
            body: notif.body,
            chatId: chatId,
            channel: channel,
          ));
        }

        if (_isInBackground) {
          _missedWhileAway.add(InAppNotification(
            title: notif.title,
            body: notif.body,
            chatId: chatId,
            channel: channel,
          ));
        }

        if (!kIsWeb) {
          await _showLocalNotification(
            title: notif.title,
            body: notif.body,
            chatId: chatId ?? '',
            channel: channel,
          );
        }
      }

      // Acknowledge so these notifications are not re-delivered
      await _service.ackPending(ackIds);
    } catch (e) {
      debugPrint('⚠️  Privacy push fetch failed: $e');
    }
  }

  /// Show a rich local notification that carries the chatId in its payload
  /// so tapping it navigates to the right conversation.
  ///
  /// Rich notification features:
  /// - [BigTextStyleInformation] shows full message preview (expandable).
  /// - Inline reply action (Android) lets users reply without opening the app.
  /// - Notifications are grouped by channel with [InboxStyleInformation] summary.
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

    // ── Build inline reply action for message notifications ──────────
    final List<AndroidNotificationAction> actions = [];
    if (channel == SvenNotificationChannels.messages && chatId.isNotEmpty) {
      actions.add(const AndroidNotificationAction(
        _replyActionId,
        'Reply',
        showsUserInterface: false,
        inputs: <AndroidNotificationActionInput>[
          AndroidNotificationActionInput(
            label: 'Type a reply…',
          ),
        ],
      ));
    }

    // ── Rich notification styling ────────────────────────────────────
    // BigTextStyleInformation shows full message preview when expanded,
    // including sender name as contentTitle and channel as summaryText.
    final richStyle = BigTextStyleInformation(
      body,
      htmlFormatBigText: false,
      contentTitle: title,
      htmlFormatContentTitle: false,
      summaryText: channel == SvenNotificationChannels.approvals
          ? 'Approvals'
          : channel == SvenNotificationChannels.reminders
              ? 'Reminders'
              : 'Messages',
      htmlFormatSummaryText: false,
    );

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
          styleInformation: richStyle,
          category: channel == SvenNotificationChannels.messages
              ? AndroidNotificationCategory.message
              : null,
          actions: actions,
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

  /// Unified handler for all notification interactions:
  /// - Regular tap → navigate to the chat.
  /// - Inline reply action → send the reply text to the chat.
  void _onNotificationResponse(NotificationResponse response) {
    final payload = response.payload;
    if (payload == null || payload.isEmpty) return;

    try {
      final data = jsonDecode(payload) as Map<String, dynamic>;
      final chatId = data['chat_id'] as String?;
      if (chatId == null || chatId.isEmpty) return;

      // ── Inline reply action ──────────────────────────────────────────
      if (response.notificationResponseType ==
              NotificationResponseType.selectedNotificationAction &&
          response.actionId == _replyActionId) {
        final replyText = response.input;
        if (replyText != null && replyText.trim().isNotEmpty) {
          debugPrint('📲 Inline reply → chat $chatId: ${replyText.trim()}');
          _handleInlineReply(chatId, replyText.trim());
          return;
        }
      }

      // ── Regular tap → navigate ─────────────────────────────────────
      if (onNavigateToChat != null) {
        debugPrint('📲 Local notification tapped → chat $chatId');
        onNavigateToChat!(chatId);
      }
    } catch (e) {
      debugPrint('⚠️  Failed to parse local notification payload: $e');
    }
  }

  /// Send an inline reply from the notification tray without opening the app.
  ///
  /// Uses the existing service locator to construct a [ChatService] and fire
  /// the message. If the external callback [onNotificationReply] is set, it
  /// is invoked instead so the app shell can route through its own pipeline.
  Future<void> _handleInlineReply(String chatId, String text) async {
    // Prefer the app shell callback when available (foreground).
    if (onNotificationReply != null) {
      onNotificationReply!(chatId, text);
      return;
    }
    // Background / terminated: send directly via ChatService.
    try {
      final client = sl<AuthenticatedClient>();
      MessagesRepository? repo;
      try {
        repo = sl<MessagesRepository>();
      } catch (_) {
        // Repo may not be available in background isolate.
      }
      final chatService = ChatService(client: client, repo: repo);
      await chatService.sendMessage(chatId, text);
      debugPrint('✅ Inline reply sent to chat $chatId');
    } catch (e) {
      debugPrint('❌ Inline reply failed: $e');
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
