import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';

/// Full-text and semantic message search.
class SearchService {
  SearchService({required AuthenticatedClient client}) : _client = client;

  final AuthenticatedClient _client;

  Future<SearchResults> searchMessages(
    String query, {
    String? chatId,
    int limit = 20,
    int offset = 0,
    String? before,
    String? after,
    String? senderUserId,
    String? contentType,
  }) async {
    final base = ApiBaseService.currentSync();
    final body = <String, dynamic>{
      'query': query,
      'limit': limit,
      'offset': offset,
    };
    if (chatId != null) body['chat_id'] = chatId;
    if (before != null) body['before'] = before;
    if (after != null) body['after'] = after;
    if (senderUserId != null) body['sender_user_id'] = senderUserId;
    if (contentType != null) body['content_type'] = contentType;

    final response = await _client.postJson(
      Uri.parse('$base/v1/search/messages'),
      body,
    );
    if (response.statusCode != 200) {
      return const SearchResults(results: [], total: 0);
    }
    final data = jsonDecode(response.body)['data'] as Map<String, dynamic>;
    return SearchResults.fromJson(data);
  }

  Future<SearchResults> searchSemantic(
    String query, {
    String? chatId,
    int limit = 20,
    double minScore = 0.5,
  }) async {
    final base = ApiBaseService.currentSync();
    final body = <String, dynamic>{
      'query': query,
      'limit': limit,
      'min_score': minScore,
    };
    if (chatId != null) body['chat_id'] = chatId;

    final response = await _client.postJson(
      Uri.parse('$base/v1/search/semantic'),
      body,
    );
    if (response.statusCode != 200) {
      return const SearchResults(results: [], total: 0);
    }
    final data = jsonDecode(response.body)['data'] as Map<String, dynamic>;
    return SearchResults.fromJson(data);
  }

  Future<UnifiedSearchResults> search(
    String query, {
    List<String> types = const ['messages', 'files', 'contacts'],
    int limit = 20,
  }) async {
    final base = ApiBaseService.currentSync();
    final response = await _client.postJson(
      Uri.parse('$base/v1/search/unified'),
      {
        'query': query,
        'types': types,
        'limit': limit,
      },
    );
    if (response.statusCode != 200) {
      return const UnifiedSearchResults(messages: [], files: [], contacts: []);
    }
    final data = jsonDecode(response.body)['data'] as Map<String, dynamic>;
    return UnifiedSearchResults.fromJson(data);
  }
}

// -- Models --

class SearchResults {
  const SearchResults({required this.results, required this.total});
  final List<SearchResult> results;
  final int total;

  factory SearchResults.fromJson(Map<String, dynamic> json) => SearchResults(
        results: (json['results'] as List?)
                ?.map((r) => SearchResult.fromJson(r as Map<String, dynamic>))
                .toList() ??
            [],
        total: json['total'] as int? ?? 0,
      );
}

class SearchResult {
  const SearchResult({
    required this.messageId,
    required this.chatId,
    this.text,
    this.headline,
    this.senderName,
    this.sentAt,
    this.score,
  });

  final String messageId;
  final String chatId;
  final String? text;
  final String? headline;
  final String? senderName;
  final DateTime? sentAt;
  final double? score;

  factory SearchResult.fromJson(Map<String, dynamic> json) => SearchResult(
        messageId: json['message_id'] as String? ?? json['id'] as String? ?? '',
        chatId: json['chat_id'] as String? ?? '',
        text: json['text'] as String?,
        headline: json['headline'] as String?,
        senderName: json['sender_name'] as String?,
        sentAt: json['sent_at'] != null
            ? DateTime.tryParse(json['sent_at'] as String)
            : null,
        score: (json['score'] as num?)?.toDouble(),
      );
}

class UnifiedSearchResults {
  const UnifiedSearchResults(
      {required this.messages, required this.files, required this.contacts});
  final List<SearchResult> messages;
  final List<FileSearchResult> files;
  final List<ContactSearchResult> contacts;

  factory UnifiedSearchResults.fromJson(Map<String, dynamic> json) =>
      UnifiedSearchResults(
        messages: (json['messages'] as List?)
                ?.map((r) => SearchResult.fromJson(r as Map<String, dynamic>))
                .toList() ??
            [],
        files: (json['files'] as List?)
                ?.map(
                    (f) => FileSearchResult.fromJson(f as Map<String, dynamic>))
                .toList() ??
            [],
        contacts: (json['contacts'] as List?)
                ?.map((c) =>
                    ContactSearchResult.fromJson(c as Map<String, dynamic>))
                .toList() ??
            [],
      );
}

class FileSearchResult {
  const FileSearchResult(
      {required this.mediaId,
      required this.fileName,
      this.mimeType,
      this.chatId});
  final String mediaId;
  final String fileName;
  final String? mimeType;
  final String? chatId;

  factory FileSearchResult.fromJson(Map<String, dynamic> json) =>
      FileSearchResult(
        mediaId: json['media_id'] as String? ?? json['id'] as String? ?? '',
        fileName: json['file_name'] as String? ?? '',
        mimeType: json['mime_type'] as String?,
        chatId: json['chat_id'] as String?,
      );
}

class ContactSearchResult {
  const ContactSearchResult(
      {required this.userId, required this.displayName, this.email});
  final String userId;
  final String displayName;
  final String? email;

  factory ContactSearchResult.fromJson(Map<String, dynamic> json) =>
      ContactSearchResult(
        userId: json['user_id'] as String? ?? json['id'] as String? ?? '',
        displayName: json['display_name'] as String? ?? '',
        email: json['email'] as String?,
      );
}
