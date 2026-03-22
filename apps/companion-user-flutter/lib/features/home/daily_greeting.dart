import 'package:flutter/material.dart';

import '../../app/sven_tokens.dart';
import '../../app/app_models.dart';
import '../memory/memory_service.dart';
import '../memory/memory_models.dart';
import 'streak_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// DailyGreeting — Time-aware greeting card shown on the Canvas tab
//
// Shows:
//   ● Time-appropriate greeting ("Good morning, <name>")
//   ● Today's date
//   ● Quick recap of recent conversations
//   ● A motivational or contextual tip
// ═══════════════════════════════════════════════════════════════════════════

class DailyGreeting extends StatelessWidget {
  const DailyGreeting({
    super.key,
    required this.visualMode,
    required this.tokens,
    this.memoryService,
    this.streakService,
    this.onDismiss,
    this.onSuggestionTap,
  });

  final VisualMode visualMode;
  final SvenModeTokens tokens;
  final MemoryService? memoryService;
  final StreakService? streakService;
  final VoidCallback? onDismiss;

  /// Called when the user taps a proactive suggestion chip.
  /// [prefill] is the text to seed into a new chat.
  final void Function(String prefill)? onSuggestionTap;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final hour = now.hour;
    final userName = memoryService?.userName ?? '';
    final greeting = _greeting(hour, userName);
    final emoji = _emoji(hour);
    final cinematic = visualMode == VisualMode.cinematic;
    final summaries = memoryService?.conversationSummaries ?? [];
    final recent = summaries.take(3).toList();
    final tip = _tips[now.day % _tips.length];
    final streak = streakService?.currentStreak ?? 0;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: cinematic ? tokens.card.withValues(alpha: 0.85) : tokens.surface,
        border: cinematic
            ? Border.all(color: tokens.primary.withValues(alpha: 0.15))
            : null,
        boxShadow: cinematic
            ? [
                BoxShadow(
                  color: tokens.primary.withValues(alpha: 0.08),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ]
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 12,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Greeting header ──
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 12, 0),
            child: Row(
              children: [
                Text(emoji, style: const TextStyle(fontSize: 28)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        greeting,
                        style: TextStyle(
                          color: tokens.onSurface,
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        _dateLabel(now),
                        style: TextStyle(
                          color: tokens.onSurface.withValues(alpha: 0.45),
                          fontSize: 12,
                          letterSpacing: 0.3,
                        ),
                      ),
                      // ── Chat streak badge ──
                      if (streak > 1) ...[
                        const SizedBox(height: 5),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color:
                                const Color(0xFFFF6B35).withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                                color: const Color(0xFFFF6B35)
                                    .withValues(alpha: 0.30)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text('🔥', style: TextStyle(fontSize: 11)),
                              const SizedBox(width: 4),
                              Text(
                                '$streak day streak',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFFFF6B35),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (onDismiss != null)
                  IconButton(
                    icon: Icon(Icons.close_rounded,
                        size: 18,
                        color: tokens.onSurface.withValues(alpha: 0.3)),
                    onPressed: onDismiss,
                    tooltip: 'Dismiss',
                  ),
              ],
            ),
          ),

          // ── Recent conversations recap ──
          if (recent.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
              child: Text(
                'Recently',
                style: TextStyle(
                  color: tokens.primary.withValues(alpha: 0.8),
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
            ),
            const SizedBox(height: 6),
            ...recent.map((s) => _RecentItem(
                  summary: s,
                  tokens: tokens,
                  cinematic: cinematic,
                )),
          ],

          // ── Proactive suggestions ──
          ..._buildSuggestions(summaries, cinematic),

          // ── Tip / suggestion ──
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: tokens.primary.withValues(alpha: 0.06),
                border:
                    Border.all(color: tokens.primary.withValues(alpha: 0.10)),
              ),
              child: Row(
                children: [
                  Icon(Icons.lightbulb_outline_rounded,
                      size: 16, color: tokens.primary.withValues(alpha: 0.6)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      tip,
                      style: TextStyle(
                        color: tokens.onSurface.withValues(alpha: 0.6),
                        fontSize: 12,
                        height: 1.35,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Build proactive suggestion chips from recent conversations.
  List<Widget> _buildSuggestions(
    List<ConversationSummary> summaries,
    bool cinematic,
  ) {
    final suggestions = _generateSuggestions(
        summaries, memoryService?.facts ?? const <UserFact>[]);
    if (suggestions.isEmpty) return const [];

    return [
      Padding(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
        child: Text(
          'Suggestions',
          style: TextStyle(
            color: tokens.primary.withValues(alpha: 0.8),
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
          ),
        ),
      ),
      const SizedBox(height: 8),
      SizedBox(
        height: 34,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          itemCount: suggestions.length,
          separatorBuilder: (_, __) => const SizedBox(width: 8),
          itemBuilder: (_, i) {
            final s = suggestions[i];
            return GestureDetector(
              onTap: onSuggestionTap != null
                  ? () => onSuggestionTap!(s.prefill)
                  : null,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  color: cinematic
                      ? tokens.secondary.withValues(alpha: 0.10)
                      : tokens.primary.withValues(alpha: 0.07),
                  border: Border.all(
                    color: tokens.primary.withValues(alpha: 0.12),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(s.icon,
                        size: 14, color: tokens.primary.withValues(alpha: 0.7)),
                    const SizedBox(width: 6),
                    Text(
                      s.label,
                      style: TextStyle(
                        color: tokens.onSurface.withValues(alpha: 0.7),
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    ];
  }

  /// Generate a concise list of context-aware suggestions.
  static List<_Suggestion> _generateSuggestions(
    List<ConversationSummary> summaries, [
    List<UserFact> facts = const <UserFact>[],
  ]) {
    final suggestions = <_Suggestion>[];

    if (summaries.isEmpty) return suggestions;

    // Suggest continuing recent conversations
    for (final s in summaries.take(2)) {
      if (s.title.isNotEmpty) {
        final short =
            s.title.length > 30 ? '${s.title.substring(0, 27)}...' : s.title;
        suggestions.add(_Suggestion(
          icon: Icons.replay_rounded,
          label: 'Continue: $short',
          prefill: 'Let\'s continue our conversation about ${s.title}.',
        ));
      }
    }

    // Suggest a follow-up if there's a summary with substance
    final withSummary = summaries.where((s) => s.summary.length > 30).toList();
    if (withSummary.isNotEmpty) {
      suggestions.add(_Suggestion(
        icon: Icons.explore_outlined,
        label: 'Dive deeper',
        prefill:
            'Tell me more about what we discussed in "${withSummary.first.title}".',
      ));
    }

    // ── Time-based suggestion ──
    final hour = DateTime.now().hour;
    if (hour >= 7 && hour <= 9) {
      suggestions.add(const _Suggestion(
        icon: Icons.wb_sunny_outlined,
        label: 'Plan my day',
        prefill: 'Help me plan out my day. What should I focus on today?',
      ));
    } else if (hour >= 17 && hour <= 20) {
      suggestions.add(const _Suggestion(
        icon: Icons.self_improvement_outlined,
        label: 'Reflect on today',
        prefill: 'Help me reflect on what I accomplished today.',
      ));
    }

    // ── Memory-based: surface time-relevant UserFacts (deadlines, projects, habits) ──
    for (final fact in facts.take(8)) {
      final c = fact.content.toLowerCase();
      final isRelevant = c.contains('deadline') ||
          c.contains(' due ') ||
          c.contains('by tomorrow') ||
          c.contains('by today') ||
          c.contains('this week') ||
          c.contains('every ') ||
          c.contains('remind') ||
          c.contains('project ') ||
          c.contains('sprint ');
      if (isRelevant) {
        final snippet = fact.content.length > 38
            ? '${fact.content.substring(0, 35)}…'
            : fact.content;
        suggestions.add(_Suggestion(
          icon: Icons.lightbulb_outline_rounded,
          label: 'Recall: $snippet',
          prefill:
              'I mentioned earlier: "${fact.content}". Can you help me with this?',
        ));
        break; // one memory chip max to avoid clutter
      }
    }

    return suggestions.take(5).toList();
  }

  static String _greeting(int hour, String name) {
    final suffix = name.isNotEmpty ? ', $name' : '';
    if (hour < 5) return 'Still up$suffix? 🌙';
    if (hour < 12) return 'Good morning$suffix';
    if (hour < 17) return 'Good afternoon$suffix';
    if (hour < 21) return 'Good evening$suffix';
    return 'Good night$suffix';
  }

  static String _emoji(int hour) {
    if (hour < 5) return '🌙';
    if (hour < 8) return '🌅';
    if (hour < 12) return '☀️';
    if (hour < 17) return '🌤️';
    if (hour < 21) return '🌆';
    return '🌙';
  }

  static String _dateLabel(DateTime d) {
    const days = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
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
    return '${days[d.weekday - 1]}, ${months[d.month - 1]} ${d.day}';
  }

  static const _tips = [
    'Try saying "summarize our last conversation" to Sven.',
    'Long-press a message for quick actions like copy or share.',
    'Use /mode to switch between balanced, creative, and precise.',
    'Swipe left on a conversation to delete it quickly.',
    'Tap the mic button for voice input — hands-free chat!',
    'Pin important conversations so they stay at the top.',
    'Use @web before your query for web-enhanced answers.',
    'Try /remind to set a reminder with Sven.',
    'Export a conversation with the share button in the top bar.',
    'Switch themes in Settings → Appearance for a new look.',
    'Use /templates to save and reuse your favorite prompts.',
    'Sven remembers facts you tell him — try "remember that I..."',
  ];
}

/// A single recent conversation item in the greeting card.
class _RecentItem extends StatelessWidget {
  const _RecentItem({
    required this.summary,
    required this.tokens,
    required this.cinematic,
  });

  final ConversationSummary summary;
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  Widget build(BuildContext context) {
    final age = DateTime.now().difference(summary.updatedAt);
    String timeLabel;
    if (age.inMinutes < 60) {
      timeLabel = '${age.inMinutes}m ago';
    } else if (age.inHours < 24) {
      timeLabel = '${age.inHours}h ago';
    } else {
      timeLabel = '${age.inDays}d ago';
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 3),
      child: Row(
        children: [
          Icon(Icons.chat_bubble_outline_rounded,
              size: 14, color: tokens.onSurface.withValues(alpha: 0.30)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              summary.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: tokens.onSurface.withValues(alpha: 0.75),
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Text(
            timeLabel,
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.30),
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}

/// Internal suggestion model.
class _Suggestion {
  const _Suggestion({
    required this.icon,
    required this.label,
    required this.prefill,
  });

  final IconData icon;
  final String label;
  final String prefill;
}
