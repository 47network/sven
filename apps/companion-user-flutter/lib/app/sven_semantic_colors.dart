import 'package:flutter/material.dart';

class SvenSemanticColors extends ThemeExtension<SvenSemanticColors> {
  const SvenSemanticColors({
    required this.info,
    required this.success,
    required this.warn,
    required this.error,
    required this.critical,
  });

  final Color info;
  final Color success;
  final Color warn;
  final Color error;
  final Color critical;

  @override
  SvenSemanticColors copyWith({
    Color? info,
    Color? success,
    Color? warn,
    Color? error,
    Color? critical,
  }) {
    return SvenSemanticColors(
      info: info ?? this.info,
      success: success ?? this.success,
      warn: warn ?? this.warn,
      error: error ?? this.error,
      critical: critical ?? this.critical,
    );
  }

  @override
  ThemeExtension<SvenSemanticColors> lerp(
    ThemeExtension<SvenSemanticColors>? other,
    double t,
  ) {
    if (other is! SvenSemanticColors) return this;
    return SvenSemanticColors(
      info: Color.lerp(info, other.info, t) ?? info,
      success: Color.lerp(success, other.success, t) ?? success,
      warn: Color.lerp(warn, other.warn, t) ?? warn,
      error: Color.lerp(error, other.error, t) ?? error,
      critical: Color.lerp(critical, other.critical, t) ?? critical,
    );
  }
}
