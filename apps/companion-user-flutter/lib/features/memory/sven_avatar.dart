import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import '../entity/custom_shape_spec.dart';

// ═══════════════════════════════════════════════════════════════════════════
// SvenAvatar — animated orb that reacts to mood / state
// ═══════════════════════════════════════════════════════════════════════════

enum SvenMood { idle, thinking, listening, speaking, happy }

class SvenAvatar extends StatefulWidget {
  const SvenAvatar({
    super.key,
    required this.visualMode,
    required this.motionLevel,
    this.mood = SvenMood.idle,
    this.size = 80,
    this.avatarMode = AvatarMode.orb,
    this.customShapeSpec,
  });

  final VisualMode visualMode;
  final MotionLevel motionLevel;
  final SvenMood mood;
  final double size;
  final AvatarMode avatarMode;
  final CustomShapeSpec? customShapeSpec;

  @override
  State<SvenAvatar> createState() => _SvenAvatarState();
}

class _SvenAvatarState extends State<SvenAvatar> with TickerProviderStateMixin {
  late AnimationController _pulseCtrl;
  late AnimationController _ringCtrl;
  late AnimationController _thinkCtrl;
  late AnimationController _rotCtrl; // 3-D yaw — full 360° per cycle
  late AnimationController _tiltCtrl; // 3-D pitch — gentle head-nod
  late AnimationController _scanCtrl; // scan-line / sweep effects
  late AnimationController _breathCtrl; // ambient idle breathing / bio-pulse
  late AnimationController _driftCtrl; // slow ambient particle drift
  late AnimationController _glitchCtrl; // fast micro-glitch / data pulse

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );
    _ringCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3200),
    );
    _thinkCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _rotCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 9),
    );
    _tiltCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4200),
    );
    _scanCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3400),
    );
    _breathCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2700),
    );
    _driftCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 12000),
    );
    _glitchCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 850),
    );
    _startAnimations();
  }

  void _startAnimations() {
    if (widget.motionLevel == MotionLevel.off) return;
    _pulseCtrl.repeat(reverse: true);
    _ringCtrl.repeat();
    _rotCtrl.repeat();
    _tiltCtrl.repeat(reverse: true);
    _scanCtrl.repeat();
    _breathCtrl.repeat(reverse: true);
    _driftCtrl.repeat();
    _glitchCtrl.repeat();
    if (widget.mood == SvenMood.thinking) {
      _thinkCtrl.repeat();
    }
  }

  @override
  void didUpdateWidget(SvenAvatar old) {
    super.didUpdateWidget(old);
    if (old.mood != widget.mood) {
      if (widget.mood == SvenMood.thinking) {
        _thinkCtrl.repeat();
      } else {
        _thinkCtrl.stop();
        _thinkCtrl.reset();
      }
      // Pulse speed by mood
      final ms = switch (widget.mood) {
        SvenMood.listening => 600,
        SvenMood.speaking => 700,
        SvenMood.thinking => 900,
        SvenMood.happy => 500,
        SvenMood.idle => 1800,
      };
      _pulseCtrl.duration = Duration(milliseconds: ms);
    }
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    _ringCtrl.dispose();
    _thinkCtrl.dispose();
    _rotCtrl.dispose();
    _tiltCtrl.dispose();
    _scanCtrl.dispose();
    _breathCtrl.dispose();
    _driftCtrl.dispose();
    _glitchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;

    // Determine the key for AnimatedSwitcher to detect changes
    final contentKey = widget.avatarMode == AvatarMode.custom
        ? ObjectKey(widget.customShapeSpec)
        : ValueKey(widget.avatarMode);

    Widget content;

    // ── Lottie animation mode ─────────────────────────────────────────────
    if (widget.avatarMode == AvatarMode.lottie) {
      content = SizedBox(
        key: contentKey,
        width: widget.size,
        height: widget.size,
        child: Lottie.asset(
          _lottieAssetForMood(widget.mood),
          repeat: widget.motionLevel != MotionLevel.off,
          fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => _LottieFallback(
            size: widget.size,
            tokens: tokens,
            cinematic: cinematic,
          ),
        ),
      );
    } else {
      content = AnimatedBuilder(
        key: contentKey,
        animation: Listenable.merge([
          _pulseCtrl,
          _ringCtrl,
          _thinkCtrl,
          _rotCtrl,
          _tiltCtrl,
          _scanCtrl,
          _breathCtrl,
          _driftCtrl,
          _glitchCtrl,
        ]),
        builder: (_, __) {
          final pulse =
              widget.motionLevel != MotionLevel.off ? _pulseCtrl.value : 0.5;
          final ring =
              widget.motionLevel != MotionLevel.off ? _ringCtrl.value : 0.0;
          final think =
              widget.motionLevel != MotionLevel.off ? _thinkCtrl.value : 0.0;
          final rot = widget.motionLevel != MotionLevel.off
              ? _rotCtrl.value * 2 * math.pi
              : 0.0;
          final tilt = widget.motionLevel != MotionLevel.off
              ? (_tiltCtrl.value - 0.5) * 0.30
              : 0.0;
          final scan =
              widget.motionLevel != MotionLevel.off ? _scanCtrl.value : 0.35;
          final breath =
              widget.motionLevel != MotionLevel.off ? _breathCtrl.value : 0.5;
          final drift =
              widget.motionLevel != MotionLevel.off ? _driftCtrl.value : 0.0;
          final glitch =
              widget.motionLevel != MotionLevel.off ? _glitchCtrl.value : 0.0;

          CustomPainter painter;
          switch (widget.avatarMode) {
            case AvatarMode.robot:
              painter = _RobotPainter(
                pulse: pulse,
                ring: ring,
                think: think,
                rot: rot,
                tilt: tilt,
                scan: scan,
                breath: breath,
                primary: tokens.primary,
                secondary: tokens.secondary,
                cinematic: cinematic,
                mood: widget.mood,
              );
            case AvatarMode.human:
              painter = _HumanPainter(
                pulse: pulse,
                ring: ring,
                think: think,
                rot: rot,
                tilt: tilt,
                scan: scan,
                breath: breath,
                primary: tokens.primary,
                secondary: tokens.secondary,
                cinematic: cinematic,
                mood: widget.mood,
              );
            case AvatarMode.animal:
              painter = _AnimalPainter(
                pulse: pulse,
                ring: ring,
                think: think,
                rot: rot,
                tilt: tilt,
                scan: scan,
                breath: breath,
                primary: tokens.primary,
                secondary: tokens.secondary,
                cinematic: cinematic,
                mood: widget.mood,
              );
            case AvatarMode.orb:
              painter = _AvatarPainter(
                pulse: pulse,
                ring: ring,
                think: think,
                primary: tokens.primary,
                secondary: tokens.secondary,
                cinematic: cinematic,
                mood: widget.mood,
              );
            case AvatarMode.lottie:
              // Fallback if lottie mode enters this branch unexpectedly
              painter = _AvatarPainter(
                pulse: pulse,
                ring: ring,
                think: think,
                primary: tokens.primary,
                secondary: tokens.secondary,
                cinematic: cinematic,
                mood: widget.mood,
              );
            case AvatarMode.custom:
              final spec =
                  widget.customShapeSpec ?? CustomShapeSpec.defaultSpec;
              painter = _CustomShapePainter(
                pulse: pulse,
                ring: ring,
                think: think,
                rot: rot,
                tilt: tilt,
                scan: scan,
                breath: breath,
                primary: tokens.primary,
                secondary: tokens.secondary,
                cinematic: cinematic,
                mood: widget.mood,
                spec: spec,
              );
          }
          final envPainter = _SvenEnvironmentPainter(
            pulse: pulse,
            ring: ring,
            scan: scan,
            breath: breath,
            drift: drift,
            glitch: glitch,
            rot: rot,
            primary: tokens.primary,
            secondary: tokens.secondary,
            mood: widget.mood,
          );
          final auraPainter = _SvenAuraPainter(
            pulse: pulse,
            ring: ring,
            breath: breath,
            drift: drift,
            glitch: glitch,
            scan: scan,
            primary: tokens.primary,
            secondary: tokens.secondary,
            mood: widget.mood,
          );
          return SizedBox(
            width: widget.size,
            height: widget.size,
            child: Stack(
              children: [
                // Background: holographic grid + data fragments + particles
                Positioned.fill(
                  child: CustomPaint(painter: envPainter),
                ),
                // Entity avatar
                Positioned.fill(
                  child: CustomPaint(painter: painter),
                ),
                // Foreground: living aura + mood corona + pulse waves
                Positioned.fill(
                  child: CustomPaint(painter: auraPainter),
                ),
              ],
            ),
          );
        },
      );
    }

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 600),
      switchInCurve: Curves.easeOutBack,
      switchOutCurve: Curves.easeInBack,
      transitionBuilder: (child, animation) {
        return ScaleTransition(
          scale: animation,
          child: FadeTransition(
            opacity: animation,
            child: child,
          ),
        );
      },
      child: content,
    );
  }

  /// Maps a [SvenMood] to the corresponding bundled Lottie asset path.
  static String _lottieAssetForMood(SvenMood mood) {
    switch (mood) {
      case SvenMood.thinking:
        return 'assets/lottie/sven_thinking.json';
      case SvenMood.listening:
        return 'assets/lottie/sven_listening.json';
      case SvenMood.speaking:
        return 'assets/lottie/sven_speaking.json';
      case SvenMood.happy:
        return 'assets/lottie/sven_happy.json';
      case SvenMood.idle:
        return 'assets/lottie/sven_idle.json';
    }
  }
}

// ── _LottieFallback ─────────────────────────────────────────────────────────
// Circular orb shown when a Lottie JSON asset fails to load or parse.
// ────────────────────────────────────────────────────────────────────────────

class _LottieFallback extends StatelessWidget {
  const _LottieFallback({
    required this.size,
    required this.tokens,
    required this.cinematic,
  });

