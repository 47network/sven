import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../app/scoped_preferences.dart';

/// A named, reusable prompt template stored locally.
class PromptTemplate {
  const PromptTemplate({
    required this.id,
    required this.name,
    required this.text,
  });

  final String id;
  final String name;
  final String text;

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'text': text};

  factory PromptTemplate.fromJson(Map<String, dynamic> json) => PromptTemplate(
        id: json['id'] as String,
        name: json['name'] as String,
        text: json['text'] as String,
      );
}

/// Persistent, observable list of prompt templates.
///
/// Uses SharedPreferences under the key `sven.prompt_templates`.
class PromptTemplatesService extends ChangeNotifier {
  static const _key = 'sven.prompt_templates';

  /// All keys managed by this service (for migration).
  static const allKeys = [_key];

  final List<PromptTemplate> _templates = [];
  bool _loaded = false;
  ScopedPreferences? _scopedPrefs;

  List<PromptTemplate> get templates => List.unmodifiable(_templates);

  // ── Scoped storage helpers ──

  Future<String?> _getString(String key) async {
    if (_scopedPrefs != null && _scopedPrefs!.isBound) {
      return _scopedPrefs!.getString(key);
    }
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(key);
  }

  Future<void> _setString(String key, String value) async {
    if (_scopedPrefs != null && _scopedPrefs!.isBound) {
      await _scopedPrefs!.setString(key, value);
    } else {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(key, value);
    }
  }

  /// Bind to a user and reload from scoped storage.
  Future<void> bindUser(ScopedPreferences scopedPrefs) async {
    _scopedPrefs = scopedPrefs;
    await _scopedPrefs!.migrateUnscopedKeys(allKeys);
    _loaded = false;
    _templates.clear();
    await load();
  }

  /// Reset in-memory state on logout.
  void resetForLogout() {
    _scopedPrefs = null;
    _templates.clear();
    _loaded = false;
    notifyListeners();
  }

  /// Load templates from disk. Safe to call multiple times.
  Future<void> load() async {
    if (_loaded) return;
    _loaded = true;
    final raw = await _getString(_key);
    if (raw != null) {
      try {
        final list = jsonDecode(raw) as List<dynamic>;
        _templates.addAll(
          list.map((e) => PromptTemplate.fromJson(e as Map<String, dynamic>)),
        );
        notifyListeners();
      } catch (_) {
        // corrupt data — start fresh
      }
    }
  }

  /// Save a new template (or replace one with the same name).
  Future<void> save(String name, String text) async {
    final trimName = name.trim();
    final trimText = text.trim();
    if (trimName.isEmpty || trimText.isEmpty) return;
    // Replace existing with same name
    _templates.removeWhere(
      (t) => t.name.toLowerCase() == trimName.toLowerCase(),
    );
    _templates.add(PromptTemplate(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      name: trimName,
      text: trimText,
    ));
    notifyListeners();
    await _persist();
  }

  /// Delete a template by id.
  Future<void> delete(String id) async {
    _templates.removeWhere((t) => t.id == id);
    notifyListeners();
    await _persist();
  }

  Future<void> _persist() async {
    await _setString(
      _key,
      jsonEncode(_templates.map((t) => t.toJson()).toList()),
    );
  }
}
