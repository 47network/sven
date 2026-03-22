# Flutter User App - Auth Token Lifecycle Audit (2026)

Date: 2026-02-18  
Auditor: System  
Scope: Flutter user app authentication, token storage, and API auth headers

## Executive Summary

This audit validates that the Flutter user app follows secure token handling practices:
- ✅ Access tokens stored in platform secure storage (Keychain/Keystore)
- ✅ Refresh tokens stored in platform secure storage
- ✅ Session expiry detection and automatic cleanup on 401 responses
- ✅ No token logging in production code paths
- ✅ TLS-only API communication (HTTPS enforced)
- ✅ Auth headers properly scoped to authenticated requests only

## Token Storage Implementation

### Mobile (iOS/Android)

**Library:** `flutter_secure_storage` v9.2.4

**Storage locations:**
- iOS: Keychain (encrypted at rest by OS)
- Android: EncryptedSharedPreferences backed by Android Keystore

**Keys used:**
```
sven.auth.access_token
sven.auth.refresh_token
```

**Source:** `apps/companion-user-flutter/lib/features/auth/token_store.dart`

### Web

**Library:** `shared_preferences` (localStorage wrapper)

**Storage location:** Browser localStorage

**Security notes:**
- Web has no true secure storage equivalent to native mobile
- Tokens stored in plaintext localStorage (standard web practice)
- XSS mitigation relies on Content-Security-Policy (CSP)
- Session duration should be shorter for web clients (recommended: 15 min access, 1 day refresh)

**Recommendation:** Consider migrating Flutter Web to use `httpOnly` cookies for token delivery if backend supports it.

## Token Lifecycle Flow

### 1. Login

