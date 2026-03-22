import 'dart:async';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:desktop_drop/desktop_drop.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../app/analytics_service.dart';
import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import 'chat_models.dart';
import 'prompt_history_service.dart';
import 'prompt_templates_service.dart';
import 'slash_commands.dart';
import 'voice_overlay.dart';
import 'voice_service.dart';
import '../notifications/reminder_service.dart';

class _SendIntent extends Intent {
  const _SendIntent();
}

class _CancelIntent extends Intent {
  const _CancelIntent();
}

class _RetryIntent extends Intent {
  const _RetryIntent();
}

class _HistoryUpIntent extends Intent {
  const _HistoryUpIntent();
}

class _HistoryDownIntent extends Intent {
  const _HistoryDownIntent();
}

/// Premium capsule chat input — mic, expanding field, animated send button.
///
/// Cinematic: glow-bordered dark capsule, cyan accents.
/// Classic:   clean white capsule with soft shadow.
class ChatComposer extends StatefulWidget {
  const ChatComposer({
    super.key,
    this.chatId,
    required this.onSend,
    required this.onCancel,
    required this.onRetry,
    required this.isSending,
    required this.hasFailed,
    required this.isEnabled,
    this.visualMode = VisualMode.classic,
    this.motionLevel = MotionLevel.full,
    this.voiceService,
    this.quoteMessage,
    this.onClearQuote,
    this.onNewChat,
    this.onClearChat,
    this.onModeChange,
    this.currentMode = ConversationMode.balanced,
    this.promptHistory,
    this.promptTemplatesService,
    this.editPrefillText,
  });

  final void Function(String text, List<String> imagePaths) onSend;
  final VoidCallback onCancel;
  final VoidCallback onRetry;
  final bool isSending;
  final bool hasFailed;
  final bool isEnabled;
  final VisualMode visualMode;
  final MotionLevel motionLevel;
  final VoiceService? voiceService;

  /// When set, enables draft auto-save/restore keyed by this ID.
  final String? chatId;

  /// When set, a reply/quote strip is shown above the input.
  final ChatMessage? quoteMessage;
  final VoidCallback? onClearQuote;

  /// Slash command callbacks
  final VoidCallback? onNewChat;
  final VoidCallback? onClearChat;
  final void Function(ConversationMode)? onModeChange;
  final ConversationMode currentMode;

  /// Optional prompt history service for up/down arrow recall.
  final PromptHistoryService? promptHistory;

  /// Optional templates service for /save and /templates slash commands.
  final PromptTemplatesService? promptTemplatesService;

  /// When set, pre-fills the text field (used for edit-message flow).
  final String? editPrefillText;

  @override
  State<ChatComposer> createState() => _ChatComposerState();
}

