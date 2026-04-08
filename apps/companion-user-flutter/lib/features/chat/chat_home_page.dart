import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/authenticated_client.dart';
import '../../app/service_locator.dart';
import '../../app/sven_app_icon.dart';
import 'messages_repository.dart';
import '../../app/sven_tokens.dart';
import '../../features/memory/memory_service.dart';
import '../../features/memory/sven_avatar.dart';
import 'chat_list_panel.dart';
import 'chat_models.dart';
import 'sync_service.dart';
import 'chat_service.dart';
import 'chat_sse_service.dart';
import 'chat_thread_page.dart';
import 'prompt_templates_service.dart';
import '../../app/skeleton.dart';
import '../entity/sven_entity_page.dart';

class ChatHomePage extends StatefulWidget {
  const ChatHomePage({
    super.key,
    required this.visualMode,
    required this.motionLevel,
    required this.avatarMode,
    required this.onLogout,
    required this.client,
    this.onOpenSettings,
    this.memoryService,
    this.responseLength = ResponseLength.balanced,
    this.promptTemplatesService,
    this.archivedIds = const {},
    this.threadTags = const {},
    this.onToggleArchive,
    this.onSetTag,
    this.voicePersonality = VoicePersonality.friendly,
    this.onAvatarChanged,
    this.syncService,
  });

  final VisualMode visualMode;
  final MotionLevel motionLevel;
  final AvatarMode avatarMode;
  final ValueChanged<AvatarMode>? onAvatarChanged;
  final VoidCallback onLogout;
  final VoidCallback? onOpenSettings;
  final AuthenticatedClient client;
  final MemoryService? memoryService;
  final ResponseLength responseLength;
  final PromptTemplatesService? promptTemplatesService;
  final Set<String> archivedIds;
  final Map<String, ConversationTag> threadTags;
  final ValueChanged<String>? onToggleArchive;
  final void Function(String id, ConversationTag? tag)? onSetTag;
  final VoicePersonality voicePersonality;
  final SyncService? syncService;

  @override
  State<ChatHomePage> createState() => _ChatHomePageState();
}

class _ChatHomePageState extends State<ChatHomePage> {
  late final ChatService _chatService;
  List<ChatThreadSummary> _threads = [];
  bool _loading = true;
  String? _error;
  String? _selectedId;

  // Pagination state
  bool _hasMoreChats = false;
  bool _loadingMore = false;
  static const _pageSize = 40;

  // SSE for real-time home updates (new chats, approval state changes)
  ChatSseService? _sseService;
  StreamSubscription<SseEvent>? _sseSub;
  Timer? _fallbackPollTimer;
  bool _sseActive = false;

  @override
  void initState() {
    super.initState();
    _chatService = ChatService(
      client: widget.client,
      repo: sl<MessagesRepository>(),
    );
    _loadChats();
    _startSse();
  }

  @override
  void dispose() {
    _stopSse();
    super.dispose();
  }

  // ── SSE ──────────────────────────────────────────────────────────────────

  void _startSse() {
    _sseService = ChatSseService(client: widget.client);
    _sseSub = _sseService!.events.listen(_onSseEvent);
    _sseService!.connect();

    // Keep a lightweight poll even when SSE is healthy so thread previews still
    // catch up if the stream misses an event or reconnects mid-session.
    _fallbackPollTimer = Timer.periodic(
      const Duration(seconds: 10),
      (_) => _loadChats(silent: true),
    );
  }

  void _stopSse() {
    _sseSub?.cancel();
    _sseSub = null;
    _sseService?.dispose();
    _sseService = null;
    _fallbackPollTimer?.cancel();
    _fallbackPollTimer = null;
    _sseActive = false;
  }

  void _onSseEvent(SseEvent event) {
    if (!mounted) return;
    switch (event.type) {
      case 'heartbeat':
        _sseActive = true;
      case 'message':
      case 'approval':
        // Any real event means the chat list may have changed.
        _loadChats(silent: true);
    }
  }

  Future<void> _loadChats({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final page = await _chatService.listChats(limit: _pageSize);
      if (!mounted) return;
      setState(() {
        _threads = page.threads;
        _hasMoreChats = page.hasMore;
        _loading = false;
        if (_selectedId == null && page.threads.isNotEmpty) {
          _selectedId = page.threads.first.id;
        }
      });
      // Warm-up: preload the top 3 most-recent threads in the background so
      // opening any of them for the first time feels instant.
      for (final t in page.threads.take(3)) {
        unawaited(_chatService.preloadAdjacentThreads(t.id));
      }
    } catch (e) {
      if (!mounted) return;
      if (!silent) {
        setState(() {
          _loading = false;
          _error = e.toString();
        });
      }
    }
  }

