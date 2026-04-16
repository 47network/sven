import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../features/deployment/deployment_service.dart';
import '../features/entity/custom_shape_spec.dart';
import '../features/home_widget/home_widget_service.dart';
import '../features/preferences/ui_preferences.dart';
import 'app_models.dart';
import 'performance_monitor.dart';
import 'scoped_preferences.dart';

class AppState extends ChangeNotifier {
  AppState({this.onPrefsChanged, PerformanceMonitor? perfMonitor})
      : _perfMonitor = perfMonitor ?? PerformanceMonitor() {
    _perfMonitor.addListener(_onPerformanceChanged);
  }

  final Future<void> Function(UiPreferences prefs)? onPrefsChanged;
  final PerformanceMonitor _perfMonitor;

  static const _kVisualMode = 'ui.visual_mode';
  static const _kMotionEnabled = 'ui.motion_enabled';
  static const _kMotionLevel = 'ui.motion_level';
  static const _kAvatarMode = 'ui.avatar_mode';
  static const _kOnboardingComplete = 'onboarding.complete';
  static const _kResponseLength = 'ui.response_length';
  static const _kAccentPreset = 'ui.accent_preset';
  static const _kTtsSpeed = 'ui.tts_speed';
  static const _kTtsPitch = 'ui.tts_pitch';
  static const _kTtsVoice = 'ui.tts_voice';
  static const _kWakeWordEnabled = 'voice.wake_word_enabled';
  static const _kWakeWordPhrase = 'voice.wake_word_phrase';
  static const _kArchivedIds = 'chat.archived_ids';
  static const _kThreadTags = 'chat.thread_tags';
  static const _kVoicePersonality = 'ui.voice_personality';
  static const _kHighContrast = 'ui.high_contrast';
  static const _kAnalyticsConsent = 'privacy.analytics_consent';
  static const _kCustomShape = 'ui.custom_shape';
  static const _kTextScale = 'ui.text_scale';
  static const _kDndEnabled = 'ui.dnd_enabled';
  static const _kDndStartHour = 'ui.dnd_start_hour';
  static const _kDndStartMinute = 'ui.dnd_start_minute';
  static const _kDndEndHour = 'ui.dnd_end_hour';
  static const _kDndEndMinute = 'ui.dnd_end_minute';
  static const _kNotifSound = 'ui.notif_sound';
  static const _kColorBlindMode = 'ui.color_blind_mode';
  static const _kReduceTransparency = 'ui.reduce_transparency';
  static const _kCustomAccentHex = 'ui.custom_accent_hex';
  static const _kFontFamily = 'ui.font_family';
  static const _kUiDensity = 'ui.ui_density';

  /// All keys that should be migrated from global to scoped storage
  /// on first login after the isolation upgrade.
  static const allScopedKeys = [
    _kVisualMode,
    _kMotionEnabled,
    _kMotionLevel,
    _kAvatarMode,
    _kOnboardingComplete,
    _kResponseLength,
    _kAccentPreset,
    _kTtsSpeed,
    _kTtsPitch,
    _kTtsVoice,
    _kWakeWordEnabled,
    _kWakeWordPhrase,
    _kArchivedIds,
    _kThreadTags,
    _kVoicePersonality,
    _kHighContrast,
    _kAnalyticsConsent,
    _kCustomShape,
    _kTextScale,
    _kDndEnabled,
    _kDndStartHour,
    _kDndStartMinute,
    _kDndEndHour,
    _kDndEndMinute,
    _kNotifSound,
    _kColorBlindMode,
    _kReduceTransparency,
    _kCustomAccentHex,
    _kFontFamily,
    _kUiDensity,
  ];

  /// User-scoped preferences. Null before login.
  ScopedPreferences? _scopedPrefs;
  SharedPreferences? _globalPrefsCache;

  String? userId;
  String? username;

  /// Current deployment mode. Null until fetched from server.
  DeploymentMode? deploymentMode;

  /// Whether the server has completed first-time setup.
  bool serverSetupComplete = true;

  VisualMode visualMode = VisualMode.cinematic;
  MotionLevel motionLevel = MotionLevel.full;
  bool systemReducedMotion = false;
  AvatarMode avatarMode = AvatarMode.orb;
  ResponseLength responseLength = ResponseLength.balanced;
  AccentPreset accentPreset = AccentPreset.sven;
  double ttsSpeed = 1.0;
  double ttsPitch = 1.0;
  bool wakeWordEnabled = false;
  String wakeWordPhrase = 'Hey Sven';
  WakeWordStatus wakeWordStatus = WakeWordStatus.idle;