class _ChatComposerState extends State<ChatComposer>
    with SingleTickerProviderStateMixin {
  final _controller = TextEditingController();
  final _fieldFocus = FocusNode();

  // Upload / send progress animation
  late final AnimationController _progressCtrl;
  bool _showProgress = false;
  bool _hasText = false;
  bool _fieldFocused = false;
  bool _composerExpanded = true;
  bool _isDragging = false;
  List<XFile> _attachedImages = [];
  PlatformFile? _attachedFile;
  String? _docPreviewText; // extracted text preview for readable file types
  String? _fullFileContent; // full text content for code / text files (≤30 KB)

  static const _maxImages = 5;

  // Slash command overlay
  List<SlashCommand> _slashMatches = [];
  bool _showSlash = false;
  final LayerLink _layerLink = LayerLink();
  OverlayEntry? _slashOverlay;

  // @-mention overlay
  final List<_AtMention> _atMentions = [
    const _AtMention(
        trigger: 'web',
        label: 'Web search',
        icon: Icons.language_rounded,
        prefix: '[web search mode] '),
    const _AtMention(
        trigger: 'code',
        label: 'Code mode',
        icon: Icons.code_rounded,
        prefix: '[code mode] '),
    const _AtMention(
        trigger: 'math',
        label: 'Math mode',
        icon: Icons.calculate_outlined,
        prefix: '[math mode] '),
    const _AtMention(
        trigger: 'translate',
        label: 'Translation mode',
        icon: Icons.translate_rounded,
        prefix: '[translation mode] '),
  ];
  List<_AtMention> _atMatches = [];
  bool _showAt = false;
  OverlayEntry? _atOverlay;

  // Token counter (rough estimate: 1 token ≈ 4 chars)
  int get _estimatedTokens => (_controller.text.length / 4).ceil();

  // ── Draft persistence ────────────────────────────────────────────────────
  Timer? _draftSaveTimer;

  String? get _draftKey =>
      widget.chatId != null ? 'draft_${widget.chatId}' : null;

  Future<void> _loadDraft() async {
    final key = _draftKey;
    if (key == null) return;
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(key) ?? '';
    if (saved.isEmpty || !mounted) return;
    // Only restore if the field is still empty (avoids clobbering editPrefill)
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _controller.text.isEmpty) {
        _controller.text = saved;
        _controller.selection = TextSelection.collapsed(offset: saved.length);
      }
    });
  }

  void _scheduleDraftSave() {
    _draftSaveTimer?.cancel();
    _draftSaveTimer = Timer(const Duration(milliseconds: 600), () async {
      final key = _draftKey;
      if (key == null) return;
      final prefs = await SharedPreferences.getInstance();
      final text = _controller.text;
      if (text.isEmpty) {
        await prefs.remove(key);
      } else {
        await prefs.setString(key, text);
      }
    });
  }

  void _clearDraft() {
    _draftSaveTimer?.cancel();
    final key = _draftKey;
    if (key == null) return;
    // Fire-and-forget removal so draft doesn't reappear on next open
    SharedPreferences.getInstance().then((p) => p.remove(key));
  }

  @override
  void initState() {
    super.initState();
    _progressCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 12),
    );
    _controller.addListener(() {
      final has = _controller.text.trim().isNotEmpty;
      if (has != _hasText) setState(() => _hasText = has);
      _updateSlashCommands(_controller.text);
      _updateAtMentions(_controller.text);
      _scheduleDraftSave();
    });
    _fieldFocus.addListener(() {
      final focused = _fieldFocus.hasFocus;
      if (focused != _fieldFocused) setState(() => _fieldFocused = focused);
      if (!focused) {
        _hideSlashOverlay();
        _hideAtOverlay();
      }
    });
    // Restore any previously saved draft for this thread
    _loadDraft();
  }

  @override
  void dispose() {
    _draftSaveTimer?.cancel();
    _hideSlashOverlay();
    _hideAtOverlay();
    _progressCtrl.dispose();
    _controller.dispose();
    _fieldFocus.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(ChatComposer old) {
    super.didUpdateWidget(old);

    // ── Thread switched — restore draft for the new thread ──
    if (widget.chatId != old.chatId) {
      _draftSaveTimer?.cancel();
      _controller.clear();
      _loadDraft();
    }

    // ── Upload progress animation ──
    if (widget.isSending && !old.isSending) {
      // Started sending — animate progress 0 → 0.92 over ~12s
      _progressCtrl.value = 0;
      _showProgress = true;
      _progressCtrl.animateTo(0.92, curve: Curves.easeOutCubic);
    } else if (!widget.isSending && old.isSending) {
      // Finished sending — snap to 1.0 then hide
      _progressCtrl
          .animateTo(1.0,
              duration: const Duration(milliseconds: 200), curve: Curves.easeIn)
          .then((_) {
        if (mounted) setState(() => _showProgress = false);
        _progressCtrl.reset();
      });
    }

    final newPrefill = widget.editPrefillText;
    if (newPrefill != null && newPrefill != old.editPrefillText) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _controller.text = newPrefill;
        _controller.selection = TextSelection.collapsed(
          offset: newPrefill.length,
        );
        _fieldFocus.requestFocus();
      });
    }
  }

  // ── Slash commands ──────────────────────────────────────────────────────

  void _updateSlashCommands(String text) {
    if (text.startsWith('/')) {
      final query = text.substring(1).toLowerCase();
      final matches =
          kSlashCommands.where((c) => c.command.startsWith(query)).toList();
      if (matches.isNotEmpty) {
        _slashMatches = matches;
        _showSlashOverlay();
        return;
      }
    }
    _hideSlashOverlay();
  }

  void _showSlashOverlay() {
    if (_slashOverlay != null) {
      _slashOverlay!.markNeedsBuild();
      return;
    }
    _slashOverlay = OverlayEntry(
        builder: (_) => _SlashCommandOverlay(
              layerLink: _layerLink,
              commands: _slashMatches,
              tokens: SvenTokens.forMode(widget.visualMode),
              cinematic: widget.visualMode == VisualMode.cinematic,
              onSelected: _handleSlashCommand,
            ));
    Overlay.of(context).insert(_slashOverlay!);
    setState(() => _showSlash = true);
  }

  void _hideSlashOverlay() {
    _slashOverlay?.remove();
    _slashOverlay = null;
    if (_showSlash) setState(() => _showSlash = false);
  }

  // ── @-mention commands ──────────────────────────────────────────────────

  void _updateAtMentions(String text) {
    final atIdx = text.lastIndexOf('@');
    if (atIdx >= 0) {
      final query = text.substring(atIdx + 1).toLowerCase();
      if (!query.contains(' ')) {
        final matches =
            _atMentions.where((m) => m.trigger.startsWith(query)).toList();
        if (matches.isNotEmpty) {
          _atMatches = matches;
          _showAtOverlay();
          return;
        }
      }
    }
    _hideAtOverlay();
  }

  void _showAtOverlay() {
    if (_atOverlay != null) {
      _atOverlay!.markNeedsBuild();
      return;
    }
    _atOverlay = OverlayEntry(
      builder: (_) => _AtMentionOverlay(
        layerLink: _layerLink,
        mentions: _atMatches,
        tokens: SvenTokens.forMode(widget.visualMode),
        cinematic: widget.visualMode == VisualMode.cinematic,
        onSelected: _handleAtMention,
      ),
    );
    Overlay.of(context).insert(_atOverlay!);
    setState(() => _showAt = true);
  }

  void _hideAtOverlay() {
    _atOverlay?.remove();
    _atOverlay = null;
    if (_showAt) setState(() => _showAt = false);
  }

  void _handleAtMention(_AtMention mention) {
    _hideAtOverlay();
    HapticFeedback.selectionClick();
    // Replace the @... token with the prefix text
    final text = _controller.text;
    final atIdx = text.lastIndexOf('@');
    if (atIdx >= 0) {
      _controller.value = TextEditingValue(
        text: text.substring(0, atIdx) + mention.prefix,
        selection:
            TextSelection.collapsed(offset: atIdx + mention.prefix.length),
      );
    }
  }

  void _handleSlashCommand(SlashCommand cmd) {
    _hideSlashOverlay();
    HapticFeedback.selectionClick();
    SvenAnalytics.instance.logSlashCommand(command: cmd.command);

    switch (cmd.command) {
      case 'new':
        _controller.clear();
        widget.onNewChat?.call();
        return;
      case 'clear':
        _controller.clear();
        widget.onClearChat?.call();
        return;
      case 'mode':
        _controller.clear();
        _showModeSheet();
        return;
      case 'remind':
        _controller.clear();
        _showRemindDialog();
        return;
      case 'save':
        _showSaveTemplateDialog();
        return;
      case 'templates':
        _controller.clear();
        _showTemplatesSheet();
        return;
    }

    if (cmd.insertText != null) {
      _controller.text = cmd.insertText!;
      _controller.selection = TextSelection.fromPosition(
        TextPosition(offset: _controller.text.length),
      );
    } else {
      _controller.clear();
    }
  }

  void _showModeSheet() {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: cinematic ? tokens.card : tokens.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: tokens.onSurface.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                child: Text(
                  'Conversation Mode',
                  style: TextStyle(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
              ),
              ...ConversationMode.values.map((m) {
                final selected = m == widget.currentMode;
                return ListTile(
                  leading: Text(m.icon, style: const TextStyle(fontSize: 20)),
                  title: Text(
                    m.label,
                    style: TextStyle(
                      color: selected ? tokens.primary : tokens.onSurface,
                      fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
                    ),
                  ),
                  subtitle: Text(
                    m.description,
                    style: TextStyle(
                      color: tokens.onSurface.withValues(alpha: 0.55),
                      fontSize: 12,
                    ),
                  ),
                  trailing: selected
                      ? Icon(Icons.check_rounded, color: tokens.primary)
                      : null,
                  onTap: () {
                    Navigator.pop(ctx);
                    widget.onModeChange?.call(m);
                    SvenAnalytics.instance.logModeChanged(mode: m.name);
                  },
                );
              }),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showRemindDialog() async {
    final tokens = SvenTokens.forMode(widget.visualMode);
    // Step 1: pick date
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(hours: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
      helpText: 'Set reminder date',
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme:
              Theme.of(ctx).colorScheme.copyWith(primary: tokens.primary),
        ),
        child: child!,
      ),
    );
    if (date == null || !mounted) return;

    // Step 2: pick time
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(now.add(const Duration(hours: 1))),
      helpText: 'Set reminder time',
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme:
              Theme.of(ctx).colorScheme.copyWith(primary: tokens.primary),
        ),
        child: child!,
      ),
    );
    if (time == null || !mounted) return;

    final scheduledAt = DateTime(
      date.year,
      date.month,
      date.day,
      time.hour,
      time.minute,
    );

    // Step 3: optional label
    String label = 'Sven reminder';
    final ctrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reminder note'),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(
            hintText: 'What should Sven remind you about?',
          ),
          maxLines: 2,
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Set reminder'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    if (ctrl.text.trim().isNotEmpty) label = ctrl.text.trim();

    await ReminderService.instance.schedule(
      scheduledTime: scheduledAt,
      title: label,
      body: 'Reminder set via Sven',
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Reminder set for ${scheduledAt.day}/${scheduledAt.month} at ${time.format(context)}',
          ),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 3),
        ),
      );
    }
  }

  /// Save the current composer text as a named prompt template.
  Future<void> _showSaveTemplateDialog() async {
    final service = widget.promptTemplatesService;
    final text = _controller.text.trim();
    if (service == null || text.isEmpty) return;

    final nameController = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Save template'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Give this prompt a name:'),
            const SizedBox(height: 12),
            TextField(
              controller: nameController,
              autofocus: true,
              decoration: const InputDecoration(
                hintText: 'e.g. Bug report, Blog intro…',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              final name = nameController.text.trim();
              if (name.isNotEmpty) {
                final messenger = ScaffoldMessenger.of(context);
                await service.save(name, text);
                if (ctx.mounted) {
                  Navigator.pop(ctx);
                  messenger.showSnackBar(
                    SnackBar(
                      content: Text('Template "$name" saved'),
                      behavior: SnackBarBehavior.floating,
                      duration: const Duration(seconds: 2),
                    ),
                  );
                }
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    nameController.dispose();
  }

  /// Show the saved prompt templates picker.
  void _showTemplatesSheet() {
    final service = widget.promptTemplatesService;
    if (service == null) return;
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: cinematic ? const Color(0xFF0D1B2A) : Colors.white,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => ListenableBuilder(
        listenable: service,
        builder: (ctx, __) {
          final templates = service.templates;
          return DraggableScrollableSheet(
            initialChildSize: 0.5,
            minChildSize: 0.3,
            maxChildSize: 0.85,
            expand: false,
            builder: (_, scrollController) => Column(
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
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                  child: Row(
                    children: [
                      Text(
                        'Prompt Templates',
                        style: TextStyle(
                          color: tokens.onSurface,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '${templates.length} saved',
                        style: TextStyle(
                          color: tokens.onSurface.withValues(alpha: 0.4),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                if (templates.isEmpty)
                  Expanded(
                    child: Center(
                      child: Text(
                        'No templates yet.\nType /save to save the current prompt.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: tokens.onSurface.withValues(alpha: 0.4),
                          fontSize: 14,
                        ),
                      ),
                    ),
                  )
                else
                  Expanded(
                    child: ListView.separated(
                      controller: scrollController,
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      itemCount: templates.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (lCtx, i) {
                        final t = templates[i];
                        return ListTile(
                          leading: Icon(
                            Icons.bookmark_rounded,
                            color: tokens.primary,
                            size: 20,
                          ),
                          title: Text(
                            t.name,
                            style: TextStyle(
                              color: tokens.onSurface,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          subtitle: Text(
                            t.text.length > 60
                                ? '${t.text.substring(0, 60)}…'
                                : t.text,
                            style: TextStyle(
                              color: tokens.onSurface.withValues(alpha: 0.5),
                              fontSize: 12,
                            ),
                          ),
                          trailing: IconButton(
                            icon: Icon(
                              Icons.delete_outline_rounded,
                              color: tokens.onSurface.withValues(alpha: 0.3),
                              size: 18,
                            ),
                            tooltip: 'Delete',
                            onPressed: () => service.delete(t.id),
                          ),
                          onTap: () {
                            Navigator.pop(ctx);
                            _controller.text = t.text;
                            _controller.selection = TextSelection.fromPosition(
                              TextPosition(offset: t.text.length),
                            );
                            _fieldFocus.requestFocus();
                          },
                        );
                      },
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _handleSend() {
    final text = _controller.text.trim();
    if (text.isEmpty && _attachedImages.isEmpty && _attachedFile == null) {
      return;
    }
    HapticFeedback.lightImpact();
    _hideSlashOverlay();
    _hideAtOverlay();
    // Include attachment info in message if present
    String sendText = text;
    if (_attachedImages.isNotEmpty) {
      final tags = _attachedImages.map((f) => '[Image: ${f.name}]').join('\n');
      sendText = sendText.isEmpty ? tags : '$tags\n$sendText';
      SvenAnalytics.instance.logImageAttached();
    }
    if (_attachedFile != null) {
      SvenAnalytics.instance.logFileAttached();
      if (_fullFileContent != null && _fullFileContent!.isNotEmpty) {
        // Embed the full file content as a fenced code block so the AI can
        // analyse it directly.  The filename / extension provide language hint.
        final ext = _attachedFile!.name.split('.').last.toLowerCase();
        final header = 'File: ${_attachedFile!.name}';
        final block = '```$ext\n$_fullFileContent\n```';
        final tag = '[$header]\n\n$block';
        sendText = sendText.isEmpty ? tag : '$sendText\n\n$tag';
      } else {
        final tag = '[File: ${_attachedFile!.name}]';
        sendText = sendText.isEmpty ? tag : '$tag\n$sendText';
      }
    }
    // Save to prompt history for up/down recall
    if (text.isNotEmpty) {
      widget.promptHistory?.add(text);
      widget.promptHistory?.resetCursor();
    }
    widget.onSend(
      sendText,
      _attachedImages
          .map((f) => f.path)
          .where((p) => p.isNotEmpty)
          .toList(),
    );
    _controller.clear();
    _clearDraft(); // remove saved draft now that message is sent
    setState(() {
      _attachedImages = [];
      _attachedFile = null;
      _fullFileContent = null;
    });
  }

  Future<void> _openVoiceMode() async {
    final vs = widget.voiceService;
    if (vs == null) return;
    // Carry the current draft into voice mode for seamless switching
    final draft = _controller.text.trim();
    final transcript = await VoiceOverlay.show(
      context,
      visualMode: widget.visualMode,
      motionLevel: widget.motionLevel,
      voiceService: vs,
      initialDraft: draft.isNotEmpty ? draft : null,
    );
    if (transcript != null && transcript.isNotEmpty && mounted) {
      _controller.text = transcript;
      _fieldFocus.requestFocus();
    }
  }

  void _showAttachmentPicker() {
    HapticFeedback.selectionClick();
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
                child: Icon(Icons.photo_library_outlined,
                    color: tokens.primary, size: 22),
              ),
              title: Text('Photo Library',
                  style: TextStyle(
                      color: tokens.onSurface, fontWeight: FontWeight.w500)),
              subtitle: Text('Choose from your gallery',
                  style: TextStyle(
                      color: tokens.onSurface.withValues(alpha: 0.5),
                      fontSize: 12)),
              onTap: () {
                Navigator.pop(ctx);
                _pickImage(ImageSource.gallery);
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
                child: Icon(Icons.camera_alt_outlined,
                    color: tokens.secondary, size: 22),
              ),
              title: Text('Camera',
                  style: TextStyle(
                      color: tokens.onSurface, fontWeight: FontWeight.w500)),
              subtitle: Text('Take a new photo',
                  style: TextStyle(
                      color: tokens.onSurface.withValues(alpha: 0.5),
                      fontSize: 12)),
              onTap: () {
                Navigator.pop(ctx);
                _pickImage(ImageSource.camera);
              },
            ),
            ListTile(
              leading: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: tokens.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.attach_file_rounded,
                    color: tokens.primary.withValues(alpha: 0.8), size: 22),
              ),
              title: Text('Documents',
                  style: TextStyle(
                      color: tokens.onSurface, fontWeight: FontWeight.w500)),
              subtitle: Text('PDF, text, and other files',
                  style: TextStyle(
                      color: tokens.onSurface.withValues(alpha: 0.5),
                      fontSize: 12)),
              onTap: () {
                Navigator.pop(ctx);
                _pickFile();
              },
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final picker = ImagePicker();

      if (source == ImageSource.gallery) {
        // Multi-image selection for gallery
        final files = await picker.pickMultiImage(
          maxWidth: 1920,
          maxHeight: 1920,
          imageQuality: 85,
          limit: _maxImages - _attachedImages.length,
        );
        if (files.isEmpty) return;
        if (!mounted) return;
        HapticFeedback.lightImpact();
        setState(() {
          _attachedImages = [
            ..._attachedImages,
            ...files,
          ].take(_maxImages).toList();
          _attachedFile = null;
          _fullFileContent = null;
        });
      } else {
        // Single-pick for camera, append to list
        final file = await picker.pickImage(
          source: source,
          maxWidth: 1920,
          maxHeight: 1920,
          imageQuality: 85,
        );
        if (file == null) return;
        if (!mounted) return;
        HapticFeedback.lightImpact();
        setState(() {
          if (_attachedImages.length < _maxImages) {
            _attachedImages = [..._attachedImages, file];
          }
          _attachedFile = null;
          _fullFileContent = null;
        });
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not pick image: $e'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _pickFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: [
          // Documents
          'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
          // Plain text
          'txt', 'md', 'csv', 'json', 'xml', 'log', 'yaml', 'yml',
          'toml', 'ini', 'conf', 'env',
          // Archives
          'zip',
          // Source code
          'dart', 'py', 'js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs',
          'go', 'rs', 'java', 'kt', 'swift',
          'c', 'cpp', 'cc', 'h', 'hpp', 'cs',
          'rb', 'php', 'r', 'scala', 'ex', 'exs',
          'sh', 'bash', 'zsh', 'ps1',
          'css', 'scss', 'less', 'html', 'htm', 'vue', 'svelte',
          'sql', 'graphql', 'proto',
          'gradle', 'makefile', 'dockerfile',
        ],
      );
      if (result == null || result.files.isEmpty) return;
      if (!mounted) return;
      HapticFeedback.lightImpact();
      final pickedFile = result.files.first;

      // Extensions whose full content we embed for code/text analysis.
      // Capped at 30 000 chars to stay within typical LLM context windows.
      const fullReadExts = {
        'txt',
        'md',
        'csv',
        'json',
        'log',
        'yaml',
        'yml',
        'toml',
        'ini',
        'conf',
        'env',
        'xml',
        'graphql',
        'proto',
        'sql',
        'dart',
        'py',
        'js',
        'ts',
        'jsx',
        'tsx',
        'mjs',
        'cjs',
        'go',
        'rs',
        'java',
        'kt',
        'swift',
        'c',
        'cpp',
        'cc',
        'h',
        'hpp',
        'cs',
        'rb',
        'php',
        'r',
        'scala',
        'ex',
        'exs',
        'sh',
        'bash',
        'zsh',
        'ps1',
        'css',
        'scss',
        'less',
        'html',
        'htm',
        'vue',
        'svelte',
        'gradle',
        'makefile',
        'dockerfile',
      };
      const maxContentChars = 30000;

      final ext = pickedFile.name.split('.').last.toLowerCase();
      String? preview;
      String? fullContent;

      if (fullReadExts.contains(ext) && pickedFile.path != null) {
        try {
          final raw = await File(pickedFile.path!).readAsString();
          fullContent = raw.length > maxContentChars
              ? '${raw.substring(0, maxContentChars)}\n…(truncated)'
              : raw;
          // Build a 3-line preview for the chip
          final lines = raw.split('\n').take(3).join('\n');
          preview =
              lines.length > 180 ? '${lines.substring(0, 177)}\u2026' : lines;
        } catch (_) {}
      }
      if (!mounted) return;
      setState(() {
        _attachedFile = pickedFile;
        _attachedImages = []; // clear any image attachments
        _docPreviewText = preview;
        _fullFileContent = fullContent;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not pick file: $e'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _removeAttachment() {
    HapticFeedback.selectionClick();
    setState(() {
      _attachedImages = [];
      _attachedFile = null;
      _docPreviewText = null;
      _fullFileContent = null;
    });
  }

  void _removeImageAt(int index) {
    HapticFeedback.selectionClick();
    setState(() {
      _attachedImages = List.from(_attachedImages)..removeAt(index);
    });
  }

  // ── Drag-and-drop from OS file manager (desktop_drop) ─────────────────

  Future<void> _handleDroppedFiles(List<XFile> xFiles) async {
    if (xFiles.isEmpty || !mounted) return;
    setState(() => _isDragging = false);
    HapticFeedback.lightImpact();

    const imageExts = {'png', 'jpg', 'jpeg', 'gif', 'webp'};
    final allImages = xFiles.every(
      (f) => imageExts.contains(f.name.split('.').last.toLowerCase()),
    );

    if (allImages) {
      // ── All dropped files are images ────────────────────────────────────
      final remaining = _maxImages - _attachedImages.length;
      if (remaining <= 0) return;
      setState(() {
        _attachedImages = [
          ..._attachedImages,
          ...xFiles.take(remaining),
        ];
        _attachedFile = null;
        _docPreviewText = null;
        _fullFileContent = null;
      });
      return;
    }

    // ── Document / code file (first dropped file) ──────────────────────
    final xFile = xFiles.first;
    final ext = xFile.name.split('.').last.toLowerCase();
    final bytes = await xFile.readAsBytes();
    final pickedFile = PlatformFile(
      name: xFile.name,
      size: bytes.length,
      bytes: bytes,
      path: xFile.path.isEmpty ? null : xFile.path,
    );

    const fullReadExts = {
      'txt',
      'md',
      'csv',
      'json',
      'log',
      'yaml',
      'yml',
      'toml',
      'ini',
      'conf',
      'env',
      'xml',
      'graphql',
      'proto',
      'sql',
      'dart',
      'py',
      'js',
      'ts',
      'jsx',
      'tsx',
      'mjs',
      'cjs',
      'go',
      'rs',
      'java',
      'kt',
      'swift',
      'c',
      'cpp',
      'cc',
      'h',
      'hpp',
      'cs',
      'rb',
      'php',
      'r',
      'scala',
      'ex',
      'exs',
      'sh',
      'bash',
      'zsh',
      'ps1',
      'css',
      'scss',
      'less',
      'html',
      'htm',
      'vue',
      'svelte',
      'gradle',
      'makefile',
      'dockerfile',
    };
    const maxContentChars = 30000;
    String? preview;
    String? fullContent;

    if (fullReadExts.contains(ext)) {
      try {
        final raw = await xFile.readAsString();
        fullContent = raw.length > maxContentChars
            ? '${raw.substring(0, maxContentChars)}\n…(truncated)'
            : raw;
        final lines = raw.split('\n').take(3).join('\n');
        preview =
            lines.length > 180 ? '${lines.substring(0, 177)}\u2026' : lines;
      } catch (_) {}
    }

    if (!mounted) return;
    setState(() {
      _attachedFile = pickedFile;
      _attachedImages = [];
      _docPreviewText = preview;
      _fullFileContent = fullContent;
    });
  }

  // ── Clipboard image paste via keyboard content insertion ──────────────

  Future<void> _handleContentInserted(KeyboardInsertedContent content) async {
    if (_attachedImages.length >= _maxImages) return;
    final data = content.data;
    if (data == null || data.isEmpty) return;

    try {
      final ext = _mimeToExt(content.mimeType);
      final stamp = DateTime.now().millisecondsSinceEpoch;
      final file = File('${Directory.systemTemp.path}/paste_$stamp.$ext');
      await file.writeAsBytes(data);

      if (!mounted) return;
      HapticFeedback.lightImpact();
      setState(() {
        _attachedImages = [..._attachedImages, XFile(file.path)];
        _attachedFile = null;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not paste image: $e'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  static String _mimeToExt(String mime) {
    switch (mime) {
      case 'image/png':
        return 'png';
      case 'image/gif':
        return 'gif';
      case 'image/webp':
        return 'webp';
      default:
        return 'jpg';
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;
    final showCounter = _controller.text.length > 80;

    final body = CompositedTransformTarget(
      link: _layerLink,
      child: Shortcuts(
        shortcuts: {
          LogicalKeySet(LogicalKeyboardKey.control, LogicalKeyboardKey.enter):
              const _SendIntent(),
          LogicalKeySet(LogicalKeyboardKey.meta, LogicalKeyboardKey.enter):
              const _SendIntent(),
          LogicalKeySet(LogicalKeyboardKey.escape): const _CancelIntent(),
          LogicalKeySet(LogicalKeyboardKey.control, LogicalKeyboardKey.keyR):
              const _RetryIntent(),
          LogicalKeySet(LogicalKeyboardKey.arrowUp): const _HistoryUpIntent(),
          LogicalKeySet(LogicalKeyboardKey.arrowDown):
              const _HistoryDownIntent(),
        },
        child: Actions(
          actions: {
            _SendIntent: CallbackAction<_SendIntent>(
              onInvoke: (_) {
                if (widget.isEnabled && !widget.isSending) _handleSend();
                return null;
              },
            ),
            _CancelIntent: CallbackAction<_CancelIntent>(
              onInvoke: (_) {
                if (widget.isEnabled && widget.isSending) {
                  HapticFeedback.selectionClick();
                  widget.onCancel();
                }
                return null;
              },
            ),
            _RetryIntent: CallbackAction<_RetryIntent>(
              onInvoke: (_) {
                if (widget.isEnabled && widget.hasFailed) {
                  HapticFeedback.mediumImpact();
                  widget.onRetry();
                }
                return null;
              },
            ),
            _HistoryUpIntent: CallbackAction<_HistoryUpIntent>(
              onInvoke: (_) {
                // Only activate when field is empty or cursor is at start
                if (_controller.text.isEmpty ||
                    _controller.selection.baseOffset == 0) {
                  final prev = widget.promptHistory?.navigateUp();
                  if (prev != null) {
                    _controller.value = TextEditingValue(
                      text: prev,
                      selection: TextSelection.collapsed(offset: prev.length),
                    );
                  }
                }
                return null;
              },
            ),
            _HistoryDownIntent: CallbackAction<_HistoryDownIntent>(
              onInvoke: (_) {
                if (widget.promptHistory != null) {
                  final next = widget.promptHistory!.navigateDown();
                  _controller.value = TextEditingValue(
                    text: next,
                    selection: TextSelection.collapsed(offset: next.length),
                  );
                }
                return null;
              },
            ),
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
            decoration: BoxDecoration(
              color: cinematic ? tokens.card : tokens.surface,
              borderRadius: BorderRadius.circular(26),
              border: Border.all(
                color: cinematic
                    ? _fieldFocused
                        ? tokens.primary.withValues(alpha: 0.55)
                        : tokens.primary.withValues(alpha: 0.18)
                    : _fieldFocused
                        ? tokens.primary.withValues(alpha: 0.6)
                        : tokens.frame,
                width: _fieldFocused ? 1.5 : 1.0,
              ),
              boxShadow: [
                BoxShadow(
                  color: cinematic
                      ? _fieldFocused
                          ? tokens.primary.withValues(alpha: 0.18)
                          : tokens.primary.withValues(alpha: 0.08)
                      : Colors.black.withValues(alpha: 0.06),
                  blurRadius: cinematic ? (_fieldFocused ? 28 : 20) : 14,
                  offset: Offset(0, cinematic ? 0 : 4),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // ── Quote / reply strip ──
                if (widget.quoteMessage != null)
                  _QuoteStrip(
                    message: widget.quoteMessage!,
                    onRemove: widget.onClearQuote ?? () {},
                    tokens: tokens,
                    cinematic: cinematic,
                  ),
                // ── Attachment preview strip ──
                if (_attachedImages.isNotEmpty)
                  _MultiImagePreviewStrip(
                    images: _attachedImages,
                    onRemoveAt: _removeImageAt,
                    onClearAll: _removeAttachment,
                    maxImages: _maxImages,
                    tokens: tokens,
                    cinematic: cinematic,
                  ),
                if (_attachedFile != null)
                  _FilePreviewStrip(
                    fileName: _attachedFile!.name,
                    fileSize: _attachedFile!.size,
                    previewText: _docPreviewText,
                    contentCharCount: _fullFileContent?.length,
                    onRemove: _removeAttachment,
                    tokens: tokens,
                    cinematic: cinematic,
                  ),
                // ── Upload / send progress bar ──
                if (_showProgress || widget.isSending)
                  _SvenProgressBar(
                    animation: _progressCtrl,
                    tokens: tokens,
                    cinematic: cinematic,
                    label: _attachedFile != null
                        ? 'Sending ${_attachedFile!.name}…'
                        : _attachedImages.isNotEmpty
                            ? 'Sending ${_attachedImages.length} image${_attachedImages.length == 1 ? '' : 's'}…'
                            : 'Sending…',
                  ),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    // ── Mic button ──
                    Padding(
                      padding: const EdgeInsets.only(left: 0, bottom: 0),
                      child: _pill(
                        icon: Icons.mic_rounded,
                        onTap: widget.isEnabled ? _openVoiceMode : null,
                        tokens: tokens,
                        cinematic: cinematic,
                        semanticLabel: 'Voice input',
                      ),
                    ),
                    // ── Text field with animated expansion ──
                    Expanded(
                      child: AnimatedSize(
                        duration: const Duration(milliseconds: 200),
                        curve: Curves.easeOutCubic,
                        alignment: Alignment.bottomCenter,
                        child: Semantics(
                          label: 'Message input',
                          textField: true,
                          child: Focus(
                            autofocus: kIsWeb,
                            child: TextField(
                              key: const Key('chat_composer_field'),
                              controller: _controller,
                              focusNode: _fieldFocus,
                              minLines: 1,
                              maxLines: _composerExpanded ? 6 : 2,
                              enabled: widget.isEnabled,
                              textInputAction: TextInputAction.send,
                              onSubmitted: (_) => _handleSend(),
                              contentInsertionConfiguration:
                                  ContentInsertionConfiguration(
                                onContentInserted: _handleContentInserted,
                                allowedMimeTypes: const <String>[
                                  'image/png',
                                  'image/jpeg',
                                  'image/gif',
                                  'image/webp',
                                ],
                              ),
                              style: TextStyle(
                                color: tokens.onSurface,
                                fontSize: 15,
                              ),
                              decoration: InputDecoration(
                                hintText: 'Message Sven…',
                                hintStyle: TextStyle(
                                  color:
                                      tokens.onSurface.withValues(alpha: 0.35),
                                  fontSize: 15,
                                ),
                                border: InputBorder.none,
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 14,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    // ── Expand / collapse toggle (visible when text is multi-line) ──
                    if (_controller.text.contains('\n') ||
                        _controller.text.length > 80)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: GestureDetector(
                          onTap: () => setState(
                              () => _composerExpanded = !_composerExpanded),
                          child: Padding(
                            padding: const EdgeInsets.all(4),
                            child: Icon(
                              _composerExpanded
                                  ? Icons.unfold_less_rounded
                                  : Icons.unfold_more_rounded,
                              size: 18,
                              color: tokens.onSurface.withValues(alpha: 0.35),
                            ),
                          ),
                        ),
                      ),
                    // ── Action button ──
                    Padding(
                      padding: const EdgeInsets.only(right: 0, bottom: 0),
                      child: _buildAction(tokens, cinematic),
                    ),
                  ],
                ),
                // ── Bottom bar: token counter + mode chip ──
                if (showCounter ||
                    widget.currentMode != ConversationMode.balanced)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
                    child: Row(
                      children: [
                        // Mode chip
                        GestureDetector(
                          onTap: _showModeSheet,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: tokens.primary.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              '${widget.currentMode.icon} ${widget.currentMode.label}',
                              style: TextStyle(
                                color: tokens.primary,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                        const Spacer(),
                        // Token counter
                        if (showCounter)
                          Text(
                            '~$_estimatedTokens tokens',
                            style: TextStyle(
                              color: _estimatedTokens > 3000
                                  ? Theme.of(context).colorScheme.error
                                  : tokens.onSurface.withValues(alpha: 0.35),
                              fontSize: 11,
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
    return DropTarget(
      onDragDone: (detail) => _handleDroppedFiles(detail.files),
      onDragEntered: (_) => setState(() => _isDragging = true),
      onDragExited: (_) => setState(() => _isDragging = false),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          body,
          if (_isDragging)
            Positioned.fill(
              child: _DragOverlay(tokens: tokens, cinematic: cinematic),
            ),
        ],
      ),
    );
  }

  // ── Action button (retry / stop / send / plus) ──

  Widget _buildAction(SvenModeTokens tokens, bool cinematic) {
    if (widget.hasFailed) {
      return _pill(
        icon: Icons.refresh_rounded,
        onTap: widget.isEnabled
            ? () {
                HapticFeedback.mediumImpact();
                widget.onRetry();
              }
            : null,
        tokens: tokens,
        cinematic: cinematic,
        filled: true,
        errorTint: true,
        semanticLabel: 'Retry sending message',
      );
    }
    if (widget.isSending) {
      return _pill(
        icon: Icons.stop_rounded,
        onTap: widget.isEnabled
            ? () {
                HapticFeedback.selectionClick();
                widget.onCancel();
              }
            : null,
        tokens: tokens,
        cinematic: cinematic,
        filled: true,
        semanticLabel: 'Stop generating',
      );
    }
    final hasContent =
        _hasText || _attachedImages.isNotEmpty || _attachedFile != null;
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 200),
      transitionBuilder: (child, anim) =>
          ScaleTransition(scale: anim, child: child),
      child: hasContent
          ? _pill(
              key: const Key('chat_send_button'),
              icon: Icons.arrow_upward_rounded,
              onTap: widget.isEnabled ? _handleSend : null,
              tokens: tokens,
              cinematic: cinematic,
              filled: true,
              semanticLabel: 'Send message',
            )
          : _pill(
              key: const ValueKey('plus'),
              icon: Icons.add_rounded,
              onTap: widget.isEnabled ? _showAttachmentPicker : null,
              tokens: tokens,
              cinematic: cinematic,
              semanticLabel: 'Attach file or image',
            ),
    );
  }

  // ── Circular icon button ──

  Widget _pill({
    Key? key,
    required IconData icon,
    required VoidCallback? onTap,
    required SvenModeTokens tokens,
    required bool cinematic,
    bool filled = false,
    bool errorTint = false,
    String? semanticLabel,
  }) {
    final Color bg;
    final Color fg;
    if (errorTint) {
      bg = Theme.of(context).colorScheme.error;
      fg = Colors.white;
    } else if (filled) {
      bg = cinematic ? tokens.primary : tokens.primary;
      fg = cinematic ? const Color(0xFF040712) : Colors.white;
    } else {
      bg = Colors.transparent;
      fg = tokens.onSurface.withValues(alpha: 0.40);
    }

    return Semantics(
      label: semanticLabel,
      button: true,
      enabled: onTap != null,
      excludeSemantics: semanticLabel != null,
      child: _Pressable(
        key: key,
        onTap: onTap,
        child: SizedBox(
          width: 48,
          height: 48,
          child: Center(
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: bg,
                shape: BoxShape.circle,
                boxShadow: filled && cinematic
                    ? [
                        BoxShadow(
                          color: tokens.primary.withValues(alpha: 0.28),
                          blurRadius: 10,
                          offset: const Offset(0, 2),
                        ),
                      ]
                    : null,
              ),
              child: Icon(icon, size: 22, color: fg),
            ),
          ),
        ),
      ),
    );
  }
}

/// Tap-to-scale micro-interaction wrapper.
class _Pressable extends StatefulWidget {
  const _Pressable({super.key, required this.child, this.onTap});

  final Widget child;
  final VoidCallback? onTap;

  @override
  State<_Pressable> createState() => _PressableState();
}

class _PressableState extends State<_Pressable>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 90),
    reverseDuration: const Duration(milliseconds: 200),
    lowerBound: 0.0,
    upperBound: 1.0,
    value: 0.0,
  );

  final _scaleAnim = Tween<double>(begin: 1.0, end: 0.88);

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: widget.onTap != null ? (_) => _ctrl.forward() : null,
      onTapUp: widget.onTap != null
          ? (_) {
              _ctrl.reverse();
              widget.onTap!();
            }
          : null,
      onTapCancel: () => _ctrl.reverse(),
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (_, child) => Transform.scale(
          scale: _scaleAnim.evaluate(_ctrl),
          child: child,
        ),
        child: widget.child,
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Attachment preview strips
// ═══════════════════════════════════════════════════════════════════════════

class _MultiImagePreviewStrip extends StatelessWidget {
  const _MultiImagePreviewStrip({
    required this.images,
    required this.onRemoveAt,
    required this.onClearAll,
    required this.maxImages,
    required this.tokens,
    required this.cinematic,
  });

  final List<XFile> images;
  final void Function(int index) onRemoveAt;
  final VoidCallback onClearAll;
  final int maxImages;
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with count and clear-all
          Row(
            children: [
              Text(
                '${images.length} image${images.length > 1 ? 's' : ''} attached',
                style: TextStyle(
                  color: tokens.primary.withValues(alpha: 0.7),
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (images.length < maxImages) ...[
                const SizedBox(width: 8),
                Text(
                  '(max $maxImages)',
                  style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.3),
                    fontSize: 10,
                  ),
                ),
              ],
              const Spacer(),
              if (images.length > 1)
                Material(
                  color: Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    onTap: onClearAll,
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      child: Text(
                        'Clear all',
                        style: TextStyle(
                          color: tokens.onSurface.withValues(alpha: 0.4),
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          // Horizontal thumbnail row
          SizedBox(
            height: 64,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: images.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (ctx, i) => _ImageThumb(
                imagePath: images[i].path,
                onRemove: () => onRemoveAt(i),
                tokens: tokens,
                cinematic: cinematic,
                heroTag: 'composer_img_$i',
                onTap: kIsWeb
                    ? null
                    : () => Navigator.of(ctx).push<void>(
                          PageRouteBuilder<void>(
                            opaque: false,
                            pageBuilder: (_, __, ___) => _FullScreenImageViewer(
                              imagePath: images[i].path,
                              heroTag: 'composer_img_$i',
                            ),
                            transitionsBuilder: (_, anim, __, child) =>
                                FadeTransition(
                              opacity: CurvedAnimation(
                                  parent: anim, curve: Curves.easeOut),
                              child: child,
                            ),
                          ),
                        ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ImageThumb extends StatelessWidget {
  const _ImageThumb({
    required this.imagePath,
    required this.onRemove,
    required this.tokens,
    required this.cinematic,
    this.onTap,
    required this.heroTag,
  });

  final String imagePath;
  final VoidCallback onRemove;
  final SvenModeTokens tokens;
  final bool cinematic;
  final VoidCallback? onTap;
  final String heroTag;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Hero(
            tag: heroTag,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: 64,
                height: 64,
                child: kIsWeb
                    ? Container(
                        color: tokens.primary.withValues(alpha: 0.1),
                        child: Icon(Icons.image_rounded,
                            color: tokens.primary, size: 28),
                      )
                    : Image.file(
                        File(imagePath),
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          color: tokens.primary.withValues(alpha: 0.1),
                          child: Icon(Icons.image_rounded,
                              color: tokens.primary, size: 28),
                        ),
                      ),
              ),
            ),
          ),
          Positioned(
            top: -4,
            right: -4,
            child: GestureDetector(
              onTap: onRemove,
              child: Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  color: cinematic ? tokens.card : tokens.surface,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: tokens.onSurface.withValues(alpha: 0.1),
                  ),
                ),
                child: Icon(Icons.close_rounded,
                    size: 12, color: tokens.onSurface.withValues(alpha: 0.5)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Quote / reply strip
// ───────────────────────────────────────────────────────────────────────────

class _QuoteStrip extends StatelessWidget {
  const _QuoteStrip({
    required this.message,
    required this.onRemove,
    required this.tokens,
    required this.cinematic,
  });

  final ChatMessage message;
  final VoidCallback onRemove;
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == 'user';
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: tokens.primary.withValues(alpha: cinematic ? 0.08 : 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border(
          left: BorderSide(color: tokens.primary, width: 3),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  isUser ? 'You' : 'Sven',
                  style: TextStyle(
                    color: tokens.primary,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  message.text,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.7),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onRemove,
            child: Icon(
              Icons.close_rounded,
              size: 16,
              color: tokens.onSurface.withValues(alpha: 0.4),
            ),
          ),
        ],
      ),
    );
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Slash command overlay (anchored above composer)
// ───────────────────────────────────────────────────────────────────────────

class _SlashCommandOverlay extends StatelessWidget {
  const _SlashCommandOverlay({
    required this.layerLink,
    required this.commands,
    required this.tokens,
    required this.cinematic,
    required this.onSelected,
  });

  final LayerLink layerLink;
  final List<SlashCommand> commands;
  final SvenModeTokens tokens;
  final bool cinematic;
  final ValueChanged<SlashCommand> onSelected;

  @override
  Widget build(BuildContext context) {
    if (commands.isEmpty) return const SizedBox.shrink();
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: CompositedTransformFollower(
        link: layerLink,
        targetAnchor: Alignment.topLeft,
        followerAnchor: Alignment.bottomLeft,
        offset: const Offset(0, -8),
        child: Material(
          color: Colors.transparent,
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: cinematic
                  ? const Color(0xFF0D1829)
                  : Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: tokens.primary.withValues(alpha: 0.25),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: cinematic ? 0.5 : 0.15),
                  blurRadius: 24,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  child: Row(
                    children: [
                      Icon(Icons.terminal_rounded,
                          size: 13,
                          color: tokens.primary.withValues(alpha: 0.7)),
                      const SizedBox(width: 6),
                      Text(
                        'Slash commands',
                        style: TextStyle(
                          color: tokens.onSurface.withValues(alpha: 0.45),
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                ...commands.map(
                  (cmd) => InkWell(
                    onTap: () => onSelected(cmd),
                    borderRadius: BorderRadius.circular(8),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      child: Row(
                        children: [
                          Icon(cmd.icon,
                              size: 18,
                              color: tokens.primary.withValues(alpha: 0.8)),
                          const SizedBox(width: 12),
                          Text(
                            '/${cmd.command}',
                            style: TextStyle(
                              color: tokens.primary,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              cmd.description,
                              style: TextStyle(
                                color: tokens.onSurface.withValues(alpha: 0.55),
                                fontSize: 13,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Data class for @-mention commands ─────────────────────────────────────
class _AtMention {
  const _AtMention({
    required this.trigger,
    required this.label,
    required this.icon,
    required this.prefix,
  });

  final String trigger;
  final String label;
  final IconData icon;
  final String prefix;
}

// ── @-mention overlay widget ────────────────────────────────────────────────
class _AtMentionOverlay extends StatelessWidget {
  const _AtMentionOverlay({
    required this.layerLink,
    required this.mentions,
    required this.tokens,
    required this.cinematic,
    required this.onSelected,
  });

  final LayerLink layerLink;
  final List<_AtMention> mentions;
  final SvenModeTokens tokens;
  final bool cinematic;
  final ValueChanged<_AtMention> onSelected;

  @override
  Widget build(BuildContext context) {
    if (mentions.isEmpty) return const SizedBox.shrink();
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: CompositedTransformFollower(
        link: layerLink,
        targetAnchor: Alignment.topLeft,
        followerAnchor: Alignment.bottomLeft,
        offset: const Offset(0, -8),
        child: Material(
          color: Colors.transparent,
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: cinematic
                  ? const Color(0xFF0D1829)
                  : Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: tokens.primary.withValues(alpha: 0.25),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: cinematic ? 0.5 : 0.15),
                  blurRadius: 24,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  child: Row(
                    children: [
                      Icon(Icons.alternate_email_rounded,
                          size: 13,
                          color: tokens.primary.withValues(alpha: 0.7)),
                      const SizedBox(width: 6),
                      Text(
                        'Mention a mode',
                        style: TextStyle(
                          color: tokens.onSurface.withValues(alpha: 0.45),
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                ...mentions.map(
                  (m) => InkWell(
                    onTap: () => onSelected(m),
                    borderRadius: BorderRadius.circular(8),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      child: Row(
                        children: [
                          Icon(m.icon,
                              size: 18,
                              color: tokens.primary.withValues(alpha: 0.8)),
                          const SizedBox(width: 12),
                          Text(
                            '@${m.trigger}',
                            style: TextStyle(
                              color: tokens.primary,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              m.label,
                              style: TextStyle(
                                color: tokens.onSurface.withValues(alpha: 0.55),
                                fontSize: 13,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _FilePreviewStrip extends StatelessWidget {
  const _FilePreviewStrip({
    required this.fileName,
    required this.fileSize,
    required this.onRemove,
    required this.tokens,
    required this.cinematic,
    this.previewText,
    this.contentCharCount,
  });

  final String fileName;
  final int fileSize;
  final String? previewText;

  /// When non-null, the full file content was read and will be sent to the AI.
  final int? contentCharCount;
  final VoidCallback onRemove;
  final SvenModeTokens tokens;
  final bool cinematic;

  String get _formattedSize {
    if (fileSize < 1024) return '$fileSize B';
    if (fileSize < 1024 * 1024) {
      return '${(fileSize / 1024).toStringAsFixed(1)} KB';
    }
    return '${(fileSize / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  IconData get _fileIcon {
    final ext = fileName.split('.').last.toLowerCase();
    return switch (ext) {
      'pdf' => Icons.picture_as_pdf_rounded,
      'doc' || 'docx' => Icons.description_rounded,
      'xls' || 'xlsx' || 'csv' => Icons.table_chart_rounded,
      'ppt' || 'pptx' => Icons.slideshow_rounded,
      'zip' || 'rar' || '7z' => Icons.folder_zip_rounded,
      'json' || 'xml' || 'md' || 'txt' || 'log' => Icons.code_rounded,
      'dart' ||
      'py' ||
      'js' ||
      'ts' ||
      'jsx' ||
      'tsx' ||
      'go' ||
      'rs' ||
      'java' ||
      'kt' ||
      'swift' ||
      'c' ||
      'cpp' ||
      'cs' ||
      'rb' ||
      'php' ||
      'html' ||
      'htm' ||
      'css' ||
      'scss' ||
      'vue' ||
      'svelte' ||
      'sql' ||
      'sh' ||
      'bash' ||
      'zsh' ||
      'ps1' ||
      'yaml' ||
      'yml' ||
      'toml' =>
        Icons.data_object_rounded,
      _ => Icons.insert_drive_file_rounded,
    };
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: cinematic
                  ? tokens.primary.withValues(alpha: 0.1)
                  : tokens.onSurface.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(_fileIcon,
                color: tokens.primary.withValues(alpha: 0.8), size: 24),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  fileName,
                  style: TextStyle(
                    color: tokens.onSurface,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  _formattedSize,
                  style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.5),
                    fontSize: 11,
                  ),
                ),
                if (previewText != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    previewText!,
                    style: TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 10,
                      color: tokens.onSurface.withValues(alpha: 0.45),
                      height: 1.3,
                    ),
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                if (contentCharCount != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.check_circle_rounded,
                          size: 11,
                          color: tokens.primary.withValues(alpha: 0.8)),
                      const SizedBox(width: 3),
                      Text(
                        'Content attached · ${contentCharCount! > 999 ? '${(contentCharCount! / 1000).toStringAsFixed(1)}k' : contentCharCount} chars',
                        style: TextStyle(
                          color: tokens.primary.withValues(alpha: 0.8),
                          fontSize: 10,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          Material(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(16),
            child: InkWell(
              onTap: onRemove,
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.all(6),
                child: Icon(Icons.close_rounded,
                    size: 18, color: tokens.onSurface.withValues(alpha: 0.4)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Animated gradient progress bar for send / upload feedback
// ═══════════════════════════════════════════════════════════════════════════

class _SvenProgressBar extends StatelessWidget {
  const _SvenProgressBar({
    required this.animation,
    required this.tokens,
    required this.cinematic,
    required this.label,
  });

  final Animation<double> animation;
  final SvenModeTokens tokens;
  final bool cinematic;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Label row
          Row(
            children: [
              SizedBox(
                width: 10,
                height: 10,
                child: AnimatedBuilder(
                  animation: animation,
                  builder: (_, __) => CircularProgressIndicator(
                    strokeWidth: 1.5,
                    value: null, // indeterminate spinner
                    color: tokens.primary.withValues(alpha: 0.6),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    color: tokens.onSurface.withValues(alpha: 0.45),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              AnimatedBuilder(
                animation: animation,
                builder: (_, __) => Text(
                  '${(animation.value * 100).toInt()}%',
                  style: TextStyle(
                    fontSize: 10,
                    color: tokens.primary.withValues(alpha: 0.55),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          // Gradient bar
          AnimatedBuilder(
            animation: animation,
            builder: (_, __) {
              return ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: Container(
                  height: 4,
                  color: tokens.primary.withValues(alpha: 0.08),
                  child: FractionallySizedBox(
                    widthFactor: animation.value.clamp(0.02, 1.0),
                    alignment: Alignment.centerLeft,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(4),
                        gradient: LinearGradient(
                          colors: cinematic
                              ? [
                                  tokens.primary,
                                  tokens.secondary,
                                ]
                              : [
                                  tokens.primary.withValues(alpha: 0.7),
                                  tokens.primary,
                                ],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: tokens.primary.withValues(alpha: 0.35),
                            blurRadius: 6,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// _DragOverlay — visual hint shown while a file is dragged over the composer
// ═══════════════════════════════════════════════════════════════════════════

class _DragOverlay extends StatelessWidget {
  const _DragOverlay({required this.tokens, required this.cinematic});

  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(26),
          color: cinematic
              ? tokens.primary.withValues(alpha: 0.12)
              : tokens.primary.withValues(alpha: 0.07),
          border: Border.all(
            color: tokens.primary.withValues(alpha: cinematic ? 0.65 : 0.45),
            width: 2,
          ),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.file_download_outlined,
                color: tokens.primary,
                size: 32,
              ),
              const SizedBox(height: 8),
              Text(
                'Drop to attach',
                style: TextStyle(
                  color: tokens.primary,
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
// ───────────────────────────────────────────────────────────────────────────
// _FullScreenImageViewer — hero-animated full-screen pinch-to-zoom image view
// ───────────────────────────────────────────────────────────────────────────

class _FullScreenImageViewer extends StatelessWidget {
  const _FullScreenImageViewer({
    required this.imagePath,
    required this.heroTag,
  });

  final String imagePath;
  final String heroTag;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          Center(
            child: Hero(
              tag: heroTag,
              child: InteractiveViewer(
                minScale: 0.5,
                maxScale: 5.0,
                child: Image.file(
                  File(imagePath),
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Icon(
                    Icons.broken_image_rounded,
                    color: Colors.white38,
                    size: 64,
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            right: 12,
            child: Semantics(
              label: 'Close full screen image',
              button: true,
              child: IconButton.filled(
                onPressed: () => Navigator.of(context).pop(),
                style: IconButton.styleFrom(
                  backgroundColor: Colors.black54,
                ),
                icon: const Icon(Icons.close_rounded,
                    color: Colors.white, size: 22),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
