import 'package:shared_preferences/shared_preferences.dart';

// ═══════════════════════════════════════════════════════════════════════════
// StreakService — tracks consecutive daily chat activity.
//
// Persists three values in SharedPreferences:
//   streak_count      — current consecutive-day streak
//   streak_best       — all-time best streak
//   streak_last_date  — ISO-8601 date string of last recorded activity (YYYY-MM-DD)
//
// Call [recordActivity()] once after a successful message send.
// Call [load()] at app startup (or lazily before first read).
// ═══════════════════════════════════════════════════════════════════════════

class StreakService {
  StreakService._();
  static final instance = StreakService._();

  static const _keyCount = 'streak_count';
  static const _keyBest = 'streak_best';
  static const _keyLastDate = 'streak_last_date';

  int _currentStreak = 0;
  int _bestStreak = 0;
  bool _loaded = false;

  int get currentStreak => _currentStreak;
  int get bestStreak => _bestStreak;

  /// Load persisted streak data from SharedPreferences.
  /// Safe to call multiple times — subsequent calls are no-ops.
  Future<void> load() async {
    if (_loaded) return;
    final prefs = await SharedPreferences.getInstance();
    _currentStreak = prefs.getInt(_keyCount) ?? 0;
    _bestStreak = prefs.getInt(_keyBest) ?? 0;
    _loaded = true;
  }

  /// Record that the user chatted today. Updates the streak only when the
  /// current calendar day differs from the last recorded activity date.
  Future<void> recordActivity() async {
    final prefs = await SharedPreferences.getInstance();
    final lastStr = prefs.getString(_keyLastDate);
    final today = DateTime.now();
    final todayStr =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';

    // Already counted today — no change needed
    if (lastStr == todayStr) return;

    if (lastStr != null) {
      try {
        final last = DateTime.parse(lastStr);
        final diff =
            today.difference(DateTime(last.year, last.month, last.day)).inDays;
        if (diff == 1) {
          // Consecutive day — increment
          _currentStreak++;
        } else {
          // Gap of 2+ days — streak broken
          _currentStreak = 1;
        }
      } catch (_) {
        _currentStreak = 1;
      }
    } else {
      // First-ever activity
      _currentStreak = 1;
    }

    if (_currentStreak > _bestStreak) _bestStreak = _currentStreak;
    _loaded = true;

    await prefs.setInt(_keyCount, _currentStreak);
    await prefs.setInt(_keyBest, _bestStreak);
    await prefs.setString(_keyLastDate, todayStr);
  }

  /// Reset streak data (e.g. on logout / account delete).
  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyCount);
    await prefs.remove(_keyBest);
    await prefs.remove(_keyLastDate);
    _currentStreak = 0;
    _bestStreak = 0;
    _loaded = false;
  }
}
