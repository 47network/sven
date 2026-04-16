// Integration smoke tests — no server or Firebase required.
//
// These tests verify the critical user flows end-to-end within the app
// process using a mock HTTP client.  They live in the "integration smoke"
// category:  bigger than unit tests, smaller than device/e2e tests.
//
// Flows covered:
//   1. Login success  → token stored, LoginResult populated.
//   2. Login failure  → AuthException thrown with correct failure type.
//   3. Login → MemoryService wired → system prompt carries user identity.
//   4. Token refresh  → new access token written from refresh endpoint.
//   5. Logout         → token cleared, MemoryService reset.
//   6. Auto-login     → saveAutoLogin / readAutoLogin / clearAutoLogin round-trips.
//
// Run with: flutter test test/integration_smoke_test.dart

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:sven_user_flutter/features/auth/auth_errors.dart';
import 'package:sven_user_flutter/features/auth/auth_service.dart';
import 'package:sven_user_flutter/features/auth/sso_service.dart';
import 'package:sven_user_flutter/features/auth/token_store.dart';
import 'package:sven_user_flutter/features/memory/memory_service.dart';

// ─────────────────────────────────────────────────────────────────────────────
// In-memory TokenStore — avoids flutter_secure_storage platform channel in tests
// ─────────────────────────────────────────────────────────────────────────────

/// A [TokenStore] subclass that stores all credentials in a plain [Map].
/// All methods are overridden so the real [FlutterSecureStorage] method channel
/// is never invoked.  Safe to use in pure-Dart/flutter_test VM environments.
class _InMemoryTokenStore extends TokenStore {
  _InMemoryTokenStore() : super();

  final _store = <String, String?>{};

  static const _accessKey = 'sven.auth.access_token';
  static const _refreshKey = 'sven.auth.refresh_token';
  static const _userIdKey = 'sven.auth.user_id';
  static const _usernameKey = 'sven.auth.username';
  static const _autoLoginUserKey = 'sven.auth.auto_login_user';
  static const _autoLoginPassKey = 'sven.auth.auto_login_pass';

  @override
  Future<String?> readAccessToken() async => _store[_accessKey];
  @override
  Future<String?> readRefreshToken() async => _store[_refreshKey];
  @override
  Future<void> writeAccessToken(String token) async =>
      _store[_accessKey] = token;
  @override
  Future<void> writeRefreshToken(String token) async =>
      _store[_refreshKey] = token;

  @override
  Future<String?> readUserId() async => _store[_userIdKey];
  @override
  Future<void> writeUserId(String userId) async => _store[_userIdKey] = userId;

  @override
  Future<String?> readUsername() async => _store[_usernameKey];
  @override
  Future<void> writeUsername(String username) async =>
      _store[_usernameKey] = username;

  @override
  Future<void> writeAutoLogin(String username, String password) async {
    _store[_autoLoginUserKey] = username;
    _store[_autoLoginPassKey] = password;
  }

  @override
  Future<({String username, String password})?> readAutoLogin() async {
    final user = _store[_autoLoginUserKey];
    final pass = _store[_autoLoginPassKey];
    if (user != null && user.isNotEmpty && pass != null && pass.isNotEmpty) {
      return (username: user, password: pass);
    }
    return null;
  }

  @override
  Future<void> clearAutoLogin() async {
    _store.remove(_autoLoginUserKey);
    _store.remove(_autoLoginPassKey);
  }

  @override
  Future<void> clear() async {
    _store.remove(_accessKey);
    _store.remove(_refreshKey);
    _store.remove(_userIdKey);
    _store.remove(_usernameKey);
  }

  @override
  Future<String?> readActiveAccountId() async => _store['active_account_id'];

  @override
  Future<void> writeActiveAccountId(String userId) async =>
      _store['active_account_id'] = userId;

