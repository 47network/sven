import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:speech_to_text/speech_recognition_error.dart';
import 'package:speech_to_text/speech_to_text.dart';

// ═══════════════════════════════════════════════════════════════════════════
// Voice states
// ═══════════════════════════════════════════════════════════════════════════

enum SttState {
  unavailable, // device doesn't support STT
  idle, // ready, not listening
  listening, // actively recording
  processing, // converting speech to text
}

enum TtsState {
  idle,
  speaking,
  paused,
}

class WakeWordMatch {
  const WakeWordMatch({
    required this.phrase,
    required this.transcript,
    required this.remainder,
  });

  final String phrase;
  final String transcript;
  final String remainder;
}

// ═══════════════════════════════════════════════════════════════════════════
// VoiceService — speech-to-text + text-to-speech
// ═══════════════════════════════════════════════════════════════════════════

/// Manages STT (speech_to_text) and TTS (flutter_tts) lifecycles.
/// Notifies listeners when state changes.
class VoiceService extends ChangeNotifier {
  VoiceService() {
    _init();
  }

  // ── STT ──
  final _stt = SpeechToText();
  SttState _sttState = SttState.idle;
  String _transcript = '';
  double _confidence = 0;
  double _soundLevel = 0; // -2..10 dB from STT
  bool _sttInitialized = false;

  // ── TTS ──
  final _tts = FlutterTts();
  TtsState _ttsState = TtsState.idle;
  String? _speakingMessageId;
  double _ttsSpeed = 1.0;
  double _ttsPitch = 1.0;
  bool _autoReadAloud = false;
  String? _selectedVoiceName;
  String? _selectedVoiceLocale;
  bool _wakeWordMonitoring = false;
  String _wakeWordPhrase = 'hey sven';
  String _wakeWordLocaleId = 'en_US';
  Future<void> Function(WakeWordMatch match)? _onWakeWordDetected;
  Timer? _wakeWordRestartTimer;
  bool _wakeWordTriggering = false;
  bool _wakeWordSessionActive = false;
  static const Duration _wakeWordPauseFor = Duration(seconds: 30);
  static const Duration _wakeWordRestartDelay = Duration(milliseconds: 1200);

  // ── Streaming TTS buffer ──
  final StringBuffer _streamingTtsBuffer = StringBuffer();

  bool _disposed = false;

  // ── Duplex barge-in monitor (detect speech while TTS is speaking) ──
  bool _bargeInMode = false;
  int _bargeInHitCount = 0;
  Future<void> Function()? _onBargeDetected;
  static const double _bargeInLevelThreshold = 3.0;
  static const int _bargeInRequiredHits = 4;

  // ── Public getters ──
  SttState get sttState => _sttState;
  TtsState get ttsState => _ttsState;
  String get transcript => _transcript;
  double get confidence => _confidence;
  double get soundLevel => _soundLevel;
  bool get isListening => _sttState == SttState.listening;
  bool get isSpeaking => _ttsState == TtsState.speaking;
  String? get speakingMessageId => _speakingMessageId;
  double get ttsSpeed => _ttsSpeed;
  double get ttsPitch => _ttsPitch;
  bool get autoReadAloud => _autoReadAloud;
  String? get selectedVoiceName => _selectedVoiceName;
  String? get selectedVoiceLocale => _selectedVoiceLocale;
  bool get wakeWordMonitoring => _wakeWordMonitoring;
  String get wakeWordPhrase => _wakeWordPhrase;

  void setAutoReadAloud(bool value) {
    if (_autoReadAloud == value) return;
    _autoReadAloud = value;
    notifyListeners();
  }

  // ── Init ──

  Future<void> _init() async {
    // TTS is safe to init eagerly — it never triggers a permission dialog.
    await _initTts();
    // STT is NOT initialized here. It requests RECORD_AUDIO permission which
    // races with the POST_NOTIFICATIONS dialog from Firebase and crashes
    // Android (concurrent requestPermissions calls). STT is lazily initialized
    // on first use via ensureSttReady().
  }

  /// Lazily initialize STT. Call before any STT operation. Safe to call
  /// multiple times — only the first invocation triggers permission request.
  Future<void> ensureSttReady() async {
    if (_sttInitialized) return;
    await _initStt();
  }

  Future<void> _initStt() async {
    try {
      _sttInitialized = await _stt.initialize(
        onError: _onSttError,
        onStatus: _onSttStatus,
      );
      _sttState = _sttInitialized ? SttState.idle : SttState.unavailable;
    } catch (_) {
      _sttState = SttState.unavailable;
    }
    notifyListeners();
  }

