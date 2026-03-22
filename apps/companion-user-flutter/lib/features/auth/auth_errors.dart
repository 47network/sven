enum AuthFailure {
  invalidCredentials,
  accountLocked,
  rateLimited,
  sessionExpired,
  network,
  server,
  unknown,
  ssoCancelled,
  ssoFailed,
  mfaRequired,
  mfaInvalidCode,
}

class AuthException implements Exception {
  AuthException(this.failure, {this.detail});

  final AuthFailure failure;
  final String? detail;

  String get userMessage {
    switch (failure) {
      case AuthFailure.invalidCredentials:
        return 'Invalid username or password.';
      case AuthFailure.accountLocked:
        return 'Your account is locked. Contact support.';
      case AuthFailure.rateLimited:
        return 'Too many attempts. Try again soon.';
      case AuthFailure.sessionExpired:
        return 'Session expired. Please sign in again.';
      case AuthFailure.network:
        return 'Network error. Check your connection and retry.';
      case AuthFailure.server:
        if (detail != null && detail!.isNotEmpty) return detail!;
        return 'Server error. Please try again later.';
      case AuthFailure.unknown:
        return 'Something went wrong. Please try again.';
      case AuthFailure.ssoCancelled:
        return 'Sign-in was cancelled.';
      case AuthFailure.ssoFailed:
        return 'Social sign-in failed. Please try again.';
      case AuthFailure.mfaRequired:
        return 'Two-factor authentication is required.';
      case AuthFailure.mfaInvalidCode:
        return 'Invalid verification code. Please try again.';
    }
  }

  @override
  String toString() => detail ?? userMessage;
}