**Endpoint:** `POST /v1/auth/login`

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "accessToken": "string",
  "refreshToken": "string"
}
```

**Token handling:**
- Access token written to secure storage immediately
- Refresh token written to secure storage immediately
- Password cleared from memory (Dart string is immutable, GC'd)
- No tokens logged

**Telemetry:** Event `auth.login` emitted with success/failure, no token values

**Source:** `apps/companion-user-flutter/lib/features/auth/auth_service.dart:login()`

### 2. Session Restore (Cold Start)

**Flow:**
1. App reads access token from secure storage
2. If no token, show login screen
3. If token exists, call refresh endpoint
4. On success, write new tokens and proceed to app
5. On failure, clear tokens and show login with error message

**Session expiry handling:**
- 401 with `SESSION_EXPIRED` code triggers token clear + login redirect
- Auth message set to: "Session expired. Please sign in again."

**Source:** `apps/companion-user-flutter/lib/app/sven_user_app.dart:_bootstrap()`

### 3. Refresh Token Flow

**Endpoint:** `POST /v1/auth/refresh`

**Request:**
```json
{
  "refreshToken": "string"
}
```

**Response:**
```json
{
  "accessToken": "string",
  "refreshToken": "string"
}
```

**Token rotation:**
- New access token replaces old immediately
- New refresh token replaces old (optional rotation)
- Old tokens never reused

**Error cases:**
- 401 → session expired, token cleared
- 5xx → transient server error, old token retained (no clear)

**Source:** `apps/companion-user-flutter/lib/features/auth/auth_service.dart:refresh()`

### 4. Authenticated API Requests

**Pattern:** All feature services use `AuthenticatedClient`

**Auth header injection:**
```dart
'Authorization': 'Bearer $token'
```

**Session expiry detection:**
- All HTTP responses checked for status 401
- If 401, response body parsed for `SESSION_EXPIRED` code
- On detection: token cleared, callback fired, auth screen shown

**Services using authenticated client:**
- `UiPreferencesService`
- `ApprovalsService`
- `NotificationsService`

**Source:** `apps/companion-user-flutter/lib/app/authenticated_client.dart`

### 5. Logout (Current Session)

**Endpoint:** `POST /v1/auth/logout`

**Token handling:**
- Current access token sent in Authorization header
- Server invalidates session server-side
- Local tokens cleared from secure storage
- User redirected to login

**Source:** `apps/companion-user-flutter/lib/app/sven_user_app.dart:_logout()`

### 6. Logout All Sessions

**Endpoint:** `POST /v1/auth/logout-all`

**Token handling:**
- Current access token sent in Authorization header
- Server invalidates all sessions for this user
- Local tokens cleared from secure storage
- User redirected to login

**Source:** `apps/companion-user-flutter/lib/app/sven_user_app.dart:_logoutAll()`

## API Auth Header Audit

### Header Format

**Standard:** RFC 6750 Bearer Token

**Format:**
```
Authorization: Bearer <access_token>
```

**Scope:** All requests to `/v1/*` except:
- `/v1/auth/login` (no auth header)
- `/v1/health` (no auth header, if public)

### Request Coverage

| Feature | Endpoint | Auth Header | Token Type | Expiry Detection |
|---------|----------|-------------|------------|------------------|
| Login | POST /v1/auth/login | ❌ None | N/A | N/A |
| Refresh | POST /v1/auth/refresh | ❌ None* | Refresh in body | ✅ 401 handled |
| Logout | POST /v1/auth/logout | ✅ Bearer | Access | ✅ 401 handled |
| Logout All | POST /v1/auth/logout-all | ✅ Bearer | Access | ✅ 401 handled |
| UI Prefs Get | GET /v1/me/ui-preferences | ✅ Bearer | Access | ✅ 401 handled |
| UI Prefs Put | PUT /v1/me/ui-preferences | ✅ Bearer | Access | ✅ 401 handled |
| Approvals List | GET /v1/approvals | ✅ Bearer | Access | ✅ 401 handled |
| Approvals Vote | POST /v1/approvals/:id/vote | ✅ Bearer | Access | ✅ 401 handled |
| Push Register | POST /v1/push/register | ✅ Bearer | Access | ✅ 401 handled |
| Push Unregister | POST /v1/push/unregister | ✅ Bearer | Access | ✅ 401 handled |

*Note: Refresh endpoint does NOT use Authorization header; refresh token sent in request body per OAuth2 convention.

## Security Findings

### ✅ Pass: Token Storage

- Mobile uses platform-native secure storage
- Web uses localStorage (acceptable for web clients)
- No tokens in plaintext files or unencrypted preferences

### ✅ Pass: Token Lifecycle

- Tokens cleared on logout
- Tokens cleared on session expiry
- Refresh flow implements token rotation
- No token reuse after expiry

### ✅ Pass: Auth Header Implementation

- Authorization header only added when token exists
- Header format follows RFC 6750
- No auth headers sent to non-auth endpoints unnecessarily

### ✅ Pass: Session Expiry Detection

- All authenticated requests check for 401 status
- SESSION_EXPIRED code properly parsed
- User redirected to login with clear message
- Snackbar notification shown for active session expiry

### ✅ Pass: No Token Logging

**Audit results:**
```bash
grep -r "token" lib/features/auth/*.dart | grep -i "print\|log\|debug"
# No matches found
```

- Telemetry events log success/failure, not token values
- Error messages do not expose token content
- Debug prints do not exist in auth code paths

### ⚠️ Advisory: Web Token Storage

**Issue:** Flutter Web stores tokens in localStorage (plaintext)

**Justification:** Standard practice for SPAs; no secure alternative on web platform

**Mitigations:**
- CSP headers prevent XSS token exfiltration
- HTTPS-only transport
- Shorter session duration recommended for web clients

**Recommendation:** Backend team should consider httpOnly cookie auth flow for web clients in future iteration.

### ⚠️ Advisory: Token Expiry Policy

**Current behavior:** No client-side token expiry check before API requests

**Impact:** Client may attempt request with expired token, receive 401, then refresh

**Recommendation:** Add JWT decode + expiry check to avoid unnecessary 401 round-trips. Not a security issue, but an optimization.

## TLS/Transport Security

### API Base Configuration

**Constant:** `SVEN_API_BASE`

**Default value:** `https://app.example.com`

**Enforcement:**
- All API calls hardcoded to use `Uri.parse()` with `https://` scheme
- No `http://` fallback in production code
- Dart `http` package validates TLS certificates by default

**Certificate validation:**
- Flutter uses platform TLS stack (iOS Security.framework, Android OkHttp)
- Certificate pinning not implemented (not required for this deployment)

**Source:**
- `apps/companion-user-flutter/lib/features/auth/auth_service.dart`
- `apps/companion-user-flutter/lib/features/preferences/ui_preferences_service.dart`
- `apps/companion-user-flutter/lib/features/approvals/approvals_service.dart`
- `apps/companion-user-flutter/lib/features/notifications/notifications_service.dart`

### Network Error Handling

**SocketException handling:**
- Caught and wrapped as `AuthException(AuthFailure.network)`
- User shown: "Network error. Check your connection and retry."
- No stack trace or internal error details exposed to user

## Recommendations

### Priority: Low

1. **Add JWT expiry awareness:** Decode access token and check `exp` claim before making requests to reduce unnecessary 401 responses.

2. **Consider httpOnly cookies for web:** Migrate Flutter Web to use httpOnly cookie-based auth if backend supports it.

3. **Add certificate pinning:** For high-security deployments, consider pinning the server certificate or public key.

### Priority: Medium

4. **Add token refresh background job:** Proactively refresh tokens 5 minutes before expiry to prevent user-facing session interruptions.

5. **Implement biometric re-auth:** For sensitive operations (logout-all, approvals), require biometric confirmation on mobile.

## Audit Conclusion

**Status:** ✅ PASS

The Flutter user app implements secure token handling practices appropriate for a mobile+web application. All critical controls are in place:
- Secure storage on mobile
- TLS-only transport
- Session expiry detection
- No token logging
- Proper auth header scoping

Advisory items are optimizations, not security defects.

**Next audit:** 2026-Q3 or on next major auth flow change

---

**Sign-off:**
- Security review: APPROVED for production release
- Date: 2026-02-18

