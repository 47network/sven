import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

import '../features/auth/auth_errors.dart';
import '../features/auth/auth_service.dart';
import '../features/auth/login_page.dart';
import '../features/approvals/approvals_page.dart';
import '../features/deployment/deployment_service.dart';
import '../features/devices/device_service.dart';
import '../features/deployment/deployment_setup_page.dart';
import '../features/chat/chat_models.dart';
import '../features/chat/chat_service.dart';
import '../features/chat/chat_thread_page.dart';
import '../features/chat/prompt_templates_service.dart';
import '../features/chat/prompt_history_service.dart';
import '../features/chat/sync_service.dart';
import '../features/chat/voice_overlay.dart';
import '../features/chat/voice_service.dart';
import '../features/memory/memory_service.dart';
import '../features/notifications/push_notification_manager.dart';
import '../features/onboarding/onboarding_page.dart';
import '../features/security/app_lock_service.dart';
import '../features/security/app_lock_gate.dart';
import '../features/preferences/ui_preferences_service.dart';
import '../features/home/feature_tooltip_service.dart';
import '../features/onboarding/tutorial_service.dart';
import '../features/projects/project_service.dart';
import 'api_base_service.dart';
import 'feature_flag_service.dart';
import 'ab_test_service.dart';
import 'keyboard_nav.dart';
import '../features/auth/sso_service.dart';
import '../features/auth/mfa_page.dart';
import 'authenticated_client.dart';
import 'deep_link.dart';
import 'app_models.dart';
import 'app_state.dart';
import 'scoped_preferences.dart';
import 'service_locator.dart';
import 'sven_glass.dart';
import 'sven_theme.dart';
import 'sven_tokens.dart';
import 'performance_tracker.dart';
import 'router.dart';
import '../features/chat/messages_repository.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'providers.dart';
import 'app_shell.dart';

class SvenUserApp extends ConsumerStatefulWidget {
  const SvenUserApp({super.key});

  @override
  ConsumerState<SvenUserApp> createState() => _SvenUserAppState();
}

