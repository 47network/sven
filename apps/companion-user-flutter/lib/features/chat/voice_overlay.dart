import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import 'voice_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// VoiceOverlay — full-screen STT voice input with pulsing orb + waveform
// ═══════════════════════════════════════════════════════════════════════════

class VoiceOverlay extends StatefulWidget {
  const VoiceOverlay({
    super.key,
    required this.visualMode,
    required this.motionLevel,
    required this.voiceService,
    this.onTranscript,
    this.ttsText,
    this.initialDraft,
  });

  final VisualMode visualMode;
  final MotionLevel motionLevel;
  final VoiceService voiceService;

  /// Called when the user confirms the transcript. Null = cancelled.
  final void Function(String transcript)? onTranscript;

  /// If TTS is currently speaking, shows "Tap to interrupt" affordance.
  final String? ttsText;

  /// Pre-existing text draft from the composer to continue seamlessly.
  final String? initialDraft;

  /// Push the overlay as a translucent modal route.
  ///
  /// [initialDraft] — if the user has typed text before switching to voice,
  /// carry it as the starting transcript so they can continue seamlessly.
  static Future<String?> show(
    BuildContext context, {
    required VisualMode visualMode,
    required MotionLevel motionLevel,
    required VoiceService voiceService,
    String? initialDraft,
  }) {
    HapticFeedback.mediumImpact();
    return Navigator.of(context).push<String>(
      PageRouteBuilder<String>(
        opaque: false,
        transitionDuration: const Duration(milliseconds: 350),
        reverseTransitionDuration: const Duration(milliseconds: 250),
        pageBuilder: (_, __, ___) => VoiceOverlay(
          visualMode: visualMode,
          motionLevel: motionLevel,
          voiceService: voiceService,
          initialDraft: initialDraft,
        ),
        transitionsBuilder: (_, anim, __, child) => FadeTransition(
          opacity: CurvedAnimation(parent: anim, curve: Curves.easeOut),
          child: child,
        ),
      ),
    );
  }

  /// Push the overlay from a [NavigatorState] to avoid depending on a captured
  /// [BuildContext] across async gaps in callers.
  static Future<String?> showFromNavigator(
    NavigatorState navigator, {
    required VisualMode visualMode,
    required MotionLevel motionLevel,
    required VoiceService voiceService,
    String? initialDraft,
  }) {
    HapticFeedback.mediumImpact();
    return navigator.push<String>(
      PageRouteBuilder<String>(
        opaque: false,
        transitionDuration: const Duration(milliseconds: 350),
        reverseTransitionDuration: const Duration(milliseconds: 250),
        pageBuilder: (_, __, ___) => VoiceOverlay(
          visualMode: visualMode,
          motionLevel: motionLevel,
          voiceService: voiceService,
          initialDraft: initialDraft,
        ),
        transitionsBuilder: (_, anim, __, child) => FadeTransition(
          opacity: CurvedAnimation(parent: anim, curve: Curves.easeOut),
          child: child,
        ),
      ),
    );
  }

  @override
  State<VoiceOverlay> createState() => _VoiceOverlayState();
}

