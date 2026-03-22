import 'package:flutter/material.dart';

import '../memory/sven_avatar.dart';
import '../../app/sven_tokens.dart';
import '../../app/app_models.dart';
import 'app_lock_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// AppLockGate — wraps the authenticated shell, shows lock screen when locked
// ═══════════════════════════════════════════════════════════════════════════

class AppLockGate extends StatefulWidget {
  const AppLockGate({
    super.key,
    required this.lockService,
    required this.visualMode,
    required this.child,
  });

  final AppLockService lockService;
  final VisualMode visualMode;
  final Widget child;

  @override
  State<AppLockGate> createState() => _AppLockGateState();
}

class _AppLockGateState extends State<AppLockGate> with WidgetsBindingObserver {
  bool _authenticating = false;
  bool _authFailed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.lockService.addListener(_onLockStateChanged);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    widget.lockService.removeListener(_onLockStateChanged);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      widget.lockService.onBackground();
    } else if (state == AppLifecycleState.resumed) {
      widget.lockService.onForeground();
    }
  }

  void _onLockStateChanged() {
    if (mounted) setState(() {});
    // Auto-trigger auth prompt as soon as the lock engages on resume
    if (widget.lockService.isLocked && !_authenticating) {
      _unlock();
    }
  }

  Future<void> _unlock() async {
    if (_authenticating) return;
    setState(() {
      _authenticating = true;
      _authFailed = false;
    });
    final ok = await widget.lockService.authenticate(
      'Unlock Sven to continue',
    );
    if (mounted) {
      setState(() {
        _authenticating = false;
        _authFailed = !ok;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.lockService.isLocked) return widget.child;
    return _LockScreen(
      visualMode: widget.visualMode,
      authenticating: _authenticating,
      authFailed: _authFailed,
      onUnlock: _unlock,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Lock screen UI
// ─────────────────────────────────────────────────────────────────────────

class _LockScreen extends StatelessWidget {
  const _LockScreen({
    required this.visualMode,
    required this.authenticating,
    required this.authFailed,
    required this.onUnlock,
  });

  final VisualMode visualMode;
  final bool authenticating;
  final bool authFailed;
  final VoidCallback onUnlock;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    final cinematic = visualMode == VisualMode.cinematic;
    final bg = cinematic ? const Color(0xFF040712) : const Color(0xFFF5F5F7);

    return Scaffold(
      backgroundColor: bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Sven avatar
              SvenAvatar(
                mood: SvenMood.thinking,
                visualMode: visualMode,
                motionLevel: MotionLevel.full,
                size: 96,
              ),
              const SizedBox(height: 32),
              Text(
                'Sven is locked',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: tokens.onSurface,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                'Authenticate to continue',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: tokens.onSurface.withValues(alpha: 0.5),
                    ),
                textAlign: TextAlign.center,
              ),
              if (authFailed) ...[
                const SizedBox(height: 12),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Authentication failed. Try again.',
                    style: TextStyle(color: Colors.red.shade400, fontSize: 13),
                  ),
                ),
              ],
              const SizedBox(height: 40),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton.icon(
                  onPressed: authenticating ? null : onUnlock,
                  style: FilledButton.styleFrom(
                    backgroundColor: tokens.primary,
                    foregroundColor: cinematic ? Colors.black : Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  icon: authenticating
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.fingerprint_rounded, size: 22),
                  label: Text(
                    authenticating ? 'Authenticating…' : 'Unlock',
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