  /// Load the next page of chats and append to the existing list.
  Future<void> _loadMoreChats() async {
    if (_loadingMore || !_hasMoreChats) return;
    _loadingMore = true;
    try {
      final page = await _chatService.listChats(
        limit: _pageSize,
        offset: _threads.length,
      );
      if (!mounted) return;
      setState(() {
        _threads = [..._threads, ...page.threads];
        _hasMoreChats = page.hasMore;
      });
    } catch (_) {
      // Silently fail — user can scroll again to retry
    } finally {
      _loadingMore = false;
    }
  }

  void _selectThread(ChatThreadSummary thread, {bool push = false}) {
    setState(() => _selectedId = thread.id);
    if (!push) return;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _ThreadScaffold(
          thread: thread,
          chatService: _chatService,
          visualMode: widget.visualMode,
          motionLevel: widget.motionLevel,
          responseLength: widget.responseLength,
          promptTemplatesService: widget.promptTemplatesService,
          voicePersonality: widget.voicePersonality,
          syncService: widget.syncService,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;
    final isNarrow = MediaQuery.of(context).size.width < 900;

    Widget body;

    if (_loading && _threads.isEmpty) {
      body = ChatListSkeleton(
        visualMode: widget.visualMode,
        motionLevel: widget.motionLevel,
      );
    } else if (_error != null && _threads.isEmpty) {
      body = Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Theme.of(context)
                      .colorScheme
                      .error
                      .withValues(alpha: 0.1),
                ),
                child: Icon(Icons.cloud_off_rounded,
                    size: 28, color: Theme.of(context).colorScheme.error),
              ),
              const SizedBox(height: 20),
              Text(
                'Failed to load chats',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              Text(
                _error!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: tokens.onSurface.withValues(alpha: 0.5),
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: _loadChats,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    } else if (_threads.isEmpty) {
      body = _buildEmptyState(context, tokens, cinematic);
    } else {
      final selected = _threads.firstWhere(
        (t) => t.id == _selectedId,
        orElse: () => _threads.first,
      );
      final listPanel = ChatListPanel(
        threads: _threads,
        selectedId: _selectedId,
        onSelect: (thread) => _selectThread(thread, push: isNarrow),
        chatService: _chatService,
        visualMode: widget.visualMode,
        onRefresh: () => _loadChats(),
        onDeleted: (id) {
          setState(() {
            _threads.removeWhere((t) => t.id == id);
            if (_selectedId == id) {
              _selectedId = _threads.isNotEmpty ? _threads.first.id : null;
            }
          });
        },
        onRenamed: (id, newName) {
          setState(() {
            final idx = _threads.indexWhere((t) => t.id == id);
            if (idx >= 0) {
              _threads[idx] = ChatThreadSummary(
                id: _threads[idx].id,
                title: newName,
                lastMessage: _threads[idx].lastMessage,
                updatedAt: _threads[idx].updatedAt,
                unreadCount: _threads[idx].unreadCount,
                type: _threads[idx].type,
                channel: _threads[idx].channel,
                messageCount: _threads[idx].messageCount,
                isPinned: _threads[idx].isPinned,
              );
            }
          });
        },
        onTogglePin: (id) {
          HapticFeedback.lightImpact();
          setState(() {
            final idx = _threads.indexWhere((t) => t.id == id);
            if (idx >= 0) {
              final t = _threads[idx];
              _threads[idx] = ChatThreadSummary(
                id: t.id,
                title: t.title,
                lastMessage: t.lastMessage,
                updatedAt: t.updatedAt,
                unreadCount: t.unreadCount,
                type: t.type,
                channel: t.channel,
                messageCount: t.messageCount,
                isPinned: !t.isPinned,
              );
            }
          });
        },
        archivedIds: widget.archivedIds,
        threadTags: widget.threadTags,
        onToggleArchive: widget.onToggleArchive,
        onSetTag: widget.onSetTag,
        hasMore: _hasMoreChats,
        onLoadMore: _loadMoreChats,
        syncService: widget.syncService,
      );

      if (isNarrow) {
        body = listPanel;
      } else {
        final threadPanel = ChatThreadPage(
          key: ValueKey(selected.id),
          thread: selected,
          chatService: _chatService,
          showHeader: false,
          visualMode: widget.visualMode,
          motionLevel: widget.motionLevel,
          responseLength: widget.responseLength,
          promptTemplatesService: widget.promptTemplatesService,
          voicePersonality: widget.voicePersonality,
          syncService: widget.syncService,
        );
        body = Row(
          children: [
            SizedBox(width: 320, child: listPanel),
            VerticalDivider(
              width: 1,
              color: cinematic
                  ? Colors.white.withValues(alpha: 0.06)
                  : Colors.black.withValues(alpha: 0.06),
            ),
            Expanded(child: threadPanel),
          ],
        );
      }
    }

    return body;
  }

  Widget _buildEmptyState(
    BuildContext context,
    SvenModeTokens tokens,
    bool cinematic,
  ) {
    final ms = widget.memoryService;
    final userName = ms?.userName ?? '';
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ms != null
                ? ListenableBuilder(
                    listenable: ms,
                    builder: (_, __) => SvenGreeting(
                      visualMode: widget.visualMode,
                      motionLevel: widget.motionLevel,
                      userName: ms.userName,
                      avatarMode: widget.avatarMode,
                    ),
                  )
                : SvenGreeting(
                    visualMode: widget.visualMode,
                    motionLevel: widget.motionLevel,
                    userName: userName,
                    avatarMode: widget.avatarMode,
                  ),
            if (widget.onAvatarChanged != null) ...[
              const SizedBox(height: 24),
              OutlinedButton.icon(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => SvenEntityPage(
                      currentMode: widget.avatarMode,
                      onChanged: widget.onAvatarChanged!,
                      visualMode: widget.visualMode,
                      motionLevel: widget.motionLevel,
                      personality: widget.voicePersonality,
                    ),
                  ),
                ),
                icon: const Icon(Icons.auto_awesome_rounded, size: 16),
                label: Text(
                    '${widget.avatarMode.icon}\u2002Meet ${widget.avatarMode.entityName}\u2002→'),
                style: OutlinedButton.styleFrom(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(30)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Scaffold wrapper for pushed thread on narrow screens — premium back nav.
class _ThreadScaffold extends StatefulWidget {
  const _ThreadScaffold({
    required this.thread,
    required this.chatService,
    required this.visualMode,
    required this.motionLevel,
    this.responseLength = ResponseLength.balanced,
    this.promptTemplatesService,
    this.voicePersonality = VoicePersonality.friendly,
    this.syncService,
  });

  final ChatThreadSummary thread;
  final ChatService chatService;
  final VisualMode visualMode;
  final MotionLevel motionLevel;
  final ResponseLength responseLength;
  final PromptTemplatesService? promptTemplatesService;
  final VoicePersonality voicePersonality;
  final SyncService? syncService;

  @override
  State<_ThreadScaffold> createState() => _ThreadScaffoldState();
}

class _ThreadScaffoldState extends State<_ThreadScaffold> {
  VoidCallback? _exportFn;

  void _registerExport(VoidCallback? fn) {
    if (_exportFn == fn) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _exportFn == fn) return;
      setState(() => _exportFn = fn);
    });
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;

    return Scaffold(
      backgroundColor: cinematic ? tokens.scaffold : tokens.scaffold,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Row(
          children: [
            const SvenAppIcon(size: 28, borderRadius: 9),
            const SizedBox(width: 10),
            Expanded(
              child: Hero(
                tag: 'thread_title_${widget.thread.id}',
                flightShuttleBuilder: (_, anim, dir, from, to) =>
                    DefaultTextStyle(
                  style: DefaultTextStyle.of(to).style,
                  child: to.widget,
                ),
                child: Text(
                  widget.thread.title,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: tokens.onSurface,
                  ),
                ),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Export conversation',
            icon: const Icon(Icons.ios_share_rounded),
            onPressed: _exportFn,
          ),
        ],
      ),
      body: ChatThreadPage(
        thread: widget.thread,
        chatService: widget.chatService,
        showHeader: false,
        visualMode: widget.visualMode,
        motionLevel: widget.motionLevel,
        responseLength: widget.responseLength,
        promptTemplatesService: widget.promptTemplatesService,
        voicePersonality: widget.voicePersonality,
        syncService: widget.syncService,
        onRegisterExport: _registerExport,
      ),
    );
  }
}
