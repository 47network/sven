import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/app_models.dart';
import '../../app/providers.dart';
import '../../app/sven_tokens.dart';
import 'memory_models.dart';
import 'memory_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// MemoryPage — manage user facts + custom instructions
// ═══════════════════════════════════════════════════════════════════════════

class MemoryPage extends ConsumerStatefulWidget {
  const MemoryPage({
    super.key,
    required this.visualMode,
  });

  final VisualMode visualMode;

  @override
  ConsumerState<MemoryPage> createState() => _MemoryPageState();
}

class _MemoryPageState extends ConsumerState<MemoryPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;
  final _nameCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    // ref.read is safe in initState for ConsumerStatefulWidget.
    _nameCtrl.text = ref.read(memoryServiceProvider).userName;
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    _nameCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // ref.watch rebuilds this widget whenever MemoryService notifies,
    // replacing the old ListenableBuilder pattern.
    final memoryService = ref.watch(memoryServiceProvider);
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        backgroundColor: tokens.scaffold,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'Memory & Instructions',
          style: TextStyle(
            color: tokens.onSurface,
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [
          // Memory enabled toggle
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'On',
                  style: TextStyle(
                    fontSize: 12,
                    color: tokens.onSurface.withValues(alpha: 0.5),
                  ),
                ),
                const SizedBox(width: 4),
                Switch.adaptive(
                  value: memoryService.memoryEnabled,
                  onChanged: (v) => memoryService.setMemoryEnabled(v),
                  activeThumbColor: tokens.primary,
                  activeTrackColor: tokens.primary.withValues(alpha: 0.3),
                ),
              ],
            ),
          ),
        ],
        bottom: TabBar(
          controller: _tabCtrl,
          labelColor: tokens.primary,
          unselectedLabelColor: tokens.onSurface.withValues(alpha: 0.45),
          indicatorColor: tokens.primary,
          indicatorWeight: 2,
          tabs: const [
            Tab(text: 'Memories'),
            Tab(text: 'Instructions'),
          ],
        ),
      ),
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: cinematic ? tokens.backgroundGradient : null,
        ),
        child: TabBarView(
          controller: _tabCtrl,
          children: [
            _MemoriesTab(
              memoryService: memoryService,
              tokens: tokens,
              cinematic: cinematic,
              nameCtrl: _nameCtrl,
            ),
            _InstructionsTab(
              memoryService: memoryService,
              tokens: tokens,
              cinematic: cinematic,
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Memories tab ────────────────────────────────────────────────────────────

class _MemoriesTab extends StatefulWidget {
  const _MemoriesTab({
    required this.memoryService,
    required this.tokens,
    required this.cinematic,
    required this.nameCtrl,
  });

  final MemoryService memoryService;
  final SvenModeTokens tokens;
  final bool cinematic;
  final TextEditingController nameCtrl;

  @override
  State<_MemoriesTab> createState() => _MemoriesTabState();
}

class _MemoriesTabState extends State<_MemoriesTab> {
  final _addCtrl = TextEditingController();
  FactCategory _selectedCategory = FactCategory.general;

  // ── Search & filter state ──
  final _searchCtrl = TextEditingController();
  String _searchQuery = '';
  FactCategory? _filterCategory;

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(() {
      setState(() => _searchQuery = _searchCtrl.text);
    });
  }

  @override
  void dispose() {
    _addCtrl.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ms = widget.memoryService;
    final allFacts = ms.facts;

    // ── Filter + sort facts ──
    var displayFacts = allFacts.toList();
    if (_searchQuery.trim().isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      displayFacts = displayFacts
          .where((f) => f.content.toLowerCase().contains(q))
          .toList();
    }
    if (_filterCategory != null) {
      displayFacts =
          displayFacts.where((f) => f.category == _filterCategory).toList();
    }
    // Starred first, then newest first
    displayFacts.sort((a, b) {
      if (a.isStarred && !b.isStarred) return -1;
      if (!a.isStarred && b.isStarred) return 1;
      return b.createdAt.compareTo(a.createdAt);
    });

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Your name ──
        _SectionHeader(
          label: 'Your name',
          tokens: widget.tokens,
          cinematic: widget.cinematic,
        ),
        const SizedBox(height: 8),
        _MemoryCard(
          tokens: widget.tokens,
          cinematic: widget.cinematic,
          child: Row(
            children: [
              Icon(Icons.person_outline_rounded,
                  size: 18,
                  color: widget.tokens.onSurface.withValues(alpha: 0.5)),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: widget.nameCtrl,
                  style:
                      TextStyle(color: widget.tokens.onSurface, fontSize: 15),
                  decoration: InputDecoration(
                    hintText: 'What should Sven call you?',
                    hintStyle: TextStyle(
                      color: widget.tokens.onSurface.withValues(alpha: 0.35),
                    ),
                    border: InputBorder.none,
                    isDense: true,
                  ),
                  onSubmitted: (v) => ms.setUserName(v),
                  textInputAction: TextInputAction.done,
                ),
              ),
              if (widget.nameCtrl.text.trim().isNotEmpty)
                IconButton(
                  icon: Icon(Icons.check_rounded,
                      color: widget.tokens.primary, size: 20),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: () => ms.setUserName(widget.nameCtrl.text),
                ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // ── Add a fact ──
        _SectionHeader(
          label: 'What Sven knows about you',
          tokens: widget.tokens,
          cinematic: widget.cinematic,
          trailing: allFacts.isNotEmpty
              ? TextButton(
                  onPressed: () => _confirmClearAll(context),
                  style: TextButton.styleFrom(
                    foregroundColor: Theme.of(context)
                        .colorScheme
                        .error
                        .withValues(alpha: 0.9),
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                  ),
                  child:
                      const Text('Clear all', style: TextStyle(fontSize: 12)),
                )
              : null,
        ),
        const SizedBox(height: 8),
        _MemoryCard(
          tokens: widget.tokens,
          cinematic: widget.cinematic,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: FactCategory.values.map((cat) {
                  final selected = cat == _selectedCategory;
                  return ChoiceChip(
                    label:
                        Text(cat.label, style: const TextStyle(fontSize: 11)),
                    selected: selected,
                    onSelected: (_) => setState(() => _selectedCategory = cat),
                    selectedColor:
                        widget.tokens.primary.withValues(alpha: 0.15),
                    labelStyle: TextStyle(
                      color: selected
                          ? widget.tokens.primary
                          : widget.tokens.onSurface.withValues(alpha: 0.5),
                      fontWeight:
                          selected ? FontWeight.w600 : FontWeight.normal,
                    ),
                    side: BorderSide(
                      color: selected
                          ? widget.tokens.primary.withValues(alpha: 0.35)
                          : widget.tokens.frame,
                    ),
                    backgroundColor: Colors.transparent,
                    visualDensity: VisualDensity.compact,
                  );
                }).toList(),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _addCtrl,
                      style: TextStyle(
                          color: widget.tokens.onSurface, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'e.g. I prefer concise responses',
                        hintStyle: TextStyle(
                          color:
                              widget.tokens.onSurface.withValues(alpha: 0.35),
                        ),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(vertical: 4),
                      ),
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => _addFact(),
                    ),
                  ),
                  IconButton(
                    icon: Icon(Icons.add_circle_rounded,
                        color: widget.tokens.primary, size: 24),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    onPressed: _addFact,
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ── Search bar + category filter (only shown when there are facts) ──
        if (allFacts.isNotEmpty) ...[
          Semantics(
            label: 'Search memories',
            textField: true,
            child: Container(
              height: 38,
              decoration: BoxDecoration(
                color: widget.cinematic
                    ? widget.tokens.surface.withValues(alpha: 0.5)
                    : widget.tokens.onSurface.withValues(alpha: 0.04),
                borderRadius: BorderRadius.circular(11),
                border: widget.cinematic
                    ? Border.all(color: widget.tokens.frame)
                    : null,
              ),
              child: TextField(
                controller: _searchCtrl,
                style: TextStyle(color: widget.tokens.onSurface, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Search memories…',
                  hintStyle: TextStyle(
                    color: widget.tokens.onSurface.withValues(alpha: 0.35),
                    fontSize: 13,
                  ),
                  prefixIcon: ExcludeSemantics(
                    child: Icon(Icons.search_rounded,
                        size: 17,
                        color: widget.tokens.onSurface.withValues(alpha: 0.35)),
                  ),
                  suffixIcon: _searchQuery.isNotEmpty
                      ? GestureDetector(
                          onTap: () => _searchCtrl.clear(),
                          child: ExcludeSemantics(
                            child: Icon(Icons.close_rounded,
                                size: 15,
                                color: widget.tokens.onSurface
                                    .withValues(alpha: 0.4)),
                          ),
                        )
                      : null,
                  border: InputBorder.none,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 9),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          // Category filter pills
          SizedBox(
            height: 30,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _MemoryFilterChip(
                  label: 'All',
                  selected: _filterCategory == null,
                  tokens: widget.tokens,
                  cinematic: widget.cinematic,
                  onTap: () => setState(() => _filterCategory = null),
                ),
                const SizedBox(width: 6),
                ...FactCategory.values.map((cat) {
                  final active = _filterCategory == cat;
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: _MemoryFilterChip(
                      label: cat.label,
                      selected: active,
                      color: _categoryColor(cat),
                      tokens: widget.tokens,
                      cinematic: widget.cinematic,
                      onTap: () =>
                          setState(() => _filterCategory = active ? null : cat),
                    ),
                  );
                }),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],

        // ── Facts list ──
        if (allFacts.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 32),
            child: Column(
              children: [
                Icon(Icons.psychology_alt_outlined,
                    size: 48,
                    color: widget.tokens.onSurface.withValues(alpha: 0.2)),
                const SizedBox(height: 12),
                Text(
                  'No memories yet',
                  style: TextStyle(
                    color: widget.tokens.onSurface.withValues(alpha: 0.4),
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Add facts about yourself so Sven can\npersonalise every conversation.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: widget.tokens.onSurface.withValues(alpha: 0.3),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          )
        else if (displayFacts.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Center(
              child: Text(
                'No memories match your search',
                style: TextStyle(
                  color: widget.tokens.onSurface.withValues(alpha: 0.4),
                  fontSize: 14,
                ),
              ),
            ),
          )
        else
          ...displayFacts.map((fact) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _FactTile(
                  fact: fact,
                  tokens: widget.tokens,
                  cinematic: widget.cinematic,
                  onDelete: () => ms.deleteFact(fact.id),
                  onEdit: (newContent) => ms.updateFact(fact.id, newContent),
                  onToggleStar: () => ms.toggleStarFact(fact.id),
                ),
              )),
      ],
    );
  }

  void _addFact() {
    final text = _addCtrl.text.trim();
    if (text.isEmpty) return;
    HapticFeedback.selectionClick();
    widget.memoryService.addFact(text, category: _selectedCategory);
    _addCtrl.clear();
  }

  Color _categoryColor(FactCategory cat) {
    switch (cat) {
      case FactCategory.general:
        return widget.tokens.primary.withValues(alpha: 0.7);
      case FactCategory.preference:
        return const Color(0xFF8B5CF6);
      case FactCategory.professional:
        return const Color(0xFFF59E0B);
      case FactCategory.personal:
        return const Color(0xFFEC4899);
    }
  }

  Future<void> _confirmClearAll(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear all memories?'),
        content: const Text(
            'Sven will forget everything you\'ve shared. This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            child: const Text('Clear all'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      widget.memoryService.clearAllFacts();
    }
  }
}

// ─── Fact tile ────────────────────────────────────────────────────────────────

class _FactTile extends StatefulWidget {
  const _FactTile({
    required this.fact,
    required this.tokens,
    required this.cinematic,
    required this.onDelete,
    required this.onEdit,
    required this.onToggleStar,
  });

  final UserFact fact;
  final SvenModeTokens tokens;
  final bool cinematic;
  final VoidCallback onDelete;
  final void Function(String) onEdit;
  final VoidCallback onToggleStar;

  @override
  State<_FactTile> createState() => _FactTileState();
}

class _FactTileState extends State<_FactTile> {
  bool _editing = false;
  late final TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.fact.content);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '${widget.fact.content}. Category: ${widget.fact.category.label}'
          '${widget.fact.isStarred ? ". Starred" : ""}',
      child: _MemoryCard(
        tokens: widget.tokens,
        cinematic: widget.cinematic,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ExcludeSemantics(
              child: Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.only(right: 10, top: 4),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _categoryColor(widget.fact.category),
                  ),
                ),
              ),
            ),
            Expanded(
              child: _editing
                  ? TextField(
                      controller: _ctrl,
                      autofocus: true,
                      style: TextStyle(
                          color: widget.tokens.onSurface, fontSize: 14),
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                      onSubmitted: (v) {
                        if (v.trim().isNotEmpty) widget.onEdit(v);
                        setState(() => _editing = false);
                      },
                    )
                  : Text(
                      widget.fact.content,
                      style: TextStyle(
                          color: widget.tokens.onSurface, fontSize: 14),
                    ),
            ),
            const SizedBox(width: 4),
            // Star toggle
            Semantics(
              label: widget.fact.isStarred ? 'Unstar fact' : 'Star fact',
              button: true,
              child: GestureDetector(
                onTap: widget.onToggleStar,
                child: Icon(
                  widget.fact.isStarred
                      ? Icons.star_rounded
                      : Icons.star_border_rounded,
                  size: 16,
                  color: widget.fact.isStarred
                      ? const Color(0xFFFBBF24)
                      : widget.tokens.onSurface.withValues(alpha: 0.28),
                ),
              ),
            ),
            const SizedBox(width: 4),
            GestureDetector(
              onTap: () {
                if (_editing) {
                  if (_ctrl.text.trim().isNotEmpty) {
                    widget.onEdit(_ctrl.text.trim());
                  }
                }
                setState(() => _editing = !_editing);
              },
              child: Icon(
                _editing ? Icons.check_rounded : Icons.edit_outlined,
                size: 16,
                color: widget.tokens.onSurface.withValues(alpha: 0.35),
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: widget.onDelete,
              child: Icon(
                Icons.close_rounded,
                size: 16,
                color: widget.tokens.onSurface.withValues(alpha: 0.35),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _categoryColor(FactCategory cat) {
    switch (cat) {
      case FactCategory.general:
        return widget.tokens.primary.withValues(alpha: 0.7);
      case FactCategory.preference:
        return const Color(0xFF8B5CF6);
      case FactCategory.professional:
        return const Color(0xFFF59E0B);
      case FactCategory.personal:
        return const Color(0xFFEC4899);
    }
  }
}

// ─── Instructions tab ─────────────────────────────────────────────────────────

class _InstructionsTab extends StatefulWidget {
  const _InstructionsTab({
    required this.memoryService,
    required this.tokens,
    required this.cinematic,
  });

  final MemoryService memoryService;
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  State<_InstructionsTab> createState() => _InstructionsTabState();
}

class _InstructionsTabState extends State<_InstructionsTab> {
  late final TextEditingController _contextCtrl;
  late final TextEditingController _styleCtrl;
  bool _unsaved = false;

  @override
  void initState() {
    super.initState();
    final instr = widget.memoryService.instructions;
    _contextCtrl = TextEditingController(text: instr.userContext);
    _styleCtrl = TextEditingController(text: instr.responseStyle);
    _contextCtrl.addListener(_onChanged);
    _styleCtrl.addListener(_onChanged);
  }

  @override
  void dispose() {
    _contextCtrl.dispose();
    _styleCtrl.dispose();
    super.dispose();
  }

  void _onChanged() => setState(() => _unsaved = true);

  Future<void> _save() async {
    await widget.memoryService.setInstructions(CustomInstructions(
      userContext: _contextCtrl.text,
      responseStyle: _styleCtrl.text,
    ));
    if (mounted) {
      setState(() => _unsaved = false);
      HapticFeedback.lightImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Instructions saved'),
          duration: Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── What Sven knows about context ──
        _SectionHeader(
          label: 'About you',
          subtitle: 'Sven will include this in every conversation.',
          tokens: widget.tokens,
          cinematic: widget.cinematic,
        ),
        const SizedBox(height: 8),
        _MemoryCard(
          tokens: widget.tokens,
          cinematic: widget.cinematic,
          child: TextField(
            controller: _contextCtrl,
            maxLines: 5,
            style: TextStyle(color: widget.tokens.onSurface, fontSize: 14),
            decoration: InputDecoration(
              hintText:
                  'e.g. I\'m a software engineer who works with Python and Flutter. I prefer technical explanations.',
              hintStyle: TextStyle(
                  color: widget.tokens.onSurface.withValues(alpha: 0.3),
                  fontSize: 13),
              border: InputBorder.none,
              isDense: true,
            ),
          ),
        ),
        const SizedBox(height: 20),

        // ── Response style ──
        _SectionHeader(
          label: 'How Sven should respond',
          subtitle: 'Tone, length, format, language, etc.',
          tokens: widget.tokens,
          cinematic: widget.cinematic,
        ),
        const SizedBox(height: 8),
        _MemoryCard(
          tokens: widget.tokens,
          cinematic: widget.cinematic,
          child: TextField(
            controller: _styleCtrl,
            maxLines: 5,
            style: TextStyle(color: widget.tokens.onSurface, fontSize: 14),
            decoration: InputDecoration(
              hintText:
                  'e.g. Be concise. Use bullet points where possible. Respond in casual English.',
              hintStyle: TextStyle(
                  color: widget.tokens.onSurface.withValues(alpha: 0.3),
                  fontSize: 13),
              border: InputBorder.none,
              isDense: true,
            ),
          ),
        ),
        const SizedBox(height: 24),

        // ── Save button ──
        FilledButton.icon(
          onPressed: _unsaved ? _save : null,
          icon: const Icon(Icons.save_rounded),
          label: const Text('Save instructions'),
          style: FilledButton.styleFrom(
            backgroundColor: widget.tokens.primary,
            foregroundColor:
                widget.cinematic ? const Color(0xFF040712) : Colors.white,
            minimumSize: const Size.fromHeight(48),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),
        if (!_unsaved) ...[
          const SizedBox(height: 12),
          Center(
            child: Text(
              'Changes saved automatically',
              style: TextStyle(
                  color: widget.tokens.onSurface.withValues(alpha: 0.35),
                  fontSize: 12),
            ),
          ),
        ],
      ],
    );
  }
}

// ─── Filter chip for memory search ──────────────────────────────────────────

class _MemoryFilterChip extends StatelessWidget {
  const _MemoryFilterChip({
    required this.label,
    required this.selected,
    required this.tokens,
    required this.cinematic,
    required this.onTap,
    this.color,
  });

  final String label;
  final bool selected;
  final SvenModeTokens tokens;
  final bool cinematic;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final activeColor = color ?? tokens.primary;
    return Semantics(
      label: '$label filter${selected ? ", active" : ""}',
      button: true,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: selected
                ? activeColor.withValues(alpha: 0.14)
                : (cinematic
                    ? tokens.surface.withValues(alpha: 0.3)
                    : tokens.onSurface.withValues(alpha: 0.04)),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected
                  ? activeColor.withValues(alpha: 0.45)
                  : (cinematic ? tokens.frame : Colors.transparent),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (color != null) ...[
                ExcludeSemantics(
                  child: Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: activeColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
                const SizedBox(width: 4),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                  color: selected
                      ? activeColor
                      : tokens.onSurface.withValues(alpha: 0.6),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

class _MemoryCard extends StatelessWidget {
  const _MemoryCard({
    required this.child,
    required this.tokens,
    required this.cinematic,
  });

  final Widget child;
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cinematic ? tokens.card : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: cinematic
              ? tokens.frame
              : tokens.onSurface.withValues(alpha: 0.08),
          width: 0.7,
        ),
        boxShadow: cinematic
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      child: child,
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.label,
    required this.tokens,
    required this.cinematic,
    this.subtitle,
    this.trailing,
  });

  final String label;
  final String? subtitle;
  final SvenModeTokens tokens;
  final bool cinematic;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: tokens.onSurface,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.3,
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(
                  subtitle!,
                  style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.45),
                    fontSize: 12,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (trailing != null) trailing!,
      ],
    );
  }
}
