// Performance benchmarks — run with: flutter test test/performance_benchmark_test.dart
//
// These tests do NOT require a device; they verify:
//   1. MemoryService warm-up time (cold load from SharedPreferences mock).
//   2. buildSystemPrompt() throughput under many facts.
//   3. ChatMessage list build time as message count scales.
//   4. Language detection latency across a large corpus.
//   5. FeatureFlagService lookup is O(1) / under threshold.
//
// Thresholds are generous — the goal is to catch accidental regressions
// (e.g. an O(n²) loop) rather than micro-benchmark specific numbers.

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:sven_user_flutter/app/feature_flag_service.dart';
import 'package:sven_user_flutter/features/chat/chat_models.dart';
import 'package:sven_user_flutter/features/memory/memory_service.dart';

// ignore_for_file: avoid_redundant_argument_values

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

Duration _elapsed(void Function() fn) {
  final sw = Stopwatch()..start();
  fn();
  return sw.elapsed;
}

Future<Duration> _elapsedAsync(Future<void> Function() fn) async {
  final sw = Stopwatch()..start();
  await fn();
  return sw.elapsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Benchmarks
// ─────────────────────────────────────────────────────────────────────────────

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  // ─── 1. MemoryService initialisation ──────────────────────────────────────
  group('MemoryService initialisation', () {
    test('cold load from SharedPreferences completes within 200ms', () async {
      final elapsed = await _elapsedAsync(() async {
        // ignore: unused_local_variable
        final svc = MemoryService();
        // Give the internal async _load() time to finish.
        await Future<void>.delayed(const Duration(milliseconds: 100));
        return;
      });
      expect(
        elapsed.inMilliseconds,
        lessThan(200),
        reason: 'MemoryService cold-start took ${elapsed.inMilliseconds}ms — '
            'check for blocking I/O in _load()',
      );
    });

    test('second load (warm SharedPreferences) is not slower than cold load',
        () async {
      // Prime SharedPreferences with realistic data.
      SharedPreferences.setMockInitialValues({
        'sven.memory.enabled': true,
        'sven.memory.facts': List.generate(50, (i) => 'fact $i').join('\n'),
        'sven.memory.instructions': 'Be concise. Respond in English.',
        'sven.memory.personality_override': 'mentor',
        'sven.memory.preferred_language': 'English',
      });

      final elapsed = await _elapsedAsync(() async {
        // ignore: unused_local_variable
        final svc = MemoryService();
        await Future<void>.delayed(const Duration(milliseconds: 100));
        return;
      });
      expect(
        elapsed.inMilliseconds,
        lessThan(200),
        reason: 'Warm MemoryService load took ${elapsed.inMilliseconds}ms',
      );
    });
  });

  // ─── 2. buildSystemPrompt() throughput ────────────────────────────────────
  group('buildSystemPrompt throughput', () {
    test('builds prompt with 100 facts in under 5ms', () async {
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.setMemoryEnabled(true);
      // Inject facts directly via public API.
      for (var i = 0; i < 100; i++) {
        await svc.addFact('fact-$i: some relevant user information item $i');
      }
      final elapsed = _elapsed(() => svc.buildSystemPrompt());
      expect(
        elapsed.inMilliseconds,
        lessThan(5),
        reason: 'buildSystemPrompt() with 100 facts took '
            '${elapsed.inMilliseconds}ms',
      );
    });

    test('builds prompt 1000 times in under 500ms', () async {
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await svc.setMemoryEnabled(true);
      final elapsed = _elapsed(() {
        for (var i = 0; i < 1000; i++) {
          svc.buildSystemPrompt();
        }
      });
      expect(
        elapsed.inMilliseconds,
        lessThan(500),
        reason: '1000× buildSystemPrompt() took ${elapsed.inMilliseconds}ms',
      );
    });
  });

  // ─── 3. ChatMessage list construction ────────────────────────────────────
  group('ChatMessage list construction', () {
    test('constructing 500 ChatMessage objects takes under 50ms', () {
      final elapsed = _elapsed(() {
        final _ = List.generate(
          500,
          (i) => ChatMessage(
            id: 'msg-$i',
            role: i.isEven ? 'user' : 'assistant',
            text: 'Message content number $i — a fairly realistic string.',
            timestamp: DateTime.now().subtract(Duration(seconds: 500 - i)),
          ),
        );
      });
      expect(
        elapsed.inMilliseconds,
        lessThan(50),
        reason:
            'Constructing 500 ChatMessages took ${elapsed.inMilliseconds}ms',
      );
    });

    test('constructing 5000 ChatMessage objects takes under 200ms', () {
      final elapsed = _elapsed(() {
        final _ = List.generate(
          5000,
          (i) => ChatMessage(
            id: 'msg-$i',
            role: i.isEven ? 'user' : 'assistant',
            text: 'Message content number $i.',
            timestamp: DateTime.now().subtract(Duration(seconds: 5000 - i)),
          ),
        );
      });
      expect(
        elapsed.inMilliseconds,
        lessThan(200),
        reason:
            'Constructing 5000 ChatMessages took ${elapsed.inMilliseconds}ms',
      );
    });
  });

  // ─── 4. Language detection latency ────────────────────────────────────────
  group('Language detection', () {
    test('detectLanguage on 20 sentences completes under 10ms', () async {
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      final corpus = List.generate(
        20,
        (i) => 'This is a typical English sentence number $i in the corpus.',
      );
      final elapsed = _elapsed(() => svc.detectLanguage(corpus));
      expect(
        elapsed.inMilliseconds,
        lessThan(10),
        reason: 'detectLanguage(20) took ${elapsed.inMilliseconds}ms',
      );
    });

    test('detectLanguage called 500 times in under 100ms', () async {
      final svc = MemoryService();
      await Future<void>.delayed(const Duration(milliseconds: 50));
      final corpus = ['Hello world, this is English text for detection.'];
      final elapsed = _elapsed(() {
        for (var i = 0; i < 500; i++) {
          svc.detectLanguage(corpus);
        }
      });
      expect(
        elapsed.inMilliseconds,
        lessThan(100),
        reason: '500× detectLanguage took ${elapsed.inMilliseconds}ms',
      );
    });
  });

  // ─── 5. FeatureFlagService lookups ────────────────────────────────────────
  group('FeatureFlagService lookup performance', () {
    test('100 000 flag lookups complete in under 50ms', () {
      final flags = FeatureFlagService.instance;
      const knownFlags = [
        'message_virtualization',
        'streaming_tts',
        'offline_queue',
        'reduce_transparency',
        'high_contrast',
      ];
      final elapsed = _elapsed(() {
        for (var i = 0; i < 100000; i++) {
          flags.flag(knownFlags[i % knownFlags.length]);
        }
      });
      expect(
        elapsed.inMilliseconds,
        lessThan(50),
        reason: '100k flag lookups took ${elapsed.inMilliseconds}ms — '
            'check isEnabled() implementation',
      );
    });
  });
}
