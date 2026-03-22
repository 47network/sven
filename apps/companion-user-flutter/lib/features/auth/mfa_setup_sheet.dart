/// MFA / 2FA management bottom sheet — accessible from Settings → Security.
///
/// Phases:
///   [_Phase.loading]  — fetches MFA status from the backend.
///   [_Phase.disabled] — shows option to enable 2FA.
///   [_Phase.setup]    — shows TOTP secret + QR code URL for setup.
///   [_Phase.verify]   — asks user to enter the first code to confirm setup.
///   [_Phase.enabled]  — shows option to disable 2FA (requires OTP to confirm).
///   [_Phase.error]    — surfaces any setup/network errors.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'auth_service.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Phase enum
// ─────────────────────────────────────────────────────────────────────────────

enum _Phase { loading, disabled, setup, verify, enabled, disabling, error }

// ─────────────────────────────────────────────────────────────────────────────
// Sheet widget
// ─────────────────────────────────────────────────────────────────────────────

class MfaSetupSheet extends StatefulWidget {
  const MfaSetupSheet({super.key, required this.authService});

  final AuthService authService;

  /// Convenience helper — opens the sheet as a modal.
  static Future<void> show(BuildContext context, AuthService authService) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => MfaSetupSheet(authService: authService),
    );
  }

  @override
  State<MfaSetupSheet> createState() => _MfaSetupSheetState();
}

class _MfaSetupSheetState extends State<MfaSetupSheet> {
  _Phase _phase = _Phase.loading;
  String? _error;
  MfaSetupData? _setupData;
  bool _secretCopied = false;

