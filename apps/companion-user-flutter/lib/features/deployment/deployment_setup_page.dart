// ═══════════════════════════════════════════════════════════════════════════
// DeploymentSetupPage — first-launch wizard that asks:
//   "Is Sven just for you, or for your household/team?"
//
// Handles admin account creation + deployment mode selection in one flow.
// Only shown when no users exist on the server.
// ═══════════════════════════════════════════════════════════════════════════

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import 'deployment_service.dart';

class DeploymentSetupPage extends StatefulWidget {
  const DeploymentSetupPage({
    super.key,
    required this.deploymentService,
    required this.onSetupComplete,
  });

  final DeploymentService deploymentService;

  /// Called after setup succeeds. Passes username + password so the app
  /// can immediately log the user in.
  final void Function(
    DeploymentMode mode,
    String username,
    String password,
  ) onSetupComplete;

  @override
  State<DeploymentSetupPage> createState() => _DeploymentSetupPageState();
}

class _DeploymentSetupPageState extends State<DeploymentSetupPage>
    with TickerProviderStateMixin {
  final _pageController = PageController();
  int _currentPage = 0;
  static const _totalPages = 3;

  // Mode selection (page 0)
  DeploymentMode _selectedMode = DeploymentMode.personal;

  // Account creation (page 1)
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _displayNameCtrl = TextEditingController();
  bool _obscurePassword = true;

  // State
  bool _submitting = false;
  String? _error;

  late final AnimationController _orbPulse;

  @override
  void initState() {
    super.initState();
    _orbPulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2800),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _orbPulse.dispose();
    _pageController.dispose();
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    _displayNameCtrl.dispose();
    super.dispose();
  }

  void _goTo(int page) {
    _pageController.animateToPage(
      page,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeInOut,
    );
    setState(() {
      _currentPage = page;
      _error = null;
    });
  }

  Future<void> _submit() async {
    final username = _usernameCtrl.text.trim();
    final password = _passwordCtrl.text;
    final displayName = _displayNameCtrl.text.trim();

    if (username.isEmpty || password.isEmpty) {
      setState(() => _error = 'Username and password are required.');
      return;
    }
    if (password.length < 6) {
      setState(() => _error = 'Password must be at least 6 characters.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await widget.deploymentService.setup(
        mode: _selectedMode,
        username: username,
        password: password,
        displayName: displayName.isNotEmpty ? displayName : null,
      );
      // Move to success page
      _goTo(2);
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      setState(() => _submitting = false);
    }
  }

  void _finish() {
    widget.onSetupComplete(
      _selectedMode,
      _usernameCtrl.text.trim(),
      _passwordCtrl.text,
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(VisualMode.cinematic);

    return Scaffold(
      body: DecoratedBox(
        decoration: BoxDecoration(gradient: tokens.backgroundGradient),
        child: SafeArea(
          child: Column(
            children: [
              // Progress dots
              Padding(
                padding: const EdgeInsets.only(top: 24, bottom: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(_totalPages, (i) {
                    final active = i == _currentPage;
                    return AnimatedContainer(
                      duration: const Duration(milliseconds: 300),
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      width: active ? 28 : 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: active
                            ? tokens.primary
                            : tokens.onSurface.withValues(alpha: 0.25),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    );
                  }),
                ),
              ),
              Expanded(
                child: PageView(
                  controller: _pageController,
                  physics: const NeverScrollableScrollPhysics(),
                  onPageChanged: (p) => setState(() => _currentPage = p),
                  children: [
                    _buildModePage(tokens),
                    _buildAccountPage(tokens),
                    _buildSuccessPage(tokens),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Page 0: Choose deployment mode ──

  Widget _buildModePage(SvenModeTokens tokens) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Animated orb
          AnimatedBuilder(
            animation: _orbPulse,
            builder: (_, __) {
              final scale = 1.0 + 0.08 * math.sin(_orbPulse.value * math.pi);
              return Transform.scale(
                scale: scale,
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        tokens.primary.withValues(alpha: 0.9),
                        tokens.primary.withValues(alpha: 0.2),
                      ],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: tokens.primary.withValues(alpha: 0.4),
                        blurRadius: 30,
                        spreadRadius: 5,
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 32),
          Text(
            'Welcome to Sven',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: tokens.onSurface,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'How will you use Sven?',
            style: TextStyle(
              fontSize: 16,
              color: tokens.onSurface.withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(height: 40),
          _ModeCard(
            title: 'Just for me',
            subtitle: 'Personal assistant — no login needed after setup',
            icon: Icons.person_rounded,
            selected: _selectedMode == DeploymentMode.personal,
            accent: tokens.primary,
            onSurface: tokens.onSurface,
            onTap: () =>
                setState(() => _selectedMode = DeploymentMode.personal),
          ),
          const SizedBox(height: 16),
          _ModeCard(
            title: 'Household / Team',
            subtitle: 'Multiple users — each with their own space',
            icon: Icons.group_rounded,
            selected: _selectedMode == DeploymentMode.multiUser,
            accent: tokens.primary,
            onSurface: tokens.onSurface,
            onTap: () =>
                setState(() => _selectedMode = DeploymentMode.multiUser),
          ),
          const SizedBox(height: 40),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: FilledButton(
              onPressed: () => _goTo(1),
              style: FilledButton.styleFrom(
                backgroundColor: tokens.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: const Text('Continue', style: TextStyle(fontSize: 16)),
            ),
          ),
        ],
      ),
    );
  }

  // ── Page 1: Create admin account ──

  Widget _buildAccountPage(SvenModeTokens tokens) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: SingleChildScrollView(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const SizedBox(height: 60),
            Icon(
              Icons.admin_panel_settings_rounded,
              size: 56,
              color: tokens.primary,
            ),
            const SizedBox(height: 24),
            Text(
              'Create your account',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: tokens.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _selectedMode == DeploymentMode.personal
                  ? 'This will be your personal Sven account.'
                  : 'You\'ll be the admin. You can invite others later.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: tokens.onSurface.withValues(alpha: 0.7),
              ),
            ),
            const SizedBox(height: 32),
            _StyledField(
              controller: _displayNameCtrl,
              label: 'Display name (optional)',
              icon: Icons.badge_rounded,
              tokens: tokens,
            ),
            const SizedBox(height: 16),
            _StyledField(
              controller: _usernameCtrl,
              label: 'Username',
              icon: Icons.person_rounded,
              tokens: tokens,
              autofocus: true,
            ),
            const SizedBox(height: 16),
            _StyledField(
              controller: _passwordCtrl,
              label: 'Password',
              icon: Icons.lock_rounded,
              tokens: tokens,
              obscure: _obscurePassword,
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword
                      ? Icons.visibility_off_rounded
                      : Icons.visibility_rounded,
                  color: tokens.onSurface.withValues(alpha: 0.5),
                ),
                onPressed: () =>
                    setState(() => _obscurePassword = !_obscurePassword),
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Text(
                  _error!,
                  style: const TextStyle(color: Colors.redAccent, fontSize: 14),
                ),
              ),
            const SizedBox(height: 32),
            Row(
              children: [
                TextButton(
                  onPressed: _submitting ? null : () => _goTo(0),
                  child: Text(
                    'Back',
                    style: TextStyle(
                        color: tokens.onSurface.withValues(alpha: 0.6)),
                  ),
                ),
                const Spacer(),
                SizedBox(
                  width: 160,
                  height: 52,
                  child: FilledButton(
                    onPressed: _submitting ? null : _submit,
                    style: FilledButton.styleFrom(
                      backgroundColor: tokens.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: _submitting
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Create', style: TextStyle(fontSize: 16)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  // ── Page 2: Success ──

  Widget _buildSuccessPage(SvenModeTokens tokens) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.check_circle_rounded,
            size: 80,
            color: Colors.green.shade400,
          ),
          const SizedBox(height: 24),
          Text(
            'You\'re all set!',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: tokens.onSurface,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            _selectedMode == DeploymentMode.personal
                ? 'Sven is configured as your personal assistant.'
                : 'Sven is ready for your team. You can invite members from Settings.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 15,
              color: tokens.onSurface.withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(height: 40),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: FilledButton(
              onPressed: _finish,
              style: FilledButton.styleFrom(
                backgroundColor: tokens.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: const Text('Get Started', style: TextStyle(fontSize: 16)),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper widgets
// ═══════════════════════════════════════════════════════════════════════════

class _ModeCard extends StatelessWidget {
  const _ModeCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.selected,
    required this.accent,
    required this.onSurface,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final bool selected;
  final Color accent;
  final Color onSurface;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: selected
              ? accent.withValues(alpha: 0.12)
              : onSurface.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? accent : onSurface.withValues(alpha: 0.12),
            width: selected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(icon,
                size: 36,
                color: selected ? accent : onSurface.withValues(alpha: 0.5)),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w600,
                      color: onSurface,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 13,
                      color: onSurface.withValues(alpha: 0.6),
                    ),
                  ),
                ],
              ),
            ),
            if (selected)
              Icon(Icons.check_circle_rounded, color: accent, size: 24),
          ],
        ),
      ),
    );
  }
}

class _StyledField extends StatelessWidget {
  const _StyledField({
    required this.controller,
    required this.label,
    required this.icon,
    required this.tokens,
    this.obscure = false,
    this.suffixIcon,
    this.autofocus = false,
  });

  final TextEditingController controller;
  final String label;
  final IconData icon;
  final SvenModeTokens tokens;
  final bool obscure;
  final Widget? suffixIcon;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      autofocus: autofocus,
      style: TextStyle(color: tokens.onSurface),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: tokens.onSurface.withValues(alpha: 0.5)),
        prefixIcon: Icon(icon, color: tokens.primary.withValues(alpha: 0.7)),
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: tokens.onSurface.withValues(alpha: 0.06),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: tokens.primary, width: 1.5),
        ),
      ),
    );
  }
}
