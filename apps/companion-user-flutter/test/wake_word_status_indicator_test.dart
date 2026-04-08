import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sven_user_flutter/app/app_models.dart';
import 'package:sven_user_flutter/app/sven_tokens.dart';
import 'package:sven_user_flutter/app/wake_word_status_indicator.dart';

/// Minimal SvenModeTokens for widget tests.
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

/// Wraps [child] in the minimal MaterialApp context required for rendering.
Widget _harness(Widget child) {
  return MaterialApp(home: Scaffold(body: child));
}

void main() {
  testWidgets('renders nothing when status is idle', (tester) async {
    await tester.pumpWidget(_harness(
      WakeWordStatusIndicator(
        status: WakeWordStatus.idle,
        tokens: _testTokens(),
        phrase: 'Hey Sven',
      ),
    ));

    expect(find.byType(Icon), findsNothing);
    expect(find.byType(SizedBox), findsWidgets);
  });

  testWidgets('renders mic icon when listening', (tester) async {
    await tester.pumpWidget(_harness(
      WakeWordStatusIndicator(
        status: WakeWordStatus.listening,
        tokens: _testTokens(),
        phrase: 'Hey Sven',
      ),
    ));

    final iconFinder = find.byIcon(Icons.mic_rounded);
    expect(iconFinder, findsOneWidget);

    final icon = tester.widget<Icon>(iconFinder);
    expect(icon.color, Colors.blue);
    expect(icon.semanticLabel, contains('Hey Sven'));
  });

  testWidgets('renders check icon when detected', (tester) async {
    await tester.pumpWidget(_harness(
      WakeWordStatusIndicator(
        status: WakeWordStatus.detected,
        tokens: _testTokens(),
        phrase: 'Hey Sven',
      ),
    ));

    expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);
    final icon = tester.widget<Icon>(find.byIcon(Icons.check_circle_rounded));
    expect(icon.color, Colors.green);
  });

  testWidgets('renders hearing disabled icon when rejected', (tester) async {
    await tester.pumpWidget(_harness(
      WakeWordStatusIndicator(
        status: WakeWordStatus.rejected,
        tokens: _testTokens(),
        phrase: 'Hey Sven',
      ),
    ));

    expect(find.byIcon(Icons.hearing_disabled_rounded), findsOneWidget);
    final icon =
        tester.widget<Icon>(find.byIcon(Icons.hearing_disabled_rounded));
    expect(icon.color, Colors.amber);
  });

  testWidgets('flash timer reverts detected to listening after delay',
      (tester) async {
    // Start with listening so didUpdateWidget fires when we switch.
    await tester.pumpWidget(_harness(
      WakeWordStatusIndicator(
        status: WakeWordStatus.listening,
        tokens: _testTokens(),
        phrase: 'Hey Sven',
      ),
    ));
    expect(find.byIcon(Icons.mic_rounded), findsOneWidget);

    // Transition to detected — triggers didUpdateWidget + timer.
    await tester.pumpWidget(_harness(
      WakeWordStatusIndicator(
        status: WakeWordStatus.detected,
        tokens: _testTokens(),
        phrase: 'Hey Sven',
      ),
    ));
    expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);

    // Advance past the 1600ms flash duration and pump for setState.
    await tester.pump(const Duration(milliseconds: 1700));

    // After timer: should have reverted to mic (listening).
    expect(find.byIcon(Icons.mic_rounded), findsOneWidget);
    expect(find.byIcon(Icons.check_circle_rounded), findsNothing);
  });

  testWidgets('flash timer reverts rejected to listening after delay',
      (tester) async {
    // Start with listening so didUpdateWidget fires when we switch.
    await tester.pumpWidget(_harness(
      WakeWordStatusIndicator(
        status: WakeWordStatus.listening,
        tokens: _testTokens(),
        phrase: 'Hey Sven',
      ),
    ));
    expect(find.byIcon(Icons.mic_rounded), findsOneWidget);

    // Transition to rejected — triggers didUpdateWidget + timer.
    await tester.pumpWidget(_harness(
      WakeWordStatusIndicator(
        status: WakeWordStatus.rejected,
        tokens: _testTokens(),
        phrase: 'Hey Sven',
      ),
    ));
    expect(find.byIcon(Icons.hearing_disabled_rounded), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 1700));

    expect(find.byIcon(Icons.mic_rounded), findsOneWidget);
    expect(find.byIcon(Icons.hearing_disabled_rounded), findsNothing);
  });

  testWidgets('tooltip shows phrase when listening', (tester) async {
    await tester.pumpWidget(_harness(
      WakeWordStatusIndicator(
        status: WakeWordStatus.listening,
        tokens: _testTokens(),
        phrase: 'Hey Sven',
      ),
    ));

    final tooltip = tester.widget<Tooltip>(find.byType(Tooltip));
    expect(tooltip.message, contains('Hey Sven'));
  });

  testWidgets('icon size is 18', (tester) async {
    await tester.pumpWidget(_harness(
      WakeWordStatusIndicator(
        status: WakeWordStatus.listening,
        tokens: _testTokens(),
        phrase: 'Hey Sven',
      ),
    ));

    final icon = tester.widget<Icon>(find.byIcon(Icons.mic_rounded));
    expect(icon.size, 18);
  });

  testWidgets('transitions from idle to listening shows icon', (tester) async {
    await tester.pumpWidget(_harness(
      WakeWordStatusIndicator(
        status: WakeWordStatus.idle,
        tokens: _testTokens(),
        phrase: 'Hey Sven',
      ),
    ));

    expect(find.byType(Icon), findsNothing);

    // Rebuild with listening status.
    await tester.pumpWidget(_harness(
      WakeWordStatusIndicator(
        status: WakeWordStatus.listening,
        tokens: _testTokens(),
        phrase: 'Hey Sven',
      ),
    ));

    expect(find.byIcon(Icons.mic_rounded), findsOneWidget);
  });
}
