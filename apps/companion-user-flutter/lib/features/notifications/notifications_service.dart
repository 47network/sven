import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../app/telemetry.dart';
import '../../config/env_config.dart';
import '../auth/auth_errors.dart';

class NotificationsService {
  NotificationsService({AuthenticatedClient? client})
      : _client = client ?? AuthenticatedClient();

  static final _apiBase = EnvConfig.apiBase;

  final AuthenticatedClient _client;

  Future<void> registerToken({
    required String token,
    required String platform,
    String? deviceId,
  }) async {
    final uri = Uri.parse('$_apiBase/v1/push/register');
    try {
      final response = await _client.postJson(uri, {
        'token': token,
        'platform': platform,
        if (deviceId != null) 'device_id': deviceId,
      });
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AuthException(AuthFailure.server);
      }
      Telemetry.logEvent('push.register', {
        'platform': platform,
        if (deviceId != null) 'device_id': deviceId,
      });
    } on AuthException {
      rethrow;
    }
  }

  Future<void> unregisterToken({required String token}) async {
    final uri = Uri.parse('$_apiBase/v1/push/unregister');
    try {
      final response = await _client.postJson(uri, {'token': token});
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AuthException(AuthFailure.server);
      }
      Telemetry.logEvent('push.unregister', {'token': token});
    } on AuthException {
      rethrow;
    }
  }

  /// Fetch VAPID public key for web push subscription.
  Future<String> getVapidPublicKey() async {
    final uri = Uri.parse('$_apiBase/v1/push/vapid-public-key');
    try {
      final response = await _client.get(uri);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AuthException(AuthFailure.server);
      }
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      return data['publicKey'] as String;
    } on AuthException {
      rethrow;
    } catch (e) {
      throw AuthException(AuthFailure.server);
    }
  }
}