class _VoiceOverlayState extends State<VoiceOverlay>
    with TickerProviderStateMixin {
  late final AnimationController _pulseCtrl;
  late final AnimationController _ringCtrl;
  late final AnimationController _waveCtrl;

  bool _confirmed = false;

  Timer? _durationTimer;
  int _elapsedSeconds = 0;

  /// Running transcript of the conversation: (isUser, text).
  final List<_TranscriptTurn> _conversationLog = [];
  final ScrollController _transcriptScroll = ScrollController();
  bool _bargeMonitorArmed = false;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _ringCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    );
    _waveCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );

    if (widget.motionLevel != MotionLevel.off) {
      _pulseCtrl.repeat(reverse: true);
      _ringCtrl.repeat();
    }

    widget.voiceService.addListener(_onVoiceStateChange);

    // If switching from text mode with an existing draft, seed the transcript.
    if (widget.initialDraft != null && widget.initialDraft!.trim().isNotEmpty) {
      widget.voiceService.setTranscript(widget.initialDraft!.trim());
    }

    Future.delayed(const Duration(milliseconds: 400), _startListening);
  }

  @override
  void dispose() {
    unawaited(widget.voiceService.stopBargeInMonitor());
    widget.voiceService.removeListener(_onVoiceStateChange);
    _durationTimer?.cancel();
    _pulseCtrl.dispose();
    _ringCtrl.dispose();
    _waveCtrl.dispose();
    _transcriptScroll.dispose();
    super.dispose();
  }

  void _onVoiceStateChange() {
    if (!mounted) return;
    setState(() {});

    final vs = widget.voiceService;
    final stt = vs.sttState;
    final tts = vs.ttsState;

    if (stt == SttState.listening) {
      if (_bargeMonitorArmed) {
        _bargeMonitorArmed = false;
        unawaited(widget.voiceService.stopBargeInMonitor());
      }
      if (!_waveCtrl.isAnimating) _waveCtrl.repeat();
      _pulseCtrl.duration = const Duration(milliseconds: 600);
      // Start duration counter when listening begins
      if (_durationTimer == null || !_durationTimer!.isActive) {
        _elapsedSeconds = 0;
        _durationTimer = Timer.periodic(const Duration(seconds: 1), (_) {
          if (mounted) setState(() => _elapsedSeconds++);
        });
      }
    } else if (tts == TtsState.speaking) {
      // Stop duration counter when not listening
      _durationTimer?.cancel();
      _durationTimer = null;
      // TTS active — slower pulse to indicate playback
      if (!_pulseCtrl.isAnimating) _pulseCtrl.repeat(reverse: true);
      _waveCtrl.stop();
      _pulseCtrl.duration = const Duration(milliseconds: 1800);
      _armBargeInMonitor();
    } else {
      if (_bargeMonitorArmed) {
        _bargeMonitorArmed = false;
        unawaited(widget.voiceService.stopBargeInMonitor());
      }
      _durationTimer?.cancel();
      _durationTimer = null;
      _waveCtrl.stop();
      _pulseCtrl.duration = const Duration(milliseconds: 1200);
    }

    if (stt == SttState.processing && vs.transcript.isNotEmpty && !_confirmed) {
      // User finished speaking — log their turn
      _addTranscriptTurn(true, vs.transcript);
      _confirmed = true;
      Future.delayed(const Duration(milliseconds: 600), _confirmTranscript);
    }
  }

  /// Add a turn to the running conversation transcript and auto-scroll.
  void _addTranscriptTurn(bool isUser, String text) {
    if (text.trim().isEmpty) return;
    _conversationLog.add(_TranscriptTurn(isUser: isUser, text: text.trim()));
    // Auto-scroll to bottom after frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_transcriptScroll.hasClients) {
        _transcriptScroll.animateTo(
          _transcriptScroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  /// Interrupt TTS and start listening.
  Future<void> _interruptTts() async {
    HapticFeedback.mediumImpact();
    _confirmed = false;
    await widget.voiceService.interruptAndListen(
      onResult: (text, isFinal) {
        if (mounted) setState(() {});
      },
    );
  }

  void _armBargeInMonitor() {
    if (_bargeMonitorArmed) return;
    _bargeMonitorArmed = true;
    unawaited(
      widget.voiceService.startBargeInMonitor(
        onDetected: () async {
          if (!mounted) return;
          await _interruptTts();
        },
      ),
    );
  }

  Future<void> _startListening() async {
    if (!mounted) return;
    await widget.voiceService.startListening(
      onResult: (text, isFinal) {
        if (mounted) setState(() {});
      },
    );
  }

  Future<void> _stopAndConfirm() async {
    if (widget.voiceService.sttState == SttState.listening) {
      await widget.voiceService.stopListening();
    }
    Future.delayed(const Duration(milliseconds: 400), _confirmTranscript);
  }

  void _confirmTranscript() {
    if (!mounted) return;
    final text = widget.voiceService.transcript.trim();
    widget.voiceService.resetTranscript();
    Navigator.of(context).pop(text.isEmpty ? null : text);
  }

  Future<void> _cancel() async {
    HapticFeedback.lightImpact();
    await widget.voiceService.cancelListening();
    if (!mounted) return;
    Navigator.of(context).pop(null);
  }

  /// Switch back to text mode — return the current transcript to the composer.
  void _switchToText() {
    HapticFeedback.selectionClick();
    final text = widget.voiceService.transcript.trim();
    widget.voiceService.cancelListening();
    Navigator.of(context).pop(text.isEmpty ? null : text);
  }

  String _formatDuration(int secs) {
    final m = secs ~/ 60;
    final s = secs % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;
    final accent = cinematic ? tokens.primary : const Color(0xFF0EA5A8);
    final vs = widget.voiceService;
    final sttState = vs.sttState;
    final ttsState = vs.ttsState;
    final transcript = vs.transcript;
    final soundLevel = vs.soundLevel;

    final isListening = sttState == SttState.listening;
    final isProcessing = sttState == SttState.processing;
    final isUnavailable = sttState == SttState.unavailable;
    final isSpeaking = ttsState == TtsState.speaking;

    String statusLabel;
    if (isUnavailable) {
      statusLabel = 'Speech recognition unavailable';
    } else if (isSpeaking) {
      statusLabel = 'Sven is speaking — tap to interrupt';
    } else if (isListening) {
      statusLabel = 'Listening\u2026';
    } else if (isProcessing) {
      statusLabel = 'Processing\u2026';
    } else if (transcript.isNotEmpty) {
      statusLabel = 'Tap to confirm';
    } else {
      statusLabel = 'Tap the orb to speak';
    }

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: GestureDetector(
        onTap: isUnavailable ? _cancel : null,
        child: Container(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              radius: 1.3,
              colors: cinematic
                  ? const [Color(0xFF050A18), Color(0xFF030711)]
                  : const [Color(0xF0101820), Color(0xF0080C14)],
            ),
          ),
          child: SafeArea(
            child: Stack(
              children: [
                Positioned(
                  top: 16,
                  right: 16,
                  child: IconButton.filled(
                    onPressed: _cancel,
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: 0.08),
                    ),
                    icon: Icon(Icons.close,
                        size: 24,
                        color: cinematic ? tokens.onSurface : Colors.white70),
                  ),
                ),
                Column(
                  children: [
                    const Spacer(flex: 2),
                    GestureDetector(
                      onTap: isSpeaking
                          ? _interruptTts
                          : isListening
                              ? _stopAndConfirm
                              : (isUnavailable ? null : _startListening),
                      child: AnimatedBuilder(
                        animation: Listenable.merge([_pulseCtrl, _ringCtrl]),
                        builder: (_, __) => CustomPaint(
                          size: const Size(300, 300),
                          painter: _OrbPainter(
                            pulse: widget.motionLevel != MotionLevel.off
                                ? _pulseCtrl.value
                                : 0.5,
                            ring: widget.motionLevel != MotionLevel.off
                                ? _ringCtrl.value
                                : 0,
                            soundLevel: soundLevel,
                            accent: accent,
                            cinematic: cinematic,
                            isListening: isListening,
                            isProcessing: isProcessing,
                            isSpeaking: isSpeaking,
                          ),
                        ),
                      ),
                    ),
                    const Spacer(flex: 1),
                    AnimatedOpacity(
                      opacity: isListening ? 1.0 : 0.0,
                      duration: const Duration(milliseconds: 300),
                      child: SizedBox(
                        height: 48,
                        width: MediaQuery.of(context).size.width * 0.65,
                        child: AnimatedBuilder(
                          animation: _waveCtrl,
                          builder: (_, __) => CustomPaint(
                            painter: _WaveformPainter(
                              progress: _waveCtrl.value,
                              soundLevel: soundLevel,
                              accent: accent,
                            ),
                          ),
                        ),
                      ),
                    ),
                    if (isListening)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: _NoiseLevelPill(soundLevel: soundLevel),
                      ),
                    if (isListening && _elapsedSeconds > 0)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          _formatDuration(_elapsedSeconds),
                          style: TextStyle(
                            fontSize: 13,
                            color: accent.withValues(alpha: 0.65),
                            fontWeight: FontWeight.w500,
                            letterSpacing: 1.0,
                          ),
                        ),
                      ),
                    const SizedBox(height: 12),
                    // ── Conversation transcript log ──
                    if (_conversationLog.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 32),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 120),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 10),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.04),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                  color: accent.withValues(alpha: 0.1)),
                            ),
                            child: ListView.separated(
                              controller: _transcriptScroll,
                              shrinkWrap: true,
                              padding: EdgeInsets.zero,
                              itemCount: _conversationLog.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 6),
                              itemBuilder: (_, i) {
                                final turn = _conversationLog[i];
                                return Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Icon(
                                      turn.isUser
                                          ? Icons.person_rounded
                                          : Icons.smart_toy_rounded,
                                      size: 14,
                                      color: turn.isUser
                                          ? Colors.white.withValues(alpha: 0.5)
                                          : accent.withValues(alpha: 0.7),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        turn.text,
                                        style: TextStyle(
                                          color: Colors.white
                                              .withValues(alpha: 0.65),
                                          fontSize: 13,
                                          height: 1.3,
                                        ),
                                        maxLines: 3,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                );
                              },
                            ),
                          ),
                        ),
                      ),
                    if (_conversationLog.isNotEmpty) const SizedBox(height: 8),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 40),
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 200),
                        child: transcript.isNotEmpty
                            ? Container(
                                key: const ValueKey('transcript'),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 20, vertical: 12),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.06),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                      color: accent.withValues(alpha: 0.2)),
                                ),
                                child: Text(
                                  transcript,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 17,
                                      height: 1.4),
                                ),
                              )
                            : const SizedBox(
                                key: ValueKey('empty'), height: 48),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      statusLabel,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: isListening
                            ? accent
                            : Colors.white.withValues(alpha: 0.5),
                        fontSize: 15,
                        fontWeight:
                            isListening ? FontWeight.w500 : FontWeight.normal,
                        letterSpacing: cinematic ? 0.8 : 0.2,
                      ),
                    ),
                    const SizedBox(height: 32),
                    if (!isUnavailable)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          _OverlayButton(
                            icon: Icons.close_rounded,
                            label: 'Cancel',
                            color: Colors.white.withValues(alpha: 0.35),
                            onTap: _cancel,
                          ),
                          const SizedBox(width: 28),
                          if (isSpeaking)
                            _OverlayButton(
                              icon: Icons.mic_rounded,
                              label: 'Interrupt',
                              color: const Color(0xFFFF8F00),
                              large: true,
                              onTap: _interruptTts,
                            )
                          else
                            _OverlayButton(
                              icon: isListening
                                  ? Icons.stop_rounded
                                  : Icons.check_rounded,
                              label: isListening ? 'Done' : 'Send',
                              color: accent,
                              large: true,
                              onTap: transcript.isNotEmpty || isListening
                                  ? _stopAndConfirm
                                  : null,
                            ),
                          const SizedBox(width: 28),
                          _OverlayButton(
                            icon: Icons.mic_rounded,
                            label: 'Again',
                            color: Colors.white.withValues(alpha: 0.35),
                            onTap: isListening || isSpeaking
                                ? null
                                : () async {
                                    await widget.voiceService.cancelListening();
                                    setState(() => _confirmed = false);
                                    await _startListening();
                                  },
                          ),
                        ],
                      ),
                    // ── Switch to text mode button ──
                    if (!isUnavailable)
                      Padding(
                        padding: const EdgeInsets.only(top: 16),
                        child: GestureDetector(
                          onTap: _switchToText,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 18, vertical: 8),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(20),
                              color: Colors.white.withValues(alpha: 0.06),
                              border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.12)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.keyboard_rounded,
                                    size: 16,
                                    color: Colors.white.withValues(alpha: 0.5)),
                                const SizedBox(width: 6),
                                Text(
                                  'Switch to text',
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.5),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    const Spacer(flex: 2),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OverlayButton extends StatelessWidget {
  const _OverlayButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
    this.large = false,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;
  final bool large;

  @override
  Widget build(BuildContext context) {
    final size = large ? 68.0 : 52.0;
    final iconSize = large ? 30.0 : 22.0;

    return GestureDetector(
      onTap: onTap == null
          ? null
          : () {
              HapticFeedback.lightImpact();
              onTap!();
            },
      child: Opacity(
        opacity: onTap == null ? 0.3 : 1,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: large
                    ? color.withValues(alpha: 0.15)
                    : Colors.white.withValues(alpha: 0.06),
                border: Border.all(
                  color: color.withValues(alpha: large ? 0.5 : 0.2),
                  width: large ? 1.5 : 1,
                ),
              ),
              child: Icon(icon, size: iconSize, color: color),
            ),
            const SizedBox(height: 6),
            Text(label,
                style: TextStyle(
                  color: color.withValues(alpha: 0.7),
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                )),
          ],
        ),
      ),
    );
  }
}

