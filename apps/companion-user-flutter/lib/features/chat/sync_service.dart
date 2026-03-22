// lib/features/chat/sync_service.dart
//
// Background sync service for Sven.
//
// Manages a *persistent* offline message queue stored in SQLite
// ([AppDatabase.dbOutboxMessages]).  Messages added to the queue via
// [enqueue] survive app restarts.  The queue is drained automatically:
//
//   • Immediately after [init] (if the device is online).
//   • Whenever the app returns to the foreground (WidgetsBindingObserver).
//   • Whenever connectivity is restored after a period of being offline.
//
// Call [purgeFor] from a chat thread page *before* it drains its own
// in-memory queue so that the same messages are not double-delivered.
//
// Usage:
//   final svc = SyncService(repository: sl<MessagesRepository>());
//   svc.setClient(authClient);   // called once auth client is ready
//   await svc.init();
//
// See also: [AppDatabase.dbOutboxMessages], [MessagesRepository], ADR 006.

import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';

import '../../app/authenticated_client.dart';
import '../../app/database.dart' show DbOutboxMessage;
import '../../config/env_config.dart';
import 'chat_service.dart';
import 'messages_repository.dart';

/// Maximum number of delivery attempts before a message is abandoned.
const _kMaxAttempts = 5;

/// API base for outbox delivery (same dart-define as [ChatService]).
final _kApiBase = EnvConfig.apiBase;

// ─────────────────────────────────────────────────────────────────────────────

/// Persistent offline-message queue with background sync.
///
/// [SyncService] is a [ChangeNotifier] — widgets/providers can listen to it
/// and rebuild when [pendingCount] or [lastSynced] change.
class SyncService extends ChangeNotifier with WidgetsBindingObserver {
  SyncService({required MessagesRepository repository}) : _repo = repository;

  final MessagesRepository _repo;
  AuthenticatedClient? _client;

  // ── Observable state ──────────────────────────────────────────────────────

  /// Number of messages currently waiting in the persistent outbox.
  int get pendingCount => _pendingCount;
  int _pendingCount = 0;

  /// Timestamp of the last successful message delivery (any chat).
  DateTime? get lastSynced => _lastSynced;
  DateTime? _lastSynced;

  /// True while a drain pass is in progress.
  bool get isDraining => _isDraining;
  bool _isDraining = false;

  // ── Internal ──────────────────────────────────────────────────────────────

  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  bool _initialized = false;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /// Provide the authenticated HTTP client used for delivery.
  ///
  /// Must be called before the first [drain] attempt.  Safe to call multiple
  /// times (replaces the current client, e.g. after token refresh).
  void setClient(AuthenticatedClient client) {
    _client = client;
  }

  /// Start listening for connectivity / lifecycle events and attempt an
  /// initial drain.  Idempotent — safe to call more than once.
  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    WidgetsBinding.instance.addObserver(this);

    // Seed the pending count from the DB.
    final items = await _repo.getAllOutboxItems();
    _pendingCount = items.length;
    notifyListeners();

    // Subscribe to connectivity changes.
    _connectivitySub =
        Connectivity().onConnectivityChanged.listen(_onConnectivityChanged);

    // Drain immediately if we are already online.
    final current = await Connectivity().checkConnectivity();
    if (!_isOffline(current)) {
      unawaited(refreshInboxCache());
      unawaited(drain());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _connectivitySub?.cancel();
    super.dispose();
  }

  // ── WidgetsBindingObserver ────────────────────────────────────────────────

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(refreshInboxCache());
      unawaited(drain());
    }
  }

  // ── Queue management ──────────────────────────────────────────────────────

  /// Add a message to the persistent outbox.
  ///
  /// Immediately attempts a drain if the device is online.
  Future<void> enqueue(String chatId, String text) async {
    final id = 'outbox-${chatId.hashCode.toUnsigned(32).toRadixString(16)}-'
        '${DateTime.now().millisecondsSinceEpoch}';
    await _repo.enqueueOutbox(
      id: id,
      chatId: chatId,
      text: text,
      queuedAt: DateTime.now().millisecondsSinceEpoch,
    );
    _pendingCount++;
    notifyListeners();

    // Try to deliver immediately if online.
    final current = await Connectivity().checkConnectivity();
    if (!_isOffline(current)) unawaited(drain());
  }

  /// Remove all outbox entries for [chatId].
  ///
  /// Call this from a chat-thread page *before* it drains its own in-memory
  /// queue (which was already enqueued here), so the messages are not sent
  /// twice when the thread page and the sync service are both online.
  Future<void> purgeFor(String chatId) async {
    final purged = await _repo.purgeOutboxFor(chatId);
    if (purged > 0) {
      _pendingCount = (await _repo.getAllOutboxItems()).length;
      notifyListeners();
    }
  }

  // ── Drain ─────────────────────────────────────────────────────────────────

  /// Attempt to deliver all queued messages.
  ///
  /// Only one drain runs at a time (concurrent calls are no-ops).
  /// Messages that repeatedly fail are dropped after [_kMaxAttempts] attempts.
  Future<void> drain() async {
    if (_isDraining || _client == null) return;
    _isDraining = true;
    notifyListeners();

    try {
      final items = await _repo.getAllOutboxItems();
      for (final item in items) {
        if (item.attemptCount >= _kMaxAttempts) {
          // Give up — remove abandoned message.
          await _repo.deleteOutboxItem(item.id);
          _pendingCount = (_pendingCount - 1).clamp(0, _pendingCount);
          notifyListeners();
          continue;
        }

        final delivered = await _trySend(item);
        if (delivered) {
          await _repo.deleteOutboxItem(item.id);
          _pendingCount = (_pendingCount - 1).clamp(0, _pendingCount);
          _lastSynced = DateTime.now();
          notifyListeners();
        } else {
          await _repo.incrementOutboxAttemptCount(item.id);
        }
      }
    } finally {
      // Refresh count to stay accurate after any error paths.
      final remaining = await _repo.getAllOutboxItems();
      _pendingCount = remaining.length;
      _isDraining = false;
      notifyListeners();
    }
  }

  /// Refresh locally cached threads/messages from the gateway.
  ///
  /// This keeps inbox history fresh when connectivity returns or the app
  /// resumes, including reads from widgets/notifications that occur between
  /// active foreground sessions.
  Future<void> refreshInboxCache({int threadLimit = 20}) async {
    if (_client == null) return;

    try {
      final chatService = ChatService(client: _client!, repo: _repo);
      final page = await chatService.listChats(limit: threadLimit, offset: 0);
      for (final thread in page.threads) {
        // Best-effort per thread; one failed fetch should not block others.
        try {
          await chatService.listMessages(thread.id, limit: 30);
        } catch (_) {}
      }
    } catch (_) {
      // Non-fatal. Outbox drain and foreground UX should continue unaffected.
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  Future<bool> _trySend(DbOutboxMessage item) async {
    try {
      final uri = Uri.parse(
          '$_kApiBase/v1/chats/${Uri.encodeComponent(item.chatId)}/messages');
      final response = await _client!.postJson(uri, {'text': item.body});
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (_) {
      return false;
    }
  }

  void _onConnectivityChanged(List<ConnectivityResult> results) {
    if (!_isOffline(results)) {
      unawaited(refreshInboxCache());
      unawaited(drain());
    }
  }

  static bool _isOffline(List<ConnectivityResult> results) =>
      results.isEmpty || results.every((r) => r == ConnectivityResult.none);
}
