import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' show ClientException;
import 'package:image_picker/image_picker.dart';
import 'package:retry/retry.dart';

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';
import '../home_widget/home_widget_service.dart';
import 'chat_models.dart';
import 'messages_repository.dart';

// ───────────────────────────────────────────────────────────────────────────
// Response cache — avoids re-fetching identical prompts within a session
// LRU with a 20-item cap and 10-minute per-entry TTL.
// ───────────────────────────────────────────────────────────────────────────

typedef _CachedEntry = ({ChatMessage msg, DateTime at});

class _ResponseCache {
  static const _maxSize = 20;
  static const _ttl = Duration(minutes: 10);

  final _store = <String, _CachedEntry>{};

  String _key(
    String chatId,
    String text,
    String mode,
    String personality,
    String responseLength,
  ) =>
      '$chatId|$mode|$personality|$responseLength|$text';

  ChatMessage? get(
    String chatId,
    String text,
    String mode,
    String personality,
    String responseLength,
  ) {
    final k = _key(chatId, text, mode, personality, responseLength);
    final entry = _store[k];
    if (entry == null) return null;
    if (DateTime.now().difference(entry.at) > _ttl) {
      _store.remove(k);
      return null;
    }
    // Promote to end (LRU)
    _store.remove(k);
    _store[k] = entry;
    return entry.msg;
  }

  void put(
    String chatId,
    String text,
    String mode,
    String personality,
    String responseLength,
    ChatMessage msg,
  ) {
    final k = _key(chatId, text, mode, personality, responseLength);
    if (_store.length >= _maxSize) _store.remove(_store.keys.first);
    _store[k] = (msg: msg, at: DateTime.now());
  }

  void clear() => _store.clear();
}

/// Retry options used for all non-streaming API calls.
/// Retries up to 3 times with exponential backoff (1s, 2s, 4s).
const _retryOptions = RetryOptions(
  maxAttempts: 4,
  delayFactor: Duration(seconds: 1),
  maxDelay: Duration(seconds: 8),
  randomizationFactor: 0.25,
);

/// Returns true for HTTP status codes that are worth retrying.
bool _isRetriable(int statusCode) =>
    statusCode == 429 ||
    statusCode == 503 ||
    statusCode == 502 ||
    statusCode == 504;

/// API client for chat operations against the gateway.
class ChatService {
  ChatService({
    required AuthenticatedClient client,
    MessagesRepository? repo,
  })  : _client = client,
        _repo = repo;

  static String get _apiBase => ApiBaseService.currentSync();

  final AuthenticatedClient _client;

  /// Optional local-DB cache.  When non-null, threads and messages are
  /// written through to SQLite after each successful network fetch,
  /// and the cache is returned as fallback during network failures.
  final MessagesRepository? _repo;

  final _ResponseCache _cache = _ResponseCache();

  /// Expose the underlying client for SSE and other streaming uses.
  AuthenticatedClient get authClient => _client;

  /// Fetch chats the current user belongs to (paginated).
  Future<ChatsPage> listChats({int limit = 40, int offset = 0}) async {
    final params = <String, String>{
      'limit': limit.toString(),
      if (offset > 0) 'offset': offset.toString(),
    };
    final uri =
        Uri.parse('$_apiBase/v1/chats').replace(queryParameters: params);

    try {
      final response = await _retryOptions.retry(
        () => _client.get(uri),
        retryIf: (e) => e is SocketException || e is ClientException,
      );

      if (response.statusCode != 200) {
        if (_isRetriable(response.statusCode)) {
          throw ChatServiceException('Temporary server error — retrying…');
        }
        throw ChatServiceException(
          'Failed to load chats (${response.statusCode})',
        );
      }

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final data = body['data'] as Map<String, dynamic>?;
      final rows = (data?['rows'] as List<dynamic>?) ?? [];
      final hasMore = (data?['has_more'] as bool?) ?? false;

      final threads = rows
          .map((r) => ChatThreadSummary.fromJson(r as Map<String, dynamic>))
          .toList();

      // ── Write-through: persist threads to local DB ──
      if (_repo != null && offset == 0) {
        // Cache the first page; subsequent pages are additive upserts.
        await _repo.cacheThreads(threads);
      }

      return ChatsPage(threads: threads, hasMore: hasMore);
    } catch (_) {
      // ── Offline fallback: return locally cached threads ──
      if (_repo != null) {
        final cached = await _repo.cachedThreads();
        if (cached.isNotEmpty) {
          return ChatsPage(threads: cached, hasMore: false);
        }
      }
      rethrow;
    }
  }

