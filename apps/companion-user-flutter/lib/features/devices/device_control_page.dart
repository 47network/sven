// ═══════════════════════════════════════════════════════════════════════════
// DeviceControlPage — per-device control panel
//
// Displays device detail, exposes quick-action buttons (display, camera,
// TTS, ping, reboot), shows recent events timeline and command history.
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import 'device_service.dart';

class DeviceControlPage extends StatefulWidget {
  const DeviceControlPage({
    super.key,
    required this.deviceService,
    required this.device,
    required this.visualMode,
  });

  final DeviceService deviceService;
  final Device device;
  final VisualMode visualMode;

  @override
  State<DeviceControlPage> createState() => _DeviceControlPageState();
}

class _DeviceControlPageState extends State<DeviceControlPage> {
  DeviceDetail? _detail;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final d = await widget.deviceService.fetchDevice(widget.device.id);
    setState(() {
      _detail = d;
      _loading = false;
      _error =
          d == null ? (widget.deviceService.error ?? 'Failed to load') : null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;
    final device = _detail?.device ?? widget.device;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        title: Text(device.name),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.security_rounded),
            tooltip: 'Desktop policy',
            onPressed: _loading || _error != null ? null : () => _showDesktopPolicyEditor(device),
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _load,
          ),
        ],
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: tokens.primary))
          : _error != null
              ? Center(
                  child: Text(_error!,
                      style: const TextStyle(color: Colors.redAccent)))
              : ListView(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                  children: [
                    _DeviceInfoCard(
                      device: device,
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 20),
                    _QuickActions(
                      device: device,
                      tokens: tokens,
                      cinematic: cinematic,
                      onCommand: _sendCommand,
                      onRelaySnapshot: _showRelaySnapshotDialog,
                    ),
                    const SizedBox(height: 24),
                    if (_detail != null &&
                        _detail!.recentCommands.isNotEmpty) ...[
                      _SectionHeader('Command History', tokens: tokens),
                      const SizedBox(height: 8),
                      ..._detail!.recentCommands.map(
                        (cmd) => _CommandTile(
                            cmd: cmd, tokens: tokens, cinematic: cinematic),
                      ),
                      const SizedBox(height: 24),
                    ],
                    if (_detail != null &&
                        _detail!.recentEvents.isNotEmpty) ...[
                      _SectionHeader('Recent Events', tokens: tokens),
                      const SizedBox(height: 8),
                      ..._detail!.recentEvents.map(
                        (evt) => _EventTile(
                            event: evt, tokens: tokens, cinematic: cinematic),
                      ),
                    ],
                  ],
                ),
    );
  }

  Future<void> _sendCommand(String command,
      {Map<String, dynamic>? payload}) async {
    final result = await widget.deviceService.sendCommand(
      widget.device.id,
      command,
      payload: payload ?? const {},
    );
    if (!mounted) return;
    final ok = result != null;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'Command sent: $command' : 'Failed to send command'),
        backgroundColor: ok ? Colors.green : Colors.red,
      ),
    );
    if (ok) _load(); // refresh to see new command
  }

  Future<void> _showRelaySnapshotDialog(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    await widget.deviceService.fetchDevices();
    if (!context.mounted) return;

    final candidates = widget.deviceService.devices
        .where((d) => d.capabilities.contains('camera'))
        .toList();
    if (candidates.isEmpty) {
      messenger.showSnackBar(
        const SnackBar(
          content: Text('No camera-capable source device found'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    Device selected = candidates.first;
    var running = false;

    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Relay Snapshot'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Capture from source camera and display on this device'),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: selected.id,
                decoration: const InputDecoration(
                  labelText: 'Source camera device',
                  border: OutlineInputBorder(),
                ),
                items: candidates
                    .map((d) => DropdownMenuItem<String>(
                          value: d.id,
                          child: Text(d.name),
                        ))
                    .toList(),
                onChanged: running
                    ? null
                    : (v) {
                        if (v == null) return;
                        final found = candidates.where((d) => d.id == v);
                        if (found.isNotEmpty) {
                          setDialogState(() => selected = found.first);
                        }
                      },
              ),
              const SizedBox(height: 8),
              const Text(
                'Uses low-res capture for reliable transfer.',
                style: TextStyle(fontSize: 12),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: running ? null : () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: running
                  ? null
                  : () async {
                      setDialogState(() => running = true);

                      final snapCmd = await widget.deviceService.sendCommand(
                        selected.id,
                        'camera_snapshot',
                        payload: const {'width': 320, 'height': 180},
                      );
                      if (!mounted) return;
                      if (snapCmd == null) {
                        navigator.pop();
                        messenger.showSnackBar(
                          const SnackBar(
                            content: Text('Failed to queue snapshot command'),
                            backgroundColor: Colors.red,
                          ),
                        );
                        return;
                      }

                      final result = await widget.deviceService.waitForCommandResult(
                        selected.id,
                        snapCmd.id,
                        timeout: const Duration(seconds: 25),
                      );
                      if (!mounted) return;

                      final imageB64 =
                          result?.resultPayload?['image_base64']?.toString() ?? '';
                      if (imageB64.isEmpty ||
                          (result?.status.toLowerCase() == 'failed')) {
                        navigator.pop();
                        messenger.showSnackBar(
                          SnackBar(
                            content:
                                Text(result?.errorMessage ?? 'Snapshot relay failed'),
                            backgroundColor: Colors.red,
                          ),
                        );
                        return;
                      }

                      final html =
                          '<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;">'
                          '<img style="max-width:100vw;max-height:100vh;object-fit:contain;" '
                          'src="data:image/jpeg;base64,$imageB64"/></body></html>';

                      final displayCmd = await widget.deviceService.sendCommand(
                        widget.device.id,
                        'display',
                        payload: {
                          'type': 'html',
                          'content': html,
                        },
                      );
                      if (!mounted) return;
                      navigator.pop();
                      messenger.showSnackBar(
                        SnackBar(
                          content: Text(displayCmd != null
                              ? 'Snapshot relayed to display'
                              : 'Snapshot captured but display command failed'),
                          backgroundColor:
                              displayCmd != null ? Colors.green : Colors.orange,
                        ),
                      );
                      if (displayCmd != null) {
                        await _load();
                      }
                    },
              child: const Text('Capture & Show'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showDesktopPolicyEditor(Device device) async {
    final raw = device.config['desktop_control'];
    final desktop = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};

    var enabled = desktop['enabled'] == true;
    final selectedActions = <String>{
      ...((desktop['allowed_actions'] is List)
          ? (desktop['allowed_actions'] as List).map((e) => e.toString())
          : const <String>[]),
    };
    final hotkeysCtrl = TextEditingController(
      text: ((desktop['allowed_hotkeys'] is List)
              ? (desktop['allowed_hotkeys'] as List).map((e) => e.toString()).toList()
              : const <String>[])
          .join(', '),
    );

    const availableActions = <String>[
      'open_url',
      'open_app',
      'open_path',
      'type_text',
      'hotkey',
      'focus_window',
    ];
    const presetActions = <String, List<String>>{
      'safe': ['open_url', 'open_app', 'open_path'],
      'balanced': ['open_url', 'open_app', 'open_path', 'focus_window'],
      'full': [
        'open_url',
        'open_app',
        'open_path',
        'type_text',
        'hotkey',
        'focus_window',
      ],
    };
    const presetHotkeys = <String, List<String>>{
      'safe': [],
      'balanced': ['ctrl+s', 'ctrl+r', 'cmd+s', 'cmd+r'],
      'full': [],
    };
    String? selectedPreset;

    var saving = false;
    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          void applyPreset(String preset) {
            final actions = presetActions[preset] ?? const <String>[];
            final hotkeys = presetHotkeys[preset] ?? const <String>[];
            setDialogState(() {
              enabled = true;
              selectedPreset = preset;
              selectedActions
                ..clear()
                ..addAll(actions);
              hotkeysCtrl.text = hotkeys.join(', ');
            });
          }

          return AlertDialog(
          title: const Text('Desktop Control Policy'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Enable Desktop Control'),
                  subtitle: const Text('Required for high-risk actions'),
                  value: enabled,
                  onChanged: (v) => setDialogState(() => enabled = v),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Presets',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ChoiceChip(
                      label: const Text('Safe'),
                      selected: selectedPreset == 'safe',
                      onSelected: (_) => applyPreset('safe'),
                    ),
                    ChoiceChip(
                      label: const Text('Balanced'),
                      selected: selectedPreset == 'balanced',
                      onSelected: (_) => applyPreset('balanced'),
                    ),
                    ChoiceChip(
                      label: const Text('Full Control'),
                      selected: selectedPreset == 'full',
                      onSelected: (_) => applyPreset('full'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const Text(
                  'Allowed Actions',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: availableActions.map((action) {
                    final selected = selectedActions.contains(action);
                    return FilterChip(
                      label: Text(action),
                      selected: selected,
                      onSelected: (on) => setDialogState(() {
                        if (on) {
                          selectedActions.add(action);
                        } else {
                          selectedActions.remove(action);
                        }
                      }),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Allowed Hotkeys (comma-separated, optional)',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: hotkeysCtrl,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    hintText: 'ctrl+s, ctrl+r, cmd+s',
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Leave actions/hotkeys empty to allow all actions permitted by backend safety checks.',
                  style: TextStyle(
                    fontSize: 12,
                    color: Theme.of(ctx).colorScheme.onSurface.withValues(alpha: 0.7),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: saving ? null : () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: saving
                  ? null
                  : () async {
                      setDialogState(() => saving = true);
                      final hotkeys = hotkeysCtrl.text
                          .split(',')
                          .map((e) => e.trim().toLowerCase())
                          .where((e) => e.isNotEmpty)
                          .toList();

                      final newConfig = Map<String, dynamic>.from(device.config);
                      newConfig['desktop_control'] = {
                        'enabled': enabled,
                        if (selectedActions.isNotEmpty)
                          'allowed_actions': selectedActions.toList()..sort(),
                        if (hotkeys.isNotEmpty) 'allowed_hotkeys': hotkeys,
                      };

                      final ok = await widget.deviceService.updateDevice(
                        device.id,
                        config: newConfig,
                      );
                      if (!mounted) return;
                      Navigator.of(context).pop();
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(ok
                              ? 'Desktop policy updated'
                              : (widget.deviceService.error ?? 'Failed to update policy')),
                          backgroundColor: ok ? Colors.green : Colors.red,
                        ),
                      );
                      if (ok) {
                        await _load();
                      }
                    },
              child: const Text('Save'),
            ),
          ],
        );
        },
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Device Info Card
// ═══════════════════════════════════════════════════════════════════════════

class _DeviceInfoCard extends StatelessWidget {
  const _DeviceInfoCard({
    required this.device,
    required this.tokens,
    required this.cinematic,
  });

  final Device device;
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (device.status) {
      DeviceStatus.online => Colors.green,
      DeviceStatus.offline => Colors.grey,
      DeviceStatus.pairing => Colors.amber,
    };

    return Card(
      elevation: cinematic ? 0 : 2,
      color: cinematic ? tokens.card : null,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: cinematic
            ? BorderSide(color: tokens.frame.withValues(alpha: 0.2))
            : BorderSide.none,
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // Icon + status
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: tokens.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(
                _iconFor(device.deviceType),
                size: 34,
                color: tokens.primary,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: statusColor,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  device.status.name.toUpperCase(),
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: statusColor,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            // Details
            _keyValue('Type', device.deviceType.label, tokens),
            if (device.lastSeenAt != null)
              _keyValue('Last Seen', _timeAgo(device.lastSeenAt!), tokens),
            if (device.pairedAt != null)
              _keyValue('Paired', _timeAgo(device.pairedAt!), tokens),
            if (device.capabilities.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: device.capabilities.map((cap) {
                  return Chip(
                    label: Text(cap, style: const TextStyle(fontSize: 11)),
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    visualDensity: VisualDensity.compact,
                    backgroundColor: tokens.primary.withValues(alpha: 0.08),
                  );
                }).toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _keyValue(String key, String value, SvenModeTokens t) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Text(key,
              style: TextStyle(
                fontSize: 13,
                color: t.onSurface.withValues(alpha: 0.5),
              )),
          const Spacer(),
          Text(value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: t.onSurface,
              )),
        ],
      ),
    );
  }

  static IconData _iconFor(DeviceType t) => switch (t) {
        DeviceType.mirror => Icons.smart_screen_rounded,
        DeviceType.tablet => Icons.tablet_rounded,
        DeviceType.kiosk => Icons.desktop_windows_rounded,
        DeviceType.sensorHub => Icons.sensors_rounded,
      };

  static String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Quick Actions
// ═══════════════════════════════════════════════════════════════════════════

class _QuickActions extends StatelessWidget {
  const _QuickActions({
    required this.device,
    required this.tokens,
    required this.cinematic,
    required this.onCommand,
    required this.onRelaySnapshot,
  });

  final Device device;
  final SvenModeTokens tokens;
  final bool cinematic;
  final Future<void> Function(String command, {Map<String, dynamic>? payload})
      onCommand;
  final Future<void> Function(BuildContext context) onRelaySnapshot;

  @override
  Widget build(BuildContext context) {
    final caps = device.capabilities;

    final actions = <_ActionDef>[
      const _ActionDef(Icons.monitor_rounded, 'Display', 'display',
          cap: 'display'),
      const _ActionDef(Icons.open_in_browser_rounded, 'Open URL', 'open_url',
          cap: null),
      const _ActionDef(Icons.apps_rounded, 'Open App', 'open_app', cap: null),
      const _ActionDef(Icons.route_rounded, 'Relay Snapshot', 'relay_snapshot',
          cap: null),
      const _ActionDef(Icons.keyboard_rounded, 'Type Text', 'type_text',
          cap: null),
      const _ActionDef(Icons.keyboard_command_key_rounded, 'Hotkey', 'hotkey',
          cap: null),
      const _ActionDef(Icons.filter_center_focus_rounded, 'Focus', 'focus_window',
          cap: null),
      const _ActionDef(Icons.camera_alt_rounded, 'Camera', 'camera_snapshot',
          cap: 'camera'),
      const _ActionDef(Icons.record_voice_over_rounded, 'Speak', 'tts_speak',
          cap: 'speaker'),
      const _ActionDef(Icons.network_ping_rounded, 'Ping', 'ping', cap: null),
      const _ActionDef(Icons.restart_alt_rounded, 'Reboot', 'reboot',
          cap: null),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader('Quick Actions', tokens: tokens),
        const SizedBox(height: 10),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: actions.map((a) {
            final enabled = a.cap == null || caps.contains(a.cap);
            return _ActionButton(
              icon: a.icon,
              label: a.label,
              enabled: enabled,
              tokens: tokens,
              cinematic: cinematic,
              onPressed: enabled ? () => _handleAction(context, a) : null,
            );
          }).toList(),
        ),
      ],
    );
  }

  Future<void> _handleAction(BuildContext context, _ActionDef action) async {
    switch (action.command) {
      case 'display':
        _showDisplayDialog(context);
      case 'open_url':
        _showOpenUrlDialog(context);
      case 'open_app':
        _showOpenAppDialog(context);
      case 'relay_snapshot':
        await onRelaySnapshot(context);
      case 'type_text':
        _showTypeTextDialog(context);
      case 'hotkey':
        _showHotkeyDialog(context);
      case 'focus_window':
        _showFocusDialog(context);
      case 'tts_speak':
        _showTtsDialog(context);
      case 'camera_snapshot':
        await onCommand('camera_snapshot');
      case 'ping':
        await onCommand('ping');
      case 'reboot':
        _confirmReboot(context);
    }
  }

  void _showDisplayDialog(BuildContext context) {
    final urlCtrl = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Display Content'),
        content: TextField(
          controller: urlCtrl,
          decoration: const InputDecoration(
            labelText: 'URL or content to display',
            hintText: 'https://example.com or text',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              onCommand('display', payload: {
                'type': 'url',
                'content': urlCtrl.text.trim(),
              });
            },
            child: const Text('Send'),
          ),
        ],
      ),
    );
  }

  void _showTtsDialog(BuildContext context) {
    final textCtrl = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Text-to-Speech'),
        content: TextField(
          controller: textCtrl,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Text to speak',
            hintText: 'Good morning!',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              onCommand('tts_speak', payload: {
                'text': textCtrl.text.trim(),
              });
            },
            child: const Text('Speak'),
          ),
        ],
      ),
    );
  }

  void _showOpenUrlDialog(BuildContext context) {
    final urlCtrl = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Open URL'),
        content: TextField(
          controller: urlCtrl,
          decoration: const InputDecoration(
            labelText: 'URL',
            hintText: 'https://example.com',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              onCommand('open_url', payload: {
                'url': urlCtrl.text.trim(),
              });
            },
            child: const Text('Open'),
          ),
        ],
      ),
    );
  }

  void _showOpenAppDialog(BuildContext context) {
    final appCtrl = TextEditingController();
    final argsCtrl = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Open App'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: appCtrl,
              decoration: const InputDecoration(
                labelText: 'App / command',
                hintText: 'notepad.exe / Calculator / firefox',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: argsCtrl,
              decoration: const InputDecoration(
                labelText: 'Arguments (optional)',
                hintText: '--new-window',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              onCommand('open_app', payload: {
                'app': appCtrl.text.trim(),
                if (argsCtrl.text.trim().isNotEmpty) 'args': argsCtrl.text.trim(),
              });
            },
            child: const Text('Open'),
          ),
        ],
      ),
    );
  }

  void _showTypeTextDialog(BuildContext context) {
    final textCtrl = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Type Text'),
        content: TextField(
          controller: textCtrl,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Text',
            hintText: 'Type this into focused app',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              onCommand('type_text', payload: {'text': textCtrl.text});
            },
            child: const Text('Send'),
          ),
        ],
      ),
    );
  }

  void _showHotkeyDialog(BuildContext context) {
    final keyCtrl = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Send Hotkey'),
        content: TextField(
          controller: keyCtrl,
          decoration: const InputDecoration(
            labelText: 'Hotkey',
            hintText: 'ctrl+s / cmd+r / alt+tab',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              onCommand('hotkey', payload: {'keys': keyCtrl.text.trim()});
            },
            child: const Text('Send'),
          ),
        ],
      ),
    );
  }

  void _showFocusDialog(BuildContext context) {
    final targetCtrl = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Focus Window/App'),
        content: TextField(
          controller: targetCtrl,
          decoration: const InputDecoration(
            labelText: 'Target',
            hintText: 'Chrome / Terminal / Notes',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              onCommand('focus_window', payload: {
                'target': targetCtrl.text.trim(),
              });
            },
            child: const Text('Focus'),
          ),
        ],
      ),
    );
  }

  void _confirmReboot(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reboot Device'),
        content: Text('Reboot "${device.name}"?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              onCommand('reboot');
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.orange),
            child: const Text('Reboot'),
          ),
        ],
      ),
    );
  }
}

