import 'package:flutter/material.dart';
import 'notification_prefs_service.dart';

/// Full notification preference centre with per-channel toggles, DND,
/// and sound settings (Batch 7.2).
class NotificationPrefsPage extends StatefulWidget {
  const NotificationPrefsPage({super.key, required this.prefsService});

  final NotificationPrefsService prefsService;

  @override
  State<NotificationPrefsPage> createState() => _NotificationPrefsPageState();
}

class _NotificationPrefsPageState extends State<NotificationPrefsPage> {
  bool _loading = true;
  bool _saving = false;
  String? _error;

  // Per-channel state
  final Map<String, bool> _enabled = {};
  final Map<String, String> _sound = {};
  final Map<String, bool> _vibrate = {};

  // DND
  bool _dndEnabled = false;
  int _dndStartHour = 22;
  int _dndStartMinute = 0;
  int _dndEndHour = 7;
  int _dndEndMinute = 0;

  // Global
  String _globalSound = 'default';

  static const _channelLabels = {
    'messages': 'Messages',
    'approvals': 'Approvals',
    'reminders': 'Reminders',
    'agents': 'Agent Activity',
    'calls': 'Calls',
    'memory': 'Memory Events',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await widget.prefsService.getPreferences();

      final channels = data['channels'] as List<dynamic>? ?? [];
      for (final ch in channels) {
        final m = ch as Map<String, dynamic>;
        final name = m['channel'] as String;
        _enabled[name] = m['enabled'] as bool? ?? true;
        _sound[name] = m['sound'] as String? ?? 'default';
        _vibrate[name] = m['vibrate'] as bool? ?? true;
      }

      final dnd = data['dnd'] as Map<String, dynamic>? ?? {};
      _dndEnabled = dnd['enabled'] as bool? ?? false;
      _dndStartHour = dnd['start_hour'] as int? ?? 22;
      _dndStartMinute = dnd['start_minute'] as int? ?? 0;
      _dndEndHour = dnd['end_hour'] as int? ?? 7;
      _dndEndMinute = dnd['end_minute'] as int? ?? 0;

      _globalSound = data['global_sound'] as String? ?? 'default';

      setState(() => _loading = false);
    } catch (e) {
      setState(() {
        _loading = false;
        _error = 'Failed to load preferences';
      });
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final channelList = _channelLabels.keys.map((ch) {
        return <String, dynamic>{
          'channel': ch,
          'enabled': _enabled[ch] ?? true,
          'sound': _sound[ch] ?? 'default',
          'vibrate': _vibrate[ch] ?? true,
        };
      }).toList();

      await widget.prefsService.savePreferences({
        'channels': channelList,
        'dnd': {
          'enabled': _dndEnabled,
          'start_hour': _dndStartHour,
          'start_minute': _dndStartMinute,
          'end_hour': _dndEndHour,
          'end_minute': _dndEndMinute,
        },
        'global_sound': _globalSound,
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Preferences saved')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to save preferences')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notification Preferences'),
        actions: [
          if (!_loading)
            TextButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.check),
              label: const Text('Save'),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.notifications_off_outlined,
                            color: Colors.orange.shade400, size: 48),
                        const SizedBox(height: 12),
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: theme.brightness == Brightness.dark
                                ? Colors.white70
                                : Colors.black54,
                          ),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: () {
                            setState(() {
                              _loading = true;
                              _error = null;
                            });
                            _load();
                          },
                          icon: const Icon(Icons.refresh, size: 16),
                          label: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    // ── Global Sound ──
                    const _SectionHeader(title: 'Global Sound'),
                    const SizedBox(height: 8),
                    _SoundPicker(
                      value: _globalSound,
                      onChanged: (v) => setState(() => _globalSound = v),
                    ),
                    const SizedBox(height: 24),

                    // ── Do Not Disturb ──
                    const _SectionHeader(title: 'Do Not Disturb'),
                    const SizedBox(height: 8),
                    SwitchListTile(
                      title: const Text('Enable DND'),
                      subtitle: const Text(
                          'Silence notifications during scheduled hours'),
                      value: _dndEnabled,
                      onChanged: (v) => setState(() => _dndEnabled = v),
                    ),
                    if (_dndEnabled) ...[
                      ListTile(
                        title: const Text('Start'),
                        trailing: Text(
                          '${_dndStartHour.toString().padLeft(2, '0')}:${_dndStartMinute.toString().padLeft(2, '0')}',
                          style: theme.textTheme.bodyLarge,
                        ),
                        onTap: () async {
                          final t = await showTimePicker(
                            context: context,
                            initialTime: TimeOfDay(
                                hour: _dndStartHour, minute: _dndStartMinute),
                          );
                          if (t != null) {
                            setState(() {
                              _dndStartHour = t.hour;
                              _dndStartMinute = t.minute;
                            });
                          }
                        },
                      ),
                      ListTile(
                        title: const Text('End'),
                        trailing: Text(
                          '${_dndEndHour.toString().padLeft(2, '0')}:${_dndEndMinute.toString().padLeft(2, '0')}',
                          style: theme.textTheme.bodyLarge,
                        ),
                        onTap: () async {
                          final t = await showTimePicker(
                            context: context,
                            initialTime: TimeOfDay(
                                hour: _dndEndHour, minute: _dndEndMinute),
                          );
                          if (t != null) {
                            setState(() {
                              _dndEndHour = t.hour;
                              _dndEndMinute = t.minute;
                            });
                          }
                        },
                      ),
                    ],
                    const SizedBox(height: 24),

                    // ── Per-Channel ──
                    const _SectionHeader(title: 'Channel Preferences'),
                    const SizedBox(height: 8),
                    ..._channelLabels.entries.map((e) {
                      final ch = e.key;
                      final label = e.value;
                      final isEnabled = _enabled[ch] ?? true;
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(label,
                                        style: theme.textTheme.titleSmall),
                                  ),
                                  Switch(
                                    value: isEnabled,
                                    onChanged: (v) =>
                                        setState(() => _enabled[ch] = v),
                                  ),
                                ],
                              ),
                              if (isEnabled) ...[
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    Expanded(
                                      child: _SoundPicker(
                                        value: _sound[ch] ?? 'default',
                                        onChanged: (v) =>
                                            setState(() => _sound[ch] = v),
                                      ),
                                    ),
                                    const SizedBox(width: 16),
                                    Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text('Vibrate',
                                            style: theme.textTheme.bodySmall),
                                        const SizedBox(width: 4),
                                        Switch(
                                          value: _vibrate[ch] ?? true,
                                          onChanged: (v) =>
                                              setState(() => _vibrate[ch] = v),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    }),
                  ],
                ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: Theme.of(context)
          .textTheme
          .titleMedium
          ?.copyWith(fontWeight: FontWeight.w600),
    );
  }
}

class _SoundPicker extends StatelessWidget {
  const _SoundPicker({required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<String>(
      segments: const [
        ButtonSegment(value: 'default', label: Text('Default')),
        ButtonSegment(value: 'subtle', label: Text('Subtle')),
        ButtonSegment(value: 'silent', label: Text('Silent')),
      ],
      selected: {value},
      onSelectionChanged: (s) => onChanged(s.first),
    );
  }
}
