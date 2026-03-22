import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../features/auth/auth_errors.dart';
import '../features/auth/token_store.dart';
import 'dio_http_client.dart';

typedef SessionExpiredCallback = void Function();

/// HTTP client that automatically attaches auth tokens and detects session expiry.
///
/// By default the inner transport is [DioHttpClient], which adds automatic retry
/// (3 attempts, exp back-off) and debug logging.  Pass a custom [client] to
/// override (e.g. [http.Client] in unit tests).
class AuthenticatedClient {
  AuthenticatedClient({
    http.Client? client,
    TokenStore? tokenStore,
    this.onSessionExpired,
  })  : _client = client ?? DioHttpClient(),
        _store = tokenStore ?? TokenStore();

  final http.Client _client;
  final TokenStore _store;
  final SessionExpiredCallback? onSessionExpired;

  Future<String?> _getToken() => _store.readAccessToken();

  /// Expose token for callers that build raw requests (e.g. SSE).
  Future<String?> getToken() => _store.readAccessToken();

  /// Send a raw [http.Request] with the auth token attached.
  /// Returns a [http.StreamedResponse] for callers that need streaming bodies.
  Future<http.StreamedResponse> sendStreamed(http.Request request) async {
    final token = await _getToken();
    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    try {
      return await _client.send(request);
    } on SocketException catch (e) {
      throw AuthException(AuthFailure.network, detail: e.message);
    }
  }

  /// POST JSON with automatic auth header injection.
  Future<http.Response> postJson(
    Uri uri,
    Map<String, dynamic> body, {
    Map<String, String>? additionalHeaders,
  }) async {
    final token = await _getToken();
    try {
      final response = await _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          if (token != null && token.isNotEmpty)
            'Authorization': 'Bearer $token',
          ...?additionalHeaders,
        },
        body: jsonEncode(body),
      );
      _checkSessionExpired(response);
      return response;
    } on SocketException catch (e) {
      throw AuthException(AuthFailure.network, detail: e.message);
    }
  }

  /// GET with automatic auth header injection.
  Future<http.Response> get(
    Uri uri, {
    Map<String, String>? additionalHeaders,
  }) async {
    final token = await _getToken();
    try {
      final response = await _client.get(
        uri,
        headers: {
          if (token != null && token.isNotEmpty)
            'Authorization': 'Bearer $token',
          ...?additionalHeaders,
        },
      );
      _checkSessionExpired(response);
      return response;
    } on SocketException catch (e) {
      throw AuthException(AuthFailure.network, detail: e.message);
    }
  }

  /// PUT JSON with automatic auth header injection.
  Future<http.Response> putJson(
    Uri uri,
    Map<String, dynamic> body, {
    Map<String, String>? additionalHeaders,
  }) async {
    final token = await _getToken();
    try {
      final response = await _client.put(
        uri,
        headers: {
          'Content-Type': 'application/json',
          if (token != null && token.isNotEmpty)
            'Authorization': 'Bearer $token',
          ...?additionalHeaders,
        },
        body: jsonEncode(body),
      );
      _checkSessionExpired(response);
      return response;
    } on SocketException catch (e) {
      throw AuthException(AuthFailure.network, detail: e.message);
    }
  }

  /// PATCH JSON with automatic auth header injection.
  Future<http.Response> patchJson(
    Uri uri,
    Map<String, dynamic> body, {
    Map<String, String>? additionalHeaders,
  }) async {
    final token = await _getToken();
    try {
      final response = await _client.patch(
        uri,
        headers: {
          'Content-Type': 'application/json',
          if (token != null && token.isNotEmpty)
            'Authorization': 'Bearer $token',
          ...?additionalHeaders,
        },
        body: jsonEncode(body),
      );
      _checkSessionExpired(response);
      return response;
    } on SocketException catch (e) {
      throw AuthException(AuthFailure.network, detail: e.message);
    }
  }

  /// DELETE with automatic auth header injection.
  Future<http.Response> delete(
    Uri uri, {
    Map<String, String>? additionalHeaders,
  }) async {
    final token = await _getToken();
    try {
      final response = await _client.delete(
        uri,
        headers: {
          if (token != null && token.isNotEmpty)
            'Authorization': 'Bearer $token',
          ...?additionalHeaders,
        },
      );
      _checkSessionExpired(response);
      return response;
    } on SocketException catch (e) {
      throw AuthException(AuthFailure.network, detail: e.message);
    }
  }

  void _checkSessionExpired(http.Response response) {
    if (response.statusCode != 401) return;

    // Check if response body contains SESSION_EXPIRED code.
    try {
      final body = jsonDecode(response.body);
      if (body is Map<String, dynamic>) {
        final error = body['error'];
        if (error is Map<String, dynamic>) {
          final code = error['code']?.toString();
          if (code == 'SESSION_EXPIRED' || code == 'AUTH_FAILED') {
            _handleSessionExpired();
            throw AuthException(AuthFailure.sessionExpired);
          }
        }
      }
    } catch (_) {
      // If we can't parse the body, fall back to status code only.
    }

    // Any 401 is treated as session expired.
    _handleSessionExpired();
    throw AuthException(AuthFailure.sessionExpired);
  }

  Future<void> _handleSessionExpired() async {
    await _store.clear();
    onSessionExpired?.call();
  }
}
