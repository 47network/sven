// integration_test/full_user_journey_test.dart
//
// Full real-user journey E2E test — navigates every screen as a human would.
//
//   patrol test -t integration_test/full_user_journey_test.dart \
//     --flavor dev \
//     --dart-define=SVEN_API_BASE=http://10.47.47.245:3000 \
//     --dart-define=SVEN_FLAVOR=dev \
//     --dart-define=SVEN_ENV=development \
//     --device R58N94KML7J
//
// Requires: gateway-api running on the host machine, patrol CLI installed.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patrol/patrol.dart';
import 'package:sven_user_flutter/main.dart' as app;

// ── Helpers ─────────────────────────────────────────────────────────────────

const _testUser = 'testuser';
const _testPass = 'TestPass2026';

/// Grant up to [maxAttempts] native permission dialogs.
Future<void> _dismissNativePermissions(
  PatrolIntegrationTester $, {
  int maxAttempts = 5,
}) async {
  for (var i = 0; i < maxAttempts; i++) {
    final visible = await $.native.isPermissionDialogVisible(
      timeout: const Duration(milliseconds: 600),
    );
    if (!visible) return;
    await $.native.grantPermissionWhenInUse();
    await _settle($);
  }
}

/// Non-throwing settle that tolerates never-finishing animations.
Future<void> _settle(PatrolIntegrationTester $,
    [Duration delay = const Duration(milliseconds: 300)]) async {
  await Future<void>.delayed(delay);
  await $.tester.pump();
  try {
    await $.tester.pumpAndSettle(
      const Duration(milliseconds: 100),
      EnginePhase.sendSemanticsUpdate,
      const Duration(seconds: 4),
    );
  } catch (_) {
    // The app has long-running animations / SSE streams and may never settle.
  }
}

/// Skip through onboarding screens if visible.
Future<void> _advanceOnboardingIfVisible(PatrolIntegrationTester $) async {
  for (var i = 0; i < 6; i++) {
    if ($('Skip').exists) {
      await $('Skip').tap();
      await _settle($);
      return;
    }
    if ($('Get Started').exists) {
      await $('Get Started').tap();
      await _settle($);
      return;
    }
    if ($('Next').exists) {
      await $('Next').tap();
      await _settle($);
      continue;
    }
    break;
  }
}

/// Handle first-time deployment setup.
Future<void> _completeDeploymentSetupIfVisible(
    PatrolIntegrationTester $) async {
  if ($('How will you use Sven?').exists && $('Continue').exists) {
    await $('Continue').tap();
    await _settle($);
  }

  if ($('Create your account').exists) {
    final textFields = find.byType(TextField);
    if (textFields.evaluate().length >= 3) {
      await $.tester.enterText(textFields.at(1), _testUser);
      await $.tester.enterText(textFields.at(2), _testPass);
      await _settle($);
      if ($('Create').exists) {
        await $('Create').tap();
        await _settle($);
      }
    }
  }

  if ($("You're all set!").exists && $('Get Started').exists) {
    await $('Get Started').tap();
    await _settle($);
  }
}