  /// Fetch messages for a given chat, with optional cursor-based pagination.
  Future<MessagesPage> listMessages(
    String chatId, {
    String? before,
    int limit = 50,
  }) async {
    final params = <String, String>{'limit': limit.toString()};
    if (before != null) params['before'] = before;

    final uri = Uri.parse('$_apiBase/v1/chats/$chatId/messages')
        .replace(queryParameters: params);

    try {
      final response = await _retryOptions.retry(
        () => _client.get(uri),
        retryIf: (e) => e is SocketException || e is ClientException,
      );

      if (response.statusCode != 200) {
        if (_isRetriable(response.statusCode)) {
          throw ChatServiceException('Temporary server error — retrying…');
        }
        throw ChatServiceException(
          'Failed to load messages (${response.statusCode})',
        );
      }

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final data = body['data'] as Map<String, dynamic>?;
      final rows = (data?['rows'] as List<dynamic>?) ?? [];
      final hasMore = (data?['has_more'] as bool?) ?? false;

      final messages = rows
          .map((r) => ChatMessage.fromJson(r as Map<String, dynamic>))
          .toList();

      // ── Write-through: persist messages to local DB ──
      if (_repo != null) {
        await _repo.cacheMessages(chatId, messages);
      }

      return MessagesPage(messages: messages, hasMore: hasMore);
    } catch (_) {
      // ── Offline fallback: return locally cached messages ──
      if (_repo != null) {
        final cached = await _repo.cachedMessages(chatId);
        if (cached.isNotEmpty) {
          return MessagesPage(messages: cached, hasMore: false);
        }
      }
      rethrow;
    }
  }

  /// Fetch the current user's thumbs feedback for messages in a chat.
  /// Returns a map of message_id -> 'up' | 'down'.
  Future<Map<String, String>> listMessageFeedback(String chatId) async {
    final uri = Uri.parse('$_apiBase/v1/chats/$chatId/message-feedback');
    final response = await _retryOptions.retry(
      () => _client.get(uri),
      retryIf: (e) => e is SocketException || e is ClientException,
    );

    if (response.statusCode != 200) {
      throw ChatServiceException(
        'Failed to load message feedback (${response.statusCode})',
      );
    }

    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final data = body['data'] as Map<String, dynamic>?;
    final rows = (data?['rows'] as List<dynamic>?) ?? const [];
    final out = <String, String>{};
    for (final row in rows) {
      if (row is! Map<String, dynamic>) continue;
      final messageId = row['message_id']?.toString() ?? '';
      final feedback = row['feedback']?.toString() ?? '';
      if (messageId.isEmpty) continue;
      if (feedback == 'up' || feedback == 'down') out[messageId] = feedback;
    }
    return out;
  }

  /// Set or clear thumbs feedback for one message.
  /// Use [feedback] = 'up' | 'down' to set, or null to clear.
  Future<void> setMessageFeedback(
    String chatId,
    String messageId, {
    String? feedback,
  }) async {
    final uri =
        Uri.parse('$_apiBase/v1/chats/$chatId/messages/$messageId/feedback');
    final response = await _retryOptions.retry(
      () => _client.putJson(uri, {'feedback': feedback}),
      retryIf: (e) => e is SocketException || e is ClientException,
    );

    if (response.statusCode != 200) {
      throw ChatServiceException(
        'Failed to set message feedback (${response.statusCode})',
      );
    }
  }

