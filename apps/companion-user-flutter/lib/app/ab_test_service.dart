// lib/app/ab_test_service.dart
//
// A/B testing framework for Sven.
//
// Responsibilities:
//   • Deterministic variant assignment — same userId + experimentId always
//     produces the same variant, so users never see a flip mid-session.
//   • Sticky persistence — assignments are cached in SharedPreferences so
//     they survive app restarts even if the experiment weights change.
//   • QA overrides — in any build, an override stored in SharedPreferences
//     takes precedence over the hash assignment.  The override page is only
//     surfaced in the Settings → Developer panel (debug builds only).
//   • Analytics hook — every first-time exposure fires through [onExposure]
//     so callers can forward to Sentry / Firebase Analytics / etc.
//
// Typical usage:
//   final svc = sl<AbTestService>();
//   await svc.bind(userId: userId); // call after sign-in
//   final variant = svc.getVariant(AbExperiments.suggestionChips.id);
//   if (variant == 'shown') { ... }

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'ab_experiments.dart';

// ─────────────────────────────────────────────────────────────────────────────

/// Callback invoked when a user is first exposed to an experiment variant.
///
/// Use this to fire analytics events (Firebase, Sentry, etc.).
typedef AbExposureCallback = void Function(
  String experimentId,
  String variant,
  String userId,
);

// ─────────────────────────────────────────────────────────────────────────────

/// Core A/B testing service.
///
/// Register as a singleton via [setupServiceLocator] and bind once per
/// signed-in session with [bind].
///
/// The singleton is also accessible via [AbTestService.instance].
class AbTestService extends ChangeNotifier {
  AbTestService._();

  /// Global singleton.  Use [sl<AbTestService>()] in most code; this accessor
  /// is provided for contexts without the service locator (e.g. tests).
  static final AbTestService instance = AbTestService._();

  // ── State ──────────────────────────────────────────────────────────────────

  String? _userId;
  bool _initialized = false;

  /// Sticky assignments: experimentId → variant, loaded from SharedPrefs.
  final Map<String, String> _assignments = {};

  /// QA overrides: experimentId → variant, stored in SharedPrefs.
  final Map<String, String> _overrides = {};

  /// Set of experimentIds that have already been reported via [onExposure].
  final Set<String> _reported = {};

  // ── Configuration ──────────────────────────────────────────────────────────

  /// Optional callback fired on the first exposure to each experiment.
  AbExposureCallback? onExposure;

  // ── SharedPreferences key helpers ─────────────────────────────────────────

  static String _assignmentKey(String experimentId) =>
      'sven.abtest.assignment.$experimentId';

  static String _overrideKey(String experimentId) =>
      'sven.abtest.override.$experimentId';

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /// Bind the service to the signed-in [userId].
  ///
  /// • Loads existing sticky assignments from SharedPreferences.
  /// • Loads any QA overrides from SharedPreferences.
  /// • Computes (and persists) assignments for any experiments not yet seen.
  ///
  /// Safe to call multiple times: if called with the same [userId], it's a
  /// no-op.  If called with a different [userId], the service re-initialises.
  Future<void> bind({required String userId}) async {
    if (_initialized && _userId == userId) return;

    _userId = userId;
    _initialized = true;
    _assignments.clear();
    _overrides.clear();
    _reported.clear();

    final prefs = await SharedPreferences.getInstance();

    // Load existing QA overrides
    for (final exp in AbExperiments.all) {
      final override = prefs.getString(_overrideKey(exp.id));
      if (override != null && exp.variants.containsKey(override)) {
        _overrides[exp.id] = override;
      }
    }

    // Load or compute sticky assignments for all registered experiments
    for (final exp in AbExperiments.all) {
      final stored = prefs.getString(_assignmentKey(exp.id));
      if (stored != null && exp.variants.containsKey(stored)) {
        _assignments[exp.id] = stored;
      } else {
        final variant = _assignVariant(exp, userId);
        _assignments[exp.id] = variant;
        await prefs.setString(_assignmentKey(exp.id), variant);
      }
    }

    notifyListeners();
  }

  /// Reset the service on sign-out — clears in-memory state (persisted
  /// overrides are retained so QA testers keep their settings between logins).
  void resetForLogout() {
    _userId = null;
    _initialized = false;
    _assignments.clear();
    _reported.clear();
    notifyListeners();
  }

  // ── Variant retrieval ─────────────────────────────────────────────────────

