import 'package:flutter/material.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import '../memory/sven_avatar.dart';

class MirrorModeScreen extends StatelessWidget {
  const MirrorModeScreen({
    super.key,
    required this.gatewayUrl,
    required this.motionLevel,
    required this.entityChannelId,
  });

  final String gatewayUrl;
  final MotionLevel motionLevel;
  final String entityChannelId;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(VisualMode.cinematic);
    return Scaffold(
      backgroundColor: const Color(0xFF040814),
      body: SafeArea(
        child: Stack(
          children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.topCenter,
                    radius: 1.15,
                    colors: [
                      tokens.primary.withValues(alpha: 0.22),
                      const Color(0xFF040814),
                    ],
                  ),
                ),
              ),
            ),
            Positioned.fill(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Mirror Mode',
                            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ),
                        IconButton(
                          onPressed: () => Navigator.of(context).maybePop(),
                          icon: const Icon(Icons.close_rounded, color: Colors.white),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    Expanded(
                      child: Center(
                        child: SvenAvatar(
                          visualMode: VisualMode.cinematic,
                          motionLevel: motionLevel,
                          mood: SvenMood.idle,
                          size: 220,
                          avatarMode: AvatarMode.orb,
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    _StatusRow(
                      label: 'Gateway',
                      value: gatewayUrl,
                    ),
                    const SizedBox(height: 12),
                    _StatusRow(
                      label: 'Channel',
                      value: entityChannelId,
                    ),
                    const SizedBox(height: 12),
                    _StatusRow(
                      label: 'Motion',
                      value: motionLevel.label,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusRow extends StatelessWidget {
  const _StatusRow({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 88,
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: Colors.white70,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.white,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
