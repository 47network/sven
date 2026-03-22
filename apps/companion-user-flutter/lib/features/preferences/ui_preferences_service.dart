import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../config/env_config.dart';
import '../../features/auth/auth_errors.dart';
import 'ui_preferences.dart';

class UiPreferencesService {
  UiPreferencesService({AuthenticatedClient? client})
      : _client = client ?? AuthenticatedClient();

  static final _apiBase = EnvConfig.apiBase;

  final AuthenticatedClient _client;

  Future<UiPreferences?> fetch() async {
    final uri = Uri.parse('$_apiBase/v1/me/ui-preferences');
    try {
      final response = await _client.get(uri);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return null;
      }
      final body = jsonDecode(response.body);
      if (body is! Map<String, dynamic>) return null;
      return UiPreferences.fromJson(body);
    } on AuthException {
      return null;
    }
  }

  Future<void> update(UiPreferences prefs) async {
    final uri = Uri.parse('$_apiBase/v1/me/ui-preferences');
    try {
      final response = await _client.putJson(uri, prefs.toJson());
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AuthException(AuthFailure.server);
      }
    } on AuthException {
      rethrow;
    }
  }
}