class _OrbPainter extends CustomPainter {
  const _OrbPainter({
    required this.pulse,
    required this.ring,
    required this.soundLevel,
    required this.accent,
    required this.cinematic,
    required this.isListening,
    required this.isProcessing,
    required this.isSpeaking,
  });

  final double pulse;
  final double ring;
  final double soundLevel;
  final Color accent;
  final bool cinematic;
  final bool isListening;
  final bool isProcessing;
  final bool isSpeaking;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final levelBoost = ((soundLevel + 2) / 12).clamp(0.0, 1.0);
    final baseR = isListening
        ? 55.0 + 20.0 * pulse + 15.0 * levelBoost
        : isSpeaking
            ? 60.0 + 18.0 * pulse
            : 55.0 + 15.0 * pulse;

    // Use a warmer color when TTS is speaking
    final orbColor = isSpeaking
        ? Color.lerp(accent, const Color(0xFFFF8F00), 0.35)!
        : accent;

    final ringCount = isListening ? 4 : (isSpeaking ? 5 : 3);
    for (var i = 0; i < ringCount; i++) {
      final phase = (ring + i / ringCount) % 1.0;
      final r = baseR + (isSpeaking ? 90 : 70) * phase;
      final a = (1 - phase) *
          (cinematic
              ? (isListening ? 0.38 : (isSpeaking ? 0.30 : 0.22))
              : 0.15);
      canvas.drawCircle(
          c,
          r,
          Paint()
            ..color = orbColor.withValues(alpha: a)
            ..style = PaintingStyle.stroke
            ..strokeWidth = cinematic ? 1.8 : 1.2);
    }