  final double size;
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [
              tokens.primary.withValues(alpha: 0.8),
              tokens.secondary.withValues(alpha: 0.4),
              tokens.primary.withValues(alpha: 0.1),
            ],
          ),
          boxShadow: [
            if (cinematic)
              BoxShadow(
                color: tokens.primary.withValues(alpha: 0.3),
                blurRadius: 20,
                spreadRadius: 2,
              ),
          ],
        ),
        child: Center(
          child: Text(
            '✨',
            style: TextStyle(fontSize: size * 0.35),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// _SvenEnvironmentPainter — Sven's living world (behind the entity)
// Holographic grid, floating data fragments, ambient particle motes
// ═══════════════════════════════════════════════════════════════════════════

class _SvenEnvironmentPainter extends CustomPainter {
  const _SvenEnvironmentPainter({
    required this.pulse,
    required this.ring,
    required this.scan,
    required this.breath,
    required this.drift,
    required this.glitch,
    required this.rot,
    required this.primary,
    required this.secondary,
    required this.mood,
  });

  final double pulse, ring, scan, breath, drift, glitch, rot;
  final Color primary, secondary;
  final SvenMood mood;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    final c = Offset(s / 2, s / 2);
    final r = s * 0.36;
    final isActive = mood == SvenMood.listening || mood == SvenMood.speaking;
    final isBusy = mood == SvenMood.thinking;

    // ── Deep ambient glow (Sven's presence field) ──
    canvas.drawCircle(
      c,
      s * 0.48,
      Paint()
        ..shader = RadialGradient(
          colors: [
            primary.withValues(alpha: 0.06 + 0.05 * pulse),
            primary.withValues(alpha: 0.02),
            Colors.transparent,
          ],
          stops: const [0.0, 0.55, 1.0],
        ).createShader(Rect.fromCircle(center: c, radius: s * 0.48)),
    );

    // ── Holographic ground grid ──
    // Perspective grid lines fanning out below the entity sphere
    {
      final gridAlpha = (0.04 + 0.03 * breath).clamp(0.0, 0.12);
      final gridPaint = Paint()
        ..color = secondary.withValues(alpha: gridAlpha)
        ..strokeWidth = 0.5;
      // Horizontal scanlines across lower half
      const gridLines = 6;
      for (var i = 1; i <= gridLines; i++) {
        final y = c.dy + r * 0.40 + (s * 0.05 * i);
        if (y > s) break;
        // Perspective narrowing toward horizon
        final spread = s * 0.46 * (i / gridLines);
        canvas.drawLine(
          Offset(c.dx - spread, y),
          Offset(c.dx + spread, y),
          gridPaint,
        );
      }
      // Vertical converging lines
      const vLines = 5;
      for (var i = 0; i < vLines; i++) {
        final xSpread = (i - vLines / 2 + 0.5) / (vLines / 2) * s * 0.46;
        final topX = c.dx + xSpread * 0.15;
        final botX = c.dx + xSpread;
        canvas.drawLine(
          Offset(topX, c.dy + r * 0.42),
          Offset(botX, s - 1),
          gridPaint,
        );
      }
    }

    // ── Floating data fragments (hexadecimal micro-text placeholders) ──
    // Small geometric shapes that drift and fade — the "data" Sven processes
    {
      final rng = math.Random(42);
      const nFrags = 12;
      for (var i = 0; i < nFrags; i++) {
        final baseAngle = rng.nextDouble() * 2 * math.pi;
        final baseDist = 0.30 + rng.nextDouble() * 0.20;
        final speed = 0.3 + rng.nextDouble() * 0.7;
        final angle = baseAngle + drift * 2 * math.pi * speed;
        final dist = baseDist * s;
        final fx = c.dx + math.cos(angle) * dist;
        final fy = c.dy + math.sin(angle) * dist;
        if (fx < 0 || fx > s || fy < 0 || fy > s) continue;
        // Depth-based alpha (further = dimmer)
        final depthAlpha = (1 - baseDist / 0.50).clamp(0.0, 1.0);
        final fragAlpha = (0.06 + 0.08 * pulse) *
            depthAlpha *
            (isActive
                ? 1.8
                : isBusy
                    ? 1.4
                    : 1.0);
        // Tiny shapes: hex fragment = small rectangle
        final fragSize = s * (0.008 + rng.nextDouble() * 0.010);
        canvas.drawRect(
          Rect.fromCenter(
              center: Offset(fx, fy), width: fragSize * 2.2, height: fragSize),
          Paint()
            ..color = secondary.withValues(alpha: fragAlpha.clamp(0.0, 0.35))
            ..strokeWidth = 0.5
            ..style = i.isEven ? PaintingStyle.fill : PaintingStyle.stroke,
        );
      }
    }

    // ── Ambient particle motes (tiny star-like dots orbiting far out) ──
    {
      final rng = math.Random(137);
      final nMotes = isActive ? 20 : 14;
      for (var i = 0; i < nMotes; i++) {
        final orbit = 0.38 + rng.nextDouble() * 0.12;
        final speed = 0.4 + rng.nextDouble() * 0.6;
        final phase = rng.nextDouble() * 2 * math.pi;
        final angle = phase + drift * 2 * math.pi * speed;
        // Slight vertical wobble
        final wobble = math.sin(angle * 2.3 + breath * math.pi) * s * 0.015;
        final mx = c.dx + math.cos(angle) * orbit * s;
        final my = c.dy + math.sin(angle) * orbit * s + wobble;
        if (mx < -4 || mx > s + 4 || my < -4 || my > s + 4) continue;
        final moteAlpha = (0.10 + 0.15 * pulse) * (isActive ? 1.6 : 1.0);
        final moteSz = s * (0.003 + rng.nextDouble() * 0.004);
        canvas.drawCircle(
          Offset(mx, my),
          moteSz,
          Paint()
            ..color = secondary.withValues(alpha: moteAlpha.clamp(0.0, 0.5)),
        );
        // Micro-glow
        if (i % 3 == 0) {
          canvas.drawCircle(
            Offset(mx, my),
            moteSz * 3,
            Paint()
              ..color =
                  secondary.withValues(alpha: (moteAlpha * 0.3).clamp(0.0, 0.2))
              ..maskFilter = MaskFilter.blur(BlurStyle.normal, moteSz * 3),
          );
        }
      }
    }

    // ── Thinking vortex lines (only when Sven is processing) ──
    if (isBusy) {
      for (var i = 0; i < 3; i++) {
        final vAngle = drift * 2 * math.pi * (1.2 + i * 0.3) + i * 2.1;
        final vR = r * (1.16 + i * 0.06);
        final vx = c.dx + math.cos(vAngle) * vR;
        final vy = c.dy + math.sin(vAngle) * vR;
        final vx2 = c.dx + math.cos(vAngle + 0.8) * vR * 0.88;
        final vy2 = c.dy + math.sin(vAngle + 0.8) * vR * 0.88;
        canvas.drawLine(
          Offset(vx, vy),
          Offset(vx2, vy2),
          Paint()
            ..color = secondary.withValues(alpha: 0.14 + 0.10 * pulse)
            ..strokeWidth = 0.8
            ..strokeCap = StrokeCap.round,
        );
      }
    }

    // ── Scan horizon line (environmental scanner pass) ──
    {
      final scanY = scan * s;
      canvas.drawLine(
        Offset(0, scanY),
        Offset(s, scanY),
        Paint()
          ..color = secondary.withValues(alpha: 0.03 + 0.02 * pulse)
          ..strokeWidth = 0.4,
      );
    }
  }

  @override
  bool shouldRepaint(_SvenEnvironmentPainter o) =>
      o.pulse != pulse ||
      o.drift != drift ||
      o.breath != breath ||
      o.scan != scan ||
      o.mood != mood;
}

// ═══════════════════════════════════════════════════════════════════════════
// _SvenAuraPainter — Sven's living energy field (above the entity)
// Mood-reactive corona, pulse waves, status indicators
// ═══════════════════════════════════════════════════════════════════════════

class _SvenAuraPainter extends CustomPainter {
  const _SvenAuraPainter({
    required this.pulse,
    required this.ring,
    required this.breath,
    required this.drift,
    required this.glitch,
    required this.scan,
    required this.primary,
    required this.secondary,
    required this.mood,
  });

  final double pulse, ring, breath, drift, glitch, scan;
  final Color primary, secondary;
  final SvenMood mood;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    final c = Offset(s / 2, s / 2);
    final r = s * 0.36;
    final isActive = mood == SvenMood.listening || mood == SvenMood.speaking;
    final isBusy = mood == SvenMood.thinking;

    // ── Living energy ring (the "soul boundary") ──
    // Inner ring that breathes — Sven's heartbeat
    {
      final heartR = r * (1.04 + 0.025 * math.sin(breath * math.pi * 2));
      // Glow bloom first
      canvas.drawCircle(
        c,
        heartR,
        Paint()
          ..color = primary.withValues(
              alpha: (0.08 + 0.06 * pulse) * (isActive ? 1.8 : 1.0))
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3.5
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, 4 + pulse * 3),
      );
      // Crisp ring
      canvas.drawCircle(
        c,
        heartR,
        Paint()
          ..color = primary.withValues(
              alpha: (0.12 + 0.08 * pulse) * (isActive ? 1.5 : 1.0))
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.8,
      );
    }

    // ── Mood corona arcs (emotional expression) ──
    {
      final nArcs = isActive
          ? 4
          : isBusy
              ? 3
              : 2;
      final coronaR = r * 1.10;
      for (var i = 0; i < nArcs; i++) {
        final arcStart = ring * 2 * math.pi + i * (2 * math.pi / nArcs);
        final arcLen = math.pi * (0.18 + 0.12 * pulse);
        final arcColor = i.isEven ? primary : secondary;
        canvas.drawArc(
          Rect.fromCircle(center: c, radius: coronaR + i * 2),
          arcStart,
          arcLen,
          false,
          Paint()
            ..color = arcColor.withValues(
                alpha: (0.10 + 0.08 * pulse) * (isActive ? 2.0 : 1.0))
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.2
            ..strokeCap = StrokeCap.round,
        );
      }
    }

    // ── Pulse wave rings (radiating outward like sonar) ──
    // More frequent when speaking, gentle when idle
    {
      final waveCount = isActive ? 3 : 2;
      for (var i = 0; i < waveCount; i++) {
        final phase = (ring + i / waveCount) % 1.0;
        final waveR = r * 1.08 + s * 0.16 * phase;
        final waveAlpha = (1 - phase) *
            (0.06 + 0.04 * pulse) *
            (mood == SvenMood.speaking ? 2.2 : 1.0);
        canvas.drawCircle(
          c,
          waveR,
          Paint()
            ..color = primary.withValues(alpha: waveAlpha.clamp(0.0, 0.25))
            ..style = PaintingStyle.stroke
            ..strokeWidth = 0.7,
        );
      }
    }

    // ── Status indicator dots (mood sentinel beacons) ──
    // Small dots around the periphery that light up based on mood
    {
      const nDots = 8;
      final dotR = r * 1.22;
      for (var i = 0; i < nDots; i++) {
        final dAngle = i * 2 * math.pi / nDots + drift * 0.3;
        final dx = c.dx + math.cos(dAngle) * dotR;
        final dy = c.dy + math.sin(dAngle) * dotR;
        // Active dots light up sequentially when Sven is working
        final isLit = isActive
            ? (ring * nDots).floor() % nDots == i
            : isBusy
                ? i % 2 == 0
                : i % 4 == 0;
        final dotAlpha = isLit ? (0.35 + 0.30 * pulse) : (0.04 + 0.03 * pulse);
        canvas.drawCircle(
          Offset(dx, dy),
          isLit ? 2.0 + pulse * 0.8 : 1.2,
          Paint()
            ..color = secondary.withValues(alpha: dotAlpha.clamp(0.0, 0.65)),
        );
        if (isLit) {
          canvas.drawCircle(
            Offset(dx, dy),
            4.5 + pulse * 2,
            Paint()
              ..color = secondary.withValues(alpha: 0.12 + 0.08 * pulse)
              ..maskFilter = MaskFilter.blur(BlurStyle.normal, 3 + pulse * 2),
          );
        }
      }
    }

    // ── Data glitch flicker (micro-glitch lines when idle — proves Sven is alive) ──
    if (mood == SvenMood.idle || mood == SvenMood.thinking) {
      // Brief horizontal glitch artifacts that flash
      final glitchVisible = glitch > 0.85; // only show 15% of the time
      if (glitchVisible) {
        final gy = c.dy + (glitch * 127.3 % 1.0 - 0.5) * r * 1.2;
        final gw = r * (0.15 + 0.25 * (glitch * 31.7 % 1.0));
        canvas.drawLine(
          Offset(c.dx - gw, gy),
          Offset(c.dx + gw, gy),
          Paint()
            ..color = secondary.withValues(alpha: 0.15 + 0.10 * pulse)
            ..strokeWidth = 0.7,
        );
      }
    }

    // ── Breathing inner glow halo ──
    {
      final haloBreath = math.sin(breath * math.pi) * 0.4 + 0.6;
      canvas.drawCircle(
        c,
        r * 0.88,
        Paint()
          ..shader = RadialGradient(
            colors: [
              Colors.transparent,
              primary.withValues(alpha: 0.03 * haloBreath),
              Colors.transparent,
            ],
            stops: const [0.70, 0.88, 1.0],
          ).createShader(Rect.fromCircle(center: c, radius: r * 0.88)),
      );
    }

    // ── Listening whisper arcs (when Sven is actively hearing you) ──
    if (mood == SvenMood.listening) {
      for (var i = 0; i < 3; i++) {
        final wPhase = (scan + i * 0.33) % 1.0;
        final wR = r * (0.92 - 0.14 * wPhase);
        canvas.drawArc(
          Rect.fromCircle(center: c, radius: wR),
          -math.pi / 2 - 0.4 + i * 0.3,
          0.8,
          false,
          Paint()
            ..color = secondary.withValues(alpha: (1 - wPhase) * 0.16)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.0
            ..strokeCap = StrokeCap.round,
        );
      }
    }

    // ── Happy sparkle burst ──
    if (mood == SvenMood.happy) {
      final rng = math.Random(77);
      for (var i = 0; i < 6; i++) {
        final spAngle = rng.nextDouble() * 2 * math.pi + ring * math.pi;
        final spDist = r * (1.08 + rng.nextDouble() * 0.18);
        final sx = c.dx + math.cos(spAngle) * spDist;
        final sy = c.dy + math.sin(spAngle) * spDist;
        final sparkle = math.sin(ring * 2 * math.pi * 3 + i * 1.1).abs();
        canvas.drawCircle(
          Offset(sx, sy),
          1.0 + sparkle * 1.8,
          Paint()..color = secondary.withValues(alpha: 0.25 * sparkle),
        );
      }
    }
  }

  @override
  bool shouldRepaint(_SvenAuraPainter o) =>
      o.pulse != pulse ||
      o.ring != ring ||
      o.breath != breath ||
      o.drift != drift ||
      o.glitch != glitch ||
      o.mood != mood;
}

class _AvatarPainter extends CustomPainter {
  const _AvatarPainter({
    required this.pulse,
    required this.ring,
    required this.think,
    required this.primary,
    required this.secondary,
    required this.cinematic,
    required this.mood,
  });

  final double pulse;
  final double ring;
  final double think;
  final Color primary;
  final Color secondary;
  final bool cinematic;
  final SvenMood mood;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final baseR = size.width * 0.28;

    final isActive = mood == SvenMood.listening || mood == SvenMood.speaking;
    final ringAlphaMultiplier = isActive ? 1.5 : 1.0;
    final ringCount = isActive ? 4 : 3;

    // ── Outer rings ──
    for (var i = 0; i < ringCount; i++) {
      final phase = (ring + i / ringCount) % 1.0;
      final r = baseR + size.width * 0.28 * phase;
      final a = (1 - phase) * (cinematic ? 0.22 : 0.13) * ringAlphaMultiplier;
      canvas.drawCircle(
          c,
          r,
          Paint()
            ..color = primary.withValues(alpha: a.clamp(0.0, 1.0))
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.2);
    }

