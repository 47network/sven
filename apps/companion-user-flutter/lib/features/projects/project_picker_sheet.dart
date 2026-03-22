import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'project_service.dart';
import '../../app/sven_tokens.dart';
import '../../app/app_models.dart';

// Curated emoji picker rows
const _kEmojiOptions = [
  '📁',
  '🚀',
  '💡',
  '🔬',
  '🎨',
  '📝',
  '🏗️',
  '🌍',
  '📊',
  '🎯',
  '⚙️',
  '🧠',
  '💼',
  '🌱',
  '🔒',
  '🎵',
];

// ═══════════════════════════════════════════════════════════════════════════
// ProjectsSheet — full-screen management sheet
// ═══════════════════════════════════════════════════════════════════════════

class ProjectsSheet extends StatefulWidget {
  const ProjectsSheet({
    super.key,
    required this.service,
    required this.visualMode,

    /// If provided, a "Assign to project" mode is shown.
    this.conversationId,
    this.conversationTitle,
  });

  final ProjectService service;
  final VisualMode visualMode;
  final String? conversationId;
  final String? conversationTitle;

  @override
  State<ProjectsSheet> createState() => _ProjectsSheetState();
}

class _ProjectsSheetState extends State<ProjectsSheet> {
  bool _showNew = false;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final bool assignMode = widget.conversationId != null;

    return ListenableBuilder(
      listenable: widget.service,
      builder: (context, _) {
        final projects = widget.service.projects;

        return Material(
          color: tokens.scaffold,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          child: DraggableScrollableSheet(
            initialChildSize: 0.75,
            minChildSize: 0.5,
            maxChildSize: 0.95,
            expand: false,
            builder: (context, scrollCtrl) {
              return Column(
                children: [
                  // Handle
                  const SizedBox(height: 8),
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: tokens.onSurface.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  // Header
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Row(
                      children: [
                        Icon(Icons.folder_special_rounded,
                            color: tokens.primary, size: 22),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                assignMode
                                    ? 'Assign to project'
                                    : 'Project Spaces',
                                style: TextStyle(
                                  color: tokens.onSurface,
                                  fontSize: 17,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              if (assignMode &&
                                  widget.conversationTitle != null)
                                Text(
                                  widget.conversationTitle!,
                                  style: TextStyle(
                                    color:
                                        tokens.onSurface.withValues(alpha: 0.5),
                                    fontSize: 12,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                            ],
                          ),
                        ),
                        if (!_showNew)
                          TextButton.icon(
                            onPressed: () => setState(() => _showNew = true),
                            icon: Icon(Icons.add,
                                size: 16, color: tokens.primary),
                            label: Text('New',
                                style: TextStyle(color: tokens.primary)),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 4),
                  Divider(color: tokens.onSurface.withValues(alpha: 0.08)),
                  // Create form
                  if (_showNew)
                    _CreateProjectForm(
                      tokens: tokens,
                      onCancel: () => setState(() => _showNew = false),
                      onCreate: (name, emoji) async {
                        await widget.service
                            .createProject(name: name, emoji: emoji);
                        setState(() => _showNew = false);
                      },
                    ),
                  // Project list
                  Expanded(
                    child: projects.isEmpty
                        ? _EmptyState(tokens: tokens)
                        : ListView.separated(
                            controller: scrollCtrl,
                            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                            itemCount: projects.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: 8),
                            itemBuilder: (context, i) {
                              final proj = projects[i];
                              final assigned = widget.conversationId != null &&
                                  proj.conversationIds
                                      .contains(widget.conversationId);
                              return _ProjectTile(
                                project: proj,
                                tokens: tokens,
                                assignMode: assignMode,
                                isAssigned: assigned,
                                onTap: assignMode
                                    ? () async {
                                        HapticFeedback.lightImpact();
                                        if (assigned) {
                                          await widget.service
                                              .removeConversation(proj.id,
                                                  widget.conversationId!);
                                        } else {
                                          await widget.service.addConversation(
                                              proj.id, widget.conversationId!);
                                        }
                                      }
                                    : () => _openDetail(context, proj),
                                onDelete: () async {
                                  final ok =
                                      await _confirmDelete(context, proj.name);
                                  if (ok) {
                                    await widget.service.deleteProject(proj.id);
                                  }
                                },
                              );
                            },
                          ),
                  ),
                ],
              );
            },
          ),
        );
      },
    );
  }

