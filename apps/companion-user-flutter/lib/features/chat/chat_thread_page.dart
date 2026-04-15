import 'dart:async';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/cupertino.dart'
    show
        CupertinoActionSheet,
        CupertinoActionSheetAction,
        showCupertinoModalPopup;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_math_fork/flutter_math.dart';
import 'package:markdown/markdown.dart' as md;
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'mermaid_block.dart';
import 'council_block.dart';

import 'chat_composer.dart';
import 'chat_models.dart';
import 'chat_service.dart';
import 'chat_sse_service.dart';
import 'prompt_history_service.dart';
import 'prompt_templates_service.dart';
import 'voice_service.dart';
import 'sync_service.dart';
import '../approvals/approvals_service.dart';
import '../ai/council_service.dart';
import '../memory/memory_service.dart';
import '../onboarding/tutorial_service.dart';
import '../home/streak_service.dart';
import '../../app/app_models.dart';
import '../../app/performance_tracker.dart';
import '../../app/skeleton.dart';
import '../../app/sven_app_icon.dart';
import '../../app/sven_tokens.dart';

part 'chat_thread_bubble.dart';
part 'chat_thread_helpers.dart';


class ChatThreadPage extends StatefulWidget {
  const ChatThreadPage({
    super.key,
    required this.thread,
    required this.chatService,
    this.showHeader = false,
    this.visualMode = VisualMode.classic,
    this.motionLevel = MotionLevel.full,
    this.voiceService,
    this.incognito = false,
    this.onRegisterExport,
    this.responseLength = ResponseLength.balanced,
    this.promptTemplatesService,
    this.voicePersonality = VoicePersonality.friendly,
    this.memoryService,
    this.initialDraft,
    this.tutorialService,
    this.syncService,
  });

  final ChatThreadSummary thread;
  final ChatService chatService;
  final bool showHeader;
  final VisualMode visualMode;
  final MotionLevel motionLevel;
  final VoiceService? voiceService;

  /// When true, messages are not persisted to the server and an incognito
  /// banner is shown. The conversation disappears when the page is closed.
  final bool incognito;

  /// Called with a callback that, when invoked, exports the conversation.
  /// The parent (e.g. AppBar) can store the callback and call it from an action.
  final void Function(VoidCallback exportFn)? onRegisterExport;

  /// Controls verbosity of AI responses (sent as request param).
  final ResponseLength responseLength;

  /// Shared templates service for /save and /templates slash commands.
  final PromptTemplatesService? promptTemplatesService;

  /// Controls Sven's tone/personality for all messages in this thread.
  final VoicePersonality voicePersonality;

  /// Memory service for cross-conversation context.
  final MemoryService? memoryService;

  /// Text to pre-fill into the composer when the page opens.
  final String? initialDraft;

  /// Tutorial service for first-conversation guided experience.
  final TutorialService? tutorialService;

  /// Sync service for persisting messages queued while offline.
  final SyncService? syncService;

  @override
  State<ChatThreadPage> createState() => _ChatThreadPageState();
}

class _ChatThreadPageState extends State<ChatThreadPage> {
  final _connectivity = Connectivity();
  final _scrollController = ScrollController();
  final _messages = <ChatMessage>[];
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  StreamSubscription<SseEvent>? _sseSub;
  ChatSseService? _sseService;
  Timer? _fallbackPollTimer;
  Timer? _reconnectTimer; // network-quality-aware SSE reconnect delay
  Timer? _clipboardWipeTimer; // security: auto-clear clipboard 60 s after copy
  bool _isSending = false;
  bool _hasFailed = false;
  bool _offline = false;
  bool _reconnecting = false;
  bool _agentPaused = false;
  bool _agentPauseBusy = false;
  bool _nudgeBusy = false;
  bool _loading = true;
  bool _hasMore = false;
  bool _loadingMore = false;
  String? _loadError;
  String? _pendingText;
  /// Real server-assigned chat ID once a `new-{timestamp}` thread is persisted.
  String? _resolvedChatId;
  final List<String> _offlineQueue = [];
  Stopwatch? _chatLatencyStopwatch;
  bool _firstTokenLogged = false;
  Stopwatch? _roundTripStopwatch;
  bool _roundTripLogged = false;

  // ── Streaming state ──
  String? _streamingMessageId;
  final StringBuffer _streamingBuffer = StringBuffer();
  bool _isStreaming = false;
  Timer? _typingCursorTimer;
  bool _showCursor = true;

  // ── Token speed tracking ──
  int _streamingTokenCount = 0;
  DateTime? _streamingStartedAt;
  double _streamTokensPerSec = 0.0;

  // ── Message feedback (thumbs up / down) ──
  final Map<String, MessageFeedback> _feedback = {};

  // ── Message reactions (emoji) ──
  // Map<messageId, Set<emoji>>
  final Map<String, Set<String>> _reactions = {};

  // ── Action button tracking (prevent double-click) ──
  final Set<String> _actionButtonDisabled = {};
  final ApprovalsService _approvalsService = ApprovalsService();

  // ── Prompt history (up/down arrow recall) ──
  late final PromptHistoryService _promptHistory;

  // ── Conversation mode ──
  ConversationMode _currentMode = ConversationMode.balanced;

  // ── Search ──
  bool _searchActive = false;
  String _searchQuery = '';
  final _searchController = TextEditingController();
  int _searchCursor = 0; // index within _computeSearchMatches() results

  // ── Council mode (A.5.1) ──
  bool _councilEnabled = false;
  bool _councilLoading = false;
  CouncilService? _councilService;

  // ── Request deduplication ──
  String? _lastSentText;
  DateTime? _lastSentAt;

  // ── Swipe-to-reply quote ──
  ChatMessage? _quoteMessage;

  // ── Smart reply suggestions ──
  List<String> _smartReplies = [];

  // ── Edit message ──
  String? _editPrefill;
  String? _editingMessageId;

  // ── Auto-title: generates a conversation title from the first exchange ──
  bool _autoTitled = false;
  String? _localTitle;

  // ── Sent-image thumbnails: message-id → local file paths ──
  final Map<String, List<String>> _messageImages = {};

  // ── Pinned messages ──
  final Set<String> _pinnedIds = {};
  bool _pinnedBarExpanded = true;

  // ── Scroll-to-bottom FAB ──
  bool _showScrollFab = false;
  int _unreadScrollCount = 0;

  // ── TTS read-aloud ──
  void _toggleReadAloud(ChatMessage msg) {
    final vs = widget.voiceService;
    if (vs == null) return;
    if (vs.speakingMessageId == msg.id) {
      vs.stopSpeaking();
    } else {
      vs.speak(msg.text, messageId: msg.id);
    }
  }

  void _exportConversation() {
    if (_messages.isEmpty) return;

    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: cinematic ? tokens.card : tokens.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(top: 10, bottom: 16),
              decoration: BoxDecoration(
                color: tokens.onSurface.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            ListTile(
              leading: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: tokens.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.text_snippet_rounded,
                    color: tokens.primary, size: 22),
              ),
              title: Text('Share as Text',
                  style: TextStyle(
                      color: tokens.onSurface, fontWeight: FontWeight.w500)),
              subtitle: Text('Export conversation as Markdown',
                  style: TextStyle(
                      color: tokens.onSurface.withValues(alpha: 0.5),
                      fontSize: 12)),
              onTap: () {
                Navigator.pop(ctx);
                _shareAsText();
              },
            ),
            ListTile(
              leading: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: tokens.secondary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child:
                    Icon(Icons.link_rounded, color: tokens.secondary, size: 22),
              ),
              title: Text('Share as Link',
                  style: TextStyle(
                      color: tokens.onSurface, fontWeight: FontWeight.w500)),
              subtitle: Text('Create a public read-only link',
                  style: TextStyle(
                      color: tokens.onSurface.withValues(alpha: 0.5),
                      fontSize: 12)),
              onTap: () {
                Navigator.pop(ctx);
                _shareAsLink();
              },
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  void _shareAsText() {
    final buf = StringBuffer();
    buf.writeln('# ${widget.thread.title}');
    buf.writeln();
    for (final msg in _messages) {
      if (msg.status == ChatMessageStatus.queued ||
          msg.status == ChatMessageStatus.failed) {
        continue;
      }
      final role = msg.role == 'user' ? '**You**' : '**Sven**';
      final msgTime =
          '${msg.timestamp.hour.toString().padLeft(2, '0')}:${msg.timestamp.minute.toString().padLeft(2, '0')}';
      buf.writeln('$role  _${msgTime}_');
      buf.writeln();
      buf.writeln(msg.text);
      buf.writeln();
      buf.writeln('---');
      buf.writeln();
    }
    Share.share(buf.toString(), subject: widget.thread.title);
  }

