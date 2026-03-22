import 'package:flutter/animation.dart';

import 'app_models.dart';

Duration motionDuration(
  MotionLevel level, {
  Duration full = const Duration(milliseconds: 280),
  Duration reduced = const Duration(milliseconds: 140),
}) {
  switch (level) {
    case MotionLevel.full:
      return full;
    case MotionLevel.reduced:
      return reduced;
    case MotionLevel.off:
      return Duration.zero;
  }
}

Curve motionCurve(MotionLevel level) {
  switch (level) {
    case MotionLevel.full:
      return Curves.easeOutCubic;
    case MotionLevel.reduced:
      return Curves.easeOut;
    case MotionLevel.off:
      return Curves.linear;
  }
}
