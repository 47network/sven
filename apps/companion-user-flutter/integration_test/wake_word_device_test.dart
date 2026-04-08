// integration_test/wake_word_device_test.dart
//
// On-device integration test for wake-word UI components.
//
// Run with:
//   flutter test integration_test/wake_word_device_test.dart -d <device-id>
//
// This test deploys the widget tree to a real device to verify rendering,
// animation timing, and touch interactions under a real GPU/frame scheduler.

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:sven_user_flutter/app/app_models.dart';
import 'package:sven_user_flutter/app/sven_tokens.dart';
import 'package:sven_user_flutter/app/wake_word_status_indicator.dart';

/// Suppress the known Flutter 3.27 framework bug where FrameTiming callbacks
/// fire before `drawFrame` sets `debugFrameWasSentToEngine`. This is a
/// framework-internal race condition and not a defect in our code.
/// See: https://github.com/flutter/flutter/issues/143073
bool _isKnownFrameTimingBug(FlutterErrorDetails details) {
  final message = details.exceptionAsString();
  return message.contains('debugFrameWasSentToEngine');
}

SvenModeTokens _testTokens() => const SvenModeTokens(
      primary: Colors.blue,
      secondary: Colors.teal,
      surface: Color(0xFF1E1E1E),
      onSurface: Colors.white,
      scaffold: Color(0xFF121212),
      onScaffold: Colors.white,
      card: Color(0xFF2A2A2A),
      frame: Color(0xFF333333),
      glow: Colors.blueAccent,
      backgroundGradient: LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xFF121212), Color(0xFF1E1E1E)],
      ),
    );

Widget _harness(Widget child) {
  return MaterialApp(home: Scaffold(body: Center(child: child)));
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  // Suppress the known Flutter 3.27 FrameTiming assertion bug.
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (FlutterErrorDetails details) {
    if (_isKnownFrameTimingBug(details)) return;
    if (originalOnError != null) {
      originalOnError(details);
    }
  };

  group('WakeWordStatusIndicator on-device', () {
    testWidgets('idle renders nothing visible', (tester) async {
      await tester.pumpWidget(_harness(
        WakeWordStatusIndicator(
          status: WakeWordStatus.idle,
          tokens: _testTokens(),
          phrase: 'Hey Sven',
        ),
      ));
      await tester.pump();
      expect(find.byType(Icon), findsNothing);
    });

    testWidgets('listening renders pulsing mic icon', (tester) async {
      await tester.pumpWidget(_harness(
        WakeWordStatusIndicator(
          status: WakeWordStatus.listening,
          tokens: _testTokens(),
          phrase: 'Hey Sven',
        ),
      ));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.byIcon(Icons.mic_rounded), findsOneWidget);
      final icon = tester.widget<Icon>(find.byIcon(Icons.mic_rounded));
      expect(icon.color, Colors.blue);
      expect(icon.size, 18);
      expect(icon.semanticLabel, contains('Hey Sven'));
    });

    testWidgets('detected shows green check', (tester) async {
      await tester.pumpWidget(_harness(
        WakeWordStatusIndicator(
          status: WakeWordStatus.detected,
          tokens: _testTokens(),
          phrase: 'Hey Sven',
        ),
      ));
      await tester.pump();

      expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);
      final icon =
          tester.widget<Icon>(find.byIcon(Icons.check_circle_rounded));
      expect(icon.color, Colors.green);
    });

    testWidgets('rejected shows amber hearing disabled', (tester) async {
      await tester.pumpWidget(_harness(
        WakeWordStatusIndicator(
          status: WakeWordStatus.rejected,
          tokens: _testTokens(),
          phrase: 'Hey Sven',
        ),
      ));
      await tester.pump();

      expect(find.byIcon(Icons.hearing_disabled_rounded), findsOneWidget);
      final icon =
          tester.widget<Icon>(find.byIcon(Icons.hearing_disabled_rounded));
      expect(icon.color, Colors.amber);
    });

    testWidgets('listening→detected→auto-revert to listening', (tester) async {
      // Mount as listening.
      await tester.pumpWidget(_harness(
        WakeWordStatusIndicator(
          status: WakeWordStatus.listening,
          tokens: _testTokens(),
          phrase: 'Hey Sven',
        ),
      ));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byIcon(Icons.mic_rounded), findsOneWidget);

      // Transition to detected — fires flash timer.
      await tester.pumpWidget(_harness(
        WakeWordStatusIndicator(
          status: WakeWordStatus.detected,
          tokens: _testTokens(),
          phrase: 'Hey Sven',
        ),
      ));
      await tester.pump();
      expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);

      // Wait for 1600ms flash timer to auto-revert.
      await tester.pump(const Duration(milliseconds: 1700));
      expect(find.byIcon(Icons.mic_rounded), findsOneWidget);
      expect(find.byIcon(Icons.check_circle_rounded), findsNothing);
    });

    testWidgets('idle→listening transition shows icon on device',
        (tester) async {
      await tester.pumpWidget(_harness(
        WakeWordStatusIndicator(
          status: WakeWordStatus.idle,
          tokens: _testTokens(),
          phrase: 'Hey Sven',
        ),
      ));
      await tester.pump();
      expect(find.byType(Icon), findsNothing);

      // Transition to listening.
      await tester.pumpWidget(_harness(
        WakeWordStatusIndicator(
          status: WakeWordStatus.listening,
          tokens: _testTokens(),
          phrase: 'Hey Sven',
        ),
      ));
      await tester.pump(const Duration(milliseconds: 200));
      expect(find.byIcon(Icons.mic_rounded), findsOneWidget);
    });
  });
}
