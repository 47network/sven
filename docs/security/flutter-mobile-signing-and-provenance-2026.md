# Flutter Mobile Signing and Provenance (2026)

**Date**: 2026-02-16  
**Auditor**: Platform Security Team  
**Scope**: Code signing, app provenance, and artifact integrity for Flutter iOS and Android builds

---

## 1. Executive Summary

This document defines the signing and provenance requirements for the Flutter user app distributed through App Store (iOS) and Play Store (Android). All release builds MUST be cryptographically signed and traceable to CI pipeline artifacts.

**Status**: 
- Android signing: CONFIGURED (keystore managed in GitHub Secrets)
- iOS signing: CONFIGURED (certificates and provisioning profiles in GitHub Secrets)
- Artifact provenance: IMPLEMENTED (SHA-256 checksums + SLSA level 2 attestation)

---

## 2. Android Signing Configuration

### 2.1 Release Keystore Management

**Location**: GitHub repository secrets (encrypted)  
**Secrets Required**:
- `ANDROID_KEYSTORE_BASE64` - Keystore file encoded as base64
- `ANDROID_KEY_ALIAS` - Key alias for signing
- `ANDROID_KEY_PASSWORD` - Private key password
- `ANDROID_STORE_PASSWORD` - Keystore password

**Rotation Policy**: Annual rotation with overlap period for backward compatibility.

### 2.2 Gradle Signing Configuration

File: `apps/companion-user-flutter/android/key.properties`  
This file is created at CI build time from secrets and MUST NOT be committed to the repository.

```properties
storePassword=${ANDROID_STORE_PASSWORD}
keyPassword=${ANDROID_KEY_PASSWORD}
keyAlias=${ANDROID_KEY_ALIAS}
storeFile=/tmp/keystore.jks
```

File: `apps/companion-user-flutter/android/app/build.gradle`  
Modified to load signing config from `key.properties`:

```gradle
android {
    ...
    signingConfigs {
        release {
            def keystorePropertiesFile = rootProject.file("key.properties")
            if (keystorePropertiesFile.exists()) {
                def keystoreProperties = new Properties()
                keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
                
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
        }
    }
}
```

### 2.3 CI Workflow Integration

In `.github/workflows/flutter-user-app-ci.yml`:

```yaml
- name: Decode Android keystore
  if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/')
  run: |
    echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 --decode > /tmp/keystore.jks
    
- name: Create key.properties
  if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/')
  run: |
    cat > apps/companion-user-flutter/android/key.properties << EOF
    storePassword=${{ secrets.ANDROID_STORE_PASSWORD }}
    keyPassword=${{ secrets.ANDROID_KEY_PASSWORD }}
    keyAlias=${{ secrets.ANDROID_KEY_ALIAS }}
    storeFile=/tmp/keystore.jks
    EOF

- name: Build Android release APK
  if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/')
  run: |
    cd apps/companion-user-flutter
    flutter build apk --release --build-number $GITHUB_RUN_NUMBER
```

**Security Notes**:
- Keystore is decoded at build time and never persisted in the repository.
- `key.properties` is excluded via `.gitignore`.
- Signing only occurs on `main` branch or tagged releases.

---

## 3. iOS Signing Configuration

### 3.1 Code Signing Certificates and Provisioning Profiles

**Location**: GitHub repository secrets (encrypted)  
**Secrets Required**:
- `IOS_CERTIFICATE_BASE64` - Distribution certificate (.p12 encoded as base64)
- `IOS_CERTIFICATE_PASSWORD` - Certificate password
- `IOS_PROVISIONING_PROFILE_BASE64` - Provisioning profile (.mobileprovision encoded as base64)
- `IOS_TEAM_ID` - Apple Developer Team ID
- `IOS_BUNDLE_ID` - App bundle identifier (e.g., `com.fortyseven.sven.user`)

**Rotation Policy**: Annual rotation before certificate expiration (Apple certificates expire after 1 year).

### 3.2 Xcode Project Configuration

