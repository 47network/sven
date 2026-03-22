// ═══════════════════════════════════════════════════════════════════════════
// DevicePresenceService — polls device status and exposes a live list
//
// Used by the hub DEVICES tab to show real-time device states.
// Periodically refreshes from the server; exposes a ValueNotifier so
// widgets rebuild automatically when devices come online/offline.
// ═══════════════════════════════════════════════════════════════════════════

import 'dart:async';
import 'package:flutter/foundation.dart';

import 'device_service.dart';

/// Holds the latest snapshot of all registered devices.
class DevicePresenceState {
  const DevicePresenceState({
    this.devices = const [],
    this.loading = false,
    this.error,
    this.lastRefresh,
  });

  final List<Device> devices;
  final bool loading;
  final String? error;
  final DateTime? lastRefresh;

  int get onlineCount => devices.where((d) => d.isOnline).length;
  int get offlineCount =>
      devices.where((d) => !d.isOnline && !d.isPairing).length;
  int get pairingCount => devices.where((d) => d.isPairing).length;
  int get totalCount => devices.length;

  List<Device> get onlineDevices => devices.where((d) => d.isOnline).toList();

  List<Device> get offlineDevices =>
      devices.where((d) => !d.isOnline && !d.isPairing).toList();

  List<Device> byType(DeviceType type) =>
      devices.where((d) => d.deviceType == type).toList();

  Device? byName(String name) {
    final lower = name.toLowerCase();
    return devices.cast<Device?>().firstWhere(
          (d) => d!.name.toLowerCase() == lower,
          orElse: () => null,
        );
  }

  DevicePresenceState copyWith({
    List<Device>? devices,
    bool? loading,
    String? error,
    DateTime? lastRefresh,
  }) =>
      DevicePresenceState(
        devices: devices ?? this.devices,
        loading: loading ?? this.loading,
        error: error,
        lastRefresh: lastRefresh ?? this.lastRefresh,
      );
}

/// Service that maintains a live view of all devices.
///
/// Usage:
/// ```dart
/// final presence = DevicePresenceService(deviceService: ds);
/// presence.start();
/// // ...
/// ValueListenableBuilder<DevicePresenceState>(
///   valueListenable: presence,
///   builder: (_, state, __) => Text('${state.onlineCount} online'),
/// );
/// ```
class DevicePresenceService extends ValueNotifier<DevicePresenceState> {
  DevicePresenceService({
    required this.deviceService,
    this.pollInterval = const Duration(seconds: 15),
  }) : super(const DevicePresenceState());

  final DeviceService deviceService;
  final Duration pollInterval;
  Timer? _timer;

  /// Start periodic polling.
  void start() {
    refresh(); // immediate first fetch
    _timer?.cancel();
    _timer = Timer.periodic(pollInterval, (_) => refresh());
  }

  /// Stop polling.
  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  /// Force a refresh now.
  Future<void> refresh() async {
    value = value.copyWith(loading: true);
    try {
      await deviceService.fetchDevices();
      final devices = deviceService.devices;
      value = DevicePresenceState(
        devices: devices,
        loading: false,
        lastRefresh: DateTime.now(),
      );
    } catch (e) {
      value = value.copyWith(
        loading: false,
        error: e.toString(),
      );
      debugPrint('[DevicePresence] refresh error: $e');
    }
  }

  /// Check whether a device just appeared online since last refresh.
  /// Useful for triggering greetings.
  List<Device> detectNewlyOnline(List<Device> previous) {
    final prevOnlineIds =
        previous.where((d) => d.isOnline).map((d) => d.id).toSet();
    return value.devices
        .where((d) => d.isOnline && !prevOnlineIds.contains(d.id))
        .toList();
  }

  @override
  void dispose() {
    stop();
    super.dispose();
  }
}
