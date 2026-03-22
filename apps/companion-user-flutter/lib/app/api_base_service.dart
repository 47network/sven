import 'package:shared_preferences/shared_preferences.dart';

import '../config/env_config.dart';

abstract final class ApiBaseService {
  static const _overrideKey = 'sven.api_base.override';

  static String _current = _normalize(EnvConfig.apiBase) ?? EnvConfig.apiBase;
  static bool _loaded = false;

  static Future<String> load() async {
    if (_loaded) return _current;
    final prefs = await SharedPreferences.getInstance();
    final override = prefs.getString(_overrideKey);
    _current = _normalize(override) ?? _normalize(EnvConfig.apiBase) ?? EnvConfig.apiBase;
    _loaded = true;
    return _current;
  }

  static String currentSync() => _current;

  static Future<String> setOverride(String rawUrl) async {
    final normalized = _normalize(rawUrl);
    if (normalized == null) {
      throw ArgumentError.value(rawUrl, 'rawUrl', 'Expected a valid absolute http/https URL');
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_overrideKey, normalized);
    _current = normalized;
    _loaded = true;
    return _current;
  }

  static Future<void> clearOverride() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_overrideKey);
    _current = _normalize(EnvConfig.apiBase) ?? EnvConfig.apiBase;
    _loaded = true;
  }

  static String? _normalize(String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) return null;
    final uri = Uri.tryParse(trimmed);
    if (uri == null || !uri.hasScheme || !uri.hasAuthority) return null;
    if (uri.scheme != 'http' && uri.scheme != 'https') return null;
    var normalized = trimmed;
    while (normalized.endsWith('/')) {
      normalized = normalized.substring(0, normalized.length - 1);
    }
    return normalized;
  }
}
