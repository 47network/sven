#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'release', 'status');
const strict = process.argv.includes('--strict');

function rel(p) { return path.relative(root, p).replace(/\\/g, '/'); }
function read(relPath) { return fs.readFileSync(path.join(root, relPath), 'utf8'); }
function exists(relPath) { return fs.existsSync(path.join(root, relPath)); }

function extractAndroidBaseApplicationId(gradleBody) {
  const match = String(gradleBody || '').match(/applicationId\s*=\s*"([^"]+)"/);
  return match ? String(match[1]).trim() : '';
}

function extractAndroidFlavorSuffixes(gradleBody) {
  const suffixMatches = String(gradleBody || '').match(/applicationIdSuffix\s*=\s*"([^"]+)"/g) || [];
  const suffixes = new Set();
  for (const token of suffixMatches) {
    const match = token.match(/applicationIdSuffix\s*=\s*"([^"]+)"/);
    if (!match) continue;
    const raw = String(match[1]).trim();
    if (!raw) continue;
    const normalized = raw.startsWith('.') ? raw : `.${raw}`;
    suffixes.add(normalized);
  }
  return Array.from(suffixes);
}

function run() {
  const androidManifest = 'apps/companion-user-flutter/android/app/src/main/AndroidManifest.xml';
  const androidAppGradle = 'apps/companion-user-flutter/android/app/build.gradle.kts';
  const iosInfoPlist = 'apps/companion-user-flutter/ios/Runner/Info.plist';
  const iosPbxproj = 'apps/companion-user-flutter/ios/Runner.xcodeproj/project.pbxproj';
  const iosEntitlements = 'apps/companion-user-flutter/ios/Runner/Runner.entitlements';
  const pushManager = 'apps/companion-user-flutter/lib/features/notifications/push_notification_manager.dart';
  const appEntry = 'apps/companion-user-flutter/lib/app/sven_user_app.dart';

  const manifestBody = read(androidManifest);
  const gradleBody = read(androidAppGradle);
  const plistBody = read(iosInfoPlist);
  const pbxBody = read(iosPbxproj);
  const entBody = exists(iosEntitlements) ? read(iosEntitlements) : '';
  const pushBody = read(pushManager);
  const appBody = read(appEntry);
  const baseApplicationId = extractAndroidBaseApplicationId(gradleBody);
  const flavorSuffixes = extractAndroidFlavorSuffixes(gradleBody);
  const expectedAndroidPackages = [
    baseApplicationId,
    ...flavorSuffixes.map((suffix) => `${baseApplicationId}${suffix}`),
  ].filter(Boolean);
  const evidenceDocs = [
    'docs/release/evidence/firebase-integration-2026-02-18.md',
    'docs/release/evidence/device-testing-session-2026-02-18.md',
  ];
  const evidenceBodies = evidenceDocs
    .filter((doc) => exists(doc))
    .map((doc) => ({ doc, body: read(doc) }));
  const legacyPackagePattern = /\bcom\.example\.sven_user_flutter(?:\.[a-z0-9_]+)?\b/i;
  const expectedPackagePattern = expectedAndroidPackages.length > 0
    ? new RegExp(`\\b(${expectedAndroidPackages.map((pkg) => pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?:\\.[a-z0-9_]+)?\\b`, 'i')
    : null;
  const evidenceWithExpectedPackage = evidenceBodies.filter((entry) => expectedPackagePattern && expectedPackagePattern.test(entry.body));
  const evidenceWithLegacyPackage = evidenceBodies.filter((entry) => legacyPackagePattern.test(entry.body));

  const checks = [
    {
      id: 'android_post_notifications_permission_declared',
      pass: manifestBody.includes('android.permission.POST_NOTIFICATIONS'),
      detail: androidManifest,
    },
    {
      id: 'android_firebase_messaging_plugin_wired',
      pass: gradleBody.includes('com.google.gms.google-services') && gradleBody.includes('firebase-messaging'),
      detail: androidAppGradle,
    },
    {
      id: 'android_push_runtime_handlers_wired',
      pass: appBody.includes('FirebaseMessaging.onMessageOpenedApp.listen') && appBody.includes('getInitialMessage()'),
      detail: appEntry,
    },
    {
      id: 'ios_url_scheme_for_app_callbacks_present',
      pass: plistBody.includes('<string>sven</string>'),
      detail: iosInfoPlist,
    },
    {
      id: 'ios_push_entitlement_configured',
      pass: exists(iosEntitlements) && entBody.includes('<key>aps-environment</key>') && pbxBody.includes('CODE_SIGN_ENTITLEMENTS = Runner/Runner.entitlements;'),
      detail: `${iosEntitlements} + ${iosPbxproj}`,
    },
    {
      id: 'push_manager_handles_token_and_foreground_messages',
      pass: pushBody.includes('FirebaseMessaging.instance.onTokenRefresh.listen') && pushBody.includes('FirebaseMessaging.onMessage.listen(_handleMessage)'),
      detail: pushManager,
    },
    {
      id: 'android_firebase_config_present_for_all_flavors',
      pass: exists('apps/companion-user-flutter/android/app/src/dev/google-services.json')
        && exists('apps/companion-user-flutter/android/app/src/staging/google-services.json')
        && exists('apps/companion-user-flutter/android/app/src/prod/google-services.json'),
      detail: 'android/app/src/{dev,staging,prod}/google-services.json',
    },
    {
      id: 'ios_firebase_production_values_configurable',
      pass: read('apps/companion-user-flutter/lib/firebase_options.dart').includes('SVEN_FIREBASE_IOS_PROD_APP_ID')
        && read('apps/companion-user-flutter/lib/firebase_options.dart').includes('SVEN_FIREBASE_IOS_PROD_API_KEY')
        && read('apps/companion-user-flutter/lib/firebase_options.dart').includes('SVEN_FIREBASE_IOS_PROD_BUNDLE_ID'),
      detail: 'apps/companion-user-flutter/lib/firebase_options.dart uses dart-define iOS production config keys',
    },
    {
      id: 'both_platform_runtime_test_evidence_present',
      pass: exists('docs/release/evidence/firebase-integration-2026-02-18.md')
        && exists('docs/release/evidence/fcm-session-summary-2026-02-18.md')
        && exists('docs/release/evidence/mobile-push-both-platforms-c8-2-2026-02-21.md'),
      detail: 'requires Android+iOS push test evidence docs',
    },
    {
      id: 'mobile_push_evidence_package_ids_match_active_android_app_id',
      pass: expectedAndroidPackages.length > 0 && evidenceWithExpectedPackage.length === evidenceBodies.length,
      detail: expectedAndroidPackages.length > 0
        ? `expected one of [${expectedAndroidPackages.join(', ')}] in ${evidenceDocs.join(', ')}`
        : `failed to extract Android applicationId from ${androidAppGradle}`,
    },
    {
      id: 'mobile_push_evidence_legacy_package_id_absent',
      pass: evidenceWithLegacyPackage.length === 0,
      detail: evidenceWithLegacyPackage.length === 0
        ? `legacy package id not found in ${evidenceDocs.join(', ')}`
        : `legacy package id found in ${evidenceWithLegacyPackage.map((entry) => entry.doc).join(', ')}`,
    },
  ];

  const report = {
    generated_at: new Date().toISOString(),
    status: checks.some((c) => !c.pass) ? 'fail' : 'pass',
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'mobile-push-latest.json');
  const outMd = path.join(outDir, 'mobile-push-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = [
    '# Mobile Push Notification Check',
    '',
    `Generated: ${report.generated_at}`,
    `Status: ${report.status}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(outMd, `${md.join('\n')}\n`, 'utf8');

  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
  if (strict && report.status !== 'pass') process.exit(2);
}

run();
