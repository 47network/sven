// ═══════════════════════════════════════════════════════════════════════════
// TradingCache — Offline cache for trading data.
//
// Persists the most recent API responses to SharedPreferences so the
// dashboard can show stale-but-useful data while offline. Each entry
// includes a timestamp so the UI can display "last updated N min ago".
// ═══════════════════════════════════════════════════════════════════════════

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'trading_models.dart';

class TradingCache {
  static const _keyStatus = 'trading_cache_status';
  static const _keyMessages = 'trading_cache_messages';
  static const _keyTrades = 'trading_cache_trades';
  static const _keyStatusAt = 'trading_cache_status_at';
  static const _keyMessagesAt = 'trading_cache_messages_at';
  static const _keyTradesAt = 'trading_cache_trades_at';

  /// When the status was last cached.
  DateTime? statusCachedAt;

  /// When messages were last cached.
  DateTime? messagesCachedAt;

  /// When trades were last cached.
  DateTime? tradesCachedAt;

  // ── Write ──────────────────────────────────────────────────────────────

  Future<void> cacheStatus(Map<String, dynamic> json) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final now = DateTime.now().toUtc().toIso8601String();
      await prefs.setString(_keyStatus, jsonEncode(json));
      await prefs.setString(_keyStatusAt, now);
      statusCachedAt = DateTime.now();
    } catch (e) {
      debugPrint('[TradingCache] cacheStatus error: $e');
    }
  }

  Future<void> cacheMessages(List<dynamic> jsonList) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final now = DateTime.now().toUtc().toIso8601String();
      await prefs.setString(_keyMessages, jsonEncode(jsonList));
      await prefs.setString(_keyMessagesAt, now);
      messagesCachedAt = DateTime.now();
    } catch (e) {
      debugPrint('[TradingCache] cacheMessages error: $e');
    }
  }

  Future<void> cacheTrades(List<dynamic> jsonList) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final now = DateTime.now().toUtc().toIso8601String();
      await prefs.setString(_keyTrades, jsonEncode(jsonList));
      await prefs.setString(_keyTradesAt, now);
      tradesCachedAt = DateTime.now();
    } catch (e) {
      debugPrint('[TradingCache] cacheTrades error: $e');
    }
  }

  // ── Read ───────────────────────────────────────────────────────────────

  Future<TradingStatus?> loadStatus() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_keyStatus);
      final at = prefs.getString(_keyStatusAt);
      if (raw == null) return null;
      statusCachedAt = at != null ? DateTime.tryParse(at)?.toLocal() : null;
      final json = jsonDecode(raw) as Map<String, dynamic>;
      return TradingStatus.fromJson(json);
    } catch (e) {
      debugPrint('[TradingCache] loadStatus error: $e');
      return null;
    }
  }

  Future<List<SvenMessage>> loadMessages() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_keyMessages);
      final at = prefs.getString(_keyMessagesAt);
      if (raw == null) return [];
      messagesCachedAt = at != null ? DateTime.tryParse(at)?.toLocal() : null;
      final list = jsonDecode(raw) as List<dynamic>;
      return list
          .map((e) => SvenMessage.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (e) {
      debugPrint('[TradingCache] loadMessages error: $e');
      return [];
    }
  }

  Future<List<SvenTrade>> loadTrades() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_keyTrades);
      final at = prefs.getString(_keyTradesAt);
      if (raw == null) return [];
      tradesCachedAt = at != null ? DateTime.tryParse(at)?.toLocal() : null;
      final list = jsonDecode(raw) as List<dynamic>;
      return list
          .map((e) => SvenTrade.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (e) {
      debugPrint('[TradingCache] loadTrades error: $e');
      return [];
    }
  }

  /// Load all cached data at once. Returns true if any data was loaded.
  Future<bool> loadAll(
    void Function(TradingStatus?) onStatus,
    void Function(List<SvenMessage>) onMessages,
    void Function(List<SvenTrade>) onTrades,
  ) async {
    final results = await Future.wait([
      loadStatus(),
      loadMessages(),
      loadTrades(),
    ]);
    final status = results[0] as TradingStatus?;
    final messages = results[1] as List<SvenMessage>;
    final trades = results[2] as List<SvenTrade>;
    onStatus(status);
    onMessages(messages);
    onTrades(trades);
    return status != null || messages.isNotEmpty || trades.isNotEmpty;
  }

  /// Format a cache timestamp as a relative string.
  static String formatCacheAge(DateTime? cachedAt) {
    if (cachedAt == null) return '';
    final diff = DateTime.now().difference(cachedAt);
    if (diff.inSeconds < 60) return 'Updated just now';
    if (diff.inMinutes < 60) return 'Updated ${diff.inMinutes}m ago';
    if (diff.inHours < 24) return 'Updated ${diff.inHours}h ago';
    return 'Updated ${diff.inDays}d ago';
  }
}