  Future<void> _shareAsLink() async {
    try {
      final url = await widget.chatService.shareChat(widget.thread.id);
      if (url.isEmpty) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not create share link'),
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }
      Share.share(
        'Check out this conversation with Sven:\n$url',
        subject: widget.thread.title,
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Share failed: $e'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  void initState() {
    super.initState();
    _promptHistory = PromptHistoryService();
    widget.promptTemplatesService?.load();
    // Defer to avoid setState on the parent while it is still building.
    if (widget.onRegisterExport != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onRegisterExport!(_exportConversation);
      });
    }
    _initConnectivity();
    _loadMessages();
    _loadAgentState();
    _loadPinnedIds();
    _loadCouncilConfig();
    _startSse();
    _scrollController.addListener(_onScroll);
    // Preload adjacent conversations so switching is instant.
    unawaited(
      widget.chatService.preloadAdjacentThreads(widget.thread.id),
    );
    // Pre-fill composer from quick action / initial draft
    if (widget.initialDraft != null && widget.initialDraft!.isNotEmpty) {
      _editPrefill = widget.initialDraft;
    }
    // Blinking cursor for streaming
    _typingCursorTimer = Timer.periodic(
      const Duration(milliseconds: 530),
      (_) {
        if (_isStreaming && mounted) {
          setState(() => _showCursor = !_showCursor);
        }
      },
    );
  }

  @override
  void didUpdateWidget(covariant ChatThreadPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.thread.id != widget.thread.id) {
      _messages.clear();
      _loading = true;
      _hasMore = false;
      _isStreaming = false;
      _streamingBuffer.clear();
      _streamingMessageId = null;
      _pinnedIds.clear();
      _stopSse();
      _loadMessages();
      _loadAgentState();
      _loadPinnedIds();
      _startSse();
      // Preload new neighbours after thread switch.
      unawaited(
        widget.chatService.preloadAdjacentThreads(widget.thread.id),
      );
    }
  }

  @override
  void dispose() {
    _connectivitySub?.cancel();
    _typingCursorTimer?.cancel();
    _reconnectTimer?.cancel();
    _clipboardWipeTimer?.cancel();
    _stopSse();
    _scrollController.dispose();
    _searchController.dispose();
    _promptHistory.dispose();
    // Auto-summarize conversation for cross-conversation context
    _autoSummarize();
    super.dispose();
  }

  // ── A.5.1 — Council mode toggle ──

  Future<void> _loadCouncilConfig() async {
    try {
      _councilService ??= CouncilService(widget.chatService.authClient);
      final config = await _councilService!.getConfig();
      if (mounted) setState(() => _councilEnabled = config.councilMode);
    } catch (_) {
      // Council API may not be available — leave toggle off.
    }
  }

  Future<void> _toggleCouncilMode() async {
    if (_councilLoading) return;
    final newValue = !_councilEnabled;
    // Optimistic update
    setState(() {
      _councilEnabled = newValue;
      _councilLoading = true;
    });
    try {
      _councilService ??= CouncilService(widget.chatService.authClient);
      await _councilService!.setEnabled(newValue);
    } catch (_) {
      // Rollback on failure
      if (mounted) {
        setState(() => _councilEnabled = !newValue);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to toggle council mode'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _councilLoading = false);
    }
  }

  /// Extract a summary of this conversation and store it in MemoryService.
  void _autoSummarize() {
    final ms = widget.memoryService;
    if (ms == null || widget.incognito) return;
    if (_messages.length < 2) return; // too short to be useful

    final messageTexts =
        _messages.where((m) => m.text.isNotEmpty).map((m) => m.text).toList();
    final summary = ms.extractSummaryFromMessages(messageTexts);
    final keywords = ms.extractTopicKeywords(messageTexts);
    ms.detectLanguage(messageTexts);
    if (summary.isNotEmpty) {
      ms.upsertConversationSummary(
        chatId: widget.thread.id,
        title: widget.thread.title,
        summary: summary,
        topicKeywords: keywords,
      );
    }
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final pos = _scrollController.position;
    // ── Scroll-to-bottom FAB visibility ──
    final nearBottom = pos.pixels >= pos.maxScrollExtent - 150;
    if (nearBottom != !_showScrollFab) {
      setState(() {
        _showScrollFab = !nearBottom;
        if (nearBottom) _unreadScrollCount = 0;
      });
    }
    // ── Pagination: load older messages when scrolled near the top ──
    if (pos.pixels <= pos.minScrollExtent + 100 && _hasMore && !_loadingMore) {
      _loadOlderMessages();
    }
  }

  Future<void> _initConnectivity() async {
    final current = await _connectivity.checkConnectivity();
    _updateConnectivity(current);
    _connectivitySub = _connectivity.onConnectivityChanged.listen(
      _updateConnectivity,
    );
  }

  void _updateConnectivity(List<ConnectivityResult> results) {
    final nextOffline =
        results.isEmpty || results.every((r) => r == ConnectivityResult.none);
    final wasOffline = _offline;
    setState(() {
      if (nextOffline && !_offline) {
        _reconnecting = true;
      }
      if (!nextOffline) {
        _reconnecting = false;
      }
      _offline = nextOffline;
    });
    if (wasOffline && !nextOffline) {
      // Network restored — restart SSE with a delay tuned to connection quality.
      _reconnectTimer?.cancel();
      final delay = _sseReconnectDelay(results);
      _reconnectTimer = Timer(delay, () {
        if (!mounted) return;
        _stopSse();
        _startSse();
        if (_offlineQueue.isNotEmpty) _drainOfflineQueue();
      });
    }
  }

  /// Returns the SSE reconnect delay for the available connection types:
  /// WiFi / Ethernet → 1 s, Mobile → 3 s, anything else → 5 s.
  Duration _sseReconnectDelay(List<ConnectivityResult> results) {
    if (results.contains(ConnectivityResult.wifi) ||
        results.contains(ConnectivityResult.ethernet)) {
      return const Duration(seconds: 1);
    }
    if (results.contains(ConnectivityResult.mobile)) {
      return const Duration(seconds: 3);
    }
    return const Duration(seconds: 5);
  }

  Future<void> _drainOfflineQueue() async {
    final toSend = List<String>.from(_offlineQueue);
    _offlineQueue.clear();
    await widget.syncService?.purgeFor(widget.thread.id);
    setState(() {
      _messages.removeWhere((m) => m.status == ChatMessageStatus.queued);
    });
    for (final text in toSend) {
      await _handleSend(text);
    }
  }

  Future<void> _loadMessages() async {
    // In incognito mode, or for a client-generated new-thread placeholder,
    // there is no server thread yet — start empty immediately.
    if (widget.incognito || widget.thread.id.startsWith('new-')) {
      if (!mounted) return;
      setState(() {
        _messages.clear();
        _hasMore = false;
        _loading = false;
        _loadError = null;
      });
      return;
    }
    try {
      final page = await widget.chatService.listMessages(widget.thread.id);
      Map<String, String> feedbackRows = const {};
      try {
        feedbackRows = await widget.chatService.listMessageFeedback(
          widget.thread.id,
        );
      } catch (_) {
        // Feedback API is best-effort; message loading must still succeed.
      }
      if (!mounted) return;
      setState(() {
        _messages
          ..clear()
          ..addAll(page.messages);
        _feedback.clear();
        for (final entry in feedbackRows.entries) {
          final parsed = _parseMessageFeedback(entry.value);
          if (parsed != null) _feedback[entry.key] = parsed;
        }
        _hasMore = page.hasMore;
        _loading = false;
        _loadError = null;
      });
      _scrollToBottom(force: true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = e.toString();
      });
    }
  }

  Future<void> _loadAgentState() async {
    if (widget.incognito) return;
    try {
      final paused = await widget.chatService.getAgentPaused(widget.thread.id);
      if (!mounted) return;
      setState(() => _agentPaused = paused);
    } catch (_) {
      // Best effort only.
    }
  }

  Future<void> _toggleAgentPause() async {
    if (_agentPauseBusy || widget.incognito) return;
    setState(() => _agentPauseBusy = true);
    try {
      final paused = _agentPaused
          ? await widget.chatService.resumeAgent(widget.thread.id)
          : await widget.chatService.pauseAgent(widget.thread.id);
      if (!mounted) return;
      setState(() => _agentPaused = paused);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Agent state update failed: $e'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _agentPauseBusy = false);
    }
  }

  bool get _isStuckForNudge {
    if (_agentPaused || _offline || _isStreaming || _nudgeBusy) return false;
    DateTime? lastUser;
    DateTime? lastAssistant;
    for (final m in _messages) {
      if (m.role == 'user') lastUser = m.timestamp;
      if (m.role == 'assistant') lastAssistant = m.timestamp;
    }
    if (lastUser == null) return false;
    if (lastAssistant != null && !lastAssistant.isBefore(lastUser)) return false;
    return DateTime.now().difference(lastUser).inSeconds > 30;
  }

  Future<void> _handleNudge() async {
    if (_nudgeBusy || widget.incognito) return;
    setState(() => _nudgeBusy = true);
    try {
      await widget.chatService.nudgeAgent(widget.thread.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Nudge sent. Retrying last message.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Nudge failed: $e'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _nudgeBusy = false);
    }
  }

  Future<void> _loadOlderMessages() async {
    if (_messages.isEmpty || _loadingMore) return;
    setState(() => _loadingMore = true);
    try {
      final oldest = _messages.first.timestamp.toIso8601String();
      final page = await widget.chatService.listMessages(
        widget.thread.id,
        before: oldest,
      );
      if (!mounted) return;
      setState(() {
        _messages.insertAll(0, page.messages);
        _hasMore = page.hasMore;
        _loadingMore = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingMore = false);
    }
  }

  void _startSse() {
    if (widget.incognito) return; // No SSE in incognito mode
    final effectiveId = _resolvedChatId ?? widget.thread.id;
    if (effectiveId.startsWith('new-')) return; // No SSE for unsaved threads
    final sseService = ChatSseService(
      client: widget.chatService.authClient,
    );
    _sseService = sseService;
    _sseSub = sseService.events.listen(
      (event) {
        if ((event.type == 'agent.paused' || event.type == 'agent.resumed') &&
            event.data != null) {
          final chatId = event.data!['chat_id'] as String?;
          if (chatId != null && chatId == effectiveId && mounted) {
            setState(() {
              _agentPaused = event.type == 'agent.paused';
            });
          }
        } else if (event.type == 'agent.nudged' && event.data != null) {
          final chatId = event.data!['chat_id'] as String?;
          if (chatId != null && chatId == effectiveId && mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Agent nudged. Retrying latest step.'),
                behavior: SnackBarBehavior.floating,
                duration: Duration(seconds: 2),
              ),
            );
          }
        } else if (event.type == 'message' && event.data != null) {
          final msg = chatMessageFromSse(event.data!);
          if (msg == null) return;
          if (msg.chatId != null && msg.chatId != effectiveId) return;
          if (!mounted) return;
          final existingIds = _messages.map((m) => m.id).toSet();
          if (!existingIds.contains(msg.id)) {
            // If we were streaming, finalize it
            if (_isStreaming && _streamingMessageId != null) {
              _finalizeStreaming();
            }
            setState(() => _messages.add(msg));
            _scrollToBottom();
            if (msg.role == 'assistant') {
              _autoTitleIfNeeded(_pendingText ?? '');
              HapticFeedback.selectionClick();
            }
            if (msg.role == 'assistant' &&
                _roundTripStopwatch != null &&
                !_roundTripLogged) {
              _roundTripLogged = true;
              final ms = _roundTripStopwatch!.elapsedMilliseconds;
              _roundTripStopwatch!.stop();
              PerformanceTracker.logChatRoundTrip(ms);
            }
          }
        } else if (event.type == 'token' && event.data != null) {
          // ── Streaming token-by-token ──
          _handleStreamingToken(event.data!);
        } else if (event.type == 'heartbeat') {
          // heartbeat received
        }
      },
      onError: (_) {
        _startFallbackPoll();
      },
    );
    sseService.connect();
    _startFallbackPoll();
  }

  void _handleStreamingToken(Map<String, dynamic> data) {
    final token = data['token'] as String? ?? '';
    final msgId = data['message_id'] as String? ?? 'stream';
    final done = data['done'] as bool? ?? false;

    if (!_isStreaming || _streamingMessageId != msgId) {
      // New streaming message — create placeholder
      _streamingBuffer.clear();
      _streamingMessageId = msgId;
      _isStreaming = true;
      // Reset token speed counters for this new stream
      _streamingTokenCount = 0;
      _streamingStartedAt = DateTime.now();
      _streamTokensPerSec = 0.0;
      if (!_firstTokenLogged) {
        _firstTokenLogged = true;
        final latencyMs = _chatLatencyStopwatch?.elapsedMilliseconds ?? 0;
        PerformanceTracker.logChatFirstToken(latencyMs);
      }
      setState(() {
        _isSending = false;
        _messages.add(ChatMessage(
          id: msgId,
          role: 'assistant',
          text: '',
          timestamp: DateTime.now(),
          status: ChatMessageStatus.streaming,
          senderName: 'Sven',
        ));
      });
    }

    _streamingBuffer.write(token);
    // Update token speed (once enough data is in for a reliable estimate)
    if (token.isNotEmpty) {
      _streamingTokenCount++;
      final elapsedMs =
          DateTime.now().difference(_streamingStartedAt!).inMilliseconds;
      if (elapsedMs > 800 && _streamingTokenCount > 2) {
        _streamTokensPerSec = _streamingTokenCount / (elapsedMs / 1000.0);
      }
    }
    final idx = _messages.indexWhere((m) => m.id == msgId);
    if (idx >= 0) {
      setState(() {
        _messages[idx] = _messages[idx].copyWith(
          text: _streamingBuffer.toString(),
          status: done ? ChatMessageStatus.sent : ChatMessageStatus.streaming,
        );
      });
    }
    _scrollToBottom();

    // Streaming TTS: speak sentence-by-sentence while tokens arrive
    if (!done &&
        token.isNotEmpty &&
        widget.voiceService?.autoReadAloud == true) {
      widget.voiceService!.speakPartial(token);
    }

    if (done) {
      _autoTitleIfNeeded(_pendingText ?? '');
      _finalizeStreaming();
    }
  }

  void _finalizeStreaming({bool cancelled = false}) {
    final streamedId = _streamingMessageId;
    _isStreaming = false;
    _streamingBuffer.clear();
    _streamingMessageId = null;
    // Reset speed stats
    _streamTokensPerSec = 0.0;
    _streamingTokenCount = 0;
    _streamingStartedAt = null;
    _chatLatencyStopwatch?.stop();
    if (_roundTripStopwatch != null && !_roundTripLogged) {
      _roundTripLogged = true;
      final ms = _roundTripStopwatch!.elapsedMilliseconds;
      _roundTripStopwatch!.stop();
      PerformanceTracker.logChatRoundTrip(ms);
    }
    // Auto-read mode: flush any remaining partial sentence from streaming buffer
    if (streamedId != null && widget.voiceService?.autoReadAloud == true) {
      widget.voiceService!.flushStreamingTtsBuffer(messageId: streamedId);
    } else {
      // Clear buffer in case auto-read was off
      widget.voiceService?.clearStreamingTtsBuffer();
    }
    // ── Partial-response preservation when cancel was triggered ──
    if (cancelled && streamedId != null && mounted) {
      final idx = _messages.indexWhere((m) => m.id == streamedId);
      if (idx >= 0) {
        final partial = _messages[idx].text.trim();
        if (partial.isEmpty) {
          // Nothing streamed — remove the empty placeholder
          setState(() => _messages.removeAt(idx));
        } else {
          // Seal the partial response so it persists like a normal message
          setState(() {
            _messages[idx] = _messages[idx].copyWith(
              text: '$partial\n\n*— generation stopped —*',
              status: ChatMessageStatus.sent,
            );
          });
        }
      }
    }
    // Show smart reply suggestions after streaming completes (not on stop)
    if (!cancelled && mounted) _updateSmartReplies();
  }

  void _stopSse() {
    _sseSub?.cancel();
    _sseService?.dispose();
    _sseSub = null;
    _sseService = null;
    _fallbackPollTimer?.cancel();
    _fallbackPollTimer = null;
  }

  void _startFallbackPoll() {
    _fallbackPollTimer?.cancel();
    // Keep a periodic refresh even while SSE is active so open threads do not
    // go stale if the stream misses a cross-device message event.
    _fallbackPollTimer = Timer.periodic(
      const Duration(seconds: 10),
      (_) => _pollNewMessages(),
    );
  }

  Future<void> _pollNewMessages() async {
    if (_offline || _loading || _messages.isEmpty) return;
    try {
      final page = await widget.chatService.listMessages(
        widget.thread.id,
        limit: 20,
      );
      if (!mounted) return;
      final existingIds = _messages.map((m) => m.id).toSet();
      final newMessages =
          page.messages.where((m) => !existingIds.contains(m.id)).toList();
      if (newMessages.isNotEmpty) {
        setState(() {
          _messages.addAll(newMessages);
        });
        _scrollToBottom();
      }
    } catch (_) {
      // Silent polling failure
    }
  }

  void _scrollToBottom({bool force = false}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      final pos = _scrollController.position;
      final nearBottom = pos.pixels >= pos.maxScrollExtent - 150;
      // If user is scrolled up and this is a new incoming message, show FAB
      // with unread count instead of forcibly jumping them away from history.
      if (!nearBottom && !force) {
        setState(() {
          _unreadScrollCount++;
          _showScrollFab = true;
        });
        return;
      }
      _scrollController.animateTo(
        pos.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    });
  }

  // ── Pinned messages helpers ─────────────────────────────────────────────

  Future<void> _loadPinnedIds() async {
    final prefs = await SharedPreferences.getInstance();
    final list =
        prefs.getStringList('pinned_${widget.thread.id}') ?? <String>[];
    if (mounted) setState(() => _pinnedIds.addAll(list));
  }

  Future<void> _savePinnedIds() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(
        'pinned_${widget.thread.id}', _pinnedIds.toList());
  }

  void _togglePin(ChatMessage msg) {
    HapticFeedback.lightImpact();
    setState(() {
      if (_pinnedIds.contains(msg.id)) {
        _pinnedIds.remove(msg.id);
      } else {
        if (_pinnedIds.length >= 3) {
          // Drop the oldest pin to make room
          _pinnedIds.remove(_pinnedIds.first);
        }
        _pinnedIds.add(msg.id);
        _pinnedBarExpanded = true;
      }
    });
    _savePinnedIds();
  }

  void _scrollToMessage(String messageId) {
    final idx = _messages.indexWhere((m) => m.id == messageId);
    if (idx < 0 || !_scrollController.hasClients) return;
    // Estimate target offset proportional to message position in list
    final fraction = _messages.length <= 1 ? 0.0 : idx / (_messages.length - 1);
    final target = _scrollController.position.maxScrollExtent * fraction;
    _scrollController.animateTo(
      target,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeInOut,
    );
  }

  Future<void> _handleSend(String text, [List<String>? imagePaths]) async {
    // ── Request deduplication: ignore identical message within 2 s ──
    final now = DateTime.now();
    if (_lastSentText == text &&
        _lastSentAt != null &&
        now.difference(_lastSentAt!).inMilliseconds < 2000) {
      return;
    }
    _lastSentText = text;
    _lastSentAt = now;

    // ── Advance tutorial on first messages ──
    if (widget.tutorialService?.shouldShowTutorial == true) {
      widget.tutorialService!.advance();
    }

    // ── Incognito mode: add user message locally, send to API without saving ──
    if (widget.incognito) {
      final userMsgId = 'local-${DateTime.now().millisecondsSinceEpoch}';
      setState(() {
        _hasFailed = false;
        _isSending = true;
        _messages.add(ChatMessage(
          id: userMsgId,
          role: 'user',
          text: text,
          timestamp: DateTime.now(),
          status: ChatMessageStatus.sent,
        ));
      });
      _scrollToBottom(force: true);
      try {
        final aiMsgId = 'ai-${DateTime.now().millisecondsSinceEpoch}';
        // Create a local placeholder assistant message
        setState(() {
          _streamingMessageId = aiMsgId;
          _streamingBuffer.clear();
          _isStreaming = true;
          _messages.add(ChatMessage(
            id: aiMsgId,
            role: 'assistant',
            text: '',
            timestamp: DateTime.now(),
            status: ChatMessageStatus.sending,
          ));
        });
        _scrollToBottom();

        // Use the chat service but ignore the returned thread ID (no history)
        final stream = widget.chatService.sendMessageIncognito(text);
        await for (final token in stream) {
          if (!mounted) return;
          _streamingBuffer.write(token);
          setState(() {
            final idx = _messages.indexWhere((m) => m.id == aiMsgId);
            if (idx >= 0) {
              _messages[idx] =
                  _messages[idx].copyWith(text: _streamingBuffer.toString());
            }
          });
          _scrollToBottom();
        }
        if (!mounted) return;
        setState(() {
          final idx = _messages.indexWhere((m) => m.id == aiMsgId);
          if (idx >= 0) {
            _messages[idx] = _messages[idx].copyWith(
              status: ChatMessageStatus.sent,
            );
          }
          _isStreaming = false;
          _isSending = false;
          _streamingMessageId = null;
          _streamingBuffer.clear();
        });
      } catch (_) {
        if (!mounted) return;
        setState(() {
          _hasFailed = true;
          _isSending = false;
          _isStreaming = false;
        });
      }
      return;
    }

    // ── Normal (persisted) mode ──
    if (_offline) {
      _offlineQueue.add(text);
      widget.syncService?.enqueue(widget.thread.id, text);
      final queuedId = 'queued-${DateTime.now().millisecondsSinceEpoch}';
      setState(() {
        _messages.add(ChatMessage(
          id: queuedId,
          role: 'user',
          text: text,
          timestamp: DateTime.now(),
          status: ChatMessageStatus.queued,
        ));
      });
      _scrollToBottom(force: true);
      return;
    }

    _chatLatencyStopwatch = Stopwatch()..start();
    _firstTokenLogged = false;
    _roundTripStopwatch = Stopwatch()..start();
    _roundTripLogged = false;
    _pendingText = text;
    // Clear any lingering smart-reply chips on new send
    if (_smartReplies.isNotEmpty) setState(() => _smartReplies = []);

    final tempId = 'temp-${DateTime.now().millisecondsSinceEpoch}';
    setState(() {
      _hasFailed = false;
      _isSending = true;
      _messages.add(
        ChatMessage(
          id: tempId,
          role: 'user',
          text: text,
          timestamp: DateTime.now(),
          status: ChatMessageStatus.sending,
        ),
      );
    });
    _scrollToBottom(force: true);
    if (imagePaths != null && imagePaths.isNotEmpty) {
      _messageImages[tempId] = imagePaths;
    }
    // Record daily activity for streak tracking (fire-and-forget)
    unawaited(StreakService.instance.recordActivity());
    // Auto-extract user preference / fact from message text
    _tryExtractMemory(text);

    try {
      // Resolve the real server chat ID: if this thread is a client-generated
      // placeholder (new-{timestamp}), create it on the server first.
      var effectiveChatId = _resolvedChatId ?? widget.thread.id;
      if (effectiveChatId.startsWith('new-')) {
        effectiveChatId = await widget.chatService.createChat();
        if (mounted) {
          setState(() => _resolvedChatId = effectiveChatId);
          _startSse(); // begin streaming subscription now that we have a real ID
        }
      }
      final sent = await widget.chatService.sendMessage(
        effectiveChatId,
        text,
        mode: _currentMode.name,
        responseLength: widget.responseLength.name,
        personality: widget.voicePersonality.name,
        memoryContext: widget.memoryService?.buildSystemPrompt(
          currentChatId: effectiveChatId,
          personality: widget.voicePersonality,
        ),
        images: imagePaths?.map((p) => XFile(p)).toList(),
      );
      if (!mounted) return;
      final isQueued = sent.status == ChatMessageStatus.queued;

      if (!isQueued && !_firstTokenLogged) {
        _firstTokenLogged = true;
        final latencyMs = _chatLatencyStopwatch?.elapsedMilliseconds ?? 0;
        PerformanceTracker.logChatFirstToken(latencyMs);
      }

      setState(() {
        final idx = _messages.indexWhere((m) => m.id == tempId);
        if (idx >= 0) {
          _messages[idx] = sent;
        }
        // Don't clear _isSending if we're about to stream
        if (!_isStreaming || isQueued) {
          _isSending = false;
        }
      });
      _chatLatencyStopwatch?.stop();
      // Non-streaming path: show smart replies immediately
      if (!_isStreaming && !isQueued && mounted) _updateSmartReplies();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _hasFailed = true;
        _isSending = false;
        final idx = _messages.indexWhere((m) => m.id == tempId);
        if (idx >= 0) {
          _messages[idx] = _messages[idx].copyWith(
            status: ChatMessageStatus.failed,
          );
        }
      });
      _chatLatencyStopwatch?.stop();
    }
  }

  void _handleCancel() {
    // Finalize streaming before setState to avoid nested setState assertion.
    // _finalizeStreaming(cancelled: true) calls its own setState for the
    // partial-response preservation.
    if (_isStreaming) {
      _finalizeStreaming(cancelled: true);
    }
    setState(() {
      _isSending = false;
      _hasFailed = false;
    });
  }

  String _actionKey(String messageId, String actionId) =>
      '$messageId:$actionId';

  bool _isActionDisabledFor(String messageId, String actionId) =>
      _actionButtonDisabled.contains(_actionKey(messageId, actionId));

  Future<void> _handleActionButton(
    ChatMessage message,
    _ActionButtonSpec button,
  ) async {
    final key = _actionKey(message.id, button.id);
    if (_actionButtonDisabled.contains(key)) return;
    setState(() => _actionButtonDisabled.add(key));

    final chatId = message.chatId ?? widget.thread.id;
    try {
      if (button.action == 'open_link' && button.url != null) {
        await launchUrl(
          Uri.parse(button.url!),
          mode: LaunchMode.externalApplication,
        );
      } else if ((button.action == 'approve' || button.action == 'reject') &&
          button.approvalId != null) {
        await _approvalsService.vote(
          id: button.approvalId!,
          decision: button.action == 'approve' ? 'approve' : 'deny',
        );
      } else if (button.action == 'run_command' && button.command != null) {
        _handleSend(button.command!);
      } else if (button.action == 'reply' && button.text != null) {
        _handleSend(button.text!);
      }

      await widget.chatService.sendA2uiInteraction(
        chatId,
        eventType: 'action',
        payload: {
          'message_id': message.id,
          'action': button.action,
          'button': {
            'id': button.id,
            'label': button.label,
            'action': button.action,
            'url': button.url,
            'command': button.command,
            'text': button.text,
            'approval_id': button.approvalId,
            'payload': button.payload,
          },
        },
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Action failed')),
      );
    }
  }

  void _handleRetry() {
    final text = _pendingText;
    if (text == null || text.isEmpty) return;
    setState(() {
      _messages.removeWhere((m) => m.status == ChatMessageStatus.failed);
    });
    _handleSend(text);
  }

  /// Auto-generate a conversation title from the first user message when
  /// the title is still a generic default (e.g. "Chat", "New conversation").
  /// Called once after the first assistant response arrives; fires-and-forgets
  /// the server rename so failure is silent and never affects the user.
  void _autoTitleIfNeeded(String rawUserText) {
    if (_autoTitled) return;
    const genericTitles = {
      'Chat',
      'New conversation',
      'New Chat',
      'Untitled',
      ''
    };
    final currentTitle = (_localTitle ?? widget.thread.title).trim();
    if (!genericTitles.contains(currentTitle)) return;
    _autoTitled = true;
    // Strip [Image: ...] / [File: ...] attachment tags — title from clean text
    final clean = rawUserText
        .replaceAll(RegExp(r'\[Image:[^\]]*\]\n?'), '')
        .replaceAll(RegExp(r'\[File:[^\]]*\][\s\S]*'), '') // strip file blocks
        .trim();
    if (clean.isEmpty) return;
    final words =
        clean.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    var title = words.take(6).join(' ');
    if (words.length > 6) title = '$title\u2026';
    if (title.length > 50) title = '${title.substring(0, 47)}\u2026';
    // Reflect in UI immediately, then persist to server in background
    setState(() => _localTitle = title);
    widget.chatService.renameChat(widget.thread.id, title).catchError((_) {});
  }

  // ── Smart reply suggestions helpers ─────────────────────────────────────

  // ── Search result navigation helpers ────────────────────────────────

  List<int> _computeSearchMatches() {
    if (_searchQuery.isEmpty) return const [];
    final q = _searchQuery.toLowerCase();
    final result = <int>[];
    for (int i = 0; i < _messages.length; i++) {
      if (_messages[i].text.toLowerCase().contains(q)) result.add(i);
    }
    return result;
  }

  void _searchNext() {
    final matches = _computeSearchMatches();
    if (matches.isEmpty) return;
    setState(() {
      _searchCursor = (_searchCursor + 1) % matches.length;
    });
    _scrollToSearchMatch(matches[_searchCursor]);
  }

  void _searchPrev() {
    final matches = _computeSearchMatches();
    if (matches.isEmpty) return;
    setState(() {
      _searchCursor = (_searchCursor - 1 + matches.length) % matches.length;
    });
    _scrollToSearchMatch(matches[_searchCursor]);
  }

  void _scrollToSearchMatch(int messageIdx) {
    if (!_scrollController.hasClients) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      final maxExt = _scrollController.position.maxScrollExtent;
      final fraction =
          _messages.length <= 1 ? 0.0 : messageIdx / (_messages.length - 1);
      _scrollController.animateTo(
        maxExt * fraction,
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOut,
      );
    });
  }

  // ── Auto-memory extraction from user messages ────────────────────────────

  static final _memoryPatterns = <RegExp>[
    RegExp(r'(?:^|[.!?\n])\s*(My name is [^.!?\n]{2,40})',
        caseSensitive: false),
    RegExp(r"(?:^|[.!?\n])\s*(I(?:'m| am) [^.!?\n]{5,60})",
        caseSensitive: false),
    RegExp(
        r'(?:^|[.!?\n])\s*(I (?:work|worked) (?:at|for|as|on) [^.!?\n]{5,60})',
        caseSensitive: false),
    RegExp(
        r'(?:^|[.!?\n])\s*(I (?:prefer|like|love|hate|dislike|enjoy|use) [^.!?\n]{5,60})',
        caseSensitive: false),
    RegExp(
        r"(?:^|[.!?\n])\s*(I(?:'m| am) (?:working|building|creating|developing) [^.!?\n]{5,60})",
        caseSensitive: false),
  ];

  void _tryExtractMemory(String userText) {
    if (widget.memoryService == null) return;
    // Skip very short or command-style messages
    if (userText.length < 10 || userText.startsWith('/')) return;
    String? matched;
    for (final p in _memoryPatterns) {
      final m = p.firstMatch(userText);
      if (m != null) {
        final g = m.group(1)?.trim();
        if (g != null && g.length >= 8) {
          matched = g;
          break;
        }
      }
    }
    if (matched == null) return;
    // Deduplicate: skip if very similar fact already stored (first 32 chars)
    final lower = matched.toLowerCase();
    final prefixLen = lower.length < 32 ? lower.length : 32;
    final prefix = lower.substring(0, prefixLen);
    final exists = widget.memoryService!.facts
        .any((f) => f.content.toLowerCase().startsWith(prefix));
    if (exists) return;
    final snippet = matched.length > 45
        ? '\u201c${matched.substring(0, 42)}…\u201d'
        : '\u201c$matched\u201d';
    widget.memoryService!.addFact(matched).then((_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.memory_rounded, size: 15, color: Colors.white),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Sven remembered: $snippet',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          duration: const Duration(seconds: 3),
          behavior: SnackBarBehavior.floating,
        ),
      );
    });
  }

  void _updateSmartReplies() {
    final assistantMsgs = _messages
        .where(
            (m) => m.role == 'assistant' && m.status == ChatMessageStatus.sent)
        .toList();
    if (assistantMsgs.isEmpty) return;
    final lastText = assistantMsgs.last.text;
    final replies = _generateSmartReplies(lastText);
    if (replies.isNotEmpty) setState(() => _smartReplies = replies);
  }

  static List<String> _generateSmartReplies(String text) {
    final lower = text.toLowerCase();
    final suggestions = <String>[];
    // Code / technical context
    if (lower.contains('```') ||
        lower.contains('function ') ||
        lower.contains('class ')) {
      suggestions
          .addAll(['Explain this step by step', 'What are the edge cases?']);
    }
    // List / enumeration context
    if (RegExp(r'\n[-*\u2022]\s').hasMatch(text) ||
        RegExp(r'\n\d+\.\s').hasMatch(text)) {
      suggestions.add('Tell me more about the first point');
    }
    // Question in assistant response
    if (lower.contains('?')) {
      suggestions.add('Yes, please go on');
    }
    // Short answer — user may want elaboration
    if (text.split(' ').length < 80) {
      suggestions.add('Can you elaborate on this?');
    }
    suggestions.add('Give me a practical example');
    return suggestions.take(3).toList();
  }

  void _copyMessage(ChatMessage msg) {
    Clipboard.setData(ClipboardData(text: msg.text));
    HapticFeedback.lightImpact();
    // Auto-wipe clipboard after 60 s (security: prevents clipboard sniffing).
    _clipboardWipeTimer?.cancel();
    _clipboardWipeTimer = Timer(const Duration(seconds: 60), () {
      Clipboard.setData(const ClipboardData(text: ''));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Clipboard cleared for security'),
          duration: Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
    });
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Copied to clipboard'),
        duration: Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _shareMessage(ChatMessage msg) {
    Share.share(msg.text, subject: 'Sven says…');
  }

  void _showMessageMenu(BuildContext context, ChatMessage msg) {
    HapticFeedback.mediumImpact();
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;

    // ── iOS: native CupertinoActionSheet ─────────────────────────────────
    if (Platform.isIOS) {
      _showMessageMenuCupertino(context, msg, tokens);
      return;
    }

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: cinematic ? const Color(0xFF0D1B2A) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: tokens.onSurface.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              // Preview snippet
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                child: Text(
                  msg.text.length > 120
                      ? '${msg.text.substring(0, 120)}…'
                      : msg.text,
                  style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.5),
                    fontSize: 13,
                  ),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const Divider(height: 1),
              _MenuAction(
                icon: Icons.copy_rounded,
                label: 'Copy',
                tokens: tokens,
                cinematic: cinematic,
                onTap: () {
                  Navigator.pop(context);
                  _copyMessage(msg);
                },
              ),
              _MenuAction(
                icon: Icons.reply_rounded,
                label: 'Reply / Quote',
                tokens: tokens,
                cinematic: cinematic,
                onTap: () {
                  Navigator.pop(context);
                  setState(() => _quoteMessage = msg);
                },
              ),
              _MenuAction(
                icon: Icons.emoji_emotions_outlined,
                label: 'React',
                tokens: tokens,
                cinematic: cinematic,
                onTap: () {
                  Navigator.pop(context);
                  _showReactionPicker(context, msg);
                },
              ),
              if (msg.role == 'user')
                _MenuAction(
                  icon: Icons.edit_outlined,
                  label: 'Edit & resend',
                  tokens: tokens,
                  cinematic: cinematic,
                  onTap: () {
                    Navigator.pop(context);
                    setState(() {
                      _editPrefill = msg.text;
                      _editingMessageId = msg.id;
                    });
                  },
                ),
              _MenuAction(
                icon: Icons.ios_share_rounded,
                label: 'Share',
                tokens: tokens,
                cinematic: cinematic,
                onTap: () {
                  Navigator.pop(context);
                  _shareMessage(msg);
                },
              ),
              if (msg.role == 'assistant' &&
                  msg.status == ChatMessageStatus.sent)
                _MenuAction(
                  icon: Icons.refresh_rounded,
                  label: 'Regenerate',
                  tokens: tokens,
                  cinematic: cinematic,
                  onTap: () {
                    Navigator.pop(context);
                    _regenerateMessage(msg);
                  },
                ),
              _MenuAction(
                icon: _pinnedIds.contains(msg.id)
                    ? Icons.push_pin_rounded
                    : Icons.push_pin_outlined,
                label: _pinnedIds.contains(msg.id) ? 'Unpin' : 'Pin message',
                tokens: tokens,
                cinematic: cinematic,
                onTap: () {
                  Navigator.pop(context);
                  _togglePin(msg);
                },
              ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }

  // ── iOS-native message context menu ────────────────────────────────────
  void _showMessageMenuCupertino(
      BuildContext context, ChatMessage msg, SvenModeTokens tokens) {
    final preview =
        msg.text.length > 80 ? '${msg.text.substring(0, 80)}\u2026' : msg.text;
    showCupertinoModalPopup<void>(
      context: context,
      builder: (_) => CupertinoActionSheet(
        title: Text(
          preview,
          style: const TextStyle(fontWeight: FontWeight.normal, fontSize: 13),
        ),
        actions: [
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.pop(context);
              _copyMessage(msg);
            },
            child: const Text('Copy'),
          ),
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.pop(context);
              setState(() => _quoteMessage = msg);
            },
            child: const Text('Reply / Quote'),
          ),
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.pop(context);
              _showReactionPicker(context, msg);
            },
            child: const Text('React'),
          ),
          if (msg.role == 'user')
            CupertinoActionSheetAction(
              onPressed: () {
                Navigator.pop(context);
                setState(() {
                  _editPrefill = msg.text;
                  _editingMessageId = msg.id;
                });
              },
              child: const Text('Edit & Resend'),
            ),
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.pop(context);
              _shareMessage(msg);
            },
            child: const Text('Share'),
          ),
          if (msg.role == 'assistant' && msg.status == ChatMessageStatus.sent)
            CupertinoActionSheetAction(
              onPressed: () {
                Navigator.pop(context);
                _regenerateMessage(msg);
              },
              child: const Text('Regenerate'),
            ),
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.pop(context);
              _togglePin(msg);
            },
            child: Text(_pinnedIds.contains(msg.id) ? 'Unpin' : 'Pin Message'),
          ),
        ],
        cancelButton: CupertinoActionSheetAction(
          isDefaultAction: true,
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
      ),
    );
  }

  void _toggleReaction(String messageId, String emoji) {
    HapticFeedback.selectionClick();
    setState(() {
      final current = _reactions[messageId] ?? {};
      final updated = Set<String>.from(current);
      if (updated.contains(emoji)) {
        updated.remove(emoji);
      } else {
        updated.add(emoji);
      }
      if (updated.isEmpty) {
        _reactions.remove(messageId);
      } else {
        _reactions[messageId] = updated;
      }
    });
  }

  void _showReactionPicker(BuildContext context, ChatMessage msg) {
    HapticFeedback.mediumImpact();
    final tokens = SvenTokens.forMode(widget.visualMode);
    const emojis = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: widget.visualMode == VisualMode.cinematic
          ? const Color(0xFF0D1B2A)
          : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: tokens.onSurface.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Text('React',
                    style: Theme.of(context)
                        .textTheme.titleSmall
                        ?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: emojis.map((e) {
                    final active = (_reactions[msg.id] ?? {}).contains(e);
                    return GestureDetector(
                      onTap: () {
                        Navigator.pop(context);
                        _toggleReaction(msg.id, e);
                      },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: active
                              ? tokens.primary.withValues(alpha: 0.15)
                              : tokens.onSurface.withValues(alpha: 0.06),
                          shape: BoxShape.circle,
                          border: active
                              ? Border.all(
                                  color: tokens.primary.withValues(alpha: 0.5),
                                  width: 1.5)
                              : null,
                        ),
                        child: Center(
                          child: Text(e, style: const TextStyle(fontSize: 22)),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 8),
              ],
            ),
          ),
        );
      },
    );
  }

  void _toggleFeedback(String messageId, MessageFeedback type) {
    final previous = _feedback[messageId];
    final next = previous == type ? null : type;
    setState(() {
      if (next == null) {
        _feedback.remove(messageId);
      } else {
        _feedback[messageId] = next;
      }
    });
    HapticFeedback.selectionClick();
    unawaited(
      widget.chatService
          .setMessageFeedback(
            widget.thread.id,
            messageId,
            feedback: _encodeMessageFeedback(next),
          )
          .catchError((_) {
        if (!mounted) return;
        setState(() {
          if (previous == null) {
            _feedback.remove(messageId);
          } else {
            _feedback[messageId] = previous;
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to save feedback'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }),
    );
  }

  Future<void> _handleCancelQueued(ChatMessage message) async {
    if (message.status != ChatMessageStatus.queued) return;
    final queueId = message.queueId;
    if (queueId == null || queueId.isEmpty) {
      // Offline queued message: remove locally.
      setState(() {
        _messages.removeWhere((m) => m.id == message.id);
        _offlineQueue.remove(message.text);
      });
      return;
    }
    try {
      await widget.chatService.cancelQueuedMessage(widget.thread.id, queueId);
      if (!mounted) return;
      setState(() {
        _messages.removeWhere((m) => m.id == message.id);
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Cancel failed: $e'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  static MessageFeedback? _parseMessageFeedback(String? raw) {
    switch (raw) {
      case 'up':
        return MessageFeedback.up;
      case 'down':
        return MessageFeedback.down;
      default:
        return null;
    }
  }

  static String? _encodeMessageFeedback(MessageFeedback? value) {
    switch (value) {
      case MessageFeedback.up:
        return 'up';
      case MessageFeedback.down:
        return 'down';
      case null:
        return null;
    }
  }

  void _regenerateMessage(ChatMessage msg) {
    // Find the last user message before this assistant message
    final idx = _messages.indexOf(msg);
    if (idx < 0) return;
    String? lastUserText;
    for (int i = idx - 1; i >= 0; i--) {
      if (_messages[i].role == 'user') {
        lastUserText = _messages[i].text;
        break;
      }
    }
    if (lastUserText == null) return;

    // Remove the assistant message and resend
    setState(() {
      _messages.removeAt(idx);
    });
    _handleSend(lastUserText);
  }

  @override
  Widget build(BuildContext context) {
    Widget mainBody;

    if (_loading) {
      mainBody = ChatThreadSkeleton(
        visualMode: widget.visualMode,
        motionLevel: widget.motionLevel,
      );
    } else if (_loadError != null && _messages.isEmpty) {
      mainBody = Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline,
                size: 40, color: Theme.of(context).colorScheme.error),
            const SizedBox(height: 12),
            Text('Failed to load messages',
                style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),
            FilledButton(onPressed: _loadMessages, child: const Text('Retry')),
          ],
        ),
      );
    } else {
      mainBody = Column(
        children: [
          if (widget.incognito)
            const _StatusBanner(
              title: 'Incognito mode',
              message: 'This conversation won\'t be saved to your history.',
              tone: BannerTone.info,
            ),
          if (_agentPaused)
            const _StatusBanner(
              title: 'Agent paused',
              message:
                  'Sven is paused for this chat. Resume to continue processing.',
              tone: BannerTone.warning,
            ),
          if (_isStuckForNudge)
            const _StatusBanner(
              title: 'Agent may be stuck',
              message:
                  'No assistant response for over 30s. You can nudge to retry.',
              tone: BannerTone.warning,
            ),
          if (_offline)
            _StatusBanner(
              title: _reconnecting ? 'Reconnecting...' : 'Offline',
              message: () {
                final qc = _messages
                    .where((m) => m.status == ChatMessageStatus.queued)
                    .length;
                final qs =
                    qc > 0 ? ' · $qc message${qc == 1 ? '' : 's'} queued' : '';
                if (_reconnecting) {
                  return 'Waiting for network$qs. Messages will resume when online.';
                }
                return 'No connection$qs. Check your network to continue.';
              }(),
              tone: BannerTone.warning,
            ),
          if (widget.tutorialService != null)
            TutorialBanner(
              service: widget.tutorialService!,
              visualMode: widget.visualMode,
              onSuggestionTap: (text) {
                _handleSend(text);
              },
            ),
          if (_loadingMore)
            const Padding(
              padding: EdgeInsets.all(8),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          // ── Pinned messages bar ──
          if (_pinnedIds.isNotEmpty) ...[
            _PinnedMessagesBar(
              pinnedMessages:
                  _messages.where((m) => _pinnedIds.contains(m.id)).toList(),
              expanded: _pinnedBarExpanded,
              onToggleExpand: () =>
                  setState(() => _pinnedBarExpanded = !_pinnedBarExpanded),
              onScrollTo: _scrollToMessage,
              onUnpin: (id) {
                setState(() => _pinnedIds.remove(id));
                _savePinnedIds();
              },
              visualMode: widget.visualMode,
            ),
          ],
          Expanded(
            child: Stack(
              children: [
                _messages.isEmpty
                    ? _buildWelcome(context)
                    : Builder(builder: (context) {
                        // Compute search match indices once per build so the
                        // itemBuilder can highlight the focused result cheaply.
                        final searchMatches = _computeSearchMatches();
                        final focusedMatchIdx = searchMatches.isNotEmpty
                            ? searchMatches[
                                _searchCursor % searchMatches.length]
                            : -1;
                        return _SvenRefreshIndicator(
                          visualMode: widget.visualMode,
                          onRefresh: () async {
                            setState(() {
                              _messages.clear();
                              _loading = true;
                              _loadError = null;
                            });
                            await _loadMessages();
                          },
                          child: ListView.builder(
                            controller: _scrollController,
                            padding: const EdgeInsets.symmetric(
                                vertical: 12, horizontal: 0),
                            // Virtualization: don't keep off-screen stateful widgets
                            // alive and limit the repaint cache to ~600px beyond viewport.
                            addAutomaticKeepAlives: false,
                            cacheExtent: 600,
                            itemCount: _messages.length +
                                (_isSending && !_isStreaming ? 1 : 0),
                            itemBuilder: (context, index) {
                              // Show thinking indicator while waiting for streaming
                              if (index == _messages.length) {
                                return _ThinkingIndicator(
                                  visualMode: widget.visualMode,
                                );
                              }
                              final message = _messages[index];
                              final actionButtons =
                                  _extractActionButtons(message.blocks);
                              // Filter by search query
                              final matchesSearch = _searchQuery.isEmpty ||
                                  message.text
                                      .toLowerCase()
                                      .contains(_searchQuery.toLowerCase());
                              if (!matchesSearch) {
                                return const SizedBox.shrink();
                              }
                              final isFocusedMatch = focusedMatchIdx == index;
                              // ── Date separator between messages on different days ──
                              final showDateSep = index == 0 ||
                                  !_isSameDay(_messages[index - 1].timestamp,
                                      message.timestamp);
                              final focusBorder = isFocusedMatch
                                  ? Border(
                                      left: BorderSide(
                                        color: SvenTokens.forMode(
                                                widget.visualMode)
                                            .primary,
                                        width: 3,
                                      ),
                                    )
                                  : null;
                              return Container(
                                decoration: focusBorder != null
                                    ? BoxDecoration(
                                        border: focusBorder,
                                        color: SvenTokens.forMode(
                                                widget.visualMode)
                                            .primary
                                            .withValues(alpha: 0.04),
                                      )
                                    : null,
                                child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          if (showDateSep)
                                            _DateSeparator(
                                              date: message.timestamp,
                                              visualMode: widget.visualMode,
                                            ),
                                          _AnimatedMessageEntry(
                                            key: ValueKey(message.id),
                                            child: RepaintBoundary(
                                              child: Column(
                                                mainAxisSize: MainAxisSize.min,
                                                crossAxisAlignment:
                                                    message.role == 'user'
                                                        ? CrossAxisAlignment.end
                                                        : CrossAxisAlignment.start,
                                                children: [
                                                  _MessageBubble(
                                                    message: message,
                                                    localImages:
                                                        _messageImages[message.id] ??
                                                            const [],
                                                    visualMode: widget.visualMode,
                                                    isStreaming: message.status ==
                                                        ChatMessageStatus.streaming,
                                                    showCursor: _showCursor &&
                                                        message.status ==
                                                            ChatMessageStatus
                                                                .streaming,
                                                    onCopy: () =>
                                                        _copyMessage(message),
                                                    onRegenerate: message.role ==
                                                                'assistant' &&
                                                            message.status ==
                                                                ChatMessageStatus.sent
                                                        ? () => _regenerateMessage(
                                                            message)
                                                        : null,
                                                    feedback: _feedback[message.id],
                                                    onThumbsUp: message.role ==
                                                                'assistant' &&
                                                            message.status ==
                                                                ChatMessageStatus.sent
                                                        ? () => _toggleFeedback(
                                                            message.id,
                                                            MessageFeedback.up)
                                                        : null,
                                                    onThumbsDown: message.role ==
                                                                'assistant' &&
                                                            message.status ==
                                                                ChatMessageStatus.sent
                                                        ? () => _toggleFeedback(
                                                            message.id,
                                                            MessageFeedback.down)
                                                        : null,
                                                    onReadAloud: message.role ==
                                                                'assistant' &&
                                                            message.status ==
                                                                ChatMessageStatus
                                                                    .sent &&
                                                            widget.voiceService !=
                                                                null
                                                        ? () =>
                                                            _toggleReadAloud(message)
                                                        : null,
                                                    isReadingAloud: widget
                                                            .voiceService
                                                            ?.speakingMessageId ==
                                                        message.id,
                                                    actionButtons: actionButtons,
                                                    isActionDisabled: (id) =>
                                                        _isActionDisabledFor(
                                                            message.id, id),
                                                    onActionTap: (button) =>
                                                        _handleActionButton(
                                                            message, button),
                                                    onLongPress: message.status !=
                                                                ChatMessageStatus
                                                                    .sending &&
                                                            message.status !=
                                                                ChatMessageStatus
                                                                    .streaming
                                                        ? () => _showMessageMenu(
                                                            context, message)
                                                        : null,
                                                    onRunCode:
                                                        message.role == 'assistant'
                                                            ? (code, lang) {
                                                                final prompt =
                                                                    'Run this $lang code and show the output:\n```$lang\n$code\n```';
                                                                _handleSend(prompt);
                                                              }
                                                            : null,
                                                    onRetry: message.status ==
                                                                ChatMessageStatus
                                                                    .failed &&
                                                            message.role == 'user'
                                                        ? _handleRetry
                                                        : null,
                                                    onCancelQueued: message.status ==
                                                                ChatMessageStatus
                                                                    .queued
                                                            ? () =>
                                                                _handleCancelQueued(
                                                                    message)
                                                            : null,
                                                  ),
                                            // ── Token speed badge (shown while streaming) ──
                                            if (message.status ==
                                                    ChatMessageStatus
                                                        .streaming &&
                                                _streamTokensPerSec > 0)
                                              _StreamingSpeedPill(
                                                tokensPerSec:
                                                    _streamTokensPerSec,
                                                visualMode: widget.visualMode,
                                              ),
                                            // ── Reaction pills ──
                                            if (_reactions[message.id]
                                                    ?.isNotEmpty ==
                                                true)
                                              _ReactionBar(
                                                reactions:
                                                    _reactions[message.id]!,
                                                onTap: (emoji) =>
                                                    _toggleReaction(
                                                        message.id, emoji),
                                                isUser: message.role == 'user',
                                                tokens: SvenTokens.forMode(
                                                    widget.visualMode),
                                              ),
                                          ],
                                        ),
                                      ), // RepaintBoundary
                                    ), // _AnimatedMessageEntry
                                  ],
                                ), // Column
                              ); // Container
                            },
                          ),
                        ); // _SvenRefreshIndicator
                      }), // Builder
                // ── Scroll-to-bottom FAB ──
                if (_showScrollFab)
                  Positioned(
                    right: 16,
                    bottom: 12,
                    child: _ScrollToBottomFab(
                      unreadCount: _unreadScrollCount,
                      visualMode: widget.visualMode,
                      onTap: () {
                        setState(() {
                          _unreadScrollCount = 0;
                          _showScrollFab = false;
                        });
                        _scrollToBottom(force: true);
                      },
                    ),
                  ),
              ], // Stack children
            ), // Stack
          ),
          if (_hasFailed)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 2, 12, 0),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Semantics(
                  label: 'Message failed to send. Tap to retry.',
                  button: true,
                  child: TextButton.icon(
                    onPressed: _handleRetry,
                    icon: Icon(
                      Icons.refresh_rounded,
                      size: 15,
                      color: Theme.of(context).colorScheme.error,
                    ),
                    label: Text(
                      'Failed to send — Retry',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ),
                ),
              ),
            ),
          // ── TTS mini-player ──
          if (widget.voiceService != null)
            ListenableBuilder(
              listenable: widget.voiceService!,
              builder: (context, _) {
                final vs = widget.voiceService!;
                final active = vs.ttsState != TtsState.idle;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  height: active ? 44 : 0,
                  child: active
                      ? _TtsMiniPlayer(
                          voiceService: vs,
                          visualMode: widget.visualMode,
                        )
                      : const SizedBox.shrink(),
                );
              },
            ),
          // ── Smart reply suggestion chips ──
          AnimatedSize(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeInOut,
            child: _smartReplies.isNotEmpty && !_isSending && !_isStreaming
                ? _SmartReplySuggestions(
                    suggestions: _smartReplies,
                    onTap: (s) {
                      setState(() => _smartReplies = []);
                      _handleSend(s);
                    },
                    visualMode: widget.visualMode,
                  )
                : const SizedBox.shrink(),
          ),
          FocusTraversalGroup(
            policy: ReadingOrderTraversalPolicy(),
            child: _KeyboardAwareComposer(
              visualMode: widget.visualMode,
              child: ChatComposer(
                chatId: widget.thread.id,
                onSend: (text, imagePaths) {
                  // Clear edit state when a new message is sent.
                  if (_editingMessageId != null) {
                    setState(() {
                      _editPrefill = null;
                      _editingMessageId = null;
                    });
                  }
                  _handleSend(text, imagePaths);
                },
                editPrefillText: _editPrefill,
                onCancel: _handleCancel,
                onRetry: _handleRetry,
                isSending: _isSending || _isStreaming,
                hasFailed: _hasFailed,
                isEnabled: !_offline,
                visualMode: widget.visualMode,
                motionLevel: widget.motionLevel,
                voiceService: widget.voiceService,
                quoteMessage: _quoteMessage,
                onClearQuote: () => setState(() => _quoteMessage = null),
                currentMode: _currentMode,
                onModeChange: (m) => setState(() => _currentMode = m),
                onNewChat: () {
                  setState(() {
                    _messages.clear();
                    _quoteMessage = null;
                  });
                },
                onClearChat: () {
                  setState(() {
                    _messages.clear();
                    _quoteMessage = null;
                  });
                },
                promptHistory: _promptHistory,
              ),
            ),
          ),
        ],
      );
    }

    if (!widget.showHeader) {
      return PopScope(
        canPop: true,
        onPopInvokedWithResult: (didPop, _) {
          if (didPop) _stopSse();
        },
        child: mainBody,
      );
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: _searchActive
                ? Builder(
                    key: const ValueKey('search'),
                    builder: (context) {
                      final matches = _computeSearchMatches();
                      final hasMatches = matches.isNotEmpty;
                      final cursorDisplay = hasMatches
                          ? '${_searchCursor + 1}/${matches.length}'
                          : _searchQuery.isEmpty
                              ? ''
                              : '0/0';
                      return Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: _searchController,
                                  autofocus: true,
                                  style: TextStyle(
                                    color: SvenTokens.forMode(widget.visualMode)
                                        .onSurface,
                                    fontSize: 15,
                                  ),
                                  decoration: InputDecoration(
                                    hintText: 'Search messages…',
                                    prefixIcon: const Icon(Icons.search_rounded,
                                        size: 20),
                                    isDense: true,
                                    contentPadding: const EdgeInsets.symmetric(
                                        horizontal: 12, vertical: 10),
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      borderSide: BorderSide.none,
                                    ),
                                    filled: true,
                                  ),
                                  onChanged: (v) => setState(() {
                                    _searchQuery = v;
                                    _searchCursor = 0;
                                  }),
                                ),
                              ),
                              if (cursorDisplay.isNotEmpty) ...[
                                const SizedBox(width: 4),
                                Text(
                                  cursorDisplay,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: SvenTokens.forMode(widget.visualMode)
                                        .onSurface
                                        .withValues(alpha: 0.5),
                                  ),
                                ),
                              ],
                              IconButton(
                                tooltip: 'Previous match',
                                icon: const Icon(
                                    Icons.keyboard_arrow_up_rounded,
                                    size: 20),
                                onPressed: hasMatches ? _searchPrev : null,
                              ),
                              IconButton(
                                tooltip: 'Next match',
                                icon: const Icon(
                                    Icons.keyboard_arrow_down_rounded,
                                    size: 20),
                                onPressed: hasMatches ? _searchNext : null,
                              ),
                              IconButton(
                                tooltip: 'Close search',
                                icon: const Icon(Icons.close_rounded, size: 20),
                                onPressed: () => setState(() {
                                  _searchActive = false;
                                  _searchQuery = '';
                                  _searchCursor = 0;
                                  _searchController.clear();
                                }),
                              ),
                            ],
                          ),
                        ],
                      );
                    },
                  )
                : Row(
                    key: const ValueKey('title'),
                    children: [
                      Expanded(
                        child: Text(
                          _localTitle ?? widget.thread.title,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                      // A.5.1 — Council mode toggle
                      IconButton(
                        tooltip: _councilEnabled
                            ? 'Council mode ON'
                            : 'Council mode OFF',
                        icon: Icon(
                          Icons.groups_rounded,
                          size: 20,
                          color: _councilEnabled
                              ? Theme.of(context).colorScheme.primary
                              : null,
                        ),
                        onPressed: _councilLoading ? null : _toggleCouncilMode,
                      ),
                      IconButton(
                        tooltip: _agentPaused ? 'Resume agent' : 'Pause agent',
                        icon: Icon(
                          _agentPaused
                              ? Icons.play_arrow_rounded
                              : Icons.pause_rounded,
                          size: 20,
                        ),
                        onPressed: _agentPauseBusy
                            ? null
                            : () {
                                _toggleAgentPause();
                            },
                      ),
                      if (_isStuckForNudge)
                        IconButton(
                          tooltip: 'Nudge agent',
                          icon: const Icon(Icons.refresh_rounded, size: 20),
                          onPressed: _nudgeBusy
                              ? null
                              : () {
                                  _handleNudge();
                                },
                        ),
                      if (_messages.isNotEmpty) ...[
                        IconButton(
                          tooltip: 'Search',
                          icon: const Icon(Icons.search_rounded, size: 20),
                          onPressed: () => setState(() => _searchActive = true),
                        ),
                        IconButton(
                          tooltip: 'Export conversation',
                          icon: const Icon(Icons.ios_share_rounded, size: 20),
                          onPressed: _exportConversation,
                        ),
                      ],
                    ],
                  ),
          ),
        ),
        const Divider(height: 1),
        Expanded(child: mainBody),
      ],
    );
  }

  // ── Welcome screen (empty state) ──

  Widget _buildWelcome(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;

    return Center(
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: cinematic
                        ? [tokens.primary, tokens.secondary]
                        : [
                            tokens.primary,
                            tokens.primary.withValues(alpha: 0.7)
                          ],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: tokens.primary
                          .withValues(alpha: cinematic ? 0.30 : 0.15),
                      blurRadius: cinematic ? 24 : 16,
                    ),
                  ],
                ),
              child: const Center(
                  child: SvenAppIcon(size: 56, borderRadius: 22),
                ),
              ),
              const SizedBox(height: 28),
              Text(
                'How can I help you today?',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: tokens.onSurface,
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 12),
              Text(
                'Ask anything, or try one of these:',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: tokens.onSurface.withValues(alpha: 0.5),
                    ),
              ),
              const SizedBox(height: 24),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                alignment: WrapAlignment.center,
                children: [
                  _suggestionChip(context, '\u{1F4A1}',
                      'Explain something complex', tokens, cinematic),
                  _suggestionChip(context, '\u{270D}\u{FE0F}', 'Help me write',
                      tokens, cinematic),
                  _suggestionChip(context, '\u{1F50D}', 'Analyse a document',
                      tokens, cinematic),
                  _suggestionChip(
                      context, '\u{1F4BB}', 'Debug my code', tokens, cinematic),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _suggestionChip(
    BuildContext context,
    String emoji,
    String label,
    SvenModeTokens tokens,
    bool cinematic,
  ) {
    return Material(
      color: cinematic ? tokens.card : tokens.surface,
      borderRadius: BorderRadius.circular(14),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _handleSend(label),
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: cinematic
                  ? tokens.primary.withValues(alpha: 0.12)
                  : tokens.frame,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(emoji, style: const TextStyle(fontSize: 16)),
              const SizedBox(width: 8),
              Text(
                label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: tokens.onSurface,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

