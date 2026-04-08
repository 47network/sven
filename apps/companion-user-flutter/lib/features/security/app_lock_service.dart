import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

// ═══════════════════════════════════════════════════════════════════════════
// Auto-lock timeout options
// ═══════════════════════════════════════════════════════════════════════════

enum AutoLockTimeout {
  immediately,
  oneMinute,
  fiveMinutes,
  fifteenMinutes,
  never;

  String get label => switch (this) {
        AutoLockTimeout.immediately => 'Immediately',
        AutoLockTimeout.oneMinute => '1 minute',
        AutoLockTimeout.fiveMinutes => '5 minutes',
        AutoLockTimeout.fifteenMinutes => '15 minutes',
        AutoLockTimeout.never => 'Never',
      };

  Duration? get duration => switch (this) {
        AutoLockTimeout.immediately => Duration.zero,
        AutoLockTimeout.oneMinute => const Duration(minutes: 1),
        AutoLockTimeout.fiveMinutes => const Duration(minutes: 5),
        AutoLockTimeout.fifteenMinutes => const Duration(minutes: 15),
        AutoLockTimeout.never => null,
      };
}

// ═══════════════════════════════════════════════════════════════════════════
// AppLockService — manages biometric / PIN lock state
// ═══════════════════════════════════════════════════════════════════════════

class AppLockService extends ChangeNotifier {
  AppLockService() {
    _load();
  }

  static const _kEnabled = 'sven.lock.enabled';
  static const _kTimeout = 'sven.lock.timeout';

  final LocalAuthentication _localAuth = LocalAuthentication();

  bool _lockEnabled = false;
  AutoLockTimeout _timeout = AutoLockTimeout.fiveMinutes;
  bool _isLocked = false;
  DateTime? _backgroundedAt;
  bool _loaded = false;
  bool _disposed = false;

  // ── Getters ──
  bool get lockEnabled => _lockEnabled;
  AutoLockTimeout get timeout => _timeout;
  bool get isLocked => _isLocked;
  bool get loaded => _loaded;

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    super.dispose();
  }

  // ── Persistence ──

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    _lockEnabled = prefs.getBool(_kEnabled) ?? false;
    final savedTimeout = prefs.getString(_kTimeout);
    if (savedTimeout != null) {
      _timeout = AutoLockTimeout.values.firstWhere(
        (t) => t.name == savedTimeout,
        orElse: () => AutoLockTimeout.fiveMinutes,
      );
    }
    _loaded = true;
    notifyListeners();
  }

  Future<void> setLockEnabled(bool enabled) async {
    _lockEnabled = enabled;
    if (!enabled) _isLocked = false;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kEnabled, enabled);
  }

  Future<void> setTimeout(AutoLockTimeout timeout) async {
    _timeout = timeout;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kTimeout, timeout.name);
  }

  // ── Biometric capability ──

  /// Whether the device supports biometric or device-credential authentication.
  Future<bool> get isAvailable async {
    if (kIsWeb) return false;
    try {
      return await _localAuth.canCheckBiometrics ||
          await _localAuth.isDeviceSupported();
    } catch (_) {
      return false;
    }
  }

  /// List of enrolled biometric types on the device.
  Future<List<BiometricType>> get availableBiometrics async {
    try {
      return await _localAuth.getAvailableBiometrics();
    } catch (_) {
      return [];
    }
  }

  // ── Lock lifecycle ──

  /// Called when the app moves to background — record timestamp.
  void onBackground() {
    if (!_lockEnabled) return;
    _backgroundedAt = DateTime.now();
  }

  /// Called when the app resumes — check whether lock should engage.
  void onForeground() {
    if (!_lockEnabled || _isLocked) return;
    final bg = _backgroundedAt;
    if (bg == null) return;

    final lockDuration = _timeout.duration;
    if (lockDuration == null) return; // AutoLockTimeout.never

    final elapsed = DateTime.now().difference(bg);
    if (elapsed >= lockDuration) {
      _isLocked = true;
      notifyListeners();
    }
    _backgroundedAt = null;
  }

  /// Manually lock the app immediately.
  void lockNow() {
    if (!_lockEnabled) return;
    _isLocked = true;
    notifyListeners();
  }

  /// Unlock via biometric / device credential prompt. Returns true on success.
  Future<bool> authenticate(String localizedReason) async {
    if (!_lockEnabled || !_isLocked) return true;
    try {
      final authenticated = await _localAuth.authenticate(
        localizedReason: localizedReason,
        options: const AuthenticationOptions(
          biometricOnly: false, // allow PIN/pattern/password as fallback
          stickyAuth: true,
        ),
      );
      if (authenticated) {
        _isLocked = false;
        notifyListeners();
      }
      return authenticated;
    } catch (e) {
      debugPrint('⚠️  AppLockService: auth error: $e');
      return false;
    }
  }
}
