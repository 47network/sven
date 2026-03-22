import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../../app/api_base_service.dart';
import '../../app/telemetry.dart';
import 'auth_errors.dart';
import 'sso_service.dart';
import 'token_store.dart';

/// Result returned by [AuthService.login] containing the session token
/// and the authenticated user's identity.
///
/// When [mfaRequired] is true the user must still complete a second factor;
/// [token] and [userId] will be empty strings.  Pass [mfaToken] to
/// [AuthService.verifyMfa] along with the OTP code.
class LoginResult {
  const LoginResult({
    required this.token,
    required this.userId,
    this.username,
    this.mfaRequired = false,
    this.mfaToken,
  });

  final String token;
  final String userId;
  final String? username;

  /// True when the backend requires a TOTP verification step.
  final bool mfaRequired;

  /// Short-lived partial session token to pass to [AuthService.verifyMfa].
  final String? mfaToken;
}

class AuthService {
  AuthService({http.Client? client, TokenStore? store})
      : _client = client ?? http.Client(),
        _store = store ?? TokenStore();
  static String get _apiBase => ApiBaseService.currentSync();

  /// Exposes the compiled-in API base URL for services that need it
  /// (e.g. [FeatureFlagService.load]).
  static String get apiBase => _apiBase;

  final http.Client _client;
  final TokenStore _store;

  Future<String?> readToken() => _store.readAccessToken();
  Future<String?> readRefreshToken() => _store.readRefreshToken();
  Future<String?> readUserId() => _store.readUserId();
  Future<String?> readUsername() => _store.readUsername();

  // ── Personal-mode auto-login ──
  Future<void> saveAutoLogin(String username, String password) =>
      _store.writeAutoLogin(username, password);
  Future<({String username, String password})?> readAutoLogin() =>
      _store.readAutoLogin();
  Future<void> clearAutoLogin() => _store.clearAutoLogin();

  Future<void> clearToken() => _store.clear();

  Future<String?> _readAuthToken() async {
    final token = await readToken();
    if (token == null || token.isEmpty) return null;
    return token;
  }

  void _emitEvent(
    String name, {
    required bool success,
    AuthFailure? failure,
    int? statusCode,
    int? latencyMs,
  }) {
    Telemetry.logEvent(name, {
      'success': success,
      'failure': failure?.name,
      'status_code': statusCode,
      'latency_ms': latencyMs,
    });
  }

  AuthException _mapStatus(int statusCode) {
    if (statusCode == 401) {
      return AuthException(AuthFailure.invalidCredentials);
    }
    if (statusCode == 403) {
      return AuthException(AuthFailure.accountLocked);
    }
    if (statusCode == 429) {
      return AuthException(AuthFailure.rateLimited);
    }
    if (statusCode >= 500) {
      if (statusCode == 504) {
        return AuthException(
          AuthFailure.server,
          detail: 'Server timeout (504). Please try again shortly.',
        );
      }
      return AuthException(
        AuthFailure.server,
        detail: 'Server error ($statusCode). Please try again later.',
      );
    }
    return AuthException(AuthFailure.unknown);
  }

