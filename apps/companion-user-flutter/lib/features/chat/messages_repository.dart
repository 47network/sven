// lib/features/chat/messages_repository.dart
//
// Local-first repository for chat threads and messages.
//
// Provides a write-through cache layer:
//   1. Reads always succeed from SQLite when offline.
//   2. Network results are persisted after each successful fetch.
//
// Conversion between drift row types ([DbChatThread], [DbChatMessage]) and
// the app's domain models ([ChatThreadSummary], [ChatMessage]) lives here so
// the rest of the codebase never imports drift directly.
//
// When [DbEncryption] is supplied (production), sensitive string columns
// (message content, thread title, last-message preview, outbox body) are
// transparently encrypted on write and decrypted on read.  Tests that omit
// [encryption] operate on plain-text rows without any code path changes.

import 'package:drift/drift.dart' show Value;
import 'package:flutter/foundation.dart' show kReleaseMode, visibleForTesting;

import '../../app/database.dart';
import '../../app/db_encryption.dart';
import 'chat_models.dart';

/// Repository for persistent local storage of chat threads and messages.
///
/// Injected into [ChatService] and registered as a lazy singleton via
/// [setupServiceLocator].
class MessagesRepository {
  MessagesRepository({
    required AppDatabase db,
    DbEncryption? encryption,
    Future<DbEncryption?>? encryptionFuture,
    bool requireEncryption = true,
  })
      : assert(
          encryption == null || encryptionFuture == null,
          'Provide either encryption or encryptionFuture, not both.',
        ),
        _db = db,
        _encFuture = encryptionFuture ?? Future<DbEncryption?>.value(encryption),
        _requireEncryption = requireEncryption {
    if (!_requireEncryption && kReleaseMode) {
      throw StateError('Plaintext repository mode is not allowed in release builds');
    }
  }

  @visibleForTesting
  factory MessagesRepository.plaintextForTests({
    required AppDatabase db,
    DbEncryption? encryption,
  }) {
    return MessagesRepository(
      db: db,
      encryption: encryption,
      requireEncryption: false,
    );
  }

  final AppDatabase _db;
  final Future<DbEncryption?> _encFuture;
  final bool _requireEncryption;

  // ── Encryption helpers ────────────────────────────────────────────────────

  /// Encrypt [v] when a [DbEncryption] instance is available.
  String _e(String v, DbEncryption? enc) => enc?.encrypt(v) ?? v;

  /// Decrypt [v] when a [DbEncryption] instance is available.
  String _d(String v, DbEncryption? enc) => enc?.decrypt(v) ?? v;

  Future<DbEncryption?> _resolveEnc() async {
    final enc = await _encFuture;
    if (_requireEncryption && enc == null) {
      throw StateError('DbEncryption is required but unavailable');
    }
    return enc;
  }

  // ── Thread helpers ────────────────────────────────────────────────────────

  /// All locally cached threads, newest first.
  Future<List<ChatThreadSummary>> cachedThreads() async {
    final rows = await _db.getAllThreads();
    final enc = await _resolveEnc();
    return rows.map((row) => _threadFromRow(row, enc)).toList();
  }

  /// Persist a list of [ChatThreadSummary] objects (upsert).
  Future<void> cacheThreads(List<ChatThreadSummary> threads) async {
    final enc = await _resolveEnc();
    await _db.upsertThreads(
      threads.map((thread) => _threadToCompanion(thread, enc)).toList(),
    );
  }

  /// Persist a single thread.
  Future<void> cacheThread(ChatThreadSummary thread) async {
    final enc = await _resolveEnc();
    await _db.upsertThread(_threadToCompanion(thread, enc));
  }

  /// Remove a thread from the local cache (does NOT remove messages).
  Future<void> removeThread(String threadId) => _db.deleteThread(threadId);

  // ── Message helpers ───────────────────────────────────────────────────────

  /// Locally cached messages for [chatId], oldest first.
  Future<List<ChatMessage>> cachedMessages(String chatId) async {
    final rows = await _db.getMessagesForThread(chatId);
    final enc = await _resolveEnc();
    return rows.map((row) => _messageFromRow(row, enc)).toList();
  }

  /// Persist a list of [ChatMessage] objects for [chatId] (upsert).
  Future<void> cacheMessages(
    String chatId,
    List<ChatMessage> messages,
  ) async {
    final enc = await _resolveEnc();
    await _db.upsertMessages(
      messages.map((message) => _messageToCompanion(chatId, message, enc)).toList(),
    );
  }

  /// Persist a single [ChatMessage].
  Future<void> cacheMessage(String chatId, ChatMessage message) async {
    final enc = await _resolveEnc();
    await _db.upsertMessage(_messageToCompanion(chatId, message, enc));
  }

  /// Delete all cached messages for [chatId].
  Future<void> removeMessages(String chatId) =>
      _db.deleteMessagesForThread(chatId);

