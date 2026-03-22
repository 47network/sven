import 'package:firebase_analytics/firebase_analytics.dart';

/// Thin wrapper around [FirebaseAnalytics] that provides typed event methods
/// and silently no-ops when analytics are unavailable (e.g., in tests or when
/// the user has not consented).
///
/// All methods are `async` but callers need not `await` them — failures are
/// caught internally and never propagate to the UI.
class SvenAnalytics {
  SvenAnalytics._();

  static final SvenAnalytics instance = SvenAnalytics._();

  final FirebaseAnalytics _fa = FirebaseAnalytics.instance;

  bool _enabled = true;

  /// Disable analytics (e.g., when the user opts out).
  void setEnabled(bool enabled) {
    _enabled = enabled;
    _fa.setAnalyticsCollectionEnabled(enabled);
  }

  // ── Session ─────────────────────────────────────────────────────────────

  Future<void> logSessionStart() => _log('session_start');

  // ── Auth ────────────────────────────────────────────────────────────────

  Future<void> logLogin({String method = 'email'}) =>
      _log('login', params: {'method': method});

  Future<void> logSignUp({String method = 'email'}) =>
      _fa.logSignUp(signUpMethod: method).catchError((_) {});

  Future<void> logLogout() => _log('logout');

  // ── Chat ─────────────────────────────────────────────────────────────────

  /// Fired the first time a user sends a message in a session.
  Future<void> logFirstMessage() => _log('first_message');

  /// Fired every time a message is sent.
  Future<void> logMessageSent({
    required String mode,
    bool incognito = false,
  }) =>
      _log('message_sent', params: {
        'conversation_mode': mode,
        'incognito': incognito ? '1' : '0',
      });

  /// Fired when an AI response finishes streaming.
  Future<void> logResponseReceived({required int latencyMs}) =>
      _log('response_received', params: {'latency_ms': latencyMs.toString()});

  /// Fired when the user taps thumbs up/down.
  Future<void> logMessageFeedback({required String sentiment}) =>
      _log('message_feedback', params: {'sentiment': sentiment});

  // ── Features ─────────────────────────────────────────────────────────────

  Future<void> logVoiceUsed() => _log('voice_used');
  Future<void> logImageAttached() => _log('image_attached');
  Future<void> logFileAttached() => _log('file_attached');
  Future<void> logIncognitoOpened() => _log('incognito_opened');
  Future<void> logModeChanged({required String mode}) =>
      _log('mode_changed', params: {'mode': mode});
  Future<void> logSlashCommand({required String command}) =>
      _log('slash_command', params: {'command': command});

  // ── Helpers ──────────────────────────────────────────────────────────────

  Future<void> setUserId(String? uid) async {
    if (!_enabled) return;
    try {
      await _fa.setUserId(id: uid);
    } catch (_) {}
  }

  Future<void> _log(
    String name, {
    Map<String, Object>? params,
  }) async {
    if (!_enabled) return;
    try {
      await _fa.logEvent(name: name, parameters: params);
    } catch (_) {
      // Analytics failures must never affect UX
    }
  }
}
