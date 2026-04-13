// ═══════════════════════════════════════════════════════════════════════════
// TradingService — API client for the Sven Trading Platform.
//
// Connects to trading.sven.systems (production) or the dev equivalent.
// All GET endpoints are public (no auth required for dashboard/guest view).
// POST/PUT endpoints require authentication (Bearer token).
//
// Features: offline caching via TradingCache, connectivity awareness,
// positions API, price alerts API.
// ═══════════════════════════════════════════════════════════════════════════

import 'dart:convert';
import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../../app/authenticated_client.dart';
import '../../config/env_config.dart';
import 'trading_cache.dart';
import 'trading_models.dart';

class TradingService extends ChangeNotifier {
  TradingService({required AuthenticatedClient client}) : _client = client {
    _connectivitySub = Connectivity()
        .onConnectivityChanged
        .listen(_onConnectivityChanged);
  }

  final AuthenticatedClient _client;
  final TradingCache cache = TradingCache();
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;

  /// Trading API base URL — separate subdomain from the main gateway.
  static String get _tradingBase {
    if (EnvConfig.isDev) return 'http://192.168.10.172:3004';
    if (EnvConfig.isStaging) return 'https://trading-staging.sven.systems';
    return 'https://trading.sven.systems';
  }

  // ── Cached state ────────────────────────────────────────────────────────

  TradingStatus? _status;
  TradingStatus? get status => _status;

  List<SvenMessage> _messages = [];
  List<SvenMessage> get messages => _messages;

  List<SvenTrade> _trades = [];
  List<SvenTrade> get trades => _trades;

  List<Position> _positions = [];
  List<Position> get positions => _positions;

  List<PriceAlert> _alerts = [];
  List<PriceAlert> get alerts => _alerts;

  bool _loading = false;
  bool get loading => _loading;

  String? _error;
  String? get error => _error;

  bool _offline = false;
  bool get offline => _offline;

  bool _fromCache = false;
  bool get fromCache => _fromCache;

  // ── Connectivity ───────────────────────────────────────────────────────

  void _onConnectivityChanged(List<ConnectivityResult> results) {
    final wasOffline = _offline;
    _offline = results.every((r) => r == ConnectivityResult.none);
    if (wasOffline && !_offline) {
      // Back online — refresh everything.
      refreshAll();
    }
    notifyListeners();
  }

  /// Load cached data from SharedPreferences. Call once at startup.
  Future<void> loadFromCache() async {
    final hadData = await cache.loadAll(
      (s) => _status ??= s,
      (m) {
        if (_messages.isEmpty) _messages = m;
      },
      (t) {
        if (_trades.isEmpty) _trades = t;
      },
    );
    if (hadData) {
      _fromCache = true;
      notifyListeners();
    }
  }

  // ── Public API: fetchers ────────────────────────────────────────────────

