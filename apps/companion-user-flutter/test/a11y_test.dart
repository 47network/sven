// Accessibility / semantics test suite for the Sven companion app.
//
// These tests verify:
//   1. FeatureFlagService flag defaults and fallback logic (pure unit tests — no widgets needed).
//   2. Semantics label propagation for live-region banners.
//   3. Interactive widgets (buttons, toggles) carry correct semantics actions.
//   4. ExcludeSemantics correctly prunes the semantics tree.
//   5. SvenTokens colour helpers produce non-transparent foreground colours in
//      both visual modes (a coarse proxy for contrast readiness).
//
// No Firebase / Sentry init is required here — these are pure flutter_test tests.

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:sven_user_flutter/app/feature_flag_service.dart';
import 'package:sven_user_flutter/app/app_models.dart';
import 'package:sven_user_flutter/app/sven_tokens.dart';

void main() {
  // ─────────────────────────────────────────────────────────────────────────
  // 1. FeatureFlagService — flag() logic (uses singleton, reset via clear())
  // ─────────────────────────────────────────────────────────────────────────
  group('FeatureFlagService', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
      FeatureFlagService.instance.clear();
    });

    test('flag() returns false for an unknown key', () {
      expect(FeatureFlagService.instance.flag('no_such_flag'), isFalse);
    });

    test('flag() respects the fallback parameter', () {
      expect(
        FeatureFlagService.instance.flag('no_such_flag', fallback: true),
        isTrue,
      );
    });

    test('flag() returns compiled-in default for noise_level_indicator', () {
      // 'noise_level_indicator' is true in the compiled defaults.
      expect(FeatureFlagService.instance.flag('noise_level_indicator'), isTrue);
    });

    test('flag() returns compiled-in default after no-arg load()', () async {
      await FeatureFlagService.instance.load();
      expect(FeatureFlagService.instance.flag('noise_level_indicator'), isTrue);
      expect(FeatureFlagService.instance.flag('file_download_chips'), isTrue);
      expect(FeatureFlagService.instance.flag('auto_read_mode'), isFalse);
    });

    test('flag() returns false for phantom key after load()', () async {
      await FeatureFlagService.instance.load();
      expect(FeatureFlagService.instance.flag('phantom_flag'), isFalse);
    });

    test('flagString() returns fallback when key is absent', () async {
      await FeatureFlagService.instance.load();
      expect(
        FeatureFlagService.instance.flagString('missing_string', fallback: 'x'),
        equals('x'),
      );
    });

    test('isLoaded is false before load() and true afterwards', () async {
      expect(FeatureFlagService.instance.isLoaded, isFalse);
      await FeatureFlagService.instance.load();
      expect(FeatureFlagService.instance.isLoaded, isTrue);
    });

    test('clear() resets isLoaded to false', () async {
      await FeatureFlagService.instance.load();
      expect(FeatureFlagService.instance.isLoaded, isTrue);
      FeatureFlagService.instance.clear();
      expect(FeatureFlagService.instance.isLoaded, isFalse);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. SvenTokens — non-transparent foreground colours (contrast proxy)
  // ─────────────────────────────────────────────────────────────────────────
  group('SvenTokens colour contrast', () {
    for (final mode in VisualMode.values) {
      test('forMode($mode) — onSurface is fully opaque', () {
        final t = SvenTokens.forMode(mode);
        // onSurface should always be fully opaque (alpha == 255) for readable body text.
        expect(t.onSurface.alpha, equals(255),
            reason: 'onSurface colour must be opaque in $mode mode');
      });

      test('forMode($mode) — primary is fully opaque', () {
        final t = SvenTokens.forMode(mode);
        expect(t.primary.alpha, equals(255),
            reason: 'primary colour must be opaque in $mode mode');
      });

      test('forMode($mode) — scaffold colour is defined', () {
        final t = SvenTokens.forMode(mode);
        // Just assert it is a non-zero colour (not default transparent black).
        expect(t.scaffold, isNot(equals(const Color(0x00000000))));
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Semantics — live-region banner is visible to screen readers
  // ─────────────────────────────────────────────────────────────────────────
  group('Semantics — live-region banner', () {
    testWidgets('liveRegion flag propagates to SemanticsNode', (tester) async {
      const label = 'Low battery — switched to classic mode';
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Semantics(
              liveRegion: true,
              label: label,
              child: const SizedBox(width: 200, height: 48),
            ),
          ),
        ),
      );

      final handle = tester.ensureSemantics();
      final node = tester.getSemantics(find.bySemanticsLabel(label));
      expect(node.label, equals(label));
      expect(
          node.getSemanticsData().hasFlag(SemanticsFlag.isLiveRegion), isTrue);
      handle.dispose();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Semantics — interactive elements carry tap action
  // ─────────────────────────────────────────────────────────────────────────
  group('Semantics — interactive elements', () {
    testWidgets('ElevatedButton exposes tap action and label', (tester) async {
      const btnLabel = 'Send message';
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ElevatedButton(
              onPressed: () {},
              child: const Text(btnLabel),
            ),
          ),
        ),
      );

      final handle = tester.ensureSemantics();
      final node = tester.getSemantics(find.bySemanticsLabel(btnLabel));
      expect(node.getSemanticsData().hasAction(SemanticsAction.tap), isTrue);
      handle.dispose();
    });

    testWidgets('Switch has toggle action', (tester) async {
      bool value = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (ctx, setState) => Semantics(
                label: 'Enable feature',
                child: Switch(
                  value: value,
                  onChanged: (v) => setState(() => value = v),
                ),
              ),
            ),
          ),
        ),
      );

      final switchFinder = find.byType(Switch);
      expect(switchFinder, findsOneWidget);
      final handle = tester.ensureSemantics();
      final node = tester.getSemantics(switchFinder);
      expect(node.getSemanticsData().hasAction(SemanticsAction.tap), isTrue);
      handle.dispose();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Semantics — ExcludeSemantics prunes decorative nodes
  // ─────────────────────────────────────────────────────────────────────────
  group('Semantics — ExcludeSemantics', () {
    testWidgets('decorative icon inside ExcludeSemantics is not announced',
        (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Row(
              children: [
                ExcludeSemantics(
                  child: Icon(Icons.star, semanticLabel: 'decorative star'),
                ),
                Text('Favourites'),
              ],
            ),
          ),
        ),
      );

      // The label from inside ExcludeSemantics should not appear in the tree.
      expect(find.bySemanticsLabel('decorative star'), findsNothing);
      // The visible text label must still be present.
      expect(find.bySemanticsLabel('Favourites'), findsOneWidget);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Semantics — text scale does not clip content
  // ─────────────────────────────────────────────────────────────────────────
  group('Semantics — large text scale', () {
    testWidgets('UI remains accessible at 2× text scale', (tester) async {
      tester.view.devicePixelRatio = 1.0;

      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(2.0)),
          child: MaterialApp(
            home: Scaffold(
              body: ElevatedButton(
                onPressed: () {},
                child: const Text('Confirm'),
              ),
            ),
          ),
        ),
      );

      // The button text must still be findable at 2× scale.
      expect(find.text('Confirm'), findsOneWidget);
      // No overflow errors should have been thrown.
      expect(tester.takeException(), isNull);
    });
  });
}
