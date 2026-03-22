import 'package:flutter/foundation.dart';

/// Performance monitor that tracks device health and triggers fallbacks.
class PerformanceMonitor extends ChangeNotifier {
  PerformanceMonitor();

  bool _thermalCritical = false;
  bool _batteryLow = false;
  bool _autoFallbackActive = false;

  bool get autoFallbackActive => _autoFallbackActive;

  void updateThermalState(bool isCritical) {
    if (_thermalCritical == isCritical) return;
    _thermalCritical = isCritical;
    _updateFallback();
  }

  void updateBatteryState(int level, bool isCharging) {
    final wasLow = _batteryLow;
    _batteryLow = level < 20 && !isCharging;
    if (wasLow == _batteryLow) return;
    _updateFallback();
  }

  void _updateFallback() {
    final shouldFallback = _thermalCritical || _batteryLow;
    if (_autoFallbackActive == shouldFallback) return;
    _autoFallbackActive = shouldFallback;
    debugPrint(
      'PerformanceMonitor: auto-fallback ${shouldFallback ? "ENABLED" : "DISABLED"} '
      '(thermal=$_thermalCritical, battery=$_batteryLow)',
    );
    notifyListeners();
  }

  String getFallbackReason() {
    if (_thermalCritical) return 'Device temperature is high';
    if (_batteryLow) return 'Battery is low';
    return '';
  }
}
