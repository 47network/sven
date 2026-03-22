// ═══════════════════════════════════════════════════════════════════════════
// SvenEntityPage — pick Sven's animated form (orb / robot / human / animal)
//
// Redesigned Sprint 19 to match the Magic Mirror device-control visual
// language: tokens.scaffold bg, structured card layout, status bar,
// section headers, capability-chip traits, action-button grid.
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import '../memory/sven_avatar.dart';

class SvenEntityPage extends StatefulWidget {
  const SvenEntityPage({
    super.key,
    required this.currentMode,
    required this.onChanged,
    required this.visualMode,
    required this.motionLevel,
    this.personality = VoicePersonality.friendly,
  });

  final AvatarMode currentMode;
  final ValueChanged<AvatarMode> onChanged;
  final VisualMode visualMode;
  final MotionLevel motionLevel;
  final VoicePersonality personality;

  @override
  State<SvenEntityPage> createState() => _SvenEntityPageState();
}

class _SvenEntityPageState extends State<SvenEntityPage>
    with SingleTickerProviderStateMixin {
  late AvatarMode _selected;
  late AnimationController _pulseAnim;

  @override
  void initState() {
    super.initState();
    _selected = widget.currentMode;
    _pulseAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseAnim.dispose();
    super.dispose();
  }

  void _pick(AvatarMode mode) {
    HapticFeedback.selectionClick();
    setState(() => _selected = mode);
    widget.onChanged(mode);
  }

  AvatarMode _svensChoice(VoicePersonality personality) {
    switch (personality) {
      case VoicePersonality.friendly:
        return AvatarMode.human;
      case VoicePersonality.professional:
        return AvatarMode.robot;
      case VoicePersonality.casual:
        return AvatarMode.animal;
      case VoicePersonality.mentor:
        return AvatarMode.orb;
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('Sven\'s Form'),
        actions: [
          IconButton(
            icon: const Icon(Icons.auto_awesome_rounded),
            tooltip: 'Let Sven choose',
            onPressed: () => _pick(_svensChoice(widget.personality)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
        children: [
          // ── Hero identity card ──
          _EntityInfoCard(
            mode: _selected,
            tokens: tokens,
            cinematic: cinematic,
            visualMode: widget.visualMode,
            motionLevel: widget.motionLevel,
            pulseAnim: _pulseAnim,
          ),
          const SizedBox(height: 16),

          // ── Status bar ──
          _EntityStatusBar(
            selected: _selected,
            tokens: tokens,
          ),
          const SizedBox(height: 20),

          // ── Quick actions ──
          _EntityQuickActions(
            tokens: tokens,
            cinematic: cinematic,
            onLetSvenChoose: () => _pick(_svensChoice(widget.personality)),
            onRandomize: () {
              final modes = AvatarMode.values.toList()..shuffle();
              _pick(modes.first);
            },
          ),
          const SizedBox(height: 24),

          // ── Available forms ──
          _SectionHeader('Available Forms', tokens: tokens),
          const SizedBox(height: 10),
          ...AvatarMode.values.map((mode) => _EntityFormCard(
                mode: mode,
                isSelected: _selected == mode,
                tokens: tokens,
                cinematic: cinematic,
                onTap: () => _pick(mode),
              )),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Hero identity card — matches _DeviceInfoCard layout
// ═══════════════════════════════════════════════════════════════════════════

class _EntityInfoCard extends StatelessWidget {
  const _EntityInfoCard({
    required this.mode,
    required this.tokens,
    required this.cinematic,
    required this.visualMode,
    required this.motionLevel,
    required this.pulseAnim,
  });

  final AvatarMode mode;
  final SvenModeTokens tokens;
  final bool cinematic;
  final VisualMode visualMode;
  final MotionLevel motionLevel;
  final Animation<double> pulseAnim;

  @override
  Widget build(BuildContext context) {
    final accent = Color(mode.gradientArgb[1]);

    return Card(
      elevation: cinematic ? 0 : 2,
      color: cinematic ? tokens.card : null,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: cinematic
            ? BorderSide(color: tokens.frame.withValues(alpha: 0.2))
            : BorderSide.none,
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // ── Animated avatar with glow ring ──
            AnimatedBuilder(
              animation: pulseAnim,
              builder: (_, child) => Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color:
                        accent.withValues(alpha: 0.2 + 0.2 * pulseAnim.value),
                    width: 2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: accent.withValues(
                          alpha: 0.08 + 0.1 * pulseAnim.value),
                      blurRadius: 24,
                      spreadRadius: 4,
                    ),
                  ],
                ),
                child: child,
              ),
              child: SvenAvatar(
                visualMode: visualMode,
                motionLevel: motionLevel,
                mood: SvenMood.happy,
                size: 120,
                avatarMode: mode,
              ),
            ),
            const SizedBox(height: 16),

            // ── Active form badge ──
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: Colors.green,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                          color: Colors.green.withValues(alpha: 0.4),
                          blurRadius: 4),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                const Text(
                  'ACTIVE FORM',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Colors.green,
                    letterSpacing: 1.2,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // ── Name ──
            Text(
              '${mode.icon}  ${mode.entityName}',
              style: TextStyle(
                color: tokens.onSurface,
                fontSize: 22,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              mode.entityDescription,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: tokens.onSurface.withValues(alpha: 0.6),
                fontSize: 13,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 14),

            // ── Key-value details ──
            _keyValue('Form Type', mode.entityName, tokens),
            _keyValue('Personality', mode.name.toUpperCase(), tokens),
            _keyValue('Traits', '${mode.traits.length} attributes', tokens),

            // ── Trait chips (device capability style) ──
            if (mode.traits.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                alignment: WrapAlignment.center,
                children: mode.traits.map((trait) {
                  return Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(6),
                      color: tokens.primary.withValues(alpha: 0.08),
                      border: Border.all(
                          color: tokens.primary.withValues(alpha: 0.15),
                          width: 0.5),
                    ),
                    child: Text(
                      trait,
                      style: TextStyle(
                        color: tokens.onSurface.withValues(alpha: 0.65),
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }

  static Widget _keyValue(String key, String value, SvenModeTokens t) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Text(key,
              style: TextStyle(
                fontSize: 13,
                color: t.onSurface.withValues(alpha: 0.5),
              )),
          const Spacer(),
          Text(value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: t.onSurface,
              )),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Status bar — matches _DeviceStatusBar
// ═══════════════════════════════════════════════════════════════════════════

class _EntityStatusBar extends StatelessWidget {
  const _EntityStatusBar({required this.selected, required this.tokens});
  final AvatarMode selected;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: tokens.card.withValues(alpha: 0.6),
        border: Border.all(
            color: tokens.primary.withValues(alpha: 0.15), width: 0.5),
      ),
      child: Row(
        children: [
          // Current form chip
          _StatusDot(
            label: selected.entityName,
            color: Colors.green,
            tokens: tokens,
          ),
          const SizedBox(width: 12),
          // Available forms count
          _StatusDot(
            label: '${AvatarMode.values.length} Forms',
            color: tokens.primary,
            tokens: tokens,
          ),
          const Spacer(),
          Text(
            'v1.0',
            style: TextStyle(
                color: tokens.onSurface.withValues(alpha: 0.4), fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _StatusDot extends StatelessWidget {
  const _StatusDot(
      {required this.label, required this.color, required this.tokens});
  final String label;
  final Color color;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color,
            boxShadow: [
              BoxShadow(color: color.withValues(alpha: 0.4), blurRadius: 4),
            ],
          ),
        ),
        const SizedBox(width: 5),
        Text(label,
            style: TextStyle(
                color: tokens.onSurface.withValues(alpha: 0.7),
                fontSize: 12,
                fontWeight: FontWeight.w500)),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Quick Actions — matches _QuickActions / _ActionButton
// ═══════════════════════════════════════════════════════════════════════════

class _EntityQuickActions extends StatelessWidget {
  const _EntityQuickActions({
    required this.tokens,
    required this.cinematic,
    required this.onLetSvenChoose,
    required this.onRandomize,
  });

  final SvenModeTokens tokens;
  final bool cinematic;
  final VoidCallback onLetSvenChoose;
  final VoidCallback onRandomize;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader('Quick Actions', tokens: tokens),
        const SizedBox(height: 10),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            _ActionBtn(
              icon: Icons.auto_awesome_rounded,
              label: 'Auto',
              tokens: tokens,
              onPressed: onLetSvenChoose,
            ),
            _ActionBtn(
              icon: Icons.shuffle_rounded,
              label: 'Random',
              tokens: tokens,
              onPressed: onRandomize,
            ),
          ],
        ),
      ],
    );
  }
}

class _ActionBtn extends StatelessWidget {
  const _ActionBtn({
    required this.icon,
    required this.label,
    required this.tokens,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final SvenModeTokens tokens;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 80,
      child: Column(
        children: [
          Material(
            color: tokens.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              onTap: onPressed,
              borderRadius: BorderRadius.circular(14),
              child: SizedBox(
                width: 56,
                height: 56,
                child: Icon(icon, size: 26, color: tokens.primary),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: tokens.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Form card — matches _DeviceCard layout (circle icon + info + chevron)
// ═══════════════════════════════════════════════════════════════════════════

class _EntityFormCard extends StatelessWidget {
  const _EntityFormCard({
    required this.mode,
    required this.isSelected,
    required this.tokens,
    required this.cinematic,
    required this.onTap,
  });

  final AvatarMode mode;
  final bool isSelected;
  final SvenModeTokens tokens;
  final bool cinematic;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final accent = Color(mode.gradientArgb[1]);
    final statusColor = isSelected ? Colors.green : Colors.grey;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOutCubic,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              color: tokens.card.withValues(alpha: isSelected ? 0.8 : 0.5),
              border: Border.all(
                color: isSelected
                    ? accent.withValues(alpha: 0.35)
                    : tokens.primary.withValues(alpha: 0.10),
                width: isSelected ? 1.0 : 0.5,
              ),
            ),
            child: Row(
              children: [
                // ── Icon circle with status glow ──
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: statusColor.withValues(alpha: 0.12),
                    border: Border.all(
                        color: statusColor.withValues(alpha: 0.3), width: 1),
                  ),
                  child: Center(
                    child:
                        Text(mode.icon, style: const TextStyle(fontSize: 20)),
                  ),
                ),
                const SizedBox(width: 14),

                // ── Info ──
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        mode.entityName,
                        style: TextStyle(
                          color: tokens.onSurface,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          Container(
                            width: 7,
                            height: 7,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: statusColor,
                            ),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            isSelected ? 'ACTIVE' : 'AVAILABLE',
                            style: TextStyle(
                              color: tokens.onSurface.withValues(alpha: 0.5),
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.8,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Text(
                            mode.entityDescription,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: tokens.onSurface.withValues(alpha: 0.4),
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
                      if (mode.traits.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 4,
                          runSpacing: 4,
                          children: mode.traits
                              .take(5)
                              .map((trait) => Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(6),
                                      color: tokens.primary
                                          .withValues(alpha: 0.08),
                                      border: Border.all(
                                          color: tokens.primary
                                              .withValues(alpha: 0.15),
                                          width: 0.4),
                                    ),
                                    child: Text(
                                      trait,
                                      style: TextStyle(
                                        color: tokens.onSurface
                                            .withValues(alpha: 0.6),
                                        fontSize: 9,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ))
                              .toList(),
                        ),
                      ],
                    ],
                  ),
                ),

                // ── Check or chevron ──
                isSelected
                    ? const Icon(Icons.check_circle_rounded,
                        color: Colors.green, size: 20)
                    : Icon(Icons.chevron_right_rounded,
                        color: tokens.onSurface.withValues(alpha: 0.25),
                        size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Section header — matches device_control_page _SectionHeader
// ═══════════════════════════════════════════════════════════════════════════

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.title, {required this.tokens});
  final String title;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.3,
        color: tokens.onSurface.withValues(alpha: 0.7),
      ),
    );
  }
}