  @override
  Future<void> saveAccountTokens({
    required String userId,
    required String accessToken,
    String? refreshToken,
    String? username,
  }) async {
    final prefix = 'sven.account.$userId';
    _store['$prefix.access_token'] = accessToken;
    if (refreshToken != null) _store['$prefix.refresh_token'] = refreshToken;
    if (username != null) _store['$prefix.username'] = username;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Builds an [AuthService] with an in-memory [TokenStore] and the given mock
/// HTTP [client].  Fresh store instance per call — tests are isolated.
AuthService _auth(http.Client client) =>
    AuthService(client: client, store: _InMemoryTokenStore());

/// Builds a mock HTTP client that always responds with [body] and [status].
MockClient _client(
  String body, {
  int status = 200,
  String contentType = 'application/json',
}) {
  return MockClient(
    (_) async => http.Response(body, status, headers: {
      'content-type': contentType,
    }),
  );
}

/// Builds a mock client that dispatches based on path.
MockClient _dispatchClient(Map<String, ({int status, String body})> routes) {
  return MockClient((request) async {
    for (final entry in routes.entries) {
      if (request.url.path.contains(entry.key)) {
        return http.Response(
          entry.value.body,
          entry.value.status,
          headers: {'content-type': 'application/json'},
        );
      }
    }
    return http.Response('{"error":"not_found"}', 404,
        headers: {'content-type': 'application/json'});
  });
}

const _validLoginResponse = '''
{
  "data": {
    "accessToken": "test-access-token-abc123",
    "refreshToken": "test-refresh-token-xyz789",
    "user_id": "user-001",
    "username": "alice"
  }
}
''';

const _validRefreshResponse = '''
{
  "data": {
    "accessToken": "refreshed-access-token-new456",
    "refreshToken": "refreshed-refresh-token-new789"
  }
}
''';

const _validSsoResponse = '''
{
  "data": {
    "access_token": "sso-access-token-1",
    "refresh_token": "sso-refresh-token-1",
    "user_id": "sso-user-1",
    "username": "sso_alice"
  }
}
''';

const _validTotpVerifyResponse = '''
{
  "data": {
    "access_token": "mfa-access-token-1",
    "refresh_token": "mfa-refresh-token-1",
    "user_id": "mfa-user-1",
    "username": "mfa_alice"
  }
}
''';

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

void main() {
  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
  });

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  // ─── 1. Login success ─────────────────────────────────────────────────────
  group('Login — success flow', () {
    test('login returns a populated LoginResult', () async {
      final auth = _auth(_client(_validLoginResponse));
      final result = await auth.login(
        username: 'alice',
        password: 's3cr3t!',
      );
      expect(result.token, 'test-access-token-abc123');
      expect(result.userId, 'user-001');
      expect(result.username, 'alice');
    });

    test('login writes access token to store', () async {
      final auth = _auth(_client(_validLoginResponse));
      await auth.login(username: 'alice', password: 's3cr3t!');
      final stored = await auth.readToken();
      expect(stored, 'test-access-token-abc123');
    });

    test('login writes refresh token to store', () async {
      final auth = _auth(_client(_validLoginResponse));
      await auth.login(username: 'alice', password: 's3cr3t!');
      final stored = await auth.readRefreshToken();
      expect(stored, 'test-refresh-token-xyz789');
    });

    test('login writes user id to store', () async {
      final auth = _auth(_client(_validLoginResponse));
      await auth.login(username: 'alice', password: 's3cr3t!');
      final uid = await auth.readUserId();
      expect(uid, 'user-001');
    });
  });

  // ─── 2. Login failure ─────────────────────────────────────────────────────
  group('Login — failure handling', () {
    test('401 from server throws AuthException(invalidCredentials)', () async {
      final auth = _auth(_client('{"error":"unauthorized"}', status: 401));
      expect(
        () => auth.login(username: 'alice', password: 'wrong'),
        throwsA(isA<AuthException>().having(
          (e) => e.failure,
          'failure',
          AuthFailure.invalidCredentials,
        )),
      );
    });

    test('403 from server throws AuthException(accountLocked)', () async {
      final auth = _auth(_client('{"error":"forbidden"}', status: 403));
      expect(
        () => auth.login(username: 'alice', password: 'p'),
        throwsA(isA<AuthException>().having(
          (e) => e.failure,
          'failure',
          AuthFailure.accountLocked,
        )),
      );
    });

    test('server returns malformed JSON → throws', () async {
      final auth = _auth(_client('not json at all', status: 200));
      expect(
        () => auth.login(username: 'alice', password: 'p'),
        throwsA(isA<Exception>()),
      );
    });

    test('server returns 200 but missing token → throws AuthException(server)',
        () async {
      final auth = _auth(_client(
        jsonEncode({
          'data': {'user_id': 'u1', 'username': 'alice'}
        }),
      ));
      expect(
        () => auth.login(username: 'alice', password: 'p'),
        throwsA(isA<AuthException>().having(
          (e) => e.failure,
          'failure',
          AuthFailure.server,
        )),
      );
    });
  });

