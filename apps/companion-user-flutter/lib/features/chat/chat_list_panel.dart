import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import 'chat_models.dart';
import 'chat_service.dart';
import 'sync_service.dart';

/// Premium chat list — search, swipe-to-delete, rename, avatars, timestamps.
class ChatListPanel extends StatefulWidget {
  const ChatListPanel({
    super.key,
    required this.threads,
    required this.selectedId,
    required this.onSelect,
    required this.chatService,
    this.visualMode = VisualMode.classic,
    this.onRefresh,
    this.onDeleted,
    this.onRenamed,
    this.onTogglePin,
    this.archivedIds = const {},
    this.threadTags = const {},
    this.onToggleArchive,
    this.onSetTag,
    this.hasMore = false,
    this.onLoadMore,
    this.syncService,
  });

  final List<ChatThreadSummary> threads;
  final String? selectedId;
  final ValueChanged<ChatThreadSummary> onSelect;
  final ChatService chatService;
  final VisualMode visualMode;
  final Future<void> Function()? onRefresh;
  final ValueChanged<String>? onDeleted;
  final void Function(String id, String newName)? onRenamed;
  final ValueChanged<String>? onTogglePin;
  final Set<String> archivedIds;
  final Map<String, ConversationTag> threadTags;
  final ValueChanged<String>? onToggleArchive;
  final void Function(String id, ConversationTag? tag)? onSetTag;
  final bool hasMore;
  final VoidCallback? onLoadMore;
  final SyncService? syncService;

  @override
  State<ChatListPanel> createState() => _ChatListPanelState();
}

