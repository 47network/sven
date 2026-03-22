// ═══════════════════════════════════════════════════════════════════════════
// ScopedPreferences — user-scoped SharedPreferences wrapper
//
// Every key is prefixed with the current userId so that multiple users
// on the same device have fully isolated local storage.
//
//   Stored as:  "user.<userId>.<originalKey>"
//
// When no userId is set (pre-login), reads return defaults and writes
// are silently dropped — ensuring no cross-user leakage.
// ═══════════════════════════════════════════════════════════════════════════

import 'package:shared_preferences/shared_preferences.dart';

/// Provides user-scoped access to [SharedPreferences].
///
/// All keys are transparently prefixed with `user.<userId>.` so that
/// different users on the same device never collide.
class ScopedPreferences {
  ScopedPreferences({String? userId}) : _userId = userId;

  String? _userId;

  /// The currently active user ID. Null means "no user logged in".
  String? get userId => _userId;

  /// Call after login / bootstrap to bind to a specific user.
  void bind(String userId) => _userId = userId;

  /// Call on logout to unbind. Subsequent reads return defaults.
  void unbind() => _userId = null;

  /// Whether a user is currently bound.
  bool get isBound => _userId != null;

  // ── Internal key mapping ──────────────────────────────────────────────

  String? _scopedKey(String key) {
    final uid = _userId;
    if (uid == null || uid.isEmpty) return null;
    return 'user.$uid.$key';
  }

  // ── Read helpers ──────────────────────────────────────────────────────

  Future<String?> getString(String key) async {
    final sk = _scopedKey(key);
    if (sk == null) return null;
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(sk);
  }

  Future<bool?> getBool(String key) async {
    final sk = _scopedKey(key);
    if (sk == null) return null;
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(sk);
  }

  Future<int?> getInt(String key) async {
    final sk = _scopedKey(key);
    if (sk == null) return null;
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(sk);
  }

  Future<double?> getDouble(String key) async {
    final sk = _scopedKey(key);
    if (sk == null) return null;
    final prefs = await SharedPreferences.getInstance();
    return prefs.getDouble(sk);
  }

  Future<List<String>?> getStringList(String key) async {
    final sk = _scopedKey(key);
    if (sk == null) return null;
    final prefs = await SharedPreferences.getInstance();
    return prefs.getStringList(sk);
  }

  // ── Write helpers ─────────────────────────────────────────────────────

  Future<bool> setString(String key, String value) async {
    final sk = _scopedKey(key);
    if (sk == null) return false;
    final prefs = await SharedPreferences.getInstance();
    return prefs.setString(sk, value);
  }

  Future<bool> setBool(String key, bool value) async {
    final sk = _scopedKey(key);
    if (sk == null) return false;
    final prefs = await SharedPreferences.getInstance();
    return prefs.setBool(sk, value);
  }

  Future<bool> setInt(String key, int value) async {
    final sk = _scopedKey(key);
    if (sk == null) return false;
    final prefs = await SharedPreferences.getInstance();
    return prefs.setInt(sk, value);
  }

  Future<bool> setDouble(String key, double value) async {
    final sk = _scopedKey(key);
    if (sk == null) return false;
    final prefs = await SharedPreferences.getInstance();
    return prefs.setDouble(sk, value);
  }

  Future<bool> setStringList(String key, List<String> value) async {
    final sk = _scopedKey(key);
    if (sk == null) return false;
    final prefs = await SharedPreferences.getInstance();
    return prefs.setStringList(sk, value);
  }

  // ── Remove / clear ────────────────────────────────────────────────────

  Future<bool> remove(String key) async {
    final sk = _scopedKey(key);
    if (sk == null) return false;
    final prefs = await SharedPreferences.getInstance();
    return prefs.remove(sk);
  }

  /// Remove ALL keys belonging to the currently-bound user.
  /// Useful for full account data wipe.
  Future<void> clearCurrentUser() async {
    final uid = _userId;
    if (uid == null || uid.isEmpty) return;
    final prefix = 'user.$uid.';
    final prefs = await SharedPreferences.getInstance();
    final keys = prefs.getKeys().where((k) => k.startsWith(prefix)).toList();
    for (final k in keys) {
      await prefs.remove(k);
    }
  }

  // ── Migration helper ──────────────────────────────────────────────────

  /// Migrate unscoped (legacy) keys to the current user's scope.
  /// Only migrates if the scoped key does NOT already exist.
  /// Call once during the first login after the upgrade.
  Future<void> migrateUnscopedKeys(List<String> keys) async {
    final uid = _userId;
    if (uid == null || uid.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    for (final key in keys) {
      final scopedKey = 'user.$uid.$key';
      // Skip if scoped key already exists
      if (prefs.containsKey(scopedKey)) continue;
      // Check if unscoped key exists
      if (!prefs.containsKey(key)) continue;
      // Copy the value
      final val = prefs.get(key);
      if (val is String) {
        await prefs.setString(scopedKey, val);
      } else if (val is bool) {
        await prefs.setBool(scopedKey, val);
      } else if (val is int) {
        await prefs.setInt(scopedKey, val);
      } else if (val is double) {
        await prefs.setDouble(scopedKey, val);
      } else if (val is List<String>) {
        await prefs.setStringList(scopedKey, val);
      }
      // Remove the old unscoped key
      await prefs.remove(key);
    }
  }
}
