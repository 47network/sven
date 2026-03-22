// Unit tests for SyncService — persistent offline-message queue.
//
// Tests exercise drain(), purgeFor() and enqueueOutbox-via-repo directly,
// bypassing init() so that connectivity platform channels are never invoked.
//
// A _InMemoryTokenStore avoids flutter_secure_storage platform calls.
// A MockClient controls HTTP response codes from the fake API.
//
// Run with:
//   flutter test test/sync_service_test.dart

import 'dart:convert';

import 'package:drift/native.dart';
import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:sven_user_flutter/app/authenticated_client.dart';
import 'package:sven_user_flutter/app/database.dart';
import 'package:sven_user_flutter/features/auth/token_store.dart';
import 'package:sven_user_flutter/features/chat/messages_repository.dart';
import 'package:sven_user_flutter/features/chat/sync_service.dart';

// ─────────────────────────────────────────────────────────────────────────────
// In-memory TokenStore — avoids flutter_secure_storage platform channel
// ─────────────────────────────────────────────────────────────────────────────

class _InMemoryTokenStore extends TokenStore {
  final _store = <String, String?>{};

  static const _accessKey = 'sven.auth.access_token';

  @override
  Future<String?> readAccessToken() async => _store[_accessKey];
  @override
  Future<String?> readRefreshToken() async => null;
  @override
  Future<void> writeAccessToken(String token) async =>
      _store[_accessKey] = token;
  @override
  Future<void> writeRefreshToken(String token) async {}
  @override
  Future<String?> readUserId() async => null;
  @override
  Future<void> writeUserId(String userId) async {}
  @override
  Future<String?> readUsername() async => null;
  @override
  Future<void> writeUsername(String username) async {}
  @override
  Future<void> writeAutoLogin(String username, String password) async {}
  @override
  Future<({String username, String password})?> readAutoLogin() async => null;
  @override
  Future<void> clearAutoLogin() async {}
  @override
  Future<void> clear() async => _store.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

MessagesRepository _freshRepo() =>
    MessagesRepository(db: AppDatabase(NativeDatabase.memory()));

AuthenticatedClient _client(int statusCode) => AuthenticatedClient(
      client: MockClient((_) async => http.Response(
            jsonEncode({'ok': true}),
            statusCode,
            headers: {'content-type': 'application/json'},
          )),
      tokenStore: _InMemoryTokenStore(),
    );

AuthenticatedClient _syncAwareClient() => AuthenticatedClient(
      client: MockClient((req) async {
        final path = req.url.path;
        if (path == '/v1/chats') {
          return http.Response(
            jsonEncode({
              'data': {
                'rows': [
                  {
                    'id': 'chat-1',
                    'name': 'Thread One',
                    'type': 'dm',
                    'message_count': 1,
                    'updated_at': DateTime.now().toIso8601String(),
                  },
                ],
                'has_more': false,
              },
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }

        if (path == '/v1/chats/chat-1/messages') {
          return http.Response(
            jsonEncode({
              'data': {
                'rows': [
                  {
                    'id': 'msg-1',
                    'role': 'assistant',
                    'text': 'hello from sync',
                    'created_at': DateTime.now().toIso8601String(),
                    'chat_id': 'chat-1',
                    'content_type': 'text',
                    'status': 'sent',
                  },
                ],
                'has_more': false,
              },
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }

        return http.Response(
          jsonEncode({'error': 'not found'}),
          404,
          headers: {'content-type': 'application/json'},
        );
      }),
      tokenStore: _InMemoryTokenStore(),
    );

AuthenticatedClient _failingChatsClient() => AuthenticatedClient(
      client: MockClient((req) async {
        if (req.url.path == '/v1/chats') {
          return http.Response(
            jsonEncode({'error': 'temporary'}),
            503,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response(
          jsonEncode({'ok': true}),
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
      tokenStore: _InMemoryTokenStore(),
    );

// Enqueue items directly through the repository (bypasses connectivity check).
Future<void> _enqueue(
  MessagesRepository repo,
  String id,
  String chatId,
  String text,
) =>
    repo.enqueueOutbox(
      id: id,
      chatId: chatId,
      text: text,
      queuedAt: DateTime.now().millisecondsSinceEpoch,
    );

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

void main() {
  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
  });

  group('SyncService — drain (client = null)', () {
    test('drain() is a no-op when no client has been set', () async {
      final repo = _freshRepo();
      final svc = SyncService(repository: repo);
      await _enqueue(repo, 'o1', 't1', 'msg');
      await svc.drain();
      // Item must still be in outbox — nothing was delivered.
      expect((await repo.getAllOutboxItems()).length, 1);
      expect(svc.isDraining, isFalse);
    });
  });

  group('SyncService — drain (HTTP 200)', () {
    late MessagesRepository repo;
    late SyncService svc;

    setUp(() {
      repo = _freshRepo();
      svc = SyncService(repository: repo)..setClient(_client(200));
    });

    test('drain() removes a successfully delivered item', () async {
      await _enqueue(repo, 'o1', 't1', 'hello');
      await svc.drain();
      expect(await repo.getAllOutboxItems(), isEmpty);
    });

    test('pendingCount is 0 after all items delivered', () async {
      await _enqueue(repo, 'o1', 't1', 'a');
      await _enqueue(repo, 'o2', 't1', 'b');
      await svc.drain();
      expect(svc.pendingCount, 0);
    });

    test('lastSynced is updated after successful delivery', () async {
      expect(svc.lastSynced, isNull);
      await _enqueue(repo, 'o1', 't1', 'msg');
      await svc.drain();
      expect(svc.lastSynced, isNotNull);
    });

    test('isDraining is false after drain completes', () async {
      await _enqueue(repo, 'o1', 't1', 'msg');
      await svc.drain();
      expect(svc.isDraining, isFalse);
    });

    test('drain() on empty outbox is a safe no-op', () async {
      await svc.drain();
      expect(svc.pendingCount, 0);
      expect(svc.isDraining, isFalse);
    });
  });

  group('SyncService — drain (HTTP 500)', () {
    late MessagesRepository repo;
    late SyncService svc;

    setUp(() {
      repo = _freshRepo();
      svc = SyncService(repository: repo)..setClient(_client(500));
    });

    test('failed delivery increments attemptCount', () async {
      await _enqueue(repo, 'o1', 't1', 'msg');
      await svc.drain();
      final items = await repo.getAllOutboxItems();
      expect(items.first.attemptCount, 1);
    });

    test('item stays in outbox after failed delivery', () async {
      await _enqueue(repo, 'o1', 't1', 'msg');
      await svc.drain();
      expect((await repo.getAllOutboxItems()).length, 1);
    });

    test('lastSynced remains null after failed delivery', () async {
      await _enqueue(repo, 'o1', 't1', 'msg');
      await svc.drain();
      expect(svc.lastSynced, isNull);
    });
  });

  group('SyncService — max attempts (abandon logic)', () {
    late MessagesRepository repo;
    late SyncService svc;

    setUp(() {
      repo = _freshRepo();
      // Use 200-returning client so drain doesn't quit for network reasons;
      // we pre-set attempt counts manually to trigger the abandon path.
      svc = SyncService(repository: repo)..setClient(_client(200));
    });

    test('item at _kMaxAttempts (5) is abandoned and deleted on next drain',
        () async {
      await _enqueue(repo, 'o1', 't1', 'old message');
      // Manually bump attempt count to 5 (the threshold).
      for (var i = 0; i < 5; i++) {
        await repo.incrementOutboxAttemptCount('o1');
      }
      await svc.drain();
      // Item must be silently dropped — not re-delivered.
      expect(await repo.getAllOutboxItems(), isEmpty);
      expect(svc.pendingCount, 0);
    });

    test('item at _kMaxAttempts - 1 (4 attempts) is still tried', () async {
      await _enqueue(repo, 'o1', 't1', 'almost dead');
      for (var i = 0; i < 4; i++) {
        await repo.incrementOutboxAttemptCount('o1');
      }
      await svc.drain();
      // 4 attempts < 5 threshold → delivered successfully (200) → removed.
      expect(await repo.getAllOutboxItems(), isEmpty);
    });
  });

  group('SyncService — purgeFor', () {
    late MessagesRepository repo;
    late SyncService svc;

    setUp(() {
      repo = _freshRepo();
      svc = SyncService(repository: repo);
    });

    test('purgeFor removes items for the specified chatId', () async {
      await _enqueue(repo, 'o1', 't1', 'a');
      await _enqueue(repo, 'o2', 't2', 'b');
      await _enqueue(repo, 'o3', 't1', 'c');
      await svc.purgeFor('t1');
      final remaining = await repo.getAllOutboxItems();
      expect(remaining.length, 1);
      expect(remaining.first.chatId, 't2');
    });

    test('pendingCount updated after purgeFor', () async {
      // Seed pendingCount by calling drain first (which refreshes count).
      await _enqueue(repo, 'o1', 't1', 'a');
      await _enqueue(repo, 'o2', 't2', 'b');
      svc.setClient(_client(500)); // don't deliver
      await svc.drain(); // refreshes _pendingCount to 2
      await svc.purgeFor('t1');
      expect(svc.pendingCount, 1);
    });

    test('purgeFor with no matching items is a safe no-op', () async {
      await _enqueue(repo, 'o1', 't1', 'a');
      await svc.purgeFor('nonexistent-chat');
      expect((await repo.getAllOutboxItems()).length, 1);
    });
  });

  group('SyncService — refreshInboxCache', () {
    late MessagesRepository repo;
    late SyncService svc;

    setUp(() {
      repo = _freshRepo();
      svc = SyncService(repository: repo);
    });

    test('hydrates thread + message cache from gateway responses', () async {
      svc.setClient(_syncAwareClient());

      await svc.refreshInboxCache(threadLimit: 5);

      final threads = await repo.cachedThreads();
      final messages = await repo.cachedMessages('chat-1');
      expect(threads.length, 1);
      expect(threads.first.id, 'chat-1');
      expect(messages.length, 1);
      expect(messages.first.id, 'msg-1');
      expect(messages.first.text, 'hello from sync');
    });

    test('swallows listChats failure without throwing', () async {
      svc.setClient(_failingChatsClient());

      await expectLater(
        svc.refreshInboxCache(),
        completes,
      );

      final threads = await repo.cachedThreads();
      expect(threads, isEmpty);
    });
  });
}