  /// Stored as "name|locale", e.g. "en-us-x-sfg#male_1-local|en-US".
  String? ttsVoice;
  Set<String> archivedIds = {};
  Map<String, ConversationTag> threadTags = {};
  VoicePersonality voicePersonality = VoicePersonality.friendly;
  bool highContrast = false;
  bool colorBlindMode = false;
  bool reduceTransparency = false;
  bool analyticsConsent = true;
  CustomShapeSpec? customShapeSpec;
  double textScale = 1.0;

  /// Custom accent hex (e.g. '#FF6B6B'). Null means use AccentPreset.
  String? customAccentHex;

  /// Font family preference.
  FontFamily fontFamily = FontFamily.inter;

  /// UI density preference.
  UiDensity uiDensity = UiDensity.comfortable;
  bool dndEnabled = false;
  int dndStartHour = 22;
  int dndStartMinute = 0;
  int dndEndHour = 7;
  int dndEndMinute = 0;

  /// Notification sound profile. One of 'default', 'subtle', 'silent'.
  String notifSound = 'default';
  String? token;
  String? authMessage;

  /// Non-null when a login has completed the password step but the user
  /// still needs to pass a TOTP verification step (mfaRequired == true).
  String? mfaToken;
  bool loaded = false;
  bool onboardingComplete = false;
  bool restoringSession = false;

  /// True when the user has a non-empty auth token.
  bool get isLoggedIn => (token ?? '').isNotEmpty;

  /// True when a password login has succeeded but a TOTP code is still needed.
  bool get mfaRequired => mfaToken != null;
  bool _suppressSync = false;

  PerformanceMonitor get perfMonitor => _perfMonitor;

  // ── Scoped prefs helpers ──────────────────────────────────────────────

  /// Bind scoped prefs to a user. Call after login or bootstrap.
  Future<void> bindUser(String uid, {String? name}) async {
    userId = uid;
    username = name;
    _scopedPrefs = ScopedPreferences(userId: uid);
    notifyListeners();
    // Initialise the home-screen widget service once a user is bound.
    HomeWidgetService.instance.initialise();
  }

  /// Unbind scoped prefs on logout.
  void unbindUser() {
    _scopedPrefs?.unbind();
    _scopedPrefs = null;
    userId = null;
    username = null;
  }

  /// Migrate legacy global keys → user-scoped on first login.
  Future<void> migrateGlobalPrefs() async {
    await _scopedPrefs?.migrateUnscopedKeys(allScopedKeys);
  }

  /// Get a pref string — scoped if bound, global fallback.
  Future<String?> _getString(String key) async {
    if (_scopedPrefs != null && _scopedPrefs!.isBound) {
      return _scopedPrefs!.getString(key);
    }
    final prefs = _globalPrefsCache ?? await SharedPreferences.getInstance();
    _globalPrefsCache ??= prefs;
    return prefs.getString(key);
  }

  Future<bool?> _getBool(String key) async {
    if (_scopedPrefs != null && _scopedPrefs!.isBound) {
      return _scopedPrefs!.getBool(key);
    }
    final prefs = _globalPrefsCache ?? await SharedPreferences.getInstance();
    _globalPrefsCache ??= prefs;
    return prefs.getBool(key);
  }

  Future<double?> _getDouble(String key) async {
    if (_scopedPrefs != null && _scopedPrefs!.isBound) {
      return _scopedPrefs!.getDouble(key);
    }
    final prefs = _globalPrefsCache ?? await SharedPreferences.getInstance();
    _globalPrefsCache ??= prefs;
    return prefs.getDouble(key);
  }

  Future<List<String>?> _getStringList(String key) async {
    if (_scopedPrefs != null && _scopedPrefs!.isBound) {
      return _scopedPrefs!.getStringList(key);
    }
    final prefs = _globalPrefsCache ?? await SharedPreferences.getInstance();
    _globalPrefsCache ??= prefs;
    return prefs.getStringList(key);
  }