class _SvenUserAppState extends ConsumerState<SvenUserApp>
    with WidgetsBindingObserver {
  final _appLinks = AppLinks();
  final _navKey = GlobalKey<NavigatorState>();
  late final GoRouter _router;
  late final UiPreferencesService _prefsService;
  late final AppState _state;
  late final AuthenticatedClient _authClient;
  final _auth = AuthService();
  final _sso = SsoService();
  final _deploymentService = DeploymentService();
  final _battery = Battery();
  final _voiceService = VoiceService();
  final _memoryService = MemoryService();
  final _lockService = AppLockService();
  final _promptTemplatesService = PromptTemplatesService();
  final _promptHistoryService = PromptHistoryService();
  final _tooltipService = FeatureTooltipService();
  final _tutorialService = TutorialService();
  final _projectService = ProjectService();
  late final DeviceService _deviceService;
  late final SyncService _syncService;
  ScopedPreferences? _scopedPrefs;
  DeepLinkTarget? _pendingLink;
  StreamSubscription<dynamic>? _foregroundNotifSub;
  StreamSubscription<BatteryState>? _batterySub;
  StreamSubscription<RemoteMessage>? _fcmOpenedAppSub;
  bool _wakeWordLaunchInFlight = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _authClient = AuthenticatedClient(
      onSessionExpired: _handleActiveSessionExpired,
    );
    _deviceService = DeviceService(client: _authClient);
    _syncService = SyncService(repository: sl<MessagesRepository>())
      ..setClient(_authClient);
    _prefsService = UiPreferencesService(client: _authClient);
    _state = AppState(onPrefsChanged: _prefsService.update);
    _router = _buildRouter();
    _state.addListener(_handleStateChanged);

    // Defer non-critical startup routines until after first frame so
    // launch/display isn't delayed by bootstrapping side effects.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(_syncService.init());
      unawaited(_bootstrap());
      unawaited(_initDeepLinks());
      unawaited(_initFcmTapHandlers());
      _initForegroundNotifications();

      // Wire local notification taps → chat navigation.
      PushNotificationManager.instance.onNavigateToChat = (chatId) {
        _handleDeepLink(Uri.parse('sven://chat/$chatId'));
      };
      PushNotificationManager.instance.appState = _state;

      unawaited(_initBatteryMonitor());
    });
  }

  @override
  void dispose() {
    _foregroundNotifSub?.cancel();
    _batterySub?.cancel();
    _fcmOpenedAppSub?.cancel();
    _state.removeListener(_handleStateChanged);
    _voiceService.dispose();
    _syncService.dispose();
    _memoryService.dispose();
    _lockService.dispose();
    _router.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      PerformanceTracker.startWarmResume();
      _lockService.onBackground();
      PushNotificationManager.instance.onAppBackgrounded();
      unawaited(_voiceService.stopWakeWordMonitor());
      return;
    }
    if (state == AppLifecycleState.resumed) {
      PerformanceTracker.logWarmResume();
      _lockService.onForeground();
      _showMissedNotificationSummary();
      unawaited(_syncWakeWordMonitor());
    }
  }

  void _handleStateChanged() {
    unawaited(_syncWakeWordMonitor());
  }

  /// Called by the OS when memory is critically low.
  /// Evicts image caches to free GPU + RAM immediately.
  @override
  void didHaveMemoryPressure() {
    super.didHaveMemoryPressure();
    PaintingBinding.instance.imageCache.clear();
    PaintingBinding.instance.imageCache.clearLiveImages();
  }

  /// Show a summary snackbar if notifications arrived while the app was backgrounded.
  void _showMissedNotificationSummary() {
    final missed = PushNotificationManager.instance.consumeMissedSummary();
    if (missed.isEmpty) return;

    final messenger = ScaffoldMessenger.maybeOf(_navKey.currentContext!);
    if (messenger == null) return;

    final count = missed.length;
    final preview = missed.take(3).map((n) => n.title).join(', ');
    final label = count == 1
        ? missed.first.title
        : '$count notifications while you were away';

    messenger.showSnackBar(
      SnackBar(
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.notifications_active_rounded,
                    size: 18, color: Colors.white70),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(label,
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            if (count > 1)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  preview,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12),
                ),
              ),
          ],
        ),
        duration: const Duration(seconds: 6),
        behavior: SnackBarBehavior.floating,
        action: missed.any((n) => n.chatId != null)
            ? SnackBarAction(
                label: 'Open',
                onPressed: () {
                  // Open the first notification with a chatId
                  final first = missed.firstWhere((n) => n.chatId != null);
                  _handleDeepLink(Uri.parse('sven://chat/${first.chatId}'));
                },
              )
            : null,
      ),
    );
  }

  Future<void> _initDeepLinks() async {
    final initial = await _appLinks.getInitialLink();
    if (initial != null) {
      _handleDeepLink(initial);
    }
    _appLinks.uriLinkStream.listen(_handleDeepLink);
  }

  /// Wires FCM notification tap → chat navigation.
  ///
  /// Covers three launch scenarios:
  ///   1. App terminated  — [getInitialMessage] returns the tapped notification.
  ///   2. App backgrounded — [onMessageOpenedApp] fires when user taps.
  ///   3. App foregrounded — handled by [PushNotificationManager] foreground
  ///      listener; nothing extra needed here.
  Future<void> _initFcmTapHandlers() async {
    final firebaseReady = await _waitForFirebaseReady();
    if (!firebaseReady) return;

    // Scenario 1: app was terminated, tapped notification caused cold launch.
    final initial = await FirebaseMessaging.instance.getInitialMessage();
    if (initial != null) {
      _handleNotificationTap(initial);
    }

    // Scenario 2: app was in background, user tapped notification.
    _fcmOpenedAppSub?.cancel();
    _fcmOpenedAppSub =
        FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);
  }

  Future<bool> _waitForFirebaseReady() async {
    const maxAttempts = 12;
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      if (Firebase.apps.isNotEmpty) return true;
      await Future<void>.delayed(const Duration(milliseconds: 250));
      if (!mounted) return false;
    }
    return Firebase.apps.isNotEmpty;
  }

  void _handleNotificationTap(RemoteMessage message) {
    final chatId = message.data['chat_id'] as String?;
    if (chatId == null || chatId.isEmpty) return;
    _handleDeepLink(Uri.parse('sven://chat/$chatId'));
  }

  /// Shows an in-app snackbar when a push notification arrives while the app
  /// is foregrounded (FCM does not show a system tray notification then).
  void _initForegroundNotifications() {
    _foregroundNotifSub = PushNotificationManager
        .instance.foregroundNotifications
        .listen((notif) {
      final messenger = ScaffoldMessenger.maybeOf(_navKey.currentContext!);
      if (messenger == null) return;

      messenger.showSnackBar(
        SnackBar(
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                notif.title,
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              if (notif.body.isNotEmpty) Text(notif.body),
            ],
          ),
          duration: const Duration(seconds: 6),
          behavior: SnackBarBehavior.floating,
          action: notif.chatId != null
              ? SnackBarAction(
                  label: 'Open',
                  onPressed: () => _handleDeepLink(
                    Uri.parse('sven://chat/${notif.chatId}'),
                  ),
                )
              : null,
        ),
      );
    });
  }

  /// Wires device battery state into [PerformanceMonitor] so the app
  /// auto-falls back to classic/motion-off when battery is low.
  Future<void> _initBatteryMonitor() async {
    // Read initial level once to set baseline.
    try {
      final level = await _battery.batteryLevel;
      final state = await _battery.batteryState;
      final isCharging =
          state == BatteryState.charging || state == BatteryState.full;
      _state.perfMonitor.updateBatteryState(level, isCharging);
    } catch (_) {
      // Battery API not available on all platforms (e.g. web).
    }

    // Subscribe to ongoing state changes.
    _batterySub = _battery.onBatteryStateChanged.listen(
      (state) async {
        try {
          final level = await _battery.batteryLevel;
          final isCharging =
              state == BatteryState.charging || state == BatteryState.full;
          _state.perfMonitor.updateBatteryState(level, isCharging);
        } catch (_) {}
      },
      onError: (_) {},
    );
  }

  Future<void> _bootstrap() async {
    await ApiBaseService.load();
    await _state.loadPrefs();
    await _syncWakeWordMonitor();

    // Fetch deployment config in background so startup isn't blocked on network.
    unawaited(_refreshDeploymentConfig());

    final token = await _auth.readToken();
    if (token == null || token.isEmpty) {
      // In personal mode, try transparent auto-login
      if (_state.deploymentMode == DeploymentMode.personal) {
        final ok = await _tryAutoLogin();
        if (ok) return;
      }
      _state.setToken(null);
      return;
    }

    // Restore session immediately for faster startup, then refresh in background.
    _state.setToken(token);
    _state.setAuthMessage(null);
    _consumePendingLink();

    final storedUserId = await _auth.readUserId();
    final storedUsername = await _auth.readUsername();
    unawaited(_completeAuthenticatedBootstrap(
      storedUserId: storedUserId,
      storedUsername: storedUsername,
    ));
  }

  Future<void> _refreshDeploymentConfig() async {
    try {
      final config = await _deploymentService.fetch();
      _state.deploymentMode = config.mode;
      _state.serverSetupComplete = config.setupComplete;
      if (!config.setupComplete) {
        _state.setToken(null);
      }
    } catch (_) {
      // If server is unreachable, keep defaults (multi_user + setup_complete)
    }
  }

  Future<void> _completeAuthenticatedBootstrap({
    String? storedUserId,
    String? storedUsername,
  }) async {
    try {
      if (storedUserId != null && storedUserId.isNotEmpty) {
        await _bindUserServices(storedUserId, username: storedUsername);
      }

      final refreshed = await _auth.refresh();
      _state.setToken(refreshed);

      final remotePrefs = await _prefsService.fetch();
      if (remotePrefs != null) {
        await _state.applyRemotePrefs(remotePrefs);
      }

      _consumePendingLink();
      await PushNotificationManager.instance.retryRegistration();
    } on AuthException catch (e) {
      await _auth.clearToken();
      if (_state.deploymentMode == DeploymentMode.personal) {
        final ok = await _tryAutoLogin();
        if (ok) return;
      }
      _state.setToken(null);
      _state.setAuthMessage(e.userMessage);
    }
  }

  /// Attempt transparent login using stored personal-mode credentials.
  /// Returns true if login succeeded.
  Future<bool> _tryAutoLogin() async {
    final creds = await _auth.readAutoLogin();
    if (creds == null) return false;
    try {
      await _login(creds.username, creds.password);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Authenticate via a social SSO provider.
  ///
  /// 1. [SsoService] performs the native / web OAuth flow and returns a
  ///    provider-issued ID token.
  /// 2. [AuthService.loginWithSso] exchanges it for a Sven session token.
  Future<void> _loginWithSso(String provider) async {
    try {
      final SsoCredential credential;
      switch (provider) {
        case 'google':
          credential = await _sso.signInWithGoogle();
        case 'apple':
          credential = await _sso.signInWithApple();
        case 'github':
          credential = await _sso.signInWithGitHub();
        default:
          throw SsoException('Unknown SSO provider: $provider');
      }
      final result = await _auth.loginWithSso(credential);
      if (result.mfaRequired) {
        _state.setMfaToken(result.mfaToken!);
        return;
      }
      await _bindUserServices(result.userId, username: result.username);
      _state.setToken(result.token);
      _state.setAuthMessage(null);
      _consumePendingLink();
      unawaited(FeatureFlagService.instance.load(
        apiBase: AuthService.apiBase,
        token: result.token,
      ));
      await PushNotificationManager.instance.retryRegistration();
    } on SsoException catch (e) {
      throw AuthException(AuthFailure.ssoFailed, detail: e.message);
    } on AuthException {
      rethrow;
    }
  }

  Future<void> _login(String username, String password) async {
    try {
      final result = await _auth.login(username: username, password: password);
      if (result.mfaRequired) {
        _state.setMfaToken(result.mfaToken!);
        return;
      }
      await _bindUserServices(result.userId, username: result.username);
      _state.setToken(result.token);
      _state.setAuthMessage(null);
      _consumePendingLink();

      // Load feature flags now that we have a valid token
      unawaited(FeatureFlagService.instance.load(
        apiBase: AuthService.apiBase,
        token: result.token,
      ));

      // Retry FCM token registration now that we're authenticated
      await PushNotificationManager.instance.retryRegistration();
    } on AuthException catch (e) {
      _state.setAuthMessage(e.userMessage);
      rethrow;
    }
  }

  // ── MFA ─────────────────────────────────────────────────────────────────

  /// Complete the second-factor challenge after a password or SSO login.
  ///
  /// Called by [MfaPage] when the user has entered their 6-digit TOTP code.
  Future<void> _verifyMfa(String code) async {
    final mfaToken = _state.mfaToken;
    if (mfaToken == null) return;
    try {
      final result = await _auth.verifyMfa(mfaToken: mfaToken, code: code);
      _state.setMfaToken(null);
      await _bindUserServices(result.userId, username: result.username);
      _state.setToken(result.token);
      _state.setAuthMessage(null);
      _consumePendingLink();
      unawaited(FeatureFlagService.instance.load(
        apiBase: AuthService.apiBase,
        token: result.token,
      ));
      await PushNotificationManager.instance.retryRegistration();
    } on AuthException catch (e) {
      _state.setAuthMessage(e.userMessage);
      rethrow;
    }
  }

  // ── User service binding ──────────────────────────────────────────────

  /// Bind all services to a specific user after login or bootstrap.
  Future<void> _bindUserServices(String userId, {String? username}) async {
    _scopedPrefs = ScopedPreferences(userId: userId);
    await _state.bindUser(userId, name: username);
    await _state.migrateGlobalPrefs();
    await _state.reloadPrefs();
    await _syncWakeWordMonitor();
    // Restore TTS voice selection from saved preferences
    if (_state.ttsVoice != null && _state.ttsVoice!.contains('|')) {
      final parts = _state.ttsVoice!.split('|');
      _voiceService.restoreVoice(parts[0], parts[1]);
    }
    await _memoryService.bindUser(_scopedPrefs!);
    await _promptTemplatesService.bindUser(_scopedPrefs!);
    await _promptHistoryService.bindUser(_scopedPrefs!);
    await sl<AbTestService>().bind(userId: userId);
    // Set static scope so locally-created PromptHistoryService instances
    // (e.g. in ChatThreadPage) also use scoped storage.
    PromptHistoryService.activeScope = _scopedPrefs;
  }

  /// Reset all services on logout / session expiry.
  void _resetUserServices() {
    sl<AbTestService>().resetForLogout();
    PromptHistoryService.activeScope = null;
    _promptHistoryService.resetForLogout();
    _promptTemplatesService.resetForLogout();
    _memoryService.resetForLogout();
    _state.resetForLogout();
    _scopedPrefs = null;
  }

  void _handleDeepLink(Uri uri) {
    final target = parseDeepLink(uri);
    if (target == null) return;
    final isLoggedIn = (_state.token ?? '').isNotEmpty;
    if (!isLoggedIn) {
      _pendingLink = target;
      _state.setAuthMessage('Sign in to open the linked content.');
      return;
    }
    _openDeepLink(target);
  }

  void _consumePendingLink() {
    final pending = _pendingLink;
    if (pending == null) return;
    _pendingLink = null;
    _openDeepLink(pending);
  }

  void _openDeepLink(DeepLinkTarget target) {
    if (target.kind == 'gateway_connect' && target.gatewayUrl != null) {
      unawaited(ApiBaseService.setOverride(target.gatewayUrl!));
      _state.setAuthMessage('Remote gateway selected. Sign in to continue.');
      _router.go(appRouteLogin);
      return;
    }
    if (target.kind == 'home') {
      _router.go(appRouteHome);
      return;
    }
    if (target.kind == 'widget_voice') {
      unawaited(_openWidgetVoiceCapture());
      return;
    }
    if (target.kind == 'approvals') {
      _router.push(appRouteHomeApprovals);
      return;
    }
    if (target.kind == 'chat' && target.chatId != null) {
      _router.push(appRouteHomeChat(target.chatId!));
    }
  }

  Future<void> _openWidgetVoiceCapture() async {
    _router.go(appRouteHome);
    await Future<void>.delayed(const Duration(milliseconds: 120));
    if (!mounted) return;

    final navigator = _navKey.currentState;
    if (navigator == null) return;

    final transcript = await VoiceOverlay.showFromNavigator(
      navigator,
      visualMode: _state.effectiveVisualMode,
      motionLevel: _state.effectiveMotionLevel,
      voiceService: _voiceService,
    );

    final draft = (transcript ?? '').trim();
    if (draft.isEmpty) return;

    final chatId = 'widget-${DateTime.now().millisecondsSinceEpoch}';
    final encodedDraft = Uri.encodeQueryComponent(draft);
    _router.push('${appRouteHomeChat(chatId)}?draft=$encodedDraft');
  }

  Future<void> _openWakeWordCapture(WakeWordMatch match) async {
    if (_wakeWordLaunchInFlight) return;
    _wakeWordLaunchInFlight = true;
    try {
      _router.go(appRouteHome);
      await Future<void>.delayed(const Duration(milliseconds: 120));
      if (!mounted) return;

      final navigator = _navKey.currentState;
      if (navigator == null) return;

      final transcript = await VoiceOverlay.showFromNavigator(
        navigator,
        visualMode: _state.effectiveVisualMode,
        motionLevel: _state.effectiveMotionLevel,
        voiceService: _voiceService,
        initialDraft: match.remainder,
      );

      final draft = (transcript ?? '').trim();
      if (draft.isEmpty) return;

      final chatId = 'wake-${DateTime.now().millisecondsSinceEpoch}';
      final encodedDraft = Uri.encodeQueryComponent(draft);
      _router.push('${appRouteHomeChat(chatId)}?draft=$encodedDraft');
    } finally {
      _wakeWordLaunchInFlight = false;
      await _syncWakeWordMonitor();
    }
  }

  Future<void> _syncWakeWordMonitor() async {
    if (!_state.loaded) return;
    final lifecycleState = WidgetsBinding.instance.lifecycleState;
    final shouldArm = _state.isLoggedIn &&
        _state.wakeWordEnabled &&
        lifecycleState != AppLifecycleState.paused &&
        lifecycleState != AppLifecycleState.detached &&
        !_wakeWordLaunchInFlight;

    if (!shouldArm) {
      await _voiceService.stopWakeWordMonitor();
      return;
    }

    await _voiceService.startWakeWordMonitor(
      wakePhrase: _state.wakeWordPhrase,
      onDetected: _openWakeWordCapture,
    );
  }

  // ── Router ──────────────────────────────────────────────────────────────────

  /// Builds the [GoRouter] for the entire app.
  ///
  /// Called once in [initState] after all services are wired up, so that the
  /// route builder closures can capture [_state], [_authClient], and friends.
  GoRouter _buildRouter() {
    return GoRouter(
      navigatorKey: _navKey,
      initialLocation: '/',
      refreshListenable: _state,
      redirect: (context, routerState) {
        final loc = routerState.matchedLocation;
        // Keep initial launch on lightweight splash until prefs/bootstrap
        // have established baseline state to avoid expensive early route churn.
        if (!_state.loaded) {
          return loc == '/' ? null : '/';
        }
        // ── First-time setup ──
        if (!_state.serverSetupComplete) {
          return loc == appRouteSetup ? null : appRouteSetup;
        }
        // ── Onboarding ──
        if (!_state.onboardingComplete) {
          return loc == appRouteOnboarding ? null : appRouteOnboarding;
        }
        // ── MFA step (pending second-factor) ──
        if (_state.mfaRequired) {
          return loc == appRouteMfa ? null : appRouteMfa;
        }
        // ── Auth gate ──
        if (!_state.isLoggedIn) {
          return loc == appRouteLogin ? null : appRouteLogin;
        }
        // ── Authenticated: send root / auth pages → home ──
        if (loc == '/' ||
            loc == appRouteSetup ||
            loc == appRouteLogin ||
            loc == appRouteOnboarding ||
            loc == appRouteMfa) {
          return appRouteHome;
        }
        return null;
      },
      routes: [
        // Loading splash — only ever shown transiently before redirect fires.
        GoRoute(
          path: '/',
          builder: (_, __) => const Scaffold(
            body: ColoredBox(
              color: Color(0xFF040712),
              child: Center(
                child: Text(
                  'Sven',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                    color: Color(0xFFE8EEFF),
                  ),
                ),
              ),
            ),
          ),
        ),

        // First-time deployment / admin account creation.
        GoRoute(
          path: appRouteSetup,
          builder: (_, __) => DeploymentSetupPage(
            deploymentService: _deploymentService,
            onSetupComplete: (mode, username, password) async {
              _state.deploymentMode = mode;
              _state.serverSetupComplete = true;
              if (mode == DeploymentMode.personal) {
                await _auth.saveAutoLogin(username, password);
              }
              await _login(username, password);
            },
          ),
        ),

        // First-run onboarding.
        GoRoute(
          path: appRouteOnboarding,
          builder: (_, __) => OnboardingPage(
            onComplete: () {
              final name = OnboardingPage.capturedName;
              if (name != null && name.isNotEmpty) {
                _memoryService.setUserName(name);
              }
              _state.completeOnboarding();
            },
            onSetVisualMode: (mode) => _state.setVisualMode(mode),
          ),
        ),

        // Login screen.
        GoRoute(
          path: appRouteLogin,
          builder: (_, __) => LoginPage(
            onSubmit: _login,
            onSsoSignIn: _loginWithSso,
            initialMessage: _state.authMessage,
          ),
        ),

        // MFA / 2FA verification screen.
        GoRoute(
          path: appRouteMfa,
          builder: (_, __) => MfaPage(
            onVerify: _verifyMfa,
            onCancel: () => _state.setMfaToken(null),
          ),
        ),

        // Authenticated shell + deep-link sub-routes.
        GoRoute(
          path: appRouteHome,
          builder: (_, __) => AppLockGate(
            lockService: _lockService,
            visualMode: _state.effectiveVisualMode,
            child: AppShell(
              onLogout: _logout,
              onLogoutAll: _logoutAll,
            ),
          ),
          routes: [
            // Deep-link: sven://approvals
            GoRoute(
              path: 'approvals',
              builder: (_, __) => ApprovalsPage(client: _authClient),
            ),

            // Deep-link: sven://chat/<id>
            GoRoute(
              path: 'chat/:id',
              builder: (ctx, routeState) {
                final chatId = routeState.pathParameters['id']!;
                final initialDraft = routeState.uri.queryParameters['draft'];
                final thread = ChatThreadSummary(
                  id: chatId,
                  title: 'Chat $chatId',
                  lastMessage: 'Opened from deep link.',
                  updatedAt: DateTime.now(),
                );
                final chatService = ChatService(
                  client: _authClient,
                  repo: sl<MessagesRepository>(),
                );
                final tokens = SvenTokens.forMode(_state.effectiveVisualMode);
                final cinematic =
                    _state.effectiveVisualMode == VisualMode.cinematic;
                VoidCallback? exportFn;
                return StatefulBuilder(builder: (ctx2, setS) {
                  return Scaffold(
                    backgroundColor: tokens.scaffold,
                    appBar: AppBar(
                      leading: IconButton(
                        icon: const Icon(Icons.arrow_back_rounded),
                        onPressed: () => _router.pop(),
                      ),
                      title: Row(
                        children: [
                          Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: LinearGradient(
                                colors: cinematic
                                    ? [tokens.primary, tokens.secondary]
                                    : [
                                        tokens.primary,
                                        tokens.primary.withValues(alpha: 0.7),
                                      ],
                              ),
                            ),
                            child: Center(
                              child: Text(
                                'S',
                                style: TextStyle(
                                  color: cinematic
                                      ? const Color(0xFF040712)
                                      : Colors.white,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              thread.title,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: tokens.onSurface,
                              ),
                            ),
                          ),
                        ],
                      ),
                      actions: [
                        IconButton(
                          tooltip: 'Export conversation',
                          icon: const Icon(Icons.ios_share_rounded),
                          onPressed: exportFn,
                        ),
                      ],
                    ),
                    body: ChatThreadPage(
                      thread: thread,
                      chatService: chatService,
                      initialDraft: initialDraft,
                      visualMode: _state.effectiveVisualMode,
                      motionLevel: _state.effectiveMotionLevel,
                      voiceService: _voiceService,
                      responseLength: _state.responseLength,
                      promptTemplatesService: _promptTemplatesService,
                      memoryService: _memoryService,
                      syncService: _syncService,
                      onRegisterExport: (fn) => setS(() => exportFn = fn),
                    ),
                  );
                });
              },
            ),
          ],
        ),
      ],
    );
  }

  Future<void> _logout() async {
    await _auth.logout();
    _resetUserServices();
  }

  Future<void> _logoutAll() async {
    await _auth.logoutAll();
    _resetUserServices();
  }

  void _handleActiveSessionExpired() {
    // In personal mode, attempt silent re-login instead of kicking to login screen
    if (_state.deploymentMode == DeploymentMode.personal) {
      _tryAutoLogin().then((ok) {
        if (!ok) _showSessionExpired();
      });
      return;
    }
    _showSessionExpired();
  }

  void _showSessionExpired() {
    _resetUserServices();
    _state.setAuthMessage(
      'Your session has expired. Please sign in again.',
    );
    final messenger = ScaffoldMessenger.maybeOf(_navKey.currentContext!);
    messenger?.showSnackBar(
      const SnackBar(
        content: Text('Session expired. Redirecting to sign in...'),
        duration: Duration(seconds: 3),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Inner ProviderScope feeds the lifecycle-owned service instances into the
    // Riverpod graph so any ConsumerWidget in the subtree can reach them via
    // ref.watch / ref.read without constructor drilling.
    return ProviderScope(
      overrides: [
        appStateProvider.overrideWith((ref) => _state),
        memoryServiceProvider.overrideWith((ref) => _memoryService),
        appLockServiceProvider.overrideWith((ref) => _lockService),
        projectServiceProvider.overrideWith((ref) => _projectService),
        tutorialServiceProvider.overrideWith((ref) => _tutorialService),
        voiceServiceProvider.overrideWithValue(_voiceService),
        authenticatedClientProvider.overrideWithValue(_authClient),
        promptTemplatesServiceProvider
            .overrideWithValue(_promptTemplatesService),
        deviceServiceProvider.overrideWithValue(_deviceService),
        featureTooltipServiceProvider.overrideWithValue(_tooltipService),
        syncServiceProvider.overrideWith((ref) => _syncService),
      ],
      // ListenableBuilder re-runs when _state notifies (theme, text scale, etc.).
      // Route-level changes (login / onboarding) are handled by GoRouter's
      // refreshListenable, so we don't need home-widget switching here.
      child: ListenableBuilder(
        listenable: _state,
        builder: (context, _) {
          return MaterialApp.router(
            routerConfig: _router,
            title: 'Sven',
            theme: buildSvenTheme(_state.visualMode,
                dynamicScheme: null,
                highContrast: _state.highContrast,
                colorBlindMode: _state.colorBlindMode,
                customAccent: _state.accentPreset != AccentPreset.sven
                    ? Color(_state.accentPreset.argbValue)
                    : null),
            builder: (context, child) {
              // Apply user-configured text scale on top of system scale.
              final scale = _state.textScale;
              final scaled = scale == 1.0
                  ? child!
                  : MediaQuery(
                      data: MediaQuery.of(context).copyWith(
                        textScaler: TextScaler.linear(scale),
                      ),
                      child: child!,
                    );
              // Propagate reduceTransparency so SvenGlass skips BackdropFilter.
              // SvenKeyboardNavScope enables always-visible focus rings on
              // web/desktop and registers global Escape + "/" shortcuts.
              return SvenKeyboardNavScope(
                child: SvenGlassScope(
                  reduceTransparency: _state.reduceTransparency,
                  child: scaled,
                ),
              );
            },
          );
        },
      ),
    );
  }
}
