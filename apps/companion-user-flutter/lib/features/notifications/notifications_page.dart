import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'push_notification_manager.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  bool _unregistering = false;
  String? _feedback;

  Future<void> _unregister() async {
    setState(() {
      _unregistering = true;
      _feedback = null;
    });
    try {
      await PushNotificationManager.instance.unregister();
      setState(
          () => _feedback = 'Push notifications disabled for this device.');
    } catch (e) {
      setState(() => _feedback = 'Error: ${e.toString()}');
    } finally {
      if (mounted) setState(() => _unregistering = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final manager = PushNotificationManager.instance;
    final isEnabled = manager.isEnabled;
    final token = manager.currentToken;
    final tokenPreview = token != null
        ? '${token.substring(0, 12)}…${token.substring(token.length - 8)}'
        : null;

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // ── Status card ──────────────────────────────────────────
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(
                    isEnabled
                        ? Icons.notifications_active
                        : Icons.notifications_off,
                    size: 36,
                    color: isEnabled
                        ? Theme.of(context).colorScheme.primary
                        : Theme.of(context)
                            .colorScheme
                            .onSurface
                            .withValues(alpha: 0.4),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isEnabled
                              ? 'Notifications active'
                              : 'Notifications inactive',
                          style:
                              Theme.of(context).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          isEnabled
                              ? 'This device will receive push alerts from Sven.'
                              : 'Grant notification permission and re-launch to enable.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // ── Token info ───────────────────────────────────────────
          if (tokenPreview != null) ...[
            Text('FCM Token', style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 6),
            GestureDetector(
              onTap: () {
                Clipboard.setData(ClipboardData(text: token!));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Token copied to clipboard'),
                    duration: Duration(seconds: 2),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
              child: Semantics(
                label: 'FCM token. Tap to copy to clipboard. $tokenPreview',
                button: true,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color:
                        Theme.of(context).colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          tokenPreview,
                          style: const TextStyle(fontFamily: 'monospace'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Icon(Icons.copy,
                          size: 16,
                          color: Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withValues(alpha: 0.5)),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
          ],

          // ── Actions ──────────────────────────────────────────────
          if (isEnabled)
            Semantics(
              label: 'Disable push notifications for this device',
              button: true,
              child: OutlinedButton.icon(
                onPressed: _unregistering ? null : _unregister,
                icon: _unregistering
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.notifications_off_outlined),
                label: Text(
                    _unregistering ? 'Disabling...' : 'Disable notifications'),
              ),
            ),

          // ── Feedback ─────────────────────────────────────────────
          if (_feedback != null) ...[
            const SizedBox(height: 16),
            Semantics(
              liveRegion: true,
              label: _feedback,
              child: Text(
                _feedback!,
                style: TextStyle(
                  color: _feedback!.startsWith('Error')
                      ? Theme.of(context).colorScheme.error
                      : Theme.of(context).colorScheme.primary,
                ),
              ),
            ),
          ],

          const SizedBox(height: 32),

          // ── Info section ─────────────────────────────────────────
          Text(
            'About notifications',
            style: Theme.of(context).textTheme.labelLarge,
          ),
          const SizedBox(height: 8),
          Text(
            'Push notifications are delivered via Firebase Cloud Messaging (FCM). '
            'Your device token is registered with the Sven gateway and updated '
            'automatically when it changes. Notifications are sent when approvals '
            'await your decision or when Sven sends you an alert.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
