import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'voice_service.dart';

class WakeWordAudioWindow {
  const WakeWordAudioWindow({
    required this.phrase,
    required this.audioBase64,
    required this.audioMime,
  });

  final String phrase;
  final String audioBase64;
  final String audioMime;
}

class AndroidWakeWordService {
  static const _methodChannel =
      MethodChannel('com.fortyseven.thesven/wake_word_control');
  static const _eventChannel =
      EventChannel('com.fortyseven.thesven/wake_word_events');

  final _matchesController = StreamController<WakeWordMatch>.broadcast();
  final _audioWindowsController = StreamController<WakeWordAudioWindow>.broadcast();
  StreamSubscription<dynamic>? _eventsSubscription;

  static bool get isSupported =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  Stream<WakeWordMatch> get matches => _matchesController.stream;
  Stream<WakeWordAudioWindow> get audioWindows => _audioWindowsController.stream;

  Future<void> initialize() async {
    if (!isSupported || _eventsSubscription != null) return;
    _eventsSubscription = _eventChannel.receiveBroadcastStream().listen(
      _handleEvent,
      onError: (Object error, StackTrace stackTrace) {
        debugPrint('Android wake-word event error: $error');
      },
    );
  }

  Future<bool> start({required String wakePhrase}) async {
    if (!isSupported) return false;
    await initialize();
    final started = await _methodChannel.invokeMethod<bool>(
      'startWakeWordService',
      <String, Object?>{'wakePhrase': wakePhrase},
    );
    return started ?? false;
  }

  Future<void> stop() async {
    if (!isSupported) return;
    try {
      await _methodChannel.invokeMethod<bool>('stopWakeWordService');
    } catch (error) {
      debugPrint('Android wake-word stop failed: $error');
    }
  }

  Future<void> dispose() async {
    await _eventsSubscription?.cancel();
    _eventsSubscription = null;
    await _matchesController.close();
    await _audioWindowsController.close();
  }

  void _handleEvent(dynamic event) {
    if (event is! Map) return;
    final type = '${event['type'] ?? 'wake_detected'}'.trim();
    if (type == 'audio_window') {
      final phrase = '${event['phrase'] ?? ''}'.trim();
      final audioBase64 = '${event['audio_base64'] ?? ''}'.trim();
      final audioMime = '${event['audio_mime'] ?? 'audio/wav'}'.trim();
      if (phrase.isEmpty || audioBase64.isEmpty) return;
      _audioWindowsController.add(
        WakeWordAudioWindow(
          phrase: phrase,
          audioBase64: audioBase64,
          audioMime: audioMime,
        ),
      );
      return;
    }

    final phrase = '${event['phrase'] ?? ''}'.trim();
    final transcript = '${event['transcript'] ?? ''}'.trim();
    final remainder = '${event['remainder'] ?? ''}'.trim();
    if (phrase.isEmpty) return;
    _matchesController.add(
      WakeWordMatch(
        phrase: phrase,
        transcript: transcript,
        remainder: remainder,
      ),
    );
  }
}
