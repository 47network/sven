import 'dart:async';

import 'package:flutter/material.dart';

import 'app_models.dart';
import 'sven_tokens.dart';

/// Compact wake-word status indicator for the app header.
///
/// Shows a pulsing mic icon when listening, briefly flashes green on detection,
/// and amber on rejection. Invisible when wake word is disabled or idle.
class WakeWordStatusIndicator extends StatefulWidget {
  const WakeWordStatusIndicator({
    super.key,
    required this.status,
    required this.tokens,
    required this.phrase,
  });

  final WakeWordStatus status;
  final SvenModeTokens tokens;
  final String phrase;

  @override
  State<WakeWordStatusIndicator> createState() =>
      _WakeWordStatusIndicatorState();
}

class _WakeWordStatusIndicatorState extends State<WakeWordStatusIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseCtrl;
  Timer? _flashTimer;
  WakeWordStatus _displayStatus = WakeWordStatus.idle;

  @override
  void initState() {
    super.initState();
    _displayStatus = widget.status;
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );
    _syncAnimation();
  }

  @override
  void didUpdateWidget(covariant WakeWordStatusIndicator oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.status != widget.status) {
      _displayStatus = widget.status;
      if (widget.status == WakeWordStatus.detected ||
          widget.status == WakeWordStatus.rejected) {
        _flashTimer?.cancel();
        _flashTimer = Timer(const Duration(milliseconds: 1600), () {
          if (mounted) {
            setState(() => _displayStatus = WakeWordStatus.listening);
          }
        });
      }
      _syncAnimation();
    }
  }

  void _syncAnimation() {
    if (_displayStatus == WakeWordStatus.listening) {
      if (!_pulseCtrl.isAnimating) _pulseCtrl.repeat(reverse: true);
    } else {
      _pulseCtrl.stop();
    }
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _flashTimer?.cancel();
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_displayStatus == WakeWordStatus.idle) {
      return const SizedBox.shrink();
    }

    final Color color;
    final IconData icon;
    final String tooltip;

    switch (_displayStatus) {
      case WakeWordStatus.listening:
        color = widget.tokens.primary;
        icon = Icons.mic_rounded;
        tooltip = 'Listening for "${widget.phrase}"';
      case WakeWordStatus.detected:
        color = Colors.green;
        icon = Icons.check_circle_rounded;
        tooltip = 'Wake word detected';
      case WakeWordStatus.rejected:
        color = Colors.amber;
        icon = Icons.hearing_disabled_rounded;
        tooltip = 'Wake word not matched';
      case WakeWordStatus.idle:
        return const SizedBox.shrink();
    }

    return AnimatedBuilder(
      animation: _pulseCtrl,
      builder: (context, child) {
        final opacity = _displayStatus == WakeWordStatus.listening
            ? 0.45 + (_pulseCtrl.value * 0.55)
            : 1.0;

        return Tooltip(
          message: tooltip,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Opacity(
              opacity: opacity,
              child: Icon(
                icon,
                color: color,
                size: 18,
                semanticLabel: tooltip,
              ),
            ),
          ),
        );
      },
    );
  }
}
