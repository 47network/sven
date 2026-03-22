import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../app/scoped_preferences.dart';

/// Persists the last [maxSize] sent prompts so the user can recall them
/// by pressing the up-arrow in the composer.
class PromptHistoryService extends ChangeNotifier {
  PromptHistoryService() {
    _load();
  }

  static const _kKey = 'sven.prompt_history';
  static const maxSize = 20;

  /// All keys managed by this service (for migration).
  static const allKeys = [_kKey];

  /// Static scope shared by all instances. Set once on login from the app
  /// root so that locally-created instances (e.g. in ChatThreadPage) also
  /// read/write to the correct user-scoped storage.
  static ScopedPreferences? activeScope;

  final List<String> _history = [];
  int _cursor = -1; // -1 = not navigating
  ScopedPreferences? _scopedPrefs;

  List<String> get history => List.unmodifiable(_history);

  // ── Scoped storage helpers ──

  Future<String?> _getString(String key) async {
    final sp = _scopedPrefs ?? activeScope;
    if (sp != null && sp.isBound) {
      return sp.getString(key);
    }
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(key);
  }

  Future<void> _setString(String key, String value) async {
    final sp = _scopedPrefs ?? activeScope;
    if (sp != null && sp.isBound) {
      await sp.setString(key, value);
    } else {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(key, value);
    }
  }

  /// Bind to a user and reload from scoped storage.
  Future<void> bindUser(ScopedPreferences scopedPrefs) async {
    _scopedPrefs = scopedPrefs;
    await _scopedPrefs!.migrateUnscopedKeys(allKeys);
    _history.clear();
    _cursor = -1;
    await _load();
  }

  /// Reset in-memory state on logout.
  void resetForLogout() {
    _scopedPrefs = null;
    _history.clear();
    _cursor = -1;
    notifyListeners();
  }

  /// Add a new prompt. Deduplicates and keeps newest at index 0.
  Future<void> add(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;
    _history.remove(trimmed);
    _history.insert(0, trimmed);
    if (_history.length > maxSize) _history.removeLast();
    _cursor = -1;
    notifyListeners();
    await _save();
  }

  /// Returns the next older prompt (up-arrow). Returns null if at the oldest.
  String? navigateUp() {
    if (_history.isEmpty) return null;
    _cursor = (_cursor + 1).clamp(0, _history.length - 1);
    return _history[_cursor];
  }

  /// Returns the next newer prompt (down-arrow). Returns empty when past newest.
  String navigateDown() {
    if (_cursor <= 0) {
      _cursor = -1;
      return '';
    }
    _cursor--;
    return _history[_cursor];
  }

  void resetCursor() => _cursor = -1;

  Future<void> _load() async {
    final raw = await _getString(_kKey);
    if (raw != null) {
      try {
        final list = jsonDecode(raw) as List<dynamic>;
        _history.addAll(list.cast<String>());
        notifyListeners();
      } catch (_) {}
    }
  }

  Future<void> _save() async {
    await _setString(_kKey, jsonEncode(_history));
  }
}