  void _openDetail(BuildContext context, ProjectSpace project) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _ProjectDetailSheet(
        project: project,
        service: widget.service,
        visualMode: widget.visualMode,
      ),
    );
  }

  Future<bool> _confirmDelete(BuildContext ctx, String name) async {
    final result = await showDialog<bool>(
      context: ctx,
      builder: (_) => AlertDialog(
        title: const Text('Delete project?'),
        content:
            Text('"$name" will be removed. Conversations are not deleted.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    return result ?? false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Project tile
// ═══════════════════════════════════════════════════════════════════════════

class _ProjectTile extends StatelessWidget {
  const _ProjectTile({
    required this.project,
    required this.tokens,
    required this.assignMode,
    required this.isAssigned,
    required this.onTap,
    required this.onDelete,
  });

  final ProjectSpace project;
  final SvenModeTokens tokens;
  final bool assignMode;
  final bool isAssigned;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isAssigned ? tokens.primary.withValues(alpha: 0.08) : tokens.card,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              // Emoji icon
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: tokens.primary.withValues(alpha: 0.08),
                ),
                child: Center(
                  child:
                      Text(project.emoji, style: const TextStyle(fontSize: 20)),
                ),
              ),
              const SizedBox(width: 12),
              // Name + count
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      project.name,
                      style: TextStyle(
                        color: tokens.onSurface,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${project.conversationIds.length} conversation'
                      '${project.conversationIds.length == 1 ? '' : 's'}',
                      style: TextStyle(
                        color: tokens.onSurface.withValues(alpha: 0.45),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              // Trailing
              if (assignMode)
                AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isAssigned ? tokens.primary : Colors.transparent,
                    border: Border.all(
                      color: isAssigned
                          ? tokens.primary
                          : tokens.onSurface.withValues(alpha: 0.2),
                      width: 1.5,
                    ),
                  ),
                  child: isAssigned
                      ? const Icon(Icons.check_rounded,
                          size: 13, color: Colors.white)
                      : const SizedBox.shrink(),
                )
              else ...[
                IconButton(
                  icon: Icon(Icons.delete_outline_rounded,
                      size: 18,
                      color: tokens.onSurface.withValues(alpha: 0.35)),
                  tooltip: 'Delete project',
                  onPressed: onDelete,
                ),
                Icon(Icons.chevron_right_rounded,
                    color: tokens.onSurface.withValues(alpha: 0.25), size: 20),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Create project inline form
// ═══════════════════════════════════════════════════════════════════════════

class _CreateProjectForm extends StatefulWidget {
  const _CreateProjectForm({
    required this.tokens,
    required this.onCancel,
    required this.onCreate,
  });

  final SvenModeTokens tokens;
  final VoidCallback onCancel;
  final Future<void> Function(String name, String emoji) onCreate;

  @override
  State<_CreateProjectForm> createState() => _CreateProjectFormState();
}

class _CreateProjectFormState extends State<_CreateProjectForm> {
  final _ctrl = TextEditingController();
  String _emoji = '📁';
  bool _saving = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = widget.tokens;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tokens.primary.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('New project',
              style: TextStyle(
                  color: tokens.onSurface,
                  fontWeight: FontWeight.w600,
                  fontSize: 14)),
          const SizedBox(height: 12),
          // Emoji picker
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _kEmojiOptions.length,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (_, i) {
                final e = _kEmojiOptions[i];
                final sel = e == _emoji;
                return GestureDetector(
                  onTap: () => setState(() => _emoji = e),
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: sel
                          ? tokens.primary.withValues(alpha: 0.15)
                          : tokens.surface,
                      border: sel
                          ? Border.all(color: tokens.primary, width: 1.5)
                          : null,
                    ),
                    child: Center(
                        child: Text(e, style: const TextStyle(fontSize: 18))),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _ctrl,
            autofocus: true,
            style: TextStyle(color: tokens.onSurface),
            decoration: InputDecoration(
              hintText: 'Project name…',
              hintStyle:
                  TextStyle(color: tokens.onSurface.withValues(alpha: 0.35)),
              filled: true,
              fillColor: tokens.surface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide.none,
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: widget.onCancel,
                child: Text('Cancel',
                    style: TextStyle(
                        color: tokens.onSurface.withValues(alpha: 0.5))),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: _saving || _ctrl.text.trim().isEmpty
                    ? null
                    : () async {
                        setState(() => _saving = true);
                        await widget.onCreate(_ctrl.text, _emoji);
                      },
                child: _saving
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Create'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Project detail sheet — view/edit context notes
// ═══════════════════════════════════════════════════════════════════════════

class _ProjectDetailSheet extends StatefulWidget {
  const _ProjectDetailSheet({
    required this.project,
    required this.service,
    required this.visualMode,
  });

  final ProjectSpace project;
  final ProjectService service;
  final VisualMode visualMode;

  @override
  State<_ProjectDetailSheet> createState() => _ProjectDetailSheetState();
}

class _ProjectDetailSheetState extends State<_ProjectDetailSheet> {
  late final TextEditingController _notesCtrl;
  bool _editing = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _notesCtrl = TextEditingController(text: widget.project.contextNotes);
  }

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final p = widget.project;

    return Container(
      decoration: BoxDecoration(
        color: tokens.scaffold,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Handle
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: tokens.onSurface.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Text(p.emoji, style: const TextStyle(fontSize: 28)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(p.name,
                        style: TextStyle(
                            color: tokens.onSurface,
                            fontSize: 18,
                            fontWeight: FontWeight.w700)),
                  ),
                  TextButton(
                    onPressed: () => setState(() => _editing = !_editing),
                    child: Text(
                      _editing ? 'Cancel' : 'Edit notes',
                      style: TextStyle(color: tokens.primary),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                '${p.conversationIds.length} conversation'
                '${p.conversationIds.length == 1 ? '' : 's'} · '
                'Created ${_formatDate(p.createdAt)}',
                style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.4),
                    fontSize: 13),
              ),
              const SizedBox(height: 16),
              Text('Context notes',
                  style: TextStyle(
                      color: tokens.onSurface,
                      fontWeight: FontWeight.w600,
                      fontSize: 14)),
              const SizedBox(height: 6),
              Text(
                'Notes added here are injected into Sven\'s context for '
                'conversations in this project.',
                style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.45),
                    fontSize: 12),
              ),
              const SizedBox(height: 10),
              if (_editing)
                TextField(
                  controller: _notesCtrl,
                  maxLines: 5,
                  style: TextStyle(color: tokens.onSurface, fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'e.g. This is a Python backend project '
                        'using FastAPI and PostgreSQL…',
                    hintStyle: TextStyle(
                        color: tokens.onSurface.withValues(alpha: 0.3),
                        fontSize: 13),
                    filled: true,
                    fillColor: tokens.surface,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.all(12),
                  ),
                )
              else
                Container(
                  width: double.infinity,
                  constraints: const BoxConstraints(minHeight: 60),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: tokens.surface,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    p.contextNotes.isEmpty
                        ? 'No context notes yet. Tap "Edit notes" to add.'
                        : p.contextNotes,
                    style: TextStyle(
                        color: p.contextNotes.isEmpty
                            ? tokens.onSurface.withValues(alpha: 0.3)
                            : tokens.onSurface,
                        fontSize: 13,
                        height: 1.4),
                  ),
                ),
              if (_editing) ...[
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerRight,
                  child: FilledButton(
                    onPressed: _saving
                        ? null
                        : () async {
                            setState(() => _saving = true);
                            await widget.service.updateProject(
                              p.id,
                              contextNotes: _notesCtrl.text,
                            );
                            if (mounted) {
                              setState(() {
                                _saving = false;
                                _editing = false;
                              });
                            }
                          },
                    child: _saving
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Save'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime dt) {
    final months = [
      '',
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
      'Dec'
    ];
    return '${months[dt.month]} ${dt.day}, ${dt.year}';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Empty state
// ═══════════════════════════════════════════════════════════════════════════

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.tokens});

  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.folder_open_rounded,
              size: 48, color: tokens.onSurface.withValues(alpha: 0.15)),
          const SizedBox(height: 12),
          Text(
            'No projects yet',
            style: TextStyle(
                color: tokens.onSurface.withValues(alpha: 0.45),
                fontSize: 15,
                fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 6),
          Text(
            'Tap "New" to create a project space',
            style: TextStyle(
                color: tokens.onSurface.withValues(alpha: 0.3), fontSize: 13),
          ),
        ],
      ),
    );
  }
}
