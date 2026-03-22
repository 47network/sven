import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

// ═══════════════════════════════════════════════════════════════════════════
// Model
// ═══════════════════════════════════════════════════════════════════════════

class ProjectSpace {
  ProjectSpace({
    required this.id,
    required this.name,
    this.emoji = '📁',
    this.description = '',
    this.contextNotes = '',
    List<String>? conversationIds,
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : conversationIds = conversationIds ?? [],
        createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  final String id;
  String name;
  String emoji;
  String description;
  String contextNotes;
  List<String> conversationIds;
  final DateTime createdAt;
  DateTime updatedAt;

  ProjectSpace copyWith({
    String? name,
    String? emoji,
    String? description,
    String? contextNotes,
    List<String>? conversationIds,
  }) {
    return ProjectSpace(
      id: id,
      name: name ?? this.name,
      emoji: emoji ?? this.emoji,
      description: description ?? this.description,
      contextNotes: contextNotes ?? this.contextNotes,
      conversationIds: conversationIds ?? List.of(this.conversationIds),
      createdAt: createdAt,
      updatedAt: DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'emoji': emoji,
        'description': description,
        'contextNotes': contextNotes,
        'conversationIds': conversationIds,
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
      };

  factory ProjectSpace.fromJson(Map<String, dynamic> j) => ProjectSpace(
        id: j['id'] as String,
        name: j['name'] as String? ?? 'Untitled',
        emoji: j['emoji'] as String? ?? '📁',
        description: j['description'] as String? ?? '',
        contextNotes: j['contextNotes'] as String? ?? '',
        conversationIds:
            (j['conversationIds'] as List<dynamic>?)?.cast<String>() ?? [],
        createdAt: j['createdAt'] != null
            ? DateTime.tryParse(j['createdAt'] as String) ?? DateTime.now()
            : DateTime.now(),
        updatedAt: j['updatedAt'] != null
            ? DateTime.tryParse(j['updatedAt'] as String) ?? DateTime.now()
            : DateTime.now(),
      );
}

// ═══════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════

class ProjectService extends ChangeNotifier {
  static const _kProjects = 'sven.projects';

  final List<ProjectSpace> _projects = [];

  List<ProjectSpace> get projects => List.unmodifiable(_projects);

  ProjectService() {
    _load();
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  ProjectSpace? byId(String id) {
    try {
      return _projects.firstWhere((p) => p.id == id);
    } catch (_) {
      return null;
    }
  }

  /// Returns all projects that contain [conversationId].
  List<ProjectSpace> forConversation(String conversationId) => _projects
      .where((p) => p.conversationIds.contains(conversationId))
      .toList();

  // ── Mutations ────────────────────────────────────────────────────────────

  Future<ProjectSpace> createProject({
    required String name,
    String emoji = '📁',
    String description = '',
  }) async {
    final project = ProjectSpace(
      id: 'proj-${DateTime.now().millisecondsSinceEpoch}',
      name: name.trim(),
      emoji: emoji,
      description: description,
    );
    _projects.insert(0, project);
    notifyListeners();
    await _save();
    return project;
  }

  Future<void> updateProject(
    String id, {
    String? name,
    String? emoji,
    String? description,
    String? contextNotes,
  }) async {
    final idx = _projects.indexWhere((p) => p.id == id);
    if (idx == -1) return;
    final p = _projects[idx];
    _projects[idx] = p.copyWith(
      name: name,
      emoji: emoji,
      description: description,
      contextNotes: contextNotes,
    );
    notifyListeners();
    await _save();
  }

  Future<void> deleteProject(String id) async {
    _projects.removeWhere((p) => p.id == id);
    notifyListeners();
    await _save();
  }

  Future<void> addConversation(String projectId, String conversationId) async {
    final idx = _projects.indexWhere((p) => p.id == projectId);
    if (idx == -1) return;
    final p = _projects[idx];
    if (!p.conversationIds.contains(conversationId)) {
      p.conversationIds.add(conversationId);
      p.updatedAt = DateTime.now();
      notifyListeners();
      await _save();
    }
  }

  Future<void> removeConversation(
      String projectId, String conversationId) async {
    final idx = _projects.indexWhere((p) => p.id == projectId);
    if (idx == -1) return;
    _projects[idx].conversationIds.remove(conversationId);
    _projects[idx].updatedAt = DateTime.now();
    notifyListeners();
    await _save();
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_kProjects);
    if (raw != null) {
      try {
        final list = jsonDecode(raw) as List<dynamic>;
        _projects.addAll(
          list.map((j) => ProjectSpace.fromJson(j as Map<String, dynamic>)),
        );
      } catch (_) {/* ignore corrupt data */}
    }
    notifyListeners();
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _kProjects,
      jsonEncode(_projects.map((p) => p.toJson()).toList()),
    );
  }
}