  /// Fetch Sven's current trading status (public — no auth).
  Future<void> fetchStatus() async {
    _setLoading(true);
    try {
      final resp = await _get('/v1/trading/sven/status');
      if (resp != null) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        if (body['success'] == true && body['data'] != null) {
          final data = body['data'] as Map<String, dynamic>;
          _status = TradingStatus.fromJson(data);
          _error = null;
          _fromCache = false;
          notifyListeners();
          unawaited(cache.cacheStatus(data));
        }
      }
    } catch (e) {
      _error = 'Failed to fetch status: $e';
      notifyListeners();
    } finally {
      _setLoading(false);
    }
  }

  /// Fetch Sven's proactive messages (public — no auth).
  Future<void> fetchMessages() async {
    try {
      final resp = await _get('/v1/trading/sven/messages');
      if (resp != null) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        if (body['success'] == true && body['data'] != null) {
          final list = body['data'] as List<dynamic>;
          _messages =
              list.map((e) => SvenMessage.fromJson(e as Map<String, dynamic>)).toList();
          _error = null;
          _fromCache = false;
          notifyListeners();
          unawaited(cache.cacheMessages(list));
        }
      }
    } catch (e) {
      _error = 'Failed to fetch messages: $e';
      notifyListeners();
    }
  }

  /// Fetch Sven's executed trades (public — no auth).
  Future<void> fetchTrades() async {
    try {
      final resp = await _get('/v1/trading/sven/trades');
      if (resp != null) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        if (body['success'] == true && body['data'] != null) {
          final data = body['data'] as Map<String, dynamic>;
          final list = data['trades'] as List<dynamic>? ?? [];
          _trades =
              list.map((e) => SvenTrade.fromJson(e as Map<String, dynamic>)).toList();
          _error = null;
          _fromCache = false;
          notifyListeners();
          unawaited(cache.cacheTrades(list));
        }
      }
    } catch (e) {
      _error = 'Failed to fetch trades: $e';
      notifyListeners();
    }
  }

  /// Fetch open positions (public — no auth).
  Future<void> fetchPositions() async {
    try {
      final resp = await _get('/v1/trading/positions');
      if (resp != null) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        if (body['success'] == true && body['data'] != null) {
          final list = body['data'] as List<dynamic>;
          _positions =
              list.map((e) => Position.fromJson(e as Map<String, dynamic>)).toList();
          notifyListeners();
        }
      }
    } catch (e) {
      debugPrint('[TradingService] fetchPositions failed: $e');
    }
  }

  /// Fetch price alerts (requires auth).
  Future<void> fetchAlerts() async {
    try {
      final resp = await _get('/v1/trading/alerts');
      if (resp != null) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        if (body['success'] == true && body['data'] != null) {
          final list = body['data'] as List<dynamic>;
          _alerts =
              list.map((e) => PriceAlert.fromJson(e as Map<String, dynamic>)).toList();
          notifyListeners();
        }
      }
    } catch (e) {
      debugPrint('[TradingService] fetchAlerts failed: $e');
    }
  }

  /// Refresh all trading data in parallel.
  Future<void> refreshAll() async {
    await Future.wait([
      fetchStatus(),
      fetchMessages(),
      fetchTrades(),
      fetchPositions(),
    ]);
  }

  // ── Public API: authenticated actions ───────────────────────────────────

  /// Configure auto-trade settings (requires auth).
  Future<bool> configureAutoTrade({
    bool? enabled,
    double? confidenceThreshold,
    double? maxPositionPct,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (enabled != null) body['enabled'] = enabled;
      if (confidenceThreshold != null) {
        body['confidenceThreshold'] = confidenceThreshold;
      }
      if (maxPositionPct != null) body['maxPositionPct'] = maxPositionPct;

      debugPrint('[TradingService] configureAutoTrade → POST $_tradingBase/v1/trading/sven/auto-trade/config body=$body');
      final resp = await _postJson('/v1/trading/sven/auto-trade/config', body);
      debugPrint('[TradingService] configureAutoTrade ← status=${resp?.statusCode} body=${resp?.body?.substring(0, (resp?.body?.length ?? 0).clamp(0, 200))}');
      if (resp != null && resp.statusCode == 200) {
        await fetchStatus();
        return true;
      }
      _error = 'Auto-trade config failed: HTTP ${resp?.statusCode ?? 'null'}';
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Failed to configure auto-trade: $e';
      debugPrint('[TradingService] configureAutoTrade exception: $e');
      notifyListeners();
      return false;
    }
  }

  /// Send a message as Sven (requires auth).
  Future<bool> sendMessage({
    required String title,
    required String body,
    String type = 'system',
    String severity = 'info',
    String? symbol,
  }) async {
    try {
      final payload = <String, dynamic>{
        'title': title,
        'body': body,
        'type': type,
        'severity': severity,
        if (symbol != null) 'symbol': symbol,
      };
      final resp = await _postJson('/v1/trading/sven/messages/send', payload);
      if (resp != null && resp.statusCode == 200) {
        await fetchMessages();
        return true;
      }
      return false;
    } catch (e) {
      _error = 'Failed to send message: $e';
      notifyListeners();
      return false;
    }
  }

  /// Schedule a future message from Sven (requires auth).
  Future<bool> scheduleMessage({
    required String title,
    required String body,
    required DateTime scheduledAt,
    String type = 'scheduled',
    String severity = 'info',
    String? symbol,
  }) async {
    try {
      final payload = <String, dynamic>{
        'title': title,
        'body': body,
        'type': type,
        'severity': severity,
        'scheduledAt': scheduledAt.toUtc().toIso8601String(),
        if (symbol != null) 'symbol': symbol,
      };
      final resp = await _postJson('/v1/trading/sven/messages/schedule', payload);
      if (resp != null && resp.statusCode == 200) {
        await fetchMessages();
        return true;
      }
      return false;
    } catch (e) {
      _error = 'Failed to schedule message: $e';
      notifyListeners();
      return false;
    }
  }

  /// Create a price alert (requires auth).
  Future<bool> createAlert({
    required String symbol,
    required double targetPrice,
    required String direction,
  }) async {
    try {
      final payload = <String, dynamic>{
        'symbol': symbol,
        'targetPrice': targetPrice,
        'direction': direction,
      };
      final resp = await _postJson('/v1/trading/alerts', payload);
      if (resp != null && resp.statusCode == 200) {
        await fetchAlerts();
        return true;
      }
      return false;
    } catch (e) {
      _error = 'Failed to create alert: $e';
      notifyListeners();
      return false;
    }
  }

  /// Delete a price alert (requires auth).
  Future<bool> deleteAlert(String id) async {
    try {
      final uri = Uri.parse('$_tradingBase/v1/trading/alerts/$id');
      final resp = await _client.delete(uri);
      if (resp.statusCode == 200) {
        _alerts.removeWhere((a) => a.id == id);
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      _error = 'Failed to delete alert: $e';
      notifyListeners();
      return false;
    }
  }

  // ── Internals ──────────────────────────────────────────────────────────

  Future<http.Response?> _get(String path) async {
    try {
      final uri = Uri.parse('$_tradingBase$path');
      return await _client.get(uri);
    } catch (e) {
      debugPrint('[TradingService] GET $path failed: $e');
      return null;
    }
  }

  Future<http.Response?> _postJson(
    String path,
    Map<String, dynamic> body,
  ) async {
    try {
      final uri = Uri.parse('$_tradingBase$path');
      return await _client.postJson(uri, body);
    } catch (e) {
      debugPrint('[TradingService] POST $path failed: $e');
      return null;
    }
  }

  void _setLoading(bool v) {
    if (_loading != v) {
      _loading = v;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _connectivitySub?.cancel();
    super.dispose();
  }
}