    // ── Glow ──
    final glowAlpha = (mood == SvenMood.happy ? 0.40 : 0.20) + 0.12 * pulse;
    canvas.drawCircle(
        c,
        baseR + size.width * 0.18,
        Paint()
          ..shader = RadialGradient(colors: [
            primary.withValues(alpha: glowAlpha),
            primary.withValues(alpha: 0),
          ]).createShader(
              Rect.fromCircle(center: c, radius: baseR + size.width * 0.18)));

    // ── Thinking arc ──
    if (mood == SvenMood.thinking) {
      canvas.drawArc(
        Rect.fromCircle(center: c, radius: baseR + size.width * 0.06),
        -math.pi / 2 + think * 2 * math.pi,
        math.pi * 0.8,
        false,
        Paint()
          ..color = secondary.withValues(alpha: 0.7)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..strokeCap = StrokeCap.round,
      );
    }

    // ── Orb body ──
    final dynamic orbR = baseR + baseR * 0.18 * pulse;
    canvas.drawCircle(
        c,
        orbR as double,
        Paint()
          ..shader = RadialGradient(
            colors: [
              primary.withValues(alpha: 0.98),
              primary.withValues(alpha: 0.65),
              primary.withValues(alpha: 0.18),
            ],
            stops: const [0.0, 0.6, 1.0],
          ).createShader(Rect.fromCircle(center: c, radius: orbR)));

    // ── Letter S ──
    final textPainter = TextPainter(
      text: TextSpan(
        text: 'S',
        style: TextStyle(
          color: cinematic ? const Color(0xFF040712) : Colors.white,
          fontSize: size.width * 0.30,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.5,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    textPainter.paint(
      canvas,
      c - Offset(textPainter.width / 2, textPainter.height / 2),
    );

    // ── Highlight ──
    canvas.drawCircle(
        c - Offset(orbR * 0.18, orbR * 0.22),
        orbR * 0.20,
        Paint()
          ..shader = RadialGradient(colors: [
            Colors.white.withValues(alpha: 0.40 + 0.15 * pulse),
            Colors.white.withValues(alpha: 0),
          ]).createShader(Rect.fromCircle(
              center: c - Offset(orbR * 0.18, orbR * 0.22),
              radius: orbR * 0.20)));
  }

  @override
  bool shouldRepaint(_AvatarPainter old) =>
      old.pulse != pulse ||
      old.ring != ring ||
      old.think != think ||
      old.mood != mood;
}

// ─── 3-D projection helpers (shared by all entity painters) ─────────────────
//
// Object space: +X right, +Y down, +Z toward camera.
// Rotation: yaw spins around Y axis; tilt rotates around X axis.

/// Projects 3-D object-space point [nx,ny,nz] to 2-D canvas coords.
/// c = screen centre, r = sphere radius in pixels.
Offset _p3(
  double nx,
  double ny,
  double nz,
  double yaw,
  double pitch,
  Offset c,
  double r,
) {
  final cy = math.cos(yaw), sy = math.sin(yaw);
  final x1 = nx * cy + nz * sy;
  final z1 = -nx * sy + nz * cy;
  final cp = math.cos(pitch), sp = math.sin(pitch);
  final y1 = ny * cp - z1 * sp;
  final z2 = ny * sp + z1 * cp;
  const fov = 2.8;
  final w = fov / (fov + z2.clamp(-0.85, 1.6));
  return Offset(c.dx + x1 * w * r, c.dy + y1 * w * r);
}

/// Camera-space Z of a point after rotation (positive = faces camera).
double _z3(double nx, double ny, double nz, double yaw, double pitch) {
  final sy = math.sin(yaw), cy = math.cos(yaw);
  final z1 = -nx * sy + nz * cy;
  final sp = math.sin(pitch), cp = math.cos(pitch);
  return ny * sp + z1 * cp;
}

/// Foreshortening scale from camera-Z depth (0.5 – 1.6).
double _zs(double z) => ((z + 1.6) / 2.6).clamp(0.5, 1.6);

// ═══════════════════════════════════════════════════════════════════════════
// _RobotPainter — Orion · futuristic cybernetic 3-D head
// ═══════════════════════════════════════════════════════════════════════════

class _RobotPainter extends CustomPainter {
  const _RobotPainter({
    required this.pulse,
    required this.ring,
    required this.think,
    required this.rot,
    required this.tilt,
    required this.scan,
    required this.breath,
    required this.primary,
    required this.secondary,
    required this.cinematic,
    required this.mood,
  });

  final double pulse, ring, think, rot, tilt, scan, breath;
  final Color primary, secondary;
  final bool cinematic;
  final SvenMood mood;

  static const _lx = 0.388, _ly = -0.503, _lz = 0.772;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    final c = Offset(s / 2, s / 2);
    final r = s * 0.36;
    final isActive = mood == SvenMood.listening || mood == SvenMood.speaking;

    // ── Dual orbital rings ──
    const nSeg = 52;
    Offset? prevA, prevB;
    for (var i = 0; i <= nSeg; i++) {
      final theta = i / nSeg * 2 * math.pi;
      // Ring A: equatorial
      final rAx = math.cos(theta) * 1.24;
      final rAz = math.sin(theta) * 1.24;
      final rAZ = _z3(rAx, 0, rAz, rot, tilt);
      final rAp = _p3(rAx, 0, rAz, rot, tilt, c, r);
      if (prevA != null && rAZ > -0.15) {
        final a = ((0.08 + 0.36 * (rAZ + 1) / 2) * (0.8 + 0.2 * pulse))
            .clamp(0.0, 1.0);
        canvas.drawLine(
            prevA,
            rAp,
            Paint()
              ..color = secondary.withValues(alpha: a)
              ..strokeWidth = 1.4);
      }
      prevA = rAZ > -0.15 ? rAp : null;
      // Ring B: 45° tilted
      final rBx = math.cos(theta) * 1.18;
      final rBy = math.sin(theta) * math.sin(0.72) * 1.18;
      final rBz = math.sin(theta) * math.cos(0.72) * 1.18;
      final rBZ = _z3(rBx, rBy, rBz, rot, tilt);
      final rBp = _p3(rBx, rBy, rBz, rot, tilt, c, r);
      if (prevB != null && rBZ > -0.15) {
        final a = ((0.05 + 0.22 * (rBZ + 1) / 2) * pulse).clamp(0.0, 1.0);
        canvas.drawLine(
            prevB,
            rBp,
            Paint()
              ..color = secondary.withValues(alpha: a)
              ..strokeWidth = 0.8);
      }
      prevB = rBZ > -0.15 ? rBp : null;
    }

    // ── Outer atmosphere rings ──
    final rCount = isActive ? 5 : 3;
    for (var i = 0; i < rCount; i++) {
      final ph = (ring + i / rCount) % 1.0;
      canvas.drawCircle(
        c,
        r + s * 0.22 * ph,
        Paint()
          ..color = primary.withValues(
              alpha: ((1 - ph) * (0.20 + 0.12 * pulse)).clamp(0, 1))
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.0,
      );
    }

    // ── 3-D sphere body (Phong) ──
    final specPt = _p3(_lx, _ly, _lz, rot, tilt, c, r * 0.88);
    final ax = ((specPt.dx - c.dx) / r).clamp(-1.2, 1.2);
    final ay = ((specPt.dy - c.dy) / r).clamp(-1.2, 1.2);
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..shader = RadialGradient(
          center: Alignment(ax, ay),
          radius: 1.15,
          colors: [
            Colors.white.withValues(alpha: 0.46 + 0.22 * pulse),
            primary.withValues(alpha: 0.90),
            Color.lerp(primary, Colors.black, 0.72)!,
          ],
          stops: const [0.0, 0.42, 1.0],
        ).createShader(Rect.fromCircle(center: c, radius: r)),
    );
    // AO rim
    canvas.drawCircle(
        c,
        r,
        Paint()
          ..shader = RadialGradient(
            radius: 1.0,
            colors: [Colors.transparent, Colors.black.withValues(alpha: 0.38)],
            stops: const [0.58, 1.0],
          ).createShader(Rect.fromCircle(center: c, radius: r)));
    // Metallic rim glow
    canvas.drawCircle(
        c,
        r,
        Paint()
          ..color = secondary.withValues(alpha: 0.09 + 0.06 * pulse)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.8
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4));