  Future<void> _setString(String key, String value) async {
    if (_scopedPrefs != null && _scopedPrefs!.isBound) {
      await _scopedPrefs!.setString(key, value);
    } else {
      final prefs = _globalPrefsCache ?? await SharedPreferences.getInstance();
      _globalPrefsCache ??= prefs;
      await prefs.setString(key, value);
    }
  }

  Future<void> _setBool(String key, bool value) async {
    if (_scopedPrefs != null && _scopedPrefs!.isBound) {
      await _scopedPrefs!.setBool(key, value);
    } else {
      final prefs = _globalPrefsCache ?? await SharedPreferences.getInstance();
      _globalPrefsCache ??= prefs;
      await prefs.setBool(key, value);
    }
  }

  Future<void> _setDouble(String key, double value) async {
    if (_scopedPrefs != null && _scopedPrefs!.isBound) {
      await _scopedPrefs!.setDouble(key, value);
    } else {
      final prefs = _globalPrefsCache ?? await SharedPreferences.getInstance();
      _globalPrefsCache ??= prefs;
      await prefs.setDouble(key, value);
    }
  }

  Future<void> _setStringList(String key, List<String> value) async {
    if (_scopedPrefs != null && _scopedPrefs!.isBound) {
      await _scopedPrefs!.setStringList(key, value);
    } else {
      final prefs = _globalPrefsCache ?? await SharedPreferences.getInstance();
      _globalPrefsCache ??= prefs;
      await prefs.setStringList(key, value);
    }
  }

  Future<void> _removeKey(String key) async {
    if (_scopedPrefs != null && _scopedPrefs!.isBound) {
      await _scopedPrefs!.remove(key);
    } else {
      final prefs = _globalPrefsCache ?? await SharedPreferences.getInstance();
      _globalPrefsCache ??= prefs;
      await prefs.remove(key);
    }
  }

  @override
  void dispose() {
    _perfMonitor.removeListener(_onPerformanceChanged);
    _perfMonitor.dispose();
    super.dispose();
  }

  void _onPerformanceChanged() {
    notifyListeners();
  }

  Future<void> loadPrefs() async {
    if (_scopedPrefs == null || !_scopedPrefs!.isBound) {
      _globalPrefsCache = await SharedPreferences.getInstance();
    }
    final visual = await _getString(_kVisualMode);
    final motion = await _getString(_kMotionLevel);
    final avatar = await _getString(_kAvatarMode);
    visualMode = VisualMode.values.firstWhere(
      (v) => v.name == visual,
      orElse: () => VisualMode.cinematic,
    );
    avatarMode = AvatarMode.values.firstWhere(
      (v) => v.name == avatar,
      orElse: () => AvatarMode.orb,
    );
    final motionEnabled = await _getBool(_kMotionEnabled);
    motionLevel = MotionLevel.values.firstWhere(
      (v) => v.name == motion,
      orElse: () =>
          (motionEnabled ?? true) ? MotionLevel.full : MotionLevel.off,
    );
    onboardingComplete = (await _getBool(_kOnboardingComplete)) ?? false;
    if (!loaded) {
      // Unblock initial route redirect as soon as critical gating state is
      // known; remaining preference hydration can continue in background.
      loaded = true;
      notifyListeners();
    }
    final respLen = await _getString(_kResponseLength);
    responseLength = ResponseLength.values.firstWhere(
      (r) => r.name == respLen,
      orElse: () => ResponseLength.balanced,
    );
    final accent = await _getString(_kAccentPreset);
    accentPreset = AccentPreset.values.firstWhere(
      (a) => a.name == accent,
      orElse: () => AccentPreset.sven,
    );
    ttsSpeed = (await _getDouble(_kTtsSpeed)) ?? 1.0;
    ttsPitch = (await _getDouble(_kTtsPitch)) ?? 1.0;
    ttsVoice = await _getString(_kTtsVoice);
    wakeWordEnabled = (await _getBool(_kWakeWordEnabled)) ?? false;
    wakeWordPhrase = (await _getString(_kWakeWordPhrase)) ?? 'Hey Sven';
    final archived = await _getStringList(_kArchivedIds);
    archivedIds = archived != null ? Set<String>.from(archived) : {};
    final tagsJson = (await _getStringList(_kThreadTags)) ?? [];
    threadTags = {};
    for (final entry in tagsJson) {
      final sep = entry.indexOf(':');
      if (sep > 0) {
        final tId = entry.substring(0, sep);
        final tName = entry.substring(sep + 1);
        final tag = ConversationTag.values.firstWhere(
          (t) => t.name == tName,
          orElse: () => ConversationTag.work,
        );
        threadTags[tId] = tag;
      }
    }
    final personality = await _getString(_kVoicePersonality);
    voicePersonality = VoicePersonality.values.firstWhere(
      (p) => p.name == personality,
      orElse: () => VoicePersonality.friendly,
    );
    highContrast = (await _getBool(_kHighContrast)) ?? false;
    colorBlindMode = (await _getBool(_kColorBlindMode)) ?? false;
    reduceTransparency = (await _getBool(_kReduceTransparency)) ?? false;
    analyticsConsent = (await _getBool(_kAnalyticsConsent)) ?? true;
    final customShape = await _getString(_kCustomShape);
    if (customShape != null && customShape.isNotEmpty) {
      customShapeSpec = CustomShapeSpec.decode(customShape);
    }
    textScale = (await _getDouble(_kTextScale)) ?? 1.0;
    dndEnabled = (await _getBool(_kDndEnabled)) ?? false;
    dndStartHour = (await _getDouble(_kDndStartHour))?.toInt() ?? 22;
    dndStartMinute = (await _getDouble(_kDndStartMinute))?.toInt() ?? 0;
    dndEndHour = (await _getDouble(_kDndEndHour))?.toInt() ?? 7;
    dndEndMinute = (await _getDouble(_kDndEndMinute))?.toInt() ?? 0;
    notifSound = (await _getString(_kNotifSound)) ?? 'default';
    customAccentHex = await _getString(_kCustomAccentHex);
    if (customAccentHex != null && customAccentHex!.isEmpty) {
      customAccentHex = null;
    }
    final fontFam = await _getString(_kFontFamily);
    fontFamily = FontFamily.values.firstWhere(
      (f) => f.name == fontFam,
      orElse: () => FontFamily.inter,
    );
    final density = await _getString(_kUiDensity);
    uiDensity = UiDensity.values.firstWhere(
      (d) => d.name == density,
      orElse: () => UiDensity.comfortable,
    );
    notifyListeners();
  }

