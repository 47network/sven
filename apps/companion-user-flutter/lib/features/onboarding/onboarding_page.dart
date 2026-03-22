import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';

/// Premium 4-screen onboarding — meet Sven, features, pick style, let's go.
class OnboardingPage extends StatefulWidget {
  const OnboardingPage({
    super.key,
    required this.onComplete,
    required this.onSetVisualMode,
  });

  final VoidCallback onComplete;
  final ValueChanged<VisualMode> onSetVisualMode;

  // Exposed so the app can read the entered name after onComplete.
  static String? capturedName;

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage>
    with TickerProviderStateMixin {
  final _pageController = PageController();
  int _currentPage = 0;
  late final AnimationController _orbPulse;
  late final AnimationController _fadeIn;
  String _capturedName = '';

  static const _totalPages = 4;

  @override
  void initState() {
    super.initState();
    _orbPulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    )..forward();
    _fadeIn = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..forward();
  }

  @override
  void dispose() {
    _orbPulse.dispose();
    _fadeIn.dispose();
    _pageController.dispose();
    super.dispose();
  }

  void _nextPage() {
    HapticFeedback.lightImpact();
    if (_currentPage < _totalPages - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOutCubic,
      );
    } else {
      OnboardingPage.capturedName = _capturedName.isNotEmpty ? _capturedName : null;
      widget.onComplete();
    }
  }

  void _skip() {
    HapticFeedback.selectionClick();
    widget.onComplete();
  }

  @override
  Widget build(BuildContext context) {
    const tokens = SvenTokens.cinematic;
    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      body: FadeTransition(
        opacity: _fadeIn,
        child: Stack(
          children: [
            // Background gradient
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: const Alignment(0, -0.3),
                    radius: 1.2,
                    colors: [
                      tokens.primary.withValues(alpha: 0.08),
                      tokens.scaffold,
                    ],
                  ),
                ),
              ),
            ),
            // Pages
            SafeArea(
              child: Column(
                children: [
                  // Skip button
                  Align(
                    alignment: Alignment.topRight,
                    child: Padding(
                      padding: const EdgeInsets.only(top: 8, right: 8),
                      child: _currentPage < 2
                          ? TextButton(
                              onPressed: _skip,
                              child: Text(
                                'Skip',
                                style: TextStyle(
                                  color:
                                      tokens.onSurface.withValues(alpha: 0.5),
                                  fontSize: 15,
                                ),
                              ),
                            )
                          : const SizedBox(height: 48),
                    ),
                  ),
                  // Page content
                  Expanded(
                    child: PageView(
                      controller: _pageController,
                      onPageChanged: (i) => setState(() => _currentPage = i),
                      children: [
                        _MeetSvenPage(
                          orbPulse: _orbPulse,
                          tokens: tokens,
                          size: size,
                        ),
                        const _FeaturesPage(tokens: tokens),
                        _StylePickerPage(
                          tokens: tokens,
                          onPick: widget.onSetVisualMode,
                        ),
                        _LetsGoPage(
                          tokens: tokens,
                          onNameChanged: (name) {
                            _capturedName = name;
                          },
                          onGetStarted: () {
                            OnboardingPage.capturedName =
                                _capturedName.isNotEmpty ? _capturedName : null;
                            widget.onComplete();
                          },
                        ),
                      ],
                    ),
                  ),
                  // Page indicator + next button
                  Padding(
                    padding: const EdgeInsets.fromLTRB(32, 16, 32, 32),
                    child: Row(
                      children: [
                        // Dots
                        Row(
                          children: List.generate(_totalPages, (i) {
                            final active = i == _currentPage;
                            return AnimatedContainer(
                              duration: const Duration(milliseconds: 300),
                              margin: const EdgeInsets.only(right: 8),
                              width: active ? 24 : 8,
                              height: 8,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(4),
                                color: active
                                    ? tokens.primary
                                    : tokens.onSurface.withValues(alpha: 0.2),
                              ),
                            );
                          }),
                        ),
                        const Spacer(),
                        // Next / Get Started button
                        _GradientButton(
                          label: _currentPage == _totalPages - 1
                              ? 'Get Started'
                              : 'Next',
                          tokens: tokens,
                          onTap: _nextPage,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Page 1: Meet Sven ──

class _MeetSvenPage extends StatelessWidget {
  const _MeetSvenPage({
    required this.orbPulse,
    required this.tokens,
    required this.size,
  });

  final AnimationController orbPulse;
  final SvenModeTokens tokens;
  final Size size;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Spacer(flex: 2),
          // Animated orb
          AnimatedBuilder(
            animation: orbPulse,
            builder: (_, __) {
              final scale = 1.0 + 0.06 * math.sin(orbPulse.value * math.pi);
              final glowAlpha = 0.2 + 0.1 * orbPulse.value;
              return Transform.scale(
                scale: scale,
                child: Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [tokens.primary, tokens.secondary],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: tokens.primary.withValues(alpha: glowAlpha),
                        blurRadius: 40,
                        spreadRadius: 10,
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Text(
                      'S',
                      style: TextStyle(
                        color: Color(0xFF040712),
                        fontSize: 52,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -2,
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 48),
          Text(
            'Meet Sven',
            style: TextStyle(
              color: tokens.onSurface,
              fontSize: 32,
              fontWeight: FontWeight.w800,
              letterSpacing: -1,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Your intelligent companion.\nAlways on, always learning, always yours.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.55),
              fontSize: 16,
              height: 1.5,
            ),
          ),
          const Spacer(flex: 3),
        ],
      ),
    );
  }
}

// ── Page 2: Features ──

class _FeaturesPage extends StatelessWidget {
  const _FeaturesPage({required this.tokens});

  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Spacer(flex: 2),
          Text(
            'What Sven can do',
            style: TextStyle(
              color: tokens.onSurface,
              fontSize: 28,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 40),
          _FeatureItem(
            icon: Icons.chat_bubble_outline_rounded,
            title: 'Natural Conversations',
            subtitle:
                'Chat like you would with a friend — Sven remembers context',
            tokens: tokens,
          ),
          const SizedBox(height: 20),
          _FeatureItem(
            icon: Icons.code_rounded,
            title: 'Code & Create',
            subtitle: 'Syntax-highlighted code blocks you can copy instantly',
            tokens: tokens,
          ),
          const SizedBox(height: 20),
          _FeatureItem(
            icon: Icons.image_outlined,
            title: 'Images & Media',
            subtitle: 'Share photos and get visual insights in return',
            tokens: tokens,
          ),
          const SizedBox(height: 20),
          _FeatureItem(
            icon: Icons.shield_outlined,
            title: 'Private & Secure',
            subtitle: 'End-to-end protection — your data stays yours',
            tokens: tokens,
          ),
          const Spacer(flex: 3),
        ],
      ),
    );
  }
}

class _FeatureItem extends StatelessWidget {
  const _FeatureItem({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.tokens,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            color: tokens.primary.withValues(alpha: 0.1),
          ),
          child: Icon(icon, color: tokens.primary, size: 22),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  color: tokens.onSurface,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                subtitle,
                style: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.5),
                  fontSize: 13,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Page 3: Style Picker ──

class _StylePickerPage extends StatefulWidget {
  const _StylePickerPage({
    required this.tokens,
    required this.onPick,
  });

  final SvenModeTokens tokens;
  final ValueChanged<VisualMode> onPick;

  @override
  State<_StylePickerPage> createState() => _StylePickerPageState();
}

class _StylePickerPageState extends State<_StylePickerPage> {
  VisualMode _selected = VisualMode.cinematic;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Spacer(flex: 2),
          Text(
            'Pick your style',
            style: TextStyle(
              color: widget.tokens.onSurface,
              fontSize: 28,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'You can always change this later in settings.',
            style: TextStyle(
              color: widget.tokens.onSurface.withValues(alpha: 0.5),
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 40),
          Row(
            children: [
              Expanded(
                child: _StyleCard(
                  label: 'Dark',
                  subtitle: 'Cinematic glow',
                  bgColor: const Color(0xFF040712),
                  accentColor: const Color(0xFF00D9FF),
                  isSelected: _selected == VisualMode.cinematic,
                  onTap: () {
                    setState(() => _selected = VisualMode.cinematic);
                    widget.onPick(VisualMode.cinematic);
                  },
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _StyleCard(
                  label: 'Light',
                  subtitle: 'Clean & crisp',
                  bgColor: const Color(0xFFF4F7FB),
                  accentColor: const Color(0xFF0EA5A8),
                  isSelected: _selected == VisualMode.classic,
                  onTap: () {
                    setState(() => _selected = VisualMode.classic);
                    widget.onPick(VisualMode.classic);
                  },
                ),
              ),
            ],
          ),
          const Spacer(flex: 3),
        ],
      ),
    );
  }
}

class _StyleCard extends StatelessWidget {
  const _StyleCard({
    required this.label,
    required this.subtitle,
    required this.bgColor,
    required this.accentColor,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final String subtitle;
  final Color bgColor;
  final Color accentColor;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        height: 180,
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color:
                isSelected ? accentColor : Colors.white.withValues(alpha: 0.08),
            width: isSelected ? 2.5 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: accentColor.withValues(alpha: 0.25),
                    blurRadius: 20,
                    spreadRadius: 2,
                  ),
                ]
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Mini orb preview
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: accentColor,
              ),
              child: Center(
                child: Text(
                  'S',
                  style: TextStyle(
                    color: bgColor,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              label,
              style: TextStyle(
                color: bgColor.computeLuminance() > 0.5
                    ? const Color(0xFF1A1A2E)
                    : Colors.white,
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: TextStyle(
                color: (bgColor.computeLuminance() > 0.5
                        ? const Color(0xFF1A1A2E)
                        : Colors.white)
                    .withValues(alpha: 0.5),
                fontSize: 12,
              ),
            ),
            if (isSelected) ...[
              const SizedBox(height: 10),
              Icon(Icons.check_circle_rounded, color: accentColor, size: 22),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Gradient CTA button ──

class _GradientButton extends StatefulWidget {
  const _GradientButton({
    required this.label,
    required this.tokens,
    required this.onTap,
  });

  final String label;
  final SvenModeTokens tokens;
  final VoidCallback onTap;

  @override
  State<_GradientButton> createState() => _GradientButtonState();
}

class _GradientButtonState extends State<_GradientButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 90),
    reverseDuration: const Duration(milliseconds: 200),
    lowerBound: 0.0,
    upperBound: 1.0,
    value: 0.0,
  );

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _ctrl.forward(),
      onTapUp: (_) {
        _ctrl.reverse();
        widget.onTap();
      },
      onTapCancel: () => _ctrl.reverse(),
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (_, child) => Transform.scale(
          scale: 1.0 - 0.05 * _ctrl.value,
          child: child,
        ),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [widget.tokens.primary, widget.tokens.secondary],
            ),
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: widget.tokens.primary.withValues(alpha: 0.3),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Text(
            widget.label,
            style: const TextStyle(
              color: Color(0xFF040712),
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

// ── Page 4: Let's Go ──

class _LetsGoPage extends StatefulWidget {
  const _LetsGoPage({
    required this.tokens,
    required this.onNameChanged,
    required this.onGetStarted,
  });

  final SvenModeTokens tokens;
  final ValueChanged<String> onNameChanged;
  final VoidCallback onGetStarted;

  @override
  State<_LetsGoPage> createState() => _LetsGoPageState();
}

class _LetsGoPageState extends State<_LetsGoPage> {
  final _nameCtrl = TextEditingController();
  int _selectedPrompt = -1;

  static const _prompts = [
    'What can you help me with?',
    'Tell me something interesting',
    'Help me write a message',
    'Explain a concept to me',
  ];

  @override
  void initState() {
    super.initState();
    _nameCtrl.addListener(() => widget.onNameChanged(_nameCtrl.text.trim()));
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = widget.tokens;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 24),
          Text(
            'One last thing',
            style: TextStyle(
              color: tokens.onSurface,
              fontSize: 28,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Let Sven know what to call you.',
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.55),
              fontSize: 15,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 28),

          // Name input
          _OnboardingTextField(
            controller: _nameCtrl,
            hint: 'Your name (optional)',
            icon: Icons.person_outline_rounded,
            tokens: tokens,
          ),

          const SizedBox(height: 36),

          Text(
            'Or start with a question:',
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.5),
              fontSize: 13,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 14),

          // Prompt chips
          ...List.generate(_prompts.length, (i) {
            final selected = i == _selectedPrompt;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() => _selectedPrompt = selected ? -1 : i);
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: selected
                          ? tokens.primary
                          : tokens.onSurface.withValues(alpha: 0.12),
                      width: selected ? 1.5 : 1,
                    ),
                    color: selected
                        ? tokens.primary.withValues(alpha: 0.08)
                        : Colors.transparent,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.chat_bubble_outline_rounded,
                        size: 16,
                        color: selected
                            ? tokens.primary
                            : tokens.onSurface.withValues(alpha: 0.4),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _prompts[i],
                          style: TextStyle(
                            color: selected
                                ? tokens.primary
                                : tokens.onSurface.withValues(alpha: 0.7),
                            fontSize: 14,
                            fontWeight: selected
                                ? FontWeight.w600
                                : FontWeight.normal,
                          ),
                        ),
                      ),
                      if (selected)
                        Icon(Icons.check_circle_rounded,
                            size: 16, color: tokens.primary),
                    ],
                  ),
                ),
              ),
            );
          }),

          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

class _OnboardingTextField extends StatelessWidget {
  const _OnboardingTextField({
    required this.controller,
    required this.hint,
    required this.icon,
    required this.tokens,
  });

  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: tokens.onSurface.withValues(alpha: 0.12),
        ),
        color: tokens.onSurface.withValues(alpha: 0.04),
      ),
      child: Row(
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 16, right: 10),
            child: Icon(icon,
                size: 20, color: tokens.onSurface.withValues(alpha: 0.4)),
          ),
          Expanded(
            child: TextField(
              controller: controller,
              style: TextStyle(
                color: tokens.onSurface,
                fontSize: 16,
              ),
              decoration: InputDecoration(
                hintText: hint,
                hintStyle: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.35),
                  fontSize: 16,
                ),
                border: InputBorder.none,
                contentPadding:
                    const EdgeInsets.symmetric(vertical: 14),
              ),
              textCapitalization: TextCapitalization.words,
            ),
          ),
          const SizedBox(width: 12),
        ],
      ),
    );
  }
}
