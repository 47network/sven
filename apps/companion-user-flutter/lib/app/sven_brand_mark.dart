import 'package:flutter/material.dart';

class SvenBrandMark extends StatelessWidget {
  const SvenBrandMark({
    super.key,
    this.size = 88,
    this.showWordmark = false,
    this.wordmarkColor = const Color(0xFFE8EEFF),
  });

  final double size;
  final bool showWordmark;
  final Color wordmarkColor;

  @override
  Widget build(BuildContext context) {
    final orbSize = size;
    final letterSize = size * 0.44;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF6FF7FF),
                Color(0xFF00D9FF),
                Color(0xFF008BB8),
              ],
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF00D9FF).withValues(alpha: 0.35),
                blurRadius: size * 0.45,
                spreadRadius: size * 0.03,
              ),
            ],
          ),
          child: SizedBox(
            width: orbSize,
            height: orbSize,
            child: Center(
              child: Text(
                'S',
                style: TextStyle(
                  fontSize: letterSize,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -1.4,
                  color: const Color(0xFF04111D),
                ),
              ),
            ),
          ),
        ),
        if (showWordmark) ...[
          SizedBox(height: size * 0.18),
          Text(
            'Sven',
            style: TextStyle(
              fontSize: size * 0.28,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.2,
              color: wordmarkColor,
            ),
          ),
        ],
      ],
    );
  }
}
