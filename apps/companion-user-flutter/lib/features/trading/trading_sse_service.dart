// ═══════════════════════════════════════════════════════════════════════════
// TradingSseService — Real-time SSE connection to the Trading Platform.
//
// Mirrors the pattern in chat_sse_service.dart: exponential backoff
// reconnect, broadcast stream, graceful dispose.
//
// Connects to GET /api/sven/events (public — no auth required).
// ═══════════════════════════════════════════════════════════════════════════

import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../app/authenticated_client.dart';
import '../../config/env_config.dart';
import 'trading_models.dart';

class TradingSseService {
  TradingSseService({required AuthenticatedClient client}) : _client = client;

  /// Use the main gateway — trading routes live on gateway-api.
  static String get _tradingBase => EnvConfig.apiBase;

  final AuthenticatedClient _client;
  final _controller = StreamController<TradingEvent>.broadcast();
  bool _disposed = false;
  int _retryDelayMs = 1000;

  /// Broadcast stream of live [TradingEvent]s.
  Stream<TradingEvent> get events => _controller.stream;

  /// Start listening. Call [dispose] to stop.
  void connect() {
    _connectLoop();
  }

  Future<void> _connectLoop() async {
    while (!_disposed) {
      try {
        await _openSse();
        _retryDelayMs = 1000;
      } catch (_) {
        if (_disposed) break;
      }
      if (_disposed) break;
      // Exponential backoff capped at 30 s.
      await Future<void>.delayed(Duration(milliseconds: _retryDelayMs));
      _retryDelayMs = (_retryDelayMs * 2).clamp(1000, 30000);
    }
  }

  Future<void> _openSse() async {
    final uri = Uri.parse('$_tradingBase/v1/trading/events');
    if (_disposed) return;

    final request = http.Request('GET', uri)
      ..headers['Accept'] = 'text/event-stream'
      ..headers['Cache-Control'] = 'no-cache';

    final streamedResponse = await _client.sendStreamed(request);
    if (streamedResponse.statusCode != 200) {
      throw Exception(
          'Trading SSE connect failed: ${streamedResponse.statusCode}');
    }

    const decoder = Utf8Decoder(allowMalformed: true);
    String buffer = '';
    String eventType = 'message';

    await for (final chunk in streamedResponse.stream.transform(decoder)) {
      if (_disposed) break;

      buffer += chunk;

      while (buffer.contains('\n\n')) {
        final idx = buffer.indexOf('\n\n');
        final raw = buffer.substring(0, idx).trim();
        buffer = buffer.substring(idx + 2);

        if (raw.isEmpty || raw.startsWith(':')) {
          eventType = 'message';
          continue;
        }

        String? dataLine;
        for (final line in raw.split('\n')) {
          if (line.startsWith('event:')) {
            eventType = line.substring(6).trim();
          } else if (line.startsWith('data:')) {
            dataLine = line.substring(5).trim();
          }
        }

        if (dataLine != null && !_controller.isClosed) {
          try {
            final parsed = jsonDecode(dataLine) as Map<String, dynamic>;
            _controller.add(TradingEvent(
              id: parsed['id'] as String? ?? '',
              type: eventType,
              timestamp: DateTime.tryParse(
                      parsed['timestamp'] as String? ?? '') ??
                  DateTime.now(),
              data: parsed,
            ));
          } catch (_) {
            // Ignore malformed events.
          }
        }
        eventType = 'message';
      }
    }
  }

  /// Stop the SSE connection and close the stream.
  void dispose() {
    _disposed = true;
    _controller.close();
  }
}
