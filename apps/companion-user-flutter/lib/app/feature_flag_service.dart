import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

// ═══════════════════════════════════════════════════════════════════════════
// FeatureFlagService
//
// Manages feature flags with three layers (lowest → highest priority):
//   1. Compiled-in defaults
//   2. Remote overrides fetched from GET /v1/me/ui-preferences
//   3. Local dev overrides stored in SharedPreferences (only in debug builds)
//
// Usage:
//   final flags = FeatureFlagService.instance;
//   await flags.load(apiBase: '...', token: '...');
//   if (flags.flag('bandwidth_aware_images')) { ... }
// ═══════════════════════════════════════════════════════════════════════════

class FeatureFlagService extends ChangeNotifier {
  FeatureFlagService._();

  /// Singleton.
  static final FeatureFlagService instance = FeatureFlagService._();

  // ── Defaults (compiled in) ───────────────────────────────────────────────
  static const Map<String, dynamic> _defaults = {
    // Voice
    'noise_level_indicator': true,

    // Chat UI
    'file_download_chips': true,
    'code_execution': true,
    'auto_read_mode': false,
    'smart_reconnect': true,

    // Performance / UX
    'bandwidth_aware_images': true,
    'message_virtualization':
        true, // RepaintBoundary + addAutomaticKeepAlives:false
    'streaming_tts': true,

    // Privacy / Compliance
    'account_deletion': true,

    // Experimental (off by default)
    'ios_cupertino_menus': true,
    'multi_modal_composer': false,
    'rive_avatar': false,
    'home_screen_widget': false,
  };

  Map<String, dynamic> _remote = {};
  Map<String, dynamic> _devOverrides = {};

  bool _loaded = false;

  // ── Load (called after login) ────────────────────────────────────────────

  Future<void> load({String? apiBase, String? token}) async {
    // Load dev overrides from SharedPreferences (debug builds only)
    if (kDebugMode) {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('feature_flags_dev_overrides');
      if (raw != null) {
        try {
          _devOverrides = Map<String, dynamic>.from(jsonDecode(raw) as Map);
        } catch (_) {
          _devOverrides = {};
        }
      }
    }

    // Fetch remote flags from ui-preferences endpoint
    if (apiBase != null && token != null) {
      try {
        final response = await http.get(
          Uri.parse('$apiBase/v1/me/ui-preferences'),
          headers: {'Authorization': 'Bearer $token'},
        ).timeout(const Duration(seconds: 5));
        if (response.statusCode == 200) {
          final body = jsonDecode(response.body) as Map<String, dynamic>;
          final prefs = body['data'] as Map<String, dynamic>? ?? {};
          // Only pick keys that start with 'feature.' prefix from the server
          _remote = {
            for (final entry in prefs.entries)
              if (entry.key.startsWith('feature.'))
                entry.key.substring('feature.'.length): entry.value,
          };
        }
      } catch (_) {
        // Silently fall back to defaults on any error
      }
    }

    _loaded = true;
    notifyListeners();
  }

  /// Resets state — call on logout.
  void clear() {
    _remote = {};
    _devOverrides = {};
    _loaded = false;
    notifyListeners();
  }

  // ── Flag accessors ───────────────────────────────────────────────────────

  /// Returns the boolean value of a feature flag.
  /// Lookup order: devOverrides > remote > defaults > [fallback].
  bool flag(String key, {bool fallback = false}) {
    if (kDebugMode && _devOverrides.containsKey(key)) {
      return _devOverrides[key] == true;
    }
    if (_remote.containsKey(key)) return _remote[key] == true;
    if (_defaults.containsKey(key)) return _defaults[key] == true;
    return fallback;
  }

  /// Returns a string flag value.
  String flagString(String key, {String fallback = ''}) {
    if (kDebugMode && _devOverrides.containsKey(key)) {
      return _devOverrides[key]?.toString() ?? fallback;
    }
    if (_remote.containsKey(key)) return _remote[key]?.toString() ?? fallback;
    if (_defaults.containsKey(key)) {
      return _defaults[key]?.toString() ?? fallback;
    }
    return fallback;
  }

  /// Whether [load()] has been called at least once.
  bool get isLoaded => _loaded;

  // ── Dev overrides (debug builds only) ───────────────────────────────────

  /// Toggle a flag in the local dev-override layer (persisted in SharedPrefs).
  Future<void> setDevOverride(String key, bool value) async {
    if (!kDebugMode) return;
    _devOverrides[key] = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
        'feature_flags_dev_overrides', jsonEncode(_devOverrides));
    notifyListeners();
  }

  /// All known flag keys (for the debug settings panel).
  List<String> get allKeys => _defaults.keys.toList();

  /// Returns the effective value for every flag (merged map).
  Map<String, dynamic> get effectiveFlags => {
        ..._defaults,
        ..._remote,
        if (kDebugMode) ..._devOverrides,
      };
}
