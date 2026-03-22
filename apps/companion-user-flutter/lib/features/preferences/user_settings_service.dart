import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../config/env_config.dart';

class UserScopedSettingRow {
  const UserScopedSettingRow({
    required this.key,
    required this.value,
    this.updatedAt,
  });

  final String key;
  final dynamic value;
  final DateTime? updatedAt;

  factory UserScopedSettingRow.fromJson(Map<String, dynamic> json) {
    return UserScopedSettingRow(
      key: json['key']?.toString() ?? '',
      value: json['value'],
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.tryParse(json['updated_at'].toString()),
    );
  }
}

class UserSettingsSnapshot {
  const UserSettingsSnapshot({
    required this.mode,
    required this.allowPersonalOverride,
    required this.allowedKeys,
    required this.rows,
  });

  final String mode;
  final bool allowPersonalOverride;
  final List<String> allowedKeys;
  final List<UserScopedSettingRow> rows;

  factory UserSettingsSnapshot.fromJson(Map<String, dynamic> json) {
    final rows = (json['rows'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(UserScopedSettingRow.fromJson)
        .toList();
    final allowedKeys = (json['allowed_keys'] as List<dynamic>? ?? const [])
        .map((entry) => entry.toString())
        .where((entry) => entry.isNotEmpty)
        .toList();
    return UserSettingsSnapshot(
      mode: json['mode']?.toString() ?? 'org_default',
      allowPersonalOverride: json['allow_personal_override'] as bool? ?? true,
      allowedKeys: allowedKeys,
      rows: rows,
    );
  }
}

class UserSettingsService {
  UserSettingsService({required AuthenticatedClient client}) : _client = client;

  static final _apiBase = EnvConfig.apiBase;

  final AuthenticatedClient _client;

  Future<UserSettingsSnapshot?> fetchAll() async {
    final response = await _client.get(Uri.parse('$_apiBase/v1/me/settings'));
    if (response.statusCode == 404) return null;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Failed to load user settings (${response.statusCode})');
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final data = body['data'] as Map<String, dynamic>?;
    if (data == null) return null;
    return UserSettingsSnapshot.fromJson(data);
  }

  Future<bool> setValue(String key, dynamic value) async {
    final response = await _client.putJson(
      Uri.parse('$_apiBase/v1/me/settings/$key'),
      {'value': value},
    );
    return response.statusCode >= 200 && response.statusCode < 300;
  }

  Future<bool> clearValue(String key) => setValue(key, null);
}