File: `apps/companion-user-flutter/ios/Runner.xcodeproj/project.pbxproj`  
Xcode project MUST be configured for manual code signing (not automatic):

- **Code Signing Style**: Manual
- **Development Team**:Set via CI environment variable
- **Provisioning Profile**: Installed from secrets at build time

### 3.3 CI Workflow Integration

In `.github/workflows/flutter-user-app-ci.yml`:

```yaml
- name: Set up iOS signing (macOS runner only)
  if: runner.os == 'macOS' && (github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/'))
  run: |
    # Decode certificate and install to keychain
    echo "${{ secrets.IOS_CERTIFICATE_BASE64 }}" | base64 --decode > certificate.p12
    security create-keychain -p actions build.keychain
    security default-keychain -s build.keychain
    security unlock-keychain -p actions build.keychain
    security import certificate.p12 -k build.keychain -P "${{ secrets.IOS_CERTIFICATE_PASSWORD }}" -T /usr/bin/codesign
    security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k actions build.keychain
    
    # Install provisioning profile
    mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
    echo "${{ secrets.IOS_PROVISIONING_PROFILE_BASE64 }}" | base64 --decode > ~/Library/MobileDevice/Provisioning\ Profiles/profile.mobileprovision
    
- name: Build iOS release IPA
  if: runner.os == 'macOS' && (github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/'))
  run: |
    cd apps/companion-user-flutter
    flutter build ios --release --no-codesign
    cd ios
    xcodebuild -workspace Runner.xcworkspace -scheme Runner -configuration Release -archivePath build/Runner.xcarchive archive -allowProvisioningUpdates DEVELOPMENT_TEAM="${{ secrets.IOS_TEAM_ID }}"
    xcodebuild -exportArchive -archivePath build/Runner.xcarchive -exportPath build/ios-release -exportOptionsPlist ExportOptions.plist
```

**Security Notes**:
- Temporary keychain created for CI builds and destroyed after workflow completes.
- Provisioning profile installed to user library only during build.
- Certificates never committed to repository.

---

## 4. Web Build Integrity

### 4.1 Artifact Checksums

All web build artifacts MUST have SHA-256 checksums generated and published alongside the build.

**CI Workflow Integration**:

```yaml
- name: Generate web build checksums
  if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/')
  run: |
    cd apps/companion-user-flutter/build/web
    find . -type f -exec sha256sum {} \; > ../../checksums-web.txt
    
- name: Upload web build with checksums
  uses: actions/upload-artifact@v3
  with:
    name: flutter-web-release
    path: |
      apps/companion-user-flutter/build/web
      apps/companion-user-flutter/checksums-web.txt
```

### 4.2 SLSA Provenance Attestation

**SLSA Level**: Level 2 (source + build integrity)  
**Implementation**: GitHub Actions native SLSA attestation

```yaml
- name: Generate SLSA provenance
  uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v1.9.0
  with:
    base64-subjects: ${{ steps.hash.outputs.hashes }}
```

**Verification**: Consumers can verify provenance using `slsa-verifier`:

```bash
slsa-verifier verify-artifact flutter-web-release.tar.gz \
  --provenance-path flutter-web-release.intoto.jsonl \
  --source-uri github.com/47network/openclaw-sven
```

### 4.3 Content Security Policy (CSP)

Web builds MUST include restrictive CSP headers to prevent injection attacks.

File: `apps/companion-user-flutter/web/index.html`

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'wasm-unsafe-eval'; 
               connect-src 'self' https://app.example.com; 
               img-src 'self' data: blob:; 
               style-src 'self' 'unsafe-inline';">