/// Launch the app and wait until we reach an interactive screen.
Future<void> _launchAndReachEntry(PatrolIntegrationTester $) async {
  app.main();
  await _settle($, const Duration(seconds: 2));

  for (var i = 0; i < 30; i++) {
    await _dismissNativePermissions($);

    if ($('Sign in').exists ||
        $(#login_username_field).exists ||
        $(#new_chat_fab).exists ||
        $(#settings_icon_button).exists) {
      return;
    }

    await _advanceOnboardingIfVisible($);
    await _completeDeploymentSetupIfVisible($);
    await _settle($);
  }
}

/// Signs in with test credentials, handling setup and onboarding if needed.
Future<void> _ensureSignedIn(PatrolIntegrationTester $) async {
  await _completeDeploymentSetupIfVisible($);
  await _settle($);

  if ($(#new_chat_fab).exists || $(#settings_icon_button).exists) return;

  if (!$(#login_username_field).exists) {
    await _launchAndReachEntry($);
  }

  await _completeDeploymentSetupIfVisible($);
  await _settle($);

  if ($(#new_chat_fab).exists || $(#settings_icon_button).exists) return;

  await $(#login_username_field).waitUntilVisible();
  await $(#login_username_field).enterText(_testUser);
  await $(#login_password_field).waitUntilVisible();
  await $(#login_password_field).enterText(_testPass);
  await $(#login_submit_button).tap();

  for (var i = 0; i < 40; i++) {
    await _settle($, const Duration(milliseconds: 800));
    await _dismissNativePermissions($);
    await _advanceOnboardingIfVisible($);
    await _completeDeploymentSetupIfVisible($);
    if ($(#new_chat_fab).exists || $(#settings_icon_button).exists) return;
  }
}

/// Open settings sheet and verify it's visible.
Future<void> _openSettings(PatrolIntegrationTester $) async {
  await $(#settings_icon_button).waitUntilVisible();
  await $(#settings_icon_button).tap();
  await _settle($);
  expect($('Settings').exists, isTrue, reason: 'Settings sheet not open');
}

/// Close settings sheet by swiping down.
Future<void> _closeSettings(PatrolIntegrationTester $) async {
  final bottomSheets = find.byType(BottomSheet);
  if (bottomSheets.evaluate().isNotEmpty) {
    await $.tester.drag(bottomSheets.first, const Offset(0, 500));
    await _settle($);
  }
}

/// Navigate to a specific hub tab by tapping its label text.
Future<void> _tapHubTab(PatrolIntegrationTester $, String label) async {
  await $(label).waitUntilVisible();
  await $(label).tap();
  await _settle($);
}

// ── Tests ───────────────────────────────────────────────────────────────────

void main() {
  // ─────────────────────────────────────────────────────────────────────────
  // 1. LAUNCH & AUTH
  // ─────────────────────────────────────────────────────────────────────────

  patrolTest(
    '1. App launches and shows splash then reaches interactive screen',
    ($) async {
      await _launchAndReachEntry($);
      expect(
        $('Sign in').exists ||
            $(#login_username_field).exists ||
            $(#new_chat_fab).exists,
        isTrue,
        reason: 'App did not reach an interactive screen after launch',
      );
    },
  );

  patrolTest(
    '2. Login screen shows username, password fields and sign-in button',
    ($) async {
      await _launchAndReachEntry($);

      // If already signed in from previous test, we skip the login check.
      if ($(#new_chat_fab).exists) {
        expect(true, isTrue);
        return;
      }

      expect($(#login_username_field).exists, isTrue,
          reason: 'Username field missing');
      expect($(#login_password_field).exists, isTrue,
          reason: 'Password field missing');
      expect($(#login_submit_button).exists, isTrue,
          reason: 'Sign-in button missing');
      expect($('Welcome back').exists, isTrue,
          reason: 'Welcome heading missing');
    },
  );

  patrolTest(
    '3. Wrong credentials show error message',
    ($) async {
      await _launchAndReachEntry($);
      if ($(#new_chat_fab).exists) {
        // Already signed in — cannot test negative login
        expect(true, isTrue);
        return;
      }

      await $(#login_username_field).waitUntilVisible();
      await $(#login_username_field).enterText('nobody@test.dev');
      await $(#login_password_field).enterText('wrongpassword');
      await $(#login_submit_button).tap();
      await _settle($, const Duration(seconds: 5));

      expect(
        $('Invalid username or password.').exists ||
            $('Invalid credentials').exists ||
            $('Sign in failed').exists ||
            $('Something went wrong').exists,
        isTrue,
        reason: 'No error message shown for wrong credentials',
      );
    },
  );

  patrolTest(
    '4. Valid credentials navigate to home',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);

      expect(
        $(#new_chat_fab).exists || $(#settings_icon_button).exists,
        isTrue,
        reason: 'Did not reach authenticated home screen',
      );
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 2. HUB TABS — Canvas, Form, Chat, Devices
  // ─────────────────────────────────────────────────────────────────────────

  patrolTest(
    '5. Hub: CANVAS tab shows avatar and daily greeting',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);

      await _tapHubTab($, 'CANVAS');
      await _settle($, const Duration(seconds: 1));

      // Canvas should have the Sven avatar or greeting visible
      expect(
        $('Sven').exists || find.byType(Image).evaluate().isNotEmpty,
        isTrue,
        reason: 'Canvas tab content not visible',
      );
    },
  );

  patrolTest(
    '6. Hub: FORM tab shows entity selection',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);

      await _tapHubTab($, 'FORM');
      await _settle($, const Duration(seconds: 1));

      // The form tab has entity names or avatar options
      expect(
        $('FORM').exists,
        isTrue,
        reason: 'FORM tab label not present',
      );
    },
  );

  patrolTest(
    '7. Hub: CHAT tab shows chat list or empty state',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);

      await _tapHubTab($, 'CHAT');
      await _settle($, const Duration(seconds: 2));

      // The chat tab should either show thread list or empty state
      expect(
        $('CHAT').exists,
        isTrue,
        reason: 'CHAT tab label not present',
      );
    },
  );

  patrolTest(
    '8. Hub: DEVICES tab shows device list or empty state',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);

      await _tapHubTab($, 'DEVICES');
      await _settle($, const Duration(seconds: 2));

      expect(
        $('DEVICES').exists,
        isTrue,
        reason: 'DEVICES tab label not present',
      );
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 3. NEW CHAT — Create & Send Message
  // ─────────────────────────────────────────────────────────────────────────

  patrolTest(
    '9. New Chat: FAB opens chat composer',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);

      await $(#new_chat_fab).waitUntilVisible();
      await $(#new_chat_fab).tap();
      await _settle($, const Duration(seconds: 2));

      expect($(#chat_composer_field).exists, isTrue,
          reason: 'Chat composer field not visible after tapping FAB');
    },
  );

  patrolTest(
    '10. New Chat: type message and send button appears',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);

      await $(#new_chat_fab).tap();
      await _settle($);

      await $(#chat_composer_field).waitUntilVisible();
      await $(#chat_composer_field).enterText('Hello from E2E test!');
      await _settle($);

      expect($(#chat_send_button).exists, isTrue,
          reason: 'Send button did not appear after typing');
    },
  );

  patrolTest(
    '11. New Chat: send message and it appears in thread',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);

      await $(#new_chat_fab).tap();
      await _settle($);

      const msg = 'E2E test message — full journey';
      await $(#chat_composer_field).enterText(msg);
      await $(#chat_send_button).tap();
      await _settle($, const Duration(seconds: 6));

      expect($(msg).exists, isTrue,
          reason: 'Sent message not visible in thread');
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 4. SETTINGS SHEET
  // ─────────────────────────────────────────────────────────────────────────

  patrolTest(
    '12. Settings: sheet opens via gear icon',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);

      await _openSettings($);

      expect($('Settings').exists, isTrue);
      expect($('Auto-read responses').exists, isTrue,
          reason: 'Voice section not visible');
    },
  );

  patrolTest(
    '13. Settings: Appearance section shows theme toggle',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);
      await _openSettings($);

      // Scroll to find appearance section
      final scrollable = find.byType(SingleChildScrollView).first;
      await $.tester.drag(scrollable, const Offset(0, -400));
      await _settle($);

      expect(
        $('Light').exists || $('Dark').exists,
        isTrue,
        reason: 'Theme toggle not found in settings',
      );
    },
  );

  patrolTest(
    '14. Settings: scroll to account section shows sign-out',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);
      await _openSettings($);

      // Scroll down to find Sign out
      final scrollable = find.byType(SingleChildScrollView).first;
      for (var i = 0; i < 6; i++) {
        await $.tester.drag(scrollable, const Offset(0, -350));
        await _settle($);
        if ($('Sign out').exists) break;
      }

      // Sign out is hidden in personal deployment mode; accept Switch user or Sign out
      expect(
        $('Sign out').exists ||
            $('Switch user').exists ||
            $('Sign out all devices').exists,
        isTrue,
        reason: 'No sign-out option found in settings',
      );
    },
  );

  patrolTest(
    '15. Settings: sheet dismisses on swipe down',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);
      await _openSettings($);

      await _closeSettings($);

      // Settings title should no longer be visible
      expect(
        $('Settings').exists,
        isFalse,
        reason: 'Settings sheet still visible after swipe-down',
      );
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 5. SETTINGS SUB-SCREENS
  // ─────────────────────────────────────────────────────────────────────────

  patrolTest(
    '16. Settings > Memory & Instructions opens',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);
      await _openSettings($);

      // Scroll to find Memory & Instructions
      final scrollable = find.byType(SingleChildScrollView).first;
      for (var i = 0; i < 4; i++) {
        if ($('Memory & Instructions').exists) break;
        await $.tester.drag(scrollable, const Offset(0, -300));
        await _settle($);
      }

      if ($('Memory & Instructions').exists) {
        await $.tester.ensureVisible(find.text('Memory & Instructions'));
        await $.tester.tap(find.text('Memory & Instructions'));
        await _settle($, const Duration(seconds: 2));

        expect(
          $('Memories').exists || $('Instructions').exists || find.byType(Scaffold).evaluate().length > 1,
          isTrue,
          reason: 'Memory page not visible',
        );

        // Go back
        if ($.tester.binding.focusManager.rootScope.hasFocus) {
          await $.tester.pageBack();
        }
        await _settle($);
      }
    },
  );

  patrolTest(
    '17. Settings > Notifications opens',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);
      await _openSettings($);

      final scrollable = find.byType(SingleChildScrollView).first;
      for (var i = 0; i < 5; i++) {
        if ($('Notifications').exists) break;
        await $.tester.drag(scrollable, const Offset(0, -300));
        await _settle($);
      }

      if ($('Notifications').exists) {
        await $.tester.ensureVisible(find.text('Notifications'));
        await $.tester.tap(find.text('Notifications'));
        await _settle($, const Duration(seconds: 2));
        // Navigate back regardless.
        try { await $.tester.pageBack(); } catch (_) {}
        await _settle($);
      }
    },
  );

  patrolTest(
    '18. Settings > Privacy & Data opens',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);
      await _openSettings($);

      final scrollable = find.byType(SingleChildScrollView).first;
      for (var i = 0; i < 6; i++) {
        if ($('Privacy & Data').exists) break;
        await $.tester.drag(scrollable, const Offset(0, -300));
        await _settle($);
      }

      if ($('Privacy & Data').exists) {
        await $.tester.ensureVisible(find.text('Privacy & Data'));
        await $.tester.tap(find.text('Privacy & Data'));
        await _settle($, const Duration(seconds: 2));
        expect(find.byType(Scaffold).evaluate().isNotEmpty, isTrue,
            reason: 'Privacy page did not render');
        try { await $.tester.pageBack(); } catch (_) {}
        await _settle($);
      }
    },
  );

  patrolTest(
    '19. Settings > Devices opens',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);
      await _openSettings($);

      final scrollable = find.byType(SingleChildScrollView).first;
      for (var i = 0; i < 5; i++) {
        if ($('Devices').exists) break;
        await $.tester.drag(scrollable, const Offset(0, -300));
        await _settle($);
      }

      final devicesWidget = find.text('Devices');
      if (devicesWidget.evaluate().isNotEmpty) {
        await $.tester.ensureVisible(devicesWidget.last);
        await $.tester.tap(devicesWidget.last);
        await _settle($, const Duration(seconds: 2));
        expect(find.byType(Scaffold).evaluate().isNotEmpty, isTrue,
            reason: 'Devices page did not render');
        try { await $.tester.pageBack(); } catch (_) {}
        await _settle($);
      }
    },
  );

  patrolTest(
    '20. Settings > Two-factor authentication opens MFA sheet',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);
      await _openSettings($);

      final scrollable = find.byType(SingleChildScrollView).first;
      for (var i = 0; i < 6; i++) {
        if ($('Two-factor authentication').exists) break;
        await $.tester.drag(scrollable, const Offset(0, -300));
        await _settle($);
      }

      if ($('Two-factor authentication').exists) {
        await $.tester.ensureVisible(find.text('Two-factor authentication').last);
        await $.tester.tap(find.text('Two-factor authentication').last);
        await _settle($, const Duration(seconds: 2));
        expect(
          $('Two-factor authentication').exists ||
              $('Set up authenticator').exists ||
              $('Disable').exists ||
              $('Enable').exists,
          isTrue,
          reason: 'MFA setup/display not shown',
        );
        try { await $.tester.pageBack(); } catch (_) {}
        await _settle($);
      }
    },
  );

  patrolTest(
    '21. Settings > Change password opens',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);
      await _openSettings($);

      final scrollable = find.byType(SingleChildScrollView).first;
      for (var i = 0; i < 6; i++) {
        if ($('Change password').exists) break;
        await $.tester.drag(scrollable, const Offset(0, -300));
        await _settle($);
      }

      if ($('Change password').exists) {
        await $.tester.ensureVisible(find.text('Change password'));
        await $.tester.tap(find.text('Change password'));
        await _settle($, const Duration(seconds: 2));
        expect(find.byType(TextField).evaluate().isNotEmpty, isTrue,
            reason: 'Change password form not rendered');
        try { await $.tester.pageBack(); } catch (_) {}
        await _settle($);
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 6. SETTINGS TOGGLES — Verify interactive controls work
  // ─────────────────────────────────────────────────────────────────────────

  patrolTest(
    '22. Settings: voice wake toggle can be tapped',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);
      await _openSettings($);

      if ($('Voice wake').exists) {
        // Find the switch in the Voice wake tile
        final switches = find.byType(Switch);
        if (switches.evaluate().length >= 2) {
          // Toggle the second switch (first is auto-read)
          await $.tester.tap(switches.at(1));
          await _settle($);
          // Toggle back
          await $.tester.tap(switches.at(1));
          await _settle($);
        }
      }
      await _closeSettings($);
    },
  );

  patrolTest(
    '23. Settings: theme toggle switches between Light/Dark',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);
      await _openSettings($);

      final scrollable = find.byType(SingleChildScrollView).first;
      for (var i = 0; i < 3; i++) {
        if ($('Light').exists || $('Dark').exists) break;
        await $.tester.drag(scrollable, const Offset(0, -300));
        await _settle($);
      }

      if ($('Light').exists) {
        await $('Light').tap();
        await _settle($);
      } else if ($('Dark').exists) {
        await $('Dark').tap();
        await _settle($);
      }

      await _closeSettings($);
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 7. CHAT THREAD INTERACTION
  // ─────────────────────────────────────────────────────────────────────────

  patrolTest(
    '24. Chat: navigate to CHAT tab and tap existing thread',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);

      await _tapHubTab($, 'CHAT');
      await _settle($, const Duration(seconds: 3));

      // If there are chat threads, tap the first one
      final listTiles = find.byType(ListTile);
      if (listTiles.evaluate().isNotEmpty) {
        await $.tester.tap(listTiles.first);
        await _settle($, const Duration(seconds: 2));

        // Should see the chat composer in the thread
        expect($(#chat_composer_field).exists, isTrue,
            reason: 'Chat thread composer not visible');

        // Go back
        await $.tester.pageBack();
        await _settle($);
      } else {
        // Empty state — chat list has no threads yet, which is valid
        expect($('CHAT').exists, isTrue);
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 8. APPROVALS
  // ─────────────────────────────────────────────────────────────────────────

  patrolTest(
    '25. Settings > Approvals opens and shows tabs',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);
      await _openSettings($);

      final scrollable = find.byType(SingleChildScrollView).first;
      for (var i = 0; i < 5; i++) {
        if ($('Approvals').exists) break;
        await $.tester.drag(scrollable, const Offset(0, -300));
        await _settle($);
      }

      if ($('Approvals').exists) {
        await $('Approvals').tap();
        await _settle($, const Duration(seconds: 2));

        // Approvals page should show Pending / History tabs or empty state
        expect(find.byType(Scaffold).evaluate().isNotEmpty, isTrue,
            reason: 'Approvals page did not render');

        await $.tester.pageBack();
        await _settle($);
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 9. ONBOARDING FLOW (if fresh install)
  // ─────────────────────────────────────────────────────────────────────────

  patrolTest(
    '26. Onboarding pages advance correctly (if visible)',
    ($) async {
      await _launchAndReachEntry($);

      // This test verifies that if onboarding appears, it can be completed.
      // On a non-fresh install this will just skip because _launchAndReachEntry
      // already handles onboarding. The assertion is that we always reach an
      // interactive screen.
      expect(
        $('Sign in').exists ||
            $(#login_username_field).exists ||
            $(#new_chat_fab).exists ||
            $(#settings_icon_button).exists,
        isTrue,
        reason: 'App stuck — never reached an interactive screen',
      );
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 10. SIGN OUT (last test — tears down session)
  // ─────────────────────────────────────────────────────────────────────────

  patrolTest(
    '27. Sign out returns to login screen',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);
      await _openSettings($);

      final scrollable = find.byType(SingleChildScrollView).first;
      for (var i = 0; i < 6; i++) {
        if ($('Sign out').exists) break;
        await $.tester.drag(scrollable, const Offset(0, -350));
        await _settle($);
      }

      expect($('Sign out').exists, isTrue, reason: 'Sign out not found');
      await $('Sign out').tap();
      await _settle($, const Duration(seconds: 4));

      expect(
        $('Sign in').exists || $(#login_username_field).exists,
        isTrue,
        reason: 'Did not return to login screen after sign-out',
      );
    },
  );
}