    final glowAlpha = isSpeaking
        ? 0.30 + 0.20 * pulse
        : isListening
            ? 0.35 + 0.15 * pulse
            : 0.20 + 0.10 * pulse;
    canvas.drawCircle(
        c,
        baseR + 35,
        Paint()
          ..shader = RadialGradient(colors: [
            orbColor.withValues(alpha: glowAlpha),
            orbColor.withValues(alpha: 0),
          ]).createShader(Rect.fromCircle(center: c, radius: baseR + 35)));

    if (isProcessing) {
      canvas.drawArc(
        Rect.fromCircle(center: c, radius: baseR + 12),
        -math.pi / 2,
        math.pi * 1.3,
        false,
        Paint()
          ..color = orbColor.withValues(alpha: 0.6)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.5
          ..strokeCap = StrokeCap.round,
      );
    }

    canvas.drawCircle(
        c,
        baseR,
        Paint()
          ..shader = RadialGradient(
            colors: [
              orbColor.withValues(alpha: 0.98),
              orbColor.withValues(alpha: 0.6),
              orbColor.withValues(alpha: 0.18),
            ],
            stops: const [0.0, 0.6, 1.0],
          ).createShader(Rect.fromCircle(center: c, radius: baseR)));

    // Center highlight — show mic icon hint for speaking state
    canvas.drawCircle(
        c,
        baseR * 0.32,
        Paint()
          ..shader = RadialGradient(colors: [
            Colors.white.withValues(alpha: 0.60 + 0.20 * pulse),
            Colors.white.withValues(alpha: 0),
          ]).createShader(Rect.fromCircle(center: c, radius: baseR * 0.32)));
  }

  @override
  bool shouldRepaint(_OrbPainter old) =>
      old.pulse != pulse ||
      old.ring != ring ||
      old.soundLevel != soundLevel ||
      old.isListening != isListening ||
      old.isProcessing != isProcessing ||
      old.isSpeaking != isSpeaking;
}