  // ── Outbox (offline queue) helpers ────────────────────────────────────────

  /// All outbox items ordered from oldest to newest (delivery order).
  ///
  /// The [body] field of each returned item is **plain-text** — decryption
  /// has already been applied.
  Future<List<DbOutboxMessage>> getAllOutboxItems() async {
    final rows = await _db.getAllOutboxItems();
    final enc = await _resolveEnc();
    if (enc == null) return rows;
    // Return synthetic copies with the body decrypted.
    return rows
        .map(
          (r) => DbOutboxMessage(
            id: r.id,
            chatId: r.chatId,
            body: _d(r.body, enc),
            queuedAt: r.queuedAt,
            attemptCount: r.attemptCount,
          ),
        )
        .toList();
  }

  /// Add [text] to the persistent outbox for [chatId].
  ///
  /// The body is stored **encrypted** when [DbEncryption] is available.
  Future<void> enqueueOutbox({
    required String id,
    required String chatId,
    required String text,
    required int queuedAt,
  }) async {
    final enc = await _resolveEnc();
    await _db.insertOutboxItem(
      DbOutboxMessagesCompanion.insert(
        id: id,
        chatId: chatId,
        body: _e(text, enc),
        queuedAt: queuedAt,
      ),
    );
  }

  /// Permanently remove an outbox item after successful delivery.
  Future<int> deleteOutboxItem(String id) => _db.deleteOutboxItem(id);

  /// Remove all outbox items for [chatId].
  ///
  /// Called when a thread page drains its own in-memory queue so messages
  /// are not double-delivered by [SyncService].
  Future<int> purgeOutboxFor(String chatId) => _db.purgeOutboxFor(chatId);

  /// Increment the delivery attempt counter for [id].
  Future<void> incrementOutboxAttemptCount(String id) =>
      _db.incrementOutboxAttemptCount(id);

  // ── Conversions ── DB row → domain model ─────────────────────────────────

  ChatThreadSummary _threadFromRow(
    DbChatThread row,
    DbEncryption? enc,
  ) =>
      ChatThreadSummary(
        id: row.id,
        title: _d(row.title, enc),
        lastMessage: _d(row.lastMessage, enc),
        updatedAt: DateTime.fromMillisecondsSinceEpoch(row.updatedAt),
        unreadCount: row.unreadCount,
        type: row.type,
        channel: row.channel,
        messageCount: row.messageCount,
        isPinned: row.isPinned,
        isArchived: row.isArchived,
        tag: row.tag,
      );

  ChatMessage _messageFromRow(
    DbChatMessage row,
    DbEncryption? enc,
  ) =>
      ChatMessage(
        id: row.id,
        role: row.role,
        // `text` in ChatMessage maps to `content` in DB
        text: _d(row.content, enc),
        timestamp: DateTime.fromMillisecondsSinceEpoch(row.timestamp),
        status: _statusFromString(row.status),
        senderName: row.senderName,
        contentType: row.contentType,
        chatId: row.chatId,
        isEdited: row.isEdited,
      );

  // ── Conversions ── domain model → DB companion ────────────────────────────

  DbChatThreadsCompanion _threadToCompanion(
    ChatThreadSummary t,
    DbEncryption? enc,
  ) =>
      DbChatThreadsCompanion.insert(
        id: t.id,
        title: _e(t.title, enc),
        lastMessage: Value(_e(t.lastMessage, enc)),
        updatedAt: t.updatedAt.millisecondsSinceEpoch,
        unreadCount: Value(t.unreadCount),
        type: Value(t.type),
        channel: t.channel != null ? Value(t.channel!) : const Value.absent(),
        messageCount: Value(t.messageCount),
        isPinned: Value(t.isPinned),
        isArchived: Value(t.isArchived),
        tag: t.tag != null ? Value(t.tag!) : const Value.absent(),
      );

  DbChatMessagesCompanion _messageToCompanion(
    String chatId,
    ChatMessage m,
    DbEncryption? enc,
  ) =>
      DbChatMessagesCompanion.insert(
        id: m.id,
        chatId: m.chatId ?? chatId,
        role: m.role,
        content: _e(m.text, enc),
        timestamp: m.timestamp.millisecondsSinceEpoch,
        status: Value(m.status.name),
        senderName:
            m.senderName != null ? Value(m.senderName!) : const Value.absent(),
        contentType: Value(m.contentType),
        isEdited: Value(m.isEdited),
      );

  // ── Status enum ↔ String ──────────────────────────────────────────────────

  static ChatMessageStatus _statusFromString(String s) {
    switch (s) {
      case 'sending':
        return ChatMessageStatus.sending;
      case 'failed':
        return ChatMessageStatus.failed;
      case 'queued':
        return ChatMessageStatus.queued;
      case 'streaming':
        return ChatMessageStatus.streaming;
      case 'sent':
      default:
        return ChatMessageStatus.sent;
    }
  }
}