    // ── Scan line sweep ──
    {
      final scanY = c.dy - r + 2 * r * scan;
      canvas.save();
      canvas
          .clipPath(Path()..addOval(Rect.fromCircle(center: c, radius: r - 1)));
      canvas.drawRect(
        Rect.fromLTWH(c.dx - r, scanY - r * 0.08, r * 2, r * 0.08),
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.bottomCenter,
            end: Alignment.topCenter,
            colors: [secondary.withValues(alpha: 0.14), Colors.transparent],
          ).createShader(
              Rect.fromLTWH(c.dx - r, scanY - r * 0.08, r * 2, r * 0.08)),
      );
      canvas.drawLine(
          Offset(c.dx - r, scanY),
          Offset(c.dx + r, scanY),
          Paint()
            ..color = secondary.withValues(alpha: 0.55)
            ..strokeWidth = 1.3
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.5));
      canvas.restore();
    }

    // ── Circuit traces on sphere surface ──
    final traces = <List<(double, double, double)>>[
      [
        (-0.52, -0.30, 0.80),
        (-0.60, -0.14, 0.78),
        (-0.66, 0.02, 0.75),
        (-0.62, 0.18, 0.78),
        (-0.54, 0.28, 0.80)
      ],
      [
        (0.52, -0.30, 0.80),
        (0.60, -0.14, 0.78),
        (0.66, 0.02, 0.75),
        (0.62, 0.18, 0.78),
        (0.54, 0.28, 0.80)
      ],
      [(-0.10, 0.55, 0.83), (0.0, 0.62, 0.78), (0.10, 0.55, 0.83)],
    ];
    for (final trace in traces) {
      Offset? prev;
      for (final pt in trace) {
        final pZ = _z3(pt.$1, pt.$2, pt.$3, rot, tilt);
        if (pZ < 0.06) {
          prev = null;
          continue;
        }
        final pp = _p3(pt.$1, pt.$2, pt.$3, rot, tilt, c, r);
        if (prev != null) {
          canvas.drawLine(
              prev,
              pp,
              Paint()
                ..color =
                    secondary.withValues(alpha: (0.48 * _zs(pZ)).clamp(0, 1))
                ..strokeWidth = 0.9);
        }
        canvas.drawCircle(
            pp,
            1.6,
            Paint()
              ..color =
                  secondary.withValues(alpha: (0.55 * _zs(pZ)).clamp(0, 1)));
        prev = pp;
      }
    }

    // ── Visor band with inner grid ──
    final vzZ = _z3(0, -0.04, 0.97, rot, tilt);
    if (vzZ > -0.08) {
      final vzL = _p3(-0.76, -0.10, 0.64, rot, tilt, c, r);
      final vzR = _p3(0.76, -0.10, 0.64, rot, tilt, c, r);
      final vzS = _zs(vzZ);
      final visorRect = Rect.fromCenter(
        center: Offset((vzL.dx + vzR.dx) / 2, (vzL.dy + vzR.dy) / 2),
        width: (vzR.dx - vzL.dx).abs() + 4,
        height: r * 0.28 * vzS,
      );
      canvas.drawRRect(
          RRect.fromRectAndRadius(visorRect, Radius.circular(5 * vzS)),
          Paint()..color = Colors.black.withValues(alpha: 0.68));
      canvas.drawRRect(
        RRect.fromRectAndRadius(visorRect, Radius.circular(5 * vzS)),
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              secondary.withValues(alpha: 0.20 + 0.08 * pulse),
              secondary.withValues(alpha: 0.04),
            ],
          ).createShader(visorRect),
      );
      for (var gi = 0; gi < 3; gi++) {
        final gy = visorRect.top + (gi + 1) * visorRect.height / 4;
        canvas.drawLine(
          Offset(visorRect.left + 4, gy),
          Offset(visorRect.right - 4, gy),
          Paint()
            ..color = secondary.withValues(alpha: 0.14 * vzS.clamp(0, 1))
            ..strokeWidth = 0.5,
        );
      }
    }

    // ── Status hexagons on forehead ──
    for (var hi = -1; hi <= 1; hi++) {
      final hZ = _z3(hi * 0.26, -0.62, 0.78, rot, tilt);
      if (hZ < 0.0) continue;
      final hp = _p3(hi * 0.26, -0.62, 0.78, rot, tilt, c, r);
      final hexR = r * 0.057 * _zs(hZ);
      final hexPath = Path();
      for (var fi = 0; fi < 6; fi++) {
        final ang = fi * math.pi / 3 - math.pi / 6;
        final hx2 = hp.dx + hexR * math.cos(ang);
        final hy2 = hp.dy + hexR * math.sin(ang);
        if (fi == 0) {
          hexPath.moveTo(hx2, hy2);
        } else {
          hexPath.lineTo(hx2, hy2);
        }
      }
      hexPath.close();
      final hexOn = (hi == 0 && mood == SvenMood.thinking) ||
          (hi == 1 && isActive) ||
          (hi == -1 && mood == SvenMood.happy);
      if (hexOn) {
        canvas.drawPath(hexPath,
            Paint()..color = secondary.withValues(alpha: 0.22 + 0.15 * pulse));
      }
      canvas.drawPath(
          hexPath,
          Paint()
            ..color = secondary.withValues(
                alpha: hexOn ? (0.70 + 0.30 * pulse) : 0.26)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.0);
    }

    // ── Eyes ──
    for (final sign in [-1.0, 1.0]) {
      final ez = _z3(sign * 0.30, -0.05, 0.95, rot, tilt);
      if (ez < -0.06) continue;
      final ep = _p3(sign * 0.30, -0.05, 0.95, rot, tilt, c, r);
      final zs = _zs(ez);
      final ew = r * 0.24 * zs;
      final eh = r * (mood == SvenMood.thinking ? 0.05 : 0.13) * zs;
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: ep, width: ew + 7 * zs, height: eh + 7 * zs),
          Radius.circular(3 * zs),
        ),
        Paint()..color = Colors.black.withValues(alpha: 0.88),
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: ep, width: ew, height: eh),
          Radius.circular(2 * zs),
        ),
        Paint()
          ..color = secondary.withValues(alpha: 0.72 + 0.28 * pulse)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, 3 + pulse * 4),
      );
      // Targeting brackets at 4 corners
      final bLen = ew * 0.30;
      for (final cx2 in [-1.0, 1.0]) {
        for (final cy2 in [-1.0, 1.0]) {
          final bx = ep.dx + cx2 * (ew / 2 + 3.5 * zs);
          final by = ep.dy + cy2 * (eh / 2 + 3.5 * zs);
          final bp = Paint()
            ..color = secondary.withValues(alpha: 0.55 + 0.25 * pulse)
            ..strokeWidth = 1.2
            ..strokeCap = StrokeCap.square;
          canvas.drawLine(Offset(bx, by), Offset(bx - cx2 * bLen, by), bp);
          canvas.drawLine(
              Offset(bx, by), Offset(bx, by - cy2 * bLen * 0.55), bp);
        }
      }
      canvas.drawCircle(ep + Offset(-ew * 0.20, -eh * 0.22), ew * 0.14,
          Paint()..color = Colors.white.withValues(alpha: 0.40 + 0.18 * pulse));
    }

    // ── Mouth — segmented LED bar ──
    final mz = _z3(0, 0.32, 0.95, rot, tilt);
    if (mz > -0.08) {
      final mp = _p3(0, 0.32, 0.95, rot, tilt, c, r);
      final zs = _zs(mz);
      final mw = switch (mood) {
            SvenMood.happy => r * 0.62,
            SvenMood.speaking => r * 0.50 * (1 + 0.15 * pulse),
            SvenMood.thinking => r * 0.24,
            _ => r * 0.40,
          } *
          zs;
      final mh = r * 0.065 * zs;
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: mp, width: mw + 5 * zs, height: mh + 5 * zs),
          Radius.circular(3 * zs),
        ),
        Paint()..color = Colors.black.withValues(alpha: 0.78),
      );
      const nLed = 7;
      for (var si = 0; si < nLed; si++) {
        final sx = mp.dx - mw / 2 + (si + 0.5) * (mw / nLed);
        final sw = mw / nLed - 2.5 * zs;
        if (sw <= 0) continue;
        final on = mood != SvenMood.thinking || si == nLed ~/ 2;
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromCenter(center: Offset(sx, mp.dy), width: sw, height: mh),
            Radius.circular(1.5 * zs),
          ),
          Paint()
            ..color =
                secondary.withValues(alpha: on ? (0.58 + 0.35 * pulse) : 0.16)
            ..maskFilter =
                on ? MaskFilter.blur(BlurStyle.normal, 2 + pulse * 2) : null,
        );
      }
    }

    // ── Antenna with cross-fin ──
    final antZ = _z3(0, -1.0, 0, rot, tilt);
    if (antZ > -0.20) {
      final aBase = _p3(0, -1.0, 0, rot, tilt, c, r);
      final aTip = _p3(0, -1.70 - 0.12 * pulse, 0, rot, tilt, c, r);
      canvas.drawLine(
          aBase,
          aTip,
          Paint()
            ..color = secondary.withValues(alpha: 0.86 + 0.14 * pulse)
            ..strokeWidth = 2.2
            ..strokeCap = StrokeCap.round);
      final aMid = Offset((aBase.dx + aTip.dx) / 2, (aBase.dy + aTip.dy) / 2);
      final finLen = r * 0.12 * _zs(antZ).clamp(0.5, 1.4);
      canvas.drawLine(
          aMid + Offset(-finLen, 0),
          aMid + Offset(finLen, 0),
          Paint()
            ..color = secondary.withValues(alpha: 0.62 + 0.20 * pulse)
            ..strokeWidth = 1.5);
      canvas.drawCircle(
          aTip,
          4.5 + pulse * 2.5,
          Paint()
            ..color = secondary
            ..maskFilter = MaskFilter.blur(BlurStyle.normal, 3 + pulse * 2));
    }

    // ── Specular ──
    canvas.drawCircle(
      specPt,
      r * 0.09 + r * 0.06 * pulse,
      Paint()
        ..shader = RadialGradient(colors: [
          Colors.white.withValues(alpha: 0.52 + 0.20 * pulse),
          Colors.white.withValues(alpha: 0),
        ]).createShader(Rect.fromCircle(
            center: specPt, radius: r * 0.11 + r * 0.06 * pulse)),
    );
  }

  @override
  bool shouldRepaint(_RobotPainter o) =>
      o.pulse != pulse ||
      o.rot != rot ||
      o.tilt != tilt ||
      o.scan != scan ||
      o.mood != mood;
}

// ═══════════════════════════════════════════════════════════════════════════
// _HumanPainter — Aria · cyberpunk holographic human
// ═══════════════════════════════════════════════════════════════════════════

class _HumanPainter extends CustomPainter {
  const _HumanPainter({
    required this.pulse,
    required this.ring,
    required this.think,
    required this.rot,
    required this.tilt,
    required this.scan,
    required this.breath,
    required this.primary,
    required this.secondary,
    required this.cinematic,
    required this.mood,
  });

  final double pulse, ring, think, rot, tilt, scan, breath;
  final Color primary, secondary;
  final bool cinematic;
  final SvenMood mood;

  static const _lx = 0.388, _ly = -0.503, _lz = 0.772;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    final c = Offset(s / 2, s / 2);
    final r = s * 0.36;

    // ── Particle orbit field (8 particles, tilted orbit plane) ──
    const nPart = 8;
    const orbitR = 1.30;
    const orbitTilt = 0.52;
    for (var i = 0; i < nPart; i++) {
      final theta = (i / nPart * 2 * math.pi) + scan * 2 * math.pi;
      final px = math.cos(theta) * orbitR;
      final py = -math.sin(theta) * math.sin(orbitTilt) * orbitR;
      final pz = math.sin(theta) * math.cos(orbitTilt) * orbitR;
      final pZ = _z3(px, py, pz, rot, tilt);
      if (pZ < -0.05) continue;
      final pp = _p3(px, py, pz, rot, tilt, c, r);
      final pSz = r * 0.040 * _zs(pZ).clamp(0.4, 1.8);
      canvas.drawCircle(
        pp,
        pSz,
        Paint()
          ..color = secondary.withValues(
              alpha: ((0.55 + 0.35 * pulse) * _zs(pZ).clamp(0, 1)).clamp(0, 1))
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, 1.5 + pSz),
      );
    }

    // ── Outer rings ──
    for (var i = 0; i < 3; i++) {
      final ph = (ring + i / 3.0) % 1.0;
      canvas.drawCircle(
        c,
        r + s * 0.22 * ph,
        Paint()
          ..color = primary.withValues(
              alpha: ((1 - ph) * (0.16 + 0.10 * pulse)).clamp(0, 1))
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2,
      );
    }

    // ── 3-D sphere body ──
    final specPt = _p3(_lx, _ly, _lz, rot, tilt, c, r * 0.88);
    final ax = ((specPt.dx - c.dx) / r).clamp(-1.2, 1.2);
    final ay = ((specPt.dy - c.dy) / r).clamp(-1.2, 1.2);
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..shader = RadialGradient(
          center: Alignment(ax, ay),
          radius: 1.1,
          colors: [
            Colors.white.withValues(alpha: 0.44 + 0.16 * pulse),
            primary.withValues(alpha: 0.88),
            Color.lerp(primary, Colors.black, 0.68)!,
          ],
          stops: const [0.0, 0.40, 1.0],
        ).createShader(Rect.fromCircle(center: c, radius: r)),
    );
    canvas.drawCircle(
        c,
        r,
        Paint()
          ..shader = RadialGradient(
            radius: 1.0,
            colors: [Colors.transparent, Colors.black.withValues(alpha: 0.26)],
            stops: const [0.62, 1.0],
          ).createShader(Rect.fromCircle(center: c, radius: r)));
    // Iridescent rim
    canvas.drawCircle(
        c,
        r,
        Paint()
          ..color = secondary.withValues(alpha: 0.11 + 0.07 * pulse)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.2
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4));

    // ── Neural lace (forehead web) ──
    final laceZ = _z3(0, -0.56, 0.83, rot, tilt);
    if (laceZ > 0.05) {
      final laceC = _p3(0, -0.56, 0.83, rot, tilt, c, r);
      const nRays = 10;
      for (var li = 0; li < nRays; li++) {
        final angle = li * 2 * math.pi / nRays;
        final lx = math.sin(angle) * 0.44;
        final ly = -0.56 + math.cos(angle) * 0.32;
        final lzRaw = math.sqrt(math.max(0.02, 1.0 - lx * lx - ly * ly));
        final lz = lzRaw * 0.65 + 0.22;
        final lZ = _z3(lx, ly, lz, rot, tilt);
        if (lZ < 0.0) continue;
        final lp = _p3(lx, ly, lz, rot, tilt, c, r);
        canvas.drawLine(
          laceC,
          lp,
          Paint()
            ..color = secondary.withValues(
                alpha:
                    ((0.22 + 0.14 * pulse) * _zs(lZ).clamp(0, 1)).clamp(0, 1))
            ..strokeWidth = 0.7,
        );
        canvas.drawCircle(
          lp,
          1.5 + pulse * 0.9,
          Paint()
            ..color = secondary.withValues(
                alpha:
                    ((0.36 + 0.22 * pulse) * _zs(lZ).clamp(0, 1)).clamp(0, 1)),
        );
      }
      canvas.drawCircle(
        laceC,
        2.6 + pulse * 1.2,
        Paint()
          ..color = secondary.withValues(alpha: 0.58 + 0.30 * pulse)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2),
      );
    }

    // ── Neon hair strands (5, with drift + glowing tips) ──
    const nStrands = 5;
    for (var i = 0; i < nStrands; i++) {
      final hx = (i - nStrands / 2 + 0.5) / (nStrands / 2) * 0.56;
      final drift = math.sin(ring * 2 * math.pi + i * 0.9) * 0.13;
      final hRoot = _p3(hx, -0.90, 0.36, rot, tilt, c, r);
      final hCtrl = _p3(hx * 1.45 + drift, -1.38, 0.15, rot, tilt, c, r);
      final hTip = _p3(
          hx * 0.65 + drift * 1.6, -1.76 - 0.14 * pulse, 0.02, rot, tilt, c, r);
      final hZ = _z3(hx, -0.90, 0.36, rot, tilt);
      if (hZ < -0.25) continue;
      final hVis = _zs(hZ).clamp(0.0, 1.0);
      canvas.drawPath(
        Path()
          ..moveTo(hRoot.dx, hRoot.dy)
          ..quadraticBezierTo(hCtrl.dx, hCtrl.dy, hTip.dx, hTip.dy),
        Paint()
          ..color = secondary.withValues(alpha: (0.52 + 0.28 * pulse) * hVis)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.4 * _zs(hZ).clamp(0.5, 1.4)
          ..strokeCap = StrokeCap.round,
      );
      canvas.drawCircle(
        hTip,
        3.0 + pulse * 1.6,
        Paint()
          ..color = secondary.withValues(alpha: (0.65 + 0.30 * pulse) * hVis)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, 3 + pulse * 2),
      );
    }

    // ── Eyes ──
    for (final sign in [-1.0, 1.0]) {
      final ez = _z3(sign * 0.28, -0.08, 0.96, rot, tilt);
      if (ez < -0.06) continue;
      final ep = _p3(sign * 0.28, -0.08, 0.96, rot, tilt, c, r);
      final zs = _zs(ez);
      // Sclera
      canvas.drawOval(
        Rect.fromCenter(
            center: ep, width: r * 0.27 * zs, height: r * 0.20 * zs),
        Paint()..color = Colors.white.withValues(alpha: 0.90),
      );
      // Outer spinning arc iris ring
      canvas.drawArc(
        Rect.fromCenter(
            center: ep, width: r * 0.25 * zs, height: r * 0.19 * zs),
        ring * 2 * math.pi * sign,
        math.pi * 1.5,
        false,
        Paint()
          ..color = secondary.withValues(alpha: 0.55 + 0.28 * pulse)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.4 * zs
          ..strokeCap = StrokeCap.round,
      );
      // Mid iris ring
      canvas.drawOval(
        Rect.fromCenter(
            center: ep, width: r * 0.19 * zs, height: r * 0.14 * zs),
        Paint()
          ..color = secondary.withValues(alpha: 0.28)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.8 * zs,
      );
      // Iris fill
      final irisR = r * 0.09 * zs;
      canvas.drawCircle(
          ep, irisR, Paint()..color = secondary.withValues(alpha: 0.92));
      canvas.drawCircle(ep, irisR * 0.48,
          Paint()..color = Colors.black.withValues(alpha: 0.88));
      // Blink
      if (mood == SvenMood.thinking && think > 0.80) {
        canvas.drawOval(
          Rect.fromCenter(
              center: ep, width: r * 0.28 * zs, height: r * 0.022 * zs),
          Paint()..color = Color.lerp(primary, Colors.black, 0.42)!,
        );
      }
      canvas.drawCircle(
        ep + Offset(-irisR * 0.44, -irisR * 0.40),
        irisR * 0.28,
        Paint()..color = Colors.white.withValues(alpha: 0.70),
      );
    }

    // ── Cheekbone tri-glow ──
    for (final sign in [-1.0, 1.0]) {
      final ckZ = _z3(sign * 0.40, 0.06, 0.91, rot, tilt);
      if (ckZ < 0.06) continue;
      final ck = _p3(sign * 0.40, 0.06, 0.91, rot, tilt, c, r);
      final zs = _zs(ckZ);
      final tl = r * 0.14 * zs;
      final triPath = Path()
        ..moveTo(ck.dx - sign * tl, ck.dy - tl * 0.38)
        ..lineTo(ck.dx + sign * tl * 0.38, ck.dy)
        ..lineTo(ck.dx - sign * tl, ck.dy + tl * 0.38)
        ..close();
      canvas.drawPath(
          triPath,
          Paint()
            ..color = secondary.withValues(
                alpha: (0.13 + 0.10 * pulse) * ckZ.clamp(0, 1)));
      canvas.drawPath(
          triPath,
          Paint()
            ..color = secondary.withValues(
                alpha: (0.32 + 0.20 * pulse) * ckZ.clamp(0, 1))
            ..style = PaintingStyle.stroke
            ..strokeWidth = 0.9 * zs);
    }

    // ── Nose ──
    final noseZ = _z3(0, 0.10, 0.99, rot, tilt);
    if (noseZ > 0.0) {
      final np = _p3(0, 0.10, 0.99, rot, tilt, c, r);
      canvas.drawCircle(np, r * 0.040 * _zs(noseZ),
          Paint()..color = Colors.white.withValues(alpha: 0.38));
    }

    // ── Mouth with glowing lip edge ──
    final mz = _z3(0, 0.35, 0.94, rot, tilt);
    if (mz > -0.08) {
      final mL = _p3(-0.22, 0.35, 0.94, rot, tilt, c, r);
      final mR = _p3(0.22, 0.35, 0.94, rot, tilt, c, r);
      final mCtrl = _p3(0, 0.52, 0.92, rot, tilt, c, r);
      final zs = _zs(mz);
      final smileOff = switch (mood) {
        SvenMood.happy => r * 0.10 * zs,
        SvenMood.speaking => r * 0.05 * (1 + 0.3 * pulse) * zs,
        SvenMood.thinking => -r * 0.02 * zs,
        _ => r * 0.04 * zs,
      };
      final mPath = Path()
        ..moveTo(mL.dx, mL.dy)
        ..quadraticBezierTo(mCtrl.dx, mCtrl.dy + smileOff, mR.dx, mR.dy);
      // Glow halo
      canvas.drawPath(
          mPath,
          Paint()
            ..color = secondary.withValues(alpha: 0.38 + 0.26 * pulse)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 4.0 * zs
            ..strokeCap = StrokeCap.round
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3));
      // Crisp line
      canvas.drawPath(
          mPath,
          Paint()
            ..color = Colors.white.withValues(alpha: 0.72)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.8 * zs
            ..strokeCap = StrokeCap.round);
    }

    // ── Holographic choker ring ──
    final chokerZ = _z3(0, 0.80, 0.60, rot, tilt);
    if (chokerZ > 0.0) {
      final chL = _p3(-0.68, 0.80, 0.54, rot, tilt, c, r);
      final chR = _p3(0.68, 0.80, 0.54, rot, tilt, c, r);
      final chC = _p3(0, 0.80, 0.62, rot, tilt, c, r);
      final cwid = (chR.dx - chL.dx).abs() + 4;
      final chit = r * 0.038 * _zs(chokerZ);
      canvas.drawOval(
        Rect.fromCenter(center: chC, width: cwid, height: chit),
        Paint()
          ..color = secondary.withValues(
              alpha: ((0.30 + 0.20 * breath) * _zs(chokerZ).clamp(0, 1))
                  .clamp(0, 1))
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, 2 + breath * 2),
      );
    }

    // ── Specular ──
    canvas.drawCircle(
      specPt,
      r * 0.09 + r * 0.06 * pulse,
      Paint()
        ..shader = RadialGradient(colors: [
          Colors.white.withValues(alpha: 0.50 + 0.18 * pulse),
          Colors.white.withValues(alpha: 0),
        ]).createShader(Rect.fromCircle(
            center: specPt, radius: r * 0.11 + r * 0.06 * pulse)),
    );
  }

  @override
  bool shouldRepaint(_HumanPainter o) =>
      o.pulse != pulse ||
      o.rot != rot ||
      o.tilt != tilt ||
      o.scan != scan ||
      o.mood != mood;
}