  Future<void> _initTts() async {
    await _tts.setLanguage('en-US');
    await _tts.setSpeechRate(_ttsSpeed);
    await _tts.setPitch(_ttsPitch);
    await _tts.setVolume(1.0);

    // Apply persisted voice selection if set
    if (_selectedVoiceName != null && _selectedVoiceLocale != null) {
      await _tts.setVoice(
          {'name': _selectedVoiceName!, 'locale': _selectedVoiceLocale!});
    }

    _tts.setStartHandler(() {
      _ttsState = TtsState.speaking;
      notifyListeners();
    });
    _tts.setCompletionHandler(() {
      _ttsState = TtsState.idle;
      _speakingMessageId = null;
      notifyListeners();
    });
    _tts.setCancelHandler(() {
      _ttsState = TtsState.idle;
      _speakingMessageId = null;
      notifyListeners();
    });
    _tts.setErrorHandler((msg) {
      _ttsState = TtsState.idle;
      _speakingMessageId = null;
      notifyListeners();
    });
    _tts.setPauseHandler(() {
      _ttsState = TtsState.paused;
      notifyListeners();
    });
    _tts.setContinueHandler(() {
      _ttsState = TtsState.speaking;
      notifyListeners();
    });
  }

  // ── STT callbacks ──

  void _onSttStatus(String status) {
    debugPrint('STT status: $status');
    if (_bargeInMode) {
      // In barge-in mode we only use STT as an activity detector and do not
      // mutate user-facing STT state.
      return;
    }
    if (_wakeWordMonitoring) {
      if (status == 'listening') {
        _wakeWordSessionActive = true;
      }
      if ((status == 'notListening' || status == 'done') &&
          !_wakeWordTriggering) {
        _wakeWordSessionActive = false;
        _scheduleWakeWordRestart();
      }
      return;
    }
    if (status == 'listening') {
      _sttState = SttState.listening;
    } else if (status == 'notListening' || status == 'done') {
      if (_sttState == SttState.listening) {
        _sttState = SttState.processing;
      }
    }
    notifyListeners();
  }

  void _onSttError(SpeechRecognitionError error) {
    debugPrint('STT error: ${error.errorMsg}');
    if (_bargeInMode) {
      _bargeInMode = false;
      _bargeInHitCount = 0;
      _onBargeDetected = null;
      return;
    }
    if (_wakeWordMonitoring) {
      _wakeWordSessionActive = false;
      _scheduleWakeWordRestart();
      return;
    }
    _sttState = SttState.idle;
    notifyListeners();
  }

  // ── STT public API ──

  /// Start listening. Returns transcript via [onResult] callback.
  Future<void> startListening({
    required void Function(String transcript, bool isFinal) onResult,
    String localeId = 'en_US',
  }) async {
    await stopBargeInMonitor();
    await stopWakeWordMonitor();
    await ensureSttReady();
    if (!_sttInitialized || _sttState == SttState.unavailable) return;
    if (_sttState == SttState.listening) return;

    // Stop TTS if speaking
    if (_ttsState != TtsState.idle) await stopSpeaking();

    _transcript = '';
    _sttState = SttState.listening;
    notifyListeners();

    await _stt.listen(
      onResult: (result) {
        _transcript = result.recognizedWords;
        _confidence = result.hasConfidenceRating ? result.confidence : 1.0;
        if (_sttState != SttState.processing) {
          _sttState =
              result.finalResult ? SttState.processing : SttState.listening;
        }
        notifyListeners();
        onResult(_transcript, result.finalResult);
      },
      onSoundLevelChange: (level) {
        _soundLevel = level;
        notifyListeners();
      },
      listenFor: const Duration(minutes: 2),
      pauseFor: const Duration(seconds: 3),
      localeId: localeId,
      listenOptions: SpeechListenOptions(
        partialResults: true,
        listenMode: ListenMode.dictation,
      ),
    );
  }

  Future<void> stopListening() async {
    if (_sttState != SttState.listening) return;
    await _stt.stop();
    _sttState = SttState.processing;
    notifyListeners();
  }

  Future<void> cancelListening() async {
    await stopBargeInMonitor();
    await _stt.cancel();
    _sttState = SttState.idle;
    _transcript = '';
    _soundLevel = 0;
    notifyListeners();
  }

  void resetTranscript() {
    _transcript = '';
    _sttState = SttState.idle;
    _soundLevel = 0;
    notifyListeners();
  }