  /// Reload preferences from user-scoped storage (call after bindUser).
  Future<void> reloadPrefs() => loadPrefs();

  /// Reset in-memory state on logout.
  void resetForLogout() {
    final preservedOnboardingComplete = onboardingComplete;
    unbindUser();
    token = null;
    authMessage = null;
    mfaToken = null;
    // Clear widget content so it doesn't show stale data after sign-out.
    HomeWidgetService.instance.clear();
    visualMode = VisualMode.cinematic;
    motionLevel = MotionLevel.full;
    avatarMode = AvatarMode.orb;
    responseLength = ResponseLength.balanced;
    accentPreset = AccentPreset.sven;
    ttsSpeed = 1.0;
    ttsPitch = 1.0;
    ttsVoice = null;
    wakeWordEnabled = false;
    wakeWordPhrase = 'Hey Sven';
    wakeWordStatus = WakeWordStatus.idle;
    archivedIds = {};
    threadTags = {};
    voicePersonality = VoicePersonality.friendly;
    highContrast = false;
    colorBlindMode = false;
    reduceTransparency = false;
    analyticsConsent = true;
    customShapeSpec = null;
    textScale = 1.0;
    customAccentHex = null;
    fontFamily = FontFamily.inter;
    uiDensity = UiDensity.comfortable;
    dndEnabled = false;
    dndStartHour = 22;
    dndStartMinute = 0;
    dndEndHour = 7;
    dndEndMinute = 0;
    onboardingComplete = preservedOnboardingComplete;
    restoringSession = false;
    loaded = true;
    notifyListeners();
  }

  Future<void> setVisualMode(VisualMode mode) async {
    visualMode = mode;
    notifyListeners();
    await _setString(_kVisualMode, mode.name);
    await _emitPrefsChanged();
  }

  MotionLevel get effectiveMotionLevel {
    if (_perfMonitor.autoFallbackActive) return MotionLevel.off;
    if (!systemReducedMotion) return motionLevel;
    if (motionLevel == MotionLevel.full) return MotionLevel.reduced;
    return motionLevel;
  }

  VisualMode get effectiveVisualMode {
    if (_perfMonitor.autoFallbackActive) return VisualMode.classic;
    return visualMode;
  }