// ═══════════════════════════════════════════════════════════════════════════
// _AnimalPainter — Rex · bioluminescent cyber-fox
// ═══════════════════════════════════════════════════════════════════════════

class _AnimalPainter extends CustomPainter {
  const _AnimalPainter({
    required this.pulse,
    required this.ring,
    required this.think,
    required this.rot,
    required this.tilt,
    required this.scan,
    required this.breath,
    required this.primary,
    required this.secondary,
    required this.cinematic,
    required this.mood,
  });

  final double pulse, ring, think, rot, tilt, scan, breath;
  final Color primary, secondary;
  final bool cinematic;
  final SvenMood mood;

  static const _lx = 0.388, _ly = -0.503, _lz = 0.772;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    final c = Offset(s / 2, s / 2);
    final r = s * 0.36;

    // ── Outer neon rings ──
    for (var i = 0; i < 3; i++) {
      final ph = (ring + i / 3.0) % 1.0;
      canvas.drawCircle(
          c,
          r + s * 0.22 * ph,
          Paint()
            ..color = primary.withValues(
                alpha: ((1 - ph) * (0.22 + 0.12 * pulse)).clamp(0, 1))
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.2);
    }

    // ── 3-D sphere body ──
    final specPt = _p3(_lx, _ly, _lz, rot, tilt, c, r * 0.88);
    final ax = ((specPt.dx - c.dx) / r).clamp(-1.2, 1.2);
    final ay = ((specPt.dy - c.dy) / r).clamp(-1.2, 1.2);
    canvas.drawCircle(
        c,
        r,
        Paint()
          ..shader = RadialGradient(
            center: Alignment(ax, ay),
            radius: 1.12,
            colors: [
              Colors.white.withValues(alpha: 0.50 + 0.20 * pulse),
              primary.withValues(alpha: 0.90),
              Color.lerp(primary, Colors.black, 0.65)!,
            ],
            stops: const [0.0, 0.42, 1.0],
          ).createShader(Rect.fromCircle(center: c, radius: r)));
    canvas.drawCircle(
        c,
        r,
        Paint()
          ..shader = RadialGradient(
            radius: 1.0,
            colors: [Colors.transparent, Colors.black.withValues(alpha: 0.28)],
            stops: const [0.60, 1.0],
          ).createShader(Rect.fromCircle(center: c, radius: r)));
    // Bio rim
    canvas.drawCircle(
        c,
        r,
        Paint()
          ..color = secondary.withValues(alpha: 0.12 + 0.08 * pulse)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.6
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4));

    // ── Ears (3-D projected, neon edge + tip glow) ──
    final earDrop = mood == SvenMood.thinking ? 0.08 * think : 0.0;
    for (final sign in [-1.0, 1.0]) {
      final earZ = _z3(sign * 0.32, -1.0, 0.10, rot, tilt);
      if (earZ < -0.28) continue;
      final eVis = _zs(earZ).clamp(0.0, 1.0);
      final eB1 = _p3(sign * 0.10, -0.94 + earDrop, 0.32, rot, tilt, c, r);
      final eB2 = _p3(sign * 0.56, -0.88 + earDrop, 0.18, rot, tilt, c, r);
      final eTip =
          _p3(sign * 0.42, -1.65 + earDrop * 0.5, 0.0, rot, tilt, c, r);
      canvas.drawPath(
        Path()
          ..moveTo(eB1.dx, eB1.dy)
          ..lineTo(eTip.dx, eTip.dy)
          ..lineTo(eB2.dx, eB2.dy)
          ..close(),
        Paint()..color = primary.withValues(alpha: 0.88 * eVis),
      );
      // Inner ear
      final iB1 = _p3(sign * 0.16, -0.93 + earDrop, 0.30, rot, tilt, c, r);
      final iB2 = _p3(sign * 0.48, -0.89 + earDrop, 0.16, rot, tilt, c, r);
      final iTip =
          _p3(sign * 0.38, -1.52 + earDrop * 0.5, 0.0, rot, tilt, c, r);
      canvas.drawPath(
        Path()
          ..moveTo(iB1.dx, iB1.dy)
          ..lineTo(iTip.dx, iTip.dy)
          ..lineTo(iB2.dx, iB2.dy)
          ..close(),
        Paint()..color = secondary.withValues(alpha: 0.52 * eVis),
      );
      // Neon edge
      canvas.drawPath(
        Path()
          ..moveTo(eB1.dx, eB1.dy)
          ..lineTo(eTip.dx, eTip.dy)
          ..lineTo(eB2.dx, eB2.dy),
        Paint()
          ..color = secondary.withValues(alpha: (0.62 + 0.30 * pulse) * eVis)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.9 * eVis
          ..strokeCap = StrokeCap.round
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, 2 + pulse * 2),
      );
      canvas.drawCircle(
        eTip,
        3.8 + pulse * 2.0,
        Paint()
          ..color = secondary.withValues(alpha: (0.68 + 0.30 * pulse) * eVis)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, 3 + pulse * 2),
      );
    }

    // ── Bioluminescent diagonal stripe markings ──
    final stripeA = 0.42 + 0.36 * breath;
    for (final sign in [-1.0, 1.0]) {
      final usZ = _z3(sign * 0.30, 0.02, 0.95, rot, tilt);
      if (usZ > 0.0) {
        final usA = _p3(sign * 0.12, -0.14, 0.99, rot, tilt, c, r);
        final usB = _p3(sign * 0.52, 0.24, 0.85, rot, tilt, c, r);
        canvas.drawLine(
            usA,
            usB,
            Paint()
              ..color =
                  secondary.withValues(alpha: (stripeA * _zs(usZ)).clamp(0, 1))
              ..strokeWidth = 2.8
              ..strokeCap = StrokeCap.round
              ..maskFilter = MaskFilter.blur(BlurStyle.normal, 3 + pulse * 2));
        canvas.drawLine(
            usA,
            usB,
            Paint()
              ..color =
                  Colors.white.withValues(alpha: (0.18 * _zs(usZ)).clamp(0, 1))
              ..strokeWidth = 0.8
              ..strokeCap = StrokeCap.round);
      }
      final lsZ = _z3(sign * 0.38, 0.32, 0.92, rot, tilt);
      if (lsZ > 0.0) {
        final lsA = _p3(sign * 0.22, 0.24, 0.97, rot, tilt, c, r);
        final lsB = _p3(sign * 0.60, 0.50, 0.80, rot, tilt, c, r);
        canvas.drawLine(
            lsA,
            lsB,
            Paint()
              ..color = secondary.withValues(
                  alpha: (stripeA * 0.72 * _zs(lsZ)).clamp(0, 1))
              ..strokeWidth = 2.0
              ..strokeCap = StrokeCap.round
              ..maskFilter = MaskFilter.blur(BlurStyle.normal, 2 + pulse));
      }
    }

    // ── Neural bridge (glow bar between eyes) ──
    final bridgeZ = _z3(0, -0.10, 0.99, rot, tilt);
    if (bridgeZ > 0.08) {
      final bL = _p3(-0.24, -0.10, 0.97, rot, tilt, c, r);
      final bR = _p3(0.24, -0.10, 0.97, rot, tilt, c, r);
      canvas.drawLine(
          bL,
          bR,
          Paint()
            ..color = secondary.withValues(
                alpha: ((0.34 + 0.22 * pulse) * _zs(bridgeZ).clamp(0, 1))
                    .clamp(0, 1))
            ..strokeWidth = 1.8
            ..maskFilter = MaskFilter.blur(BlurStyle.normal, 2 + pulse * 2));
    }

    // ── Forehead rune (circuit diamond) ──
    final runeZ = _z3(0, -0.68, 0.73, rot, tilt);
    if (runeZ > 0.10) {
      final rp = _p3(0, -0.68, 0.73, rot, tilt, c, r);
      final zs = _zs(runeZ);
      final rl = r * 0.062 * zs;
      final runePaint = Paint()
        ..color = secondary.withValues(
            alpha: ((0.48 + 0.30 * pulse) * runeZ.clamp(0, 1)).clamp(0, 1))
        ..strokeWidth = 1.0
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.square;
      canvas.drawPath(
        Path()
          ..moveTo(rp.dx, rp.dy - rl * 1.4)
          ..lineTo(rp.dx + rl, rp.dy)
          ..lineTo(rp.dx, rp.dy + rl * 1.4)
          ..lineTo(rp.dx - rl, rp.dy)
          ..close(),
        runePaint,
      );
      canvas.drawLine(Offset(rp.dx, rp.dy - rl * 0.9),
          Offset(rp.dx, rp.dy + rl * 0.9), runePaint);
      canvas.drawLine(Offset(rp.dx - rl * 0.65, rp.dy),
          Offset(rp.dx + rl * 0.65, rp.dy), runePaint);
    }

    // ── Eyes ──
    for (final sign in [-1.0, 1.0]) {
      final ez = _z3(sign * 0.26, -0.06, 0.96, rot, tilt);
      if (ez < -0.06) continue;
      final ep = _p3(sign * 0.26, -0.06, 0.96, rot, tilt, c, r);
      final zs = _zs(ez);
      // Glow aura
      canvas.drawCircle(
          ep,
          r * 0.158 * zs,
          Paint()
            ..color = secondary.withValues(
                alpha: (0.14 + 0.10 * pulse) * ez.clamp(0, 1))
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4));
      // Sclera
      canvas.drawCircle(ep, r * 0.142 * zs,
          Paint()..color = Colors.white.withValues(alpha: 0.92));
      // Glowing iris
      canvas.drawCircle(
          ep,
          r * 0.105 * zs,
          Paint()
            ..color = secondary.withValues(alpha: 0.88 + 0.12 * pulse)
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.5));
      canvas.drawCircle(
          ep,
          r * 0.122 * zs,
          Paint()
            ..color = secondary.withValues(alpha: 0.55 + 0.28 * pulse)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.3 * zs);
      // Slit pupil
      final pupilH = r * 0.14 * zs;
      final pupilW =
          mood == SvenMood.thinking ? r * 0.015 * zs : r * 0.044 * zs;
      canvas.drawOval(
        Rect.fromCenter(center: ep, width: pupilW, height: pupilH),
        Paint()..color = Colors.black.withValues(alpha: 0.94),
      );
      // Gaze tracking
      final gaze = math.sin(rot) * r * 0.020 * zs;
      canvas.drawCircle(ep + Offset(gaze, 0), pupilW * 0.32,
          Paint()..color = Colors.black.withValues(alpha: 0.90));
      canvas.drawCircle(
        ep + Offset(-r * 0.044 * zs, -r * 0.044 * zs),
        r * 0.030 * zs,
        Paint()..color = Colors.white.withValues(alpha: 0.72),
      );
    }

    // ── Nose (faceted gem) ──
    final nz = _z3(0, 0.14, 0.99, rot, tilt);
    if (nz > -0.02) {
      final np = _p3(0, 0.14, 0.99, rot, tilt, c, r);
      final zs = _zs(nz);
      final nPath = Path()
        ..moveTo(np.dx - r * 0.065 * zs, np.dy)
        ..lineTo(np.dx + r * 0.065 * zs, np.dy)
        ..lineTo(np.dx, np.dy + r * 0.082 * zs)
        ..close();
      canvas.drawPath(
          nPath, Paint()..color = secondary.withValues(alpha: 0.78));
      canvas.drawPath(
          nPath,
          Paint()
            ..color = Colors.white.withValues(alpha: 0.36)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 0.8 * zs);
    }

    // ── Neon whiskers with bloomed tips ──
    for (final sign in [-1.0, 1.0]) {
      for (var wi = 0; wi < 3; wi++) {
        final wy = 0.06 + wi * 0.13;
        final wInner = _p3(sign * 0.18, wy, 0.98, rot, tilt, c, r);
        final wOuter = _p3(sign * 0.98, wy - 0.05, 0.46, rot, tilt, c, r);
        final wZ = _z3(sign * 0.32, wy, 0.92, rot, tilt);
        if (wZ < 0.0) continue;
        final wVis = _zs(wZ).clamp(0.0, 1.0);
        canvas.drawLine(
            wInner,
            wOuter,
            Paint()
              ..color =
                  secondary.withValues(alpha: (0.46 + 0.22 * pulse) * wVis)
              ..strokeWidth = 1.5
              ..strokeCap = StrokeCap.round
              ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.5));
        canvas.drawLine(
            wInner,
            wOuter,
            Paint()
              ..color = Colors.white.withValues(alpha: 0.52 * wVis)
              ..strokeWidth = 0.6
              ..strokeCap = StrokeCap.round);
        canvas.drawCircle(
            wOuter,
            2.8 + pulse * 1.6,
            Paint()
              ..color =
                  secondary.withValues(alpha: (0.58 + 0.28 * pulse) * wVis)
              ..maskFilter = MaskFilter.blur(BlurStyle.normal, 3 + pulse * 2));
      }
    }

    // ── Mouth ──
    final mz = _z3(0, 0.33, 0.94, rot, tilt);
    if (mz > -0.06) {
      final mL = _p3(-0.14, 0.33, 0.94, rot, tilt, c, r);
      final mR = _p3(0.14, 0.33, 0.94, rot, tilt, c, r);
      final mCtrl = _p3(0, 0.46, 0.94, rot, tilt, c, r);
      final zs = _zs(mz);
      final mDepth = switch (mood) {
            SvenMood.happy => r * 0.058,
            SvenMood.speaking => r * 0.028 * (1 + 0.3 * pulse),
            _ => r * 0.020,
          } *
          zs;
      canvas.drawPath(
        Path()
          ..moveTo(mL.dx, mL.dy)
          ..quadraticBezierTo(mCtrl.dx, mCtrl.dy + mDepth, mR.dx, mR.dy),
        Paint()
          ..color = Colors.white.withValues(alpha: 0.68)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.2 * zs
          ..strokeCap = StrokeCap.round,
      );
    }

    // ── Specular ──
    canvas.drawCircle(
      specPt,
      r * 0.09 + r * 0.06 * pulse,
      Paint()
        ..shader = RadialGradient(colors: [
          Colors.white.withValues(alpha: 0.48 + 0.18 * pulse),
          Colors.white.withValues(alpha: 0),
        ]).createShader(Rect.fromCircle(
            center: specPt, radius: r * 0.10 + r * 0.06 * pulse)),
    );
  }

  @override
  bool shouldRepaint(_AnimalPainter o) =>
      o.pulse != pulse ||
      o.rot != rot ||
      o.tilt != tilt ||
      o.scan != scan ||
      o.mood != mood;
}

