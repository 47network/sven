import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class TokenStore {
  TokenStore({FlutterSecureStorage? secureStorage})
      : _secureStorage = secureStorage ?? const FlutterSecureStorage();

  static const _accessKey = 'sven.auth.access_token';
  static const _refreshKey = 'sven.auth.refresh_token';
  static const _userIdKey = 'sven.auth.user_id';
  static const _usernameKey = 'sven.auth.username';
  static const _autoLoginUserKey = 'sven.auth.auto_login_user';
  static const _autoLoginPassKey = 'sven.auth.auto_login_pass';

  final FlutterSecureStorage _secureStorage;

  void _debug(String message) {
    if (!kDebugMode) return;
    debugPrint('[TokenStore] $message');
  }

  Future<SharedPreferences> _prefs() => SharedPreferences.getInstance();

  Future<String?> readAccessToken() async {
    final prefs = await _prefs();
    if (kIsWeb) {
      final value = prefs.getString(_accessKey);
      _debug('readAccessToken web prefs=${value == null ? 0 : value.length}');
      return value;
    }
    final secure = await _secureStorage.read(key: _accessKey);
    if (secure != null && secure.isNotEmpty) {
      _debug('readAccessToken secure=${secure.length}');
      return secure;
    }
    final fallback = prefs.getString(_accessKey);
    _debug('readAccessToken prefs=${fallback == null ? 0 : fallback.length}');
    return fallback;
  }

  Future<String?> readRefreshToken() async {
    final prefs = await _prefs();
    if (kIsWeb) {
      final value = prefs.getString(_refreshKey);
      _debug('readRefreshToken web prefs=${value == null ? 0 : value.length}');
      return value;
    }
    final secure = await _secureStorage.read(key: _refreshKey);
    if (secure != null && secure.isNotEmpty) {
      _debug('readRefreshToken secure=${secure.length}');
      return secure;
    }
    final fallback = prefs.getString(_refreshKey);
    _debug('readRefreshToken prefs=${fallback == null ? 0 : fallback.length}');
    return fallback;
  }

  Future<void> writeAccessToken(String token) async {
    final prefs = await _prefs();
    await prefs.setString(_accessKey, token);
    _debug('writeAccessToken len=${token.length}');
    if (kIsWeb) {
      return;
    }
    await _secureStorage.write(key: _accessKey, value: token);
  }

  Future<void> writeRefreshToken(String token) async {
    final prefs = await _prefs();
    await prefs.setString(_refreshKey, token);
    _debug('writeRefreshToken len=${token.length}');
    if (kIsWeb) {
      return;
    }
    await _secureStorage.write(key: _refreshKey, value: token);
  }

  // ── User identity ──

  Future<String?> readUserId() async {
    final prefs = await _prefs();
    if (kIsWeb) {
      return prefs.getString(_userIdKey);
    }
    final secure = await _secureStorage.read(key: _userIdKey);
    if (secure != null && secure.isNotEmpty) return secure;
    return prefs.getString(_userIdKey);
  }

  Future<void> writeUserId(String userId) async {
    final prefs = await _prefs();
    await prefs.setString(_userIdKey, userId);
    _debug('writeUserId present=${userId.isNotEmpty}');
    if (kIsWeb) {
      return;
    }
    await _secureStorage.write(key: _userIdKey, value: userId);
  }

  Future<String?> readUsername() async {
    final prefs = await _prefs();
    if (kIsWeb) {
      return prefs.getString(_usernameKey);
    }
    final secure = await _secureStorage.read(key: _usernameKey);
    if (secure != null && secure.isNotEmpty) return secure;
    return prefs.getString(_usernameKey);
  }

  Future<void> writeUsername(String username) async {
    final prefs = await _prefs();
    await prefs.setString(_usernameKey, username);
    _debug('writeUsername present=${username.isNotEmpty}');
    if (kIsWeb) {
      return;
    }
    await _secureStorage.write(key: _usernameKey, value: username);
  }

  // ── Personal-mode auto-login credentials ──

  Future<void> writeAutoLogin(String username, String password) async {
    final prefs = await _prefs();
    await prefs.setString(_autoLoginUserKey, username);
    await prefs.setString(_autoLoginPassKey, password);
    if (kIsWeb) {
      return;
    }
    await _secureStorage.write(key: _autoLoginUserKey, value: username);
    await _secureStorage.write(key: _autoLoginPassKey, value: password);
  }

  Future<({String username, String password})?> readAutoLogin() async {
    String? user;
    String? pass;
    final prefs = await _prefs();
    if (kIsWeb) {
      user = prefs.getString(_autoLoginUserKey);
      pass = prefs.getString(_autoLoginPassKey);
    } else {
      user = await _secureStorage.read(key: _autoLoginUserKey);
      pass = await _secureStorage.read(key: _autoLoginPassKey);
      user = (user != null && user.isNotEmpty)
          ? user
          : prefs.getString(_autoLoginUserKey);
      pass = (pass != null && pass.isNotEmpty)
          ? pass
          : prefs.getString(_autoLoginPassKey);
    }
    if (user != null && user.isNotEmpty && pass != null && pass.isNotEmpty) {
      return (username: user, password: pass);
    }
    return null;
  }

  Future<void> clearAutoLogin() async {
    final prefs = await _prefs();
    await prefs.remove(_autoLoginUserKey);
    await prefs.remove(_autoLoginPassKey);
    if (kIsWeb) {
      return;
    }
    await _secureStorage.delete(key: _autoLoginUserKey);
    await _secureStorage.delete(key: _autoLoginPassKey);
  }

  Future<void> clear() async {
    _debug('clear auth state');
    final prefs = await _prefs();
    await prefs.remove(_accessKey);
    await prefs.remove(_refreshKey);
    await prefs.remove(_userIdKey);
    await prefs.remove(_usernameKey);
    if (kIsWeb) {
      return;
    }
    await _secureStorage.delete(key: _accessKey);
    await _secureStorage.delete(key: _refreshKey);
    await _secureStorage.delete(key: _userIdKey);
    await _secureStorage.delete(key: _usernameKey);
  }
}
