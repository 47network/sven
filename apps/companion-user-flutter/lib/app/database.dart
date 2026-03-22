// lib/app/database.dart
//
// Drift (SQLite) database for Sven.  Provides persistent local storage for
// chat threads and messages so the app can browse conversations offline.
//
// Schema version 1.
//
// NOTE: database.g.dart is hand-written (drift_dev conflicts with freezed
// over the `build` package; code generation is deferred to a future sprint
// when the dependency conflict is resolved or freezed 3.x is adopted).
// See docs/adr/006-drift-local-db.md for rationale.

import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

part 'database.g.dart';

// ─────────────────────────── Tables ────────────────────────────────────────

/// Local cache of chat thread metadata (mirrors [ChatThreadSummary]).
class DbChatThreads extends Table {
  TextColumn get id => text()();
  TextColumn get title => text()();
  TextColumn get lastMessage => text().withDefault(const Constant(''))();
  IntColumn get updatedAt => integer()(); // epoch milliseconds
  IntColumn get unreadCount => integer().withDefault(const Constant(0))();
  TextColumn get type => text().withDefault(const Constant('dm'))();
  TextColumn get channel => text().nullable()();
  IntColumn get messageCount => integer().withDefault(const Constant(0))();
  BoolColumn get isPinned => boolean().withDefault(const Constant(false))();
  BoolColumn get isArchived => boolean().withDefault(const Constant(false))();
  TextColumn get tag => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

/// Local cache of individual chat messages (mirrors [ChatMessage]).
class DbChatMessages extends Table {
  TextColumn get id => text()();
  TextColumn get chatId => text()();
  TextColumn get role => text()(); // 'user' | 'assistant'
  TextColumn get content => text()(); // message body
  IntColumn get timestamp => integer()(); // epoch milliseconds
  TextColumn get status => text().withDefault(const Constant('sent'))();
  TextColumn get senderName => text().nullable()();
  TextColumn get contentType => text().withDefault(const Constant('text'))();
  BoolColumn get isEdited => boolean().withDefault(const Constant(false))();

  @override
  Set<Column> get primaryKey => {id};
}

/// Persistent outbox for messages that were composed while offline.
///
/// When the device reconnects, [SyncService] drains this table and
/// attempts to deliver each message in order.  Rows are deleted on
/// successful delivery.
class DbOutboxMessages extends Table {
  TextColumn get id => text()();
  TextColumn get chatId => text()();
  TextColumn get body => text()();
  IntColumn get queuedAt => integer()(); // epoch milliseconds
  IntColumn get attemptCount => integer().withDefault(const Constant(0))();

  @override
  Set<Column> get primaryKey => {id};
}

// ─────────────────────────── Database ──────────────────────────────────────

@DriftDatabase(tables: [DbChatThreads, DbChatMessages, DbOutboxMessages])
class AppDatabase extends _$AppDatabase {
  /// Production constructor — opens (or creates) the `sven_app.sqlite3` file
  /// via drift_flutter's platform-appropriate path helper.
  AppDatabase([QueryExecutor? executor])
      : super(executor ?? driftDatabase(name: 'sven_app'));

  @override
  int get schemaVersion => 2;

  /// Schema migration strategy.
  ///
  /// v1 → v2: add the [dbOutboxMessages] table for persistent offline queue.
  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) async => m.createAll(),
        onUpgrade: (m, from, to) async {
          if (from < 2) {
            await m.createTable(dbOutboxMessages);
          }
        },
      );

  // ── Thread queries ────────────────────────────────────────────────────

  /// All threads ordered by most-recently-updated first.
  Future<List<DbChatThread>> getAllThreads() => (select(dbChatThreads)
        ..orderBy([
          (t) => OrderingTerm(
                expression: t.updatedAt,
                mode: OrderingMode.desc,
              ),
        ]))
      .get();

  /// Fetch a single thread by id, or null if absent.
  Future<DbChatThread?> getThread(String id) =>
      (select(dbChatThreads)..where((t) => t.id.equals(id))).getSingleOrNull();

  /// Insert or fully replace a thread row.
  Future<void> upsertThread(DbChatThreadsCompanion companion) =>
      into(dbChatThreads).insertOnConflictUpdate(companion);

  /// Batch upsert — efficient for syncing a full page of threads.
  Future<void> upsertThreads(
    List<DbChatThreadsCompanion> companions,
  ) =>
      batch((b) {
        for (final c in companions) {
          b.insert(dbChatThreads, c, mode: InsertMode.insertOrReplace);
        }
      });

  /// Delete a thread (messages are NOT cascade-deleted — call
  /// [deleteMessagesForThread] first if needed).
  Future<int> deleteThread(String id) =>
      (delete(dbChatThreads)..where((t) => t.id.equals(id))).go();

  // ── Message queries ───────────────────────────────────────────────────

  /// All messages for a thread, oldest first.
  Future<List<DbChatMessage>> getMessagesForThread(String chatId) =>
      (select(dbChatMessages)
            ..where((m) => m.chatId.equals(chatId))
            ..orderBy([
              (m) => OrderingTerm(expression: m.timestamp),
            ]))
          .get();

  /// Insert or fully replace a message row.
  Future<void> upsertMessage(DbChatMessagesCompanion companion) =>
      into(dbChatMessages).insertOnConflictUpdate(companion);

  /// Batch upsert — efficient for writing a full messages page.
  Future<void> upsertMessages(
    List<DbChatMessagesCompanion> companions,
  ) =>
      batch((b) {
        for (final c in companions) {
          b.insert(dbChatMessages, c, mode: InsertMode.insertOrReplace);
        }
      });

  /// Delete all messages belonging to a thread.
  Future<int> deleteMessagesForThread(String chatId) =>
      (delete(dbChatMessages)..where((m) => m.chatId.equals(chatId))).go();

  // ── Outbox (offline queue) queries ────────────────────────────────────────

  /// All outbox items ordered from oldest to newest (delivery order).
  Future<List<DbOutboxMessage>> getAllOutboxItems() => (select(dbOutboxMessages)
        ..orderBy([(o) => OrderingTerm(expression: o.queuedAt)]))
      .get();

  /// Insert a new outbox item.
  Future<void> insertOutboxItem(DbOutboxMessagesCompanion companion) =>
      into(dbOutboxMessages).insertOnConflictUpdate(companion);

  /// Permanently remove an outbox item (called after successful delivery).
  Future<int> deleteOutboxItem(String id) =>
      (delete(dbOutboxMessages)..where((o) => o.id.equals(id))).go();

  /// Remove all outbox items for a given chat (called when thread page
  /// drains its in-memory queue before they can be acked by [SyncService]).
  Future<int> purgeOutboxFor(String chatId) =>
      (delete(dbOutboxMessages)..where((o) => o.chatId.equals(chatId))).go();

  /// Increment the delivery attempt counter for a given item.
  Future<void> incrementOutboxAttemptCount(String id) => (update(
        dbOutboxMessages,
      )..where((o) => o.id.equals(id)))
          .write(DbOutboxMessagesCompanion.custom(
        attemptCount: dbOutboxMessages.attemptCount + const Constant(1),
      ));
}
