part of 'chat_thread_page.dart';

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