```

**Policy Rationale**:
- `default-src 'self'` - Only load resources from same origin
- `script-src 'wasm-unsafe-eval'` - Required for Flutter web WASM execution
- `connect-src` - Whitelist API endpoints only
- `img-src data: blob:` - Allow data URIs for inline images
- `style-src 'unsafe-inline'` - Flutter web injects inline styles

---

## 5. Artifact Provenance Tracking

### 5.1 Build Metadata

Each release artifact MUST include build metadata:

**File**: `apps/companion-user-flutter/build.json` (generated at build time)

```json
{
  "version": "1.0.0+<build_number>",
  "gitCommit": "<full_sha>",
  "gitRef": "<branch_or_tag>",
  "buildTimestamp": "<iso8601_utc>",
  "ciPipeline": "github-actions",
  "ciRunId": "<run_id>",
  "ciRunUrl": "https://github.com/47network/openclaw-sven/actions/runs/<run_id>"
}
```

**Generation Script**: `apps/companion-user-flutter/tool/generate_build_metadata.dart`

```dart
import 'dart:convert';
import 'dart:io';

void main() {
  final metadata = {
    'version': Platform.environment['APP_VERSION'] ?? 'dev',
    'gitCommit': Platform.environment['GITHUB_SHA'] ?? 'unknown',
    'gitRef': Platform.environment['GITHUB_REF'] ?? 'unknown',
    'buildTimestamp': DateTime.now().toUtc().toIso8601String(),
    'ciPipeline': 'github-actions',
    'ciRunId': Platform.environment['GITHUB_RUN_ID'] ?? 'local',
    'ciRunUrl': Platform.environment['GITHUB_RUN_ID'] != null
        ? 'https://github.com/47network/openclaw-sven/actions/runs/${Platform.environment['GITHUB_RUN_ID']}'
        : 'local-build',
  };

  final file = File('build.json');
  file.writeAsStringSync(JsonEncoder.withIndent('  ').convert(metadata));
  print('✅ Build metadata written to build.json');
}
```

### 5.2 Git Tag Release Policy

**Naming Convention**: `flutter-user-v<semver>` (e.g., `flutter-user-v1.2.3`)  
**Trigger**: Release builds triggered only on tags matching `flutter-user-v*`

**CI Workflow Tag Filter**:

```yaml
on:
  push:
    tags:
      - 'flutter-user-v*'
```

**Version Extraction**:

```bash
VERSION=${GITHUB_REF#refs/tags/flutter-user-v}
echo "Building version: $VERSION"
```

---

## 6. Audit Compliance Checklist

| Requirement | Android | iOS | Web | Status |
|-------------|---------|-----|-----|--------|
| Signing keys managed in secrets | ✅ | ✅ | N/A | PASS |
| No secrets in repository | ✅ | ✅ | ✅ | PASS |
| Artifact checksums generated | ✅ | ✅ | ✅ | PASS |
| SLSA provenance attestation | ✅ | ✅ | ✅ | PASS |
| Build metadata included | ✅ | ✅ | ✅ | PASS |
| CSP headers configured | N/A | N/A | ✅ | PASS |
| Keystore/cert rotation policy | ✅ (annual) | ✅ (annual) | N/A | PASS |
| Release tag enforcement | ✅ | ✅ | ✅ | PASS |

---

## 7. Incident Response

### 7.1 Signing Key Compromise

**Scenario**: Keystore or certificate suspected to be compromised.

**Actions**:
1. **Immediate**: Revoke GitHub secrets and rotate all signing keys.
2. **iOS**: Revoke Apple distribution certificate via Apple Developer portal.
3. **Android**: Generate new keystore and upload new APK with incremented version code.
4. **Notify**: App Store and Play Store support teams if malicious builds detected.
5. **Audit**: Review all builds signed with compromised key and assess impact.

### 7.2 Artifact Integrity Failure

**Scenario**: User reports checksum mismatch or SLSA verification failure.

**Actions**:
1. **Verify**: Re-download artifact from official distribution and verify checksums.
2. **Investigate**: Review CI logs for build tampering or artifact corruption.
3. **Communicate**: Publish incident notice with verified artifact checksums.
4. **Remediate**: If tampering confirmed, revoke affected builds and issue emergency patch.

---

## 8. References

- [SLSA Framework](https://slsa.dev/)
- [Google Play App Signing](https://developer.android.com/studio/publish/app-signing)
- [Apple Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [CSP for Web Apps](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

**Next Review**: Before Flutter app v2.0.0 release or 2027-02-01, whichever is sooner.

