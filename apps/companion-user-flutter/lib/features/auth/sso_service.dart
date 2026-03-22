/// SSO / OAuth helper for Sven — Google, Apple, GitHub.
///
/// Each `signInWith*` method resolves to a [SsoCredential] containing the
/// provider-issued ID token (or authorisation code), which [AuthService]
/// exchanges for a Sven session token via `POST /v1/auth/sso`.
///
/// All methods throw [SsoException] on failure or cancellation — never null.
///
/// Compile-time configuration (pass via `--dart-define`):
///   SVEN_GOOGLE_CLIENT_ID  — required on web / macOS / Windows
///   SVEN_GITHUB_CLIENT_ID  — required for GitHub OAuth (replace placeholder)
library;

import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Data types
// ─────────────────────────────────────────────────────────────────────────────

/// Credential returned by a completed SSO flow.
///
/// Pass to [AuthService.loginWithSso] to obtain a Sven session token.
class SsoCredential {
  const SsoCredential({
    required this.provider,
    required this.idToken,
    this.accessToken,
    this.nonce,
  });

  /// One of `'google'`, `'apple'`, `'github'`.
  final String provider;

  /// Provider-issued ID token, or OAuth authorisation code (GitHub).
  final String idToken;

  /// Optional access token (Google only).
  final String? accessToken;

  /// Plain-text nonce whose SHA-256 was sent to Apple (Apple sign-in only).
  final String? nonce;
}

/// Thrown when an SSO flow fails, is cancelled, or returns an unexpected result.
class SsoException implements Exception {
  const SsoException(this.message);

  final String message;

  @override
  String toString() => 'SsoException: $message';
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

/// Orchestrates native and browser-based OAuth sign-in flows.
class SsoService {
  // ── Compile-time OAuth configuration ──────────────────────────────────────

  /// Google OAuth 2.0 client ID.
  /// Required on web, macOS, and Windows. On Android the SHA-1 fingerprint
  /// added to Firebase / Google Cloud Console is used instead.
  static const _googleClientId = String.fromEnvironment(
    'SVEN_GOOGLE_CLIENT_ID',
    defaultValue: '',
  );

  /// GitHub OAuth App client ID.
  /// Create an OAuth App at https://github.com/settings/developers and set the
  /// callback URL to `sven://oauth/github`.
  static const _githubClientId = String.fromEnvironment(
    'SVEN_GITHUB_CLIENT_ID',
    defaultValue: 'REPLACE_GITHUB_CLIENT_ID',
  );

  /// Custom URL scheme registered for OAuth callbacks.
  /// Must match `android/app/src/main/AndroidManifest.xml` intent-filter and
  /// `ios/Runner/Info.plist` CFBundleURLSchemes entry.
  static const _callbackScheme = 'sven';

  // ── Google ─────────────────────────────────────────────────────────────────

  /// Opens the Google sign-in sheet and returns a credential containing the
  /// user's ID token.
  ///
  /// Throws [SsoException] if the user cancels or no ID token is present.
  Future<SsoCredential> signInWithGoogle() async {
    final gsi = GoogleSignIn(
      // clientId is only required on web and macOS/Windows desktop;
      // Android derives it from google-services.json automatically.
      clientId: (kIsWeb ||
              defaultTargetPlatform == TargetPlatform.macOS ||
              defaultTargetPlatform == TargetPlatform.windows ||
              defaultTargetPlatform == TargetPlatform.linux)
          ? (_googleClientId.isEmpty ? null : _googleClientId)
          : null,
      scopes: const ['openid', 'email'],
    );

    GoogleSignInAccount? account;
    try {
      account = await gsi.signIn();
    } catch (e) {
      throw SsoException('Google sign-in failed: $e');
    }

    if (account == null) throw const SsoException('Google sign-in cancelled');

    final auth = await account.authentication;
    final idToken = auth.idToken;
    if (idToken == null || idToken.isEmpty) {
      // Common cause: SHA-1 fingerprint not added to Firebase/Google Console.
      throw const SsoException(
        'Google: ID token unavailable — verify SHA-1 fingerprint or SVEN_GOOGLE_CLIENT_ID',
      );
    }
    return SsoCredential(
      provider: 'google',
      idToken: idToken,
      accessToken: auth.accessToken,
    );
  }

  // ── Apple ───────────────────────────────────────────────────────────────────

  /// Opens the "Sign in with Apple" sheet.
  ///
  /// On iOS and macOS this is native ASAuthorizationController.
  /// On Android and web Apple's redirect service is used — requires a Services
  /// ID registered in Apple Developer portal with a matching return URL.
  ///
  /// Throws [SsoException] if the user cancels or no identity token is returned.
  Future<SsoCredential> signInWithApple() async {
    final rawNonce = _generateNonce();
    final hashedNonce = _sha256(rawNonce);

    AuthorizationCredentialAppleID credential;
    try {
      credential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
        nonce: hashedNonce,
      );
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) {
        throw const SsoException('Apple sign-in cancelled');
      }
      throw SsoException('Apple sign-in failed: ${e.message}');
    } catch (e) {
      throw SsoException('Apple sign-in failed: $e');
    }

    final idToken = credential.identityToken;
    if (idToken == null || idToken.isEmpty) {
      throw const SsoException('Apple: identity token unavailable');
    }
    return SsoCredential(
      provider: 'apple',
      idToken: idToken,
      nonce: rawNonce, // plain nonce — backend verifies via SHA-256
    );
  }

  // ── GitHub ──────────────────────────────────────────────────────────────────

  /// Opens GitHub's OAuth authorisation page in a browser tab/WebView and
  /// captures the authorisation code from the redirect URL.
  ///
  /// The Sven backend performs the token exchange server-side (keeps the
  /// client secret out of the app).
  ///
  /// Throws [SsoException] if the user cancels or no code is returned.
  Future<SsoCredential> signInWithGitHub() async {
    final state = _generateNonce(length: 16);
    final authUrl = Uri.https('github.com', '/login/oauth/authorize', {
      'client_id': _githubClientId,
      'scope': 'user:email',
      'redirect_uri': '$_callbackScheme://oauth/github',
      'state': state,
    });

    String result;
    try {
      result = await FlutterWebAuth2.authenticate(
        url: authUrl.toString(),
        callbackUrlScheme: _callbackScheme,
      );
    } catch (e) {
      throw SsoException('GitHub sign-in cancelled or failed: $e');
    }

    final uri = Uri.parse(result);

    // CSRF guard.
    if (uri.queryParameters['state'] != state) {
      throw const SsoException('GitHub: CSRF check failed (state mismatch)');
    }

    final code = uri.queryParameters['code'];
    if (code == null || code.isEmpty) {
      throw const SsoException('GitHub: no authorisation code returned');
    }

    // idToken carries the OAuth code — backend exchanges for a real token.
    return SsoCredential(provider: 'github', idToken: code);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  static String _generateNonce({int length = 32}) {
    const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    final rng = Random.secure();
    return List.generate(length, (_) => chars[rng.nextInt(chars.length)])
        .join();
  }

  static String _sha256(String input) =>
      sha256.convert(utf8.encode(input)).toString();
}