class _WaveformPainter extends CustomPainter {
  const _WaveformPainter({
    required this.progress,
    required this.soundLevel,
    required this.accent,
  });

  final double progress;
  final double soundLevel;
  final Color accent;

  @override
  void paint(Canvas canvas, Size size) {
    const barCount = 13;
    final barWidth = size.width / (barCount * 2 - 1);
    final levelBoost = ((soundLevel + 2) / 12).clamp(0.0, 1.0);
    final paint = Paint()
      ..color = accent.withValues(alpha: 0.75)
      ..strokeCap = StrokeCap.round;

    for (var i = 0; i < barCount; i++) {
      final phase = (progress + i / barCount) % 1.0;
      final sinVal = math.sin(phase * 2 * math.pi);
      final centerBoost = 1 - (2 * i / barCount - 1).abs();
      final h =
          (10 + 18 * levelBoost * centerBoost * (0.4 + 0.6 * sinVal.abs()))
              .clamp(4.0, size.height);
      final x = i * barWidth * 2 + barWidth / 2;
      final cy = size.height / 2;
      paint.strokeWidth = barWidth * 0.85;
      canvas.drawLine(Offset(x, cy - h / 2), Offset(x, cy + h / 2), paint);
    }
  }

  @override
  bool shouldRepaint(_WaveformPainter old) =>
      old.progress != progress || old.soundLevel != soundLevel;
}

