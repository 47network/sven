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

  /// Trading API base URL — same as the main gateway (trading routes
  /// are served by gateway-api, not a separate service).
  static String get _tradingBase => EnvConfig.apiBase;

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

  /// Fetch Sven's current trading status.
  /// Tries the admin endpoint first (authenticated). If that returns 401/403,
  /// falls back to the public-status endpoint (no auth) so guests still see
  /// live balance, P&L, positions, etc.
  Future<void> fetchStatus() async {
    _setLoading(true);
    try {
      final resp = await _get('/v1/trading/sven/status');
      if (resp != null && resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        if (body['success'] == true && body['data'] != null) {
          final data = body['data'] as Map<String, dynamic>;
          _status = TradingStatus.fromJson(data);
          _error = null;
          _fromCache = false;
          notifyListeners();
          unawaited(cache.cacheStatus(data));
          return;
        }
      }
      // Admin endpoint failed (401/403/null) — try public fallback
      await _fetchPublicStatus();
    } catch (e) {
      // Network error — try public fallback before giving up
      try {
        await _fetchPublicStatus();
      } catch (_) {
        _error = 'Failed to fetch status: $e';
        notifyListeners();
      }
    } finally {
      _setLoading(false);
    }
  }

  /// Fetch from the public-status endpoint (no auth required).
  /// Returns a subset of trading data safe for guest visitors.
  Future<void> _fetchPublicStatus() async {
    final resp = await _get('/v1/trading/sven/public-status');
    if (resp != null && resp.statusCode == 200) {
      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      if (body['success'] == true && body['data'] != null) {
        final data = body['data'] as Map<String, dynamic>;
        _status = TradingStatus.fromPublicJson(data);
        _error = null;
        _fromCache = false;
        notifyListeners();
        unawaited(cache.cacheStatus(data));
      }
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

  List<NewsArticle> _news = [];
  List<NewsArticle> get news => _news;

  /// Fetch news articles from the aggregator (public — no auth).
  Future<void> fetchNews() async {
    try {
      final resp = await _get('/v1/trading/news');
      if (resp != null) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        if (body['success'] == true && body['data'] != null) {
          final list = body['data'] as List<dynamic>;
          _news = list
              .map((e) =>
                  NewsArticle.fromJson(e as Map<String, dynamic>))
              .toList();
          notifyListeners();
        }
      }
    } catch (e) {
      debugPrint('[TradingService] fetchNews failed: $e');
    }
  }

  /// Refresh all trading data in parallel.
  Future<void> refreshAll() async {
    await Future.wait([
      fetchStatus(),
      fetchMessages(),
      fetchTrades(),
      fetchPositions(),
      fetchNews(),
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
      final respBody = resp?.body;
      debugPrint('[TradingService] configureAutoTrade ← status=${resp?.statusCode} body=${respBody?.substring(0, (respBody.length).clamp(0, 200))}');
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

  // ── Backtest API (Batch 12A) ────────────────────────────────────────────

  List<BacktestStrategy> _backtestStrategies = [];
  List<BacktestStrategy> get backtestStrategies => _backtestStrategies;

  BacktestResult? _lastBacktestResult;
  BacktestResult? get lastBacktestResult => _lastBacktestResult;

  bool _backtestRunning = false;
  bool get backtestRunning => _backtestRunning;

  /// Fetch available backtest strategies.
  Future<void> fetchBacktestStrategies() async {
    try {
      final resp = await _get('/v1/trading/backtest/strategies');
      if (resp != null && resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        if (body['success'] == true && body['data'] != null) {
          final list = body['data'] as List<dynamic>;
          _backtestStrategies = list
              .map((e) =>
                  BacktestStrategy.fromJson(e as Map<String, dynamic>))
              .toList();
          notifyListeners();
        }
      }
    } catch (e) {
      debugPrint('[TradingService] fetchBacktestStrategies failed: $e');
    }
  }

  /// Run a backtest with auto-fetched Binance historical candles (Batch 12A).
  Future<BacktestResult?> runBacktestAuto({
    required String strategy,
    String symbol = 'BTC/USDT',
    String timeframe = '1h',
    int bars = 1000,
    double initialCapital = 100000,
  }) async {
    _backtestRunning = true;
    _lastBacktestResult = null;
    notifyListeners();
    try {
      final payload = <String, dynamic>{
        'strategy': strategy,
        'symbol': symbol,
        'timeframe': timeframe,
        'bars': bars,
        'initialCapital': initialCapital,
      };
      final resp =
          await _postJson('/v1/trading/backtest/run-auto', payload);
      if (resp != null && resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        if (body['success'] == true && body['data'] != null) {
          final data = body['data'] as Map<String, dynamic>;
          _lastBacktestResult = BacktestResult.fromJson(data);
          notifyListeners();
          return _lastBacktestResult;
        }
      }
      _error = 'Backtest failed: HTTP ${resp?.statusCode ?? 'null'}';
      notifyListeners();
      return null;
    } catch (e) {
      _error = 'Backtest failed: $e';
      notifyListeners();
      return null;
    } finally {
      _backtestRunning = false;
      notifyListeners();
    }
  }

  // ── Exchange Credentials API (Batch 12D) ────────────────────────────────

  List<ExchangeCredential> _exchangeCredentials = [];
  List<ExchangeCredential> get exchangeCredentials => _exchangeCredentials;

  /// Fetch exchange credentials (masked keys) for admin.
  Future<void> fetchExchangeCredentials() async {
    try {
      final resp =
          await _get('/v1/admin/trading/exchange-credentials');
      if (resp != null && resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        if (body['success'] == true && body['data'] != null) {
          final list = body['data'] as List<dynamic>;
          _exchangeCredentials = list
              .map((e) => ExchangeCredential.fromJson(
                  e as Map<String, dynamic>))
              .toList();
          notifyListeners();
        }
      }
    } catch (e) {
      debugPrint('[TradingService] fetchExchangeCredentials failed: $e');
    }
  }

  /// Add or update exchange credentials (requires admin auth).
  Future<bool> addExchangeCredential({
    required String broker,
    required String apiKey,
    required String apiSecret,
    bool isPaper = true,
    String? label,
  }) async {
    try {
      final payload = <String, dynamic>{
        'broker': broker,
        'apiKey': apiKey,
        'apiSecret': apiSecret,
        'isPaper': isPaper,
        if (label != null) 'label': label,
      };
      final resp = await _postJson(
          '/v1/admin/trading/exchange-credentials', payload);
      if (resp != null && resp.statusCode == 200) {
        await fetchExchangeCredentials();
        return true;
      }
      _error = 'Failed to add credential: HTTP ${resp?.statusCode ?? 'null'}';
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Failed to add credential: $e';
      notifyListeners();
      return false;
    }
  }

  /// Revoke an exchange credential (requires admin auth).
  Future<bool> revokeExchangeCredential(String id) async {
    try {
      final uri = Uri.parse(
          '$_tradingBase/v1/admin/trading/exchange-credentials/$id');
      final resp = await _client.delete(uri);
      if (resp.statusCode == 200) {
        _exchangeCredentials.removeWhere((c) => c.id == id);
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      _error = 'Failed to revoke credential: $e';
      notifyListeners();
      return false;
    }
  }

  // ── Broker Health API (Batch 12C) ───────────────────────────────────────

  List<BrokerHealth> _brokerList = [];
  List<BrokerHealth> get brokerList => _brokerList;

  /// Fetch registered brokers and their status.
  Future<void> fetchBrokerList() async {
    try {
      final resp = await _get('/v1/trading/broker/list');
      if (resp != null && resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        if (body['success'] == true && body['data'] != null) {
          final data = body['data'] as Map<String, dynamic>;
          final brokers = data['brokers'] as List<dynamic>? ?? [];
          _brokerList = brokers
              .map((e) =>
                  BrokerHealth.fromJson(e as Map<String, dynamic>))
              .toList();
          notifyListeners();
        }
      }
    } catch (e) {
      debugPrint('[TradingService] fetchBrokerList failed: $e');
    }
  }

  /// Connect a broker with credentials (requires admin auth).
  Future<bool> connectBroker({
    required String broker,
    required String apiKey,
    required String apiSecret,
    bool isPaper = true,
  }) async {
    try {
      final payload = <String, dynamic>{
        'broker': broker,
        'credentials': {
          'apiKey': apiKey,
          'apiSecret': apiSecret,
          'isPaper': isPaper,
        },
      };
      final resp =
          await _postJson('/v1/trading/broker/connect', payload);
      if (resp != null && resp.statusCode == 200) {
        await fetchBrokerList();
        return true;
      }
      _error = 'Broker connect failed: HTTP ${resp?.statusCode ?? 'null'}';
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Broker connect failed: $e';
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
