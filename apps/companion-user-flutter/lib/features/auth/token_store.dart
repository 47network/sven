import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Represents a linked account stored on-device for quick switching.
class LinkedAccount {
  const LinkedAccount({
    required this.userId,
    required this.username,
    this.displayName,
    this.avatarUrl,
    this.hasPin = false,
    this.isActive = false,
  });

  final String userId;
  final String username;
  final String? displayName;
  final String? avatarUrl;
  final bool hasPin;
  final bool isActive;

  Map<String, dynamic> toJson() => {
        'userId': userId,
        'username': username,
        'displayName': displayName,
        'avatarUrl': avatarUrl,
        'hasPin': hasPin,
        'isActive': isActive,
      };

  factory LinkedAccount.fromJson(Map<String, dynamic> json) => LinkedAccount(
        userId: json['userId'] as String,
        username: json['username'] as String,
        displayName: json['displayName'] as String?,
        avatarUrl: json['avatarUrl'] as String?,
        hasPin: json['hasPin'] as bool? ?? false,
        isActive: json['isActive'] as bool? ?? false,
      );
}

class TokenStore {
  TokenStore({FlutterSecureStorage? secureStorage})
      : _secureStorage = secureStorage ?? const FlutterSecureStorage();

  static const _accessKey = 'sven.auth.access_token';
  static const _refreshKey = 'sven.auth.refresh_token';
  static const _userIdKey = 'sven.auth.user_id';
  static const _usernameKey = 'sven.auth.username';
  static const _autoLoginUserKey = 'sven.auth.auto_login_user';
  static const _autoLoginPassKey = 'sven.auth.auto_login_pass';
  static const _deviceIdKey = 'sven.device.id';
  static const _linkedAccountsKey = 'sven.accounts.linked';
  static const _activeAccountKey = 'sven.accounts.active';

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

  // ── Device ID (stable per-device identifier) ──

  /// Returns a stable device ID, generating one if needed.
  Future<String> readOrCreateDeviceId() async {
    final prefs = await _prefs();
    String? deviceId;
    if (!kIsWeb) {
      deviceId = await _secureStorage.read(key: _deviceIdKey);
    }
    deviceId ??= prefs.getString(_deviceIdKey);
    if (deviceId != null && deviceId.isNotEmpty) return deviceId;

    // Generate a stable device ID from random bytes
    final bytes = List<int>.generate(16, (i) => DateTime.now().microsecond ^ (i * 31 + 17));
    deviceId = sha256.convert(bytes).toString().substring(0, 32);
    await prefs.setString(_deviceIdKey, deviceId);
    if (!kIsWeb) {
      await _secureStorage.write(key: _deviceIdKey, value: deviceId);
    }
    _debug('generated device id');
    return deviceId;
  }

  // ── Multi-account management ──

  /// Save tokens for a specific account (namespaced by userId).
  Future<void> saveAccountTokens({
    required String userId,
    required String accessToken,
    String? refreshToken,
    String? username,
  }) async {
    final prefs = await _prefs();
    final prefix = 'sven.account.$userId';
    await prefs.setString('$prefix.access_token', accessToken);
    if (refreshToken != null) {
      await prefs.setString('$prefix.refresh_token', refreshToken);
    }
    if (username != null) {
      await prefs.setString('$prefix.username', username);
    }
    if (!kIsWeb) {
      await _secureStorage.write(key: '$prefix.access_token', value: accessToken);
      if (refreshToken != null) {
        await _secureStorage.write(key: '$prefix.refresh_token', value: refreshToken);
      }
      if (username != null) {
        await _secureStorage.write(key: '$prefix.username', value: username);
      }
    }
    _debug('saveAccountTokens userId=$userId');
  }

  /// Read saved tokens for a specific account.
  Future<({String? accessToken, String? refreshToken, String? username})>
      readAccountTokens(String userId) async {
    final prefs = await _prefs();
    final prefix = 'sven.account.$userId';
    String? access, refresh, username;
    if (!kIsWeb) {
      access = await _secureStorage.read(key: '$prefix.access_token');
      refresh = await _secureStorage.read(key: '$prefix.refresh_token');
      username = await _secureStorage.read(key: '$prefix.username');
    }
    access = (access != null && access.isNotEmpty)
        ? access
        : prefs.getString('$prefix.access_token');
    refresh = (refresh != null && refresh.isNotEmpty)
        ? refresh
        : prefs.getString('$prefix.refresh_token');
    username = (username != null && username.isNotEmpty)
        ? username
        : prefs.getString('$prefix.username');
    return (accessToken: access, refreshToken: refresh, username: username);
  }

  /// Clear stored tokens for a specific account.
  Future<void> clearAccountTokens(String userId) async {
    final prefs = await _prefs();
    final prefix = 'sven.account.$userId';
    await prefs.remove('$prefix.access_token');
    await prefs.remove('$prefix.refresh_token');
    await prefs.remove('$prefix.username');
    if (!kIsWeb) {
      await _secureStorage.delete(key: '$prefix.access_token');
      await _secureStorage.delete(key: '$prefix.refresh_token');
      await _secureStorage.delete(key: '$prefix.username');
    }
  }

  /// Get list of linked accounts stored locally.
  Future<List<LinkedAccount>> readLinkedAccounts() async {
    final prefs = await _prefs();
    final raw = prefs.getString(_linkedAccountsKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list
          .map((e) => LinkedAccount.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// Save linked accounts list locally.
  Future<void> writeLinkedAccounts(List<LinkedAccount> accounts) async {
    final prefs = await _prefs();
    await prefs.setString(
      _linkedAccountsKey,
      jsonEncode(accounts.map((a) => a.toJson()).toList()),
    );
  }

  /// Read the active account user ID.
  Future<String?> readActiveAccountId() async {
    final prefs = await _prefs();
    return prefs.getString(_activeAccountKey);
  }

  /// Write the active account user ID.
  Future<void> writeActiveAccountId(String userId) async {
    final prefs = await _prefs();
    await prefs.setString(_activeAccountKey, userId);
  }

  /// Store a PIN hash for a specific account.
  Future<void> writeAccountPin(String userId, String pinHash) async {
    final prefs = await _prefs();
    final key = 'sven.account.$userId.pin_hash';
    await prefs.setString(key, pinHash);
    if (!kIsWeb) {
      await _secureStorage.write(key: key, value: pinHash);
    }
  }

  /// Read the PIN hash for a specific account.
  Future<String?> readAccountPin(String userId) async {
    final prefs = await _prefs();
    final key = 'sven.account.$userId.pin_hash';
    if (!kIsWeb) {
      final secure = await _secureStorage.read(key: key);
      if (secure != null && secure.isNotEmpty) return secure;
    }
    return prefs.getString(key);
  }

  /// Verify a PIN against the stored hash.
  bool verifyPin(String pin, String userId, String storedHash) {
    final computed = sha256.convert(utf8.encode(pin + userId)).toString();
    return computed == storedHash;
  }
}
