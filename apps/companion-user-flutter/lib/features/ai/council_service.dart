import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';

// ═════════════════════════════════════════════════════════════════════════════
// A.5 — Council service for Flutter mobile.
// Wraps the gateway /v1/admin/council/* REST endpoints.
// ═════════════════════════════════════════════════════════════════════════════

/// Council configuration state.
class CouncilConfig {
  const CouncilConfig({
    this.councilMode = false,
    this.councilModels = const [],
    this.councilChairman,
    this.councilStrategy = 'weighted',
    this.councilRounds = 1,
  });

  final bool councilMode;
  final List<String> councilModels;
  final String? councilChairman;
  final String councilStrategy;
  final int councilRounds;

  factory CouncilConfig.fromJson(Map<String, dynamic> json) {
    return CouncilConfig(
      councilMode: json['council_mode'] == true,
      councilModels: (json['council_models'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      councilChairman: json['council_chairman'] as String?,
      councilStrategy:
          (json['council_strategy'] as String?) ?? 'weighted',
      councilRounds: (json['council_rounds'] as num?)?.toInt() ?? 1,
    );
  }
}

/// A single council session summary.
class CouncilSession {
  const CouncilSession({
    required this.id,
    required this.query,
    required this.status,
    this.synthesis,
    this.opinions = const [],
    this.peerReviews = const [],
    this.scores = const {},
    this.config = const {},
    this.totalTokensPrompt = 0,
    this.totalTokensCompletion = 0,
    this.totalCost = 0.0,
    this.elapsedMs = 0,
    this.createdAt,
    this.completedAt,
  });

  final String id;
  final String query;
  final String status;
  final String? synthesis;
  final List<dynamic> opinions;
  final List<dynamic> peerReviews;
  final Map<String, dynamic> scores;
  final Map<String, dynamic> config;
  final int totalTokensPrompt;
  final int totalTokensCompletion;
  final double totalCost;
  final int elapsedMs;
  final String? createdAt;
  final String? completedAt;

  factory CouncilSession.fromJson(Map<String, dynamic> json) {
    final tokens = json['totalTokens'] as Map<String, dynamic>? ?? {};
    return CouncilSession(
      id: json['id'] as String? ?? '',
      query: json['query'] as String? ?? '',
      status: json['status'] as String? ?? 'unknown',
      synthesis: json['synthesis'] as String?,
      opinions: json['opinions'] as List<dynamic>? ?? [],
      peerReviews: json['peerReviews'] as List<dynamic>? ?? [],
      scores: json['scores'] as Map<String, dynamic>? ?? {},
      config: json['config'] as Map<String, dynamic>? ?? {},
      totalTokensPrompt: (tokens['prompt'] as num?)?.toInt() ?? 0,
      totalTokensCompletion: (tokens['completion'] as num?)?.toInt() ?? 0,
      totalCost: (json['totalCost'] as num?)?.toDouble() ?? 0.0,
      elapsedMs: (json['elapsedMs'] as num?)?.toInt() ?? 0,
      createdAt: json['createdAt'] as String?,
      completedAt: json['completedAt'] as String?,
    );
  }
}

/// Flutter client for the gateway council admin API.
class CouncilService {
  CouncilService(this._client);

  final AuthenticatedClient _client;

  String get _base => ApiBaseService.currentSync();

  /// GET /v1/admin/council/config — read current council configuration.
  Future<CouncilConfig> getConfig() async {
    final r = await _client.get(
      Uri.parse('$_base/v1/admin/council/config'),
    );
    if (r.statusCode < 200 || r.statusCode >= 300) {
      throw Exception('Failed to fetch council config (${r.statusCode})');
    }
    final body = jsonDecode(r.body) as Map<String, dynamic>;
    final config = body['config'] as Map<String, dynamic>? ?? {};
    return CouncilConfig.fromJson(config);
  }

  /// PUT /v1/admin/council/config — toggle council mode on/off.
  Future<void> setEnabled(bool enabled) async {
    final r = await _client.putJson(
      Uri.parse('$_base/v1/admin/council/config'),
      {'enabled': enabled},
    );
    if (r.statusCode < 200 || r.statusCode >= 300) {
      throw Exception('Failed to update council config (${r.statusCode})');
    }
  }

  /// PUT /v1/admin/council/config — update full council configuration.
  Future<void> updateConfig({
    bool? enabled,
    List<String>? models,
    String? chairman,
    String? strategy,
    int? rounds,
  }) async {
    final body = <String, dynamic>{};
    if (enabled != null) body['enabled'] = enabled;
    if (models != null) body['models'] = models;
    if (chairman != null) body['chairman'] = chairman;
    if (strategy != null) body['strategy'] = strategy;
    if (rounds != null) body['rounds'] = rounds;

    final r = await _client.putJson(
      Uri.parse('$_base/v1/admin/council/config'),
      body,
    );
    if (r.statusCode < 200 || r.statusCode >= 300) {
      throw Exception('Failed to update council config (${r.statusCode})');
    }
  }

  /// GET /v1/admin/council/sessions — list council sessions.
  Future<List<CouncilSession>> listSessions({
    int limit = 20,
    int offset = 0,
  }) async {
    final uri = Uri.parse('$_base/v1/admin/council/sessions').replace(
      queryParameters: {
        'limit': limit.toString(),
        if (offset > 0) 'offset': offset.toString(),
      },
    );
    final r = await _client.get(uri);
    if (r.statusCode < 200 || r.statusCode >= 300) {
      throw Exception('Failed to list council sessions (${r.statusCode})');
    }
    final body = jsonDecode(r.body) as Map<String, dynamic>;
    final rows = body['sessions'] as List<dynamic>? ?? [];
    return rows
        .map((e) => CouncilSession.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// GET /v1/admin/council/sessions/:id — full session detail.
  Future<CouncilSession> getSession(String sessionId) async {
    final r = await _client.get(
      Uri.parse('$_base/v1/admin/council/sessions/$sessionId'),
    );
    if (r.statusCode < 200 || r.statusCode >= 300) {
      throw Exception('Failed to fetch council session (${r.statusCode})');
    }
    final body = jsonDecode(r.body) as Map<String, dynamic>;
    return CouncilSession.fromJson(body);
  }

  /// POST /v1/admin/council/deliberate — trigger an ad-hoc deliberation.
  Future<String> deliberate(String query) async {
    final r = await _client.postJson(
      Uri.parse('$_base/v1/admin/council/deliberate'),
      {'query': query},
    );
    if (r.statusCode < 200 || r.statusCode >= 300) {
      throw Exception('Failed to start deliberation (${r.statusCode})');
    }
    final body = jsonDecode(r.body) as Map<String, dynamic>;
    return body['sessionId'] as String? ?? '';
  }
}
