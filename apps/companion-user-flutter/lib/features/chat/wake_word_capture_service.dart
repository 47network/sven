import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../app/api_base_service.dart';
import '../../app/authenticated_client.dart';
import '../auth/token_store.dart';

class WakeWordCaptureResult {
  const WakeWordCaptureResult({
    required this.detected,
    this.confidence,
    this.matchedLabel,
    this.targetLabel,
    this.topScores = const <Map<String, dynamic>>[],
  });

  final bool detected;
  final double? confidence;
  final String? matchedLabel;
  final String? targetLabel;
  final List<Map<String, dynamic>> topScores;
}

class WakeWordCaptureService {
  WakeWordCaptureService({
    required AuthenticatedClient client,
    TokenStore? tokenStore,
  })  : _client = client,
        _tokenStore = tokenStore ?? TokenStore();

  static const _wakeChatKeyPrefix = 'sven.wake_word.chat_id';

  final AuthenticatedClient _client;
  final TokenStore _tokenStore;

  Future<WakeWordCaptureResult> submitAudioWindow({
    required String wakePhrase,
    required String audioBase64,
    String audioMime = 'audio/wav',
  }) async {
    final chatId = await _ensureWakeChatId();
    final firstAttempt = await _postWakeWord(chatId, wakePhrase, audioBase64, audioMime);
    if (firstAttempt.$1 != 403 && firstAttempt.$1 != 404) {
      return _parseResult(firstAttempt.$2);
    }

    await _clearWakeChatId();
    final freshChatId = await _ensureWakeChatId();
    final secondAttempt = await _postWakeWord(freshChatId, wakePhrase, audioBase64, audioMime);
    return _parseResult(secondAttempt.$2);
  }

  Future<(int, String)> _postWakeWord(
    String chatId,
    String wakePhrase,
    String audioBase64,
    String audioMime,
  ) async {
    final uri = Uri.parse('${ApiBaseService.currentSync()}/v1/chats/$chatId/wake-word');
    final response = await _client.postJson(uri, <String, dynamic>{
      'wake_word': wakePhrase,
      'audio_base64': audioBase64,
      'audio_mime': audioMime,
      'transcribe': false,
      'mode': 'android_foreground_service',
    });
    return (response.statusCode, response.body);
  }

  WakeWordCaptureResult _parseResult(String rawBody) {
    try {
      final decoded = jsonDecode(rawBody) as Map<String, dynamic>;
      final outer = decoded['data'] as Map<String, dynamic>?;
      final nested = outer != null ? outer['data'] : null;
      final data =
          nested is Map<String, dynamic> ? nested : outer;
      final topScoresRaw = data?['top_scores'];
      final topScores = topScoresRaw is List
          ? topScoresRaw
              .whereType<Map>()
              .map((row) => row.map(
                    (key, value) => MapEntry('$key', value),
                  ))
              .toList()
          : const <Map<String, dynamic>>[];
      return WakeWordCaptureResult(
        detected: data?['detected'] == true,
        confidence: (data?['confidence'] as num?)?.toDouble(),
        matchedLabel: data?['matched_label'] as String?,
        targetLabel: data?['target_label'] as String?,
        topScores: topScores,
      );
    } catch (_) {
      return const WakeWordCaptureResult(detected: false);
    }
  }

  Future<String> _ensureWakeChatId() async {
    final prefs = await SharedPreferences.getInstance();
    final key = await _wakeChatStorageKey();
    final cached = prefs.getString(key);
    if (cached != null && cached.trim().isNotEmpty) {
      return cached.trim();
    }

    final uri = Uri.parse('${ApiBaseService.currentSync()}/v1/chats');
    final response = await _client.postJson(uri, <String, dynamic>{
      'name': 'Voice wake',
      'type': 'dm',
    });
    if (response.statusCode != 201) {
      throw StateError('Unable to create wake-word chat (${response.statusCode})');
    }
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final data = decoded['data'] as Map<String, dynamic>? ?? const <String, dynamic>{};
    final chatId = '${data['id'] ?? ''}'.trim();
    if (chatId.isEmpty) {
      throw StateError('Wake-word chat create response missing id');
    }
    await prefs.setString(key, chatId);
    return chatId;
  }

  Future<void> _clearWakeChatId() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(await _wakeChatStorageKey());
  }

  Future<String> _wakeChatStorageKey() async {
    final userId = (await _tokenStore.readUserId())?.trim();
    if (userId != null && userId.isNotEmpty) {
      return '$_wakeChatKeyPrefix.$userId';
    }
    return _wakeChatKeyPrefix;
  }
}
