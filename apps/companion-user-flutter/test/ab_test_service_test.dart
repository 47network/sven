// test/ab_test_service_test.dart
//
// Unit tests for AbTestService and AbExperiments.
//
// No platform channels, no Flutter framework — pure Dart.

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:sven_user_flutter/app/ab_experiments.dart';
import 'package:sven_user_flutter/app/ab_test_service.dart';

// ─────────────────────────────────────────────────────────────────────────────

void main() {
  // Isolate SharedPreferences between test groups.
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  // Create a fresh service instance for each test to avoid singleton state
  // pollution.  We test via the public API without touching the singleton
  // directly so that test isolation is clean.
  AbTestService freshService() => AbTestService.instance..resetForLogout();

  // ──────────────────────────────────────────────────────────────────────────
  group('AbExperiments', () {
    test('all contains exactly 4 experiments', () {
      expect(AbExperiments.all, hasLength(4));
    });

    test('experiment IDs are unique', () {
      final ids = AbExperiments.all.map((e) => e.id).toList();
      expect(ids.toSet(), hasLength(ids.length));
    });

    test('every experiment has at least 2 variants', () {
      for (final exp in AbExperiments.all) {
        expect(exp.variants.length, greaterThanOrEqualTo(2),
            reason: '${exp.id} must have ≥ 2 variants');
      }
    });

    test('all variant weights are positive', () {
      for (final exp in AbExperiments.all) {
        for (final w in exp.variants.values) {
          expect(w, greaterThan(0.0),
              reason: '${exp.id} must have positive weights');
        }
      }
    });

    test('well-known experiments exist with correct IDs', () {
      expect(AbExperiments.suggestionChips.id, 'suggestion_chips');
      expect(AbExperiments.composerStyle.id, 'composer_style');
      expect(AbExperiments.onboardingFlow.id, 'onboarding_flow');
      expect(AbExperiments.avatarSize.id, 'avatar_size');
    });

    test('onboardingFlow has three variants summing to 1.0', () {
      final exp = AbExperiments.onboardingFlow;
      expect(exp.variants, hasLength(3));
      final total = exp.variants.values.fold(0.0, (s, w) => s + w);
      expect(total, closeTo(1.0, 0.001));
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  group('AbTestService.bind', () {
    test('isBound is false before bind', () async {
      final svc = freshService();
      expect(svc.isBound, isFalse);
    });

    test('isBound is true after bind', () async {
      final svc = freshService();
      await svc.bind(userId: 'user-1');
      expect(svc.isBound, isTrue);
      expect(svc.userId, 'user-1');
    });

    test('bind is idempotent for same userId', () async {
      final svc = freshService();
      await svc.bind(userId: 'user-a');
      final assignments1 = Map<String, String>.from(svc.assignments);
      await svc.bind(userId: 'user-a');
      expect(svc.assignments, equals(assignments1));
    });

    test('all experiments have assignments after bind', () async {
      final svc = freshService();
      await svc.bind(userId: 'tester');
      for (final exp in AbExperiments.all) {
        expect(svc.assignments.containsKey(exp.id), isTrue,
            reason: '${exp.id} should be assigned');
      }
    });

    test('resetForLogout clears isBound', () async {
      final svc = freshService();
      await svc.bind(userId: 'user-x');
      svc.resetForLogout();
      expect(svc.isBound, isFalse);
      expect(svc.userId, isNull);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  group('AbTestService.getVariant — determinism', () {
    test('same userId + experimentId always returns same variant', () async {
      final svc = freshService();
      await svc.bind(userId: 'stable-user');
      final v1 = svc.getVariant(AbExperiments.suggestionChips.id);

      // Rebind same user — must still produce same assignment.
      SharedPreferences.setMockInitialValues({});
      final svc2 = AbTestService.instance..resetForLogout();
      await svc2.bind(userId: 'stable-user');
      final v2 = svc2.getVariant(AbExperiments.suggestionChips.id);

      expect(v1, equals(v2));
    });

    test('returned variant is a valid variant for the experiment', () async {
      final svc = freshService();
      await svc.bind(userId: 'validate');
      for (final exp in AbExperiments.all) {
        final variant = svc.getVariant(exp.id);
        expect(exp.variants.containsKey(variant), isTrue,
            reason: '$variant is not valid for ${exp.id}');
      }
    });

    test('unknown experimentId returns "control" without throwing', () async {
      final svc = freshService();
      await svc.bind(userId: 'unknown-test');
      expect(() => svc.getVariant('does_not_exist'), returnsNormally);
      expect(svc.getVariant('does_not_exist'), 'control');
    });

    test(
        'different userIds can produce different variants (distribution check)',
        () async {
      // With 100 users and two equal variants (50/50), we expect both variants
      // to appear.  Not a flaky test — the hash is deterministic.
      final seen = <String>{};
      for (var i = 0; i < 100; i++) {
        final svc = AbTestService.instance..resetForLogout();
        SharedPreferences.setMockInitialValues({});
        await svc.bind(userId: 'user_$i');
        seen.add(svc.getVariant(AbExperiments.suggestionChips.id));
      }
      expect(seen.length, greaterThan(1),
          reason: 'Hash bucketing should produce both variants over 100 users');
    });

    test('isControl returns true for first variant, false otherwise', () async {
      // Iterate users until we find one in control and one not in control.
      bool foundControl = false;
      bool foundNonControl = false;

      for (var i = 0; i < 200; i++) {
        final svc = AbTestService.instance..resetForLogout();
        SharedPreferences.setMockInitialValues({});
        await svc.bind(userId: 'u_$i');
        final v = svc.getVariant(AbExperiments.composerStyle.id);
        final isCtrl = svc.isControl(AbExperiments.composerStyle.id);
        final firstVariant = AbExperiments.composerStyle.variants.keys.first;
        if (v == firstVariant) {
          expect(isCtrl, isTrue);
          foundControl = true;
        } else {
          expect(isCtrl, isFalse);
          foundNonControl = true;
        }
        if (foundControl && foundNonControl) break;
      }

      expect(foundControl, isTrue);
      expect(foundNonControl, isTrue);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  group('AbTestService — QA overrides', () {
    test('overrideVariant takes precedence over hash assignment', () async {
      final svc = freshService();
      await svc.bind(userId: 'qa-tester');

      // Force 'hidden' regardless of hash.
      await svc.overrideVariant(AbExperiments.suggestionChips.id, 'hidden');
      expect(svc.getVariant(AbExperiments.suggestionChips.id), 'hidden');
    });

    test('clearOverride falls back to hash assignment', () async {
      final svc = freshService();
      await svc.bind(userId: 'qa-fall');
      final hashVariant = svc.assignments[AbExperiments.suggestionChips.id]!;

      await svc.overrideVariant(AbExperiments.suggestionChips.id, 'hidden');
      expect(svc.getVariant(AbExperiments.suggestionChips.id), 'hidden');

      await svc.clearOverride(AbExperiments.suggestionChips.id);
      expect(svc.getVariant(AbExperiments.suggestionChips.id), hashVariant);
    });

    test('clearAllOverrides removes all QA overrides', () async {
      final svc = freshService();
      await svc.bind(userId: 'qa-all');

      await svc.overrideVariant(AbExperiments.suggestionChips.id, 'hidden');
      await svc.overrideVariant(AbExperiments.composerStyle.id, 'flat');

      expect(svc.overrides.length, 2);

      await svc.clearAllOverrides();

      expect(svc.overrides, isEmpty);
    });

    test('invalid variant name is ignored by overrideVariant', () async {
      final svc = freshService();
      await svc.bind(userId: 'qa-bad');
      final before = svc.getVariant(AbExperiments.suggestionChips.id);

      await svc.overrideVariant(AbExperiments.suggestionChips.id, 'xyz_bad');
      expect(svc.getVariant(AbExperiments.suggestionChips.id), before);
    });

    test('overrides are reflected in overrides map', () async {
      final svc = freshService();
      await svc.bind(userId: 'qa-map');

      await svc.overrideVariant(AbExperiments.avatarSize.id, 'large');
      expect(svc.overrides[AbExperiments.avatarSize.id], 'large');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  group('AbTestService.activeExperiments', () {
    test('returns all 4 experiments', () async {
      final svc = freshService();
      expect(svc.activeExperiments, hasLength(4));
    });

    test('list is unmodifiable', () async {
      final svc = freshService();
      expect(
        () => svc.activeExperiments.add(AbExperiments.suggestionChips),
        throwsUnsupportedError,
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  group('AbTestService — exposure callback', () {
    test('onExposure fires on first getVariant call', () async {
      final svc = freshService();
      await svc.bind(userId: 'exp-user');

      final events = <String>[];
      svc.onExposure = (experimentId, variant, userId) {
        events.add('$userId:$experimentId:$variant');
      };

      svc.getVariant(AbExperiments.suggestionChips.id);
      expect(events, hasLength(1));
      expect(events.first, startsWith('exp-user:suggestion_chips:'));
    });

    test('onExposure fires only once per experiment', () async {
      final svc = freshService();
      await svc.bind(userId: 'exp-once');

      int count = 0;
      svc.onExposure = (_, __, ___) => count++;
      svc.getVariant(AbExperiments.composerStyle.id);
      svc.getVariant(AbExperiments.composerStyle.id);
      svc.getVariant(AbExperiments.composerStyle.id);

      expect(count, 1);
    });

    test('onExposure throws are swallowed', () async {
      final svc = freshService();
      await svc.bind(userId: 'exp-throw');
      svc.onExposure = (_, __, ___) => throw Exception('analytics boom');

      expect(
        () => svc.getVariant(AbExperiments.suggestionChips.id),
        returnsNormally,
      );
    });
  });
}
