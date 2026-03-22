// Unit tests for MessagesRepository — write-through SQLite cache layer.
//
// Uses an in-memory drift database (NativeDatabase.memory()) so no files are
// written to disk and each test group gets a clean slate.
//
// Run with:
//   flutter test test/messages_repository_test.dart

import 'package:drift/native.dart';
import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:flutter_test/flutter_test.dart';

import 'package:sven_user_flutter/app/database.dart';
import 'package:sven_user_flutter/app/db_encryption.dart';
import 'package:sven_user_flutter/features/chat/chat_models.dart';
import 'package:sven_user_flutter/features/chat/messages_repository.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

AppDatabase _freshDb() => AppDatabase(NativeDatabase.memory());

MessagesRepository _repo({DbEncryption? encryption}) =>
    MessagesRepository.plaintextForTests(
      db: _freshDb(),
      encryption: encryption,
    );

DbEncryption _enc() =>
    DbEncryption.fromKeyBytes(List.generate(32, (i) => i + 7));

ChatThreadSummary _thread({
  String id = 't1',
  String title = 'Test Thread',
  String lastMessage = 'last msg',
}) =>
    ChatThreadSummary(
      id: id,
      title: title,
      lastMessage: lastMessage,
      updatedAt: DateTime(2025, 1, 1),
      unreadCount: 0,
      type: 'dm',
      messageCount: 0,
      isPinned: false,
      isArchived: false,
    );

ChatMessage _message({
  String id = 'm1',
  String chatId = 't1',
  String text = 'hello world',
  ChatMessageStatus status = ChatMessageStatus.sent,
}) =>
    ChatMessage(
      id: id,
      chatId: chatId,
      role: 'user',
      text: text,
      timestamp: DateTime(2025, 1, 1, 12),
      status: status,
    );

// ─────────────────────────────────────────────────────────────────────────────
// Thread tests
// ─────────────────────────────────────────────────────────────────────────────

