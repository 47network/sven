import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';
import 'chat_models.dart';

/// Parsed SSE event from the gateway /v1/stream endpoint.
class SseEvent {
  final String
      type; // 'message' | 'approval' | 'agent.paused' | 'agent.resumed' | 'heartbeat'
  final Map<String, dynamic>? data;

  const SseEvent({required this.type, this.data});
}

/// Connects to `GET /v1/stream` and emits real-time [SseEvent]s.
///
/// Automatically reconnects on network errors with exponential backoff.
/// Stops when [dispose] is called.
class ChatSseService {
  ChatSseService({required AuthenticatedClient client}) : _client = client;

  static String get _apiBase => ApiBaseService.currentSync();

  final AuthenticatedClient _client;
  final _controller = StreamController<SseEvent>.broadcast();
  bool _disposed = false;
  int _retryDelayMs = 1000;

  /// Broadcast stream of [SseEvent]s.
  Stream<SseEvent> get events => _controller.stream;

  /// Start listening. Call [dispose] to stop.
  void connect() {
    _connectLoop();
  }

  Future<void> _connectLoop() async {
    while (!_disposed) {
      try {
        await _openSse();
        // If we got here cleanly, reset backoff.
        _retryDelayMs = 1000;
      } catch (_) {
        if (_disposed) break;
      }
      if (_disposed) break;
      // Exponential backoff capped at 30s.
      await Future<void>.delayed(Duration(milliseconds: _retryDelayMs));
      _retryDelayMs = (_retryDelayMs * 2).clamp(1000, 30000);
    }
  }

  Future<void> _openSse() async {
    final uri = Uri.parse('$_apiBase/v1/stream');
    if (_disposed) return;

    final request = http.Request('GET', uri)
      ..headers['Accept'] = 'text/event-stream'
      ..headers['Cache-Control'] = 'no-cache';

    final streamedResponse = await _client.sendStreamed(request);
    if (streamedResponse.statusCode != 200) {
      throw Exception('SSE connect failed: ${streamedResponse.statusCode}');
    }

    final decoder = const Utf8Decoder(allowMalformed: true);
    String buffer = '';
    String eventType = 'message';

    await for (final chunk in streamedResponse.stream.transform(decoder)) {
      if (_disposed) break;

      buffer += chunk;

      // SSE messages are delimited by double newlines.
      while (buffer.contains('\n\n')) {
        final idx = buffer.indexOf('\n\n');
        final raw = buffer.substring(0, idx).trim();
        buffer = buffer.substring(idx + 2);

        if (raw.isEmpty || raw.startsWith(':')) {
          // Heartbeat or comment
          if (!_controller.isClosed) {
            _controller.add(const SseEvent(type: 'heartbeat'));
          }
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
            _controller.add(SseEvent(type: eventType, data: parsed));
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

/// Converts an SSE `message` event payload to a [ChatMessage].
ChatMessage? chatMessageFromSse(Map<String, dynamic> data) {
  try {
    return ChatMessage.fromJson(data);
  } catch (_) {
    return null;
  }
}