  /// Seed the transcript with existing text (e.g. when switching from text
  /// mode to voice mode mid-draft).
  void setTranscript(String text) {
    _transcript = text;
    notifyListeners();
  }

  // ── TTS public API ──

  Future<void> speak(String text, {String? messageId}) async {
    // Don't speak if STT is active
    if (_sttState == SttState.listening) return;

    if (_ttsState != TtsState.idle) {
      await _tts.stop();
    }

    _speakingMessageId = messageId;
    _ttsState = TtsState.speaking;
    notifyListeners();

    await _tts.speak(_sanitizeForTts(text));
  }

  Future<void> stopSpeaking() async {
    await stopBargeInMonitor();
    await _tts.stop();
    _ttsState = TtsState.idle;
    _speakingMessageId = null;
    notifyListeners();
  }

  /// Interrupt TTS mid-speech and immediately switch to STT.
  /// Returns true if interruption occurred and listening started.
  Future<bool> interruptAndListen({
    required void Function(String transcript, bool isFinal) onResult,
    String localeId = 'en_US',
  }) async {
    await stopBargeInMonitor();
    if (_ttsState == TtsState.idle && _sttState != SttState.listening) {
      return false; // nothing to interrupt
    }
    // Stop TTS
    await _tts.stop();
    _ttsState = TtsState.idle;
    _speakingMessageId = null;
    clearStreamingTtsBuffer();
    notifyListeners();

    // Begin STT
    await startListening(onResult: onResult, localeId: localeId);
    return true;
  }

  Future<void> pauseSpeaking() async {
    await _tts.pause();
  }

  Future<void> resumeSpeaking() async {
    await _tts.speak(_transcript); // re-issue; flutter_tts has no real resume
  }

  /// Start low-overhead barge-in monitor while TTS is speaking.
  ///
  /// If microphone activity crosses the threshold consistently, [onDetected]
  /// is invoked so caller can interrupt TTS and switch to STT immediately.
  Future<void> startBargeInMonitor({
    required Future<void> Function() onDetected,
    String localeId = 'en_US',
  }) async {
    await stopWakeWordMonitor();
    await ensureSttReady();
    if (_bargeInMode || !_sttInitialized || _sttState == SttState.unavailable) {
      return;
    }
    if (_sttState == SttState.listening) return;

    _bargeInMode = true;
    _bargeInHitCount = 0;
    _onBargeDetected = onDetected;

    try {
      await _stt.listen(
        onResult: (result) {
          if (!_bargeInMode || _ttsState != TtsState.speaking) return;
          final words = result.recognizedWords.trim();
          if (words.length >= 4) {
            final detected = _onBargeDetected;
            unawaited(stopBargeInMonitor());
            if (detected != null) unawaited(detected());
          }
        },
        onSoundLevelChange: (level) {
          if (!_bargeInMode || _ttsState != TtsState.speaking) return;
          if (level >= _bargeInLevelThreshold) {
            _bargeInHitCount += 1;
          } else {
            _bargeInHitCount = (_bargeInHitCount - 1).clamp(0, 9999);
          }
          if (_bargeInHitCount >= _bargeInRequiredHits) {
            final detected = _onBargeDetected;
            unawaited(stopBargeInMonitor());
            if (detected != null) unawaited(detected());
          }
        },
        listenFor: const Duration(minutes: 2),
        pauseFor: const Duration(seconds: 2),
        localeId: localeId,
        listenOptions: SpeechListenOptions(
          partialResults: true,
          listenMode: ListenMode.dictation,
        ),
      );
    } catch (_) {
      await stopBargeInMonitor();
    }
  }

  Future<void> stopBargeInMonitor() async {
    if (!_bargeInMode) return;
    _bargeInMode = false;
    _bargeInHitCount = 0;
    _onBargeDetected = null;
    try {
      await _stt.stop();
    } catch (e) {
      debugPrint('[VoiceService] stopBargeInMonitor stt.stop failed: $e');
    }
  }