class _ActionDef {
  const _ActionDef(this.icon, this.label, this.command, {this.cap});
  final IconData icon;
  final String label;
  final String command;
  final String? cap;
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.enabled,
    required this.tokens,
    required this.cinematic,
    this.onPressed,
  });

  final IconData icon;
  final String label;
  final bool enabled;
  final SvenModeTokens tokens;
  final bool cinematic;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 80,
      child: Column(
        children: [
          Material(
            color: enabled
                ? tokens.primary.withValues(alpha: 0.1)
                : tokens.onSurface.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              onTap: onPressed,
              borderRadius: BorderRadius.circular(14),
              child: SizedBox(
                width: 56,
                height: 56,
                child: Icon(
                  icon,
                  size: 26,
                  color: enabled
                      ? tokens.primary
                      : tokens.onSurface.withValues(alpha: 0.2),
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: enabled
                  ? tokens.onSurface
                  : tokens.onSurface.withValues(alpha: 0.3),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Command & Event tiles
// ═══════════════════════════════════════════════════════════════════════════

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.title, {required this.tokens});
  final String title;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.3,
        color: tokens.onSurface.withValues(alpha: 0.7),
      ),
    );
  }
}

class _CommandTile extends StatelessWidget {
  const _CommandTile({
    required this.cmd,
    required this.tokens,
    required this.cinematic,
  });

