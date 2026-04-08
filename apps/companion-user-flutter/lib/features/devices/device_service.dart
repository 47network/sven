// ═══════════════════════════════════════════════════════════════════════════
// DeviceService — API client for device management (Magic Mirror / RPi)
//
// Uses AuthenticatedClient for admin endpoints (/v1/admin/devices).
// ═══════════════════════════════════════════════════════════════════════════

import 'dart:convert';
import 'package:flutter/foundation.dart';

import '../../app/authenticated_client.dart';
import '../../config/env_config.dart';

/// Device status.
enum DeviceStatus {
  online,
  offline,
  pairing;

  static DeviceStatus fromApi(String? value) => switch (value) {
        'online' => DeviceStatus.online,
        'offline' => DeviceStatus.offline,
        'pairing' => DeviceStatus.pairing,
        _ => DeviceStatus.offline,
      };
}

/// Device type.
enum DeviceType {
  mirror,
  tablet,
  kiosk,
  sensorHub;

  String get apiValue => switch (this) {
        DeviceType.mirror => 'mirror',
        DeviceType.tablet => 'tablet',
        DeviceType.kiosk => 'kiosk',
        DeviceType.sensorHub => 'sensor_hub',
      };

  String get label => switch (this) {
        DeviceType.mirror => 'Mirror',
        DeviceType.tablet => 'Tablet',
        DeviceType.kiosk => 'Kiosk',
        DeviceType.sensorHub => 'Sensor Hub',
      };

  static DeviceType fromApi(String? value) => switch (value) {
        'mirror' => DeviceType.mirror,
        'tablet' => DeviceType.tablet,
        'kiosk' => DeviceType.kiosk,
        'sensor_hub' => DeviceType.sensorHub,
        _ => DeviceType.mirror,
      };
}

/// A registered/paired device.
class Device {
  const Device({
    required this.id,
    required this.name,
    required this.deviceType,
    required this.status,
    required this.capabilities,
    required this.config,
    this.lastSeenAt,
    this.pairedAt,
    this.pairingCode,
    this.pairingExpires,
    required this.createdAt,
  });

  final String id;
  final String name;
  final DeviceType deviceType;
  final DeviceStatus status;
  final List<String> capabilities;
  final Map<String, dynamic> config;
  final DateTime? lastSeenAt;
  final DateTime? pairedAt;
  final String? pairingCode;
  final String? pairingExpires;
  final DateTime createdAt;

  factory Device.fromJson(Map<String, dynamic> json) {
    final caps = json['capabilities'];
    final capList =
        caps is List ? caps.map((e) => e.toString()).toList() : <String>[];

    return Device(
      id: json['id'] as String,
      name: json['name'] as String,
      deviceType: DeviceType.fromApi(json['device_type'] as String?),
      status: DeviceStatus.fromApi(json['status'] as String?),
      capabilities: capList,
      config:
          (json['config'] is Map ? json['config'] as Map<String, dynamic> : {}),
      lastSeenAt: json['last_seen_at'] != null
          ? DateTime.tryParse(json['last_seen_at'] as String)
          : null,
      pairedAt: json['paired_at'] != null
          ? DateTime.tryParse(json['paired_at'] as String)
          : null,
      pairingCode: json['pairing_code'] as String?,
      pairingExpires: json['pairing_expires'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  bool get isOnline => status == DeviceStatus.online;
  bool get isPairing => status == DeviceStatus.pairing;

  bool hasCapability(String cap) => capabilities.contains(cap);
}

/// A command sent to a device.
class DeviceCommand {
  const DeviceCommand({
    required this.id,
    required this.command,
    required this.payload,
    required this.status,
    required this.createdAt,
    this.resultPayload,
    this.errorMessage,
  });

  final String id;
  final String command;
  final Map<String, dynamic> payload;
  final String status;
  final DateTime createdAt;
  final Map<String, dynamic>? resultPayload;
  final String? errorMessage;

  factory DeviceCommand.fromJson(Map<String, dynamic> json) => DeviceCommand(
        id: json['id'] as String,
        command: json['command'] as String,
        payload: json['payload'] is Map
            ? json['payload'] as Map<String, dynamic>
            : {},
        status: json['status'] as String? ?? 'pending',
        createdAt: DateTime.parse(json['created_at'] as String),
        resultPayload: json['result_payload'] is Map
            ? json['result_payload'] as Map<String, dynamic>
            : null,
        errorMessage: json['error_message'] as String?,
      );
}

/// An event emitted by a device.
class DeviceEvent {
  const DeviceEvent({
    required this.id,
    required this.eventType,
    required this.payload,
    required this.createdAt,
  });

  final String id;
  final String eventType;
  final Map<String, dynamic> payload;
  final DateTime createdAt;

  factory DeviceEvent.fromJson(Map<String, dynamic> json) => DeviceEvent(
        id: json['id'] as String,
        eventType: json['event_type'] as String,
        payload: json['payload'] is Map
            ? json['payload'] as Map<String, dynamic>
            : {},
        createdAt: DateTime.parse(json['created_at'] as String),
      );
}

/// Full device detail (device + recent events + commands).
class DeviceDetail {
  const DeviceDetail({
    required this.device,
    required this.recentEvents,
    required this.recentCommands,
  });

  final Device device;
  final List<DeviceEvent> recentEvents;
  final List<DeviceCommand> recentCommands;
}

// ─────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────

class DeviceService extends ChangeNotifier {
  DeviceService({required AuthenticatedClient client}) : _client = client;

  final AuthenticatedClient _client;

  static final _apiBase = EnvConfig.apiBase;

  List<Device> _devices = [];
  List<Device> get devices => _devices;

  bool _loading = false;
  bool get loading => _loading;

  String? _error;
  String? get error => _error;

  // ── List devices ──

  Future<void> fetchDevices() async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final resp = await _client.get(Uri.parse('$_apiBase/v1/admin/devices'));
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body);
        final list = (data['data'] as List?) ?? [];
        _devices = list
            .map((e) => Device.fromJson(e as Map<String, dynamic>))
            .toList();
      } else {
        _error = _extractError(resp.body);
      }
    } catch (e) {
      _error = e.toString();
    }

