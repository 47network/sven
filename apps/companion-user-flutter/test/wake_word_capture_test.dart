import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';

import 'package:sven_user_flutter/app/app_models.dart';

void main() {
  group('WakeWordStatus enum', () {
    test('has exactly four values', () {
      expect(WakeWordStatus.values.length, 4);
    });

    test('idle is index 0', () {
      expect(WakeWordStatus.idle.index, 0);
    });

    test('listening is index 1', () {
      expect(WakeWordStatus.listening.index, 1);
    });

    test('detected is index 2', () {
      expect(WakeWordStatus.detected.index, 2);
    });

    test('rejected is index 3', () {
      expect(WakeWordStatus.rejected.index, 3);
    });
  });

  group('WakeWordCaptureResult parsing', () {
    // These tests exercise the JSON parsing patterns used by
    // WakeWordCaptureService._parseResult to ensure the nested
    // data.data envelope is correctly unwrapped.

    test('parses flat data envelope', () {
      final json = jsonEncode({
        'data': {
          'detected': true,
          'confidence': 0.85,
          'matched_label': 'hey_mycroft_v0.1',
          'target_label': 'hey_mycroft_v0.1',
          'top_scores': [
            {'label': 'hey_mycroft_v0.1', 'score': 0.85},
          ],
        },
      });

      final decoded = jsonDecode(json) as Map<String, dynamic>;
      final outer = decoded['data'] as Map<String, dynamic>?;
      final nested = outer != null ? outer['data'] : null;
      final data = nested is Map<String, dynamic> ? nested : outer;

      expect(data?['detected'], true);
      expect(data?['confidence'], 0.85);
      expect(data?['matched_label'], 'hey_mycroft_v0.1');
    });

    test('parses nested data.data envelope', () {
      final json = jsonEncode({
        'data': {
          'data': {
            'detected': true,
            'confidence': 0.92,
            'matched_label': 'hey_mycroft_v0.1',
            'target_label': 'hey_mycroft_v0.1',
            'top_scores': [
              {'label': 'hey_mycroft_v0.1', 'score': 0.92},
            ],
          },
          'detection_id': 'abc-123',
        },
      });

      final decoded = jsonDecode(json) as Map<String, dynamic>;
      final outer = decoded['data'] as Map<String, dynamic>?;
      final nested = outer != null ? outer['data'] : null;
      final data = nested is Map<String, dynamic> ? nested : outer;

      expect(data?['detected'], true);
      expect(data?['confidence'], 0.92);
    });

    test('handles missing data gracefully', () {
      final json = jsonEncode({'success': false});
      final decoded = jsonDecode(json) as Map<String, dynamic>;
      final outer = decoded['data'] as Map<String, dynamic>?;
      final nested = outer != null ? outer['data'] : null;
      final data = nested is Map<String, dynamic> ? nested : outer;

      expect(data, isNull);
    });

    test('handles rejected detection (detected=false)', () {
      final json = jsonEncode({
        'data': {
          'detected': false,
          'confidence': 0.12,
          'matched_label': null,
          'target_label': 'hey_mycroft_v0.1',
          'top_scores': [
            {'label': 'hey_mycroft_v0.1', 'score': 0.12},
          ],
        },
      });

      final decoded = jsonDecode(json) as Map<String, dynamic>;
      final outer = decoded['data'] as Map<String, dynamic>?;
      final nested = outer != null ? outer['data'] : null;
      final data = nested is Map<String, dynamic> ? nested : outer;

      expect(data?['detected'], false);
      expect(data?['matched_label'], isNull);
      expect(data?['confidence'], 0.12);
    });

    test('top_scores parsing handles non-list gracefully', () {
      final dynamic topScoresRaw = 'not a list';
      final topScores = topScoresRaw is List
          ? topScoresRaw
              .whereType<Map>()
              .map((row) => row.map(
                    (key, value) => MapEntry('$key', value),
                  ))
              .toList()
          : const <Map<String, dynamic>>[];

      expect(topScores, isEmpty);
    });

    test('top_scores parsing extracts label/score maps', () {
      final dynamic topScoresRaw = [
        {'label': 'hey_mycroft_v0.1', 'score': 0.85},
        {'label': 'alexa', 'score': 0.1},
      ];
      final topScores = topScoresRaw is List
          ? topScoresRaw
              .whereType<Map>()
              .map((row) => row.map(
                    (key, value) => MapEntry('$key', value),
                  ))
              .toList()
          : const <Map<String, dynamic>>[];

      expect(topScores.length, 2);
      expect(topScores[0]['label'], 'hey_mycroft_v0.1');
      expect(topScores[0]['score'], 0.85);
    });
  });
}
