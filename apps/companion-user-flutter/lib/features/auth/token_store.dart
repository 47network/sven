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

  Future<String?> readAccessToken() async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_accessKey);
    }
    return _secureStorage.read(key: _accessKey);
  }

  Future<String?> readRefreshToken() async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_refreshKey);
    }
    return _secureStorage.read(key: _refreshKey);
  }

  Future<void> writeAccessToken(String token) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_accessKey, token);
      return;
    }
    await _secureStorage.write(key: _accessKey, value: token);
  }

  Future<void> writeRefreshToken(String token) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_refreshKey, token);
      return;
    }
    await _secureStorage.write(key: _refreshKey, value: token);
  }

  // ── User identity ──

  Future<String?> readUserId() async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_userIdKey);
    }
    return _secureStorage.read(key: _userIdKey);
  }

  Future<void> writeUserId(String userId) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_userIdKey, userId);
      return;
    }
    await _secureStorage.write(key: _userIdKey, value: userId);
  }

  Future<String?> readUsername() async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_usernameKey);
    }
    return _secureStorage.read(key: _usernameKey);
  }

  Future<void> writeUsername(String username) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_usernameKey, username);
      return;
    }
    await _secureStorage.write(key: _usernameKey, value: username);
  }

  // ── Personal-mode auto-login credentials ──

  Future<void> writeAutoLogin(String username, String password) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_autoLoginUserKey, username);
      await prefs.setString(_autoLoginPassKey, password);
      return;
    }
    await _secureStorage.write(key: _autoLoginUserKey, value: username);
    await _secureStorage.write(key: _autoLoginPassKey, value: password);
  }

  Future<({String username, String password})?> readAutoLogin() async {
    String? user;
    String? pass;
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      user = prefs.getString(_autoLoginUserKey);
      pass = prefs.getString(_autoLoginPassKey);
    } else {
      user = await _secureStorage.read(key: _autoLoginUserKey);
      pass = await _secureStorage.read(key: _autoLoginPassKey);
    }
    if (user != null && user.isNotEmpty && pass != null && pass.isNotEmpty) {
      return (username: user, password: pass);
    }
    return null;
  }

  Future<void> clearAutoLogin() async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_autoLoginUserKey);
      await prefs.remove(_autoLoginPassKey);
      return;
    }
    await _secureStorage.delete(key: _autoLoginUserKey);
    await _secureStorage.delete(key: _autoLoginPassKey);
  }

  Future<void> clear() async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_accessKey);
      await prefs.remove(_refreshKey);
      await prefs.remove(_userIdKey);
      await prefs.remove(_usernameKey);
      return;
    }
    await _secureStorage.delete(key: _accessKey);
    await _secureStorage.delete(key: _refreshKey);
    await _secureStorage.delete(key: _userIdKey);
    await _secureStorage.delete(key: _usernameKey);
  }
}