  // ─── 3. Login → MemoryService integration ─────────────────────────────────
  group('Login → MemoryService integration', () {
    test('after login, enabling memory and adding a fact shows fact in prompt',
        () async {
      final auth = _auth(_client(_validLoginResponse));
      await auth.login(username: 'alice', password: 's3cr3t!');

      final mem = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await mem.setMemoryEnabled(true);
      await mem.addFact('Prefers concise answers');

      final prompt = mem.buildSystemPrompt();
      expect(prompt, contains('Prefers concise answers'));
    });

    test('logout clears token and resets memory service', () async {
      final auth = _auth(_client(_validLoginResponse));
      await auth.login(username: 'alice', password: 's3cr3t!');

      final mem = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await mem.setMemoryEnabled(true);
      await mem.setPreferredLanguage('French');

      await auth.clearToken();
      mem.resetForLogout();

      expect(await auth.readToken(), isNull);
      expect(mem.preferredLanguage, 'auto');
    });
  });

  // ─── 4. Token refresh ─────────────────────────────────────────────────────
  group('Token refresh', () {
    test('refreshToken() updates stored access token', () async {
      final client = _dispatchClient({
        '/auth/login': (status: 200, body: _validLoginResponse),
        '/auth/refresh': (status: 200, body: _validRefreshResponse),
      });
      final auth = _auth(client);
      await auth.login(username: 'alice', password: 's3cr3t!');

      await auth.refresh();

      final newToken = await auth.readToken();
      expect(newToken, 'refreshed-access-token-new456');
    });
  });

  // ─── 5. SSO + MFA contract flows ──────────────────────────────────────────
  group('SSO and MFA', () {
    test('loginWithSso posts to /v1/auth/sso and stores returned tokens',
        () async {
      bool sawSsoPath = false;
      final client = MockClient((request) async {
        if (request.url.path.contains('/v1/auth/sso')) {
          sawSsoPath = true;
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          expect(body['provider'], 'google');
          expect(body['id_token'], 'id-token-abc');
          expect(body['access_token'], 'access-token-xyz');
          expect(body['nonce'], 'nonce-123');
          return http.Response(
            _validSsoResponse,
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('{"error":"not_found"}', 404,
            headers: {'content-type': 'application/json'});
      });

      final auth = _auth(client);
      final result = await auth.loginWithSso(
        const SsoCredential(
          provider: 'google',
          idToken: 'id-token-abc',
          accessToken: 'access-token-xyz',
          nonce: 'nonce-123',
        ),
      );

      expect(sawSsoPath, isTrue);
      expect(result.token, 'sso-access-token-1');
      expect(result.userId, 'sso-user-1');
      expect(result.username, 'sso_alice');
      expect(await auth.readToken(), 'sso-access-token-1');
      expect(await auth.readRefreshToken(), 'sso-refresh-token-1');
    });

    test('verifyMfa falls back to /mfa/verify when /totp/verify returns 404',
        () async {
      bool hitTotp = false;
      bool hitFallback = false;
      final client = MockClient((request) async {
        if (request.url.path.contains('/v1/auth/totp/verify')) {
          hitTotp = true;
          return http.Response('{"error":"not_found"}', 404,
              headers: {'content-type': 'application/json'});
        }
        if (request.url.path.contains('/v1/auth/mfa/verify')) {
          hitFallback = true;
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          expect(body['mfa_token'], 'mfa-pre-session-1');
          expect(body['code'], '123456');
          return http.Response(
            _validTotpVerifyResponse,
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('{"error":"not_found"}', 404,
            headers: {'content-type': 'application/json'});
      });

      final auth = _auth(client);
      final result =
          await auth.verifyMfa(mfaToken: 'mfa-pre-session-1', code: '123456');

      expect(hitTotp, isTrue);
      expect(hitFallback, isTrue);
      expect(result.token, 'mfa-access-token-1');
      expect(result.userId, 'mfa-user-1');
      expect(await auth.readToken(), 'mfa-access-token-1');
      expect(await auth.readRefreshToken(), 'mfa-refresh-token-1');
    });
  });

  // ─── 6. Auto-login persistence ────────────────────────────────────────────
  group('Auto-login persistence', () {
    test('saveAutoLogin / readAutoLogin round-trips credentials', () async {
      final auth = _auth(_client(_validLoginResponse));
      await auth.saveAutoLogin('alice', 's3cr3t!');
      final creds = await auth.readAutoLogin();
      expect(creds?.username, 'alice');
      expect(creds?.password, 's3cr3t!');
    });

    test('clearAutoLogin removes stored credentials', () async {
      final auth = _auth(_client(_validLoginResponse));
      await auth.saveAutoLogin('alice', 's3cr3t!');
      await auth.clearAutoLogin();
      expect(await auth.readAutoLogin(), isNull);
    });
  });
}
