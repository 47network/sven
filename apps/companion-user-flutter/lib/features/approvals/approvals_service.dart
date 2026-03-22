import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../app/telemetry.dart';
import '../../config/env_config.dart';
import '../auth/auth_errors.dart';
import 'approvals_models.dart';

class ApprovalsService {
  ApprovalsService({AuthenticatedClient? client})
      : _client = client ?? AuthenticatedClient();

  static final _apiBase = EnvConfig.apiBase;

  final AuthenticatedClient _client;

  Future<List<ApprovalItem>> list({String? status}) async {
    final query = status == null ? '' : '?status=$status';
    final uri = Uri.parse('$_apiBase/v1/approvals$query');
    try {
      final response = await _client.get(uri);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AuthException(AuthFailure.server);
      }
      final body = jsonDecode(response.body);
      if (body is! Map<String, dynamic>) return [];
      final rows = body['data']?['rows'];
      if (rows is! List) return [];
      return rows
          .whereType<Map>()
          .map((row) => ApprovalItem.fromJson(Map<String, dynamic>.from(row)))
          .toList();
    } on AuthException {
      rethrow;
    }
  }

  Future<void> vote({required String id, required String decision}) async {
    final uri = Uri.parse('$_apiBase/v1/approvals/$id/vote');
    try {
      final response = await _client.postJson(uri, {'decision': decision});
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AuthException(AuthFailure.server);
      }
      Telemetry.logEvent('approvals.vote', {
        'approval_id': id,
        'decision': decision,
      });
    } on AuthException {
      rethrow;
    }
  }
}
