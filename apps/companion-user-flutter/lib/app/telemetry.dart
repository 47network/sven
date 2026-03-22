import 'dart:convert';
import 'package:flutter/foundation.dart';

class Telemetry {
  static const String _service = 'sven_user_flutter';

  static void logEvent(String name, Map<String, Object?> fields) {
    final payload = <String, Object?>{
      'service': _service,
      'event': name,
      'timestamp': DateTime.now().toIso8601String(),
      ...fields,
    };
    debugPrint(jsonEncode(payload));
  }
}
