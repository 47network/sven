import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show TargetPlatform, defaultTargetPlatform, kIsWeb, kReleaseMode;

import 'config/env_config.dart';

/// Flavor-aware Firebase options.
///
/// Production builds must provide valid per-platform app registrations.
class DefaultFirebaseOptions {
  DefaultFirebaseOptions._();

  static const _projectId = 'thesven';
  static const _messagingSenderId = '379390504662';
  static const _storageBucket = 'thesven.firebasestorage.app';

  static const _androidProdApiKey = 'AIzaSyBKcUhOTMjv--pHr_Qmhc-jASMcrwiohNk'; // String.fromEnvironment
  static const _androidProdAppId =
      '1:379390504662:android:b710bbdc33ffa150606377';

  static const _androidDevApiKey = String.fromEnvironment(
    'SVEN_FIREBASE_ANDROID_DEV_API_KEY',
    defaultValue: _androidProdApiKey,
  );
  static const _androidDevAppId = String.fromEnvironment(
    'SVEN_FIREBASE_ANDROID_DEV_APP_ID',
    defaultValue: _androidProdAppId,
  );

  static const _androidStagingApiKey = String.fromEnvironment(
    'SVEN_FIREBASE_ANDROID_STAGING_API_KEY',
    defaultValue: _androidProdApiKey,
  );
  static const _androidStagingAppId = String.fromEnvironment(
    'SVEN_FIREBASE_ANDROID_STAGING_APP_ID',
    defaultValue: _androidProdAppId,
  );

  static const _iosProdApiKey = String.fromEnvironment(
    'SVEN_FIREBASE_IOS_PROD_API_KEY',
    defaultValue: 'AIzaSyB2FDXhLHheF8oGX5HdoIoIKGtpmnJsxL0', // String.fromEnvironment
  );
  static const _iosProdAppId = String.fromEnvironment(
    'SVEN_FIREBASE_IOS_PROD_APP_ID',
    defaultValue: '1:379390504662:ios:138fdafe711e8b99606377',
  );
  static const _iosProdBundleId = String.fromEnvironment(
    'SVEN_FIREBASE_IOS_PROD_BUNDLE_ID',
    defaultValue: 'com.fortyseven.thesven',
  );

  static const _iosDevApiKey = String.fromEnvironment(
    'SVEN_FIREBASE_IOS_DEV_API_KEY',
    defaultValue: _iosProdApiKey,
  );
  static const _iosDevAppId = String.fromEnvironment(
    'SVEN_FIREBASE_IOS_DEV_APP_ID',
    defaultValue: '1:379390504662:ios:000000000000000',
  );
  static const _iosDevBundleId = String.fromEnvironment(
    'SVEN_FIREBASE_IOS_DEV_BUNDLE_ID',
    defaultValue: 'com.fortyseven.thesven.dev',
  );

  static const _iosStagingApiKey = String.fromEnvironment(
    'SVEN_FIREBASE_IOS_STAGING_API_KEY',
    defaultValue: _iosProdApiKey,
  );
  static const _iosStagingAppId = String.fromEnvironment(
    'SVEN_FIREBASE_IOS_STAGING_APP_ID',
    defaultValue: '1:379390504662:ios:000000000000000',
  );
  static const _iosStagingBundleId = String.fromEnvironment(
    'SVEN_FIREBASE_IOS_STAGING_BUNDLE_ID',
    defaultValue: 'com.fortyseven.thesven.staging',
  );

  static const _webApiKey = String.fromEnvironment(
    'SVEN_FIREBASE_WEB_API_KEY',
    defaultValue: '',
  );
  static const _webAppId = String.fromEnvironment(
    'SVEN_FIREBASE_WEB_APP_ID',
    defaultValue: '',
  );
  static const _webAuthDomain = String.fromEnvironment(
    'SVEN_FIREBASE_WEB_AUTH_DOMAIN',
    defaultValue: 'thesven.firebaseapp.com',
  );