  /// Send a text message to a chat. Returns the created message.
  /// Responses for identical prompts are served from an LRU cache
  /// (max 20 items, 10-minute TTL) to reduce redundant API calls.
  ///
  /// [widgetUsername] — when provided the home-screen widget is updated with
  /// the assistant response text after a successful send.
  Future<ChatMessage> sendMessage(String chatId, String text,
      {String mode = 'balanced',
      String responseLength = 'balanced',
      String personality = 'friendly',
      String? memoryContext,
      String? widgetUsername,
      String? replyToMessageId,
      List<XFile>? images}) async {
    // ─ Cache read ─
    final cached = _cache.get(chatId, text, mode, personality, responseLength);
    if (cached != null) return cached;

    final uri = Uri.parse('$_apiBase/v1/chats/$chatId/messages');
    final body = <String, dynamic>{
      'text': text,
      'mode': mode,
      'response_length': responseLength,
      'personality': personality,
    };
    if (memoryContext != null && memoryContext.isNotEmpty) {
      body['memory_context'] = memoryContext;
    }
    if (replyToMessageId != null && replyToMessageId.isNotEmpty) {
      body['reply_to_message_id'] = replyToMessageId;
    }
    // ── Base64-encode attached images ──
    if (images != null && images.isNotEmpty) {
      final imageData = <Map<String, String>>[];
      for (final img in images) {
        final bytes = await img.readAsBytes();
        final b64 = base64Encode(bytes);
        final ext = img.name.split('.').last.toLowerCase();
        final mime = ext == 'png'
            ? 'image/png'
            : ext == 'gif'
                ? 'image/gif'
                : ext == 'webp'
                    ? 'image/webp'
                    : 'image/jpeg';
        imageData.add({'mime_type': mime, 'data': b64});
      }
      body['image_data'] = imageData;
    }
    final response = await _retryOptions.retry(
      () => _client.postJson(uri, body),
      retryIf: (e) => e is SocketException || e is ClientException,
    );

    if (response.statusCode != 201 &&
        response.statusCode != 200 &&
        response.statusCode != 202) {
      throw ChatServiceException(
        'Failed to send message (${response.statusCode})',
      );
    }

    final respBody = jsonDecode(response.body) as Map<String, dynamic>;
    final data = respBody['data'] as Map<String, dynamic>?;
    if (data == null) {
      throw ChatServiceException('Invalid response from server');
    }

    final msg = ChatMessage.fromJson(data);
    final isQueued = msg.status == ChatMessageStatus.queued;
    if (!isQueued) {
      // ─ In-memory cache write ─
      _cache.put(chatId, text, mode, personality, responseLength, msg);
      // ─ DB write-through ─
      if (_repo != null) {
        await _repo.cacheMessage(chatId, msg);
      }
      // ─ Home-screen widget update ─
      if (msg.role == 'assistant' && msg.text.isNotEmpty) {
        HomeWidgetService.instance.updateLastMessage(
          text: msg.text,
          username: widgetUsername ?? '',
        );
      }
    }
    return msg;
  }

  /// Send a structured UI interaction event back to the gateway for agent tracing.
  Future<void> sendA2uiInteraction(
    String chatId, {
    required String eventType,
    Map<String, dynamic>? payload,
  }) async {
    final uri = Uri.parse('$_apiBase/v1/chats/$chatId/a2ui/interaction');
    try {
      final response = await _client.postJson(
        uri,
        {
          'event_type': eventType,
          'payload': payload ?? const <String, dynamic>{},
        },
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ChatServiceException(
          'Failed to send interaction (${response.statusCode})',
        );
      }
    } catch (_) {
      // Non-blocking; interaction telemetry should not crash UI.
    }
  }

  /// Clear the in-memory response cache (call on logout or incognito start).
  void clearCache() => _cache.clear();

  /// Create a new chat thread on the server and return its real ID.
  Future<String> createChat({String name = 'New chat'}) async {
    final uri = Uri.parse('$_apiBase/v1/chats');
    final response = await _client.postJson(uri, {'title': name});
    if (response.statusCode != 201) {
      throw ChatServiceException(
        'Failed to create chat (${response.statusCode})',
      );
    }
    final respBody = jsonDecode(response.body) as Map<String, dynamic>;
    final data = respBody['data'] as Map<String, dynamic>?;
    if (data == null) {
      throw ChatServiceException('Invalid response from server');
    }
    return data['id'] as String;
  }

  /// Rename a chat thread.
  Future<void> renameChat(String chatId, String newName) async {
    final uri = Uri.parse('$_apiBase/v1/chats/$chatId');
    final response = await _client.patchJson(uri, {'name': newName});

    if (response.statusCode != 200) {
      throw ChatServiceException(
        'Failed to rename chat (${response.statusCode})',
      );
    }
  }

  /// Delete a chat thread.
  Future<void> deleteChat(String chatId) async {
    final uri = Uri.parse('$_apiBase/v1/chats/$chatId');
    final response = await _client.delete(uri);

    if (response.statusCode != 200 && response.statusCode != 204) {
      throw ChatServiceException(
        'Failed to delete chat (${response.statusCode})',
      );
    }

    // ── Remove from local DB ──
    if (_repo != null) {
      await _repo.removeMessages(chatId);
      await _repo.removeThread(chatId);
    }
  }

