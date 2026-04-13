/// MFA / 2FA verification page shown after a successful password login when
/// the user has two-factor authentication enabled on their account.
///
/// The user is prompted to enter the 6-digit TOTP code from their
/// authenticator app (or a backup recovery code of any length).
///
/// Displays:
///   • Animated 6-box OTP entry that auto-submits on completion.
///   • Full-screen error pill with shake animation on wrong code.
///   • "Back to login" link that cancels the MFA step entirely.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'auth_errors.dart';

/// Platform channel to explicitly open the soft keyboard.
const _textInputChannel = SystemChannels.textInput;

// ─────────────────────────────────────────────────────────────────────────────
// Page widget
// ─────────────────────────────────────────────────────────────────────────────

class MfaPage extends StatefulWidget {
  const MfaPage({
    super.key,
    required this.onVerify,
    required this.onCancel,
  });

  /// Called when the user submits the OTP or backup code.
  ///
  /// Should call [AuthService.verifyMfa] and complete any post-login
  /// setup (service binding, feature flags, etc.).  Throw [AuthException] on
  /// failure — the page will surface it as an error message.
  final Future<void> Function(String code) onVerify;

  /// Called when the user taps "Back to sign in", clearing the pending MFA
  /// session so the router redirects back to the login page.
  final VoidCallback onCancel;

  @override
  State<MfaPage> createState() => _MfaPageState();
}

