#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const expoMobileDir = path.join(root, 'apps', 'companion-mobile');
const flutterMobileDir = path.join(root, 'apps', 'companion-user-flutter');
const outDir = path.join(root, 'docs', 'release', 'status');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function check() {
  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });
  if (fs.existsSync(expoMobileDir)) {
    const appPath = path.join(expoMobileDir, 'App.tsx');
    const appJsonPath = path.join(expoMobileDir, 'app.json');
    const pkgPath = path.join(expoMobileDir, 'package.json');
    const appCode = readText(appPath);
    const appJson = JSON.parse(readText(appJsonPath));
    const pkg = JSON.parse(readText(pkgPath));

    const secureStoreDep = String(pkg.dependencies?.['expo-secure-store'] || '').trim();
    add('dep_expo_secure_store', Boolean(secureStoreDep), secureStoreDep || 'missing');

    add(
      'secure_store_usage',
      appCode.includes('SecureStore.getItemAsync') &&
        appCode.includes('SecureStore.setItemAsync') &&
        appCode.includes('SecureStore.deleteItemAsync'),
      'App.tsx must read/write/delete via SecureStore',
    );

    add(
      'insecure_fallback_dev_only',
      appCode.includes('ALLOW_INSECURE_TOKEN_FALLBACK') &&
        appCode.includes('if (!ALLOW_INSECURE_TOKEN_FALLBACK) return') &&
        appCode.includes("throw new Error('Secure token storage unavailable')"),
      'AsyncStorage fallback must be dev-only',
    );

    const androidCleartext = appJson?.expo?.android?.usesCleartextTraffic;
    add(
      'android_cleartext_disabled_for_release',
      androidCleartext !== true,
      `android.usesCleartextTraffic=${String(androidCleartext)}`,
    );

    add(
      'platforms_include_ios_android',
      Array.isArray(appJson?.expo?.platforms) &&
        appJson.expo.platforms.includes('ios') &&
        appJson.expo.platforms.includes('android'),
      JSON.stringify(appJson?.expo?.platforms || []),
    );
  } else if (fs.existsSync(flutterMobileDir)) {
    const pubspecPath = path.join(flutterMobileDir, 'pubspec.yaml');
    const tokenStorePath = path.join(flutterMobileDir, 'lib', 'features', 'auth', 'token_store.dart');
    const androidManifestPath = path.join(
      flutterMobileDir,
      'android',
      'app',
      'src',
      'main',
      'AndroidManifest.xml',
    );

    const pubspec = readText(pubspecPath);
    const tokenStoreCode = readText(tokenStorePath);
    const androidManifest = readText(androidManifestPath);

    add(
      'dep_flutter_secure_storage',
      /(^|\n)\s*flutter_secure_storage\s*:\s*/.test(pubspec),
      'pubspec.yaml must declare flutter_secure_storage',
    );

    add(
      'secure_store_usage',
      tokenStoreCode.includes('FlutterSecureStorage') &&
        tokenStoreCode.includes('.read(') &&
        tokenStoreCode.includes('.write(') &&
        tokenStoreCode.includes('.delete('),
      'token_store.dart must read/write/delete via FlutterSecureStorage',
    );

    add(
      'android_cleartext_disabled_for_release',
      !/android:usesCleartextTraffic\s*=\s*["']true["']/i.test(androidManifest),
      'AndroidManifest.xml must not enable cleartext traffic in release',
    );

    add(
      'platforms_include_ios_android',
      fs.existsSync(path.join(flutterMobileDir, 'ios')) && fs.existsSync(path.join(flutterMobileDir, 'android')),
      'Flutter app must include ios/ and android/',
    );
  } else {
    add(
      'mobile_app_present',
      false,
      'Neither apps/companion-mobile nor apps/companion-user-flutter exists',
    );
  }

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : 'fail';
  const now = new Date().toISOString();

  const result = { at: now, status, passed, failed, checks };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'mobile-securestore-release-check-latest.json'), JSON.stringify(result, null, 2) + '\n');

  const lines = [
    '# Mobile SecureStore Release Check',
    '',
    `- Time: ${now}`,
    `- Status: ${status}`,
    `- Passed: ${passed}`,
    `- Failed: ${failed}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.detail}`),
    '',
  ];
  fs.writeFileSync(path.join(outDir, 'mobile-securestore-release-check-latest.md'), lines.join('\n'));

  console.log(JSON.stringify(result, null, 2));
  if (failed > 0) process.exit(2);
}

check();
