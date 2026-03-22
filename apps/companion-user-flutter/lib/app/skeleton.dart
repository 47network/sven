import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'app_models.dart';
import 'sven_tokens.dart';

// ===========================================================================
// Premium skeleton loading — two first-class visual modes
//
// Classic:    Wide diagonal shimmer sweep over all shapes in unison
//             (ChatGPT / Gemini grade — clean, subtle, polished).
// Cinematic:  Holographic cyan sweep with glow-bordered cards,
//             HUD-style (Iron Man 2026 grade).
//
// Architecture:
//   _ShimmerHost (one AnimationController per skeleton)
//     → _ShimmerProvider (InheritedWidget, broadcasts progress 0→1)
//       → _Bone widgets read progress, each paints its own gradient
//   Card decorations live outside the shader so borders stay sharp.
// ===========================================================================

// ---------------------------------------------------------------------------
// InheritedWidget — delivers animation progress + mode to _Bone widgets
// ---------------------------------------------------------------------------
class _ShimmerProvider extends InheritedWidget {
  const _ShimmerProvider({
    required this.t,
    required this.visualMode,
    required this.motionLevel,
    required super.child,
  });

  final double t;
  final VisualMode visualMode;
  final MotionLevel motionLevel;

  static _ShimmerProvider of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<_ShimmerProvider>()!;

  @override
  bool updateShouldNotify(_ShimmerProvider old) => old.t != t;
}

// ---------------------------------------------------------------------------
// ShimmerHost — single AnimationController, wraps children with provider
// ---------------------------------------------------------------------------
class _ShimmerHost extends StatefulWidget {
  const _ShimmerHost({
    required this.child,
    required this.visualMode,
    required this.motionLevel,
  });

  final Widget child;
  final VisualMode visualMode;
  final MotionLevel motionLevel;

  @override
  State<_ShimmerHost> createState() => _ShimmerHostState();
}

class _ShimmerHostState extends State<_ShimmerHost>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    final baseMs = widget.visualMode == VisualMode.cinematic ? 1200 : 1500;
    final ms = widget.motionLevel == MotionLevel.reduced
        ? (baseMs * 1.5).round()
        : baseMs;
    _ctrl =
        AnimationController(vsync: this, duration: Duration(milliseconds: ms));
    if (widget.motionLevel != MotionLevel.off) _ctrl.repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _ctrl,
        builder: (_, child) => _ShimmerProvider(
          t: _ctrl.value,
          visualMode: widget.visualMode,
          motionLevel: widget.motionLevel,
          child: child!,
        ),
        child: widget.child,
      );
}

// ---------------------------------------------------------------------------
// Bone — reads shimmer progress, paints a diagonal gradient in lock-step
// ---------------------------------------------------------------------------
class _Bone extends StatelessWidget {
  const _Bone({
    required this.width,
    required this.height,
    this.radius = 8,
    this.borderRadius,
  });

  final double width;
  final double height;
  final double radius;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    final p = _ShimmerProvider.of(context);
    final tokens = SvenTokens.forMode(p.visualMode);
    final cinematic = p.visualMode == VisualMode.cinematic;

    final base = cinematic
        ? tokens.primary.withValues(alpha: 0.10)
        : tokens.onSurface.withValues(alpha: 0.08);
    final mid = cinematic
        ? tokens.primary.withValues(alpha: 0.32)
        : tokens.onSurface.withValues(alpha: 0.16);
    final highlight = cinematic
        ? tokens.primary.withValues(alpha: 0.55)
        : tokens.onSurface.withValues(alpha: 0.24);

    // slideX: -1.5 → +1.5, pulling the band across the bounds
    final slideX = -1.5 + 3.0 * p.t;
    final br = borderRadius ?? BorderRadius.circular(radius);

    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: br,
        gradient: LinearGradient(
          colors: [base, mid, highlight, highlight, mid, base],
          stops: const [0.0, 0.25, 0.4, 0.6, 0.75, 1.0],
          begin: Alignment(slideX - 0.7, -0.35),
          end: Alignment(slideX + 0.7, 0.35),
          tileMode: TileMode.clamp,
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// GlowCard — cinematic container with subtle animated cyan border + shadow
// ---------------------------------------------------------------------------
class _GlowCard extends StatelessWidget {
  const _GlowCard({required this.child, required this.tokens});

  final Widget child;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
        decoration: BoxDecoration(
          color: tokens.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: tokens.primary.withValues(alpha: 0.12),
            width: 0.8,
          ),
          boxShadow: [
            BoxShadow(
              color: tokens.primary.withValues(alpha: 0.07),
              blurRadius: 16,
            ),
          ],
        ),
        child: child,
      );
}

// ---------------------------------------------------------------------------
// Typing indicator — 3 dots with staggered sinusoidal pulse (ChatGPT style)
// ---------------------------------------------------------------------------
class _TypingDots extends StatefulWidget {
  const _TypingDots({required this.motionLevel, required this.color});

  final MotionLevel motionLevel;
  final Color color;

  @override
  State<_TypingDots> createState() => _TypingDotsState();
}

class _TypingDotsState extends State<_TypingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    if (widget.motionLevel != MotionLevel.off) _ctrl.repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.motionLevel == MotionLevel.off) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(3, (_) => _dot(0.55)),
      );
    }
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(3, (i) {
          final phase = (_ctrl.value + i * 0.25) % 1.0;
          final opacity =
              0.25 + 0.75 * (0.5 + 0.5 * math.sin(phase * 2 * math.pi));
          return _dot(opacity);
        }),
      ),
    );
  }

  Widget _dot(double opacity) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 3),
        child: Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(
            color: widget.color.withValues(alpha: opacity),
            shape: BoxShape.circle,
          ),
        ),
      );
}

