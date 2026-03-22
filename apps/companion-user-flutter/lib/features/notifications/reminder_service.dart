import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

import 'push_notification_manager.dart';

/// Schedules local reminder notifications (triggered by `/remind` slash command).
class ReminderService {
  static final ReminderService _instance = ReminderService._();
  static ReminderService get instance => _instance;

  ReminderService._();

  final _plugin = FlutterLocalNotificationsPlugin();
  bool _initialized = false;
  int _nextId = 100;

  Future<void> init() async {
    if (_initialized) return;
    try {
      tz.initializeTimeZones();
      const androidInit = AndroidInitializationSettings(
          '@mipmap/ic_launcher');
      const iosInit = DarwinInitializationSettings(
        requestAlertPermission: false,
        requestBadgePermission: false,
        requestSoundPermission: false,
      );
      await _plugin.initialize(
        const InitializationSettings(
          android: androidInit,
          iOS: iosInit,
        ),
      );
      _initialized = true;
    } catch (e) {
      debugPrint('[ReminderService] init error: $e');
    }
  }

  /// Schedule a reminder notification at [scheduledTime] with [title] and [body].
  Future<void> schedule({
    required DateTime scheduledTime,
    required String title,
    String body = '',
  }) async {
    await init();
    try {
      final appState = PushNotificationManager.instance.appState;
      if (appState != null && appState.isDndActive()) {
        debugPrint('[ReminderService] reminder suppressed (DND active): $title');
        return;
      }

      final tzTime = tz.TZDateTime.from(scheduledTime, tz.local);
      await _plugin.zonedSchedule(
        _nextId++,
        title,
        body.isEmpty ? 'Reminder set by Sven' : body,
        tzTime,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            SvenNotificationChannels.reminders,
            SvenNotificationChannels.remindersName,
            channelDescription: SvenNotificationChannels.remindersDesc,
            importance: Importance.high,
            priority: Priority.high,
          ),
          iOS: DarwinNotificationDetails(
            presentAlert: true,
            presentBadge: true,
            presentSound: true,
          ),
        ),
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
      );
      debugPrint('[ReminderService] scheduled at $scheduledTime id=$_nextId');
    } catch (e) {
      debugPrint('[ReminderService] schedule error: $e');
    }
  }

  Future<void> cancelAll() async {
    await init();
    await _plugin.cancelAll();
  }
}