// ═══════════════════════════════════════════════════════════════════════════
// _TranscriptTurn — a single turn in the voice conversation transcript
// ═══════════════════════════════════════════════════════════════════════════

class _TranscriptTurn {
  const _TranscriptTurn({required this.isUser, required this.text});
  final bool isUser;
  final String text;
}

// ═══════════════════════════════════════════════════════════════════════════
// _NoiseLevelPill — ambient noise quality indicator during active listening
// soundLevel range: -2 (very noisy) .. 10 (very clear) — from STT engine
// ═══════════════════════════════════════════════════════════════════════════

class _NoiseLevelPill extends StatelessWidget {
  const _NoiseLevelPill({required this.soundLevel});
  final double soundLevel;

  @override
  Widget build(BuildContext context) {
    final IconData icon;
    final String label;
    final Color color;

    if (soundLevel >= 3) {
      // Clear enough — no need to warn, show a soft green confirmation
      icon = Icons.mic_rounded;
      label = 'Clear';
      color = const Color(0xFF4CAF50);
    } else if (soundLevel >= 0) {
      icon = Icons.music_note_rounded;
      label = 'Some ambient noise';
      color = const Color(0xFFFFC107);
    } else {
      icon = Icons.warning_amber_rounded;
      label = 'Noisy — speak clearly';
      color = const Color(0xFFFF7043);
    }

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 350),
      child: Container(
        key: ValueKey(label),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: color.withValues(alpha: 0.45),
            width: soundLevel >= 3 ? 1.5 : 1.0,
          ),
          boxShadow: soundLevel >= 3
              ? [
                  BoxShadow(
                    color: color.withValues(alpha: 0.35),
                    blurRadius: 10,
                    spreadRadius: 0,
                  )
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 11.5,
                color: color,
                fontWeight: FontWeight.w500,
                letterSpacing: 0.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
