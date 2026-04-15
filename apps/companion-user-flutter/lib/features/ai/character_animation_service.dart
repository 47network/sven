/// D.1.1 — Character sprite sheet manifest & animation state machine.
/// D.1.2 — Lottie animation file registry for each Sven character state.
/// D.1.3 — Thought bubble animation support.
/// D.1.4 — Celebration animation (confetti / particle burst).
/// D.1.5 — "Sven is working" animation with code-bracket overlay.
///
/// Maps agent activity states to Lottie assets with configurable transitions,
/// durations, and overlay support (e.g. thought bubble layered over orb).
library;

import 'package:flutter/widgets.dart';
import 'package:lottie/lottie.dart';

// ---------------------------------------------------------------------------
// Character state enum — mirrors Tauri CharacterState but adds mobile-only
// states (listening, speaking) and overlay states (thoughtBubble).
// ---------------------------------------------------------------------------

enum CharacterAnimationState {
  idle,
  thinking,
  listening,
  speaking,
  happy,
  celebrating,
  sleeping,
  working,
  thoughtBubble,
}

// ---------------------------------------------------------------------------
// Sprite sheet entry — describes a single animation asset with metadata.
// ---------------------------------------------------------------------------

class SpriteSheetEntry {
  final CharacterAnimationState state;
  final String assetPath;
  final int frameCount;
  final double fps;
  final int widthPx;
  final int heightPx;
  final bool loops;
  final Duration transitionIn;
  final Duration transitionOut;

  const SpriteSheetEntry({
    required this.state,
    required this.assetPath,
    required this.frameCount,
    required this.fps,
    this.widthPx = 200,
    this.heightPx = 200,
    this.loops = true,
    this.transitionIn = const Duration(milliseconds: 300),
    this.transitionOut = const Duration(milliseconds: 200),
  });

  Duration get duration =>
      Duration(milliseconds: (frameCount / fps * 1000).round());
}

// ---------------------------------------------------------------------------
// Sprite sheet manifest — single source of truth for all character assets.
// ---------------------------------------------------------------------------

class CharacterSpriteSheet {
  static const List<SpriteSheetEntry> entries = [
    SpriteSheetEntry(
      state: CharacterAnimationState.idle,
      assetPath: 'assets/lottie/sven_idle.json',
      frameCount: 90,
      fps: 30,
    ),
    SpriteSheetEntry(
      state: CharacterAnimationState.thinking,
      assetPath: 'assets/lottie/sven_thinking.json',
      frameCount: 60,
      fps: 30,
    ),
    SpriteSheetEntry(
      state: CharacterAnimationState.listening,
      assetPath: 'assets/lottie/sven_listening.json',
      frameCount: 75,
      fps: 30,
    ),
    SpriteSheetEntry(
      state: CharacterAnimationState.speaking,
      assetPath: 'assets/lottie/sven_speaking.json',
      frameCount: 30,
      fps: 30,
    ),
    SpriteSheetEntry(
      state: CharacterAnimationState.happy,
      assetPath: 'assets/lottie/sven_happy.json',
      frameCount: 24,
      fps: 30,
      loops: false,
    ),
    SpriteSheetEntry(
      state: CharacterAnimationState.celebrating,
      assetPath: 'assets/lottie/sven_celebrating.json',
      frameCount: 60,
      fps: 30,
      loops: false,
      transitionIn: Duration(milliseconds: 150),
    ),
    SpriteSheetEntry(
      state: CharacterAnimationState.sleeping,
      assetPath: 'assets/lottie/sven_sleeping.json',
      frameCount: 150,
      fps: 30,
    ),
    SpriteSheetEntry(
      state: CharacterAnimationState.working,
      assetPath: 'assets/lottie/sven_working.json',
      frameCount: 90,
      fps: 30,
    ),
    SpriteSheetEntry(
      state: CharacterAnimationState.thoughtBubble,
      assetPath: 'assets/lottie/sven_thought_bubble.json',
      frameCount: 90,
      fps: 30,
    ),
  ];

  static final Map<CharacterAnimationState, SpriteSheetEntry> _lookup = {
    for (final e in entries) e.state: e,
  };

  static SpriteSheetEntry forState(CharacterAnimationState state) =>
      _lookup[state] ?? _lookup[CharacterAnimationState.idle]!;

  static String assetFor(CharacterAnimationState state) =>
      forState(state).assetPath;
}

// ---------------------------------------------------------------------------
// CharacterAnimationWidget — renders the current state with crossfade.
// Supports an optional overlay (thought bubble on top of the base state).
// ---------------------------------------------------------------------------

class CharacterAnimationWidget extends StatefulWidget {
  final CharacterAnimationState state;
  final CharacterAnimationState? overlayState;
  final double size;
  final BoxFit fit;

  const CharacterAnimationWidget({
    super.key,
    required this.state,
    this.overlayState,
    this.size = 120,
    this.fit = BoxFit.contain,
  });

  @override
  State<CharacterAnimationWidget> createState() =>
      _CharacterAnimationWidgetState();
}

class _CharacterAnimationWidgetState extends State<CharacterAnimationWidget>
    with TickerProviderStateMixin {
  late AnimationController _fadeController;
  late Animation<double> _fadeIn;

  CharacterAnimationState _displayedState = CharacterAnimationState.idle;

  @override
  void initState() {
    super.initState();
    _displayedState = widget.state;
    _fadeController = AnimationController(
      vsync: this,
      duration: CharacterSpriteSheet.forState(widget.state).transitionIn,
    );
    _fadeIn = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeInOut,
    );
    _fadeController.value = 1.0;
  }

  @override
  void didUpdateWidget(covariant CharacterAnimationWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.state != widget.state) {
      final entry = CharacterSpriteSheet.forState(widget.state);
      _fadeController.duration = entry.transitionIn;
      _fadeController.forward(from: 0.0);
      setState(() => _displayedState = widget.state);
    }
  }

  @override
  void dispose() {
    _fadeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final entry = CharacterSpriteSheet.forState(_displayedState);

    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Base animation
          FadeTransition(
            opacity: _fadeIn,
            child: Lottie.asset(
              entry.assetPath,
              width: widget.size,
              height: widget.size,
              fit: widget.fit,
              repeat: entry.loops,
            ),
          ),

          // Optional overlay (e.g. thought bubble on top of idle orb)
          if (widget.overlayState != null)
            Lottie.asset(
              CharacterSpriteSheet.assetFor(widget.overlayState!),
              width: widget.size,
              height: widget.size,
              fit: widget.fit,
              repeat: CharacterSpriteSheet.forState(widget.overlayState!).loops,
            ),
        ],
      ),
    );
  }
}