    _loading = false;
    notifyListeners();
  }

  // ── Device detail ──

  Future<DeviceDetail?> fetchDevice(String deviceId) async {
    try {
      final resp =
          await _client.get(Uri.parse('$_apiBase/v1/admin/devices/$deviceId'));
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body)['data'] as Map<String, dynamic>;
        final events = (data['recent_events'] as List? ?? [])
            .map((e) => DeviceEvent.fromJson(e as Map<String, dynamic>))
            .toList();
        final commands = (data['recent_commands'] as List? ?? [])
            .map((e) => DeviceCommand.fromJson(e as Map<String, dynamic>))
            .toList();
        return DeviceDetail(
          device: Device.fromJson(data),
          recentEvents: events,
          recentCommands: commands,
        );
      }
    } catch (_) {}
    return null;
  }

  // ── Register new device ──

  Future<Device?> registerDevice({
    required String name,
    DeviceType type = DeviceType.mirror,
    List<String> capabilities = const ['display'],
  }) async {
    try {
      final resp = await _client.postJson(
        Uri.parse('$_apiBase/v1/admin/devices'),
        {
          'name': name,
          'device_type': type.apiValue,
          'capabilities': capabilities,
        },
      );
      if (resp.statusCode == 201) {
        final device = Device.fromJson(
            jsonDecode(resp.body)['data'] as Map<String, dynamic>);
        _devices.insert(0, device);
        notifyListeners();
        return device;
      }
    } catch (_) {}
    return null;
  }

  // ── Confirm pairing ──

  Future<String?> confirmPairing(String deviceId, String code) async {
    try {
      final resp = await _client.postJson(
        Uri.parse('$_apiBase/v1/admin/devices/$deviceId/pair/confirm'),
        {'pairing_code': code},
      );
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body)['data'] as Map<String, dynamic>;
        // Refresh device list
        await fetchDevices();
        return data['api_key'] as String?;
      } else {
        _error = _extractError(resp.body);
        notifyListeners();
      }
    } catch (_) {}
    return null;
  }

  // ── Send command to device ──

  Future<DeviceCommand?> sendCommand(
    String deviceId,
    String command, {
    Map<String, dynamic> payload = const {},
  }) async {
    try {
      _error = null;
      final resp = await _client.postJson(
        Uri.parse('$_apiBase/v1/admin/devices/$deviceId/command'),
        {'command': command, 'payload': payload},
      );
      if (resp.statusCode == 201) {
        return DeviceCommand.fromJson(
            jsonDecode(resp.body)['data'] as Map<String, dynamic>);
      }
      _error = _extractError(resp.body);
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
    return null;
  }

  /// Poll a device until a command reaches terminal status.
  Future<DeviceCommand?> waitForCommandResult(
    String deviceId,
    String commandId, {
    Duration timeout = const Duration(seconds: 20),
    Duration interval = const Duration(seconds: 2),
  }) async {
    final end = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(end)) {
      final detail = await fetchDevice(deviceId);
      final cmd = detail?.recentCommands
          .where((c) => c.id == commandId)
          .cast<DeviceCommand?>()
          .firstWhere((_) => true, orElse: () => null);
      if (cmd != null) {
        final status = cmd.status.toLowerCase();
        if (status == 'acknowledged' || status == 'failed') {
          return cmd;
        }
      }
      await Future<void>.delayed(interval);
    }
    return null;
  }

  // ── Update device config ──

  Future<bool> updateDevice(
    String deviceId, {
    String? name,
    List<String>? capabilities,
    Map<String, dynamic>? config,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (name != null) body['name'] = name;
      if (capabilities != null) body['capabilities'] = capabilities;
      if (config != null) body['config'] = config;

      final resp = await _client.patchJson(
        Uri.parse('$_apiBase/v1/admin/devices/$deviceId'),
        body,
      );
      if (resp.statusCode == 200) {
        await fetchDevices();
        return true;
      }
    } catch (_) {}
    return false;
  }

  // ── Delete device ──

  Future<bool> deleteDevice(String deviceId) async {
    try {
      final resp = await _client
          .delete(Uri.parse('$_apiBase/v1/admin/devices/$deviceId'));
      if (resp.statusCode == 200) {
        _devices.removeWhere((d) => d.id == deviceId);
        notifyListeners();
        return true;
      }
    } catch (_) {}
    return false;
  }

  // ── Helpers ──

  String _extractError(String body) {
    try {
      final data = jsonDecode(body);
      return (data['error']?['message'] as String?) ?? 'Unknown error';
    } catch (_) {
      return 'Unknown error';
    }
  }
}