  /// Cancel a queued message (server-side queue).
  Future<void> cancelQueuedMessage(String chatId, String queueId) async {
    final uri = Uri.parse('$_apiBase/v1/chats/$chatId/queue/$queueId');
    final response = await _client.delete(uri);

    if (response.statusCode != 200 && response.statusCode != 204) {
      throw ChatServiceException(
        'Failed to cancel queued message (${response.statusCode})',
      );
    }
  }

  Future<bool> getAgentPaused(String chatId) async {
    final uri = Uri.parse('$_apiBase/v1/chats/$chatId/agent-state');
    final response = await _retryOptions.retry(
      () => _client.get(uri),
      retryIf: (e) => e is SocketException || e is ClientException,
    );
    if (response.statusCode != 200) {
      throw ChatServiceException(
        'Failed to load agent state (${response.statusCode})',
      );
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final data = body['data'] as Map<String, dynamic>?;
    return (data?['paused'] as bool?) ?? false;
  }

  Future<bool> pauseAgent(String chatId) async {
    final uri = Uri.parse('$_apiBase/v1/chats/$chatId/agent/pause');
    final response = await _client.postJson(uri, const <String, dynamic>{});
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ChatServiceException(
        'Failed to pause agent (${response.statusCode})',
      );
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final data = body['data'] as Map<String, dynamic>?;
    return (data?['paused'] as bool?) ?? true;
  }

  Future<bool> resumeAgent(String chatId) async {
    final uri = Uri.parse('$_apiBase/v1/chats/$chatId/agent/resume');
    final response = await _client.postJson(uri, const <String, dynamic>{});
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ChatServiceException(
        'Failed to resume agent (${response.statusCode})',
      );
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final data = body['data'] as Map<String, dynamic>?;
    return (data?['paused'] as bool?) ?? false;
  }

  Future<void> nudgeAgent(String chatId) async {
    final uri = Uri.parse('$_apiBase/v1/chats/$chatId/agent/nudge');
    final response = await _client.postJson(uri, const <String, dynamic>{});
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ChatServiceException(
        'Failed to nudge agent (${response.statusCode})',
      );
    }
  }

  /// Create a public share link for a chat. Returns the share URL.
  Future<String> shareChat(String chatId, {int? expiresInDays}) async {
    final uri = Uri.parse('$_apiBase/v1/chats/$chatId/share');
    final body = <String, dynamic>{};
    if (expiresInDays != null) body['expires_in_days'] = expiresInDays;

    final response = await _client.postJson(uri, body);

    if (response.statusCode != 200 && response.statusCode != 201) {
      throw ChatServiceException(
        'Failed to create share link (${response.statusCode})',
      );
    }

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final data = json['data'] as Map<String, dynamic>?;
    return data?['share_url'] as String? ?? '';
  }

  /// Revoke the active share link for a chat.
  Future<void> revokeShare(String chatId) async {
    final uri = Uri.parse('$_apiBase/v1/chats/$chatId/share');
    final response = await _client.delete(uri);

    if (response.statusCode != 200 && response.statusCode != 204) {
      throw ChatServiceException(
        'Failed to revoke share link (${response.statusCode})',
      );
    }
  }