  // Verify / disable OTP entry
  final _codeCtrl = TextEditingController();
  bool _codeSubmitting = false;
  String? _codeError;

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  @override
  void dispose() {
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadStatus() async {
    setState(() {
      _phase = _Phase.loading;
      _error = null;
    });
    try {
      final enabled = await widget.authService.getMfaStatus();
      setState(() => _phase = enabled ? _Phase.enabled : _Phase.disabled);
    } catch (e) {
      setState(() {
        _phase = _Phase.error;
        _error = 'Could not fetch 2FA status. ${e.toString()}';
      });
    }
  }

  Future<void> _startSetup() async {
    setState(() {
      _phase = _Phase.loading;
      _error = null;
    });
    try {
      final data = await widget.authService.setupMfa();
      setState(() {
        _setupData = data;
        _phase = _Phase.setup;
      });
    } catch (e) {
      setState(() {
        _phase = _Phase.error;
        _error = 'Could not start 2FA setup. ${e.toString()}';
      });
    }
  }

  Future<void> _confirmSetup() async {
    final code = _codeCtrl.text.trim();
    if (code.length < 6) {
      setState(() => _codeError = 'Enter the 6-digit code');
      return;
    }
    setState(() {
      _codeSubmitting = true;
      _codeError = null;
    });
    try {
      await widget.authService.confirmMfaSetup(code: code);
      setState(() => _phase = _Phase.enabled);
      _codeCtrl.clear();
    } catch (e) {
      setState(() => _codeError = 'Invalid code — please try again.');
    } finally {
      if (mounted) setState(() => _codeSubmitting = false);
    }
  }

  Future<void> _confirmDisable() async {
    final code = _codeCtrl.text.trim();
    if (code.length < 6) {
      setState(() => _codeError = 'Enter your current 6-digit 2FA code');
      return;
    }
    setState(() {
      _codeSubmitting = true;
      _codeError = null;
    });
    try {
      await widget.authService.disableMfa(code: code);
      setState(() => _phase = _Phase.disabled);
      _codeCtrl.clear();
    } catch (e) {
      setState(() => _codeError = 'Invalid code or 2FA disable failed.');
    } finally {
      if (mounted) setState(() => _codeSubmitting = false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build
  // ─────────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primary = Theme.of(context).colorScheme.primary;

    return Padding(
      padding: EdgeInsets.only(
        top: 24,
        left: 24,
        right: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 32,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Handle bar ──
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Theme.of(context)
                    .colorScheme
                    .onSurface
                    .withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // ── Heading ──
          Row(
            children: [
              Icon(Icons.shield_outlined, color: primary, size: 22),
              const SizedBox(width: 10),
              Text(
                'Two-factor authentication',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.3,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // ── Phase body ──
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: _buildPhaseBody(isDark, primary),
          ),
        ],
      ),
    );
  }

  Widget _buildPhaseBody(bool isDark, Color primary) {
    switch (_phase) {
      case _Phase.loading:
        return const Center(
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: CircularProgressIndicator(),
          ),
        );

      case _Phase.error:
        return Column(
          key: const ValueKey('error'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _StatusBadge(enabled: false, label: 'Unable to load'),
            const SizedBox(height: 12),
            Text(
              _error ?? 'Unknown error',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.error,
                  ),
            ),
            const SizedBox(height: 16),
            _SheetButton(
              label: 'Retry',
              primary: primary,
              isDark: isDark,
              onTap: _loadStatus,
            ),
          ],
        );

      case _Phase.disabled:
        return Column(
          key: const ValueKey('disabled'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _StatusBadge(enabled: false, label: 'Not enabled'),
            const SizedBox(height: 12),
            Text(
              'Protect your account with a time-based one-time password (TOTP) '
              'generated by an authenticator app such as Google Authenticator, '
              'Microsoft Authenticator, or 1Password.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.60),
                    height: 1.5,
                  ),
            ),
            const SizedBox(height: 20),
            _SheetButton(
              label: 'Enable two-factor authentication',
              primary: primary,
              isDark: isDark,
              onTap: _startSetup,
            ),
          ],
        );

      case _Phase.setup:
        final data = _setupData!;
        return Column(
          key: const ValueKey('setup'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '1. Open your authenticator app and add a new account.',
              style: _bodyStyle(context),
            ),
            const SizedBox(height: 8),
            Text(
              '2. Enter the secret key below (or scan the QR code if available).',
              style: _bodyStyle(context),
            ),
            const SizedBox(height: 16),

            // Secret key row
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Theme.of(context)
                    .colorScheme
                    .onSurface
                    .withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: Theme.of(context)
                      .colorScheme
                      .onSurface
                      .withValues(alpha: 0.10),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      data.secret,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 2,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: Icon(
                      _secretCopied ? Icons.check_rounded : Icons.copy_rounded,
                      size: 18,
                    ),
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: data.secret));
                      setState(() => _secretCopied = true);
                      await Future<void>.delayed(const Duration(seconds: 2));
                      if (mounted) setState(() => _secretCopied = false);
                    },
                    tooltip: 'Copy secret',
                    padding: EdgeInsets.zero,
                    constraints:
                        const BoxConstraints(minWidth: 32, minHeight: 32),
                  ),
                ],
              ),
            ),

            if (data.qrCodeUrl != null && data.qrCodeUrl!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Center(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.network(
                    data.qrCodeUrl!,
                    width: 160,
                    height: 160,
                    errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                  ),
                ),
              ),
            ],

            const SizedBox(height: 20),
            Text(
              '3. After adding the account, tap Continue to enter the first code.',
              style: _bodyStyle(context),
            ),
            const SizedBox(height: 16),
            _SheetButton(
              label: 'Continue',
              primary: primary,
              isDark: isDark,
              onTap: () {
                setState(() {
                  _phase = _Phase.verify;
                  _codeCtrl.clear();
                  _codeError = null;
                });
              },
            ),
          ],
        );

      case _Phase.verify:
        return Column(
          key: const ValueKey('verify'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Enter the 6-digit code from your authenticator app to confirm setup.',
              style: _bodyStyle(context),
            ),
            const SizedBox(height: 16),
            _OtpTextField(
              controller: _codeCtrl,
              error: _codeError,
              onSubmitted: (_) => _confirmSetup(),
            ),
            const SizedBox(height: 16),
            _SheetButton(
              label: 'Activate 2FA',
              primary: primary,
              isDark: isDark,
              loading: _codeSubmitting,
              onTap: _confirmSetup,
            ),
            const SizedBox(height: 10),
            Center(
              child: TextButton(
                onPressed: () => setState(() => _phase = _Phase.setup),
                child: Text(
                  'Back',
                  style: TextStyle(
                      color: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.50)),
                ),
              ),
            ),
          ],
        );

      case _Phase.enabled:
        return Column(
          key: const ValueKey('enabled'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _StatusBadge(enabled: true, label: 'Enabled'),
            const SizedBox(height: 12),
            Text(
              'Your account is protected with two-factor authentication. '
              'You will be asked for your authenticator app code each time you sign in.',
              style: _bodyStyle(context),
            ),
            const SizedBox(height: 20),
            OutlinedButton.icon(
              onPressed: () {
                setState(() {
                  _phase = _Phase.disabling;
                  _codeCtrl.clear();
                  _codeError = null;
                });
              },
              icon: const Icon(Icons.remove_circle_outline, size: 18),
              label: const Text('Disable two-factor authentication'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Theme.of(context).colorScheme.error,
                side: BorderSide(
                    color: Theme.of(context)
                        .colorScheme
                        .error
                        .withValues(alpha: 0.4)),
              ),
            ),
          ],
        );

      case _Phase.disabling:
        return Column(
          key: const ValueKey('disabling'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Enter your current authenticator code to confirm disabling 2FA.',
              style: _bodyStyle(context),
            ),
            const SizedBox(height: 16),
            _OtpTextField(
              controller: _codeCtrl,
              error: _codeError,
              onSubmitted: (_) => _confirmDisable(),
            ),
            const SizedBox(height: 16),
            _SheetButton(
              label: 'Disable 2FA',
              primary: Theme.of(context).colorScheme.error,
              isDark: Theme.of(context).brightness == Brightness.dark,
              loading: _codeSubmitting,
              onTap: _confirmDisable,
            ),
            const SizedBox(height: 10),
            Center(
              child: TextButton(
                onPressed: () => setState(() => _phase = _Phase.enabled),
                child: Text(
                  'Cancel',
                  style: TextStyle(
                      color: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.50)),
                ),
              ),
            ),
          ],
        );
    }
  }

  TextStyle? _bodyStyle(BuildContext context) {
    return Theme.of(context).textTheme.bodySmall?.copyWith(
          color:
              Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.65),
          height: 1.5,
        );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper widgets
