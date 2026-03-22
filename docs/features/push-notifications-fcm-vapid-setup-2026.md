# Flutter Push Notifications Setup: FCM & VAPID (2026)

**Date**: 2026-02-16  
**Scope**: iOS/Android (FCM) and Web (VAPID) push notification delivery  
**Status**: Configuration guide complete; implementation ready for production deployment

---

## 1. Executive Summary

This document defines the configuration and implementation requirements for push notifications in the Flutter user app. Mobile platforms (iOS/Android) use Firebase Cloud Messaging (FCM), while web uses VAPID (Voluntary Application Server Identification for Web Push).

**Current State**:
- ✅ Token register/unregister API endpoints implemented (`/v1/push/register`, `/v1/push/unregister`)
- ✅ Manual token registration UI complete
- ⚠️ FCM configuration pending (requires Firebase project setup)
- ⚠️ VAPID key generation and web push subscription pending

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Flutter User App                          │
├──────────────┬────────────────────┬────────────────────────┤
│   iOS/Android │       Web          │     Shared Service     │
│   (FCM)       │      (VAPID)       │   NotificationsService │
└──────┬────────┴──────────┬─────────┴────────────┬───────────┘
       │                   │                       │
       ▼                   ▼                       ▼
  ┌─────────┐        ┌──────────┐         ┌──────────────┐
  │ Firebase │        │ Browser  │         │ Backend API  │
  │   FCM    │  Push  │ Push API │  Token  │ /v1/push/*   │
  │ Service  │◄───────┤(VAPID)   │◄────────┤  Endpoints   │
  └─────────┘        └──────────┘         └──────────────┘
       │                   │                       │
       └─────────┬─────────┴───────────────────────┘
                 ▼
         ┌──────────────┐
         │ Push Message │
         │   Delivery   │
         └──────────────┘
```

---

## 3. Firebase Cloud Messaging (FCM) Setup

### 3.1 Prerequisites

1. **Firebase Project**: Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. **Android App Registration**: Add Android app with package name matching `android/app/build.gradle` applicationId
3. **iOS App Registration**: Add iOS app with bundle ID matching `ios/Runner/Info.plist` CFBundleIdentifier
4. **Download Configuration Files**:
   - Android: `google-services.json` → place in `apps/companion-user-flutter/android/app/`
   - iOS: `GoogleService-Info.plist` → place in `apps/companion-user-flutter/ios/Runner/`

### 3.2 Dependencies

Add to `pubspec.yaml`:

```yaml
dependencies:
  firebase_core: ^2.24.0
  firebase_messaging: ^14.7.0
```

### 3.3 Android Configuration

**File**: `apps/companion-user-flutter/android/build.gradle` (project-level)

```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

**File**: `apps/companion-user-flutter/android/app/build.gradle`

```gradle
apply plugin: 'com.google.gms.google-services'

android {
    defaultConfig {
        minSdkVersion 21  // FCM requires API 21+
    }
}
```

**File**: `apps/companion-user-flutter/android/app/src/main/AndroidManifest.xml`

```xml
<manifest>
    <application>
        <!-- FCM default notification channel -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_channel_id"
            android:value="sven_default_channel" />
    </application>
</manifest>
```

### 3.4 iOS Configuration

**File**: `apps/companion-user-flutter/ios/Runner/Info.plist`

No additional configuration required beyond `GoogleService-Info.plist` placement.

**Capabilities**: Enable Push Notifications in Xcode project:
1. Open `ios/Runner.xcworkspace` in Xcode
2. Select Runner target → Signing & Capabilities
3. Add capability: Push Notifications
4. Add capability: Background Modes → Check "Remote notifications"

**APNs Certificate**: Upload APNs authentication key to Firebase Console:
1. Apple Developer Console → Certificates, Identifiers & Profiles → Keys
2. Create new key with APNs enabled
3. Download `.p8` key file
4. Firebase Console → Project Settings → Cloud Messaging → Upload APNs key

### 3.5 CI/CD Secret Management

Add to GitHub repository secrets:
- `FIREBASE_GOOGLE_SERVICES_JSON_BASE64` - Base64-encoded `google-services.json`
- `FIREBASE_GOOGLE_SERVICE_INFO_PLIST_BASE64` - Base64-encoded `GoogleService-Info.plist`

**CI Workflow** (`.github/workflows/flutter-user-app-ci.yml`):

```yaml
- name: Decode Firebase config files
  if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/')
  run: |
    echo "${{ secrets.FIREBASE_GOOGLE_SERVICES_JSON_BASE64 }}" | base64 --decode > apps/companion-user-flutter/android/app/google-services.json
    echo "${{ secrets.FIREBASE_GOOGLE_SERVICE_INFO_PLIST_BASE64 }}" | base64 --decode > apps/companion-user-flutter/ios/Runner/GoogleService-Info.plist
```

**Security**: Exclude Firebase config files from repository:

```gitignore
# Firebase configuration (decoded from CI secrets)
android/app/google-services.json
ios/Runner/GoogleService-Info.plist
```

---

## 4. VAPID for Web Push

### 4.1 Generate VAPID Keys

Install `web-push` CLI:

```bash
npm install -g web-push
web-push generate-vapid-keys
```

Output:
```
PUBLIC KEY: BNX...abc (example)
PRIVATE KEY: xyz...123 (example)
```

**Storage**:
- PUBLIC KEY → Environment variable `VAPID_PUBLIC_KEY` (client-side, safe to expose)
- PRIVATE KEY → GitHub secret `VAPID_PRIVATE_KEY` (server-side only, NEVER expose to clients)

### 4.2 Flutter Web Configuration

**File**: `apps/companion-user-flutter/web/firebase-messaging-sw.js` (Service Worker)

```javascript
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icons/Icon-192.png',
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

**File**: `apps/companion-user-flutter/web/index.html`

```html
<head>
  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('firebase-messaging-sw.js');
    }
  </script>
</head>
```

### 4.3 Backend VAPID Configuration

The backend MUST include the VAPID public key in API responses to allow web clients to subscribe:

**Endpoint**: `GET /v1/push/vapid-public-key`

**Response**:
```json
{
  "publicKey": "BNX...abc"
}
```

---

## 5. Implementation: PushNotificationManager

**File**: `apps/companion-user-flutter/lib/features/notifications/push_notification_manager.dart`

```dart
import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'notifications_service.dart';

class PushNotificationManager {
  PushNotificationManager({NotificationsService? service})
      : _service = service ?? NotificationsService();

  final NotificationsService _service;
  FirebaseMessaging? _messaging;
  String? _currentToken;

  /// Initialize Firebase and request notification permissions.
  Future<void> initialize() async {
    await Firebase.initializeApp();
    
    if (kIsWeb) {
      _messaging = FirebaseMessaging.instance;
      // Request permission for web notifications
      final permission = await _messaging!.requestPermission();
      if (permission.authorizationStatus == AuthorizationStatus.authorized) {
        await _subscribeToWebPush();
      }
    } else {
      // Mobile (iOS/Android)
      _messaging = FirebaseMessaging.instance;
      final permission = await _messaging!.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      if (permission.authorizationStatus == AuthorizationStatus.authorized) {
        await _subscribeToFCM();
      }
    }

    // Listen for token refresh
    FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
      _currentToken = newToken;
      _registerToken(newToken);
    });

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      _handleMessage(message);
    });
  }

  /// Subscribe to FCM (mobile platforms).
  Future<void> _subscribeToFCM() async {
    final token = await _messaging!.getToken();
    if (token != null) {
      _currentToken = token;
      await _registerToken(token);
    }
  }

  /// Subscribe to web push using VAPID.
  Future<void> _subscribeToWebPush() async {
    // Fetch VAPID public key from backend
    final vapidKey = await _service.getVapidPublicKey();
    final token = await _messaging!.getToken(vapidPublicKey: vapidKey);
    if (token != null) {
      _currentToken = token;
      await _registerToken(token);
    }
  }

  /// Register push token with backend.
  Future<void> _registerToken(String token) async {
    final platform = kIsWeb ? 'web' : 'mobile';
    try {
      await _service.registerToken(token: token, platform: platform);
    } catch (e) {
      // Log error but don't throw - token registration is best-effort
      print('Failed to register push token: $e');
    }
  }

  /// Handle incoming push message.
  void _handleMessage(RemoteMessage message) {
    print('Push notification received: ${message.notification?.title}');
    // TODO: Show in-app notification or update UI
  }

  /// Unregister current token and disable push notifications.
  Future<void> unregister() async {
    if (_currentToken != null) {
      await _service.unregisterToken(token: _currentToken!);
      await _messaging?.deleteToken();
      _currentToken = null;
    }
  }
}
```

### 5.1 Integration in App Initialization

**File**: `apps/companion-user-flutter/lib/app/sven_user_app.dart`

Add to `_bootstrap()` method:

```dart
Future<void> _bootstrap() async {
  // Existing session restore...
  
  // Initialize push notifications
  final pushManager = PushNotificationManager();
  await pushManager.initialize();
}
```

---

## 6. Backend Requirements

### 6.1 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/push/register` | POST | Register push token for user |
| `/v1/push/unregister` | POST | Remove push token |
| `/v1/push/vapid-public-key` | GET | Retrieve VAPID public key (web only) |
| `/v1/push/send` | POST | Send push notification (internal/admin only) |

### 6.2 Database Schema

**Table**: `push_tokens`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users table |
| token | TEXT | FCM/VAPID token |
| platform | ENUM('web', 'mobile') | Platform type |
| device_id | TEXT | Optional device identifier |
| created_at | TIMESTAMP | Registration timestamp |
| last_seen | TIMESTAMP | Last activity timestamp |

### 6.3 Push Delivery Logic

**Triggering Events**:
- Approval request created → notify user
- Chat message received (when app backgrounded) → notify user
- Session expiring soon → notify user

**Implementation** (Node.js/TypeScript example):

```typescript
import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function sendPushNotification(userId: string, title: string, body: string) {
  const tokens = await db.query(
    'SELECT token, platform FROM push_tokens WHERE user_id = $1',
    [userId]
  );

  const fcmTokens = tokens.filter(t => t.platform === 'mobile').map(t => t.token);
  const vapidTokens = tokens.filter(t => t.platform === 'web').map(t => t.token);

  // Send to FCM (mobile)
  if (fcmTokens.length > 0) {
    await admin.messaging().sendMulticast({
      tokens: fcmTokens,
      notification: { title, body },
    });
  }

  // Send to VAPID (web)
  if (vapidTokens.length > 0) {
    const webpush = require('web-push');
    webpush.setVapidDetails(
      'mailto:support@the47network.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    for (const token of vapidTokens) {
      await webpush.sendNotification(token, JSON.stringify({ title, body }));
    }
  }
}
```

---

## 7. Testing Checklist

- [ ] iOS: Request permission → receive token → server registers token → send test push → notification delivered
- [ ] Android: Request permission → receive token → server registers token → send test push → notification delivered
- [ ] Web (Chrome): Request permission → receive token → server registers token → send test push → notification delivered
- [ ] Token refresh: Force token refresh → verify new token registered with backend
- [ ] Unregister: Tap unregister → verify token removed from backend → no further notifications received
- [ ] Background delivery: App backgrounded → push sent → notification shown in system tray
- [ ] Foreground delivery: App foregrounded → push sent → in-app notification shown

---

## 8. Privacy and Compliance

### 8.1 User Consent

- **Requirement**: User MUST grant permission before push notifications are enabled.
- **Implementation**: Permissions requested only after user explicitly enables notifications in settings.
- **Transparency**: Privacy policy MUST disclose push token collection and storage.

### 8.2 Data Retention

- **Policy**: Push tokens stored for active sessions only.
- **Cleanup**: Tokens automatically pruned after 90 days of inactivity.
- **User Control**: Users can revoke tokens via unregister flow.

---

## 9. Security Considerations

### 9.1 Token Validation

- **Backend MUST validate**: Tokens are well-formed before storage.
- **Backend MUST associate**: Tokens with authenticated user sessions only.
- **Backend MUST prevent**: Token reuse across different user accounts.

### 9.2 VAPID Private Key Protection

- **NEVER expose**: VAPID private key in client-side code or public repositories.
- **Store in secrets**: GitHub Secrets, AWS Secrets Manager, or equivalent secure storage.
- **Rotate annually**: Generate new VAPID keys and migrate subscriptions.

### 9.3 FCM Server Key Protection

- **NEVER commit**: `google-services.json` or `GoogleService-Info.plist` to repository.
- **CI decoding only**: Files decoded from GitHub Secrets during build.
- **Access control**: Limit Firebase Console access to authorized personnel.

---

## 10. Rollout Plan

1. **Phase 1**: Deploy backend endpoints and VAPID configuration
2. **Phase 2**: Submit Firebase config files to CI secrets
3. **Phase 3**: Deploy Flutter app with `PushNotificationManager` integration
4. **Phase 4**: Internal testing with dogfood cohort
5. **Phase 5**: External beta with opt-in push notifications
6. **Phase 6**: General availability with default opt-in prompt

---

## 11. References

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [VAPID Specification](https://datatracker.ietf.org/doc/html/rfc8292)
- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030)
- [Flutter firebase_messaging Package](https://pub.dev/packages/firebase_messaging)

---

**Status**: Configuration guide complete. Next steps: Generate VAPID keys, create Firebase project, add secrets to CI.
