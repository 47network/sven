import 'package:flutter_test/flutter_test.dart';
import 'package:sven_user_flutter/features/trading/trading_cache.dart';

void main() {
  group('TradingCache.formatCacheAge', () {
    test('returns empty for null', () {
      expect(TradingCache.formatCacheAge(null), '');
    });

    test('returns "just now" for recent timestamp', () {
      final now = DateTime.now();
      expect(TradingCache.formatCacheAge(now), 'Updated just now');
    });

    test('returns minutes for sub-hour timestamp', () {
      final fiveAgo = DateTime.now().subtract(const Duration(minutes: 5));
      expect(TradingCache.formatCacheAge(fiveAgo), 'Updated 5m ago');
    });

    test('returns hours for sub-day timestamp', () {
      final twoHoursAgo = DateTime.now().subtract(const Duration(hours: 2));
      expect(TradingCache.formatCacheAge(twoHoursAgo), 'Updated 2h ago');
    });

    test('returns days for old timestamp', () {
      final threeDaysAgo = DateTime.now().subtract(const Duration(days: 3));
      expect(TradingCache.formatCacheAge(threeDaysAgo), 'Updated 3d ago');
    });
  });
}
