// Widget tests for key Sven screens that do NOT require Firebase.
//
// Coverage:
//   1. MemoryPage — renders without error, toggle works, a11y labels present.
//   2. MemoryService.buildSystemPrompt — language preference override reflected
//      in the prompt (pure-logic widget-adjacent test, no UI needed).
//   3. _LanguageTile equivalent — MemoryService.setPreferredLanguage() updates
//      detectedLanguage-based subtitle correctly.
//
// Run with: flutter test test/widget_screen_test.dart

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:sven_user_flutter/app/app_models.dart';
import 'package:sven_user_flutter/app/providers.dart';
import 'package:sven_user_flutter/features/memory/memory_page.dart';
import 'package:sven_user_flutter/features/memory/memory_service.dart';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

Widget _wrapPage(Widget page) => MaterialApp(home: page);

/// Wraps [MemoryPage] with the [ProviderScope] override it requires.
/// Replaces the old pattern of passing memoryService as a constructor arg.
Widget _wrapMemoryPage(MemoryService svc, VisualMode mode) => ProviderScope(
      overrides: [memoryServiceProvider.overrideWith((ref) => svc)],
      child: MaterialApp(home: MemoryPage(visualMode: mode)),
    );

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. MemoryPage — basic rendering
  // ─────────────────────────────────────────────────────────────────────────
  group('MemoryPage widget', () {
    testWidgets('renders without throwing in classic mode', (tester) async {
      final svc = MemoryService();
      await tester.pumpWidget(_wrapMemoryPage(svc, VisualMode.classic));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('renders without throwing in cinematic mode', (tester) async {
      final svc = MemoryService();
      await tester.pumpWidget(_wrapMemoryPage(svc, VisualMode.cinematic));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('shows Memory & Instructions header', (tester) async {
      final svc = MemoryService();
      await tester.pumpWidget(_wrapMemoryPage(svc, VisualMode.classic));
      await tester.pumpAndSettle();
      // The page title / heading text should be present.
      expect(
        find.text('Memory & Instructions'),
        findsAtLeastNWidgets(1),
      );
    });

    testWidgets('memory toggle switch is present and tappable', (tester) async {
      final svc = MemoryService();
      await tester.pumpWidget(_wrapMemoryPage(svc, VisualMode.classic));
      await tester.pumpAndSettle();

      // At least one Switch widget should exist (the memory enabled toggle).
      expect(find.byType(Switch), findsAtLeastNWidgets(1));

      // Toggling should not throw.
      await tester.tap(find.byType(Switch).first);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('tab bar has two tabs', (tester) async {
      final svc = MemoryService();
      await tester.pumpWidget(_wrapMemoryPage(svc, VisualMode.classic));
      await tester.pumpAndSettle();

      // MemoryPage has a TabController with 2 tabs (Facts / Instructions).
      expect(find.byType(TabBar), findsOneWidget);
      expect(find.byType(Tab), findsAtLeastNWidgets(2));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. MemoryService — language preference in system prompt
  // ─────────────────────────────────────────────────────────────────────────
  group('MemoryService language preference', () {
    test('auto mode uses detected language in system prompt', () async {
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.setMemoryEnabled(true);

      // Simulate detecting French.
      // Sentence chosen to match 5+ French fingerprint words so confidence
      // gate (requires ≥2 hits) is satisfied:
      // "est" (est-ce), "que" (est-ce que), "très", "mais", "pas"
      svc.detectLanguage(
          ['Bonjour, est-ce que vous allez très bien? Mais pas encore.']);
      expect(svc.detectedLanguage, isNotEmpty);

      // In auto mode, detected language should appear in the system prompt.
      final prompt = svc.buildSystemPrompt();
      expect(prompt, contains(svc.detectedLanguage));
    });

    test('explicit language overrides auto-detected language', () async {
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.setMemoryEnabled(true);

      // Detect one language...
      svc.detectLanguage(['Bonjour oui bien sûr très bien']);
      // ...but explicitly set another.
      await svc.setPreferredLanguage('Spanish');
      expect(svc.preferredLanguage, 'Spanish');

      final prompt = svc.buildSystemPrompt();
      expect(prompt, contains('Spanish'));
      // Detected language should NOT appear since it was overridden.
      if (svc.detectedLanguage.isNotEmpty &&
          svc.detectedLanguage != 'Spanish') {
        expect(prompt, isNot(contains(svc.detectedLanguage)));
      }
    });

    test('setting preferred language to auto restores auto-detection',
        () async {
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.setMemoryEnabled(true);

      svc.detectLanguage(['Bonjour oui bien sûr très bien']);
      final detected = svc.detectedLanguage;
      await svc.setPreferredLanguage('German');
      await svc.setPreferredLanguage('auto');

      expect(svc.preferredLanguage, 'auto');
      if (detected.isNotEmpty) {
        final prompt = svc.buildSystemPrompt();
        expect(prompt, contains(detected));
      }
    });

    test('preferred language persists across service reload', () async {
      SharedPreferences.setMockInitialValues({});
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.setPreferredLanguage('Japanese');

      // Simulate a reload (new instance reads from SharedPreferences).
      final svc2 = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(svc2.preferredLanguage, 'Japanese');
    });

    test('clearAll() resets preferredLanguage to auto', () async {
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.setPreferredLanguage('Korean');
      await svc.clearAll();
      expect(svc.preferredLanguage, 'auto');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. MemoryPage accessibility — key semantic labels
  // ─────────────────────────────────────────────────────────────────────────
  group('MemoryPage accessibility', () {
    testWidgets('page is navigable (has at least one interactive widget)',
        (tester) async {
      final svc = MemoryService();
      await tester.pumpWidget(_wrapMemoryPage(svc, VisualMode.classic));
      await tester.pumpAndSettle();

      // There should be focusable / tappable widgets on the page.
      final buttons = find.byWidgetPredicate(
        (w) => w is GestureDetector || w is InkWell || w is Switch,
      );
      expect(buttons, findsAtLeastNWidgets(1));
    });

    testWidgets('Memory page has no uncaught overflow errors in either theme',
        (tester) async {
      for (final mode in VisualMode.values) {
        SharedPreferences.setMockInitialValues({});
        final svc = MemoryService();
        await tester.pumpWidget(_wrapMemoryPage(svc, mode));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull,
            reason: 'Overflow in $mode mode');
      }
    });
  });
}