  Future<void> startWakeWordMonitor({
    required String wakePhrase,
    required Future<void> Function(WakeWordMatch match) onDetected,
    String localeId = 'en_US',
  }) async {
    await stopBargeInMonitor();
    await ensureSttReady();
    if (!_sttInitialized || _sttState == SttState.unavailable) return;

    final normalizedPhrase = normalizeWakePhrase(wakePhrase);
    if (normalizedPhrase.isEmpty) return;

    final isSameConfiguration = _wakeWordMonitoring &&
        !_wakeWordTriggering &&
        _wakeWordPhrase == normalizedPhrase &&
        _wakeWordLocaleId == localeId;
    if (isSameConfiguration) {
      _onWakeWordDetected = onDetected;
      return;
    }

    if (_wakeWordMonitoring || _wakeWordTriggering) {
      await stopWakeWordMonitor();
    }

    _wakeWordMonitoring = true;
    _wakeWordPhrase = normalizedPhrase;
    _wakeWordLocaleId = localeId;
    _onWakeWordDetected = onDetected;
    _wakeWordTriggering = false;
    _wakeWordSessionActive = false;
    notifyListeners();
    await _startWakeWordSession();
  }

  Future<void> stopWakeWordMonitor() async {
    if (!_wakeWordMonitoring && !_wakeWordTriggering) return;
    _wakeWordMonitoring = false;
    _wakeWordTriggering = false;
    _wakeWordSessionActive = false;
    _onWakeWordDetected = null;
    _wakeWordRestartTimer?.cancel();
    _wakeWordRestartTimer = null;
    try {
      await _stt.stop();
    } catch (e) {
      debugPrint('[VoiceService] stopWakeWordMonitor stt.stop failed: $e');
    }
    notifyListeners();
  }

  Future<void> _startWakeWordSession() async {
    if (!_wakeWordMonitoring || _wakeWordTriggering) return;
    if (_wakeWordSessionActive) return;
    if (_sttState == SttState.listening || _ttsState == TtsState.speaking) {
      _scheduleWakeWordRestart();
      return;
    }

    try {
      _wakeWordSessionActive = true;
      await _stt.listen(
        onResult: (result) {
          if (!_wakeWordMonitoring || _wakeWordTriggering) return;
          final transcript = result.recognizedWords.trim();
          if (transcript.isNotEmpty) {
            debugPrint('Wake-word transcript: $transcript');
          }
          if (!transcriptContainsWakePhrase(transcript, _wakeWordPhrase)) {
            return;
          }

          _wakeWordTriggering = true;
          final detection = WakeWordMatch(
            phrase: _wakeWordPhrase,
            transcript: transcript,
            remainder: stripWakePhrase(transcript, _wakeWordPhrase),
          );
          final detected = _onWakeWordDetected;
          unawaited(_stt.stop());
          _wakeWordMonitoring = false;
          _wakeWordSessionActive = false;
          _wakeWordRestartTimer?.cancel();
          _wakeWordRestartTimer = null;
          _onWakeWordDetected = null;
          notifyListeners();
          if (detected != null) {
            unawaited(detected(detection));
          }
        },
        onSoundLevelChange: (_) {},
        listenFor: const Duration(minutes: 5),
        pauseFor: _wakeWordPauseFor,
        localeId: _wakeWordLocaleId,
        listenOptions: SpeechListenOptions(
          partialResults: true,
          listenMode: ListenMode.dictation,
        ),
      );
    } catch (_) {
      _wakeWordSessionActive = false;
      _scheduleWakeWordRestart();
    }
  }

  void _scheduleWakeWordRestart() {
    if (!_wakeWordMonitoring || _wakeWordTriggering) return;
    _wakeWordRestartTimer?.cancel();
    _wakeWordRestartTimer = Timer(_wakeWordRestartDelay, () {
      unawaited(_startWakeWordSession());
    });
  }

  Future<void> setSpeed(double speed) async {
    _ttsSpeed = speed.clamp(0.25, 3.0);
    await _tts.setSpeechRate(_ttsSpeed);
    notifyListeners();
  }

  Future<void> setPitch(double pitch) async {
    _ttsPitch = pitch.clamp(0.5, 2.0);
    await _tts.setPitch(_ttsPitch);
    notifyListeners();
  }

  // ── Streaming TTS API ──

  /// Buffer a streaming token and speak completed sentences eagerly.
  Future<void> speakPartial(String token) async {
    if (_sttState == SttState.listening) return;
    _streamingTtsBuffer.write(token);
    final text = _streamingTtsBuffer.toString();
    final boundary = _lastSentenceBoundary(text);
    if (boundary > 0 && _ttsState == TtsState.idle) {
      final toSpeak = _sanitizeForTts(text.substring(0, boundary));
      _streamingTtsBuffer.clear();
      _streamingTtsBuffer.write(text.substring(boundary));
      if (toSpeak.trim().isNotEmpty) {
        await speak(toSpeak);
      }
    }
  }