class _ChatListPanelState extends State<ChatListPanel> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  String _searchQuery = '';
  bool _showArchived = false;
  ConversationTag? _activeTagFilter;
  DateTime? _lastSynced;

  // ── Bulk multi-select state ──────────────────────────────────────────────
  final Set<String> _selectedIds = {};
  bool get _isSelecting => _selectedIds.isNotEmpty;

  void _toggleSelect(String id) {
    setState(() {
      if (_selectedIds.contains(id)) {
        _selectedIds.remove(id);
      } else {
        _selectedIds.add(id);
      }
    });
  }

  void _cancelSelect() => setState(() => _selectedIds.clear());
  // ─────────────────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _lastSynced = DateTime.now();
    _searchController.addListener(() {
      setState(() => _searchQuery = _searchController.text.toLowerCase());
    });
    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    if (!widget.hasMore || widget.onLoadMore == null) return;
    final pos = _scrollController.position;
    if (pos.pixels >= pos.maxScrollExtent - 200) {
      widget.onLoadMore!();
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  List<ChatThreadSummary> get _filteredThreads {
    var list = widget.threads;
    // Show only archived / non-archived based on toggle
    list = list.where((t) {
      final isArchived = widget.archivedIds.contains(t.id);
      return _showArchived ? isArchived : !isArchived;
    }).toList();
    // Apply tag filter
    if (_activeTagFilter != null) {
      list = list.where((t) {
        final tag = widget.threadTags[t.id];
        return tag == _activeTagFilter;
      }).toList();
    }
    if (_searchQuery.isNotEmpty) {
      list = list
          .where((t) =>
              t.title.toLowerCase().contains(_searchQuery) ||
              t.lastMessage.toLowerCase().contains(_searchQuery))
          .toList();
    }
    // Sort: pinned first, then by updatedAt descending
    list.sort((a, b) {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt.compareTo(a.updatedAt);
    });
    return list;
  }

  Future<void> _onRefresh() async {
    HapticFeedback.mediumImpact();
    if (widget.onRefresh != null) {
      await widget.onRefresh!();
    }
    if (mounted) setState(() => _lastSynced = DateTime.now());
  }

  static String _syncTimeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 10) return 'just now';
    if (diff.inSeconds < 60) return '${diff.inSeconds}s ago';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    return '${diff.inHours}h ago';
  }

  Future<void> _deleteThread(ChatThreadSummary thread) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        final tokens = SvenTokens.forMode(widget.visualMode);
        final cinematic = widget.visualMode == VisualMode.cinematic;
        return AlertDialog(
          backgroundColor: cinematic ? tokens.card : tokens.surface,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title:
              Text('Delete chat?', style: TextStyle(color: tokens.onSurface)),
          content: Text(
            'This will permanently delete "${thread.title}".',
            style: TextStyle(color: tokens.onSurface.withValues(alpha: 0.7)),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text('Cancel',
                  style: TextStyle(
                      color: tokens.onSurface.withValues(alpha: 0.6))),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: Theme.of(ctx).colorScheme.error,
              ),
              onPressed: () => Navigator.pop(ctx, true),
              child:
                  const Text('Delete', style: TextStyle(color: Colors.white)),
            ),
          ],
        );
      },
    );

    if (confirmed != true) return;

    try {
      await widget.chatService.deleteChat(thread.id);
      HapticFeedback.mediumImpact();
      widget.onDeleted?.call(thread.id);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to delete: $e'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _renameThread(ChatThreadSummary thread) async {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;
    final controller = TextEditingController(text: thread.title);

    final newName = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: cinematic ? tokens.card : tokens.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Rename chat', style: TextStyle(color: tokens.onSurface)),
        content: TextField(
          controller: controller,
          autofocus: true,
          style: TextStyle(color: tokens.onSurface),
          decoration: InputDecoration(
            hintText: 'Chat name',
            hintStyle:
                TextStyle(color: tokens.onSurface.withValues(alpha: 0.4)),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide:
                  BorderSide(color: cinematic ? tokens.frame : tokens.frame),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: tokens.primary),
            ),
          ),
          onSubmitted: (v) => Navigator.pop(ctx, v.trim()),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel',
                style:
                    TextStyle(color: tokens.onSurface.withValues(alpha: 0.6))),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Save'),
          ),
        ],
      ),
    );

    controller.dispose();
    if (newName == null || newName.isEmpty || newName == thread.title) return;

    try {
      await widget.chatService.renameChat(thread.id, newName);
      HapticFeedback.lightImpact();
      widget.onRenamed?.call(thread.id, newName);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to rename: $e'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  // ── Bulk actions ─────────────────────────────────────────────────────────

  Future<void> _bulkDelete(List<ChatThreadSummary> filtered) async {
    final ids = _selectedIds.toList();
    final titles =
        filtered.where((t) => ids.contains(t.id)).map((t) => t.title).toList();
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: cinematic ? tokens.card : tokens.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Delete ${ids.length} chat${ids.length > 1 ? 's' : ''}?',
            style: TextStyle(color: tokens.onSurface)),
        content: Text(
          'This will permanently delete ${ids.length > 1 ? 'these ${ids.length} conversations' : '"${titles.first}"'}.',
          style: TextStyle(color: tokens.onSurface.withValues(alpha: 0.7)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel',
                style:
                    TextStyle(color: tokens.onSurface.withValues(alpha: 0.6))),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(ctx).colorScheme.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    for (final id in ids) {
      try {
        await widget.chatService.deleteChat(id);
        widget.onDeleted?.call(id);
      } catch (_) {}
    }
    HapticFeedback.mediumImpact();
    _cancelSelect();
  }

  void _bulkArchive(List<ChatThreadSummary> filtered) {
    if (widget.onToggleArchive == null) return;
    final toArchive =
        _selectedIds.where((id) => !widget.archivedIds.contains(id)).toList();
    for (final id in toArchive) {
      widget.onToggleArchive!(id);
    }
    HapticFeedback.mediumImpact();
    _cancelSelect();
  }

  void _bulkSetTag(ConversationTag? tag) {
    if (widget.onSetTag == null) return;
    for (final id in _selectedIds) {
      widget.onSetTag!(id, tag);
    }
    HapticFeedback.lightImpact();
    _cancelSelect();
  }
  // ─────────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;
    final filtered = _filteredThreads;

    return Column(
      children: [
        // ── Selection action bar or search bar ──
        if (_isSelecting)
          _SelectionActionBar(
            count: _selectedIds.length,
            tokens: tokens,
            cinematic: cinematic,
            canArchive: widget.onToggleArchive != null,
            canTag: widget.onSetTag != null,
            onCancel: _cancelSelect,
            onDelete: () => _bulkDelete(filtered),
            onArchive: () => _bulkArchive(filtered),
            onTag: widget.onSetTag != null ? _bulkSetTag : null,
          )
        else
          // ── Search bar ──
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
            child: Container(
              height: 40,
              decoration: BoxDecoration(
                color: cinematic
                    ? tokens.surface.withValues(alpha: 0.5)
                    : tokens.onSurface.withValues(alpha: 0.04),
                borderRadius: BorderRadius.circular(12),
                border: cinematic ? Border.all(color: tokens.frame) : null,
              ),
              child: TextField(
                controller: _searchController,
                style: TextStyle(color: tokens.onSurface, fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'Search conversations…',
                  hintStyle: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.35),
                    fontSize: 14,
                  ),
                  prefixIcon: Icon(Icons.search_rounded,
                      size: 20,
                      color: tokens.onSurface.withValues(alpha: 0.35)),
                  suffixIcon: _searchQuery.isNotEmpty
                      ? GestureDetector(
                          onTap: () => _searchController.clear(),
                          child: Icon(Icons.close_rounded,
                              size: 18,
                              color: tokens.onSurface.withValues(alpha: 0.4)),
                        )
                      : null,
                  border: InputBorder.none,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
              ),
            ),
          ),

        // ── Filter chips (archive + tags) ──
        SizedBox(
          height: 36,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            children: [
              _FilterChip(
                label: _showArchived ? 'Archived' : 'Chats',
                icon: _showArchived
                    ? Icons.archive_rounded
                    : Icons.chat_bubble_outline_rounded,
                selected: _showArchived,
                tokens: tokens,
                cinematic: cinematic,
                onTap: () => setState(() {
                  _showArchived = !_showArchived;
                  _activeTagFilter = null;
                }),
              ),
              const SizedBox(width: 6),
              ...ConversationTag.values.map((tag) {
                final isActive = _activeTagFilter == tag;
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: _FilterChip(
                    label: tag.label,
                    color: Color(tag.argbColor),
                    selected: isActive,
                    tokens: tokens,
                    cinematic: cinematic,
                    onTap: () => setState(() {
                      _activeTagFilter = isActive ? null : tag;
                    }),
                  ),
                );
              }),
            ],
          ),
        ),
        const SizedBox(height: 6),

        // ── Thread list ──
        Expanded(
          child: filtered.isEmpty
              ? Center(
                  child: Text(
                    _searchQuery.isNotEmpty
                        ? 'No matching conversations'
                        : 'No conversations yet',
                    style: TextStyle(
                      color: tokens.onSurface.withValues(alpha: 0.45),
                      fontSize: 14,
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _onRefresh,
                  color: tokens.primary,
                  child: ListView.separated(
                    controller: _scrollController,
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: filtered.length + (widget.hasMore ? 1 : 0),
                    padding: EdgeInsets.only(top: cinematic ? 4 : 0),
                    separatorBuilder: (_, __) => cinematic
                        ? const SizedBox(height: 2)
                        : const Divider(height: 1, indent: 72),
                    itemBuilder: (context, index) {
                      // Loading-more indicator at the end
                      if (index >= filtered.length) {
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          child: Center(
                            child: SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: tokens.primary.withValues(alpha: 0.5),
                              ),
                            ),
                          ),
                        );
                      }
                      final thread = filtered[index];
                      final tag = widget.threadTags[thread.id];
                      final isArchived = widget.archivedIds.contains(thread.id);
                      return _ChatTile(
                        thread: thread,
                        isSelected: thread.id == widget.selectedId,
                        isSelecting: _isSelecting,
                        isChecked: _selectedIds.contains(thread.id),
                        onToggleSelect: () => _toggleSelect(thread.id),
                        onEnterSelect: () => _toggleSelect(thread.id),
                        tokens: tokens,
                        cinematic: cinematic,
                        tag: tag,
                        isArchived: isArchived,
                        onTap: _isSelecting
                            ? () => _toggleSelect(thread.id)
                            : () => widget.onSelect(thread),
                        onDelete: () => _deleteThread(thread),
                        onRename: () => _renameThread(thread),
                        onTogglePin: widget.onTogglePin != null
                            ? () => widget.onTogglePin!(thread.id)
                            : null,
                        onToggleArchive: widget.onToggleArchive != null
                            ? () => widget.onToggleArchive!(thread.id)
                            : null,
                        onSetTag: widget.onSetTag != null
                            ? (t) => widget.onSetTag!(thread.id, t)
                            : null,
                      );
                    },
                  ),
                ),
        ),

        // ── Sync status footer ──
        if (widget.syncService != null)
          ListenableBuilder(
            listenable: widget.syncService!,
            builder: (_, __) {
              final pending = widget.syncService!.pendingCount;
              final synced = widget.syncService!.lastSynced ?? _lastSynced;
              final isPending = pending > 0;
              final label = isPending
                  ? '$pending queued'
                  : (synced != null ? 'Synced ${_syncTimeAgo(synced)}' : '');
              if (label.isEmpty) return const SizedBox.shrink();
              return Semantics(
                liveRegion: true,
                label: label,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        isPending
                            ? Icons.cloud_upload_outlined
                            : Icons.cloud_done_outlined,
                        size: 11,
                        color: tokens.onSurface
                            .withValues(alpha: isPending ? 0.45 : 0.28),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        label,
                        style: TextStyle(
                          fontSize: 11,
                          color: tokens.onSurface
                              .withValues(alpha: isPending ? 0.50 : 0.32),
                          letterSpacing: 0.1,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          )
        else if (_lastSynced != null)
          Semantics(
            liveRegion: true,
            label: 'Synced ${_syncTimeAgo(_lastSynced!)}',
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.cloud_done_outlined,
                    size: 11,
                    color: tokens.onSurface.withValues(alpha: 0.28),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'Synced ${_syncTimeAgo(_lastSynced!)}',
                    style: TextStyle(
                      fontSize: 11,
                      color: tokens.onSurface.withValues(alpha: 0.32),
                      letterSpacing: 0.1,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// Individual chat tile with swipe-to-delete and long-press menu.
class _ChatTile extends StatelessWidget {
  const _ChatTile({
    required this.thread,
    required this.isSelected,
    required this.tokens,
    required this.cinematic,
    required this.onTap,
    required this.onDelete,
    required this.onRename,
    this.onTogglePin,
    this.onToggleArchive,
    this.onSetTag,
    this.isArchived = false,
    this.tag,
    this.isSelecting = false,
    this.isChecked = false,
    this.onToggleSelect,
    this.onEnterSelect,
  });

  final ChatThreadSummary thread;
  final bool isSelected;
  final SvenModeTokens tokens;
  final bool cinematic;
  final VoidCallback onTap;
  final VoidCallback onDelete;
  final VoidCallback onRename;
  final VoidCallback? onTogglePin;
  final VoidCallback? onToggleArchive;
  final void Function(ConversationTag? tag)? onSetTag;
  final bool isArchived;
  final ConversationTag? tag;
  final bool isSelecting;
  final bool isChecked;
  final VoidCallback? onToggleSelect;
  final VoidCallback? onEnterSelect;

  static String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    return '${dt.month}/${dt.day}';
  }

  @override
  Widget build(BuildContext context) {
    final hasUnread = thread.unreadCount > 0;
    final initial =
        thread.title.isNotEmpty ? thread.title[0].toUpperCase() : 'S';

    return Dismissible(
      key: ValueKey(thread.id),
      direction:
          isSelecting ? DismissDirection.none : DismissDirection.endToStart,
      confirmDismiss: (_) async {
        onDelete();
        return false; // We handle deletion ourselves via dialog
      },
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: Theme.of(context).colorScheme.error.withValues(alpha: 0.15),
        child: Icon(Icons.delete_outline_rounded,
            color: Theme.of(context).colorScheme.error),
      ),
      child: Semantics(
        label: '${thread.title}. ${thread.lastMessage}'
            '${hasUnread ? ". ${thread.unreadCount} unread message${thread.unreadCount == 1 ? "" : "s"}" : ""}'
            '${isSelected ? ". Selected" : ""}',
        button: true,
        selected: isSelected,
        child: Material(
          color: isSelected
              ? (cinematic
                  ? tokens.primary.withValues(alpha: 0.08)
                  : tokens.primary.withValues(alpha: 0.06))
              : Colors.transparent,
          child: InkWell(
            onTap: isSelecting ? onToggleSelect : onTap,
            onLongPress:
                isSelecting ? onToggleSelect : () => _showContextMenu(context),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: cinematic && isSelected
                  ? BoxDecoration(
                      border: Border(
                        left: BorderSide(color: tokens.primary, width: 3),
                      ),
                    )
                  : null,
              child: Row(
                children: [
                  // Avatar or checkbox
                  if (isSelecting)
                    SizedBox(
                      width: 44,
                      height: 44,
                      child: Center(
                        child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 150),
                          child: Checkbox(
                            key: ValueKey(isChecked),
                            value: isChecked,
                            onChanged: (_) => onToggleSelect?.call(),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(6),
                            ),
                            activeColor: tokens.primary,
                            side: BorderSide(
                              color: tokens.onSurface.withValues(alpha: 0.35),
                              width: 1.5,
                            ),
                          ),
                        ),
                      ),
                    )
                  else
                    // Avatar
                    Stack(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: cinematic
                                  ? [
                                      tokens.primary.withValues(alpha: 0.22),
                                      tokens.secondary.withValues(alpha: 0.15),
                                    ]
                                  : [
                                      tokens.primary.withValues(alpha: 0.14),
                                      tokens.primary.withValues(alpha: 0.06),
                                    ],
                            ),
                          ),
                          child: Center(
                            child: Text(
                              initial,
                              style: TextStyle(
                                color: tokens.primary,
                                fontSize: 17,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                        // Tag color dot
                        if (tag != null)
                          Positioned(
                            right: 0,
                            bottom: 0,
                            child: Container(
                              width: 12,
                              height: 12,
                              decoration: BoxDecoration(
                                color: Color(tag!.argbColor),
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: cinematic
                                      ? tokens.scaffold
                                      : tokens.surface,
                                  width: 2,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            if (thread.isPinned)
                              Padding(
                                padding: const EdgeInsets.only(right: 4),
                                child: Icon(
                                  Icons.push_pin_rounded,
                                  size: 13,
                                  color: tokens.primary.withValues(alpha: 0.6),
                                ),
                              ),
                            Expanded(
                              child: Hero(
                                tag: 'thread_title_${thread.id}',
                                flightShuttleBuilder:
                                    (_, anim, dir, from, to) =>
                                        DefaultTextStyle(
                                  style: DefaultTextStyle.of(to).style,
                                  child: to.widget,
                                ),
                                child: Text(
                                  thread.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleSmall
                                      ?.copyWith(
                                        fontWeight: hasUnread
                                            ? FontWeight.w600
                                            : FontWeight.w500,
                                        color: tokens.onSurface,
                                      ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              _timeAgo(thread.updatedAt),
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(
                                    color: hasUnread
                                        ? tokens.primary
                                        : tokens.onSurface
                                            .withValues(alpha: 0.40),
                                  ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                thread.lastMessage,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(
                                      color: tokens.onSurface.withValues(
                                          alpha: hasUnread ? 0.7 : 0.45),
                                    ),
                              ),
                            ),
                            if (hasUnread)
                              Container(
                                margin: const EdgeInsets.only(left: 8),
                                width: 22,
                                height: 22,
                                decoration: BoxDecoration(
                                  color: tokens.primary,
                                  shape: BoxShape.circle,
                                ),
                                child: Center(
                                  child: Text(
                                    thread.unreadCount > 99
                                        ? '99+'
                                        : thread.unreadCount.toString(),
                                    style: TextStyle(
                                      color: cinematic
                                          ? const Color(0xFF040712)
                                          : Colors.white,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showContextMenu(BuildContext context) {
    HapticFeedback.mediumImpact();
    showModalBottomSheet(
      context: context,
      backgroundColor: cinematic ? tokens.card : tokens.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(top: 10, bottom: 8),
              decoration: BoxDecoration(
                color: tokens.onSurface.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Text(
                thread.title,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: tokens.onSurface,
                    ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const Divider(height: 1),
            // Select option to enter bulk-select mode
            if (onEnterSelect != null)
              ListTile(
                leading: Icon(Icons.check_box_outlined,
                    color: tokens.onSurface.withValues(alpha: 0.65)),
                title:
                    Text('Select', style: TextStyle(color: tokens.onSurface)),
                onTap: () {
                  Navigator.pop(ctx);
                  onEnterSelect!();
                },
              ),
            if (onTogglePin != null)
              ListTile(
                leading: Icon(
                    thread.isPinned
                        ? Icons.push_pin_outlined
                        : Icons.push_pin_rounded,
                    color: tokens.onSurface.withValues(alpha: 0.65)),
                title: Text(thread.isPinned ? 'Unpin' : 'Pin to top',
                    style: TextStyle(color: tokens.onSurface)),
                onTap: () {
                  Navigator.pop(ctx);
                  onTogglePin!();
                },
              ),
            if (onToggleArchive != null)
              ListTile(
                leading: Icon(
                  isArchived
                      ? Icons.unarchive_outlined
                      : Icons.archive_outlined,
                  color: tokens.onSurface.withValues(alpha: 0.65),
                ),
                title: Text(isArchived ? 'Unarchive' : 'Archive',
                    style: TextStyle(color: tokens.onSurface)),
                onTap: () {
                  Navigator.pop(ctx);
                  onToggleArchive!();
                },
              ),
            if (onSetTag != null)
              ListTile(
                leading: Icon(Icons.label_outline_rounded,
                    color: tokens.onSurface.withValues(alpha: 0.65)),
                title: Text('Tag', style: TextStyle(color: tokens.onSurface)),
                trailing: tag != null
                    ? Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: Color(tag!.argbColor),
                          shape: BoxShape.circle,
                        ),
                      )
                    : null,
                onTap: () {
                  Navigator.pop(ctx);
                  _showTagPicker(context);
                },
              ),
            ListTile(
              leading: Icon(Icons.edit_outlined,
                  color: tokens.onSurface.withValues(alpha: 0.65)),
              title: Text('Rename', style: TextStyle(color: tokens.onSurface)),
              onTap: () {
                Navigator.pop(ctx);
                onRename();
              },
            ),
            ListTile(
              leading: Icon(Icons.delete_outline_rounded,
                  color: Theme.of(context).colorScheme.error),
              title: Text('Delete',
                  style: TextStyle(color: Theme.of(context).colorScheme.error)),
              onTap: () {
                Navigator.pop(ctx);
                onDelete();
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _showTagPicker(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: cinematic ? tokens.card : tokens.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(top: 10, bottom: 12),
              decoration: BoxDecoration(
                color: tokens.onSurface.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                'Tag conversation',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: tokens.onSurface,
                    ),
              ),
            ),
            const SizedBox(height: 8),
            if (tag != null)
              ListTile(
                leading: Icon(Icons.label_off_outlined,
                    color: tokens.onSurface.withValues(alpha: 0.55)),
                title: Text('Remove tag',
                    style: TextStyle(color: tokens.onSurface)),
                onTap: () {
                  Navigator.pop(ctx);
                  onSetTag?.call(null);
                },
              ),
            ...ConversationTag.values.map(
              (t) => ListTile(
                leading: Container(
                  width: 18,
                  height: 18,
                  decoration: BoxDecoration(
                    color: Color(t.argbColor),
                    shape: BoxShape.circle,
                  ),
                ),
                title: Text(t.label, style: TextStyle(color: tokens.onSurface)),
                trailing: tag == t
                    ? Icon(Icons.check_rounded, size: 18, color: tokens.primary)
                    : null,
                onTap: () {
                  Navigator.pop(ctx);
                  onSetTag?.call(t);
                },
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

/// Bulk-selection action bar shown at the top of the chat list.
class _SelectionActionBar extends StatelessWidget {
  const _SelectionActionBar({
    required this.count,
    required this.tokens,
    required this.cinematic,
    required this.onCancel,
    required this.onDelete,
    required this.canArchive,
    required this.canTag,
    this.onArchive,
    this.onTag,
  });

  final int count;
  final SvenModeTokens tokens;
  final bool cinematic;
  final VoidCallback onCancel;
  final VoidCallback onDelete;
  final bool canArchive;
  final bool canTag;
  final VoidCallback? onArchive;
  final void Function(ConversationTag? tag)? onTag;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: cinematic
            ? tokens.primary.withValues(alpha: 0.10)
            : tokens.primary.withValues(alpha: 0.07),
        border: Border(
          bottom: BorderSide(
            color: tokens.primary.withValues(alpha: cinematic ? 0.22 : 0.15),
          ),
        ),
      ),
      child: Row(
        children: [
          // Cancel
          IconButton(
            tooltip: 'Cancel selection',
            onPressed: onCancel,
            icon: Icon(Icons.close_rounded,
                size: 22, color: tokens.onSurface.withValues(alpha: 0.7)),
          ),
          // Selected count badge
          Expanded(
            child: Text(
              '$count selected',
              style: TextStyle(
                color: tokens.onSurface,
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          // Archive
          if (canArchive)
            Tooltip(
              message: 'Archive selected',
              child: IconButton(
                onPressed: onArchive,
                icon: Icon(Icons.archive_outlined,
                    size: 22, color: tokens.onSurface.withValues(alpha: 0.65)),
              ),
            ),
          // Tag
          if (canTag)
            Tooltip(
              message: 'Tag selected',
              child: IconButton(
                onPressed:
                    onTag != null ? () => _showBulkTagPicker(context) : null,
                icon: Icon(Icons.label_outline_rounded,
                    size: 22, color: tokens.onSurface.withValues(alpha: 0.65)),
              ),
            ),
          // Delete
          Tooltip(
            message: 'Delete selected',
            child: IconButton(
              onPressed: onDelete,
              icon: Icon(Icons.delete_outline_rounded,
                  size: 22, color: Theme.of(context).colorScheme.error),
            ),
          ),
        ],
      ),
    );
  }

  void _showBulkTagPicker(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: cinematic ? tokens.card : tokens.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(top: 10, bottom: 12),
              decoration: BoxDecoration(
                color: tokens.onSurface.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                'Tag $count conversation${count > 1 ? 's' : ''}',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: tokens.onSurface,
                    ),
              ),
            ),
            const SizedBox(height: 8),
            ListTile(
              leading: Icon(Icons.label_off_outlined,
                  color: tokens.onSurface.withValues(alpha: 0.55)),
              title:
                  Text('Remove tag', style: TextStyle(color: tokens.onSurface)),
              onTap: () {
                Navigator.pop(ctx);
                onTag?.call(null);
              },
            ),
            ...ConversationTag.values.map(
              (t) => ListTile(
                leading: Container(
                  width: 18,
                  height: 18,
                  decoration: BoxDecoration(
                    color: Color(t.argbColor),
                    shape: BoxShape.circle,
                  ),
                ),
                title: Text(t.label, style: TextStyle(color: tokens.onSurface)),
                onTap: () {
                  Navigator.pop(ctx);
                  onTag?.call(t);
                },
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

/// Small filter chip used in the chat list header row.
class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.tokens,
    required this.cinematic,
    required this.onTap,
    this.icon,
    this.color,
  });

  final String label;
  final bool selected;
  final SvenModeTokens tokens;
  final bool cinematic;
  final VoidCallback onTap;
  final IconData? icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final activeColor = color ?? tokens.primary;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: selected
              ? activeColor.withValues(alpha: 0.15)
              : (cinematic
                  ? tokens.surface.withValues(alpha: 0.3)
                  : tokens.onSurface.withValues(alpha: 0.05)),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected
                ? activeColor.withValues(alpha: 0.5)
                : (cinematic ? tokens.frame : Colors.transparent),
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon,
                  size: 13,
                  color: selected
                      ? activeColor
                      : tokens.onSurface.withValues(alpha: 0.5)),
              const SizedBox(width: 4),
            ] else if (color != null) ...[
              Container(
                width: 8,
                height: 8,
                decoration:
                    BoxDecoration(color: activeColor, shape: BoxShape.circle),
              ),
              const SizedBox(width: 5),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                color: selected
                    ? activeColor
                    : tokens.onSurface.withValues(alpha: 0.6),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
