import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sven_user_flutter/features/security/app_lock_service.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('AppLockService', () {
    test('starts with lock disabled', () async {
      final svc = AppLockService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(svc.lockEnabled, isFalse);
      expect(svc.isLocked, isFalse);
    });

    test('setLockEnabled enables lock', () async {
      final svc = AppLockService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.setLockEnabled(true);
      expect(svc.lockEnabled, isTrue);
    });

    test('setLockEnabled false clears locked state', () async {
      final svc = AppLockService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.setLockEnabled(true);
      // Manually lock
      svc.lockNow();
      expect(svc.isLocked, isTrue);
      await svc.setLockEnabled(false);
      expect(svc.isLocked, isFalse);
    });

    test('lockNow has no effect when lockEnabled is false', () async {
      final svc = AppLockService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      svc.lockNow();
      expect(svc.isLocked, isFalse);
    });

    test('lockNow locks the app when enabled', () async {
      final svc = AppLockService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.setLockEnabled(true);
      svc.lockNow();
      expect(svc.isLocked, isTrue);
    });

    test('setTimeout persists and is reflected', () async {
      final svc = AppLockService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.setTimeout(AutoLockTimeout.oneMinute);
      expect(svc.timeout, AutoLockTimeout.oneMinute);
    });

    test('onBackground + onForeground with zero duration locks immediately',
        () async {
      final svc = AppLockService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.setLockEnabled(true);
      await svc.setTimeout(AutoLockTimeout.immediately);

      svc.onBackground();
      // Simulate instant resume (0 ms elapsed — Duration.zero means always lock)
      await Future<void>.delayed(const Duration(milliseconds: 1));
      svc.onForeground();

      expect(svc.isLocked, isTrue);
    });

    test('onForeground does not lock when within timeout window', () async {
      final svc = AppLockService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.setLockEnabled(true);
      await svc.setTimeout(AutoLockTimeout.fiveMinutes);

      svc.onBackground();
      // Resume almost immediately — within 5-minute window
      svc.onForeground();

      expect(svc.isLocked, isFalse);
    });

    test('onForeground does not lock when timeout is never', () async {
      final svc = AppLockService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.setLockEnabled(true);
      await svc.setTimeout(AutoLockTimeout.never);

      svc.onBackground();
      svc.onForeground();

      expect(svc.isLocked, isFalse);
    });

    test('AutoLockTimeout.immediately has Duration.zero', () {
      expect(AutoLockTimeout.immediately.duration, Duration.zero);
    });

    test('AutoLockTimeout.never has null duration', () {
      expect(AutoLockTimeout.never.duration, isNull);
    });

    test('AutoLockTimeout labels are not empty', () {
      for (final t in AutoLockTimeout.values) {
        expect(t.label, isNotEmpty);
      }
    });
  });
}