  /// Returns the variant the current user is assigned to for [experimentId].
  ///
  /// Priority order (highest → lowest):
  ///   1. QA override (set via [overrideVariant])
  ///   2. Sticky assignment (hash-based, loaded from SharedPrefs)
  ///   3. First variant of the experiment (safe fallback when not bound)
  String getVariant(String experimentId) {
    final exp = _experiment(experimentId);
    if (exp == null) return 'control';

    final variant = _overrides[experimentId] ??
        _assignments[experimentId] ??
        exp.variants.keys.first;

    _maybeReportExposure(experimentId, variant);
    return variant;
  }

  /// Convenience alias for [getVariant].
  String variantFor(String experimentId) => getVariant(experimentId);

  /// Returns `true` if the user is in the first (control) variant.
  bool isControl(String experimentId) {
    final exp = _experiment(experimentId);
    if (exp == null) return true;
    return getVariant(experimentId) == exp.variants.keys.first;
  }

  // ── QA overrides ─────────────────────────────────────────────────────────

  /// Force [variant] for [experimentId].  Persisted across app restarts.
  Future<void> overrideVariant(String experimentId, String variant) async {
    final exp = _experiment(experimentId);
    if (exp == null || !exp.variants.containsKey(variant)) return;

    _overrides[experimentId] = variant;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_overrideKey(experimentId), variant);
    notifyListeners();
  }

  /// Remove the QA override for [experimentId], falling back to the sticky
  /// hash-based assignment.
  Future<void> clearOverride(String experimentId) async {
    _overrides.remove(experimentId);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_overrideKey(experimentId));
    notifyListeners();
  }

  /// Remove all QA overrides.
  Future<void> clearAllOverrides() async {
    final prefs = await SharedPreferences.getInstance();
    for (final key in _overrides.keys.toList()) {
      await prefs.remove(_overrideKey(key));
    }
    _overrides.clear();
    notifyListeners();
  }

  // ── Read-only accessors ────────────────────────────────────────────────────

  /// All registered experiments.
  List<AbExperiment> get activeExperiments =>
      List.unmodifiable(AbExperiments.all);

  /// `true` when [bind] has been called at least once.
  bool get isBound => _initialized && _userId != null;

  /// The currently bound user ID (for display in the QA panel).
  String? get userId => _userId;

  /// Currently active overrides (experimentId → variant).
  Map<String, String> get overrides => Map.unmodifiable(_overrides);

  /// Current assignments (experimentId → variant) — does not include overrides.
  Map<String, String> get assignments => Map.unmodifiable(_assignments);

  // ── Private helpers ───────────────────────────────────────────────────────

  AbExperiment? _experiment(String id) {
    try {
      return AbExperiments.all.firstWhere((e) => e.id == id);
    } catch (_) {
      return null;
    }
  }

  /// Deterministic variant assignment using a DJB2-style hash.
  ///
  /// The hash input is `'$userId:$experimentId'` so that:
  ///   • The same user always gets the same variant (sticky by design).
  ///   • Different experiments produce independent distributions.
  ///   • Adding new experiments doesn't shift existing assignments.
  ///
  /// The bucket is `hash % 10000` mapped to a cumulative weight distribution,
  /// giving roughly the configured percentages at scale.
  static String _assignVariant(AbExperiment exp, String userId) {
    final input = '$userId:${exp.id}';
    final hash = _djb2(input);
    final bucket = hash % 10000; // 0–9999

    final total = exp.variants.values.fold(0.0, (sum, w) => sum + w);
    var cumulative = 0.0;
    for (final entry in exp.variants.entries) {
      cumulative += entry.value / total * 10000.0;
      if (bucket < cumulative) return entry.key;
    }
    return exp.variants.keys.last;
  }

  /// DJB2-style hash — pure Dart, no external dependency.
  static int _djb2(String input) {
    var h = 5381;
    for (final c in input.codeUnits) {
      // h = h * 33 ^ c  (unsigned 31-bit)
      h = ((h << 5) + h) ^ c;
      h &= 0x7FFFFFFF;
    }
    return h;
  }

  void _maybeReportExposure(String experimentId, String variant) {
    if (onExposure == null || _userId == null) return;
    if (_reported.contains(experimentId)) return;
    _reported.add(experimentId);
    try {
      onExposure!(experimentId, variant, _userId!);
    } catch (_) {
      // Never let analytics errors leak into product code.
    }
  }
}
