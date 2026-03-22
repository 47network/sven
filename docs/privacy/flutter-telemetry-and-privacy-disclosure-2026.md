# Flutter User App - Telemetry and Privacy Disclosure (2026)

Date: 2026-02-18  
Version: 0.1.0  
Scope: Flutter user app (mobile + web)

## Summary

This document describes all data collection, telemetry, and privacy-sensitive behaviors in the Sven Flutter user app. This disclosure must match App Store/Play Store privacy declarations and user-facing privacy policy.

## Data Collection Categories

### 1. Authentication Data

**What we collect:**
- Username (user-provided)
- Password (transmitted once, never stored locally)
- Access token (JWT, stored in secure storage)
- Refresh token (stored in secure storage)

**Why we collect it:**
- User authentication and session management

**Where it's stored:**
- Mobile: iOS Keychain / Android Keystore (encrypted)
- Web: Browser localStorage (plaintext, standard web practice)
- Server: Database (access/refresh tokens hashed)

**Retention:**
- Tokens cleared on logout or session expiry
- No long-term local storage of credentials

**Third-party sharing:** None

---

### 2. User Preferences

**What we collect:**
- Visual mode selection (classic | cinematic)
- Motion level preference (off | reduced | full)
- Avatar mode selection (orb | robot | human | animal)

**Why we collect it:**
- Personalization and accessibility
- Cross-device sync

**Where it's stored:**
- Mobile/Web: Local storage (SharedPreferences / localStorage)
- Server: User profile table

**Retention:**
- Stored indefinitely until user changes or deletes account
- Local preferences cleared on app uninstall

**Third-party sharing:** None

---

### 3. Performance Telemetry

**What we collect:**

| Event Name | Fields | Purpose |
|------------|--------|---------|
| `startup.cold_start` | `latency_ms` | Monitor app launch performance |
| `startup.warm_resume` | `latency_ms` | Monitor app resume performance |
| `startup.chat_home_ready` | `latency_ms` | Monitor time-to-interactive |
| `chat.stream.first_token` | `latency_ms` | Monitor streaming response latency |

**Why we collect it:**
- Performance monitoring and optimization
- SLO compliance tracking

**Where it's stored:**
- Logged via `debugPrint()` in debug builds
- Production: sent to observability backend (implementation pending)

**Retention:**
- Telemetry data aggregated and retained for 90 days
- Individual events not tied to user identity

**Third-party sharing:** None

**PII in telemetry:** NO - only numeric latency values

---

### 4. Feature Usage Telemetry

**What we collect:**

| Event Name | Fields | Purpose |
|------------|--------|---------|
| `auth.login` | `success`, `failure`, `status_code`, `latency_ms` | Monitor auth reliability |
| `auth.refresh` | `success`, `failure`, `status_code`, `latency_ms` | Monitor session stability |
| `auth.logout` | `success`, `failure`, `latency_ms` | Monitor logout flow |
| `auth.logout_all` | `success`, `failure`, `latency_ms` | Monitor multi-session logout |
| `approvals.vote` | `approval_id`, `decision` | Audit trail for approval actions |
| `push.register` | `platform`, `device_id` | Monitor push notification registration |
| `push.unregister` | `token` | Monitor push notification unregistration |

**Why we collect it:**
- Operational monitoring
- Security audit trail
- Feature reliability tracking

**Where it's stored:**
- Production: sent to observability backend + audit database

**Retention:**
- Audit events (approvals.vote): retained for 7 years (compliance requirement)
- Operational telemetry: retained for 90 days

**PII in telemetry:**
- `approval_id`: business identifier (not PII)
- `decision`: user choice (approve/reject)
- `device_id`: optional device identifier (may be PII in some jurisdictions)
- `token`: push notification token (device-specific, not user-identifying)

**Third-party sharing:** None

---

### 5. Network Activity

**What we transmit:**
- API requests to `https://app.example.com/v1/*`
- HTTP headers: `Content-Type`, `Authorization` (Bearer token), `User-Agent`
- Request bodies: JSON payloads for auth, preferences, approvals, notifications

**Why we transmit it:**
- Core application functionality

**Transport security:**
- TLS 1.2+ only
- Certificate validation enabled
- No plaintext HTTP fallback

**Server-side logging:**
- Access logs: IP address, timestamp, endpoint, status code
- Retention: 30 days (operational), 7 years (audit events)

**Third-party sharing:** None (self-hosted backend)

---

### 6. Local Device Storage

**What we store locally:**