class _MfaPageState extends State<MfaPage>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  bool _submitting = false;
  String? _error;

  // ── Shake animation for wrong code ────────────────────────────────────────
  late final AnimationController _shakeCtrl;
  late final Animation<double> _shakeAnim;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _shakeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _shakeAnim = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0, end: -8), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -8, end: 8), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 8, end: -4), weight: 2),
      TweenSequenceItem(tween: Tween(begin: -4, end: 4), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 4, end: 0), weight: 1),
    ]).animate(_shakeCtrl);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller.dispose();
    _focusNode.dispose();
    _shakeCtrl.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) {
      // Re-open keyboard after returning from authenticator app.
      // Use a longer delay to let the OS finish the app-switch animation,
      // then request focus AND explicitly invoke TextInput.show to force
      // the soft keyboard open (requestFocus alone is unreliable after
      // an app-switch on some Android versions).
      Future.delayed(const Duration(milliseconds: 600), () {
        if (!mounted) return;
        _focusNode.requestFocus();
        // Force the platform keyboard open even if the focus node thinks
        // it already has focus.
        _textInputChannel.invokeMethod('TextInput.show');
      });
    }
  }

  Future<void> _submit() async {
    final code = _controller.text.trim();
    if (code.isEmpty) return;
    if (_submitting) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      HapticFeedback.lightImpact();
      await widget.onVerify(code);
    } catch (e) {
      if (!mounted) return;
      final message = e is AuthException
          ? e.userMessage
          : 'Verification failed. Please try again.';
      setState(() => _error = message);
      _controller.clear();
      await _shakeCtrl.forward(from: 0);
      if (mounted) _focusNode.requestFocus();
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _onCodeChanged(String value) {
    // Auto-submit when 6 digits are entered.
    if (value.length == 6 && !_submitting) {
      _submit();
    }
    setState(() {}); // redraw boxes
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primary = Theme.of(context).colorScheme.primary;
    final size = MediaQuery.of(context).size;

    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: BoxDecoration(
          gradient: isDark
              ? const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFF030711),
                    Color(0xFF0A1328),
                    Color(0xFF031A25),
                  ],
                )
              : const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFFF5F8FC),
                    Color(0xFFE6EFF8),
                    Color(0xFFDAE8F4),
                  ],
                ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: EdgeInsets.symmetric(
                horizontal: size.width > 600 ? size.width * 0.2 : 28,
                vertical: 40,
              ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 400),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // ── Icon ─────────────────────────────────────────────
                    DecoratedBox(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color:
                                primary.withValues(alpha: isDark ? 0.40 : 0.18),
                            blurRadius: isDark ? 32 : 18,
                          ),
                        ],
                      ),
                      child: Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: primary.withValues(alpha: 0.12),
                          border: Border.all(
                            color: primary.withValues(alpha: 0.25),
                          ),
                        ),
                        child: Icon(
                          Icons.shield_outlined,
                          size: 34,
                          color: primary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 28),

                    // ── Heading ──────────────────────────────────────────
                    Text(
                      'Two-factor authentication',
                      style:
                          Theme.of(context).textTheme.headlineSmall?.copyWith(
                                fontWeight: FontWeight.w700,
                                letterSpacing: -0.5,
                              ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Enter the 6-digit code from your\nauthenticator app, or a recovery code.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Theme.of(context)
                                .colorScheme
                                .onSurface
                                .withValues(alpha: 0.50),
                            height: 1.45,
                          ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 36),

                    // ── Error pill ────────────────────────────────────────
                    if (_error != null) ...[
                      _MfaErrorPill(text: _error!),
                      const SizedBox(height: 16),
                    ],

                    // ── OTP boxes ─────────────────────────────────────────
                    AnimatedBuilder(
                      animation: _shakeAnim,
                      builder: (context, child) => Transform.translate(
                        offset: Offset(_shakeAnim.value, 0),
                        child: child,
                      ),
                      child: Column(
                        children: [
                          // Hidden real input captures keyboard
                          SizedBox(
                            height: 1,
                            child: TextField(
                              autofocus: true,
                              controller: _controller,
                              focusNode: _focusNode,
                              keyboardType: TextInputType.number,
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                                LengthLimitingTextInputFormatter(6),
                              ],
                              onChanged: _onCodeChanged,
                              onSubmitted: (_) => _submit(),
                              autofillHints: const [AutofillHints.oneTimeCode],
                              style: const TextStyle(
                                  color: Colors.transparent, fontSize: 1),
                              decoration: const InputDecoration(
                                border: InputBorder.none,
                                counterText: '',
                              ),
                            ),
                          ),

                          // Visual OTP boxes
                          GestureDetector(
                            onTap: () => _focusNode.requestFocus(),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: List.generate(6, (index) {
                                final digits = _controller.text;
                                final hasDigit = index < digits.length;
                                final isCurrent =
                                    index == digits.length && !_submitting;
                                return _OtpBox(
                                  digit: hasDigit ? digits[index] : null,
                                  isCurrent: isCurrent,
                                  isDark: isDark,
                                  primary: primary,
                                );
                              }),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 32),

                    // ── Submit button ─────────────────────────────────────
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: Semantics(
                        label: _submitting
                            ? 'Verifying, please wait'
                            : 'Verify code',
                        button: true,
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            gradient: LinearGradient(
                              colors: isDark
                                  ? [
                                      const Color(0xFF00D9FF),
                                      const Color(0xFF00C4E0),
                                    ]
                                  : [primary, primary.withValues(alpha: 0.85)],
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: primary.withValues(
                                    alpha: _submitting ? 0.10 : 0.28),
                                blurRadius: _submitting ? 6 : 14,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Material(
                            color: Colors.transparent,
                            child: InkWell(
                              borderRadius: BorderRadius.circular(14),
                              onTap: _submitting ? null : _submit,
                              child: Center(
                                child: _submitting
                                    ? SizedBox(
                                        width: 22,
                                        height: 22,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2.5,
                                          color: isDark
                                              ? const Color(0xFF040712)
                                              : Colors.white,
                                        ),
                                      )
                                    : Text(
                                        'Verify',
                                        style: TextStyle(
                                          color: isDark
                                              ? const Color(0xFF040712)
                                              : Colors.white,
                                          fontSize: 16,
                                          fontWeight: FontWeight.w600,
                                          letterSpacing: 0.3,
                                        ),
                                      ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // ── Back to login ─────────────────────────────────────
                    TextButton(
                      onPressed: widget.onCancel,
                      child: Text(
                        'Back to sign in',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurface
                                  .withValues(alpha: 0.50),
                            ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OTP digit box
// ─────────────────────────────────────────────────────────────────────────────

class _OtpBox extends StatelessWidget {
  const _OtpBox({
    required this.digit,
    required this.isCurrent,
    required this.isDark,
    required this.primary,
  });

  final String? digit;
  final bool isCurrent;
  final bool isDark;
  final Color primary;

  @override
  Widget build(BuildContext context) {
    final filled = digit != null;
    final borderColor = isCurrent
        ? primary
        : filled
            ? primary.withValues(alpha: 0.55)
            : (isDark
                ? Colors.white.withValues(alpha: 0.14)
                : Colors.black.withValues(alpha: 0.12));
    final fillColor = filled
        ? primary.withValues(alpha: isDark ? 0.12 : 0.07)
        : (isDark
            ? Colors.white.withValues(alpha: 0.03)
            : Colors.white.withValues(alpha: 0.65));

    return Container(
      width: 44,
      height: 54,
      margin: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(
        color: fillColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: borderColor,
          width: isCurrent ? 2 : 1.5,
        ),
        boxShadow: isCurrent
            ? [
                BoxShadow(
                  color: primary.withValues(alpha: 0.20),
                  blurRadius: 8,
                  spreadRadius: 0,
                ),
              ]
            : null,
      ),
      alignment: Alignment.center,
      child: digit != null
          ? Text(
              digit!,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: Theme.of(context).colorScheme.onSurface,
                letterSpacing: 0,
              ),
            )
          : isCurrent
              ? _Cursor(color: primary)
              : const SizedBox.shrink(),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Blinking cursor
// ─────────────────────────────────────────────────────────────────────────────

class _Cursor extends StatefulWidget {
  const _Cursor({required this.color});

  final Color color;

  @override
  State<_Cursor> createState() => _CursorState();
}

class _CursorState extends State<_Cursor> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 530),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, _) => AnimatedOpacity(
        duration: const Duration(milliseconds: 80),
        opacity: _ctrl.value > 0.5 ? 1.0 : 0.0,
        child: Container(
          width: 2,
          height: 24,
          decoration: BoxDecoration(
            color: widget.color,
            borderRadius: BorderRadius.circular(1),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Error pill
// ─────────────────────────────────────────────────────────────────────────────

class _MfaErrorPill extends StatelessWidget {
  const _MfaErrorPill({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.error;
    return Semantics(
      liveRegion: true,
      label: 'Error: $text',
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.30)),
        ),
        child: Row(
          children: [
            Icon(Icons.error_outline, size: 18, color: color),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                text,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: color,
                      fontWeight: FontWeight.w500,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
