import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart' show ApiBaseService;

/// Service for uploading, downloading, and managing media files.
///
/// Supports multipart uploads, thumbnail generation on the server,
/// and gallery-style listing with type filtering.
class MediaService {
  MediaService({required AuthenticatedClient client}) : _client = client;

  final AuthenticatedClient _client;

  // ── Upload ──────────────────────────────────────────────────

  /// Upload a file. Returns the resulting media record on success.
  Future<MediaUpload?> uploadFile({
    required String filePath,
    required String fileName,
    required String mimeType,
    String? chatId,
  }) async {
    final base = ApiBaseService.currentSync();
    final uri = Uri.parse('$base/v1/media/upload');

    // Build multipart body manually to use sendStreamed(http.Request)
    final multipart = http.MultipartRequest('POST', uri);
    multipart.files.add(
      await http.MultipartFile.fromPath('file', filePath, filename: fileName),
    );
    if (chatId != null) multipart.fields['chat_id'] = chatId;

    // Finalize multipart into a regular Request for sendStreamed
    final finalized = await multipart.finalize().toBytes();
    final request = http.Request('POST', uri)
      ..headers['Content-Type'] =
          multipart.headers['content-type'] ?? 'multipart/form-data'
      ..bodyBytes = finalized;

    final streamed = await _client.sendStreamed(request);
    final response = await http.Response.fromStream(streamed);
    if (response.statusCode == 201) {
      final data = jsonDecode(response.body)['data'] as Map<String, dynamic>;
      return MediaUpload.fromJson(data);
    }
    return null;
  }

  /// Upload file from bytes (useful for camera captures, clipboard pastes).
  Future<MediaUpload?> uploadBytes({
    required Uint8List bytes,
    required String fileName,
    required String mimeType,
    String? chatId,
  }) async {
    final base = ApiBaseService.currentSync();
    final uri = Uri.parse('$base/v1/media/upload');

    final multipart = http.MultipartRequest('POST', uri);
    multipart.files.add(
      http.MultipartFile.fromBytes('file', bytes, filename: fileName),
    );
    if (chatId != null) multipart.fields['chat_id'] = chatId;

    final finalized = await multipart.finalize().toBytes();
    final request = http.Request('POST', uri)
      ..headers['Content-Type'] =
          multipart.headers['content-type'] ?? 'multipart/form-data'
      ..bodyBytes = finalized;

    final streamed = await _client.sendStreamed(request);
    final response = await http.Response.fromStream(streamed);
    if (response.statusCode == 201) {
      final data = jsonDecode(response.body)['data'] as Map<String, dynamic>;
      return MediaUpload.fromJson(data);
    }
    return null;
  }

  // ── Download / Thumbnail ───────────────────────────────────

  /// Get the download URL for a media file.
  String downloadUrl(String mediaId) {
    // Constructed synchronously; the auth token is sent via cookie or header
    // in the actual network call.
    return '/v1/media/$mediaId/download';
  }

  /// Get the thumbnail URL for a media file.
  String thumbnailUrl(String mediaId, {int? width, int? height}) {
    final params = <String, String>{};
    if (width != null) params['w'] = '$width';
    if (height != null) params['h'] = '$height';
    final qs = params.isNotEmpty
        ? '?${params.entries.map((e) => '${e.key}=${e.value}').join('&')}'
        : '';
    return '/v1/media/$mediaId/thumbnail$qs';
  }

  /// Download a file as bytes.
  Future<Uint8List?> downloadFile(String mediaId) async {
    final base = ApiBaseService.currentSync();
    final response = await _client.get(
      Uri.parse('$base/v1/media/$mediaId/download'),
    );
    if (response.statusCode == 200) return response.bodyBytes;
    return null;
  }

  // ── Attach to Message ──────────────────────────────────────

  /// Link an uploaded media item to a message.
  Future<bool> attachToMessage({
    required String mediaId,
    required String messageId,
    int displayOrder = 0,
  }) async {
    final base = ApiBaseService.currentSync();
    final response = await _client.postJson(
      Uri.parse('$base/v1/media/attach'),
      {
        'media_id': mediaId,
        'message_id': messageId,
        'display_order': displayOrder,
      },
    );
    return response.statusCode == 201;
  }

  // ── Gallery ────────────────────────────────────────────────

  /// List media files for a chat (gallery view).
  Future<MediaGallery> getChatGallery(
    String chatId, {
    String? type,
    int limit = 50,
    int offset = 0,
  }) async {
    final base = ApiBaseService.currentSync();
    final params = <String, String>{
      'limit': '$limit',
      'offset': '$offset',
    };
    if (type != null) params['type'] = type;
    final qs = params.entries.map((e) => '${e.key}=${e.value}').join('&');

    final response = await _client.get(
      Uri.parse('$base/v1/chats/$chatId/media?$qs'),
    );
    if (response.statusCode != 200) {
      return const MediaGallery(items: [], total: 0);
    }
    final body = jsonDecode(response.body)['data'] as Map<String, dynamic>;
    return MediaGallery.fromJson(body);
  }
}

// ── Models ─────────────────────────────────────────────────────

class MediaUpload {
  const MediaUpload({
    required this.id,
    required this.fileName,
    required this.mimeType,
    required this.sizeBytes,
    this.checksum,
    this.thumbnailPath,
    this.createdAt,
  });

  final String id;
  final String fileName;
  final String mimeType;
  final int sizeBytes;
  final String? checksum;
  final String? thumbnailPath;
  final DateTime? createdAt;

  factory MediaUpload.fromJson(Map<String, dynamic> json) => MediaUpload(
        id: json['id'] as String? ?? '',
        fileName: json['file_name'] as String? ?? '',
        mimeType: json['mime_type'] as String? ?? '',
        sizeBytes: json['size_bytes'] as int? ?? 0,
        checksum: json['checksum'] as String?,
        thumbnailPath: json['thumbnail_path'] as String?,
        createdAt: json['created_at'] != null
            ? DateTime.tryParse(json['created_at'] as String)
            : null,
      );
}

class MediaGallery {
  const MediaGallery({required this.items, required this.total});
  final List<MediaUpload> items;
  final int total;

  factory MediaGallery.fromJson(Map<String, dynamic> json) => MediaGallery(
        items: (json['items'] as List?)
                ?.map((m) => MediaUpload.fromJson(m as Map<String, dynamic>))
                .toList() ??
            [],
        total: json['total'] as int? ?? 0,
      );
}
