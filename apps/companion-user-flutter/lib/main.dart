import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import 'app/desktop_window.dart';
import 'app/performance_tracker.dart';
import 'app/service_locator.dart';
import 'app/sven_user_app.dart';
import 'config/env_config.dart';
import 'features/chat/background_chat_sync_service.dart';
import 'features/notifications/push_notification_manager.dart';
import 'firebase_options.dart';

class _FatalBootstrapApp extends StatelessWidget {
  const _FatalBootstrapApp({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              message,
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }
}

/// Top-level FCM background message handler.
/// Must be a top-level function (not a method) annotated with vm:entry-point.
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Firebase must be initialized before any Firebase calls.
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // Keep local chat cache hot even when the app is terminated/backgrounded.
  // Triggered from push payloads carrying chat_id.
  final chatId = message.data['chat_id'] as String?;
  await BackgroundChatSyncService.sync(chatId: chatId);
}

Future<void> _initializeFirebaseAndPush() async {
  try {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    // Re-enable messaging auto-init after launch so token generation and
    // background handlers are available without blocking cold-start.
    await FirebaseMessaging.instance.setAutoInitEnabled(true);
    // Register background message handler once Firebase is ready.
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    await PushNotificationManager.instance.initialize();
  } catch (_) {
    // Keep startup resilient if Firebase/push setup is temporarily unavailable.
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  PerformanceTracker.startFrameMonitoring();

  // Initialise native desktop window before any UI is rendered.
  // No-op on Android, iOS, and web ([isDesktop] == false).
  if (isDesktop) await DesktopWindowManager.instance.initialize();

  // Set up service locator (get_it) — DioHttpClient, AuthService, etc.
  // This is fail-closed for encryption readiness invariants.
  try {
    await setupServiceLocator();
  } catch (error, stackTrace) {
    FlutterError.reportError(
      FlutterErrorDetails(
        exception: error,
        stack: stackTrace,
        library: 'app-bootstrap',
        context: ErrorDescription('while initializing secure startup dependencies'),
      ),
    );
    runApp(
      const _FatalBootstrapApp(
        message:
            'Critical startup failure: local encryption is unavailable. '
            'For safety, startup is blocked.',
      ),
    );
    return;
  }

  final app = ProviderScope(
    child: SentryWidget(child: const SvenUserApp()),
  );

  // When Sentry DSN is empty, skip blocking Sentry init and render immediately.
  final dsn = EnvConfig.sentryDsn.trim();
  if (dsn.isEmpty) {
    runApp(app);
  } else {
    await SentryFlutter.init(
      (options) {
        options.dsn = dsn;
        options.tracesSampleRate = 0.2; // 20% of transactions
        // ignore: experimental_member_use
        options.profilesSampleRate = 0.1;
        options.attachScreenshot = true;
        options.environment = EnvConfig.sentryEnv;
      },
      appRunner: () => runApp(app),
    );
  }

  // Defer non-critical startup work to avoid blocking first frame.
  unawaited(_initializeFirebaseAndPush());
}
