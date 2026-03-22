// ═══════════════════════════════════════════════════════════════════════════
// DeviceManagerPage — list, pair, and manage external devices
//
// Accessible from Settings → Devices. Shows all registered devices with
// status indicators and quick actions (pair, configure, delete).
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/sven_tokens.dart';
import 'device_service.dart';
import 'device_control_page.dart';

class DeviceManagerPage extends StatefulWidget {
  const DeviceManagerPage({
    super.key,
    required this.deviceService,
    required this.visualMode,
  });

  final DeviceService deviceService;
  final VisualMode visualMode;

  @override
  State<DeviceManagerPage> createState() => _DeviceManagerPageState();
}

class _DeviceManagerPageState extends State<DeviceManagerPage> {
  @override
  void initState() {
    super.initState();
    widget.deviceService.addListener(_rebuild);
    widget.deviceService.fetchDevices();
  }

  @override
  void dispose() {
    widget.deviceService.removeListener(_rebuild);
    super.dispose();
  }

  void _rebuild() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;
    final ds = widget.deviceService;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        title: const Text('Devices'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: ds.loading ? null : () => ds.fetchDevices(),
          ),
        ],
      ),
      body: ds.loading && ds.devices.isEmpty
          ? Center(
              child: CircularProgressIndicator(color: tokens.primary),
            )
          : ds.devices.isEmpty
              ? _EmptyState(tokens: tokens, cinematic: cinematic)
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                  itemCount: ds.devices.length,
                  itemBuilder: (context, i) => _DeviceCard(
                    device: ds.devices[i],
                    tokens: tokens,
                    cinematic: cinematic,
                    onTap: () => _openDevice(ds.devices[i]),
                    onDelete: () => _confirmDelete(ds.devices[i]),
                  ),
                ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddDeviceSheet,
        backgroundColor: tokens.primary,
        foregroundColor: cinematic ? const Color(0xFF040712) : Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add Device'),
      ),
    );
  }

  void _openDevice(Device device) {
    if (device.isPairing) {
      _showPairingDialog(device);
      return;
    }
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => DeviceControlPage(
        deviceService: widget.deviceService,
        device: device,
        visualMode: widget.visualMode,
      ),
    ));
  }

  void _showPairingDialog(Device device) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Pairing Code'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Display this code on your device,\nthen enter it here to confirm:',
              textAlign: TextAlign.center,
              style: TextStyle(color: tokens.onSurface.withValues(alpha: 0.7)),
            ),
            const SizedBox(height: 20),
            // Show the pairing code
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              decoration: BoxDecoration(
                color: tokens.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border:
                    Border.all(color: tokens.primary.withValues(alpha: 0.3)),
              ),
              child: Text(
                device.pairingCode ?? '------',
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 6,
                  color: tokens.primary,
                  fontFamily: 'monospace',
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Expires in 15 minutes',
              style: TextStyle(
                fontSize: 12,
                color: tokens.onSurface.withValues(alpha: 0.5),
              ),
            ),
            const SizedBox(height: 20),
            // Confirm button
            _PairingConfirmForm(
              deviceId: device.id,
              deviceService: widget.deviceService,
              tokens: tokens,
              onConfirmed: (apiKey) {
                Navigator.of(ctx).pop();
                _showApiKeyDialog(apiKey);
              },
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _showApiKeyDialog(String apiKey) {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.vpn_key_rounded, color: Colors.green),
            SizedBox(width: 8),
            Text('Device Paired!'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Copy this API key and configure it on the device.\n'
              'It will NOT be shown again.',
              style: TextStyle(fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: SelectableText(
                apiKey,
                style: const TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 12,
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: apiKey));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('API key copied to clipboard')),
              );
            },
            child: const Text('Copy'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  void _showAddDeviceSheet() {
    final nameCtrl = TextEditingController();
    var selectedType = DeviceType.mirror;
    final selectedCaps = <String>{'display'};

    final tokens = SvenTokens.forMode(widget.visualMode);

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(
            24,
            24,
            24,
            MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Add New Device',
                style: Theme.of(ctx).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 20),
              TextField(
                controller: nameCtrl,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: 'Device Name',
                  hintText: 'e.g. Kitchen Mirror',
                  prefixIcon: Icon(Icons.devices_rounded),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              Text('Device Type',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: tokens.onSurface.withValues(alpha: 0.7),
                  )),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: DeviceType.values.map((t) {
                  final selected = t == selectedType;
                  return ChoiceChip(
                    label: Text(t.label),
                    selected: selected,
                    onSelected: (_) {
                      setSheetState(() => selectedType = t);
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              Text('Capabilities',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: tokens.onSurface.withValues(alpha: 0.7),
                  )),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  'display',
                  'camera',
                  'touch',
                  'speaker',
                  'mic',
                  'gpio',
                ].map((cap) {
                  return FilterChip(
                    label: Text(cap),
                    selected: selectedCaps.contains(cap),
                    onSelected: (on) {
                      setSheetState(() {
                        if (on) {
                          selectedCaps.add(cap);
                        } else {
                          selectedCaps.remove(cap);
                        }
                      });
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: FilledButton(
                  onPressed: () async {
                    final name = nameCtrl.text.trim();
                    if (name.isEmpty) return;
                    Navigator.of(ctx).pop();
                    final device = await widget.deviceService.registerDevice(
                      name: name,
                      type: selectedType,
                      capabilities: selectedCaps.toList(),
                    );
                    if (device != null && device.isPairing) {
                      _showPairingDialog(device);
                    }
                  },
                  child: const Text('Register & Pair'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _confirmDelete(Device device) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove Device'),
        content: Text('Remove "${device.name}"? This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              await widget.deviceService.deleteDevice(device.id);
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-widgets
// ═══════════════════════════════════════════════════════════════════════════

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.tokens, required this.cinematic});
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.devices_other_rounded,
            size: 72,
            color: tokens.primary.withValues(alpha: 0.3),
          ),
          const SizedBox(height: 16),
          Text(
            'No devices paired',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: tokens.onSurface.withValues(alpha: 0.5),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Add a smart mirror, kiosk, or sensor hub\nto extend Sven\'s reach.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              color: tokens.onSurface.withValues(alpha: 0.4),
            ),
          ),
        ],
      ),
    );
  }
}

class _DeviceCard extends StatelessWidget {
  const _DeviceCard({
    required this.device,
    required this.tokens,
    required this.cinematic,
    required this.onTap,
    required this.onDelete,
  });

  final Device device;
  final SvenModeTokens tokens;
  final bool cinematic;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  IconData get _icon => switch (device.deviceType) {
        DeviceType.mirror => Icons.smart_screen_rounded,
        DeviceType.tablet => Icons.tablet_rounded,
        DeviceType.kiosk => Icons.desktop_windows_rounded,
        DeviceType.sensorHub => Icons.sensors_rounded,
      };

  Color get _statusColor => switch (device.status) {
        DeviceStatus.online => Colors.green,
        DeviceStatus.offline => Colors.grey,
        DeviceStatus.pairing => Colors.amber,
      };

  String get _statusLabel => switch (device.status) {
        DeviceStatus.online => 'Online',
        DeviceStatus.offline => 'Offline',
        DeviceStatus.pairing => 'Pairing…',
      };

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: cinematic ? 0 : 1,
      color: cinematic ? tokens.card : null,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: cinematic
            ? BorderSide(color: tokens.frame.withValues(alpha: 0.2))
            : BorderSide.none,
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              // Device icon with status indicator
              Stack(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: tokens.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(_icon, color: tokens.primary, size: 26),
                  ),
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        color: _statusColor,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: cinematic ? tokens.card : Colors.white,
                          width: 2,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 14),
              // Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      device.name,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: tokens.onSurface,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: _statusColor.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            _statusLabel,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: _statusColor,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          device.deviceType.label,
                          style: TextStyle(
                            fontSize: 12,
                            color: tokens.onSurface.withValues(alpha: 0.5),
                          ),
                        ),
                      ],
                    ),
                    if (device.capabilities.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 4,
                        children: device.capabilities.map((cap) {
                          return Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 5,
                              vertical: 1,
                            ),
                            decoration: BoxDecoration(
                              color: tokens.onSurface.withValues(alpha: 0.06),
                              borderRadius: BorderRadius.circular(3),
                            ),
                            child: Text(
                              cap,
                              style: TextStyle(
                                fontSize: 10,
                                color: tokens.onSurface.withValues(alpha: 0.45),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ],
                  ],
                ),
              ),
              // Actions
              PopupMenuButton<String>(
                onSelected: (action) {
                  switch (action) {
                    case 'delete':
                      onDelete();
                  }
                },
                itemBuilder: (_) => [
                  const PopupMenuItem(
                    value: 'delete',
                    child: Row(
                      children: [
                        Icon(Icons.delete_outline, color: Colors.red, size: 20),
                        SizedBox(width: 8),
                        Text('Remove', style: TextStyle(color: Colors.red)),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PairingConfirmForm extends StatefulWidget {
  const _PairingConfirmForm({
    required this.deviceId,
    required this.deviceService,
    required this.tokens,
    required this.onConfirmed,
  });

  final String deviceId;
  final DeviceService deviceService;
  final SvenModeTokens tokens;
  final void Function(String apiKey) onConfirmed;

  @override
  State<_PairingConfirmForm> createState() => _PairingConfirmFormState();
}

class _PairingConfirmFormState extends State<_PairingConfirmForm> {
  final _codeCtrl = TextEditingController();
  bool _confirming = false;
  String? _error;

  @override
  void dispose() {
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    final code = _codeCtrl.text.trim();
    if (code.isEmpty) return;

    setState(() {
      _confirming = true;
      _error = null;
    });

    final apiKey = await widget.deviceService.confirmPairing(
      widget.deviceId,
      code,
    );

    if (apiKey != null) {
      widget.onConfirmed(apiKey);
    } else {
      setState(() {
        _confirming = false;
        _error = widget.deviceService.error ?? 'Pairing failed';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        TextField(
          controller: _codeCtrl,
          textCapitalization: TextCapitalization.characters,
          textAlign: TextAlign.center,
          maxLength: 6,
          style: const TextStyle(
            fontSize: 20,
            letterSpacing: 4,
            fontWeight: FontWeight.w700,
          ),
          decoration: InputDecoration(
            hintText: 'ENTER CODE',
            counterText: '',
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: widget.tokens.primary, width: 2),
            ),
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              _error!,
              style: const TextStyle(color: Colors.redAccent, fontSize: 13),
            ),
          ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: _confirming ? null : _confirm,
            child: _confirming
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text('Confirm Pairing'),
          ),
        ),
      ],
    );
  }
}
