import 'package:flutter/material.dart';

import 'app_models.dart';

class SvenModeTokens {
  const SvenModeTokens({
    required this.primary,
    required this.secondary,
    required this.surface,
    required this.onSurface,
    required this.scaffold,
    required this.onScaffold,
    required this.card,
    required this.frame,
    required this.glow,
    required this.backgroundGradient,
  });

  final Color primary;
  final Color secondary;
  final Color surface;
  final Color onSurface;
  final Color scaffold;
  final Color onScaffold;
  final Color card;
  final Color frame;
  final Color glow;
  final LinearGradient backgroundGradient;
  // Semantic aliases used by newer UI surfaces.
  Color get success => secondary;
  Color get error => const Color(0xFFFF4D4F);

  /// Returns a copy of these tokens with [primary] overridden to [color].
  SvenModeTokens copyWithPrimary(Color color) {
    return SvenModeTokens(
      primary: color,
      secondary: secondary,
      surface: surface,
      onSurface: onSurface,
      scaffold: scaffold,
      onScaffold: onScaffold,
      card: card,
      frame: frame,
      glow: color.withValues(alpha: 0.4),
      backgroundGradient: backgroundGradient,
    );
  }

  /// Returns a colour-blind-safe variant.
  /// Classic mode: swaps teal primary → strong blue, blue secondary → orange.
  /// Cinematic mode: keeps cyan primary, swaps green secondary → orange.
  /// Both adjustments remove red-green reliance for deuteranopia/protanopia users.
  SvenModeTokens copyWithColorBlind() {
    final isDark = scaffold.computeLuminance() < 0.05;
    if (isDark) {
      // Cinematic — replace green secondary with orange
      return SvenModeTokens(
        primary: primary,
        secondary: const Color(0xFFFF8C00),
        surface: surface,
        onSurface: onSurface,
        scaffold: scaffold,
        onScaffold: onScaffold,
        card: card,
        frame: frame,
        glow: primary.withValues(alpha: 0.5),
        backgroundGradient: backgroundGradient,
      );
    } else {
      // Classic — strong perceptual-safe blue + orange
      return SvenModeTokens(
        primary: const Color(0xFF0055CC),
        secondary: const Color(0xFFFF6600),
        surface: surface,
        onSurface: onSurface,
        scaffold: scaffold,
        onScaffold: onScaffold,
        card: card,
        frame: frame,
        glow: const Color(0x330055CC),
        backgroundGradient: backgroundGradient,
      );
    }
  }

  /// Returns a high-contrast version: pure-white/black text on pure-white/black backgrounds.
  SvenModeTokens copyWithHighContrast() {
    // Detect dark vs light by checking the luminance of onSurface
    final isDark = onSurface.computeLuminance() > 0.5;
    final pureText = isDark ? const Color(0xFFFFFFFF) : const Color(0xFF000000);
    final pureBg = isDark ? const Color(0xFF000000) : const Color(0xFFFFFFFF);
    final pureBorder =
        isDark ? const Color(0xFF555555) : const Color(0xFFAAAAAA);
    return SvenModeTokens(
      primary: primary,
      secondary: secondary,
      surface: pureBg,
      onSurface: pureText,
      scaffold: pureBg,
      onScaffold: pureText,
      card: pureBg,
      frame: pureBorder,
      glow: primary.withValues(alpha: 0.6),
      backgroundGradient: LinearGradient(
        colors: [pureBg, pureBg],
      ),
    );
  }
}

class SvenTokens {
  static const classic = SvenModeTokens(
    primary: Color(0xFF0EA5A8),
    secondary: Color(0xFF2563EB),
    surface: Color(0xFFFFFFFF),
    onSurface: Color(0xFF0B1220),
    scaffold: Color(0xFFF4F7FB),
    onScaffold: Color(0xFF0B1220),
    card: Color(0xFFFFFFFF),
    frame: Color(0xFFE1E8F2),
    glow: Color(0x1A0EA5A8),
    backgroundGradient: LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [
        Color(0xFFF5F8FC),
        Color(0xFFEAF0F8),
      ],
    ),
  );

  static const cinematic = SvenModeTokens(
    primary: Color(0xFF00D9FF),
    secondary: Color(0xFF00FFA3),
    surface: Color(0xFF0B1020),
    onSurface: Color(0xFFF3F7FF),
    scaffold: Color(0xFF040712),
    onScaffold: Color(0xFFF3F7FF),
    card: Color(0xFF0B1226),
    frame: Color(0xFF16334F),
    glow: Color(0x6600D9FF),
    backgroundGradient: LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        Color(0xFF030711),
        Color(0xFF0A1328),
        Color(0xFF031A25),
      ],
    ),
  );

  static SvenModeTokens forMode(VisualMode mode) {
    switch (mode) {
      case VisualMode.classic:
        return classic;
      case VisualMode.cinematic:
        return cinematic;
    }
  }
}
