// ═══════════════════════════════════════════════════════════════════════════
// Sven Companion — Widgetbook component catalogue
//
// Run with:
//   flutter run -t lib/widgetbook_main.dart
//
// Browse all UI atoms and organisms with live knobs across Classic and
// Cinematic themes.  No services or providers required — purely visual.
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:widgetbook/widgetbook.dart';

import 'app/app_models.dart';
import 'app/sven_theme.dart';
import 'app/sven_tokens.dart';
import 'features/home/daily_greeting.dart';
import 'features/home/quick_actions.dart';
import 'features/memory/sven_avatar.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

void main() => runApp(const WidgetbookShell());

// ─────────────────────────────────────────────────────────────────────────────
// Shell
// ─────────────────────────────────────────────────────────────────────────────

class WidgetbookShell extends StatelessWidget {
  const WidgetbookShell({super.key});

  @override
  Widget build(BuildContext context) {
    return Widgetbook.material(
      // ── Addons ──────────────────────────────────────────────────────────────
      addons: [
        MaterialThemeAddon(
          themes: [
            WidgetbookTheme(
              name: 'Classic',
              data: buildSvenTheme(VisualMode.classic),
            ),
            WidgetbookTheme(
              name: 'Cinematic',
              data: buildSvenTheme(VisualMode.cinematic),
            ),
          ],
        ),
        TextScaleAddon(
          min: 0.8,
          max: 2.0,
          divisions: 12,
        ),
        AlignmentAddon(),
      ],

      // ── Component tree ───────────────────────────────────────────────────
      directories: [
        // ── Foundation ────────────────────────────────────────────────────
        WidgetbookCategory(
          name: 'Foundation',
          children: [
            WidgetbookComponent(
              name: 'Color Tokens',
              useCases: [
                WidgetbookUseCase(
                  name: 'Classic palette',
                  builder: (_) =>
                      const _TokenPalettePreview(mode: VisualMode.classic),
                ),
                WidgetbookUseCase(
                  name: 'Cinematic palette',
                  builder: (_) =>
                      const _TokenPalettePreview(mode: VisualMode.cinematic),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'Typography',
              useCases: [
                WidgetbookUseCase(
                  name: 'Classic type scale',
                  builder: (_) =>
                      const _TypographyPreview(mode: VisualMode.classic),
                ),
                WidgetbookUseCase(
                  name: 'Cinematic type scale',
                  builder: (_) =>
                      const _TypographyPreview(mode: VisualMode.cinematic),
                ),
              ],
            ),
          ],
        ),

        // ── Atoms ─────────────────────────────────────────────────────────
        WidgetbookCategory(
          name: 'Atoms',
          children: [
            WidgetbookComponent(
              name: 'SvenAvatar',
              useCases: [
                WidgetbookUseCase(
                  name: 'Idle — Classic',
                  builder: (_) => const _AvatarPreview(
                    visualMode: VisualMode.classic,
                    mood: SvenMood.idle,
                  ),
                ),
                WidgetbookUseCase(
                  name: 'Thinking — Classic',
                  builder: (_) => const _AvatarPreview(
                    visualMode: VisualMode.classic,
                    mood: SvenMood.thinking,
                  ),
                ),
                WidgetbookUseCase(
                  name: 'Listening — Classic',
                  builder: (_) => const _AvatarPreview(
                    visualMode: VisualMode.classic,
                    mood: SvenMood.listening,
                  ),
                ),
                WidgetbookUseCase(
                  name: 'Speaking — Cinematic',
                  builder: (_) => const _AvatarPreview(
                    visualMode: VisualMode.cinematic,
                    mood: SvenMood.speaking,
                  ),
                ),
                WidgetbookUseCase(
                  name: 'Happy — Cinematic',
                  builder: (_) => const _AvatarPreview(
                    visualMode: VisualMode.cinematic,
                    mood: SvenMood.happy,
                  ),
                ),
                WidgetbookUseCase(
                  name: 'Interactive (knobs)',
                  builder: (context) {
                    final mood = context.knobs.list<SvenMood>(
                      label: 'Mood',
                      options: SvenMood.values,
                      initialOption: SvenMood.idle,
                      labelBuilder: (m) => m.name,
                    );
                    final mode = context.knobs.list<VisualMode>(
                      label: 'Visual Mode',
                      options: VisualMode.values,
                      initialOption: VisualMode.classic,
                      labelBuilder: (m) => m.name,
                    );
                    final motion = context.knobs.list<MotionLevel>(
                      label: 'Motion Level',
                      options: MotionLevel.values,
                      initialOption: MotionLevel.full,
                      labelBuilder: (m) => m.name,
                    );
                    final size = context.knobs.double.slider(
                      label: 'Size (dp)',
                      initialValue: 80,
                      min: 40,
                      max: 200,
                    );
                    return _AvatarPreview(
                      visualMode: mode,
                      mood: mood,
                      motionLevel: motion,
                      size: size,
                    );
                  },
                ),
              ],
            ),
          ],
        ),

        // ── Organisms ─────────────────────────────────────────────────────
        WidgetbookCategory(
          name: 'Organisms',
          children: [
            WidgetbookComponent(
              name: 'QuickActionsBar',
              useCases: [
                WidgetbookUseCase(
                  name: 'Classic',
                  builder: (_) =>
                      const _QuickActionsPreview(mode: VisualMode.classic),
                ),
                WidgetbookUseCase(
                  name: 'Cinematic',
                  builder: (_) =>
                      const _QuickActionsPreview(mode: VisualMode.cinematic),
                ),
              ],
            ),
            WidgetbookComponent(
              name: 'DailyGreeting',
              useCases: [
                WidgetbookUseCase(
                  name: 'Classic',
                  builder: (_) =>
                      const _GreetingPreview(mode: VisualMode.classic),
                ),
                WidgetbookUseCase(
                  name: 'Cinematic',
                  builder: (_) =>
                      const _GreetingPreview(mode: VisualMode.cinematic),
                ),
                WidgetbookUseCase(
                  name: 'Interactive (knobs)',
                  builder: (context) {
                    final mode = context.knobs.list<VisualMode>(
                      label: 'Visual Mode',
                      options: VisualMode.values,
                      initialOption: VisualMode.classic,
                      labelBuilder: (m) => m.name,
                    );
                    return _GreetingPreview(mode: mode);
                  },
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Foundation helpers
// ─────────────────────────────────────────────────────────────────────────────

class _TokenPalettePreview extends StatelessWidget {
  const _TokenPalettePreview({required this.mode});

  final VisualMode mode;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(mode);
    final swatches = <_Swatch>[
      _Swatch('primary', tokens.primary),
      _Swatch('secondary', tokens.secondary),
      _Swatch('surface', tokens.surface),
      _Swatch('onSurface', tokens.onSurface),
      _Swatch('scaffold', tokens.scaffold),
      _Swatch('onScaffold', tokens.onScaffold),
      _Swatch('card', tokens.card),
      _Swatch('frame', tokens.frame),
      _Swatch('glow', tokens.glow),
    ];

    return Container(
      color: tokens.scaffold,
      padding: const EdgeInsets.all(24),
      child: Wrap(
        spacing: 16,
        runSpacing: 16,
        children: swatches
            .map(
              (s) => Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: s.color,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: tokens.frame.withValues(alpha: 0.6),
                        width: 1,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    s.name,
                    style: TextStyle(
                      color: tokens.onScaffold,
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Text(
                    '#${_hexRGB(s.color)}',
                    style: TextStyle(
                      color: tokens.onScaffold.withValues(alpha: 0.5),
                      fontSize: 9,
                    ),
                  ),
                ],
              ),
            )
            .toList(),
      ),
    );
  }
}

class _Swatch {
  const _Swatch(this.name, this.color);

  final String name;
  final Color color;
}

/// Returns a 6-char upper-case hex RGB string for [color].
/// Uses integer component accessors available since Flutter 1.x.
String _hexRGB(Color c) {
  final r = c.red.toRadixString(16).padLeft(2, '0');
  final g = c.green.toRadixString(16).padLeft(2, '0');
  final b = c.blue.toRadixString(16).padLeft(2, '0');
  return '$r$g$b'.toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────

class _TypographyPreview extends StatelessWidget {
  const _TypographyPreview({required this.mode});

  final VisualMode mode;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(mode);
    final tt = Theme.of(context).textTheme;
    final rows = <_TypeRow>[
      _TypeRow('displaySmall', tt.displaySmall),
      _TypeRow('headlineSmall', tt.headlineSmall),
      _TypeRow('titleMedium', tt.titleMedium),
      _TypeRow('bodyLarge', tt.bodyLarge),
      _TypeRow('bodyMedium', tt.bodyMedium),
      _TypeRow('bodySmall', tt.bodySmall),
      _TypeRow('labelLarge', tt.labelLarge),
    ];

    return Container(
      color: tokens.scaffold,
      padding: const EdgeInsets.all(24),
      child: ListView(
        shrinkWrap: true,
        children: rows
            .map(
              (r) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      r.label,
                      style: TextStyle(
                        color: tokens.onScaffold.withValues(alpha: 0.5),
                        fontSize: 10,
                        letterSpacing: 1.0,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'The quick brown fox jumps',
                      style: (r.style ?? const TextStyle())
                          .copyWith(color: tokens.onScaffold),
                    ),
                    Divider(
                      height: 20,
                      color: tokens.frame.withValues(alpha: 0.5),
                    ),
                  ],
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _TypeRow {
  const _TypeRow(this.label, this.style);

  final String label;
  final TextStyle? style;
}

// ─────────────────────────────────────────────────────────────────────────────
// Atom helpers
// ─────────────────────────────────────────────────────────────────────────────

class _AvatarPreview extends StatelessWidget {
  const _AvatarPreview({
    required this.visualMode,
    required this.mood,
    this.motionLevel = MotionLevel.full,
    this.size = 80,
  });

  final VisualMode visualMode;
  final SvenMood mood;
  final MotionLevel motionLevel;
  final double size;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    return Container(
      color: tokens.scaffold,
      alignment: Alignment.center,
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SvenAvatar(
            visualMode: visualMode,
            motionLevel: motionLevel,
            mood: mood,
            size: size,
          ),
          const SizedBox(height: 16),
          Text(
            'mood: ${mood.name} · size: ${size.toStringAsFixed(0)}dp',
            style: TextStyle(
              color: tokens.onScaffold.withValues(alpha: 0.5),
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Organism helpers
// ─────────────────────────────────────────────────────────────────────────────

class _QuickActionsPreview extends StatelessWidget {
  const _QuickActionsPreview({required this.mode});

  final VisualMode mode;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(mode);
    return Container(
      color: tokens.scaffold,
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: QuickActionsBar(
        tokens: tokens,
        visualMode: mode,
        onAction: (_) {},
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _GreetingPreview extends StatelessWidget {
  const _GreetingPreview({required this.mode});

  final VisualMode mode;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(mode);
    return Container(
      color: tokens.scaffold,
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: DailyGreeting(
        visualMode: mode,
        tokens: tokens,
        // memoryService omitted — null shows blank name + no summaries
        onDismiss: () {},
        onSuggestionTap: (_) {},
      ),
    );
  }
}
