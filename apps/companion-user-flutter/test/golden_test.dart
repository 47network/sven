// Golden (visual regression) tests for the Sven companion app.
//
// These tests capture pixel-perfect snapshots of key UI components in both
// classic and cinematic visual modes.  They guard against unintentional visual
// regressions — if you change a widget's appearance on purpose, regenerate the
// baselines with:
//
//   flutter test test/golden_test.dart --update-goldens
//
// VERIFY during local development / Windows CI (no flag — must match stored PNGs):
//
//   flutter test test/golden_test.dart
//
// NOTE: Golden files are platform-sensitive (anti-aliasing, font hinting).
// Baselines committed here were generated on Windows 11.  The suite is tagged
// `golden` so that Linux/macOS CI jobs can skip it:
//
//   flutter test --exclude-tags golden      ← ubuntu-latest CI
//   flutter test --tags golden              ← windows CI / local
//
// If you need cross-platform golden stability, consider the `alchemist` package
// which can generate separate CI-only and human-readable goldens.
//
// Components under test:
//   1. QuickActionsBar   — classic + cinematic
//   2. ChatComposer      — classic + cinematic (idle, no VoiceService)
//   3. MemoryPage        — classic + cinematic
//   4. OnboardingPage    — page 0 (welcome screen, default theme)

@Tags(['golden'])
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:sven_user_flutter/app/app_models.dart';
import 'package:sven_user_flutter/app/providers.dart';
import 'package:sven_user_flutter/app/sven_tokens.dart';
import 'package:sven_user_flutter/features/chat/chat_composer.dart';
import 'package:sven_user_flutter/features/home/quick_actions.dart';
import 'package:sven_user_flutter/features/memory/memory_page.dart';
import 'package:sven_user_flutter/features/memory/memory_service.dart';
import 'package:sven_user_flutter/features/onboarding/onboarding_page.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/// Reference device: 390 × 844 logical pixels at 3× = iPhone 13 equivalent.
const _kLogicalWidth = 390.0;
const _kLogicalHeight = 844.0;
const _kDevicePixelRatio = 3.0;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Configures the test viewport to a deterministic phone-sized canvas and
/// returns a teardown that resets it after the test.
void _setPhoneViewport(WidgetTester tester) {
  tester.view.physicalSize = const Size(_kLogicalWidth * _kDevicePixelRatio,
      _kLogicalHeight * _kDevicePixelRatio);
  tester.view.devicePixelRatio = _kDevicePixelRatio;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}

/// Wraps [child] in a minimal [MaterialApp] themed to [tokens] and pinned
/// to a 1.0× text scale so golden images don't vary with device font-size
/// settings.
Widget _goldenHost({
  required Widget child,
  required SvenModeTokens tokens,
  EdgeInsets padding = EdgeInsets.zero,
}) {
  final isDark = tokens.scaffold.computeLuminance() < 0.05;
  return MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: tokens.primary,
        brightness: isDark ? Brightness.dark : Brightness.light,
      ),
      scaffoldBackgroundColor: tokens.scaffold,
    ),
    home: MediaQuery(
      data: const MediaQueryData(textScaler: TextScaler.linear(1.0)),
      child: Scaffold(
        backgroundColor: tokens.scaffold,
        body: SafeArea(
          child: Padding(
            padding: padding,
            child: RepaintBoundary(child: child),
          ),
        ),
      ),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

void main() {
  setUpAll(() {
    SharedPreferences.setMockInitialValues({});
  });

  // ── 1. QuickActionsBar ────────────────────────────────────────────────────

  group('QuickActionsBar golden', () {
    for (final mode in [VisualMode.classic, VisualMode.cinematic]) {
      final name = mode.name;
      testWidgets('renders correctly in $name mode', (tester) async {
        _setPhoneViewport(tester);
        final tokens = SvenTokens.forMode(mode);

        await tester.pumpWidget(
          _goldenHost(
            tokens: tokens,
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: QuickActionsBar(
              tokens: tokens,
              visualMode: mode,
              onAction: (_) {},
            ),
          ),
        );
        await tester.pumpAndSettle();

        await expectLater(
          find.byType(RepaintBoundary).first,
          matchesGoldenFile('goldens/quick_actions_bar_$name.png'),
        );
      });
    }
  });

  // ── 2. ChatComposer ───────────────────────────────────────────────────────

  group('ChatComposer golden', () {
    for (final mode in [VisualMode.classic, VisualMode.cinematic]) {
      final name = mode.name;
      testWidgets('idle state renders correctly in $name mode', (tester) async {
        _setPhoneViewport(tester);
        final tokens = SvenTokens.forMode(mode);

        await tester.pumpWidget(
          _goldenHost(
            tokens: tokens,
            child: Align(
              alignment: Alignment.bottomCenter,
              child: ChatComposer(
                onSend: (_, __) {},
                onCancel: () {},
                onRetry: () {},
                isSending: false,
                hasFailed: false,
                isEnabled: true,
                visualMode: mode,
                motionLevel: MotionLevel.off,
              ),
            ),
          ),
        );
        // One extra pump to flush the AnimationController initialisation.
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        await expectLater(
          find.byType(RepaintBoundary).first,
          matchesGoldenFile('goldens/chat_composer_$name.png'),
        );
      });
    }
  });

  // ── 3. MemoryPage ─────────────────────────────────────────────────────────

  group('MemoryPage golden', () {
    for (final mode in [VisualMode.classic, VisualMode.cinematic]) {
      final name = mode.name;
      testWidgets('renders correctly in $name mode', (tester) async {
        _setPhoneViewport(tester);
        SharedPreferences.setMockInitialValues({});
        final tokens = SvenTokens.forMode(mode);
        final svc = MemoryService();

        await tester.pumpWidget(
          ProviderScope(
            overrides: [memoryServiceProvider.overrideWith((ref) => svc)],
            child: _goldenHost(
              tokens: tokens,
              child: MemoryPage(visualMode: mode),
            ),
          ),
        );
        await tester.pumpAndSettle();

        await expectLater(
          find.byType(RepaintBoundary).first,
          matchesGoldenFile('goldens/memory_page_$name.png'),
        );
      });
    }
  });

  // ── 4. OnboardingPage ─────────────────────────────────────────────────────

  group('OnboardingPage golden', () {
    testWidgets('welcome screen (page 0) renders correctly', (tester) async {
      _setPhoneViewport(tester);
      SharedPreferences.setMockInitialValues({});

      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          home: MediaQuery(
            data: const MediaQueryData(textScaler: TextScaler.linear(1.0)),
            child: RepaintBoundary(
              child: OnboardingPage(
                onComplete: () {},
                onSetVisualMode: (_) {},
              ),
            ),
          ),
        ),
      );
      // Let the entrance animations settle to a stable frame.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));

      await expectLater(
        find.byType(RepaintBoundary).first,
        matchesGoldenFile('goldens/onboarding_page_welcome.png'),
      );
    });
  });
}