  final DeviceCommand cmd;
  final SvenModeTokens tokens;
  final bool cinematic;

  Color get _statusColor => switch (cmd.status) {
        'pending' => Colors.amber,
        'delivered' => Colors.blue,
        'acknowledged' => Colors.green,
        'failed' => Colors.red,
        _ => Colors.grey,
      };

  IconData get _statusIcon => switch (cmd.status) {
        'pending' => Icons.schedule_rounded,
        'delivered' => Icons.send_rounded,
        'acknowledged' => Icons.check_circle_rounded,
        'failed' => Icons.error_rounded,
        _ => Icons.help_outline_rounded,
      };

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: cinematic ? tokens.card : tokens.surface,
        borderRadius: BorderRadius.circular(10),
        border: cinematic
            ? Border.all(color: tokens.frame.withValues(alpha: 0.12))
            : null,
      ),
      child: Row(
        children: [
          Icon(_statusIcon, size: 18, color: _statusColor),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  cmd.command,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: tokens.onSurface,
                  ),
                ),
                Text(
                  cmd.status,
                  style: TextStyle(
                    fontSize: 11,
                    color: _statusColor,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          Text(
            _timeAgo(cmd.createdAt),
            style: TextStyle(
              fontSize: 11,
              color: tokens.onSurface.withValues(alpha: 0.4),
            ),
          ),
        ],
      ),
    );
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}

class _EventTile extends StatelessWidget {
  const _EventTile({
    required this.event,
    required this.tokens,
    required this.cinematic,
  });

  final DeviceEvent event;
  final SvenModeTokens tokens;
  final bool cinematic;

  IconData get _icon => switch (event.eventType) {
        'motion_detected' => Icons.directions_run_rounded,
        'face_detected' => Icons.face_rounded,
        'touch' => Icons.touch_app_rounded,
        'error' => Icons.error_outline_rounded,
        'boot' => Icons.power_settings_new_rounded,
        _ => Icons.circle_rounded,
      };

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: cinematic ? tokens.card : tokens.surface,
        borderRadius: BorderRadius.circular(10),
        border: cinematic
            ? Border.all(color: tokens.frame.withValues(alpha: 0.12))
            : null,
      ),
      child: Row(
        children: [
          Icon(_icon, size: 18, color: tokens.primary.withValues(alpha: 0.7)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              event.eventType,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: tokens.onSurface,
              ),
            ),
          ),
          Text(
            _timeAgo(event.createdAt),
            style: TextStyle(
              fontSize: 11,
              color: tokens.onSurface.withValues(alpha: 0.4),
            ),
          ),
        ],
      ),
    );
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}