  String? get performanceFallbackReason {
    if (!_perfMonitor.autoFallbackActive) return null;
    return _perfMonitor.getFallbackReason();
  }

  Future<void> setMotionLevel(MotionLevel level) async {
    motionLevel = level;
    notifyListeners();
    await _setString(_kMotionLevel, level.name);
    await _emitPrefsChanged();
  }

  void setSystemReducedMotion(bool enabled) {
    if (systemReducedMotion == enabled) return;
    systemReducedMotion = enabled;
    notifyListeners();
  }

  Future<void> setAvatarMode(AvatarMode mode) async {
    avatarMode = mode;
    notifyListeners();
    await _setString(_kAvatarMode, mode.name);
    await _emitPrefsChanged();
  }

  Future<void> setCustomShapeSpec(CustomShapeSpec? spec) async {
    customShapeSpec = spec;
    notifyListeners();
    if (spec != null) {
      await _setString(_kCustomShape, spec.encode());
    } else {
      await _removeKey(_kCustomShape);
    }
  }

  Future<void> setResponseLength(ResponseLength length) async {
    responseLength = length;
    notifyListeners();
    await _setString(_kResponseLength, length.name);
  }

  Future<void> setAccentPreset(AccentPreset preset) async {
    accentPreset = preset;
    customAccentHex = null; // clear custom when picking preset
    notifyListeners();
    await _setString(_kAccentPreset, preset.name);
    await _setString(_kCustomAccentHex, '');
  }

  Future<void> setCustomAccentHex(String? hex) async {
    customAccentHex = hex;
    if (hex != null && hex.isNotEmpty) {
      accentPreset = AccentPreset.sven; // reset preset for custom
    }
    notifyListeners();
    await _setString(_kCustomAccentHex, hex ?? '');
  }

  Future<void> setFontFamily(FontFamily family) async {
    fontFamily = family;
    notifyListeners();
    await _setString(_kFontFamily, family.name);
  }

  Future<void> setUiDensity(UiDensity density) async {
    uiDensity = density;
    notifyListeners();
    await _setString(_kUiDensity, density.name);
  }

  Future<void> setTtsSpeed(double speed) async {
    ttsSpeed = speed.clamp(0.25, 3.0);
    notifyListeners();
    await _setDouble(_kTtsSpeed, ttsSpeed);
  }

  Future<void> setTtsPitch(double pitch) async {
    ttsPitch = pitch.clamp(0.5, 2.0);
    notifyListeners();
    await _setDouble(_kTtsPitch, ttsPitch);
  }

  /// Store voice selection as "name|locale".
  Future<void> setTtsVoice(String? voiceKey) async {
    ttsVoice = voiceKey;
    notifyListeners();
    if (voiceKey != null) {
      await _setString(_kTtsVoice, voiceKey);
    } else {
      await _removeKey(_kTtsVoice);
    }
  }

  Future<void> setWakeWordEnabled(bool enabled) async {
    wakeWordEnabled = enabled;
    notifyListeners();
    await _setBool(_kWakeWordEnabled, enabled);
  }

  Future<void> setWakeWordPhrase(String phrase) async {
    final trimmed = phrase.trim();
    wakeWordPhrase = trimmed.isEmpty ? 'Hey Sven' : trimmed;
    notifyListeners();
    await _setString(_kWakeWordPhrase, wakeWordPhrase);
  }

  void setWakeWordStatus(WakeWordStatus status) {
    if (wakeWordStatus == status) return;
    wakeWordStatus = status;
    notifyListeners();
  }

  Future<void> setTextScale(double scale) async {
    textScale = scale.clamp(0.8, 1.5);
    notifyListeners();
    await _setDouble(_kTextScale, textScale);
  }

  Future<void> toggleArchive(String threadId) async {
    if (archivedIds.contains(threadId)) {
      archivedIds = Set.from(archivedIds)..remove(threadId);
    } else {
      archivedIds = Set.from(archivedIds)..add(threadId);
    }
    notifyListeners();
    await _setStringList(_kArchivedIds, archivedIds.toList());
  }

  Future<void> setThreadTag(String threadId, ConversationTag? tag) async {
    if (tag == null) {
      threadTags = Map.from(threadTags)..remove(threadId);
    } else {
      threadTags = Map.from(threadTags)..[threadId] = tag;
    }
    notifyListeners();
    final list =
        threadTags.entries.map((e) => '${e.key}:${e.value.name}').toList();
    await _setStringList(_kThreadTags, list);
  }

