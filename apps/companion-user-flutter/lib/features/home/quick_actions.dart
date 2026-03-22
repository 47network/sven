import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';

// ═══════════════════════════════════════════════════════════════════════════
// QuickActionsBar — contextual one-tap shortcuts on the Canvas tab
// ═══════════════════════════════════════════════════════════════════════════

/// Callback fired when the user picks a quick action.
/// [prefill] is the text to seed into a new chat composer.
typedef QuickActionCallback = void Function(String prefill);

class QuickActionsBar extends StatelessWidget {
  const QuickActionsBar({
    super.key,
    required this.tokens,
    required this.visualMode,
    required this.onAction,
  });

  final SvenModeTokens tokens;
  final VisualMode visualMode;
  final QuickActionCallback onAction;

  // ── action definitions ──

  static const _actions = <_QuickAction>[
    _QuickAction(
      icon: Icons.bolt_rounded,
      label: 'Quick question',
      prefillTemplate: '',
    ),
    _QuickAction(
      icon: Icons.content_paste_rounded,
      label: 'Summarise clipboard',
      prefillTemplate: '__clipboard__',
    ),
    _QuickAction(
      icon: Icons.translate_rounded,
      label: 'Translate',
      prefillTemplate: '__translate_clipboard__',
    ),
    _QuickAction(
      icon: Icons.lightbulb_outline_rounded,
      label: 'Brainstorm',
      prefillTemplate: 'Help me brainstorm ideas about ',
    ),
  ];

  Future<void> _handleTap(_QuickAction action) async {
    HapticFeedback.lightImpact();

    String prefill = action.prefillTemplate;

    if (prefill == '__clipboard__') {
      final data = await Clipboard.getData(Clipboard.kTextPlain);
      final clip = data?.text?.trim() ?? '';
      if (clip.isEmpty) {
        prefill = 'Summarise: ';
      } else {
        final truncated =
            clip.length > 500 ? '${clip.substring(0, 500)}…' : clip;
        prefill = 'Summarise this:\n\n$truncated';
      }
    } else if (prefill == '__translate_clipboard__') {
      final data = await Clipboard.getData(Clipboard.kTextPlain);
      final clip = data?.text?.trim() ?? '';
      if (clip.isEmpty) {
        prefill = 'Translate: ';
      } else {
        final truncated =
            clip.length > 500 ? '${clip.substring(0, 500)}…' : clip;
        prefill = 'Translate this to English:\n\n$truncated';
      }
    }

    onAction(prefill);
  }

  @override
  Widget build(BuildContext context) {
    final cinematic = visualMode == VisualMode.cinematic;

    return SizedBox(
      height: 42,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: _actions.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, i) {
          final action = _actions[i];
          return GestureDetector(
            onTap: () => _handleTap(action),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: cinematic
                    ? tokens.primary.withValues(alpha: 0.08)
                    : tokens.primary.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: tokens.primary.withValues(alpha: 0.15),
                  width: 1,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(action.icon, size: 16, color: tokens.primary),
                  const SizedBox(width: 6),
                  Text(
                    action.label,
                    style: TextStyle(
                      color: tokens.primary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.3,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _QuickAction {
  const _QuickAction({
    required this.icon,
    required this.label,
    required this.prefillTemplate,
  });

  final IconData icon;
  final String label;
  final String prefillTemplate;
}
