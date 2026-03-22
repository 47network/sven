// ═══════════════════════════════════════════════════════════════════════════
// DeploymentService — fetches & caches the deployment mode from the
// gateway's /v1/config/deployment endpoint.
//
// Two modes:
//   • personal   — single user, auto-login after first setup
//   • multi_user — login required, per-user isolation, admin can manage
// ═══════════════════════════════════════════════════════════════════════════

import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../../app/api_base_service.dart';

/// The two operational modes of a Sven deployment.
enum DeploymentMode {
  personal,
  multiUser;

  String get apiValue => switch (this) {
        DeploymentMode.personal => 'personal',
        DeploymentMode.multiUser => 'multi_user',
      };

  static DeploymentMode fromApi(String? value) => switch (value) {
        'personal' => DeploymentMode.personal,
        'multi_user' => DeploymentMode.multiUser,
        _ => DeploymentMode.multiUser,
      };
}

/// Snapshot of the deployment configuration returned by the server.
class DeploymentConfig {
  const DeploymentConfig({
    required this.mode,
    required this.setupComplete,
    required this.userCount,
  });

  final DeploymentMode mode;

  /// True if at least one user has been created.
  final bool setupComplete;

  /// Number of users in this Sven instance.
  final int userCount;

  factory DeploymentConfig.fromJson(Map<String, dynamic> json) =>
      DeploymentConfig(
        mode: DeploymentMode.fromApi(json['mode'] as String?),
        setupComplete: json['setup_complete'] as bool? ?? false,
        userCount: json['user_count'] as int? ?? 0,
      );

  /// Default config used when the server is unreachable (offline fallback).
  static const fallback = DeploymentConfig(
    mode: DeploymentMode.multiUser,
    setupComplete: true,
    userCount: 1,
  );
}

/// Service that fetches the deployment configuration from the gateway.
///
/// Caches the last-known config in SharedPreferences so the app can
/// render the correct flow even when offline.
class DeploymentService {
  DeploymentService({http.Client? client}) : _client = client ?? http.Client();

  static String get _apiBase => ApiBaseService.currentSync();

  static const _cacheKey = 'sven.deployment.config';

  final http.Client _client;

  /// Fetch the deployment config from the server.
  /// Falls back to cached config or [DeploymentConfig.fallback].
  Future<DeploymentConfig> fetch() async {
    try {
      final uri = Uri.parse('$_apiBase/v1/config/deployment');
      final response =
          await _client.get(uri).timeout(const Duration(seconds: 5));

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final data = body['data'] as Map<String, dynamic>?;
        if (data != null) {
          final config = DeploymentConfig.fromJson(data);
          await _cache(response.body);
          return config;
        }
      }
    } on SocketException catch (_) {
      debugPrint('DeploymentService: network error — using cache');
    } catch (e) {
      debugPrint('DeploymentService: $e — using cache');
    }

    // Fall back to cached
    return _readCache();
  }

  /// Call the one-time setup endpoint.
  /// Returns the created user info on success, throws on failure.
  Future<Map<String, dynamic>> setup({
    required DeploymentMode mode,
    required String username,
    required String password,
    String? displayName,
  }) async {
    final uri = Uri.parse('$_apiBase/v1/config/deployment/setup');
    final response = await _client.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'mode': mode.apiValue,
        'username': username,
        'password': password,
        if (displayName != null) 'display_name': displayName,
      }),
    );

    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body['data'] as Map<String, dynamic>? ?? {};
    }

    final error = body['error'] as Map<String, dynamic>?;
    throw Exception(error?['message'] ?? 'Setup failed');
  }

  Future<void> _cache(String raw) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_cacheKey, raw);
  }

  Future<DeploymentConfig> _readCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_cacheKey);
      if (raw != null) {
        final body = jsonDecode(raw) as Map<String, dynamic>;
        final data = body['data'] as Map<String, dynamic>?;
        if (data != null) return DeploymentConfig.fromJson(data);
      }
    } catch (_) {}
    return DeploymentConfig.fallback;
  }
}
