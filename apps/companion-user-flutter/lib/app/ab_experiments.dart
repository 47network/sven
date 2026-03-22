// lib/app/ab_experiments.dart
//
// Registry of all active A/B experiments.
//
// Add new experiments here — no other file needs to change for the experiment
// to be tracked, persisted, and surfaced in the QA override panel.
//
// Variant weights are relative (not percentages); the service normalises them.
// A weight of 0.5 / 0.5 means equal split; 0.4 / 0.3 / 0.3 means 40 / 30 / 30.

import 'package:flutter/foundation.dart' show immutable;

/// A single A/B experiment definition.
///
/// [id]            — stable machine-readable identifier (never rename in prod)
/// [displayName]   — human-readable title shown in the QA override panel
/// [description]   — short description of what is being tested
/// [variants]      — ordered map of variantName → relative weight
///
/// The first variant listed is treated as the "control" by [AbTestService.isControl].
@immutable
class AbExperiment {
  const AbExperiment({
    required this.id,
    required this.displayName,
    required this.description,
    required this.variants,
  });

  final String id;
  final String displayName;
  final String description;

  /// Ordered map: variantName → relative weight.
  ///
  /// Use a [LinkedHashMap] ordering convention — Dart's map literal preserves
  /// insertion order, so the first key is always the control variant.
  final Map<String, double> variants;

  @override
  String toString() => 'AbExperiment($id)';
}

// ─────────────────────────────────────────────────────────────────────────────

/// Compile-time registry of all A/B experiments in the app.
///
/// Usage:
/// ```dart
/// final variant = svc.getVariant(AbExperiments.suggestionChips.id);
/// ```
abstract final class AbExperiments {
  AbExperiments._();

  // ── Registered experiments ─────────────────────────────────────────────────

  /// Whether quick-reply suggestion chips appear beneath messages.
  static const suggestionChips = AbExperiment(
    id: 'suggestion_chips',
    displayName: 'Suggestion Chips',
    description: 'Show / hide quick-reply chips below AI responses.',
    variants: {
      'shown': 0.5,
      'hidden': 0.5,
    },
  );

  /// Visual style of the message composer input field.
  static const composerStyle = AbExperiment(
    id: 'composer_style',
    displayName: 'Composer Style',
    description: 'Rounded pill composer vs flat/square composer.',
    variants: {
      'rounded': 0.5,
      'flat': 0.5,
    },
  );

  /// Onboarding flow variant shown to new users after first sign-in.
  static const onboardingFlow = AbExperiment(
    id: 'onboarding_flow',
    displayName: 'Onboarding Flow',
    description:
        'Classic multi-step walkthrough vs minimal vs guided tutorial.',
    variants: {
      'classic': 0.4,
      'minimal': 0.3,
      'guided': 0.3,
    },
  );

  /// Size of the Sven avatar in the chat header.
  static const avatarSize = AbExperiment(
    id: 'avatar_size',
    displayName: 'Avatar Size',
    description:
        'Standard / compact / large avatar in the conversation header.',
    variants: {
      'standard': 0.5,
      'compact': 0.25,
      'large': 0.25,
    },
  );

  // ── Master list ────────────────────────────────────────────────────────────

  static const List<AbExperiment> all = [
    suggestionChips,
    composerStyle,
    onboardingFlow,
    avatarSize,
  ];
}
