import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../features/auth/auth_errors.dart';
import '../features/auth/token_store.dart';
import 'dio_http_client.dart';

typedef SessionExpiredCallback = void Function();

/// HTTP client that automatically attaches auth tokens and detects session expiry.
///
/// When a 401 is received, [onTokenRefresh] is called first (if provided).
/// If refresh succeeds the original request is retried transparently.
/// Only if refresh also fails is [onSessionExpired] invoked.
///
/// By default the inner transport is [DioHttpClient], which adds automatic retry
/// (3 attempts, exp back-off) and debug logging. Pass a custom [client] to
/// override (e.g. [http.Client] in unit tests).
class AuthenticatedClient {
  AuthenticatedClient({
    http.Client? client,
    TokenStore? tokenStore,
    this.onSessionExpired,
    this.onTokenRefresh,
  })  : _client = client ?? DioHttpClient(),
        _store = tokenStore ?? TokenStore();

  final http.Client _client;
  final TokenStore _store;
  final SessionExpiredCallback? onSessionExpired;

  /// Called when the access token has expired. Should return a fresh access
  /// token or throw if the refresh token is also invalid.
  final Future<String?> Function()? onTokenRefresh;

  bool suppressSessionExpiryHandling = false;

  Future<String?> _getToken() => _store.readAccessToken();

  /// Expose token for callers that build raw requests (e.g. SSE).
  Future<String?> getToken() => _store.readAccessToken();

  /// Attempt a silent token refresh. Returns the new token on success or null.
  Future<String?> _refreshIfPossible() async {
    if (onTokenRefresh == null) return null;
    try {
      return await onTokenRefresh!();
    } catch (_) {
      return null;
    }
  }

  /// Execute [fn] with the current token. On 401, try once to refresh and
  /// retry [fn] with the new token before giving up to [_handleSessionExpired].
  Future<http.Response> _execute(
    Future<http.Response> Function(String? token) fn,
  ) async {
    final token = await _getToken();
    final hasAuthToken = token != null && token.isNotEmpty;
    try {
      final response = await fn(hasAuthToken ? token : null);
      if (response.statusCode == 401 && hasAuthToken && !suppressSessionExpiryHandling) {
        final newToken = await _refreshIfPossible();
        if (newToken != null && newToken.isNotEmpty) {
          await _store.writeAccessToken(newToken);
          // Retry once with the fresh token.
          final retried = await fn(newToken);
          if (retried.statusCode != 401) return retried;
        }
        await _handleSessionExpired();
        throw AuthException(AuthFailure.sessionExpired);
      }
      return response;
    } on SocketException catch (e) {
      throw AuthException(AuthFailure.network, detail: e.message);
    }
  }

  /// Send a raw [http.Request] with the auth token attached.
  /// Returns a [http.StreamedResponse] for callers that need streaming bodies.
  Future<http.StreamedResponse> sendStreamed(http.Request request) async {
    final token = await _getToken();
    final hasAuthToken = token != null && token.isNotEmpty;
    if (hasAuthToken) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    try {
      final response = await _client.send(request);
      if (suppressSessionExpiryHandling && response.statusCode == 401) {
        return response;
      }
      if (hasAuthToken && response.statusCode == 401) {
        final newToken = await _refreshIfPossible();
        if (newToken != null && newToken.isNotEmpty) {
          await _store.writeAccessToken(newToken);
          // Rebuild and retry the request with the fresh token.
          final retryRequest = http.Request(request.method, request.url)
            ..headers.addAll(request.headers)
            ..headers['Authorization'] = 'Bearer $newToken'
            ..bodyBytes = request.bodyBytes;
          final retried = await _client.send(retryRequest);
          if (retried.statusCode != 401) return retried;
        }
        await _handleSessionExpired();
        throw AuthException(AuthFailure.sessionExpired);
      }
      return response;
    } on SocketException catch (e) {
      throw AuthException(AuthFailure.network, detail: e.message);
    }
  }

  /// POST JSON with automatic auth header injection.
  Future<http.Response> postJson(
    Uri uri,
    Map<String, dynamic> body, {
    Map<String, String>? additionalHeaders,
  }) {
    final encoded = jsonEncode(body);
    return _execute((token) => _client.post(
          uri,
          headers: {
            'Content-Type': 'application/json',
            if (token != null) 'Authorization': 'Bearer $token',
            ...?additionalHeaders,
          },
          body: encoded,
        ));
  }

  /// GET with automatic auth header injection.
  Future<http.Response> get(
    Uri uri, {
    Map<String, String>? additionalHeaders,
  }) {
    return _execute((token) => _client.get(
          uri,
          headers: {
            if (token != null) 'Authorization': 'Bearer $token',
            ...?additionalHeaders,
          },
        ));
  }

  /// PUT JSON with automatic auth header injection.
  Future<http.Response> putJson(
    Uri uri,
    Map<String, dynamic> body, {
    Map<String, String>? additionalHeaders,
  }) {
    final encoded = jsonEncode(body);
    return _execute((token) => _client.put(
          uri,
          headers: {
            'Content-Type': 'application/json',
            if (token != null) 'Authorization': 'Bearer $token',
            ...?additionalHeaders,
          },
          body: encoded,
        ));
  }

  /// PATCH JSON with automatic auth header injection.
  Future<http.Response> patchJson(
    Uri uri,
    Map<String, dynamic> body, {
    Map<String, String>? additionalHeaders,
  }) {
    final encoded = jsonEncode(body);
    return _execute((token) => _client.patch(
          uri,
          headers: {
            'Content-Type': 'application/json',
            if (token != null) 'Authorization': 'Bearer $token',
            ...?additionalHeaders,
          },
          body: encoded,
        ));
  }

  /// DELETE with automatic auth header injection.
  Future<http.Response> delete(
    Uri uri, {
    Map<String, String>? additionalHeaders,
  }) {
    return _execute((token) => _client.delete(
          uri,
          headers: {
            if (token != null) 'Authorization': 'Bearer $token',
            ...?additionalHeaders,
          },
        ));
  }

  Future<void> _handleSessionExpired() async {
    await _store.clear();
    onSessionExpired?.call();
  }
}