  /// Send an incognito message — the request includes `incognito: true` so the
  /// server does not persist the thread or messages. Returns a stream of text
  /// tokens from the streamed response body.
  ///
  /// If the server does not support incognito mode, the response is returned
  /// as a single token so the UI still works.
  Stream<String> sendMessageIncognito(String text) async* {
    final uri = Uri.parse('$_apiBase/v1/incognito/messages');
    try {
      final response = await _client.postJson(uri, {
        'text': text,
        'incognito': true,
        'stream': true,
      });
      if (response.statusCode == 200 || response.statusCode == 201) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final data = body['data'] as Map<String, dynamic>?;
        final replyText =
            (data?['text'] as String?) ?? body['text'] as String? ?? '';
        // Yield the reply as a single token (non-streaming fallback)
        if (replyText.isNotEmpty) yield replyText;
      } else {
        throw ChatServiceException(
          'Incognito message failed (${response.statusCode})',
        );
      }
    } catch (e) {
      throw ChatServiceException('Incognito send error: $e');
    }
  }

  /// Silently preload messages for the threads immediately before and after
  /// [currentThreadId] in the locally-cached thread list.
  ///
  /// This is a best-effort, fire-and-forget call — it never throws and never
  /// surfaces a loading state.  When [_repo] is null (no local DB) it is a
  /// no-op.  Results are written through to [MessagesRepository] exactly as
  /// a normal [listMessages] call, so subsequent opens of these threads load
  /// instantly from cache.
  Future<void> preloadAdjacentThreads(String currentThreadId) async {
    if (_repo == null) return;
    try {
      final threads = await _repo.cachedThreads();
      final idx = threads.indexWhere((t) => t.id == currentThreadId);
      if (idx < 0) return;

      final toPreload = <String>[
        if (idx > 0) threads[idx - 1].id,
        if (idx < threads.length - 1) threads[idx + 1].id,
      ];

      for (final id in toPreload) {
        // Ignore errors — preload is best-effort and must never break the UI.
        await listMessages(id).catchError((_) => const MessagesPage(
              messages: [],
              hasMore: false,
            ));
      }
    } catch (_) {
      // Swallow all errors — preload must never surface to the user.
    }
  }

  // ─── Reactions (Batch 7.3) ───

  /// Add an emoji reaction to a message.
  Future<Map<String, dynamic>> addReaction(
      String chatId, String messageId, String emoji) async {
    final uri =
        Uri.parse('$_apiBase/v1/chats/$chatId/messages/$messageId/reactions');
    final r = await _client.postJson(uri, {'emoji': emoji});
    if (r.statusCode != 200 && r.statusCode != 201) {
      throw ChatServiceException('Failed to add reaction (${r.statusCode})');
    }
    final body = jsonDecode(r.body) as Map<String, dynamic>;
    return (body['data'] as Map<String, dynamic>?) ?? {};
  }

  /// Remove an emoji reaction from a message.
  Future<void> removeReaction(
      String chatId, String messageId, String emoji) async {
    final uri = Uri.parse(
        '$_apiBase/v1/chats/$chatId/messages/$messageId/reactions?emoji=${Uri.encodeComponent(emoji)}');
    final r = await _client.delete(uri);
    if (r.statusCode != 200 && r.statusCode != 204) {
      throw ChatServiceException('Failed to remove reaction (${r.statusCode})');
    }
  }

  /// Get reactions for a message.
  Future<List<dynamic>> getReactions(String chatId, String messageId) async {
    final uri =
        Uri.parse('$_apiBase/v1/chats/$chatId/messages/$messageId/reactions');
    final r = await _client.get(uri);
    if (r.statusCode != 200) {
      throw ChatServiceException('Failed to get reactions (${r.statusCode})');
    }
    final body = jsonDecode(r.body) as Map<String, dynamic>;
    final data = body['data'] as Map<String, dynamic>? ?? {};
    return (data['reactions'] as List<dynamic>?) ?? [];
  }

  // ─── Pins (Batch 7.3) ───

  /// Pin a message in a chat.
  Future<void> pinMessage(String chatId, String messageId) async {
    final uri = Uri.parse('$_apiBase/v1/chats/$chatId/messages/$messageId/pin');
    final r = await _client.postJson(uri, {});
    if (r.statusCode != 200 && r.statusCode != 201) {
      throw ChatServiceException('Failed to pin message (${r.statusCode})');
    }
  }

  /// Unpin a message.
  Future<void> unpinMessage(String chatId, String messageId) async {
    final uri = Uri.parse('$_apiBase/v1/chats/$chatId/messages/$messageId/pin');
    final r = await _client.delete(uri);
    if (r.statusCode != 200 && r.statusCode != 204) {
      throw ChatServiceException('Failed to unpin message (${r.statusCode})');
    }
  }

  /// Get all pinned messages in a chat.
  Future<List<dynamic>> getPinnedMessages(String chatId) async {
    final uri = Uri.parse('$_apiBase/v1/chats/$chatId/pinned');
    final r = await _client.get(uri);
    if (r.statusCode != 200) {
      throw ChatServiceException(
          'Failed to get pinned messages (${r.statusCode})');
    }
    final body = jsonDecode(r.body) as Map<String, dynamic>;
    final data = body['data'] as Map<String, dynamic>? ?? {};
    return (data['pins'] as List<dynamic>?) ?? [];
  }
}

/// A page of messages with a cursor indicator.
class MessagesPage {
  const MessagesPage({required this.messages, required this.hasMore});

  final List<ChatMessage> messages;
  final bool hasMore;
}

/// A page of chat threads with a has-more indicator.
class ChatsPage {
  const ChatsPage({required this.threads, required this.hasMore});

  final List<ChatThreadSummary> threads;
  final bool hasMore;
}

class ChatServiceException implements Exception {
  ChatServiceException(this.message);
  final String message;

  @override
  String toString() => 'ChatServiceException: $message';
}