void main() {
  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
  });

  group('MessagesRepository — threads (no encryption)', () {
    late MessagesRepository repo;
    setUp(() => repo = _repo());

    test('cachedThreads returns empty list initially', () async {
      expect(await repo.cachedThreads(), isEmpty);
    });

    test('cacheThread then cachedThreads returns that thread', () async {
      await repo.cacheThread(_thread());
      final list = await repo.cachedThreads();
      expect(list.length, 1);
      expect(list.first.title, 'Test Thread');
    });

    test('cacheThreads (batch) stores all threads', () async {
      await repo.cacheThreads([
        _thread(id: 't1', title: 'A'),
        _thread(id: 't2', title: 'B'),
        _thread(id: 't3', title: 'C'),
      ]);
      expect((await repo.cachedThreads()).length, 3);
    });

    test('upsert — cacheThread twice updates the row', () async {
      await repo.cacheThread(_thread(title: 'Original'));
      await repo.cacheThread(_thread(title: 'Updated'));
      final list = await repo.cachedThreads();
      expect(list.length, 1);
      expect(list.first.title, 'Updated');
    });

    test('removeThread deletes only the specified thread', () async {
      await repo.cacheThreads([_thread(id: 't1'), _thread(id: 't2')]);
      await repo.removeThread('t1');
      final list = await repo.cachedThreads();
      expect(list.length, 1);
      expect(list.first.id, 't2');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Message tests
  // ─────────────────────────────────────────────────────────────────────────

  group('MessagesRepository — messages (no encryption)', () {
    late MessagesRepository repo;
    setUp(() => repo = _repo());

    test('cachedMessages returns empty list initially', () async {
      expect(await repo.cachedMessages('t1'), isEmpty);
    });

    test('cacheMessage then cachedMessages returns message', () async {
      await repo.cacheMessage('t1', _message());
      final msgs = await repo.cachedMessages('t1');
      expect(msgs.length, 1);
      expect(msgs.first.text, 'hello world');
      expect(msgs.first.role, 'user');
    });

    test('cacheMessages (batch) stores all messages', () async {
      await repo.cacheMessages('t1', [
        _message(id: 'm1', text: 'first'),
        _message(id: 'm2', text: 'second'),
      ]);
      expect((await repo.cachedMessages('t1')).length, 2);
    });

    test('upsert — cacheMessage twice updates the row', () async {
      await repo.cacheMessage('t1', _message(text: 'original'));
      await repo.cacheMessage('t1', _message(text: 'updated'));
      final msgs = await repo.cachedMessages('t1');
      expect(msgs.length, 1);
      expect(msgs.first.text, 'updated');
    });

    test('cachedMessages scoped to chatId — t1 does not pollute t2', () async {
      await repo.cacheMessage('t1', _message(id: 'm1', chatId: 't1'));
      await repo.cacheMessage(
          't2', _message(id: 'm2', chatId: 't2', text: 'from t2'));
      expect((await repo.cachedMessages('t1')).length, 1);
      expect((await repo.cachedMessages('t2')).length, 1);
    });

    test('removeMessages deletes all messages for the thread', () async {
      await repo.cacheMessages('t1', [
        _message(id: 'm1'),
        _message(id: 'm2', text: 'another'),
      ]);
      await repo.removeMessages('t1');
      expect(await repo.cachedMessages('t1'), isEmpty);
    });

    test('removeMessages only deletes messages for specified chatId', () async {
      await repo.cacheMessage('t1', _message(id: 'm1', chatId: 't1'));
      await repo.cacheMessage('t2', _message(id: 'm2', chatId: 't2'));
      await repo.removeMessages('t1');
      expect((await repo.cachedMessages('t2')).length, 1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Outbox tests
  // ─────────────────────────────────────────────────────────────────────────

  group('MessagesRepository — outbox (no encryption)', () {
    late MessagesRepository repo;
    setUp(() => repo = _repo());

    test('getAllOutboxItems returns empty list initially', () async {
      expect(await repo.getAllOutboxItems(), isEmpty);
    });

    test('enqueueOutbox then getAllOutboxItems returns item', () async {
      await repo.enqueueOutbox(
        id: 'o1',
        chatId: 't1',
        text: 'queued message',
        queuedAt: 1000,
      );
      final items = await repo.getAllOutboxItems();
      expect(items.length, 1);
      expect(items.first.body, 'queued message');
      expect(items.first.chatId, 't1');
      expect(items.first.attemptCount, 0);
    });

    test('getAllOutboxItems orders by queuedAt ascending', () async {
      await repo.enqueueOutbox(
          id: 'o3', chatId: 't1', text: 'c', queuedAt: 300);
      await repo.enqueueOutbox(
          id: 'o1', chatId: 't1', text: 'a', queuedAt: 100);
      await repo.enqueueOutbox(
          id: 'o2', chatId: 't1', text: 'b', queuedAt: 200);
      final items = await repo.getAllOutboxItems();
      expect(items.map((i) => i.id).toList(), ['o1', 'o2', 'o3']);
    });

    test('deleteOutboxItem removes only the specified item', () async {
      await repo.enqueueOutbox(id: 'o1', chatId: 't1', text: 'a', queuedAt: 1);
      await repo.enqueueOutbox(id: 'o2', chatId: 't1', text: 'b', queuedAt: 2);
      await repo.deleteOutboxItem('o1');
      final items = await repo.getAllOutboxItems();
      expect(items.length, 1);
      expect(items.first.id, 'o2');
    });

    test('purgeOutboxFor removes items only for specified chatId', () async {
      await repo.enqueueOutbox(id: 'o1', chatId: 't1', text: 'a', queuedAt: 1);
      await repo.enqueueOutbox(id: 'o2', chatId: 't2', text: 'b', queuedAt: 2);
      await repo.enqueueOutbox(id: 'o3', chatId: 't1', text: 'c', queuedAt: 3);
      final purged = await repo.purgeOutboxFor('t1');
      expect(purged, 2);
      final remaining = await repo.getAllOutboxItems();
      expect(remaining.length, 1);
      expect(remaining.first.chatId, 't2');
    });

    test('incrementOutboxAttemptCount increments by 1 each call', () async {
      await repo.enqueueOutbox(id: 'o1', chatId: 't1', text: 'a', queuedAt: 1);
      await repo.incrementOutboxAttemptCount('o1');
      await repo.incrementOutboxAttemptCount('o1');
      final items = await repo.getAllOutboxItems();
      expect(items.first.attemptCount, 2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Encryption round-trip tests
  // ─────────────────────────────────────────────────────────────────────────

  group('MessagesRepository — with encryption', () {
    late AppDatabase db;
    late MessagesRepository repo;

    setUp(() {
      db = _freshDb();
      repo = MessagesRepository(db: db, encryption: _enc());
    });

    test('thread title is encrypted at-rest but decrypted on read', () async {
      await repo.cacheThread(_thread(title: 'Secret Title'));
      // Raw DB row should NOT equal plaintext
      final rawRows = await db.getAllThreads();
      expect(rawRows.first.title, isNot('Secret Title'));
      expect(rawRows.first.title.startsWith('v2:'), isTrue);
      // Repo read should return plaintext
      final threads = await repo.cachedThreads();
      expect(threads.first.title, 'Secret Title');
    });

    test('message content is encrypted at-rest but decrypted on read',
        () async {
      await repo.cacheMessage('t1', _message(text: 'Top secret content'));
      final rawRows = await db.getMessagesForThread('t1');
      expect(rawRows.first.content, isNot('Top secret content'));
      expect(rawRows.first.content.startsWith('v2:'), isTrue);
      final msgs = await repo.cachedMessages('t1');
      expect(msgs.first.text, 'Top secret content');
    });

    test('outbox body is encrypted at-rest but decrypted on read', () async {
      await repo.enqueueOutbox(
          id: 'o1', chatId: 't1', text: 'secure payload', queuedAt: 1);
      final rawRows = await db.getAllOutboxItems();
      expect(rawRows.first.body, isNot('secure payload'));
      expect(rawRows.first.body.startsWith('v2:'), isTrue);
      final items = await repo.getAllOutboxItems();
      expect(items.first.body, 'secure payload');
    });

    test('encryption round-trip survives multiple cacheMessage calls',
        () async {
      const messages = ['alpha', 'beta', 'gamma'];
      for (var i = 0; i < messages.length; i++) {
        await repo.cacheMessage(
            't1', _message(id: 'm$i', chatId: 't1', text: messages[i]));
      }
      final retrieved = await repo.cachedMessages('t1');
      expect(retrieved.map((m) => m.text).toList(), messages);
    });
  });

  group('MessagesRepository — encryption invariants', () {
    test('throws when encryption is required but unavailable', () async {
      final repo = MessagesRepository(
        db: _freshDb(),
        encryptionFuture: Future<DbEncryption?>.value(null),
      );
      await expectLater(
        () => repo.cachedThreads(),
        throwsA(isA<StateError>()),
      );
    });
  });
}
