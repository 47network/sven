import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:sven_user_flutter/app/authenticated_client.dart';
import 'package:sven_user_flutter/features/auth/auth_errors.dart';
import 'package:sven_user_flutter/features/auth/token_store.dart';

class _InMemoryTokenStore extends TokenStore {
  final Map<String, String?> _store = <String, String?>{};

  static const _accessKey = 'sven.auth.access_token';
  static const _refreshKey = 'sven.auth.refresh_token';

  @override
  Future<String?> readAccessToken() async => _store[_accessKey];

  @override
  Future<String?> readRefreshToken() async => _store[_refreshKey];

  @override
  Future<void> writeAccessToken(String token) async => _store[_accessKey] = token;

  @override
  Future<void> writeRefreshToken(String token) async => _store[_refreshKey] = token;

  @override
  Future<String?> readUserId() async => null;

  @override
  Future<void> writeUserId(String userId) async {}

  @override
  Future<String?> readUsername() async => null;

  @override
  Future<void> writeUsername(String username) async {}

  @override
  Future<void> writeAutoLogin(String username, String password) async {}

  @override
  Future<({String username, String password})?> readAutoLogin() async => null;

  @override
  Future<void> clearAutoLogin() async {}

  @override
  Future<void> clear() async => _store.clear();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('401 without auth token does not trigger session-expired handling', () async {
    final store = _InMemoryTokenStore();
    var sessionExpired = false;
    final client = AuthenticatedClient(
      client: MockClient(
        (_) async => http.Response(
          jsonEncode({
            'error': {'code': 'AUTH_FAILED', 'message': 'Unauthorized'},
          }),
          401,
          headers: {'content-type': 'application/json'},
        ),
      ),
      tokenStore: store,
      onSessionExpired: () => sessionExpired = true,
    );

    final response = await client.get(Uri.parse('https://example.test/v1/chats'));

    expect(response.statusCode, 401);
    expect(sessionExpired, isFalse);
    expect(await store.readAccessToken(), isNull);
  });

  test('401 with auth token clears session and raises session-expired', () async {
    final store = _InMemoryTokenStore();
    await store.writeAccessToken('access-token');
    await store.writeRefreshToken('refresh-token');

    var sessionExpired = false;
    final client = AuthenticatedClient(
      client: MockClient(
        (_) async => http.Response(
          jsonEncode({
            'error': {'code': 'AUTH_FAILED', 'message': 'Expired'},
          }),
          401,
          headers: {'content-type': 'application/json'},
        ),
      ),
      tokenStore: store,
      onSessionExpired: () => sessionExpired = true,
    );

    await expectLater(
      client.get(Uri.parse('https://example.test/v1/chats')),
      throwsA(
        isA<AuthException>().having(
          (e) => e.failure,
          'failure',
          AuthFailure.sessionExpired,
        ),
      ),
    );

    expect(sessionExpired, isTrue);
    expect(await store.readAccessToken(), isNull);
    expect(await store.readRefreshToken(), isNull);
  });
}
