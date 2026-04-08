import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/sven_tokens.dart';
import '../../app/app_models.dart';
import '../security/app_lock_service.dart';
import 'auth_errors.dart';
import 'auth_service.dart';
import 'token_store.dart';

/// A bottom sheet that lets the user switch between saved accounts,
/// add new accounts, and manage PIN/biometric protection.
class AccountPickerSheet extends StatefulWidget {
  const AccountPickerSheet({
    super.key,
    required this.auth,
    required this.lockService,
    required this.visualMode,
    required this.onAccountSwitched,
    this.onAddAccount,
  });

  final AuthService auth;
  final AppLockService lockService;
  final VisualMode visualMode;
  final void Function(LoginResult result) onAccountSwitched;
  final VoidCallback? onAddAccount;

  @override
  State<AccountPickerSheet> createState() => _AccountPickerSheetState();
}

class _AccountPickerSheetState extends State<AccountPickerSheet> {
  List<LinkedAccount> _accounts = [];
  bool _loading = true;
  String? _error;
  String? _switchingUserId;

  @override
  void initState() {
    super.initState();
    _loadAccounts();
  }

  Future<void> _loadAccounts() async {
    setState(() => _loading = true);
    try {
      final accounts = await widget.auth.getLinkedAccounts();
      if (mounted) setState(() {
        _accounts = accounts;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() {
        _error = 'Failed to load accounts';
        _loading = false;
      });
    }
  }

  Future<void> _switchTo(LinkedAccount account) async {
    if (account.isActive) return;

    // If account has PIN, prompt for it
    String? pin;
    if (account.hasPin) {
      pin = await _showPinDialog(account);
      if (pin == null) return; // cancelled
    }

    // If biometric lock is enabled, require biometric before switching
    if (widget.lockService.lockEnabled) {
      final ok = await widget.lockService.authenticate(
        'Authenticate to switch account',
      );
      if (!ok) return;
    }

    setState(() => _switchingUserId = account.userId);
    try {
      final result = await widget.auth.switchAccount(
        account.userId,
        pin: pin,
      );
      if (mounted) {
        Navigator.of(context).pop();
        widget.onAccountSwitched(result);
      }
    } on AuthException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.userMessage;
          _switchingUserId = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _switchingUserId = null;
        });
      }
    }
  }

  Future<String?> _showPinDialog(LinkedAccount account) async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) {
        final tokens = SvenTokens.forMode(widget.visualMode);
        return AlertDialog(
          backgroundColor: tokens.surface,
          title: Text('Enter PIN', style: TextStyle(color: tokens.onSurface)),
          content: TextField(
            controller: controller,
            obscureText: true,
            keyboardType: TextInputType.number,
            maxLength: 8,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            autofocus: true,
            decoration: InputDecoration(
              labelText: 'PIN for ${account.username}',
              labelStyle: TextStyle(color: tokens.onSurface.withValues(alpha: 0.6)),
            ),
            style: TextStyle(color: tokens.onSurface, fontSize: 24, letterSpacing: 8),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('Cancel', style: TextStyle(color: tokens.onSurface.withValues(alpha: 0.6))),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, controller.text),
              child: const Text('Unlock'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _confirmUnlink(LinkedAccount account) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        final tokens = SvenTokens.forMode(widget.visualMode);
        return AlertDialog(
          backgroundColor: tokens.surface,
          title: Text('Remove account?', style: TextStyle(color: tokens.onSurface)),
          content: Text(
            'Remove ${account.username} from saved accounts on this device?',
            style: TextStyle(color: tokens.onSurface.withValues(alpha: 0.7)),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Colors.red),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Remove'),
            ),
          ],
        );
      },
    );
    if (confirmed == true) {
      await widget.auth.unlinkAccount(account.userId);
      _loadAccounts();
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;
    final bg = cinematic ? const Color(0xFF0A0E1A) : tokens.surface;

    return Container(
      decoration: BoxDecoration(
        color: bg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag handle
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: tokens.onSurface.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Title
            Row(
              children: [
                Icon(Icons.people_outline, color: tokens.onSurface, size: 22),
                const SizedBox(width: 8),
                Text(
                  'Accounts',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: tokens.onSurface,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const Spacer(),
                if (widget.onAddAccount != null)
                  IconButton(
                    icon: Icon(Icons.person_add_outlined, color: tokens.onSurface),
                    tooltip: 'Add account',
                    onPressed: () {
                      Navigator.pop(context);
                      widget.onAddAccount?.call();
                    },
                  ),
              ],
            ),
            const SizedBox(height: 8),
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: Colors.red, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(_error!,
                          style: const TextStyle(color: Colors.red, fontSize: 13)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
            ],
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(24),
                child: CircularProgressIndicator(),
              )
            else if (_accounts.isEmpty)
              Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    Icon(Icons.account_circle_outlined,
                        size: 48, color: tokens.onSurface.withValues(alpha: 0.3)),
                    const SizedBox(height: 12),
                    Text(
                      'No saved accounts',
                      style: TextStyle(color: tokens.onSurface.withValues(alpha: 0.5)),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Sign in and tap "Keep me signed in" to save accounts for quick switching.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          color: tokens.onSurface.withValues(alpha: 0.4), fontSize: 13),
                    ),
                  ],
                ),
              )
            else
              ...List.generate(_accounts.length, (i) {
                final account = _accounts[i];
                final isSwitching = _switchingUserId == account.userId;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Material(
                    color: account.isActive
                        ? tokens.primary.withValues(alpha: 0.1)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(12),
                    child: ListTile(
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                      leading: CircleAvatar(
                        backgroundColor: account.isActive
                            ? tokens.primary
                            : tokens.onSurface.withValues(alpha: 0.15),
                        child: Text(
                          (account.username.isNotEmpty
                                  ? account.username[0]
                                  : '?')
                              .toUpperCase(),
                          style: TextStyle(
                            color: account.isActive
                                ? tokens.surface
                                : tokens.onSurface,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      title: Text(
                        account.displayName ?? account.username,
                        style: TextStyle(
                            color: tokens.onSurface, fontWeight: FontWeight.w500),
                      ),
                      subtitle: account.displayName != null
                          ? Text('@${account.username}',
                              style: TextStyle(
                                  color: tokens.onSurface.withValues(alpha: 0.5),
                                  fontSize: 13))
                          : null,
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (account.hasPin)
                            Padding(
                              padding: const EdgeInsets.only(right: 4),
                              child: Icon(Icons.lock_outline,
                                  size: 16,
                                  color: tokens.onSurface.withValues(alpha: 0.4)),
                            ),
                          if (account.isActive)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: tokens.primary.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text('Active',
                                  style: TextStyle(
                                      color: tokens.primary,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600)),
                            )
                          else if (isSwitching)
                            const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2))
                          else
                            Icon(Icons.chevron_right,
                                color: tokens.onSurface.withValues(alpha: 0.3)),
                        ],
                      ),
                      onTap: isSwitching ? null : () => _switchTo(account),
                      onLongPress: () => _confirmUnlink(account),
                    ),
                  ),
                );
              }),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}