// ===========================================================================
// PUBLIC: ChatListSkeleton
// ===========================================================================

/// Premium skeleton for the chat-list screen.
///
/// Classic — clean grey shimmer sweep (ChatGPT / Gemini grade).
/// Cinematic — cyan holographic sweep inside glow-bordered cards.
class ChatListSkeleton extends StatelessWidget {
  const ChatListSkeleton({
    super.key,
    this.rows = 6,
    this.visualMode = VisualMode.classic,
    this.motionLevel = MotionLevel.full,
  });

  final int rows;
  final VisualMode visualMode;
  final MotionLevel motionLevel;

  // Vary subtitle widths for realism.
  static const _subW = [180.0, 140.0, 210.0, 120.0, 160.0, 195.0];

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    final cinematic = visualMode == VisualMode.cinematic;

    return Semantics(
      label: 'Loading conversations',
      child: Container(
        color: cinematic ? tokens.scaffold : null,
        child: _ShimmerHost(
          visualMode: visualMode,
          motionLevel: motionLevel,
          child: ListView.separated(
            physics: const NeverScrollableScrollPhysics(),
            padding: EdgeInsets.only(top: cinematic ? 6 : 0),
            itemCount: rows,
            separatorBuilder: (_, __) => cinematic
                ? const SizedBox(height: 2)
                : const Divider(height: 1, indent: 72),
            itemBuilder: (_, i) {
              final subWidth = _subW[i % _subW.length];
              final row = Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: cinematic ? 14 : 16,
                  vertical: cinematic ? 10 : 14,
                ),
                child: Row(
                  children: [
                    // Avatar
                    const _Bone(width: 46, height: 46, radius: 23),
                    const SizedBox(width: 14),
                    // Title + subtitle
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const _Bone(
                              width: double.infinity, height: 14, radius: 5),
                          const SizedBox(height: 8),
                          _Bone(width: subWidth, height: 11, radius: 4),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Timestamp placeholder
                    const _Bone(width: 34, height: 10, radius: 4),
                  ],
                ),
              );
              return cinematic ? _GlowCard(tokens: tokens, child: row) : row;
            },
          ),
        ),
      ),
    );
  }
}

// ===========================================================================
// PUBLIC: ChatThreadSkeleton
// ===========================================================================

/// Premium skeleton for a chat thread — message bubbles + typing indicator.
///
/// Classic — subtle grey shimmer sweep.
/// Cinematic — cyan glow sweep, bordered bubbles, HUD-style dots.
class ChatThreadSkeleton extends StatelessWidget {
  const ChatThreadSkeleton({
    super.key,
    this.visualMode = VisualMode.classic,
    this.motionLevel = MotionLevel.full,
  });

  final VisualMode visualMode;
  final MotionLevel motionLevel;

  static const _bubbles = [
    (isUser: false, w: 260.0, h: 52.0),
    (isUser: true, w: 180.0, h: 40.0),
    (isUser: false, w: 300.0, h: 68.0),
    (isUser: false, w: 220.0, h: 40.0),
    (isUser: true, w: 150.0, h: 40.0),
  ];

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    final cinematic = visualMode == VisualMode.cinematic;

    return Semantics(
      label: 'Loading messages',
      child: Container(
        color: cinematic ? tokens.scaffold : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Shimmer-animated message placeholders.
              _ShimmerHost(
                visualMode: visualMode,
                motionLevel: motionLevel,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final b in _bubbles)
                      _BubbleBone(
                        isUser: b.isUser,
                        width: b.w,
                        height: b.h,
                        visualMode: visualMode,
                        tokens: tokens,
                      ),
                  ],
                ),
              ),
              // Typing indicator — outside shimmer, separate animation.
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: Container(
                  margin: const EdgeInsets.only(left: 16),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: cinematic
                        ? tokens.card
                        : tokens.onSurface.withValues(alpha: 0.06),
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(18),
                      topRight: Radius.circular(18),
                      bottomRight: Radius.circular(18),
                      bottomLeft: Radius.circular(4),
                    ),
                    border: cinematic
                        ? Border.all(
                            color: tokens.primary.withValues(alpha: 0.14))
                        : null,
                    boxShadow: cinematic
                        ? [
                            BoxShadow(
                              color: tokens.primary.withValues(alpha: 0.06),
                              blurRadius: 12,
                            ),
                          ]
                        : null,
                  ),
                  child: _TypingDots(
                    motionLevel: motionLevel,
                    color: cinematic
                        ? tokens.primary
                        : tokens.onSurface.withValues(alpha: 0.42),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Bubble-shaped bone with proper chat-bubble border-radius
// ---------------------------------------------------------------------------
class _BubbleBone extends StatelessWidget {
  const _BubbleBone({
    required this.isUser,
    required this.width,
    required this.height,
    required this.visualMode,
    required this.tokens,
  });

  final bool isUser;
  final double width;
  final double height;
  final VisualMode visualMode;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    final cinematic = visualMode == VisualMode.cinematic;
    final br = BorderRadius.only(
      topLeft: const Radius.circular(20),
      topRight: const Radius.circular(20),
      bottomLeft: Radius.circular(isUser ? 20 : 4),
      bottomRight: Radius.circular(isUser ? 4 : 20),
    );
    final bone = _Bone(width: width, height: height, borderRadius: br);

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: cinematic
          ? Container(
              margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
              decoration: BoxDecoration(
                borderRadius: br,
                border: Border.all(
                  color: tokens.primary.withValues(alpha: 0.10),
                  width: 0.6,
                ),
                boxShadow: [
                  BoxShadow(
                    color: tokens.primary.withValues(alpha: 0.05),
                    blurRadius: 10,
                  ),
                ],
              ),
              child: bone,
            )
          : Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
              child: bone,
            ),
    );
  }
}