// ═══════════════════════════════════════════════════════════════════════════
// _CustomShapePainter — procedural renderer driven by CustomShapeSpec
// Draws any LLM-described shape using spec parameters:
//   bodyType, limbs, wings, tail, horns, antennae, eyes, patterns, aura
// ═══════════════════════════════════════════════════════════════════════════

class _CustomShapePainter extends CustomPainter {
  const _CustomShapePainter({
    required this.pulse,
    required this.ring,
    required this.think,
    required this.rot,
    required this.tilt,
    required this.scan,
    required this.breath,
    required this.primary,
    required this.secondary,
    required this.cinematic,
    required this.mood,
    required this.spec,
  });

  final double pulse, ring, think, rot, tilt, scan, breath;
  final Color primary, secondary;
  final bool cinematic;
  final SvenMood mood;
  final CustomShapeSpec spec;

  // Phong-style light direction (shared with other painters)
  static const _lx = 0.388, _ly = -0.503, _lz = 0.772;

  Color get _primary => Color(spec.primaryArgb);
  Color get _secondary => Color(spec.secondaryArgb);

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    final c = Offset(s / 2, s / 2);
    final r = s * 0.34;
    final yaw = rot * 2 * math.pi;
    final pitch = math.sin(tilt * 2 * math.pi) * 0.28;

    // ─── Aura ───────────────────────────────────────────────────────────
    _drawAura(canvas, c, r, s);

    // ─── Body ───────────────────────────────────────────────────────────
    _drawBody(canvas, c, r, s, yaw, pitch);

    // ─── Limbs ──────────────────────────────────────────────────────────
    if (spec.limbCount > 0) {
      _drawLimbs(canvas, c, r, s, yaw, pitch);
    }

    // ─── Wings ──────────────────────────────────────────────────────────
    if (spec.hasWings) {
      _drawWings(canvas, c, r, s, yaw, pitch);
    }

    // ─── Tail ───────────────────────────────────────────────────────────
    if (spec.hasTail) {
      _drawTail(canvas, c, r, s, yaw, pitch);
    }

    // ─── Horns ──────────────────────────────────────────────────────────
    if (spec.hasHorns) {
      _drawHorns(canvas, c, r, s, yaw, pitch);
    }

    // ─── Antennae ───────────────────────────────────────────────────────
    if (spec.hasAntennae) {
      _drawAntennae(canvas, c, r, s, yaw, pitch);
    }

    // ─── Eyes ───────────────────────────────────────────────────────────
    if (spec.eyeCount > 0) {
      _drawEyes(canvas, c, r, s, yaw, pitch);
    }

    // ─── Pattern overlay ────────────────────────────────────────────────
    if (spec.patternType != 'none') {
      _drawPattern(canvas, c, r, s, yaw, pitch);
    }

