import 'package:flutter_test/flutter_test.dart';
import 'package:sven_user_flutter/app/app_state.dart';
import 'package:sven_user_flutter/app/sven_user_app.dart';
import 'package:sven_user_flutter/features/auth/auth_errors.dart';

void main() {
  test('stored session is only invalidated for auth failures', () {
    expect(shouldInvalidateStoredSession(AuthFailure.sessionExpired), isTrue);
    expect(
        shouldInvalidateStoredSession(AuthFailure.invalidCredentials), isTrue);
    expect(shouldInvalidateStoredSession(AuthFailure.network), isFalse);
    expect(shouldInvalidateStoredSession(AuthFailure.server), isFalse);
    expect(shouldInvalidateStoredSession(AuthFailure.unknown), isFalse);
  });

  test('logout reset preserves onboarding completion', () {
    final state = AppState();
    state.onboardingComplete = true;

    state.resetForLogout();

    expect(state.onboardingComplete, isTrue);
    expect(state.isLoggedIn, isFalse);
    expect(state.mfaRequired, isFalse);
  });
}