// ─────────────────────────────────────────────────────────────────────────────

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.enabled, required this.label});

  final bool enabled;
  final String label;

  @override
  Widget build(BuildContext context) {
    final color = enabled
        ? const Color(0xFF22C55E)
        : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(shape: BoxShape.circle, color: color),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}

class _OtpTextField extends StatelessWidget {
  const _OtpTextField({
    required this.controller,
    required this.onSubmitted,
    this.error,
  });

  final TextEditingController controller;
  final ValueChanged<String> onSubmitted;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final borderColor =
        Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.12);
    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(6),
      ],
      onSubmitted: onSubmitted,
      autofillHints: const [AutofillHints.oneTimeCode],
      textAlign: TextAlign.center,
      style: const TextStyle(
        fontSize: 22,
        fontWeight: FontWeight.w700,
        letterSpacing: 10,
      ),
      maxLength: 6,
      decoration: InputDecoration(
        counterText: '',
        hintText: '000000',
        hintStyle: TextStyle(
          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.2),
          letterSpacing: 10,
        ),
        errorText: error,
        filled: true,
        fillColor:
            Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(
            color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.6),
            width: 1.5,
          ),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      ),
    );
  }
}

class _SheetButton extends StatelessWidget {
  const _SheetButton({
    required this.label,
    required this.primary,
    required this.isDark,
    required this.onTap,
    this.loading = false,
  });

  final String label;
  final Color primary;
  final bool isDark;
  final VoidCallback onTap;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: Material(
        borderRadius: BorderRadius.circular(14),
        color: primary.withValues(alpha: 0.15),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: loading ? null : onTap,
          child: Center(
            child: loading
                ? SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: primary),
                  )
                : Text(
                    label,
                    style: TextStyle(
                      color: primary,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}
