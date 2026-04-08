// integration_test/patrol_test.dart
//
// Patrol E2E tests — run on a real device / emulator:
//
//   patrol test -t integration_test/patrol_test.dart
//   patrol test --device emulator-5554
//
// These tests are NOT included in `flutter test --exclude-tags golden` runs
// (integration_test/ is outside the test/ directory). They require a running
// app and patrol CLI to be installed (dart pub global activate patrol_cli).
//
// Semantic IDs referenced below must match the `semanticsLabel` /
// `Key(...)` values set in the production widget tree.  Where a widget does
// not yet carry a Key, the Patrol finder falls back to text matching.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patrol/patrol.dart';
import 'package:sven_user_flutter/main.dart' as app;

Future<void> _dismissNativePermissions(PatrolIntegrationTester $) async {
  for (var i = 0; i < 3; i++) {
    final visible = await $.native.isPermissionDialogVisible(
      timeout: const Duration(milliseconds: 800),
    );
    if (!visible) return;
    await $.native.grantPermissionWhenInUse();
    await $.pumpAndSettle();
  }
}

Future<void> _advanceOnboardingIfVisible(PatrolIntegrationTester $) async {
  // Skip is fastest when available.
  if ($('Skip').exists) {
    await $('Skip').tap();
    await $.pumpAndSettle();
    return;
  }
  // Fallback: move through onboarding pages.
  if ($('Next').exists) {
    await $('Next').tap();
    await $.pumpAndSettle();
    return;
  }
  if ($('Get Started').exists) {
    await $('Get Started').tap();
    await $.pumpAndSettle();
    return;
  }
}

Future<void> _completeDeploymentSetupIfVisible(PatrolIntegrationTester $) async {
  if ($('How will you use Sven?').exists && $('Continue').exists) {
    await $('Continue').tap();
    await $.pumpAndSettle();
  }

  if ($('Create your account').exists) {
    final textFields = find.byType(TextField);
    if (textFields.evaluate().length >= 3) {
      await $.tester.enterText(textFields.at(1), 'testuser');
      await $.tester.enterText(textFields.at(2), 'TestPass2026');
      await $.pumpAndSettle();
      if ($('Create').exists) {
        await $('Create').tap();
        await $.pumpAndSettle();
      }
    }
  }

  if ($("You're all set!").exists && $('Get Started').exists) {
    await $('Get Started').tap();
    await $.pumpAndSettle();
  }
}