| Data Type | Storage Location | Encrypted | Cleared on Logout |
|-----------|------------------|-----------|-------------------|
| Access token | Keychain/Keystore (mobile) / localStorage (web) | Yes (mobile) / No (web) | Yes |
| Refresh token | Keychain/Keystore (mobile) / localStorage (web) | Yes (mobile) / No (web) | Yes |
| UI preferences | SharedPreferences / localStorage | No | No |
| Chat message cache | (Not implemented) | N/A | N/A |

**Why we store it:**
- Session persistence
- Offline functionality (future)
- User preferences

**User control:** User can clear all data via:
- Logout (clears tokens)
- App uninstall (clears all local data)

---

### 7. Device Permissions

**Permissions requested:**

| Permission | Platform | Purpose | Required | Requested When |
|------------|----------|---------|----------|----------------|
| Internet | Mobile + Web | API communication | Yes | App launch |
| Storage | Mobile | Secure token storage | Yes | First auth |
| Notifications | Mobile | Push notifications | No | User opt-in only |

**Privacy notes:**
- No camera, microphone, location, contacts, or media access
- No background location tracking
- No advertising identifiers collected

---

## Data We DO NOT Collect

- ❌ Advertising IDs (IDFA/AAID)
- ❌ Device model, OS version, or hardware identifiers (beyond push token)
- ❌ Location data (GPS, IP geolocation)
- ❌ Contacts, calendar, photos, media
- ❌ Browsing history or app usage outside Sven
- ❌ Biometric data (face/fingerprint scans not stored)
- ❌ Clipboard content
- ❌ Microphone or camera data

---

## Third-Party Services

**None.**

- All data sent to self-hosted backend (`app.example.com`)
- No analytics SDKs (Google Analytics, Firebase, Mixpanel, etc.)
- No advertising networks
- No social media integrations

---

## User Rights (GDPR/CCPA)

Users have the right to:
1. **Access:** Request a copy of all data we store about them
2. **Rectification:** Correct inaccurate data via app settings
3. **Erasure:** Request account deletion (all data purged within 30 days)
4. **Portability:** Export data in JSON format
5. **Objection:** Opt out of non-essential telemetry (feature flag)

**How to exercise rights:**
- In-app: Settings > Account > Privacy & Data
- Email: privacy@the47network.com

---

## Children's Privacy

Sven is not intended for users under 13 years of age. We do not knowingly collect data from children. If we discover a child's data, we will delete it immediately.

---

## Changes to This Policy

**Last updated:** 2026-02-18

We will notify users of material privacy policy changes via:
- In-app notification
- Email to registered users
- Privacy policy version update with changelog

---

## Contact

**Data Controller:** 47 Network Operations  
**Email:** privacy@the47network.com  
**Address:** (To be provided)

---

## App Store Privacy Declarations

### Apple App Store (Privacy Nutrition Label)

**Data Linked to You:**
- User ID (for account management)
- UI preferences (for personalization)

**Data Not Linked to You:**
- Performance telemetry (aggregated, anonymized)

**Data Used to Track You:** None

**Data Not Collected:**
- No browsing history, search history, location, contacts, etc.

### Google Play Store (Data Safety Section)

**Data Collected:**
- Account info: Username (required for account creation)
- App activity: Approval votes, preference changes (for functionality)
- App performance: Crash logs, diagnostics (for reliability)

**Data Sharing:** None

**Data Security:**
- Data encrypted in transit (TLS)
- Data encrypted at rest (mobile only)

**Data Deletion:** User can request deletion via app or email

---

## Implementation Notes

### Current State (v0.1.0)

**✅ Implemented:**
- Token secure storage
- TLS-only transport
- Preference sync
- Auth telemetry events
- Performance telemetry events
- Approval audit events

**⚠️ Pending:**
- Telemetry backend integration (currently using debugPrint)
- User data export feature
- Account deletion feature (UI; backend exists)
- Telemetry opt-out toggle

### Next Steps

1. Wire telemetry events to production observability backend
2. Add "Data & Privacy" settings screen with:
   - Export data button
   - Delete account button
   - Telemetry opt-out toggle
3. Add privacy policy link in login screen footer
4. Submit App Store/Play Store privacy declarations before release

---

## Compliance Checklist

- [x] Privacy policy written and reviewed
- [x] Data collection inventory complete
- [x] No third-party data sharing
- [x] TLS encryption enforced
- [ ] App Store privacy labels submitted
- [ ] Play Store data safety section submitted
- [ ] User data export implemented
- [ ] User data deletion implemented (UI pending)
- [ ] Privacy policy link visible in app
- [ ] User consent for telemetry (opt-out toggle)

**Status:** READY for release with noted pending items completed before public launch.

---

**Sign-off:**
- Privacy review: APPROVED for internal beta  
- Public release: BLOCKED until data export/deletion UI complete  
- Date: 2026-02-18

