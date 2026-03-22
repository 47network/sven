import '../../app/app_models.dart';

class UiPreferences {
  UiPreferences({
    required this.visualMode,
    required this.motionLevel,
    required this.avatarMode,
  });

  final VisualMode visualMode;
  final MotionLevel motionLevel;
  final AvatarMode avatarMode;

  static UiPreferences defaults() {
    return UiPreferences(
      visualMode: VisualMode.cinematic,
      motionLevel: MotionLevel.full,
      avatarMode: AvatarMode.orb,
    );
  }

  static UiPreferences fromJson(Map<String, dynamic> json) {
    final visual = json['visual_mode']?.toString();
    final avatar = json['avatar_mode']?.toString();
    final motionLevel = json['motion_level']?.toString();
    final motionEnabled = json['motion_enabled'];

    final visualMode = VisualMode.values.firstWhere(
      (v) => v.name == visual,
      orElse: () => VisualMode.cinematic,
    );
    final avatarMode = AvatarMode.values.firstWhere(
      (v) => v.name == avatar,
      orElse: () => AvatarMode.orb,
    );

    MotionLevel resolvedMotion = MotionLevel.full;
    if (motionLevel != null) {
      resolvedMotion = MotionLevel.values.firstWhere(
        (m) => m.name == motionLevel,
        orElse: () => MotionLevel.full,
      );
    } else if (motionEnabled is bool) {
      resolvedMotion = motionEnabled ? MotionLevel.full : MotionLevel.off;
    }

    return UiPreferences(
      visualMode: visualMode,
      motionLevel: resolvedMotion,
      avatarMode: avatarMode,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'visual_mode': visualMode.name,
      'avatar_mode': avatarMode.name,
      'motion_enabled': motionLevel != MotionLevel.off,
    };
  }
}
