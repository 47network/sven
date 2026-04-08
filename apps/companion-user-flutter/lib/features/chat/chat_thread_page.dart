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

import 'chat_composer.dart';
import 'chat_models.dart';
import 'chat_service.dart';
import 'chat_sse_service.dart';
import 'prompt_history_service.dart';
import 'prompt_templates_service.dart';
import 'voice_service.dart';
import 'sync_service.dart';
import '../approvals/approvals_service.dart';
import '../memory/memory_service.dart';
import '../onboarding/tutorial_service.dart';
import '../home/streak_service.dart';
import '../../app/app_models.dart';
import '../../app/performance_tracker.dart';
import '../../app/skeleton.dart';
import '../../app/sven_app_icon.dart';
import '../../app/sven_tokens.dart';

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
  bool _sseActive = false;
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
          _sseActive = true;
        }
      },
      onError: (_) {
        _sseActive = false;
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
    _sseActive = false;
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
              child: Center(
                  child: const SvenAppIcon(size: 56, borderRadius: 22),
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

// ═══════════════════════════════════════════════════════════════════════════
// Animated message entrance
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// Scroll-to-bottom FAB — appears when user scrolls away from the bottom.
// Shows an unread badge when new messages arrive while scrolled up.
// ═══════════════════════════════════════════════════════════════════════════

class _ScrollToBottomFab extends StatelessWidget {
  const _ScrollToBottomFab({
    required this.unreadCount,
    required this.visualMode,
    required this.onTap,
  });

  final int unreadCount;
  final VisualMode visualMode;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    final cinematic = visualMode == VisualMode.cinematic;
    return Semantics(
      label: unreadCount > 0
          ? '$unreadCount new message${unreadCount == 1 ? '' : 's'}. Tap to scroll to bottom.'
          : 'Scroll to bottom',
      button: true,
      child: GestureDetector(
        onTap: onTap,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: cinematic
                    ? tokens.card.withValues(alpha: 0.92)
                    : tokens.surface.withValues(alpha: 0.95),
                shape: BoxShape.circle,
                border: Border.all(
                  color: cinematic
                      ? tokens.frame
                      : tokens.onSurface.withValues(alpha: 0.12),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.18),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Icon(
                Icons.keyboard_arrow_down_rounded,
                color: tokens.primary,
                size: 24,
              ),
            ),
            if (unreadCount > 0)
              Positioned(
                top: -6,
                right: -6,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(
                    color: tokens.primary,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    unreadCount > 99 ? '99+' : '$unreadCount',
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      color: cinematic ? Colors.black : Colors.white,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Animated message entry (slide + fade in)
// ═══════════════════════════════════════════════════════════════════════════

class _AnimatedMessageEntry extends StatefulWidget {
  const _AnimatedMessageEntry({super.key, required this.child});
  final Widget child;

  @override
  State<_AnimatedMessageEntry> createState() => _AnimatedMessageEntryState();
}

class _AnimatedMessageEntryState extends State<_AnimatedMessageEntry>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _fadeAnim;
  late final Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      duration: const Duration(milliseconds: 350),
      vsync: this,
    );
    _fadeAnim = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.15),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnim,
      child: SlideTransition(
        position: _slideAnim,
        child: widget.child,
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Pinned messages bar (collapsed/expanded strip above the message list)
// ═══════════════════════════════════════════════════════════════════════════

class _PinnedMessagesBar extends StatelessWidget {
  const _PinnedMessagesBar({
    required this.pinnedMessages,
    required this.expanded,
    required this.onToggleExpand,
    required this.onScrollTo,
    required this.onUnpin,
    required this.visualMode,
  });
  final List<ChatMessage> pinnedMessages;
  final bool expanded;
  final VoidCallback onToggleExpand;
  final ValueChanged<String> onScrollTo;
  final ValueChanged<String> onUnpin;
  final VisualMode visualMode;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    final bg = tokens.primary.withValues(alpha: 0.07);
    final border = tokens.primary.withValues(alpha: 0.15);

    final n = pinnedMessages.length;
    final stateLabel = expanded ? 'expanded' : 'collapsed';
    return Semantics(
      label: '$n pinned message${n == 1 ? '' : 's'}, $stateLabel',
      explicitChildNodes: true,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeInOut,
        decoration: BoxDecoration(
          color: bg,
          border: Border(
            bottom: BorderSide(color: border, width: 1),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header row
            Semantics(
              button: true,
              hint: expanded
                  ? 'Collapse pinned messages'
                  : 'Expand pinned messages',
              child: InkWell(
                onTap: onToggleExpand,
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                  child: Row(
                    children: [
                      ExcludeSemantics(
                        child: Icon(Icons.push_pin_rounded,
                            size: 14, color: tokens.primary),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '$n pinned',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: tokens.primary,
                        ),
                      ),
                      const Spacer(),
                      ExcludeSemantics(
                        child: Icon(
                          expanded
                              ? Icons.keyboard_arrow_up_rounded
                              : Icons.keyboard_arrow_down_rounded,
                          size: 18,
                          color: tokens.primary.withValues(alpha: 0.6),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            // Expanded list of pinned messages
            if (expanded)
              ...pinnedMessages.map((msg) {
                final preview = msg.text.length > 70
                    ? '${msg.text.substring(0, 67)}…'
                    : msg.text;
                return Semantics(
                  label: 'Pinned: $preview. Tap to scroll to message.',
                  button: true,
                  child: InkWell(
                    onTap: () => onScrollTo(msg.id),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(14, 0, 6, 7),
                      child: Row(
                        children: [
                          ExcludeSemantics(
                            child: Container(
                              width: 3,
                              height: 32,
                              decoration: BoxDecoration(
                                color: tokens.primary.withValues(alpha: 0.5),
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              preview,
                              style: TextStyle(
                                fontSize: 12,
                                color: tokens.onSurface.withValues(alpha: 0.7),
                                height: 1.35,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          IconButton(
                            iconSize: 16,
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(
                                minWidth: 32, minHeight: 32),
                            icon: Icon(Icons.close_rounded,
                                size: 16,
                                color:
                                    tokens.onSurface.withValues(alpha: 0.35)),
                            onPressed: () => onUnpin(msg.id),
                            tooltip: 'Unpin message',
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Smart reply suggestion chips (shown after assistant responds)
// ═══════════════════════════════════════════════════════════════════════════

class _SmartReplySuggestions extends StatelessWidget {
  const _SmartReplySuggestions({
    required this.suggestions,
    required this.onTap,
    required this.visualMode,
  });
  final List<String> suggestions;
  final ValueChanged<String> onTap;
  final VisualMode visualMode;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        itemCount: suggestions.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final label = suggestions[index];
          return Semantics(
            label: 'Quick reply: $label',
            button: true,
            child: GestureDetector(
              onTap: () => onTap(label),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: tokens.primary.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: tokens.primary.withValues(alpha: 0.30),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ExcludeSemantics(
                      child: Icon(
                        Icons.bolt_rounded,
                        size: 14,
                        color: tokens.primary,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 12.5,
                        color: tokens.primary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Token speed badge — fades in after ~0.8s of streaming once rate stabilises
// ═══════════════════════════════════════════════════════════════════════════

class _StreamingSpeedPill extends StatelessWidget {
  const _StreamingSpeedPill({
    required this.tokensPerSec,
    required this.visualMode,
  });
  final double tokensPerSec;
  final VisualMode visualMode;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    final tps = tokensPerSec.round();
    return Semantics(
      label: 'Streaming at $tps tokens per second',
      child: Padding(
        padding: const EdgeInsets.only(left: 50, top: 2, bottom: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: tokens.primary.withValues(alpha: 0.07),
                borderRadius: BorderRadius.circular(10),
                border:
                    Border.all(color: tokens.primary.withValues(alpha: 0.15)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ExcludeSemantics(
                    child: Icon(
                      Icons.bolt_rounded,
                      size: 10,
                      color: tokens.primary.withValues(alpha: 0.65),
                    ),
                  ),
                  const SizedBox(width: 3),
                  Text(
                    '~$tps tok/s',
                    style: TextStyle(
                      fontSize: 10,
                      color: tokens.primary.withValues(alpha: 0.65),
                      fontWeight: FontWeight.w500,
                      letterSpacing: 0.2,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Thinking indicator (three bouncing dots)
// ═══════════════════════════════════════════════════════════════════════════

class _ThinkingIndicator extends StatefulWidget {
  const _ThinkingIndicator({required this.visualMode});
  final VisualMode visualMode;

  @override
  State<_ThinkingIndicator> createState() => _ThinkingIndicatorState();
}

class _ThinkingIndicatorState extends State<_ThinkingIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;

    return Semantics(
      liveRegion: true,
      label: 'Sven is thinking',
      child: Padding(
        padding: const EdgeInsets.only(left: 10, right: 48, top: 3, bottom: 3),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _AssistantAvatar(tokens: tokens, cinematic: cinematic),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              decoration: BoxDecoration(
                color: cinematic ? tokens.card : tokens.surface,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(20),
                  topRight: Radius.circular(20),
                  bottomLeft: Radius.circular(4),
                  bottomRight: Radius.circular(20),
                ),
                border: Border.all(
                  color: cinematic
                      ? tokens.frame
                      : tokens.frame.withValues(alpha: 0.5),
                  width: 0.7,
                ),
              ),
              child: AnimatedBuilder(
                animation: _ctrl,
                builder: (context, _) {
                  return Row(
                    mainAxisSize: MainAxisSize.min,
                    children: List.generate(3, (i) {
                      final delay = i * 0.2;
                      final t = ((_ctrl.value - delay) % 1.0).clamp(0.0, 1.0);
                      final bounce = t < 0.5 ? (t * 2) : (2 - t * 2);
                      return Padding(
                        padding: EdgeInsets.only(right: i < 2 ? 4 : 0),
                        child: Transform.translate(
                          offset: Offset(0, -4 * bounce),
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: tokens.primary.withValues(
                                alpha: 0.4 + bounce * 0.5,
                              ),
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      );
                    }),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Message bubble with actions
// ═══════════════════════════════════════════════════════════════════════════

class _ActionButtonSpec {
  const _ActionButtonSpec({
    required this.id,
    required this.label,
    required this.action,
    this.url,
    this.command,
    this.text,
    this.approvalId,
    this.payload,
    this.style,
  });

  final String id;
  final String label;
  final String action;
  final String? url;
  final String? command;
  final String? text;
  final String? approvalId;
  final Map<String, dynamic>? payload;
  final String? style;
}

String _normalizeAction(String? raw) {
  final value = (raw ?? '').trim().toLowerCase();
  if (value == 'deny' || value == 'reject') return 'reject';
  if (value == 'approve') return 'approve';
  if (value == 'open_link' || value == 'open' || value == 'link') {
    return 'open_link';
  }
  if (value == 'run_command' || value == 'command') return 'run_command';
  if (value == 'quick_reply' || value == 'reply') return 'reply';
  if (value == 'dismiss' || value == 'close') return 'dismiss';
  return value.isEmpty ? 'action' : value;
}

List<_ActionButtonSpec> _extractActionButtons(List<dynamic>? blocks) {
  if (blocks == null || blocks.isEmpty) return const [];
  final out = <_ActionButtonSpec>[];

  void addButton(Map<String, dynamic> btn, int index) {
    final label = (btn['label'] ?? btn['title'] ?? btn['text'] ?? btn['id'])
        ?.toString()
        .trim();
    if (label == null || label.isEmpty) return;
    final action = _normalizeAction(btn['action']?.toString() ??
        btn['type']?.toString() ??
        btn['id']?.toString());
    final approvalId = btn['approval_id']?.toString() ??
        ((action == 'approve' || action == 'reject')
            ? btn['value']?.toString()
            : null);
    final value = btn['value']?.toString();
    out.add(
      _ActionButtonSpec(
        id: (btn['id']?.toString() ?? '$label-$index'),
        label: label,
        action: action,
        url: btn['url']?.toString(),
        command: btn['command']?.toString() ??
            (action == 'run_command' ? value : null),
        text:
            btn['text']?.toString() ?? (action == 'reply' ? value : null),
        approvalId: approvalId,
        payload: btn['payload'] is Map
            ? Map<String, dynamic>.from(btn['payload'] as Map)
            : null,
        style: btn['style']?.toString(),
      ),
    );
  }

  for (final block in blocks) {
    if (block is! Map) continue;
    final type = block['type']?.toString();
    if (type == 'actions') {
      final buttons = block['buttons'] is List
          ? block['buttons'] as List
          : (block['content'] is Map &&
                  (block['content'] as Map)['buttons'] is List)
              ? (block['content'] as Map)['buttons'] as List
              : const [];
      for (var i = 0; i < buttons.length; i++) {
        final btn = buttons[i];
        if (btn is Map) {
          addButton(Map<String, dynamic>.from(btn), i);
        }
      }
    } else if (type == 'tool_card') {
      final content = block['content'];
      if (content is Map) {
        final status = content['status']?.toString();
        final approvalId = content['approval_id']?.toString();
        if (status == 'pending_approval' && approvalId != null) {
          out.add(
            _ActionButtonSpec(
              id: 'approve-$approvalId',
              label: 'Approve',
              action: 'approve',
              approvalId: approvalId,
            ),
          );
          out.add(
            _ActionButtonSpec(
              id: 'reject-$approvalId',
              label: 'Reject',
              action: 'reject',
              approvalId: approvalId,
            ),
          );
        }
      }
    }
  }

  return out;
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    this.localImages = const <String>[],
    this.visualMode = VisualMode.classic,
    this.isStreaming = false,
    this.showCursor = false,
    this.onCopy,
    this.onRegenerate,
    this.onThumbsUp,
    this.onThumbsDown,
    this.feedback,
    this.onReadAloud,
    this.isReadingAloud = false,
    this.actionButtons = const [],
    this.onActionTap,
    this.isActionDisabled,
    this.onLongPress,
    this.onRunCode,
    this.onRetry,
    this.onCancelQueued,
  });

  final ChatMessage message;

  /// Local file paths of images attached when this user message was sent.
  /// Empty for assistant messages and messages from before this feature.
  final List<String> localImages;
  final VisualMode visualMode;
  final bool isStreaming;
  final bool showCursor;
  final VoidCallback? onCopy;
  final VoidCallback? onRegenerate;
  final VoidCallback? onThumbsUp;
  final VoidCallback? onThumbsDown;
  final MessageFeedback? feedback;
  final VoidCallback? onReadAloud;
  final bool isReadingAloud;
  final List<_ActionButtonSpec> actionButtons;
  final void Function(_ActionButtonSpec button)? onActionTap;
  final bool Function(String actionId)? isActionDisabled;
  final VoidCallback? onLongPress;
  final void Function(String code, String language)? onRunCode;

  /// Called when the user taps the inline Retry chip on a failed message.
  final VoidCallback? onRetry;
  final VoidCallback? onCancelQueued;

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == 'user';
    final isSystem = message.role == 'system';
    final isSending = message.status == ChatMessageStatus.sending;
    final isFailed = message.status == ChatMessageStatus.failed;
    final isQueued = message.status == ChatMessageStatus.queued;
    final tokens = SvenTokens.forMode(visualMode);
    final cinematic = visualMode == VisualMode.cinematic;

    // ── System message ──
    if (isSystem) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: Center(
          child: Semantics(
            label: 'System: ${message.text}',
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: cinematic
                    ? tokens.primary.withValues(alpha: 0.06)
                    : tokens.onSurface.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                message.text,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: tokens.onSurface.withValues(alpha: 0.5),
                      fontStyle: FontStyle.italic,
                    ),
              ),
            ),
          ),
        ),
      );
    }

    // ── Asymmetric bubble radius ──
    final bubbleRadius = BorderRadius.only(
      topLeft: const Radius.circular(20),
      topRight: const Radius.circular(20),
      bottomLeft: Radius.circular(isUser ? 20 : 4),
      bottomRight: Radius.circular(isUser ? 4 : 20),
    );

    // ── Message content with text selection ──
    Widget messageContent;
    if (isUser) {
      // Strip [Image: ...] tags — images are shown as thumbnails below
      final displayText =
          message.text.replaceAll(RegExp(r'\[Image:[^\]]*\]\n?'), '').trim();
      messageContent = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (localImages.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _buildImageStrip(localImages, cinematic, tokens),
            ),
          if (displayText.isNotEmpty)
            SelectableText(
              displayText,
              style: TextStyle(
                color: cinematic ? tokens.onSurface : Colors.white,
                fontSize: 15,
                height: 1.45,
              ),
            )
          else if (localImages.isEmpty)
            // Fallback: show original text if nothing stripped and no images
            SelectableText(
              message.text,
              style: TextStyle(
                color: cinematic ? tokens.onSurface : Colors.white,
                fontSize: 15,
                height: 1.45,
              ),
            ),
        ],
      );
    } else {
      // Pre-process LaTeX: replace $...$ and $$...$$ with placeholder tags
      final processedText = _preprocessLatex(
          isStreaming && showCursor ? '${message.text}\u2588' : message.text);
      messageContent = MarkdownBody(
        data: processedText,
        selectable: true,
        extensionSet: md.ExtensionSet(
          md.ExtensionSet.gitHubFlavored.blockSyntaxes,
          [
            _InlineMathSyntax(),
            ...md.ExtensionSet.gitHubFlavored.inlineSyntaxes,
          ],
        ),
        styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
          p: TextStyle(
            color: tokens.onSurface,
            fontSize: 15,
            height: 1.45,
          ),
          strong: TextStyle(
            color: tokens.onSurface,
            fontWeight: FontWeight.bold,
            fontSize: 15,
          ),
          a: TextStyle(
            color: tokens.primary,
            decoration: TextDecoration.underline,
            decorationColor: tokens.primary.withValues(alpha: 0.4),
          ),
          code: TextStyle(
            fontFamily: 'monospace',
            fontSize: 13,
            color: cinematic ? tokens.primary : tokens.onSurface,
            backgroundColor: cinematic
                ? tokens.primary.withValues(alpha: 0.08)
                : tokens.onSurface.withValues(alpha: 0.06),
          ),
          codeblockPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          codeblockDecoration: BoxDecoration(
            color: cinematic
                ? const Color(0xFF0D1117)
                : tokens.onSurface.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(10),
            border: cinematic
                ? Border.all(color: tokens.frame)
                : Border.all(color: tokens.onSurface.withValues(alpha: 0.08)),
          ),
          // ── Table styling ──
          tableHead: TextStyle(
            color: tokens.onSurface,
            fontWeight: FontWeight.w600,
            fontSize: 13,
          ),
          tableBody: TextStyle(
            color: tokens.onSurface.withValues(alpha: 0.85),
            fontSize: 13,
          ),
          tableBorder: TableBorder.all(
            color: cinematic
                ? tokens.frame
                : tokens.onSurface.withValues(alpha: 0.12),
            width: 0.5,
            borderRadius: BorderRadius.circular(8),
          ),
          tableColumnWidth: const IntrinsicColumnWidth(),
          tableCellsPadding:
              const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          tableHeadAlign: TextAlign.left,
        ),
        shrinkWrap: true,
        onTapLink: (text, href, title) {
          if (href == null || href.isEmpty) return;
          final uri = Uri.tryParse(href);
          if (uri != null) {
            launchUrl(uri, mode: LaunchMode.externalApplication);
          }
        },
        // ignore: deprecated_member_use
        imageBuilder: (uri, title, alt) {
          return _MarkdownImage(
            uri: uri,
            title: title,
            alt: alt,
            tokens: tokens,
            cinematic: cinematic,
          );
        },
        builders: {
          'pre': _CodeBlockBuilder(
              tokens: tokens, cinematic: cinematic, onRunCode: onRunCode),
          'imath': _InlineMathBuilder(tokens: tokens, cinematic: cinematic),
        },
      );
    }

    // ── Bubble card ──
    final bubble = Container(
      constraints: BoxConstraints(
        maxWidth: MediaQuery.of(context).size.width * 0.78,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isUser
            ? (cinematic
                ? tokens.primary.withValues(alpha: 0.15)
                : tokens.primary)
            : (cinematic ? tokens.card : tokens.surface),
        borderRadius: bubbleRadius,
        border: isFailed
            ? Border.all(color: Theme.of(context).colorScheme.error)
            : isQueued
                ? Border.all(color: tokens.onSurface.withValues(alpha: 0.25))
                : cinematic
                    ? Border.all(
                        color: isUser
                            ? tokens.primary.withValues(alpha: 0.28)
                            : tokens.frame,
                        width: 0.7,
                      )
                    : (!isUser
                        ? Border.all(
                            color: tokens.frame.withValues(alpha: 0.5),
                            width: 0.5,
                          )
                        : null),
        boxShadow: [
          BoxShadow(
            color: cinematic
                ? (isUser
                    ? tokens.primary.withValues(alpha: 0.08)
                    : Colors.black.withValues(alpha: 0.12))
                : Colors.black.withValues(alpha: 0.04),
            blurRadius: cinematic ? 10 : 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isUser && message.senderName != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(
                message.senderName!,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: tokens.primary,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
          messageContent,
          if (isSending || isQueued)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (isSending)
                    SizedBox(
                      width: 12,
                      height: 12,
                      child: CircularProgressIndicator(
                        strokeWidth: 1.5,
                        color: isUser
                            ? Colors.white70
                            : tokens.onSurface.withValues(alpha: 0.5),
                      ),
                    ),
                  if (isQueued)
                    Icon(Icons.schedule,
                        size: 14,
                        color: tokens.onSurface.withValues(alpha: 0.5)),
                  const SizedBox(width: 4),
                  Text(
                    isQueued
                        ? (message.queuePosition != null
                            ? 'Queued · #${message.queuePosition}'
                            : 'Queued')
                        : 'Sending\u2026',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: tokens.onSurface.withValues(alpha: 0.45),
                        ),
                  ),
                  if (isQueued && onCancelQueued != null) ...[
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: onCancelQueued,
                      child: Text(
                        'Cancel',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: tokens.primary,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          // ── Failed: inline retry chip ────────────────────────────────
          if (isFailed)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Semantics(
                label: onRetry != null
                    ? 'Message failed. Tap to retry.'
                    : 'Message failed to send.',
                button: onRetry != null,
                child: GestureDetector(
                  onTap: onRetry,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Theme.of(context)
                          .colorScheme
                          .error
                          .withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: Theme.of(context)
                            .colorScheme
                            .error
                            .withValues(alpha: 0.28),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.error_outline,
                          size: 13,
                          color: Theme.of(context).colorScheme.error,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'Failed',
                          style:
                              Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: Theme.of(context).colorScheme.error,
                                  ),
                        ),
                        if (onRetry != null) ...[
                          const SizedBox(width: 6),
                          Icon(
                            Icons.refresh_rounded,
                            size: 12,
                            color: Theme.of(context).colorScheme.error,
                          ),
                          const SizedBox(width: 2),
                          Text(
                            'Retry',
                            style: Theme.of(context)
                                .textTheme
                                .labelSmall
                                ?.copyWith(
                                  color: Theme.of(context).colorScheme.error,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );

    // ── Message actions row (shown below assistant bubbles) ──
    Widget? actionsRow;
    if (!isUser && !isStreaming && message.status == ChatMessageStatus.sent) {
      actionsRow = Padding(
        padding: const EdgeInsets.only(left: 46, top: 4, bottom: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _ActionChip(
              icon: Icons.copy_rounded,
              label: 'Copy',
              tokens: tokens,
              cinematic: cinematic,
              onTap: onCopy,
            ),
            const SizedBox(width: 4),
            if (onRegenerate != null) ...[
              _ActionChip(
                icon: Icons.refresh_rounded,
                label: 'Regenerate',
                tokens: tokens,
                cinematic: cinematic,
                onTap: onRegenerate,
              ),
              const SizedBox(width: 4),
            ],
            const SizedBox(width: 8),
            _ActionChip(
              icon: feedback == MessageFeedback.up
                  ? Icons.thumb_up_rounded
                  : Icons.thumb_up_outlined,
              label: feedback == MessageFeedback.up ? 'Liked' : 'Like',
              tokens: tokens,
              cinematic: cinematic,
              isActive: feedback == MessageFeedback.up,
              onTap: onThumbsUp,
            ),
            const SizedBox(width: 2),
            _ActionChip(
              icon: feedback == MessageFeedback.down
                  ? Icons.thumb_down_rounded
                  : Icons.thumb_down_outlined,
              label: feedback == MessageFeedback.down ? 'Disliked' : 'Dislike',
              tokens: tokens,
              cinematic: cinematic,
              isActive: feedback == MessageFeedback.down,
              onTap: onThumbsDown,
            ),
            if (onReadAloud != null) ...[
              const SizedBox(width: 4),
              _ActionChip(
                icon: isReadingAloud
                    ? Icons.stop_circle_outlined
                    : Icons.volume_up_rounded,
                label: isReadingAloud ? 'Stop' : 'Read',
                tokens: tokens,
                cinematic: cinematic,
                isActive: isReadingAloud,
                onTap: onReadAloud,
              ),
            ],
            // Expand / Artifact panel — shown when message is long
            if (message.text.length > 400) ...[
              const SizedBox(width: 4),
              _ActionChip(
                icon: Icons.open_in_full_rounded,
                label: 'Expand',
                tokens: tokens,
                cinematic: cinematic,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => _ArtifactPage(
                      message: message,
                      visualMode: visualMode,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      );
    }

    // ── Inline action buttons from structured blocks ──
    Widget? actionButtonsRow;
    if (!isUser &&
        !isStreaming &&
        message.status == ChatMessageStatus.sent &&
        actionButtons.isNotEmpty) {
      actionButtonsRow = Padding(
        padding: const EdgeInsets.only(left: 46, top: 4, bottom: 2),
        child: Wrap(
          spacing: 6,
          runSpacing: 6,
          children: actionButtons.map((button) {
            final disabled = isActionDisabled?.call(button.id) ?? false;
            return _InlineActionButton(
              label: button.label,
              action: button.action,
              disabled: disabled,
              tokens: tokens,
              cinematic: cinematic,
              onTap: onActionTap == null ? null : () => onActionTap!(button),
            );
          }).toList(),
        ),
      );
    }

    // ── Layout with avatar for assistant ──
    Widget content;
    if (isUser) {
      content = Align(
        alignment: Alignment.centerRight,
        child: Padding(
          padding:
              const EdgeInsets.only(left: 48, right: 14, top: 3, bottom: 3),
          child: bubble,
        ),
      );
    } else {
      content = Padding(
        padding: const EdgeInsets.only(left: 10, right: 48, top: 3, bottom: 3),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _AssistantAvatar(tokens: tokens, cinematic: cinematic),
                const SizedBox(width: 8),
                Flexible(child: bubble),
              ],
            ),
            if (actionsRow != null) actionsRow,
            if (actionButtonsRow != null) actionButtonsRow,
            if (!isUser && !isStreaming)
              _FileDownloadChips(
                text: message.text,
                tokens: tokens,
                cinematic: cinematic,
              ),
          ],
        ),
      );
    }

    return Semantics(
      label:
          '${isUser ? "You" : (message.senderName ?? "Sven")}: ${message.text}'
          '${isSending ? ". Sending" : (isFailed ? ". Failed to send" : (isQueued ? ". Queued, pending delivery" : ""))}',
      child: onLongPress != null
          ? GestureDetector(onLongPress: onLongPress, child: content)
          : content,
    );
  }

  /// Render local image thumbnails as a compact wrap grid.
  Widget _buildImageStrip(
      List<String> paths, bool cinematic, SvenModeTokens tokens) {
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: paths.map((path) {
        return ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.file(
            File(path),
            width: 80,
            height: 80,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: tokens.onSurface.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                Icons.broken_image_rounded,
                color: tokens.onSurface.withValues(alpha: 0.35),
                size: 28,
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Action chip (copy, regenerate, etc.)
// ═══════════════════════════════════════════════════════════════════════════
// File download chips — shown below assistant messages that contain file links
// ═══════════════════════════════════════════════════════════════════════════

/// Extracts markdown-style links whose URL ends in a known file extension.
List<MapEntry<String, String>> _extractFileLinks(String text) {
  const extPattern =
      r'\.(csv|json|pdf|png|jpg|jpeg|gif|svg|zip|txt|mp4|mp3|wav|xlsx|docx)';
  final re = RegExp(
    r'\[([^\]]+)\]\((https?://[^)]+' + extPattern + r')\)',
    caseSensitive: false,
  );
  return re
      .allMatches(text)
      .map((m) => MapEntry(m.group(1)!, m.group(2)!))
      .toList();
}

class _FileDownloadChips extends StatelessWidget {
  const _FileDownloadChips({
    required this.text,
    required this.tokens,
    required this.cinematic,
  });

  final String text;
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  Widget build(BuildContext context) {
    final links = _extractFileLinks(text);
    if (links.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(left: 40, top: 4, right: 48),
      child: Wrap(
        spacing: 6,
        runSpacing: 4,
        children: links.map((e) {
          final label = e.key;
          final url = e.value;
          return Semantics(
            label: 'Download $label',
            button: true,
            child: InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () => launchUrl(
                Uri.parse(url),
                mode: LaunchMode.externalApplication,
              ),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  border: Border.all(
                    color: tokens.primary.withValues(alpha: 0.55),
                  ),
                  borderRadius: BorderRadius.circular(20),
                  color: tokens.primary.withValues(alpha: 0.07),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.download_rounded,
                      size: 14,
                      color: tokens.primary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 12,
                        color: tokens.primary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════

class _InlineActionButton extends StatelessWidget {
  const _InlineActionButton({
    required this.label,
    required this.action,
    required this.tokens,
    required this.cinematic,
    this.onTap,
    this.disabled = false,
  });

  final String label;
  final String action;
  final SvenModeTokens tokens;
  final bool cinematic;
  final VoidCallback? onTap;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final normalized = action.toLowerCase();
    Color borderColor = tokens.onSurface.withValues(alpha: 0.20);
    Color fillColor = tokens.onSurface.withValues(alpha: 0.06);
    Color textColor = tokens.onSurface.withValues(alpha: 0.85);
    if (normalized == 'approve') {
      borderColor = tokens.success.withValues(alpha: 0.45);
      fillColor = tokens.success.withValues(alpha: 0.12);
      textColor = tokens.success;
    } else if (normalized == 'reject') {
      borderColor = tokens.error.withValues(alpha: 0.45);
      fillColor = tokens.error.withValues(alpha: 0.12);
      textColor = tokens.error;
    }

    return Semantics(
      label: label,
      button: true,
      enabled: onTap != null && !disabled,
      child: Opacity(
        opacity: disabled ? 0.5 : 1,
        child: InkWell(
          onTap: disabled ? null : onTap,
          borderRadius: BorderRadius.circular(18),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              border: Border.all(color: borderColor),
              borderRadius: BorderRadius.circular(18),
              color: cinematic ? fillColor.withValues(alpha: 0.8) : fillColor,
            ),
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: textColor,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════

class _ActionChip extends StatelessWidget {
  const _ActionChip({
    required this.icon,
    required this.label,
    required this.tokens,
    required this.cinematic,
    this.onTap,
    this.isActive = false,
  });

  final IconData icon;
  final String label;
  final SvenModeTokens tokens;
  final bool cinematic;
  final VoidCallback? onTap;
  final bool isActive;

  @override
  Widget build(BuildContext context) {
    final iconColor =
        isActive ? tokens.primary : tokens.onSurface.withValues(alpha: 0.40);
    return Semantics(
      label: label.isNotEmpty ? label : null,
      button: true,
      enabled: onTap != null,
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon, size: 14, color: iconColor),
                  if (label.isNotEmpty) ...[
                    const SizedBox(width: 4),
                    Text(
                      label,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: isActive
                                ? tokens.primary
                                : tokens.onSurface.withValues(alpha: 0.45),
                          ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Long-press context menu action row item
// ═══════════════════════════════════════════════════════════════════════════

class _MenuAction extends StatelessWidget {
  const _MenuAction({
    required this.icon,
    required this.label,
    required this.tokens,
    required this.cinematic,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final SvenModeTokens tokens;
  final bool cinematic;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        child: Row(
          children: [
            Icon(icon, size: 20, color: tokens.primary),
            const SizedBox(width: 14),
            Text(
              label,
              style: TextStyle(
                color: tokens.onSurface,
                fontSize: 15,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Code block builder with copy button + header
// ═══════════════════════════════════════════════════════════════════════════

/// State of the in-block execution feedback pill.
enum _RunState { idle, running, done }

class _CodeBlockBuilder extends MarkdownElementBuilder {
  _CodeBlockBuilder({
    required this.tokens,
    required this.cinematic,
    this.onRunCode,
  });

  final SvenModeTokens tokens;
  final bool cinematic;
  final void Function(String code, String language)? onRunCode;

  @override
  Widget? visitElementAfterWithContext(
    BuildContext context,
    md.Element element,
    TextStyle? preferredStyle,
    TextStyle? parentStyle,
  ) {
    // Handle <pre> containing <code>
    String code = element.textContent.trimRight();
    String language = '';

    // Try to extract language from the code child element
    if (element.children != null && element.children!.isNotEmpty) {
      final codeEl = element.children!.first;
      if (codeEl is md.Element) {
        final cls = codeEl.attributes['class'] ?? '';
        if (cls.startsWith('language-')) {
          language = cls.replaceFirst('language-', '');
        }
      }
    }

    // Render Mermaid diagrams in a WebView instead of a code block
    if (language == 'mermaid') {
      return MermaidBlock(
        source: code,
        tokens: tokens,
        cinematic: cinematic,
      );
    }

    return _CodeBlock(
      code: code,
      language: language,
      tokens: tokens,
      cinematic: cinematic,
      onRunCode: onRunCode,
    );
  }
}

class _CodeBlock extends StatefulWidget {
  const _CodeBlock({
    required this.code,
    required this.language,
    required this.tokens,
    required this.cinematic,
    this.onRunCode,
  });

  final String code;
  final String language;
  final SvenModeTokens tokens;
  final bool cinematic;
  final void Function(String code, String language)? onRunCode;

  @override
  State<_CodeBlock> createState() => _CodeBlockState();
}

class _CodeBlockState extends State<_CodeBlock>
    with SingleTickerProviderStateMixin {
  static const _collapseThreshold = 15;
  static const _collapsedLines = 10;

  bool _expanded = false;
  late final AnimationController _animController;
  _RunState _runState = _RunState.idle;

  bool get _isLong =>
      '\n'.allMatches(widget.code).length + 1 > _collapseThreshold;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      duration: const Duration(milliseconds: 250),
      vsync: this,
    );
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  void _toggle() {
    setState(() => _expanded = !_expanded);
    if (_expanded) {
      _animController.forward();
    } else {
      _animController.reverse();
    }
  }

  void _copy() {
    Clipboard.setData(ClipboardData(text: widget.code));
    HapticFeedback.lightImpact();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Code copied'),
        duration: Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  /// Fires the parent's onRunCode callback and drives the in-block status pill.
  void _onRun() {
    if (_runState != _RunState.idle) return;
    widget.onRunCode!(widget.code, widget.language);
    setState(() => _runState = _RunState.running);
    Future.delayed(const Duration(milliseconds: 600), () {
      if (mounted) setState(() => _runState = _RunState.done);
    });
    Future.delayed(const Duration(milliseconds: 4600), () {
      if (mounted) setState(() => _runState = _RunState.idle);
    });
  }

  String get _collapsedCode {
    final lines = widget.code.split('\n');
    if (lines.length <= _collapseThreshold) return widget.code;
    return lines.take(_collapsedLines).join('\n');
  }

  @override
  Widget build(BuildContext context) {
    final tokens = widget.tokens;
    final cinematic = widget.cinematic;
    final isLong = _isLong;

    final codeStyle = TextStyle(
      fontFamily: 'monospace',
      fontSize: 13,
      height: 1.5,
      color: cinematic
          ? const Color(0xFFE6EDF3)
          : tokens.onSurface.withValues(alpha: 0.85),
    );

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(
        color: cinematic
            ? const Color(0xFF0D1117)
            : tokens.onSurface.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(10),
        border: cinematic
            ? Border.all(color: tokens.frame)
            : Border.all(color: tokens.onSurface.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with language label and copy button
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: cinematic
                  ? Colors.white.withValues(alpha: 0.04)
                  : tokens.onSurface.withValues(alpha: 0.03),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(10),
                topRight: Radius.circular(10),
              ),
            ),
            child: Row(
              children: [
                if (widget.language.isNotEmpty)
                  Text(
                    widget.language,
                    style: TextStyle(
                      fontSize: 11,
                      color: cinematic
                          ? tokens.primary.withValues(alpha: 0.7)
                          : tokens.onSurface.withValues(alpha: 0.5),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                const Spacer(),
                Material(
                  color: Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: _copy,
                    borderRadius: BorderRadius.circular(6),
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.copy_rounded,
                              size: 13,
                              color: tokens.onSurface.withValues(alpha: 0.45)),
                          const SizedBox(width: 4),
                          Text(
                            'Copy',
                            style: TextStyle(
                              fontSize: 11,
                              color: tokens.onSurface.withValues(alpha: 0.5),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                // ── Run button (Python / JS / TS / shell only) ──
                if (widget.onRunCode != null &&
                    const {
                      'python',
                      'javascript',
                      'typescript',
                      'js',
                      'ts',
                      'bash',
                      'shell',
                      'sh',
                      'ruby',
                      'rb'
                    }.contains(widget.language.toLowerCase())) ...[
                  const SizedBox(width: 4),
                  Material(
                    color: Colors.transparent,
                    borderRadius: BorderRadius.circular(6),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: _onRun,
                      borderRadius: BorderRadius.circular(6),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 4),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.play_arrow_rounded,
                                size: 13, color: tokens.primary),
                            const SizedBox(width: 3),
                            Text(
                              'Run',
                              style: TextStyle(
                                fontSize: 11,
                                color: tokens.primary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          // Code content — collapsible for long blocks
          if (!isLong)
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: SelectableText(widget.code, style: codeStyle),
            )
          else ...[
            AnimatedCrossFade(
              duration: const Duration(milliseconds: 250),
              crossFadeState: _expanded
                  ? CrossFadeState.showSecond
                  : CrossFadeState.showFirst,
              firstChild: Stack(
                children: [
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    child: SelectableText(_collapsedCode, style: codeStyle),
                  ),
                  // Gradient fade-out overlay
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 40,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            (cinematic ? const Color(0xFF0D1117) : Colors.white)
                                .withValues(alpha: 0),
                            cinematic ? const Color(0xFF0D1117) : Colors.white,
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              secondChild: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: SelectableText(widget.code, style: codeStyle),
              ),
            ),
            // Expand / collapse toggle
            InkWell(
              onTap: _toggle,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 6),
                decoration: BoxDecoration(
                  color: cinematic
                      ? Colors.white.withValues(alpha: 0.03)
                      : tokens.onSurface.withValues(alpha: 0.02),
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(10),
                    bottomRight: Radius.circular(10),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      _expanded
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      size: 16,
                      color: tokens.primary.withValues(alpha: 0.7),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      _expanded ? 'Show less' : 'Show more',
                      style: TextStyle(
                        fontSize: 11,
                        color: tokens.primary.withValues(alpha: 0.7),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
          // ── Run result pill — shows "Running…" then "Execution request sent" ──
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 250),
            transitionBuilder: (child, animation) => FadeTransition(
              opacity: animation,
              child: SizeTransition(sizeFactor: animation, child: child),
            ),
            child: _runState == _RunState.idle
                ? const SizedBox.shrink()
                : _RunResultPill(
                    key: ValueKey(_runState),
                    runState: _runState,
                    tokens: tokens,
                    cinematic: cinematic,
                  ),
          ),
        ],
      ),
    );
  }
}

class _RunResultPill extends StatelessWidget {
  const _RunResultPill({
    super.key,
    required this.runState,
    required this.tokens,
    required this.cinematic,
  });

  final _RunState runState;
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  Widget build(BuildContext context) {
    final isRunning = runState == _RunState.running;
    return Semantics(
      liveRegion: true,
      label: isRunning ? 'Running code' : 'Execution request sent',
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: tokens.primary.withValues(alpha: isRunning ? 0.06 : 0.11),
          border: Border(
            top: BorderSide(
              color: tokens.primary.withValues(alpha: 0.15),
              width: 0.5,
            ),
          ),
          borderRadius: const BorderRadius.only(
            bottomLeft: Radius.circular(10),
            bottomRight: Radius.circular(10),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isRunning)
              SizedBox(
                width: 11,
                height: 11,
                child: CircularProgressIndicator(
                  strokeWidth: 1.5,
                  color: tokens.primary.withValues(alpha: 0.7),
                ),
              )
            else
              Icon(Icons.check_circle_outline_rounded,
                  size: 13, color: tokens.primary),
            const SizedBox(width: 6),
            Text(
              isRunning ? 'Running…' : 'Execution request sent',
              style: TextStyle(
                fontSize: 11,
                color: tokens.primary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Branded assistant avatar.
class _AssistantAvatar extends StatelessWidget {
  const _AssistantAvatar({required this.tokens, required this.cinematic});

  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 30,
      height: 30,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        boxShadow: cinematic
            ? [
                BoxShadow(
                  color: tokens.primary.withValues(alpha: 0.25),
                  blurRadius: 8,
                ),
              ]
            : null,
      ),
      child: const SvenAppIcon(size: 30, borderRadius: 10),
    );
  }
}

enum BannerTone { info, warning, critical }

class _StatusBanner extends StatelessWidget {
  const _StatusBanner({
    required this.title,
    required this.message,
    required this.tone,
  });

  final String title;
  final String message;
  final BannerTone tone;

  @override
  Widget build(BuildContext context) {
    final color = switch (tone) {
      BannerTone.info => Theme.of(context).colorScheme.primary,
      BannerTone.warning => Theme.of(context).colorScheme.tertiary,
      BannerTone.critical => Theme.of(context).colorScheme.error,
    };
    return Semantics(
      container: true,
      liveRegion: tone == BannerTone.critical,
      label: '$title. $message',
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.labelLarge),
                  const SizedBox(height: 4),
                  Text(message),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Message feedback (thumbs up / down)
// ═══════════════════════════════════════════════════════════════════════════

enum MessageFeedback { up, down }

// ═══════════════════════════════════════════════════════════════════════════
// LaTeX math rendering helpers
// ═══════════════════════════════════════════════════════════════════════════

/// Pre-process markdown text: convert `$$...$$` to fenced block math
/// and `$...$` to inline `<imath>` tags that our custom InlineSyntax
/// will pick up.
String _preprocessLatex(String text) {
  // Handle block math: $$...$$ → imath tags (will render display-style)
  text = text.replaceAllMapped(
    RegExp(r'\$\$(.+?)\$\$', dotAll: true),
    (m) => '\n\n<imath>${m[1]!.trim()}</imath>\n\n',
  );
  // Handle inline math: $...$ (not $$)
  text = text.replaceAllMapped(
    RegExp(r'(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)'),
    (m) => '<imath>${m[1]}</imath>',
  );
  return text;
}

/// Custom inline syntax that matches `<imath>...</imath>` tags.
class _InlineMathSyntax extends md.InlineSyntax {
  _InlineMathSyntax() : super(r'<imath>(.*?)<\/imath>');

  @override
  bool onMatch(md.InlineParser parser, Match match) {
    final el = md.Element.text('imath', match[1]!);
    parser.addNode(el);
    return true;
  }
}

/// Builder that renders `<imath>` elements as LaTeX using flutter_math_fork.
class _InlineMathBuilder extends MarkdownElementBuilder {
  _InlineMathBuilder({required this.tokens, required this.cinematic});

  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  Widget? visitElementAfterWithContext(
    BuildContext context,
    md.Element element,
    TextStyle? preferredStyle,
    TextStyle? parentStyle,
  ) {
    final latex = element.textContent;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Math.tex(
          latex,
          textStyle: TextStyle(
            fontSize: 15,
            color: tokens.onSurface,
          ),
          mathStyle: MathStyle.display,
          onErrorFallback: (err) {
            // Fallback: show raw LaTeX in monospace
            return Text(
              latex,
              style: TextStyle(
                fontFamily: 'monospace',
                fontSize: 13,
                color: cinematic ? tokens.primary : tokens.onSurface,
              ),
            );
          },
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Markdown image rendering — bandwidth-aware
// On Wi-Fi / Ethernet → auto-loads. On mobile data → tap-to-load placeholder.
// ═══════════════════════════════════════════════════════════════════════════

class _MarkdownImage extends StatefulWidget {
  const _MarkdownImage({
    required this.uri,
    this.title,
    this.alt,
    required this.tokens,
    required this.cinematic,
  });

  final Uri uri;
  final String? title;
  final String? alt;
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  State<_MarkdownImage> createState() => _MarkdownImageState();
}

class _MarkdownImageState extends State<_MarkdownImage> {
  bool _shouldLoad = true; // eagerly true; flipped to false if on mobile data
  bool _onCellular = false;

  @override
  void initState() {
    super.initState();
    _checkConnectivity();
  }

  Future<void> _checkConnectivity() async {
    final results = await Connectivity().checkConnectivity();
    final isMobile = results.contains(ConnectivityResult.mobile) &&
        !results.contains(ConnectivityResult.wifi) &&
        !results.contains(ConnectivityResult.ethernet);
    if (!mounted) return;
    setState(() {
      _onCellular = isMobile;
      if (isMobile) _shouldLoad = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final tokens = widget.tokens;
    final cinematic = widget.cinematic;
    final uri = widget.uri;
    final alt = widget.alt;

    // ── Bandwidth-saver placeholder ──────────────────────────────────────
    if (_onCellular && !_shouldLoad) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: GestureDetector(
          onTap: () => setState(() => _shouldLoad = true),
          child: Container(
            height: 80,
            width: double.infinity,
            decoration: BoxDecoration(
              color: cinematic
                  ? tokens.card
                  : tokens.onSurface.withValues(alpha: 0.04),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: cinematic
                    ? tokens.frame
                    : tokens.onSurface.withValues(alpha: 0.1),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.image_rounded,
                    size: 20, color: tokens.onSurface.withValues(alpha: 0.35)),
                const SizedBox(width: 10),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Tap to load image',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: tokens.primary,
                      ),
                    ),
                    Text(
                      'Saving mobile data',
                      style: TextStyle(
                        fontSize: 11,
                        color: tokens.onSurface.withValues(alpha: 0.45),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );
    }

    // ── Full image load ──────────────────────────────────────────────────
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Container(
          constraints: const BoxConstraints(maxHeight: 300),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: cinematic
                  ? tokens.frame
                  : tokens.onSurface.withValues(alpha: 0.1),
            ),
          ),
          child: Image.network(
            uri.toString(),
            fit: BoxFit.contain,
            loadingBuilder: (context, child, progress) {
              if (progress == null) return child;
              final pct = progress.expectedTotalBytes != null
                  ? progress.cumulativeBytesLoaded /
                      progress.expectedTotalBytes!
                  : null;
              return Container(
                height: 160,
                width: double.infinity,
                color: cinematic
                    ? tokens.card
                    : tokens.onSurface.withValues(alpha: 0.04),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircularProgressIndicator(
                        value: pct,
                        strokeWidth: 2,
                        color: tokens.primary,
                      ),
                      if (pct != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          '${(pct * 100).toInt()}%',
                          style: TextStyle(
                            fontSize: 11,
                            color: tokens.onSurface.withValues(alpha: 0.5),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            },
            errorBuilder: (context, error, stack) {
              return Container(
                height: 80,
                width: double.infinity,
                color: cinematic
                    ? tokens.card
                    : tokens.onSurface.withValues(alpha: 0.04),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.broken_image_rounded,
                        size: 28,
                        color: tokens.onSurface.withValues(alpha: 0.3)),
                    const SizedBox(height: 4),
                    Text(
                      alt ?? 'Image failed to load',
                      style: TextStyle(
                        fontSize: 11,
                        color: tokens.onSurface.withValues(alpha: 0.4),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Keyboard-aware composer wrapper
// Smoothly slides with the software keyboard using AnimatedContainer driven
// by MediaQuery.viewInsets.bottom.
// ═══════════════════════════════════════════════════════════════════════════

class _KeyboardAwareComposer extends StatelessWidget {
  const _KeyboardAwareComposer({
    required this.child,
    required this.visualMode,
  });

  final Widget child;
  final VisualMode visualMode;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
      padding: EdgeInsets.fromLTRB(12, 8, 12, bottom > 0 ? 8 : 12),
      child: child,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Sven-branded pull-to-refresh indicator
// ═══════════════════════════════════════════════════════════════════════════

class _SvenRefreshIndicator extends StatelessWidget {
  const _SvenRefreshIndicator({
    required this.child,
    required this.onRefresh,
    required this.visualMode,
  });

  final Widget child;
  final RefreshCallback onRefresh;
  final VisualMode visualMode;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: tokens.primary,
      backgroundColor: visualMode == VisualMode.cinematic
          ? const Color(0xFF0D1B2A)
          : Colors.white,
      strokeWidth: 2.5,
      displacement: 48,
      child: child,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TTS mini-player bar — shows above composer when Sven is speaking
// ═══════════════════════════════════════════════════════════════════════════

class _TtsMiniPlayer extends StatelessWidget {
  const _TtsMiniPlayer({
    required this.voiceService,
    required this.visualMode,
  });

  final VoiceService voiceService;
  final VisualMode visualMode;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    final cinematic = visualMode == VisualMode.cinematic;
    final isPaused = voiceService.ttsState == TtsState.paused;

    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: cinematic
            ? tokens.surface.withValues(alpha: 0.6)
            : tokens.surface.withValues(alpha: 0.95),
        border: Border(
          top: BorderSide(
            color: cinematic
                ? tokens.primary.withValues(alpha: 0.25)
                : tokens.frame,
            width: 1,
          ),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.record_voice_over_rounded,
            size: 16,
            color: tokens.primary,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              isPaused ? 'Paused' : 'Sven is speaking…',
              style: TextStyle(
                fontSize: 12,
                color: tokens.onSurface.withValues(alpha: 0.65),
              ),
            ),
          ),
          // Speed indicator
          GestureDetector(
            onTap: () {
              final next = voiceService.ttsSpeed < 1.5
                  ? 1.5
                  : voiceService.ttsSpeed < 2.0
                      ? 2.0
                      : 1.0;
              voiceService.setSpeed(next);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: tokens.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '${voiceService.ttsSpeed.toStringAsFixed(1)}×',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: tokens.primary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          // Pause / resume
          IconButton(
            icon: Icon(
              isPaused ? Icons.play_arrow_rounded : Icons.pause_rounded,
              size: 20,
            ),
            color: tokens.onSurface.withValues(alpha: 0.75),
            onPressed: () {
              if (isPaused) {
                voiceService.resumeSpeaking();
              } else {
                voiceService.pauseSpeaking();
              }
            },
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
          ),
          // Stop
          IconButton(
            icon: const Icon(Icons.stop_rounded, size: 20),
            color: tokens.onSurface.withValues(alpha: 0.75),
            onPressed: voiceService.stopSpeaking,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
          ),
        ],
      ),
    );
  }
}
// ── Helpers ─────────────────────────────────────────────────────────────────

bool _isSameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

// ── Date separator widget ────────────────────────────────────────────────────

class _DateSeparator extends StatelessWidget {
  const _DateSeparator({required this.date, required this.visualMode});

  final DateTime date;
  final VisualMode visualMode;

  String _label() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final d = DateTime(date.year, date.month, date.day);
    final diff = today.difference(d).inDays;
    if (diff == 0) return 'Today';
    if (diff == 1) return 'Yesterday';
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final suffix = diff < 365
        ? '${months[date.month - 1]} ${date.day}'
        : '${months[date.month - 1]} ${date.day}, ${date.year}';
    return suffix;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Expanded(
            child: Divider(
              color: tokens.onSurface.withValues(alpha: 0.1),
              height: 1,
            ),
          ),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 12),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: tokens.onSurface.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              _label(),
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: tokens.onSurface.withValues(alpha: 0.45),
                letterSpacing: 0.3,
              ),
            ),
          ),
          Expanded(
            child: Divider(
              color: tokens.onSurface.withValues(alpha: 0.1),
              height: 1,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Reaction bar ─────────────────────────────────────────────────────────────

class _ReactionBar extends StatelessWidget {
  const _ReactionBar({
    required this.reactions,
    required this.onTap,
    required this.isUser,
    required this.tokens,
  });

  final Set<String> reactions;
  final void Function(String emoji) onTap;
  final bool isUser;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: isUser ? 0 : 56,
        right: isUser ? 16 : 0,
        bottom: 6,
      ),
      child: Wrap(
        spacing: 4,
        children: reactions.map((emoji) {
          return GestureDetector(
            onTap: () => onTap(emoji),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: tokens.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: tokens.primary.withValues(alpha: 0.3),
                  width: 1,
                ),
              ),
              child: Text(emoji, style: const TextStyle(fontSize: 14)),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// _ArtifactPage — full-screen reading view for long assistant messages
// ═══════════════════════════════════════════════════════════════════════════

class _ArtifactPage extends StatelessWidget {
  const _ArtifactPage({
    required this.message,
    required this.visualMode,
  });

  final ChatMessage message;
  final VisualMode visualMode;

  int get _wordCount {
    final s = message.text.trim();
    if (s.isEmpty) return 0;
    return s.split(RegExp(r'\s+')).length;
  }

  void _copyAll(BuildContext context) {
    Clipboard.setData(ClipboardData(text: message.text));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Copied to clipboard'),
        behavior: SnackBarBehavior.floating,
        duration: Duration(seconds: 2),
      ),
    );
  }

  void _shareAll() {
    Share.share(message.text, subject: 'Sven response');
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    final cinematic = visualMode == VisualMode.cinematic;

    return Scaffold(
      backgroundColor: cinematic ? tokens.scaffold : tokens.scaffold,
      appBar: AppBar(
        backgroundColor: cinematic ? tokens.card : tokens.surface,
        title: Text(
          'Sven\'s response',
          style: TextStyle(
            color: tokens.onSurface,
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
        ),
        leading: IconButton(
          icon: Icon(Icons.close_rounded, color: tokens.onSurface),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.copy_rounded,
                color: tokens.onSurface.withValues(alpha: 0.7)),
            tooltip: 'Copy all',
            onPressed: () => _copyAll(context),
          ),
          IconButton(
            icon: Icon(Icons.share_rounded,
                color: tokens.onSurface.withValues(alpha: 0.7)),
            tooltip: 'Share',
            onPressed: _shareAll,
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  MarkdownBody(
                    data: message.text,
                    selectable: true,
                    styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context))
                        .copyWith(
                      p: TextStyle(
                        color: tokens.onSurface,
                        fontSize: 16,
                        height: 1.6,
                      ),
                      strong: TextStyle(
                        color: tokens.onSurface,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                      code: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 13,
                        color: cinematic ? tokens.primary : tokens.onSurface,
                        backgroundColor: cinematic
                            ? tokens.primary.withValues(alpha: 0.08)
                            : tokens.onSurface.withValues(alpha: 0.06),
                      ),
                      codeblockDecoration: BoxDecoration(
                        color: cinematic
                            ? const Color(0xFF0D1117)
                            : tokens.onSurface.withValues(alpha: 0.04),
                        borderRadius: BorderRadius.circular(10),
                        border: cinematic
                            ? Border.all(color: tokens.frame)
                            : Border.all(
                                color:
                                    tokens.onSurface.withValues(alpha: 0.08)),
                      ),
                      codeblockPadding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                    ),
                  ),
                ],
              ),
            ),
          ),
          // ── Bottom bar ──
          SafeArea(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: cinematic ? tokens.card : tokens.surface,
                border: Border(
                  top: BorderSide(
                    color: cinematic
                        ? tokens.frame
                        : tokens.onSurface.withValues(alpha: 0.08),
                    width: 0.5,
                  ),
                ),
              ),
              child: Row(
                children: [
                  Text(
                    '$_wordCount words · ${message.text.length} chars',
                    style: TextStyle(
                      fontSize: 12,
                      color: tokens.onSurface.withValues(alpha: 0.4),
                    ),
                  ),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: () => _copyAll(context),
                    icon: Icon(Icons.copy_rounded,
                        size: 16, color: tokens.primary),
                    label: Text('Copy all',
                        style: TextStyle(
                            color: tokens.primary,
                            fontWeight: FontWeight.w600)),
                  ),
                  const SizedBox(width: 8),
                  TextButton.icon(
                    onPressed: _shareAll,
                    icon: Icon(Icons.share_rounded,
                        size: 16, color: tokens.primary),
                    label: Text('Share',
                        style: TextStyle(
                            color: tokens.primary,
                            fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