    // ─── Specular highlight ─────────────────────────────────────────────
    final specPt = _p3(-0.25, -0.30, 0.85, yaw, pitch, c, r);
    canvas.drawCircle(
      specPt,
      r * 0.08 + r * 0.05 * pulse,
      Paint()
        ..shader = RadialGradient(colors: [
          Colors.white.withValues(alpha: 0.45 + 0.15 * pulse),
          Colors.white.withValues(alpha: 0),
        ]).createShader(Rect.fromCircle(
            center: specPt, radius: r * 0.09 + r * 0.05 * pulse)),
    );
  }

  // ─── AURA ─────────────────────────────────────────────────────────────

  void _drawAura(Canvas canvas, Offset c, double r, double s) {
    final intensity = spec.glowIntensity;
    final auraR = r * (1.3 + 0.15 * pulse);

    switch (spec.auraStyle) {
      case 'fire':
        // Flickering fire particles
        final rng = math.Random(42);
        for (var i = 0; i < 18; i++) {
          final angle = rng.nextDouble() * 2 * math.pi + scan * 0.5;
          final dist = r * (1.05 + rng.nextDouble() * 0.35 + 0.08 * pulse);
          final pt = c + Offset(math.cos(angle) * dist, math.sin(angle) * dist);
          final flicker = (math.sin(scan * 8 * math.pi + i * 1.3) + 1) / 2;
          canvas.drawCircle(
            pt,
            s * 0.012 * (0.6 + flicker * 0.7),
            Paint()
              ..color = Color.lerp(_primary, Colors.orange, flicker)!
                  .withValues(
                      alpha: (intensity * 0.6 * (0.5 + flicker * 0.5))
                          .clamp(0.0, 1.0)),
          );
        }
      case 'electric':
        // Lightning crackle arcs
        final rng = math.Random(((scan * 10).floor()) % 100);
        for (var i = 0; i < 6; i++) {
          final startAngle = i * math.pi / 3 + ring * math.pi;
          var prev = c + Offset(math.cos(startAngle), math.sin(startAngle)) * r;
          final path = Path()..moveTo(prev.dx, prev.dy);
          for (var j = 0; j < 4; j++) {
            final jitter = Offset(
              (rng.nextDouble() - 0.5) * s * 0.08,
              (rng.nextDouble() - 0.5) * s * 0.08,
            );
            prev = prev +
                Offset(math.cos(startAngle), math.sin(startAngle)) *
                    (s * 0.05) +
                jitter;
            path.lineTo(prev.dx, prev.dy);
          }
          canvas.drawPath(
            path,
            Paint()
              ..color = _secondary.withValues(
                  alpha: (intensity * 0.7).clamp(0.0, 1.0))
              ..style = PaintingStyle.stroke
              ..strokeWidth = 1.2
              ..strokeCap = StrokeCap.round,
          );
        }
      case 'frost':
        // Icy crystalline ring
        for (var i = 0; i < 12; i++) {
          final angle = i * math.pi / 6 + scan * 0.3;
          final dist = auraR * (0.95 + 0.08 * math.sin(scan * 4 * math.pi + i));
          final pt = c + Offset(math.cos(angle), math.sin(angle)) * dist;
          canvas.drawCircle(
            pt,
            s * 0.008,
            Paint()
              ..color = Colors.lightBlueAccent
                  .withValues(alpha: (intensity * 0.55).clamp(0.0, 1.0)),
          );
          // Small ice-ray
          final tip =
              c + Offset(math.cos(angle), math.sin(angle)) * (dist + s * 0.04);
          canvas.drawLine(
            pt,
            tip,
            Paint()
              ..color = Colors.white
                  .withValues(alpha: (intensity * 0.3).clamp(0.0, 1.0))
              ..strokeWidth = 0.8,
          );
        }
      case 'shadow':
        // Dark swirling smoke
        canvas.drawCircle(
          c,
          auraR,
          Paint()
            ..shader = RadialGradient(colors: [
              Colors.black.withValues(alpha: 0),
              Colors.black
                  .withValues(alpha: (intensity * 0.25).clamp(0.0, 1.0)),
              _primary.withValues(alpha: (intensity * 0.12).clamp(0.0, 1.0)),
              Colors.transparent,
            ], stops: const [
              0.5,
              0.72,
              0.88,
              1.0
            ]).createShader(Rect.fromCircle(center: c, radius: auraR)),
        );
      case 'holy':
        // Radiating light beams
        for (var i = 0; i < 8; i++) {
          final angle = i * math.pi / 4 + scan * 0.15;
          final inner = c + Offset(math.cos(angle), math.sin(angle)) * r;
          final outer =
              c + Offset(math.cos(angle), math.sin(angle)) * auraR * 1.15;
          canvas.drawLine(
            inner,
            outer,
            Paint()
              ..color = Colors.amberAccent.withValues(
                  alpha: (intensity *
                          0.35 *
                          (0.6 + 0.4 * math.sin(scan * 6.28 + i)))
                      .clamp(0.0, 1.0))
              ..strokeWidth = 2.5
              ..strokeCap = StrokeCap.round,
          );
        }
      default: // 'glow'
        canvas.drawCircle(
          c,
          auraR,
          Paint()
            ..shader = RadialGradient(colors: [
              _primary.withValues(
                  alpha: (intensity * 0.35 + 0.1 * pulse).clamp(0.0, 1.0)),
              _primary.withValues(alpha: 0),
            ]).createShader(Rect.fromCircle(center: c, radius: auraR)),
        );
    }
  }

  // ─── BODY ─────────────────────────────────────────────────────────────

  void _drawBody(
      Canvas canvas, Offset c, double r, double s, double yaw, double pitch) {
    final roundFactor = spec.roundness.clamp(0.0, 1.0);
    final spikeFactor = spec.spikiness.clamp(0.0, 1.0);
    final segments = spec.bodySegments.clamp(1, 5);

    switch (spec.bodyType) {
      case 'serpentine':
        _drawSerpentineBody(canvas, c, r, s, yaw, pitch, segments);
      case 'crystalline':
      case 'geometric':
        _drawCrystalBody(canvas, c, r, s, yaw, pitch, spikeFactor);
      case 'amorphous':
        _drawAmorphousBody(canvas, c, r, s, yaw, pitch);
      default:
        // sphere, bipedal, quadruped, avian — all start with segmented spheroids
        _drawSegmentedBody(canvas, c, r, s, yaw, pitch, segments, roundFactor);
    }
  }

  void _drawSegmentedBody(Canvas canvas, Offset c, double r, double s,
      double yaw, double pitch, int segments, double roundFactor) {
    for (var seg = 0; seg < segments; seg++) {
      // Position each segment along body Y axis
      final ny = -0.45 + seg * (0.9 / math.max(segments - 1, 1));
      final scale = seg == 0 ? 1.0 : (1.0 - seg * 0.15).clamp(0.45, 1.0);
      final segR = r * scale * (0.5 + 0.5 * roundFactor);
      final segCenter = _p3(0, ny, 0, yaw, pitch, c, r);
      final z = _z3(0, ny, 0, yaw, pitch);
      final zs = _zs(z);

      // Phong shading
      final nx2 = 0.0, ny2 = ny, nz2 = 1.0;
      final dot = (nx2 * _lx + ny2 * _ly + nz2 * _lz).clamp(0.0, 1.0);
      final litColor = Color.lerp(
        _primary.withValues(alpha: 0.25),
        _primary,
        0.45 + 0.55 * dot,
      )!;

      // Breathing scale
      final bScale = 1.0 + 0.04 * math.sin(breath * 2 * math.pi + seg * 0.7);

      canvas.drawCircle(
        segCenter,
        segR * zs * bScale,
        Paint()
          ..shader = RadialGradient(
            center: const Alignment(-0.3, -0.35),
            colors: [
              litColor.withValues(alpha: (0.95 * zs).clamp(0.0, 1.0)),
              _primary.withValues(alpha: (0.55 * zs).clamp(0.0, 1.0)),
              _primary.withValues(alpha: (0.20 * zs).clamp(0.0, 1.0)),
            ],
            stops: const [0.0, 0.65, 1.0],
          ).createShader(
              Rect.fromCircle(center: segCenter, radius: segR * zs * bScale)),
      );
    }
  }

  void _drawSerpentineBody(Canvas canvas, Offset c, double r, double s,
      double yaw, double pitch, int segments) {
    const count = 8;
    Offset? prev;
    for (var i = 0; i < count; i++) {
      final t = i / (count - 1);
      final nx = math.sin(t * math.pi * 2 + scan * 4) * 0.3;
      final ny = -0.6 + t * 1.2;
      final segPt = _p3(nx, ny, 0.2, yaw, pitch, c, r);
      final segR = r * (0.18 - 0.012 * i) * (1.0 + 0.03 * pulse);

      canvas.drawCircle(
        segPt,
        segR,
        Paint()
          ..color =
              _primary.withValues(alpha: (0.85 - i * 0.04).clamp(0.2, 1.0)),
      );
      if (prev != null) {
        canvas.drawLine(
          prev,
          segPt,
          Paint()
            ..color = _primary.withValues(alpha: 0.4)
            ..strokeWidth = segR * 1.6
            ..strokeCap = StrokeCap.round,
        );
      }
      prev = segPt;
    }
  }

  void _drawCrystalBody(Canvas canvas, Offset c, double r, double s, double yaw,
      double pitch, double spikeFactor) {
    // Draw a faceted crystal with spikes
    final faceCount = 6 + (spikeFactor * 6).round();
    final path = Path();
    for (var i = 0; i < faceCount; i++) {
      final angle = i * 2 * math.pi / faceCount + yaw * 0.3;
      final spikeR = r *
          (0.55 + spikeFactor * 0.35 * (i.isEven ? 1.0 : 0.5)) *
          (1.0 + 0.04 * pulse);
      final pt = c + Offset(math.cos(angle), math.sin(angle)) * spikeR;
      if (i == 0) {
        path.moveTo(pt.dx, pt.dy);
      } else {
        path.lineTo(pt.dx, pt.dy);
      }
    }
    path.close();

    canvas.drawPath(
      path,
      Paint()
        ..shader = RadialGradient(
          center: const Alignment(-0.3, -0.3),
          colors: [
            _primary.withValues(alpha: 0.92),
            _secondary.withValues(alpha: 0.50),
            _primary.withValues(alpha: 0.18),
          ],
          stops: const [0.0, 0.55, 1.0],
        ).createShader(Rect.fromCircle(center: c, radius: r * 0.9)),
    );

    // Crystal facet lines
    for (var i = 0; i < faceCount; i++) {
      final angle = i * 2 * math.pi / faceCount + yaw * 0.3;
      final inner = c + Offset(math.cos(angle), math.sin(angle)) * r * 0.15;
      final spikeR = r * (0.55 + spikeFactor * 0.35 * (i.isEven ? 1.0 : 0.5));
      final outer = c + Offset(math.cos(angle), math.sin(angle)) * spikeR;
      canvas.drawLine(
        inner,
        outer,
        Paint()
          ..color = _secondary.withValues(alpha: 0.25)
          ..strokeWidth = 0.8,
      );
    }
  }

  void _drawAmorphousBody(
      Canvas canvas, Offset c, double r, double s, double yaw, double pitch) {
    // Blobby, shifting amoeba shape
    final path = Path();
    const pts = 24;
    for (var i = 0; i < pts; i++) {
      final angle = i * 2 * math.pi / pts;
      final wobble = math.sin(angle * 3 + scan * 6.28) * 0.12 +
          math.cos(angle * 5 + breath * 6.28) * 0.08;
      final dist = r * (0.55 + wobble + 0.03 * pulse);
      final pt = c + Offset(math.cos(angle), math.sin(angle)) * dist;
      if (i == 0) {
        path.moveTo(pt.dx, pt.dy);
      } else {
        path.lineTo(pt.dx, pt.dy);
      }
    }
    path.close();

    canvas.drawPath(
      path,
      Paint()
        ..shader = RadialGradient(
          colors: [
            _primary.withValues(alpha: 0.88),
            _secondary.withValues(alpha: 0.40),
            _primary.withValues(alpha: 0.10),
          ],
        ).createShader(Rect.fromCircle(center: c, radius: r * 0.7)),
    );
  }

  // ─── LIMBS ────────────────────────────────────────────────────────────

  void _drawLimbs(
      Canvas canvas, Offset c, double r, double s, double yaw, double pitch) {
    final count = spec.limbCount.clamp(0, 8);
    // Distribute limbs symmetrically
    for (var i = 0; i < count; i++) {
      final side = i.isEven ? 1.0 : -1.0;
      final yPos = (count <= 2) ? 0.0 : -0.3 + (i ~/ 2) * 0.35;
      final nx = side * 0.75;
      final ny = yPos;
      const nz = 0.15;

      final shoulder = _p3(nx * 0.5, ny, nz, yaw, pitch, c, r);
      final swing = math.sin(breath * 2 * math.pi + i * 1.2) * 0.15;
      final tip =
          _p3(nx + swing * 0.3, ny + 0.3 + swing, nz - 0.2, yaw, pitch, c, r);
      final z = _z3(nx, ny, nz, yaw, pitch);
      if (z < -0.3) continue; // cull backfacing

      final zs = _zs(z);
      canvas.drawLine(
        shoulder,
        tip,
        Paint()
          ..color = _primary.withValues(alpha: (0.7 * zs).clamp(0.0, 1.0))
          ..strokeWidth = s * 0.025 * zs
          ..strokeCap = StrokeCap.round,
      );
      // Joint dot
      canvas.drawCircle(
        shoulder,
        s * 0.015 * zs,
        Paint()
          ..color = _secondary.withValues(alpha: (0.6 * zs).clamp(0.0, 1.0)),
      );
    }
  }

  // ─── WINGS ────────────────────────────────────────────────────────────

  void _drawWings(
      Canvas canvas, Offset c, double r, double s, double yaw, double pitch) {
    final flapAngle = math.sin(breath * 2 * math.pi) * 0.35;

    for (final side in [-1.0, 1.0]) {
      final base = _p3(side * 0.45, -0.15, 0.1, yaw, pitch, c, r);
      final mid = _p3(
          side * 1.1, -0.35 + flapAngle * side * 0.2, -0.1, yaw, pitch, c, r);
      final tip = _p3(
          side * 1.4, -0.1 + flapAngle * side * 0.4, -0.3, yaw, pitch, c, r);
      final z = _z3(side * 0.8, -0.2, 0, yaw, pitch);
      if (z < -0.5) continue;

      final zs = _zs(z);
      final path = Path()
        ..moveTo(base.dx, base.dy)
        ..quadraticBezierTo(mid.dx, mid.dy, tip.dx, tip.dy);

      canvas.drawPath(
        path,
        Paint()
          ..color = _secondary.withValues(alpha: (0.35 * zs).clamp(0.0, 1.0))
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.0 * zs
          ..strokeCap = StrokeCap.round,
      );

      // Wing membrane — filled triangle
      final memPath = Path()
        ..moveTo(base.dx, base.dy)
        ..lineTo(mid.dx, mid.dy)
        ..lineTo(tip.dx, tip.dy)
        ..close();
      canvas.drawPath(
        memPath,
        Paint()
          ..color = _primary.withValues(alpha: (0.12 * zs).clamp(0.0, 1.0)),
      );
    }
  }

  // ─── TAIL ─────────────────────────────────────────────────────────────

  void _drawTail(
      Canvas canvas, Offset c, double r, double s, double yaw, double pitch) {
    const segs = 6;
    Offset? prev;
    for (var i = 0; i < segs; i++) {
      final t = i / (segs - 1);
      final sway = math.sin(scan * 4 * math.pi + t * math.pi) * 0.2;
      final nx = sway;
      final ny = 0.5 + t * 0.55;
      final nz = -0.3 - t * 0.3;
      final pt = _p3(nx, ny, nz, yaw, pitch, c, r);
      final z = _z3(nx, ny, nz, yaw, pitch);
      if (z < -0.3) {
        prev = null;
        continue;
      }

      if (prev != null) {
        final zs = _zs(z);
        canvas.drawLine(
          prev,
          pt,
          Paint()
            ..color = _primary.withValues(alpha: (0.65 * zs).clamp(0.0, 1.0))
            ..strokeWidth = s * (0.022 - t * 0.012) * zs
            ..strokeCap = StrokeCap.round,
        );
      }
      prev = pt;
    }
  }

  // ─── HORNS ────────────────────────────────────────────────────────────

  void _drawHorns(
      Canvas canvas, Offset c, double r, double s, double yaw, double pitch) {
    for (final side in [-1.0, 1.0]) {
      final base = _p3(side * 0.3, -0.48, 0.15, yaw, pitch, c, r);
      final tip =
          _p3(side * 0.55, -0.85 - 0.05 * pulse, 0.05, yaw, pitch, c, r);
      final z = _z3(side * 0.3, -0.5, 0.15, yaw, pitch);
      if (z < -0.2) continue;

      final zs = _zs(z);
      canvas.drawLine(
        base,
        tip,
        Paint()
          ..color = _secondary.withValues(alpha: (0.75 * zs).clamp(0.0, 1.0))
          ..strokeWidth = s * 0.022 * zs
          ..strokeCap = StrokeCap.round,
      );
    }
  }

  // ─── ANTENNAE ─────────────────────────────────────────────────────────

  void _drawAntennae(
      Canvas canvas, Offset c, double r, double s, double yaw, double pitch) {
    for (final side in [-1.0, 1.0]) {
      final base = _p3(side * 0.2, -0.5, 0.2, yaw, pitch, c, r);
      final wobble = math.sin(scan * 6 * math.pi + side * 2) * 0.1;
      final tip =
          _p3(side * 0.4 + wobble, -0.9 - 0.03 * pulse, 0.1, yaw, pitch, c, r);
      final z = _z3(side * 0.2, -0.5, 0.2, yaw, pitch);
      if (z < -0.2) continue;

      final zs = _zs(z);
      canvas.drawLine(
        base,
        tip,
        Paint()
          ..color = _secondary.withValues(alpha: (0.5 * zs).clamp(0.0, 1.0))
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2 * zs
          ..strokeCap = StrokeCap.round,
      );
      // Glowing tip
      canvas.drawCircle(
        tip,
        s * 0.012 * zs * (1.0 + 0.3 * pulse),
        Paint()
          ..color = _secondary.withValues(alpha: (0.8 * zs).clamp(0.0, 1.0)),
      );
    }
  }

  // ─── EYES ─────────────────────────────────────────────────────────────

  void _drawEyes(
      Canvas canvas, Offset c, double r, double s, double yaw, double pitch) {
    final count = spec.eyeCount.clamp(1, 6);
    final isActive = mood == SvenMood.listening || mood == SvenMood.speaking;
    final blinkPhase = math.sin(scan * 2 * math.pi);
    final blink = blinkPhase > 0.92 ? (blinkPhase - 0.92) / 0.08 : 0.0;

    for (var i = 0; i < count; i++) {
      double ex, ey;
      if (count <= 2) {
        // Standard bilateral eyes
        ex = (i == 0 ? -0.22 : 0.22);
        ey = -0.18;
      } else {
        // Distribute in arc
        const spread = 0.7;
        final t = count == 1 ? 0.0 : (i / (count - 1) - 0.5) * spread;
        ex = t;
        ey = -0.18 - (t.abs()) * 0.15;
      }

      const ez = 0.65;
      final eyePos = _p3(ex, ey, ez, yaw, pitch, c, r);
      final z = _z3(ex, ey, ez, yaw, pitch);
      if (z < 0) continue;

      final zs = _zs(z);
      final eyeR = s * 0.035 * zs;

      switch (spec.eyeShape) {
        case 'slit':
          // Vertical slit pupil
          canvas.drawOval(
            Rect.fromCenter(
                center: eyePos,
                width: eyeR * 0.6,
                height: eyeR * 2.0 * (1.0 - blink * 0.8)),
            Paint()
              ..color =
                  _secondary.withValues(alpha: (0.9 * zs).clamp(0.0, 1.0)),
          );
          canvas.drawOval(
            Rect.fromCenter(
                center: eyePos,
                width: eyeR * 0.2,
                height: eyeR * 1.4 * (1.0 - blink * 0.8)),
            Paint()
              ..color =
                  Colors.black.withValues(alpha: (0.8 * zs).clamp(0.0, 1.0)),
          );
        case 'visor':
          // Horizontal visor bar
          canvas.drawRRect(
            RRect.fromRectAndRadius(
              Rect.fromCenter(
                  center: eyePos,
                  width: eyeR * 3.0,
                  height: eyeR * 0.6 * (1.0 - blink * 0.8)),
              Radius.circular(eyeR * 0.3),
            ),
            Paint()
              ..color = _secondary.withValues(
                  alpha: (isActive ? 0.95 : 0.7) * zs.clamp(0.0, 1.0)),
          );
          break; // one visor for all eyes
        case 'compound':
          // Multi-faceted insect eye
          for (var f = 0; f < 5; f++) {
            final fa = f * math.pi * 2 / 5;
            final fp = eyePos + Offset(math.cos(fa), math.sin(fa)) * eyeR * 0.5;
            canvas.drawCircle(
              fp,
              eyeR * 0.3,
              Paint()
                ..color =
                    _secondary.withValues(alpha: (0.6 * zs).clamp(0.0, 1.0)),
            );
          }
        case 'diamond':
          final path = Path()
            ..moveTo(eyePos.dx, eyePos.dy - eyeR)
            ..lineTo(eyePos.dx + eyeR * 0.55, eyePos.dy)
            ..lineTo(eyePos.dx, eyePos.dy + eyeR * (1.0 - blink * 0.8))
            ..lineTo(eyePos.dx - eyeR * 0.55, eyePos.dy)
            ..close();
          canvas.drawPath(
            path,
            Paint()
              ..color =
                  _secondary.withValues(alpha: (0.85 * zs).clamp(0.0, 1.0)),
          );
        default: // 'round'
          // White sclera
          canvas.drawCircle(
            eyePos,
            eyeR * (1.0 - blink * 0.5),
            Paint()
              ..color =
                  Colors.white.withValues(alpha: (0.9 * zs).clamp(0.0, 1.0)),
          );
          // Colored iris
          canvas.drawCircle(
            eyePos,
            eyeR * 0.6 * (1.0 - blink * 0.5),
            Paint()
              ..color =
                  _secondary.withValues(alpha: (0.9 * zs).clamp(0.0, 1.0)),
          );
          // Pupil
          final pupilShift = isActive
              ? Offset(math.sin(ring * 6.28) * eyeR * 0.1, 0)
              : Offset.zero;
          canvas.drawCircle(
            eyePos + pupilShift,
            eyeR * 0.28 * (1.0 - blink * 0.5),
            Paint()
              ..color =
                  Colors.black.withValues(alpha: (0.85 * zs).clamp(0.0, 1.0)),
          );
      }
    }
  }

  // ─── PATTERNS ─────────────────────────────────────────────────────────

  void _drawPattern(
      Canvas canvas, Offset c, double r, double s, double yaw, double pitch) {
    switch (spec.patternType) {
      case 'stripes':
        for (var i = -3; i <= 3; i++) {
          final ny = i * 0.2;
          final left = _p3(-0.5, ny, 0.55, yaw, pitch, c, r);
          final right = _p3(0.5, ny, 0.55, yaw, pitch, c, r);
          final z = _z3(0, ny, 0.55, yaw, pitch);
          if (z < 0) continue;
          canvas.drawLine(
            left,
            right,
            Paint()
              ..color = _secondary.withValues(alpha: 0.18)
              ..strokeWidth = s * 0.008,
          );
        }
      case 'spots':
        final rng = math.Random(17);
        for (var i = 0; i < 12; i++) {
          final nx = (rng.nextDouble() - 0.5) * 0.8;
          final ny = (rng.nextDouble() - 0.5) * 0.8;
          const nz = 0.6;
          final pt = _p3(nx, ny, nz, yaw, pitch, c, r);
          final z = _z3(nx, ny, nz, yaw, pitch);
          if (z < 0) continue;
          canvas.drawCircle(
            pt,
            s * 0.012,
            Paint()..color = _secondary.withValues(alpha: 0.22),
          );
        }
      case 'circuits':
        // Traced circuit pathways
        final rng = math.Random(31);
        for (var i = 0; i < 8; i++) {
          final startX = (rng.nextDouble() - 0.5) * 0.7;
          final startY = (rng.nextDouble() - 0.5) * 0.7;
          final endX = startX + (rng.nextDouble() - 0.5) * 0.3;
          final endY = startY;
          const nz = 0.6;
          final a = _p3(startX, startY, nz, yaw, pitch, c, r);
          final b = _p3(endX, endY, nz, yaw, pitch, c, r);
          final mid = _p3(endX, startY + 0.12, nz, yaw, pitch, c, r);
          final z = _z3(startX, startY, nz, yaw, pitch);
          if (z < 0) continue;
          canvas.drawLine(
              a,
              b,
              Paint()
                ..color = _secondary.withValues(alpha: 0.25)
                ..strokeWidth = 0.8);
          canvas.drawLine(
              b,
              mid,
              Paint()
                ..color = _secondary.withValues(alpha: 0.25)
                ..strokeWidth = 0.8);
          // Node dot
          canvas.drawCircle(
              b, s * 0.005, Paint()..color = _secondary.withValues(alpha: 0.4));
        }
      case 'hexgrid':
        for (var row = -2; row <= 2; row++) {
          for (var col = -2; col <= 2; col++) {
            final nx = col * 0.22 + (row.isOdd ? 0.11 : 0.0);
            final ny = row * 0.19;
            const nz = 0.62;
            final pt = _p3(nx, ny, nz, yaw, pitch, c, r);
            final z = _z3(nx, ny, nz, yaw, pitch);
            if (z < 0.1) continue;
            _drawHex(canvas, pt, s * 0.022, _secondary.withValues(alpha: 0.15));
          }
        }
      case 'fractal':
        // Simple fractal-like recursive circles
        _drawFractalCircle(canvas, c, r * 0.3, 3, _secondary);
      default:
        break;
    }
  }

  void _drawHex(Canvas canvas, Offset center, double r, Color color) {
    final path = Path();
    for (var i = 0; i < 6; i++) {
      final angle = i * math.pi / 3 - math.pi / 6;
      final pt = center + Offset(math.cos(angle), math.sin(angle)) * r;
      if (i == 0) {
        path.moveTo(pt.dx, pt.dy);
      } else {
        path.lineTo(pt.dx, pt.dy);
      }
    }
    path.close();
    canvas.drawPath(
        path,
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.7);
  }

  void _drawFractalCircle(
      Canvas canvas, Offset c, double r, int depth, Color color) {
    if (depth <= 0 || r < 2) return;
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..color = color.withValues(alpha: 0.12 + 0.06 * depth)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.6,
    );
    for (var i = 0; i < 4; i++) {
      final angle = i * math.pi / 2 + scan * 0.3;
      final child = c + Offset(math.cos(angle), math.sin(angle)) * r * 0.65;
      _drawFractalCircle(canvas, child, r * 0.45, depth - 1, color);
    }
  }

  @override
  bool shouldRepaint(_CustomShapePainter o) =>
      o.pulse != pulse ||
      o.ring != ring ||
      o.rot != rot ||
      o.tilt != tilt ||
      o.scan != scan ||
      o.breath != breath ||
      o.mood != mood ||
      o.spec != spec;
}

