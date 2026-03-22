import 'package:flutter/scheduler.dart';

import 'telemetry.dart';

class PerformanceTracker {
  PerformanceTracker._();

  static final Stopwatch _coldStartTimer = Stopwatch()..start();
  static final Stopwatch _warmResumeTimer = Stopwatch();
  static bool _homeReadyLogged = false;
  static bool _coldStartLogged = false;

  // ── Frame monitoring ────────────────────────────────────────────────────
  static bool _frameMonitoringStarted = false;
  static int _jankyFrameCount = 0;
  static int _totalFrameCount = 0;
  static DateTime _lastFrameReport = DateTime.now();

  /// Call once after [WidgetsFlutterBinding.ensureInitialized].
  static void startFrameMonitoring() {
    if (_frameMonitoringStarted) return;
    _frameMonitoringStarted = true;
    SchedulerBinding.instance.addTimingsCallback(_onFrameTimings);
  }

  static void _onFrameTimings(List<FrameTiming> timings) {
    for (final t in timings) {
      _totalFrameCount++;
      // A frame is "janky" when build OR raster exceeds 16 ms.
      if (t.buildDuration.inMicroseconds > 16000 ||
          t.rasterDuration.inMicroseconds > 16000) {
        _jankyFrameCount++;
      }
    }
    final now = DateTime.now();
    if (now.difference(_lastFrameReport).inSeconds >= 60 &&
        _jankyFrameCount > 0) {
      final pct = _totalFrameCount > 0
          ? (_jankyFrameCount / _totalFrameCount * 100).round()
          : 0;
      Telemetry.logEvent('perf.janky_frames', {
        'janky': _jankyFrameCount,
        'total': _totalFrameCount,
        'janky_pct': pct,
      });
      _jankyFrameCount = 0;
      _totalFrameCount = 0;
      _lastFrameReport = now;
    }
  }

  // ── API latency histogram ───────────────────────────────────────────────
  static final Map<String, List<int>> _apiSamples = {};
  static const _sampleThreshold = 20;

  /// Record a single API call latency and emit p50/p95 after [_sampleThreshold] samples.
  static void logApiLatency(String endpoint, int latencyMs) {
    final samples = _apiSamples.putIfAbsent(endpoint, () => []);
    samples.add(latencyMs);
    if (samples.length >= _sampleThreshold) {
      final sorted = List<int>.from(samples)..sort();
      final p50 = sorted[(sorted.length * 0.5).floor()];
      final p95 = sorted[(sorted.length * 0.95).floor()];
      Telemetry.logEvent('perf.api_latency', {
        'endpoint': endpoint,
        'p50_ms': p50,
        'p95_ms': p95,
        'samples': sorted.length,
      });
      _apiSamples[endpoint] = [];
    }
  }

  static void markHomeReady() {
    if (_homeReadyLogged) return;
    _homeReadyLogged = true;
    final elapsedMs = _coldStartTimer.elapsedMilliseconds;
    Telemetry.logEvent('startup.chat_home_ready', {
      'latency_ms': elapsedMs,
    });
    _logColdStartIfNeeded(elapsedMs);
  }

  static void _logColdStartIfNeeded(int elapsedMs) {
    if (_coldStartLogged) return;
    _coldStartLogged = true;
    Telemetry.logEvent('startup.cold_start', {
      'latency_ms': elapsedMs,
    });
  }

  static void startWarmResume() {
    _warmResumeTimer
      ..reset()
      ..start();
  }

  static void logWarmResume() {
    if (!_warmResumeTimer.isRunning) return;
    final elapsedMs = _warmResumeTimer.elapsedMilliseconds;
    _warmResumeTimer.stop();
    if (elapsedMs <= 0) return;
    Telemetry.logEvent('startup.warm_resume', {
      'latency_ms': elapsedMs,
    });
  }

  static void logChatFirstToken(int latencyMs) {
    Telemetry.logEvent('chat.stream.first_token', {
      'latency_ms': latencyMs,
    });
  }

  /// Logs the full send → SSE-delivered-assistant-reply round-trip.
  ///
  /// This is the human-perceived latency SLO (target ≤1500ms p95).
  static void logChatRoundTrip(int latencyMs) {
    Telemetry.logEvent('chat.round_trip', {
      'latency_ms': latencyMs,
    });
  }
}