  Future<void> setVoicePersonality(VoicePersonality personality) async {
    voicePersonality = personality;
    notifyListeners();
    await _setString(_kVoicePersonality, personality.name);
  }

  Future<void> setHighContrast(bool value) async {
    highContrast = value;
    notifyListeners();
    await _setBool(_kHighContrast, value);
  }

  Future<void> setColorBlindMode(bool value) async {
    colorBlindMode = value;
    notifyListeners();
    await _setBool(_kColorBlindMode, value);
  }

  Future<void> setReduceTransparency(bool value) async {
    reduceTransparency = value;
    notifyListeners();
    await _setBool(_kReduceTransparency, value);
  }

  Future<void> setAnalyticsConsent(bool value) async {
    analyticsConsent = value;
    notifyListeners();
    await _setBool(_kAnalyticsConsent, value);
  }

  // ── DND scheduling ──────────────────────────────────────────────────

  Future<void> setDndEnabled(bool value) async {
    dndEnabled = value;
    notifyListeners();
    await _setBool(_kDndEnabled, value);
  }

  Future<void> setDndSchedule({
    required int startHour,
    required int startMinute,
    required int endHour,
    required int endMinute,
  }) async {
    dndStartHour = startHour;
    dndStartMinute = startMinute;
    dndEndHour = endHour;
    dndEndMinute = endMinute;
    notifyListeners();
    await _setDouble(_kDndStartHour, startHour.toDouble());
    await _setDouble(_kDndStartMinute, startMinute.toDouble());
    await _setDouble(_kDndEndHour, endHour.toDouble());
    await _setDouble(_kDndEndMinute, endMinute.toDouble());
  }

  // ── Notification sound ───────────────────────────────────────────────

  Future<void> setNotifSound(String value) async {
    notifSound = value;
    notifyListeners();
    await _setString(_kNotifSound, value);
  }

  /// Returns true if the current time falls within the DND window.
  bool isDndActive() {
    if (!dndEnabled) return false;
    final now = DateTime.now();
    final nowMinutes = now.hour * 60 + now.minute;
    final startMinutes = dndStartHour * 60 + dndStartMinute;
    final endMinutes = dndEndHour * 60 + dndEndMinute;

    if (startMinutes <= endMinutes) {
      // Same-day window (e.g. 09:00 – 17:00)
      return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    } else {
      // Overnight window (e.g. 22:00 – 07:00)
      return nowMinutes >= startMinutes || nowMinutes < endMinutes;
    }
  }

  /// Human-readable DND schedule string.
  String get dndScheduleLabel {
    String pad(int v) => v.toString().padLeft(2, '0');
    return '${pad(dndStartHour)}:${pad(dndStartMinute)}'
        ' – ${pad(dndEndHour)}:${pad(dndEndMinute)}';
  }

  Future<void> applyRemotePrefs(UiPreferences prefs) async {
    _suppressSync = true;
    visualMode = prefs.visualMode;
    motionLevel = prefs.motionLevel;
    avatarMode = prefs.avatarMode;
    notifyListeners();
    await _setString(_kVisualMode, prefs.visualMode.name);
    await _setString(_kMotionLevel, prefs.motionLevel.name);
    await _setString(_kAvatarMode, prefs.avatarMode.name);
    _suppressSync = false;
  }

  void setToken(String? value) {
    token = value;
    if (value != null && value.isNotEmpty) mfaToken = null;
    notifyListeners();
  }

  void setAuthMessage(String? message) {
    authMessage = message;
    notifyListeners();
  }

  void setMfaToken(String? value) {
    mfaToken = value;
    notifyListeners();
  }

  void setRestoringSession(bool value) {
    if (restoringSession == value) return;
    restoringSession = value;
    notifyListeners();
  }

  Future<void> completeOnboarding() async {
    onboardingComplete = true;
    notifyListeners();
    await _setBool(_kOnboardingComplete, true);
  }

  Future<void> _emitPrefsChanged() async {
    if (_suppressSync) return;
    final callback = onPrefsChanged;
    if (callback == null) return;
    await callback(
      UiPreferences(
        visualMode: visualMode,
        motionLevel: motionLevel,
        avatarMode: avatarMode,
      ),
    );
  }
}