// ═══════════════════════════════════════════════════════════════════════════
// SvenGreeting — time-of-day greeting with user name
// ═══════════════════════════════════════════════════════════════════════════

class SvenGreeting extends StatelessWidget {
  const SvenGreeting({
    super.key,
    required this.visualMode,
    required this.motionLevel,
    this.userName = '',
    this.mood = SvenMood.idle,
    this.subtitle,
    this.avatarSize = 72,
    this.avatarMode = AvatarMode.orb,
  });

  final VisualMode visualMode;
  final MotionLevel motionLevel;
  final String userName;
  final SvenMood mood;
  final String? subtitle;
  final double avatarSize;
  final AvatarMode avatarMode;

  String get _greeting {
    final hour = DateTime.now().hour;
    if (hour < 5) return 'Still up?';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Good night';
  }

  String get _fullGreeting {
    if (userName.isNotEmpty) return '$_greeting, $userName';
    return _greeting;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    final cinematic = visualMode == VisualMode.cinematic;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SvenAvatar(
          visualMode: visualMode,
          motionLevel: motionLevel,
          mood: mood,
          size: avatarSize,
          avatarMode: avatarMode,
        ),
        const SizedBox(height: 20),
        Text(
          _fullGreeting,
          style: TextStyle(
            color: tokens.onSurface,
            fontSize: 24,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.5,
          ),
          textAlign: TextAlign.center,
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 6),
          Text(
            subtitle!,
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.5),
              fontSize: 15,
            ),
            textAlign: TextAlign.center,
          ),
        ] else ...[
          const SizedBox(height: 6),
          Text(
            cinematic
                ? 'How can I help you today?'
                : 'Tap + to begin a new conversation',
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.5),
              fontSize: 15,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ],
    );
  }
}
