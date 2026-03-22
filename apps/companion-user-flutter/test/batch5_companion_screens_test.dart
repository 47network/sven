import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

import 'package:sven_user_flutter/app/app_models.dart';
import 'package:sven_user_flutter/app/authenticated_client.dart';
import 'package:sven_user_flutter/features/deployment/deployment_service.dart';
import 'package:sven_user_flutter/features/deployment/deployment_setup_page.dart';
import 'package:sven_user_flutter/features/devices/device_control_page.dart';
import 'package:sven_user_flutter/features/devices/device_manager_page.dart';
import 'package:sven_user_flutter/features/devices/device_service.dart';
import 'package:sven_user_flutter/features/entity/mirror_mode_screen.dart';

class FakeDeviceService extends DeviceService {
  FakeDeviceService({
    required List<Device> devices,
    required Map<String, DeviceDetail> details,
  })  : _devicesState = List<Device>.from(devices),
        _detailsState = Map<String, DeviceDetail>.from(details),
        super(client: AuthenticatedClient(client: http.Client()));

  final List<Device> _devicesState;
  final Map<String, DeviceDetail> _detailsState;
  final List<String> sentCommands = <String>[];

  @override
  List<Device> get devices => List<Device>.unmodifiable(_devicesState);

  @override
  bool get loading => false;

  @override
  String? get error => null;

  @override
  Future<void> fetchDevices() async {
    notifyListeners();
  }

  @override
  Future<DeviceDetail?> fetchDevice(String deviceId) async => _detailsState[deviceId];

  @override
  Future<Device?> registerDevice({
    required String name,
    DeviceType type = DeviceType.mirror,
    List<String> capabilities = const <String>['display'],
  }) async {
    final device = Device(
      id: 'new-device',
      name: name,
      deviceType: type,
      status: DeviceStatus.pairing,
      capabilities: capabilities,
      config: const <String, dynamic>{},
      pairingCode: 'ABC123',
      pairingExpires: DateTime.now().add(const Duration(minutes: 15)).toIso8601String(),
      createdAt: DateTime.now(),
    );
    _devicesState.insert(0, device);
    _detailsState[device.id] = DeviceDetail(
      device: device,
      recentEvents: const <DeviceEvent>[],
      recentCommands: const <DeviceCommand>[],
    );
    notifyListeners();
    return device;
  }

  @override
  Future<String?> confirmPairing(String deviceId, String code) async {
    final index = _devicesState.indexWhere((device) => device.id == deviceId);
    if (index < 0) return null;
    final current = _devicesState[index];
    final updated = Device(
      id: current.id,
      name: current.name,
      deviceType: current.deviceType,
      status: DeviceStatus.online,
      capabilities: current.capabilities,
      config: current.config,
      lastSeenAt: DateTime.now(),
      pairedAt: DateTime.now(),
      createdAt: current.createdAt,
    );
    _devicesState[index] = updated;
    _detailsState[deviceId] = DeviceDetail(
      device: updated,
      recentEvents: _detailsState[deviceId]?.recentEvents ?? const <DeviceEvent>[],
      recentCommands: _detailsState[deviceId]?.recentCommands ?? const <DeviceCommand>[],
    );
    notifyListeners();
    return 'sven_dev_test_key';
  }

  @override
  Future<DeviceCommand?> sendCommand(
    String deviceId,
    String command, {
    Map<String, dynamic> payload = const <String, dynamic>{},
  }) async {
    sentCommands.add(command);
    final cmd = DeviceCommand(
      id: 'cmd-${sentCommands.length}',
      command: command,
      payload: payload,
      status: 'pending',
      createdAt: DateTime.now(),
    );
    final current = _detailsState[deviceId];
    if (current != null) {
      _detailsState[deviceId] = DeviceDetail(
        device: current.device,
        recentEvents: current.recentEvents,
        recentCommands: <DeviceCommand>[cmd, ...current.recentCommands],
      );
    }
    notifyListeners();
    return cmd;
  }
}

class FakeDeploymentService extends DeploymentService {
  FakeDeploymentService() : super(client: http.Client());

  DeploymentMode? submittedMode;
  String? submittedUsername;
  String? submittedPassword;
  String? submittedDisplayName;

  @override
  Future<Map<String, dynamic>> setup({
    required DeploymentMode mode,
    required String username,
    required String password,
    String? displayName,
  }) async {
    submittedMode = mode;
    submittedUsername = username;
    submittedPassword = password;
    submittedDisplayName = displayName;
    return <String, dynamic>{
      'mode': mode.apiValue,
      'username': username,
    };
  }
}

Widget wrapPage(Widget page) => MaterialApp(home: page);