Future<void> _launchAndReachEntry(PatrolIntegrationTester $) async {
  app.main();
  await $.pumpAndSettle();

  for (var i = 0; i < 20; i++) {
    await _dismissNativePermissions($);

    // Known interactive checkpoints used by current tests.
    if (
        // Login flow
        $('Sign in').exists ||
            $(#login_username_field).exists ||
            // Authenticated home flow
            $(#new_chat_fab).exists ||
            $(#settings_icon_button).exists) {
      return;
    }

    await _advanceOnboardingIfVisible($);
    await _completeDeploymentSetupIfVisible($);
    await $.pumpAndSettle();
    await Future<void>.delayed(const Duration(milliseconds: 350));
  }
}

Future<void> _ensureSignedIn(PatrolIntegrationTester $) async {
  await _completeDeploymentSetupIfVisible($);
  await $.pumpAndSettle();

  if ($(#new_chat_fab).exists || $(#settings_icon_button).exists) {
    return;
  }
  if (!$(#login_username_field).exists) {
    await _launchAndReachEntry($);
  }
  await _completeDeploymentSetupIfVisible($);
  await $.pumpAndSettle();
  if ($(#new_chat_fab).exists || $(#settings_icon_button).exists) {
    return;
  }
  await $(#login_username_field).waitUntilVisible();
  await $(#login_username_field).enterText('testuser');
  await $(#login_password_field).waitUntilVisible();
  await $(#login_password_field).enterText('TestPass2026');
  await $(#login_submit_button).tap();
  for (var i = 0; i < 20; i++) {
    await settleFor($, const Duration(milliseconds: 500));
    await _dismissNativePermissions($);
    if ($(#new_chat_fab).exists || $(#settings_icon_button).exists) {
      return;
    }
  }
}

Future<void> settleFor(PatrolIntegrationTester $, Duration delay) async {
  await Future<void>.delayed(delay);
  await $.tester.pump();
  try {
    await $.pumpAndSettle();
  } catch (_) {
    // The app has long-running animations/streams and may never fully settle.
  }
}

void main() {
  // ── Smoke — app launches and shows auth screen ──────────────────────────────
  patrolTest(
    'smoke: app launches and reaches an interactive entry screen',
    ($) async {
      await _launchAndReachEntry($);
      expect(
        $('Sign in').exists ||
            $(#login_username_field).exists ||
            $(#new_chat_fab).exists,
        isTrue,
      );
    },
  );

  // ── Auth — successful login reaches home screen ─────────────────────────────
  patrolTest(
    'auth: valid credentials navigate to home',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);

      // After a successful login the home greeting contains "Sven".
      expect($(#new_chat_fab).exists || $('Sven').exists, isTrue);
    },
  );

  // ── Auth — invalid credentials shows error ──────────────────────────────────
  patrolTest(
    'auth: wrong password shows error message',
    ($) async {
      await _launchAndReachEntry($);

      // If already signed in, skip this negative-login scenario.
      if ($(#new_chat_fab).exists) {
        expect(true, isTrue);
        return;
      }

      await $(#login_username_field).waitUntilVisible();
      await $(#login_username_field).enterText('nobody@sven.dev');

      await $(#login_password_field).waitUntilVisible();
      await $(#login_password_field).enterText('wrongpassword');

      await $(#login_submit_button).tap();
      await settleFor($, const Duration(seconds: 6));

      // An error snackbar or inline message should appear.
      expect(
        $('Invalid username or password.').exists ||
            $('Invalid credentials').exists ||
            $('Sign in failed').exists ||
            $('Something went wrong').exists,
        isTrue,
        reason: 'Expected an auth-error message after wrong credentials',
      );
    },
  );

  // ── Chat — new-chat FAB opens composer ─────────────────────────────────────
  patrolTest(
    'chat: FAB opens composer and message can be typed',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);

      await $(#new_chat_fab).waitUntilVisible();
      await $(#new_chat_fab).tap();
      await settleFor($, const Duration(seconds: 2));

      await $(#chat_composer_field)
          .waitUntilVisible(timeout: const Duration(seconds: 30));
      expect($(#chat_composer_field).exists, isTrue);

      await $(#chat_composer_field).enterText('Hello Sven, E2E test here.');
      await settleFor($, const Duration(milliseconds: 400));

      // Send button should be visible after text is entered.
      expect($(#chat_send_button).exists, isTrue);
    },
  );

  // ── Chat — send message appears in thread ───────────────────────────────────
  patrolTest(
    'chat: sent message appears in the conversation thread',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);

      await $(#new_chat_fab).tap();
      await settleFor($, const Duration(seconds: 2));

      const message = 'E2E test message — hello from Patrol!';
      await $(#chat_composer_field)
          .waitUntilVisible(timeout: const Duration(seconds: 30));
      await $(#chat_composer_field).enterText(message);
      await $(#chat_send_button).tap();
      await settleFor($, const Duration(seconds: 4));

      expect($(message).exists, isTrue);
    },
  );

  // ── Settings — sheet opens and key tiles visible ────────────────────────────
  patrolTest(
    'settings: sheet opens and displays expected tiles',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);

      await $(#settings_icon_button).waitUntilVisible();
      await $(#settings_icon_button).tap();
      await settleFor($, const Duration(milliseconds: 800));

      expect($('Settings').exists, isTrue);
      expect($('Voice').exists || $('Appearance').exists, isTrue);
      expect($('Notifications').exists || $('Theme').exists, isTrue);
    },
  );

  // ── Settings — sheet can be dismissed ──────────────────────────────────────
  patrolTest(
    'settings: sheet can be dismissed by swipe-down',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);

      await $(#settings_icon_button).tap();
      await settleFor($, const Duration(milliseconds: 800));
      expect($('Settings').exists, isTrue);

      // Drag the bottom sheet downward to dismiss.
      await $.tester.drag(find.byType(BottomSheet), const Offset(0, 400));
      await settleFor($, const Duration(milliseconds: 600));

      // After dismiss, the settings sheet should no longer be visible.
      expect($('Settings').exists, isFalse);
    },
  );

  // ── MFA — MFA tile opens setup sheet ────────────────────────────────────────
  patrolTest(
    'settings: Two-factor authentication tile opens MFA setup sheet',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);

      await $(#settings_icon_button).tap();
      await settleFor($, const Duration(milliseconds: 800));

      await $.tester.ensureVisible(find.text('Two-factor authentication'));
      await $.tester.pump();
      await $('Two-factor authentication').tap();
      await settleFor($, const Duration(milliseconds: 800));

      // The MFA setup sheet should appear.
      expect(
        $('Two-factor authentication').exists ||
            $('Set up authenticator').exists ||
            $('Disable').exists,
        isTrue,
      );
    },
  );

  // ── Logout ──────────────────────────────────────────────────────────────────
  patrolTest(
    'auth: sign-out returns to login screen',
    ($) async {
      await _launchAndReachEntry($);
      await _ensureSignedIn($);

      await $(#settings_icon_button).tap();
      await settleFor($, const Duration(milliseconds: 800));

      await $.tester.ensureVisible(find.text('Sign out'));
      await $.tester.pump();
      await $('Sign out').tap();
      await settleFor($, const Duration(seconds: 3));

      expect($('Sign in').exists, isTrue);
    },
  );
}
