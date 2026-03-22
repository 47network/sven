/// Named route paths for the entire application.
///
/// All navigation in Sven funnels through these constants so that path strings
/// are never duplicated across files.  The [GoRouter] instance lives in
/// [_SvenUserAppState._buildRouter] where it has closure access to the
/// services instantiated there.
///
/// Deep-link URL scheme:  sven://
///   sven://approvals          → [homeApprovals]
///   sven://chat/<id>          → [homeChat]
library;

// ── Top-level paths ──────────────────────────────────────────────────────────

/// First-time deployment / admin setup.
const appRouteSetup = '/setup';

/// First-run onboarding wizard.
const appRouteOnboarding = '/onboarding';

/// Login screen.
const appRouteLogin = '/login';

/// MFA / 2FA verification screen — shown after password login when the
/// account has two-factor authentication enabled.
const appRouteMfa = '/mfa';

/// Authenticated shell — all post-login content lives here.
const appRouteHome = '/home';

// ── Sub-paths under /home ────────────────────────────────────────────────────

/// Approvals list (reachable via deep link: sven://approvals).
const appRouteHomeApprovals = '/home/approvals';

/// Chat thread deep-link helper.  Pass the thread id to get a pushable path.
///
/// Example:
/// ```dart
/// _router.push(appRouteHomeChat('abc123'));
/// ```
String appRouteHomeChat(String chatId) => '/home/chat/$chatId';
