import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../app/sven_tokens.dart';
import '../../app/app_models.dart';

// ═══════════════════════════════════════════════════════════════════════════
// TutorialService — tracks first-conversation tutorial progress
// ═══════════════════════════════════════════════════════════════════════════

class TutorialService extends ChangeNotifier {
  TutorialService() {
    _load();
  }

  static const _kCompleted = 'sven.tutorial.completed';
  static const _kStep = 'sven.tutorial.step';

  bool _completed = false;
  int _step = 0;
  bool _loaded = false;

  bool get completed => _completed;
  int get step => _step;
  bool get loaded => _loaded;

  /// True if the tutorial should be shown (not yet completed).
  bool get shouldShowTutorial => _loaded && !_completed;

  /// Total number of tutorial steps.
  static const totalSteps = 4;

  /// Advance to the next step. If at the last step, mark completed.
  Future<void> advance() async {
    if (_step >= totalSteps - 1) {
      await markCompleted();
      return;
    }
    _step++;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_kStep, _step);
  }

  /// Skip/dismiss the tutorial entirely.
  Future<void> markCompleted() async {
    _completed = true;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kCompleted, true);
  }

  /// Reset for testing/onboarding replay.
  Future<void> reset() async {
    _completed = false;
    _step = 0;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kCompleted);
    await prefs.remove(_kStep);
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    _completed = prefs.getBool(_kCompleted) ?? false;
    _step = prefs.getInt(_kStep) ?? 0;
    _loaded = true;
    notifyListeners();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Tutorial step definitions
// ═══════════════════════════════════════════════════════════════════════════

class TutorialStep {
  const TutorialStep({
    required this.title,
    required this.body,
    required this.icon,
    this.suggestion,
  });

  final String title;
  final String body;
  final IconData icon;

  /// Optional suggested message the user can tap to send.
  final String? suggestion;
}

const tutorialSteps = <TutorialStep>[
  TutorialStep(
    title: 'Welcome to Sven! 👋',
    body: 'I\'m your personal AI companion. Type anything below '
        'to start our first conversation.',
    icon: Icons.waving_hand_rounded,
    suggestion: 'Hey Sven, what can you help me with?',
  ),
  TutorialStep(
    title: 'Voice mode 🎤',
    body: 'Tap the microphone button to talk to me hands-free. '
        'I\'ll listen, think, and respond aloud.',
    icon: Icons.mic_rounded,
  ),
  TutorialStep(
    title: 'I remember things 🧠',
    body: 'Tell me about yourself and I\'ll remember it across '
        'conversations. Try: "Remember that I prefer Python."',
    icon: Icons.psychology_rounded,
    suggestion: 'Remember that I prefer dark mode and concise answers.',
  ),
  TutorialStep(
    title: 'Quick tips ⚡',
    body: 'Use /help for slash commands, long-press messages for '
        'actions, and swipe left on the chat list to delete.',
    icon: Icons.tips_and_updates_rounded,
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// TutorialBanner — shown at the top of a new conversation
// ═══════════════════════════════════════════════════════════════════════════

class TutorialBanner extends StatelessWidget {
  const TutorialBanner({
    super.key,
    required this.service,
    required this.visualMode,
    this.onSuggestionTap,
  });

  final TutorialService service;
  final VisualMode visualMode;
  final void Function(String text)? onSuggestionTap;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: service,
      builder: (context, _) {
        if (!service.shouldShowTutorial) return const SizedBox.shrink();

        final step =
            tutorialSteps[service.step.clamp(0, tutorialSteps.length - 1)];
        final tokens = SvenTokens.forMode(visualMode);
        final cinematic = visualMode == VisualMode.cinematic;
        final progress = (service.step + 1) / TutorialService.totalSteps;

        return Container(
          margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color:
                cinematic ? tokens.card.withValues(alpha: 0.9) : tokens.surface,
            border: Border.all(
              color: tokens.primary.withValues(alpha: 0.2),
            ),
            boxShadow: [
              BoxShadow(
                color: tokens.primary.withValues(alpha: cinematic ? 0.1 : 0.05),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Progress bar
              ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(16),
                ),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 3,
                  backgroundColor: tokens.onSurface.withValues(alpha: 0.06),
                  valueColor: AlwaysStoppedAnimation(tokens.primary),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: tokens.primary.withValues(alpha: 0.12),
                      ),
                      child: Icon(step.icon, size: 18, color: tokens.primary),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            step.title,
                            style: TextStyle(
                              color: tokens.onSurface,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            step.body,
                            style: TextStyle(
                              color: tokens.onSurface.withValues(alpha: 0.6),
                              fontSize: 12,
                              height: 1.4,
                            ),
                          ),
                          if (step.suggestion != null) ...[
                            const SizedBox(height: 8),
                            GestureDetector(
                              onTap: () {
                                onSuggestionTap?.call(step.suggestion!);
                                service.advance();
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(12),
                                  color: tokens.primary.withValues(alpha: 0.08),
                                  border: Border.all(
                                    color:
                                        tokens.primary.withValues(alpha: 0.15),
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.send_rounded,
                                        size: 12, color: tokens.primary),
                                    const SizedBox(width: 6),
                                    Flexible(
                                      child: Text(
                                        step.suggestion!,
                                        style: TextStyle(
                                          color: tokens.primary,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w500,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    Column(
                      children: [
                        // Step indicator
                        Text(
                          '${service.step + 1}/${TutorialService.totalSteps}',
                          style: TextStyle(
                            color: tokens.onSurface.withValues(alpha: 0.3),
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        // Next / Skip buttons
                        GestureDetector(
                          onTap: service.advance,
                          child: Text(
                            service.step < TutorialService.totalSteps - 1
                                ? 'Next'
                                : 'Done',
                            style: TextStyle(
                              color: tokens.primary,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        GestureDetector(
                          onTap: service.markCompleted,
                          child: Text(
                            'Skip',
                            style: TextStyle(
                              color: tokens.onSurface.withValues(alpha: 0.3),
                              fontSize: 11,
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
        );
      },
    );
  }
}