Device sampleDevice({
  required String id,
  required String name,
  required DeviceStatus status,
  String? pairingCode,
  List<String> capabilities = const <String>['display'],
}) {
  return Device(
    id: id,
    name: name,
    deviceType: DeviceType.mirror,
    status: status,
    capabilities: capabilities,
    config: const <String, dynamic>{},
    pairingCode: pairingCode,
    pairingExpires: pairingCode == null ? null : DateTime.now().add(const Duration(minutes: 15)).toIso8601String(),
    createdAt: DateTime.now(),
    lastSeenAt: status == DeviceStatus.online ? DateTime.now() : null,
    pairedAt: status == DeviceStatus.online ? DateTime.now() : null,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('Batch 5 companion screens', () {
    testWidgets('device manager shows registered devices and pairing dialog', (tester) async {
      final pairingDevice = sampleDevice(
        id: 'pairing-1',
        name: 'Kitchen Mirror',
        status: DeviceStatus.pairing,
        pairingCode: 'ZXCVBN',
        capabilities: const <String>['display', 'camera'],
      );
      final onlineDevice = sampleDevice(
        id: 'online-1',
        name: 'Desk Panel',
        status: DeviceStatus.online,
      );
      final service = FakeDeviceService(
        devices: <Device>[pairingDevice, onlineDevice],
        details: <String, DeviceDetail>{
          pairingDevice.id: DeviceDetail(
            device: pairingDevice,
            recentEvents: const <DeviceEvent>[],
            recentCommands: const <DeviceCommand>[],
          ),
          onlineDevice.id: DeviceDetail(
            device: onlineDevice,
            recentEvents: const <DeviceEvent>[],
            recentCommands: const <DeviceCommand>[],
          ),
        },
      );

      await tester.pumpWidget(
        wrapPage(DeviceManagerPage(deviceService: service, visualMode: VisualMode.cinematic)),
      );
      await tester.pumpAndSettle();

      expect(find.text('Devices'), findsOneWidget);
      expect(find.text('Kitchen Mirror'), findsOneWidget);
      expect(find.text('Desk Panel'), findsOneWidget);
      expect(find.text('Add Device'), findsOneWidget);

      await tester.tap(find.text('Kitchen Mirror'));
      await tester.pumpAndSettle();

      expect(find.text('Pairing Code'), findsOneWidget);
      expect(find.text('ZXCVBN'), findsOneWidget);
      expect(find.text('Expires in 15 minutes'), findsOneWidget);
    });

    testWidgets('device control quick ping issues command and shows feedback', (tester) async {
      final device = sampleDevice(
        id: 'online-2',
        name: 'Hallway Mirror',
        status: DeviceStatus.online,
        capabilities: const <String>['display', 'camera'],
      );
      final service = FakeDeviceService(
        devices: <Device>[device],
        details: <String, DeviceDetail>{
          device.id: DeviceDetail(
            device: device,
            recentEvents: <DeviceEvent>[
              DeviceEvent(
                id: 'evt-1',
                eventType: 'browser_probe',
                payload: <String, dynamic>{'ok': true},
                createdAt: DateTime.utc(2026, 3, 18, 10),
              ),
            ],
            recentCommands: <DeviceCommand>[
              DeviceCommand(
                id: 'cmd-0',
                command: 'ping',
                payload: <String, dynamic>{},
                status: 'acknowledged',
                createdAt: DateTime.utc(2026, 3, 18, 10),
              ),
            ],
          ),
        },
      );

      await tester.pumpWidget(
        wrapPage(DeviceControlPage(
          deviceService: service,
          device: device,
          visualMode: VisualMode.cinematic,
        )),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Hallway Mirror'), findsOneWidget);
      expect(find.text('Command History'), findsOneWidget);
      expect(find.text('Ping'), findsWidgets);

      final pingAction = find.ancestor(
        of: find.byIcon(Icons.network_ping_rounded),
        matching: find.byType(InkWell),
      );
      await tester.tap(pingAction.first);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(service.sentCommands, contains('ping'));
      expect(find.text('Command sent: ping'), findsOneWidget);
    });

    testWidgets('deployment setup completes and returns submitted credentials', (tester) async {
      final service = FakeDeploymentService();
      DeploymentMode? completedMode;
      String? completedUsername;
      String? completedPassword;

      await tester.pumpWidget(
        wrapPage(
          DeploymentSetupPage(
            deploymentService: service,
            onSetupComplete: (mode, username, password) {
              completedMode = mode;
              completedUsername = username;
              completedPassword = password;
            },
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.text('Welcome to Sven'), findsOneWidget);
      expect(find.text('Household / Team'), findsOneWidget);

      await tester.tap(find.text('Continue'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      await tester.enterText(find.widgetWithText(TextField, 'Display name (optional)'), 'Stan');
      await tester.enterText(find.widgetWithText(TextField, 'Username'), 'stan');
      await tester.enterText(find.widgetWithText(TextField, 'Password'), 'StrongTemp#2026');
      await tester.tap(find.text('Create'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text("You're all set!"), findsOneWidget);
      expect(service.submittedMode, DeploymentMode.personal);
      expect(service.submittedUsername, 'stan');
      expect(service.submittedPassword, 'StrongTemp#2026');
      expect(service.submittedDisplayName, 'Stan');

      await tester.tap(find.text('Get Started'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      expect(completedMode, DeploymentMode.personal);
      expect(completedUsername, 'stan');
      expect(completedPassword, 'StrongTemp#2026');
    });

    testWidgets('mirror mode renders gateway channel and motion state', (tester) async {
      await tester.pumpWidget(
        wrapPage(
          const MirrorModeScreen(
            gatewayUrl: 'https://app.sven.systems:44747',
            motionLevel: MotionLevel.full,
            entityChannelId: 'entity:default',
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.text('Mirror Mode'), findsOneWidget);
      expect(find.text('https://app.sven.systems:44747'), findsOneWidget);
      expect(find.text('entity:default'), findsOneWidget);
      expect(find.text('Full'), findsOneWidget);
    });
  });
}