  static bool _looksPlaceholderAppId(String appId) {
    return appId.trim().isEmpty || appId.endsWith(':000000000000000');
  }

  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return _webOptions;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return _androidOptions;
      case TargetPlatform.iOS:
        return _iosOptions;
      case TargetPlatform.macOS:
      case TargetPlatform.windows:
      case TargetPlatform.linux:
        throw UnsupportedError(
          'DefaultFirebaseOptions: ${defaultTargetPlatform.name} is not yet '
          'supported. Register a desktop Firebase app and add its options here.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions: unsupported platform '
          '${defaultTargetPlatform.name}.',
        );
    }
  }

  static FirebaseOptions get _androidOptions {
    switch (EnvConfig.flavor) {
      case 'dev':
        return _devAndroid;
      case 'staging':
        return _stagingAndroid;
      default:
        return _prodAndroid;
    }
  }

  static const FirebaseOptions _prodAndroid = FirebaseOptions(
    apiKey: _androidProdApiKey,
    appId: _androidProdAppId,
    messagingSenderId: _messagingSenderId,
    projectId: _projectId,
    storageBucket: _storageBucket,
  );

  static const FirebaseOptions _devAndroid = FirebaseOptions(
    apiKey: _androidDevApiKey,
    appId: _androidDevAppId,
    messagingSenderId: _messagingSenderId,
    projectId: _projectId,
    storageBucket: _storageBucket,
  );

  static const FirebaseOptions _stagingAndroid = FirebaseOptions(
    apiKey: _androidStagingApiKey,
    appId: _androidStagingAppId,
    messagingSenderId: _messagingSenderId,
    projectId: _projectId,
    storageBucket: _storageBucket,
  );

  static FirebaseOptions get _iosOptions {
    final options = switch (EnvConfig.flavor) {
      'dev' => _devIos,
      'staging' => _stagingIos,
      _ => _prodIos,
    };

    if (kReleaseMode && _looksPlaceholderAppId(options.appId)) {
      throw UnsupportedError(
        'iOS Firebase appId is not configured for release flavor '
        '(${EnvConfig.flavor}). Set SVEN_FIREBASE_IOS_* dart-defines.',
      );
    }
    return options;
  }

  static FirebaseOptions get _prodIos => const FirebaseOptions(
        apiKey: _iosProdApiKey,
        appId: _iosProdAppId,
        messagingSenderId: _messagingSenderId,
        projectId: _projectId,
        storageBucket: _storageBucket,
        iosBundleId: _iosProdBundleId,
      );

  static FirebaseOptions get _devIos => const FirebaseOptions(
        apiKey: _iosDevApiKey,
        appId: _iosDevAppId,
        messagingSenderId: _messagingSenderId,
        projectId: _projectId,
        storageBucket: _storageBucket,
        iosBundleId: _iosDevBundleId,
      );

  static FirebaseOptions get _stagingIos => const FirebaseOptions(
        apiKey: _iosStagingApiKey,
        appId: _iosStagingAppId,
        messagingSenderId: _messagingSenderId,
        projectId: _projectId,
        storageBucket: _storageBucket,
        iosBundleId: _iosStagingBundleId,
      );

  static FirebaseOptions get _webOptions {
    // Safe fallback for local debug web; release requires a real web app id.
    final apiKey = _webApiKey.isNotEmpty ? _webApiKey : _androidProdApiKey;
    final appId =
        _webAppId.isNotEmpty ? _webAppId : '1:379390504662:web:000000000000000';

    if (kReleaseMode && _looksPlaceholderAppId(appId)) {
      throw UnsupportedError(
        'Web Firebase appId is not configured for release build. '
        'Set SVEN_FIREBASE_WEB_APP_ID and SVEN_FIREBASE_WEB_API_KEY.',
      );
    }

    return FirebaseOptions(
      apiKey: apiKey,
      appId: appId,
      messagingSenderId: _messagingSenderId,
      projectId: _projectId,
      storageBucket: _storageBucket,
      authDomain: _webAuthDomain,
    );
  }
}