  /// Speak any remaining buffered text at the end of a stream.
  Future<void> flushStreamingTtsBuffer({String? messageId}) async {
    final remaining = _sanitizeForTts(_streamingTtsBuffer.toString().trim());
    _streamingTtsBuffer.clear();
    if (remaining.isNotEmpty && _sttState != SttState.listening) {
      await speak(remaining, messageId: messageId);
    }
  }

  /// Discard the streaming buffer (call on cancel or new message).
  void clearStreamingTtsBuffer() => _streamingTtsBuffer.clear();

  /// Returns the position after the last sentence-ending punctuation in [text].
  static int _lastSentenceBoundary(String text) {
    final regex = RegExp(r'[.!?](?:\s|$)');
    final matches = regex.allMatches(text).toList();
    if (matches.isEmpty) return 0;
    return matches.last.end;
  }

  /// Select a TTS voice by name and locale (e.g. {'name': 'en-us-x-sfg#male_1-local', 'locale': 'en-US'}).
  Future<void> setVoice(String name, String locale) async {
    _selectedVoiceName = name;
    _selectedVoiceLocale = locale;
    await _tts.setVoice({'name': name, 'locale': locale});
    notifyListeners();
  }

  /// Pre-set the voice fields from persisted preferences (call before _initTts runs).
  void restoreVoice(String? name, String? locale) {
    _selectedVoiceName = name;
    _selectedVoiceLocale = locale;
  }

  Future<List<dynamic>> getAvailableVoices() async {
    try {
      return await _tts.getVoices as List<dynamic>;
    } catch (_) {
      return [];
    }
  }

  // ── Helpers ──

  /// Strip markdown, code blocks, and LaTeX before speaking.
  static String _sanitizeForTts(String text) {
    // Remove code blocks
    text = text.replaceAll(RegExp(r'```[\s\S]*?```'), ' code block ');
    // Remove inline code
    text = text.replaceAll(RegExp(r'`[^`]+`'), '');
    // Remove LaTeX
    text = text.replaceAll(RegExp(r'\$\$[\s\S]*?\$\$'), ' math expression ');
    text = text.replaceAll(RegExp(r'\$[^\$]+\$'), ' ');
    // Remove markdown formatting
    text = text.replaceAll(RegExp(r'\*\*(.+?)\*\*'), r'$1');
    text = text.replaceAll(RegExp(r'\*(.+?)\*'), r'$1');
    text = text.replaceAll(RegExp(r'^#{1,6}\s+', multiLine: true), '');
    text = text.replaceAll(RegExp(r'\[(.+?)\]\(.+?\)'), r'$1');
    // Remove image tags
    text = text.replaceAll(RegExp(r'!\[.*?\]\(.*?\)'), '');
    // Collapse whitespace
    text = text.replaceAll(RegExp(r'\n{3,}'), '\n\n');
    return text.trim();
  }

  static String normalizeWakePhrase(String phrase) {
    return phrase
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9\s]'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  static List<String> _wakePhraseCandidates(String phrase) {
    final normalized = normalizeWakePhrase(phrase);
    if (normalized.isEmpty) return const [];

    final variants = <String>{normalized};
    if (normalized.contains('sven')) {
      variants.add(normalized.replaceAll('sven', 'seven'));
    }
    if (normalized.contains('seven')) {
      variants.add(normalized.replaceAll('seven', 'sven'));
    }
    return variants.toList(growable: false);
  }

  static bool transcriptContainsWakePhrase(String transcript, String phrase) {
    final normalizedTranscript = ' ${normalizeWakePhrase(transcript)} ';
    final candidates = _wakePhraseCandidates(phrase);
    if (candidates.isEmpty) return false;
    for (final candidate in candidates) {
      if (normalizedTranscript.contains(' $candidate ')) {
        return true;
      }
    }
    return false;
  }

  static String stripWakePhrase(String transcript, String phrase) {
    final normalizedTranscript = normalizeWakePhrase(transcript);
    final candidates = _wakePhraseCandidates(phrase);
    if (candidates.isEmpty) return normalizedTranscript;
    for (final candidate in candidates) {
      final index = normalizedTranscript.indexOf(candidate);
      if (index < 0) continue;
      return normalizedTranscript.substring(index + candidate.length).trimLeft();
    }
    return normalizedTranscript;
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _wakeWordRestartTimer?.cancel();
    unawaited(stopWakeWordMonitor());
    unawaited(stopBargeInMonitor());
    _stt.cancel();
    _tts.stop();
    super.dispose();
  }
}
