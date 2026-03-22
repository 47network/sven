import 'dart:ui';

import 'package:flutter/material.dart';

class SvenGlass extends StatelessWidget {
  const SvenGlass({
    super.key,
    required this.child,
    required this.background,
    this.enabled = true,
    this.borderRadius = const BorderRadius.all(Radius.circular(16)),
    this.blurSigma = 16,
    this.borderColor,
  });

  final Widget child;
  final Color background;
  final bool enabled;
  final BorderRadius borderRadius;
  final double blurSigma;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final panel = DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        borderRadius: borderRadius,
        border: Border.all(
          color: borderColor ?? Theme.of(context).dividerColor,
        ),
      ),
      child: child,
    );

    if (!enabled) return panel;

    final reduceTransparency =
        SvenGlassScope.of(context)?.reduceTransparency ?? false;
    if (reduceTransparency) return panel;

    return ClipRRect(
      borderRadius: borderRadius,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma),
        child: panel,
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SvenGlassScope — InheritedWidget that propagates the reduceTransparency
// preference from AppState down to every SvenGlass instance.
// ═══════════════════════════════════════════════════════════════════════════

class SvenGlassScope extends InheritedWidget {
  const SvenGlassScope({
    super.key,
    required this.reduceTransparency,
    required super.child,
  });

  final bool reduceTransparency;

  static SvenGlassScope? of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<SvenGlassScope>();

  @override
  bool updateShouldNotify(SvenGlassScope old) =>
      reduceTransparency != old.reduceTransparency;
}