  Future<http.Response> _postJson(
    Uri uri,
    Map<String, dynamic> body, {
    String? token,
  }) async {
    try {
      return await _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode(body),
      );
    } on SocketException catch (e) {
      throw AuthException(AuthFailure.network, detail: e.message);
    }
  }

  Future<LoginResult> login({
    required String username,
    required String password,
  }) async {
    final timer = Stopwatch()..start();
    final uri = Uri.parse('$_apiBase/v1/auth/login');
    try {
      final response = await _postJson(
        uri,
        {'username': username, 'password': password},
      );

      if (response.statusCode < 200 || response.statusCode >= 300) {
        final failure = _mapStatus(response.statusCode).failure;
        _emitEvent(
          'auth.login',
          success: false,
          failure: failure,
          statusCode: response.statusCode,
          latencyMs: timer.elapsedMilliseconds,
        );
        throw _mapStatus(response.statusCode);
      }

      final body = jsonDecode(response.body);
      if (body is! Map<String, dynamic>) {
        throw Exception('Login response is invalid.');
      }

      // Extract data object (gateway returns tokens inside 'data')
      final data = body['data'] as Map<String, dynamic>?;
      final tokenSource = data ?? body;

      // Support both legacy MFA and current gateway TOTP challenge responses.
      final requiresMfa = tokenSource['requires_totp'] == true ||
          tokenSource['mfa_required'] == true;
      if (requiresMfa) {
        final mfaToken =
            (tokenSource['pre_session_id'] ?? tokenSource['mfa_token'])
                ?.toString();
        if (mfaToken == null || mfaToken.isEmpty) {
          throw AuthException(AuthFailure.server);
        }
        _emitEvent(
          'auth.login',
          success: true,
          latencyMs: timer.elapsedMilliseconds,
        );
        return LoginResult(
          token: '',
          userId: '',
          username: username,
          mfaRequired: true,
          mfaToken: mfaToken,
        );
      }

      final token = (tokenSource['accessToken'] ??
              tokenSource['access_token'] ??
              tokenSource['token'])
          ?.toString();
      final refreshToken =
          (tokenSource['refreshToken'] ?? tokenSource['refresh_token'])
              ?.toString();
      if (token == null || token.isEmpty) {
        throw AuthException(AuthFailure.server);
      }

      // Extract user identity from response
      final userId =
          (tokenSource['user_id'] ?? tokenSource['userId'])?.toString();
      final respUsername = (tokenSource['username'])?.toString();
      if (userId == null || userId.isEmpty) {
        throw AuthException(AuthFailure.server);
      }

      await _store.writeAccessToken(token);
      if (refreshToken != null && refreshToken.isNotEmpty) {
        await _store.writeRefreshToken(refreshToken);
      }
      await _store.writeUserId(userId);
      if (respUsername != null && respUsername.isNotEmpty) {
        await _store.writeUsername(respUsername);
      }
      _emitEvent(
        'auth.login',
        success: true,
        latencyMs: timer.elapsedMilliseconds,
      );
      return LoginResult(token: token, userId: userId, username: respUsername);
    } on AuthException catch (e) {
      _emitEvent(
        'auth.login',
        success: false,
        failure: e.failure,
        latencyMs: timer.elapsedMilliseconds,
      );
      rethrow;
    }
  }

  Future<String> refresh() async {
    final timer = Stopwatch()..start();
    final refreshToken = await readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      _emitEvent(
        'auth.refresh',
        success: false,
        failure: AuthFailure.sessionExpired,
        latencyMs: timer.elapsedMilliseconds,
      );
      throw AuthException(AuthFailure.sessionExpired);
    }
    final uri = Uri.parse('$_apiBase/v1/auth/refresh');
    try {
      final response = await _postJson(
        uri,
        {'refreshToken': refreshToken},
      );

      if (response.statusCode == 401) {
        _emitEvent(
          'auth.refresh',
          success: false,
          failure: AuthFailure.sessionExpired,
          statusCode: response.statusCode,
          latencyMs: timer.elapsedMilliseconds,
        );
        throw AuthException(AuthFailure.sessionExpired);
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final failure = _mapStatus(response.statusCode).failure;
        _emitEvent(
          'auth.refresh',
          success: false,
          failure: failure,
          statusCode: response.statusCode,
          latencyMs: timer.elapsedMilliseconds,
        );
        throw _mapStatus(response.statusCode);
      }

      final body = jsonDecode(response.body);
      if (body is! Map<String, dynamic>) {
        throw AuthException(AuthFailure.server);
      }

      // Extract data object (gateway returns tokens inside 'data')
      final data = body['data'] as Map<String, dynamic>?;
      final tokenSource = data ?? body;

      final token = (tokenSource['accessToken'] ??
              tokenSource['access_token'] ??
              tokenSource['token'])
          ?.toString();
      final nextRefresh =
          (tokenSource['refreshToken'] ?? tokenSource['refresh_token'])
              ?.toString();
      if (token == null || token.isEmpty) {
        throw AuthException(AuthFailure.server);
      }

      await _store.writeAccessToken(token);
      if (nextRefresh != null && nextRefresh.isNotEmpty) {
        await _store.writeRefreshToken(nextRefresh);
      }
      _emitEvent(
        'auth.refresh',
        success: true,
        latencyMs: timer.elapsedMilliseconds,
      );
      return token;
    } on AuthException catch (e) {
      _emitEvent(
        'auth.refresh',
        success: false,
        failure: e.failure,
        latencyMs: timer.elapsedMilliseconds,
      );
      rethrow;
    }
  }

  Future<void> logout() async {
    final timer = Stopwatch()..start();
    final token = await _readAuthToken();
    if (token == null) return;
    final uri = Uri.parse('$_apiBase/v1/auth/logout');
    try {
      await _postJson(uri, const {}, token: token);
      _emitEvent(
        'auth.logout',
        success: true,
        latencyMs: timer.elapsedMilliseconds,
      );
    } on AuthException catch (e) {
      _emitEvent(
        'auth.logout',
        success: false,
        failure: e.failure,
        latencyMs: timer.elapsedMilliseconds,
      );
      rethrow;
    } finally {
      await clearToken();
    }
  }

  Future<void> logoutAll() async {
    final timer = Stopwatch()..start();
    final token = await _readAuthToken();
    if (token == null) return;
    final uri = Uri.parse('$_apiBase/v1/auth/logout-all');
    try {
      await _postJson(uri, const {}, token: token);
      _emitEvent(
        'auth.logout_all',
        success: true,
        latencyMs: timer.elapsedMilliseconds,
      );
    } on AuthException catch (e) {
      _emitEvent(
        'auth.logout_all',
        success: false,
        failure: e.failure,
        latencyMs: timer.elapsedMilliseconds,
      );
      rethrow;
    } finally {
      await clearToken();
    }
  }

  /// Change the authenticated user's password.
  /// Calls `PATCH /v1/users/me/password` with `{ current_password, new_password }`.
  /// Returns `null` on success or an error message string on failure.
  Future<String?> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final token = await _readAuthToken();
    if (token == null) return 'Not authenticated';
    final uri = Uri.parse('$_apiBase/v1/users/me/password');
    try {
      final response = await _client.patch(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'current_password': currentPassword,
          'new_password': newPassword,
        }),
      );
      if (response.statusCode == 200 || response.statusCode == 204) {
        Telemetry.logEvent('auth.change_password', {'success': true});
        return null; // success
      }
      final body = jsonDecode(response.body) as Map<String, dynamic>?;
      final message = (body?['error'] as Map?)?['message'] as String? ??
          'Password change failed (${response.statusCode})';
      Telemetry.logEvent('auth.change_password',
          {'success': false, 'status_code': response.statusCode});
      return message;
    } catch (e) {
      return 'Network error — please try again';
    }
  }

  /// Exchange an SSO credential for a Sven session token.
  ///
  /// Calls `POST /v1/auth/sso` with the provider name and ID token, then
  /// stores the returned access/refresh tokens exactly as [login] does.
  ///
  /// Throws [AuthException] on network or server failure.
  /// The caller is responsible for catching [SsoException] from [SsoService]
  /// and converting to [AuthException(AuthFailure.ssoFailed)] if desired.
  Future<LoginResult> loginWithSso(SsoCredential credential) async {
    final timer = Stopwatch()..start();
    final uri = Uri.parse('$_apiBase/v1/auth/sso');
    try {
      final body = <String, dynamic>{
        'provider': credential.provider,
        'id_token': credential.idToken,
        if (credential.accessToken != null)
          'access_token': credential.accessToken,
        if (credential.nonce != null) 'nonce': credential.nonce,
      };
      final response = await _postJson(uri, body);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        final failure = _mapStatus(response.statusCode).failure;
        _emitEvent(
          'auth.sso_login',
          success: false,
          failure: failure,
          statusCode: response.statusCode,
          latencyMs: timer.elapsedMilliseconds,
        );
        throw _mapStatus(response.statusCode);
      }

      final respBody = jsonDecode(response.body);
      if (respBody is! Map<String, dynamic>) {
        throw AuthException(AuthFailure.server);
      }

      final data = respBody['data'] as Map<String, dynamic>?;
      final tokenSource = data ?? respBody;

      final token = (tokenSource['accessToken'] ??
              tokenSource['access_token'] ??
              tokenSource['token'])
          ?.toString();
      final refreshToken =
          (tokenSource['refreshToken'] ?? tokenSource['refresh_token'])
              ?.toString();
      if (token == null || token.isEmpty) {
        throw AuthException(AuthFailure.server);
      }

      final userId =
          (tokenSource['user_id'] ?? tokenSource['userId'])?.toString();
      final username = tokenSource['username']?.toString();
      if (userId == null || userId.isEmpty) {
        throw AuthException(AuthFailure.server);
      }

      await _store.writeAccessToken(token);
      if (refreshToken != null && refreshToken.isNotEmpty) {
        await _store.writeRefreshToken(refreshToken);
      }
      await _store.writeUserId(userId);
      if (username != null && username.isNotEmpty) {
        await _store.writeUsername(username);
      }

      _emitEvent(
        'auth.sso_login',
        success: true,
        latencyMs: timer.elapsedMilliseconds,
      );
      return LoginResult(token: token, userId: userId, username: username);
    } on AuthException catch (e) {
      _emitEvent(
        'auth.sso_login',
        success: false,
        failure: e.failure,
        latencyMs: timer.elapsedMilliseconds,
      );
      rethrow;
    }
  }

  /// Data returned by [setupMfa] containing the TOTP secret and an optional
  /// QR-code URL for scanning with an authenticator app.
  // ignore: prefer-static-class
  static MfaSetupData _parseMfaSetup(Map<String, dynamic> body) {
    final data = body['data'] as Map<String, dynamic>? ?? body;
    return MfaSetupData(
      secret: (data['secret'] ?? data['totp_secret'] ?? '').toString(),
      qrCodeUrl: (data['qr_code_url'] ?? data['qrCodeUrl'])?.toString(),
    );
  }

  // ── MFA / 2FA ─────────────────────────────────────────────────────────────

  /// Exchange a short-lived MFA session token + TOTP code for a full session.
  ///
  /// Called after [login] returns [LoginResult.mfaRequired] == true.
  /// [mfaToken] is [LoginResult.mfaToken]; [code] is the 6-digit TOTP code
  /// (or a recovery code).
  Future<LoginResult> verifyMfa({
    required String mfaToken,
    required String code,
  }) async {
    final timer = Stopwatch()..start();
    final totpUri = Uri.parse('$_apiBase/v1/auth/totp/verify');
    final mfaUri = Uri.parse('$_apiBase/v1/auth/mfa/verify');
    try {
      var response = await _postJson(totpUri, {
        'pre_session_id': mfaToken,
        'code': code,
      });

      // Backward compatibility for backends that still use /mfa/verify.
      if (response.statusCode == 404) {
        response = await _postJson(mfaUri, {
          'mfa_token': mfaToken,
          'code': code,
        });
      }

      if (response.statusCode == 400 || response.statusCode == 401) {
        _emitEvent(
          'auth.mfa_verify',
          success: false,
          failure: AuthFailure.mfaInvalidCode,
          statusCode: response.statusCode,
          latencyMs: timer.elapsedMilliseconds,
        );
        throw AuthException(AuthFailure.mfaInvalidCode);
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw _mapStatus(response.statusCode);
      }

      final body = jsonDecode(response.body) as Map<String, dynamic>? ?? {};
      final data = body['data'] as Map<String, dynamic>? ?? body;
      var token = (data['accessToken'] ?? data['access_token'] ?? data['token'])
          ?.toString();
      final refreshToken =
          (data['refreshToken'] ?? data['refresh_token'])?.toString();
      final userId = (data['user_id'] ?? data['userId'])?.toString();
      final username = data['username']?.toString();

      // Current /totp/verify may not return tokens; pre-session id becomes
      // the active session id and can be used as both access + refresh token.
      final effectiveRefreshToken =
          (refreshToken != null && refreshToken.isNotEmpty)
              ? refreshToken
              : mfaToken;
      if ((token == null || token.isEmpty) &&
          userId != null &&
          userId.isNotEmpty) {
        token = mfaToken;
      }

      if (token == null || token.isEmpty || userId == null || userId.isEmpty) {
        throw AuthException(AuthFailure.server);
      }

      await _store.writeAccessToken(token);
      await _store.writeRefreshToken(effectiveRefreshToken);
      await _store.writeUserId(userId);
      if (username != null && username.isNotEmpty) {
        await _store.writeUsername(username);
      }

      _emitEvent(
        'auth.mfa_verify',
        success: true,
        latencyMs: timer.elapsedMilliseconds,
      );
      return LoginResult(token: token, userId: userId, username: username);
    } on AuthException catch (e) {
      _emitEvent(
        'auth.mfa_verify',
        success: false,
        failure: e.failure,
        latencyMs: timer.elapsedMilliseconds,
      );
      rethrow;
    }
  }

  /// Returns true if the authenticated user has 2FA enabled.
  ///
  /// Calls `GET /v1/auth/mfa/status`.
  Future<bool> getMfaStatus() async {
    final token = await _readAuthToken();
    if (token == null) return false;
    final uri = Uri.parse('$_apiBase/v1/auth/mfa/status');
    try {
      final response = await _client.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode < 200 || response.statusCode >= 300) return false;
      final body = jsonDecode(response.body) as Map<String, dynamic>? ?? {};
      final data = body['data'] as Map<String, dynamic>? ?? body;
      return data['enabled'] == true || data['mfa_enabled'] == true;
    } catch (_) {
      return false;
    }
  }

  /// Start the MFA setup flow.
  ///
  /// Calls `POST /v1/auth/mfa/setup` and returns the TOTP secret + QR code.
  Future<MfaSetupData> setupMfa() async {
    final token = await _readAuthToken();
    if (token == null) throw AuthException(AuthFailure.sessionExpired);
    final uri = Uri.parse('$_apiBase/v1/auth/mfa/setup');
    final response = await _postJson(uri, const {}, token: token);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _mapStatus(response.statusCode);
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>? ?? {};
    return _parseMfaSetup(body);
  }

  /// Confirm MFA setup by verifying the first code from the authenticator app.
  ///
  /// Calls `POST /v1/auth/mfa/confirm` with `{ code }`.
  Future<void> confirmMfaSetup({required String code}) async {
    final token = await _readAuthToken();
    if (token == null) throw AuthException(AuthFailure.sessionExpired);
    final uri = Uri.parse('$_apiBase/v1/auth/mfa/confirm');
    final response = await _postJson(uri, {'code': code}, token: token);
    if (response.statusCode == 400 || response.statusCode == 401) {
      throw AuthException(AuthFailure.mfaInvalidCode);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _mapStatus(response.statusCode);
    }
  }

  /// Disable MFA by verifying the current OTP code.
  ///
  /// Calls `DELETE /v1/auth/mfa` with `{ code }` in the request body.
  Future<void> disableMfa({required String code}) async {
    final token = await _readAuthToken();
    if (token == null) throw AuthException(AuthFailure.sessionExpired);
    final uri = Uri.parse('$_apiBase/v1/auth/mfa');
    try {
      final response = await _client.delete(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({'code': code}),
      );
      if (response.statusCode == 400 || response.statusCode == 401) {
        throw AuthException(AuthFailure.mfaInvalidCode);
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw _mapStatus(response.statusCode);
      }
    } on SocketException catch (e) {
      throw AuthException(AuthFailure.network, detail: e.message);
    }
  }

  /// Permanently delete the authenticated account (GDPR right to erasure).
  /// Calls `DELETE /v1/users/me`, then clears all local tokens regardless
  /// of the server response.
  Future<void> deleteAccount() async {
    final token = await _readAuthToken();
    if (token == null) {
      await clearToken();
      return;
    }
    final uri = Uri.parse('$_apiBase/v1/users/me');
    try {
      final response = await _client.delete(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );
      Telemetry.logEvent('auth.delete_account', {
        'success': response.statusCode < 300,
        'status_code': response.statusCode,
      });
    } catch (_) {
      // Always clear tokens even if the server call fails.
    } finally {
      await clearToken();
    }
  }
}

// ── MFA data types ─────────────────────────────────────────────────────────

/// Data returned by [AuthService.setupMfa] containing the TOTP secret and an
/// optional QR-code URL that the user's authenticator app can scan.
class MfaSetupData {
  const MfaSetupData({required this.secret, this.qrCodeUrl});

  /// The base-32 encoded TOTP secret key to enter manually.
  final String secret;

  /// A `otpauth://` URI rendered as a QR code, if provided by the server.
  final String? qrCodeUrl;
}
