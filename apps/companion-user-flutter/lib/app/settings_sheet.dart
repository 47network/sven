import 'dart:io';
import 'package:flutter/cupertino.dart' show CupertinoNavigationBar;
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FilteringTextInputFormatter;

import 'ab_test_override_page.dart';
import 'ab_test_service.dart';
import 'api_base_service.dart';
import 'app_models.dart';
import 'app_state.dart';
import 'authenticated_client.dart';
import 'server_discovery_service.dart';
import 'service_locator.dart';
import 'sven_page_route.dart';
import 'sven_tokens.dart';
import '../features/approvals/approvals_page.dart';
import '../features/chat/voice_service.dart';
import '../features/deployment/deployment_service.dart';
import '../features/auth/auth_service.dart';
import '../features/auth/account_picker_sheet.dart';
import '../features/auth/mfa_setup_sheet.dart';
import '../features/devices/device_manager_page.dart';
import '../features/devices/device_service.dart';
import '../features/entity/sven_entity_page.dart';
import '../features/memory/memory_page.dart';
import '../features/memory/memory_service.dart';
import '../features/notifications/notifications_page.dart';
import '../features/preferences/user_settings_service.dart';
import '../features/projects/project_picker_sheet.dart';
import '../features/projects/project_service.dart';
import '../features/security/app_lock_service.dart';
import '../features/settings/privacy_page.dart';

class SettingsSheet extends StatelessWidget {
  const SettingsSheet({
    super.key,
    required this.state,
    required this.client,
    required this.onLogout,
    required this.onLogoutAll,
    // ignore: unused_element_parameter
    this.memoryService,
    this.lockService,
    this.voiceService,
    this.deviceService,
    this.projectService,
    this.authService,
  });

  final AppState state;
  final AuthenticatedClient client;
  final Future<void> Function() onLogout;
  final Future<void> Function() onLogoutAll;
  final MemoryService? memoryService;
  final AppLockService? lockService;
  final VoiceService? voiceService;
  final DeviceService? deviceService;
  final ProjectService? projectService;
  final AuthService? authService;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(state.visualMode);
    final cinematic = state.visualMode == VisualMode.cinematic;
    final reduceMotion = MediaQuery.of(context).disableAnimations;

    return AnimatedBuilder(
      animation: state,
      builder: (context, _) {
        return DraggableScrollableSheet(
          initialChildSize: 0.65,
          minChildSize: 0.35,
          maxChildSize: 0.9,
          expand: false,
          builder: (context, scrollController) {
            return SingleChildScrollView(
              controller: scrollController,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Handle
                    Center(
                      child: Container(
                        width: 36,
                        height: 4,
                        margin: const EdgeInsets.only(bottom: 20),
                        decoration: BoxDecoration(
                          color: tokens.onSurface.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    // Title
                    Text(
                      'Settings',
                      style:
                          Theme.of(context).textTheme.headlineSmall?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                    ),
                    const SizedBox(height: 24),

                    // ── Voice ──
                    if (voiceService != null) ...[
                      _SectionLabel(text: 'Voice', tokens: tokens),
                      const SizedBox(height: 12),
                      ListenableBuilder(
                        listenable: voiceService!,
                        builder: (_, __) => _SettingsTile(
                          icon: Icons.record_voice_over_outlined,
                          title: 'Auto-read responses',
                          subtitle: 'Speak AI replies automatically',
                          trailing: Switch.adaptive(
                            value: voiceService!.autoReadAloud,
                            onChanged: voiceService!.setAutoReadAloud,
                            activeColor: tokens.primary,
                          ),
                          tokens: tokens,
                          cinematic: cinematic,
                        ),
                      ),
                      const SizedBox(height: 8),
                      _SettingsTile(
                        icon: Icons.hearing_rounded,
                        title: 'Voice wake',
                        subtitle:
                            'Say "${state.wakeWordPhrase}" to open hands-free voice capture while the app is active',
                        trailing: Switch.adaptive(
                          value: state.wakeWordEnabled,
                          onChanged: state.setWakeWordEnabled,
                          activeColor: tokens.primary,
                        ),
                        onTap: () => state.setWakeWordEnabled(!state.wakeWordEnabled),
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                      const SizedBox(height: 8),
                      _SettingsTile(
                        icon: Icons.keyboard_voice_rounded,
                        title: 'Wake phrase',
                        subtitle: state.wakeWordPhrase,
                        trailing: Icon(Icons.chevron_right_rounded,
                            color: tokens.onSurface.withValues(alpha: 0.45)),
                        onTap: () async {
                          final controller = TextEditingController(text: state.wakeWordPhrase);
                          final value = await showDialog<String>(
                            context: context,
                            builder: (dialogContext) => AlertDialog(
                              title: const Text('Wake phrase'),
                              content: TextField(
                                controller: controller,
                                autofocus: true,
                                decoration: const InputDecoration(
                                  hintText: 'Hey Sven',
                                ),
                              ),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.of(dialogContext).pop(),
                                  child: const Text('Cancel'),
                                ),
                                FilledButton(
                                  onPressed: () => Navigator.of(dialogContext).pop(controller.text),
                                  child: const Text('Save'),
                                ),
                              ],
                            ),
                          );
                          if (value != null) {
                            await state.setWakeWordPhrase(value);
                          }
                        },
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                      const SizedBox(height: 8),
                      // ── Voice picker ──
                      FutureBuilder<List<dynamic>>(
                        future: voiceService!.getAvailableVoices(),
                        builder: (ctx, snap) {
                          if (!snap.hasData || snap.data!.isEmpty) {
                            return const SizedBox.shrink();
                          }
                          // Filter to English voices only
                          final voices = snap.data!.whereType<Map>().where((v) {
                            final locale =
                                (v['locale'] ?? '').toString().toLowerCase();
                            return locale.startsWith('en');
                          }).toList()
                            ..sort((a, b) => (a['name'] ?? '')
                                .toString()
                                .compareTo((b['name'] ?? '').toString()));
                          if (voices.isEmpty) return const SizedBox.shrink();
                          final current = voiceService!.selectedVoiceName;
                          return _SettingsTile(
                            icon: Icons.graphic_eq_rounded,
                            title: 'Voice',
                            subtitle: current != null
                                ? _voiceDisplayName(current)
                                : 'System default',
                            trailing: SizedBox(
                              width: 140,
                              child: DropdownButton<String>(
                                value: current,
                                underline: const SizedBox.shrink(),
                                isDense: true,
                                isExpanded: true,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(
                                      color: tokens.primary,
                                      fontWeight: FontWeight.w600,
                                    ),
                                hint: Text('Default',
                                    style: TextStyle(
                                        color: tokens.onSurface
                                            .withValues(alpha: 0.5),
                                        fontSize: 12)),
                                items:
                                    voices.map<DropdownMenuItem<String>>((v) {
                                  final name = v['name'].toString();
                                  return DropdownMenuItem(
                                    value: name,
                                    child: Text(
                                      _voiceDisplayName(name),
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontSize: 12),
                                    ),
                                  );
                                }).toList(),
                                onChanged: (name) {
                                  if (name == null) return;
                                  final voice = voices.firstWhere(
                                      (v) => v['name'].toString() == name);
                                  final locale =
                                      voice['locale']?.toString() ?? 'en-US';
                                  voiceService!.setVoice(name, locale);
                                  state.setTtsVoice('$name|$locale');
                                },
                              ),
                            ),
                            tokens: tokens,
                            cinematic: cinematic,
                          );
                        },
                      ),
                      const SizedBox(height: 8),
                      ListenableBuilder(
                        listenable: voiceService!,
                        builder: (_, __) => Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _SettingsTile(
                              icon: Icons.speed_rounded,
                              title: 'Speaking speed',
                              subtitle:
                                  '${voiceService!.ttsSpeed.toStringAsFixed(1)}×',
                              trailing: SizedBox(
                                width: 140,
                                child: Slider(
                                  value: voiceService!.ttsSpeed,
                                  min: 0.5,
                                  max: 2.0,
                                  divisions: 6,
                                  onChanged: (v) {
                                    voiceService!.setSpeed(v);
                                    state.setTtsSpeed(v);
                                  },
                                  activeColor: tokens.primary,
                                ),
                              ),
                              tokens: tokens,
                              cinematic: cinematic,
                            ),
                            const SizedBox(height: 4),
                            _SettingsTile(
                              icon: Icons.tune_rounded,
                              title: 'Voice pitch',
                              subtitle:
                                  voiceService!.ttsPitch.toStringAsFixed(1),
                              trailing: SizedBox(
                                width: 140,
                                child: Slider(
                                  value: voiceService!.ttsPitch,
                                  min: 0.5,
                                  max: 2.0,
                                  divisions: 6,
                                  onChanged: (v) {
                                    voiceService!.setPitch(v);
                                    state.setTtsPitch(v);
                                  },
                                  activeColor: tokens.primary,
                                ),
                              ),
                              tokens: tokens,
                              cinematic: cinematic,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],

                    // ── Personality ──
                    _SectionLabel(text: 'Personality', tokens: tokens),
                    const SizedBox(height: 12),
                    _SettingsTile(
                      icon: Icons.mood_rounded,
                      title: 'Sven\'s tone',
                      subtitle: state.voicePersonality.description,
                      trailing: DropdownButton<VoicePersonality>(
                        value: state.voicePersonality,
                        underline: const SizedBox.shrink(),
                        isDense: true,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: tokens.primary,
                              fontWeight: FontWeight.w600,
                            ),
                        items: VoicePersonality.values
                            .map((p) => DropdownMenuItem(
                                  value: p,
                                  child: Text('${p.icon} ${p.label}'),
                                ))
                            .toList(),
                        onChanged: (v) {
                          if (v != null) state.setVoicePersonality(v);
                        },
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    // Personality override / custom notes
                    if (memoryService != null) ...[
                      const SizedBox(height: 8),
                      _PersonalityOverrideTile(
                        memoryService: memoryService!,
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                      const SizedBox(height: 8),
                      _LanguageTile(
                        memoryService: memoryService!,
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                    ],
                    const SizedBox(height: 24),

                    // ── Appearance ──
                    _SectionLabel(text: 'Appearance', tokens: tokens),
                    const SizedBox(height: 12),
                    _SettingsTile(
                      icon: Icons.palette_outlined,
                      title: 'Theme',
                      trailing: _SegmentedPill(
                        value: state.visualMode == VisualMode.classic,
                        labelTrue: 'Light',
                        labelFalse: 'Dark',
                        tokens: tokens,
                        cinematic: cinematic,
                        onChanged: (isClassic) => state.setVisualMode(
                          isClassic ? VisualMode.classic : VisualMode.cinematic,
                        ),
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    // Accent colour swatches
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.circle_outlined,
                                  size: 20,
                                  color:
                                      tokens.onSurface.withValues(alpha: 0.55)),
                              const SizedBox(width: 12),
                              Text(
                                'Accent colour',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyMedium
                                    ?.copyWith(
                                      fontWeight: FontWeight.w500,
                                    ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: AccentPreset.values.map((preset) {
                              final isActive = state.accentPreset == preset;
                              final color = Color(preset.argbValue);
                              return GestureDetector(
                                onTap: () => state.setAccentPreset(preset),
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 200),
                                  width: 36,
                                  height: 36,
                                  margin: const EdgeInsets.only(right: 10),
                                  decoration: BoxDecoration(
                                    color: color,
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: isActive
                                          ? tokens.onSurface
                                          : Colors.transparent,
                                      width: 2.5,
                                    ),
                                    boxShadow: isActive
                                        ? [
                                            BoxShadow(
                                              color:
                                                  color.withValues(alpha: 0.55),
                                              blurRadius: 8,
                                              spreadRadius: 1,
                                            )
                                          ]
                                        : null,
                                  ),
                                  child: isActive
                                      ? const Icon(Icons.check_rounded,
                                          size: 18, color: Colors.white)
                                      : null,
                                ),
                              );
                            }).toList(),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.animation_outlined,
                      title: 'Motion',
                      subtitle:
                          reduceMotion ? 'System reduced motion on' : null,
                      trailing: DropdownButton<MotionLevel>(
                        value: state.motionLevel,
                        underline: const SizedBox.shrink(),
                        isDense: true,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: tokens.primary,
                              fontWeight: FontWeight.w600,
                            ),
                        items: MotionLevel.values
                            .map((m) => DropdownMenuItem(
                                value: m, child: Text(m.label)))
                            .toList(),
                        onChanged: (v) {
                          if (v != null) state.setMotionLevel(v);
                        },
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.auto_awesome_rounded,
                      title: 'Sven\'s form',
                      subtitle:
                          '${state.avatarMode.icon}\u2002${state.avatarMode.entityName}\u2002·\u2002${state.avatarMode.label}',
                      trailing: Icon(Icons.chevron_right_rounded,
                          color: tokens.onSurface.withValues(alpha: 0.45)),
                      onTap: () {
                        showModalBottomSheet<void>(
                          context: context,
                          isScrollControlled: true,
                          backgroundColor: Colors.transparent,
                          builder: (_) => DraggableScrollableSheet(
                            initialChildSize: 0.92,
                            minChildSize: 0.5,
                            maxChildSize: 0.95,
                            builder: (ctx, ctrl) => ClipRRect(
                              borderRadius: const BorderRadius.vertical(
                                  top: Radius.circular(28)),
                              child: SvenEntityPage(
                                currentMode: state.avatarMode,
                                onChanged: state.setAvatarMode,
                                visualMode: state.effectiveVisualMode,
                                motionLevel: state.effectiveMotionLevel,
                                personality: state.voicePersonality,
                              ),
                            ),
                          ),
                        );
                      },
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.short_text_rounded,
                      title: 'Response length',
                      subtitle: state.responseLength.description,
                      trailing: DropdownButton<ResponseLength>(
                        value: state.responseLength,
                        underline: const SizedBox.shrink(),
                        isDense: true,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: tokens.primary,
                              fontWeight: FontWeight.w600,
                            ),
                        items: ResponseLength.values
                            .map((r) => DropdownMenuItem(
                                value: r, child: Text(r.label)))
                            .toList(),
                        onChanged: (v) {
                          if (v != null) state.setResponseLength(v);
                        },
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.contrast_rounded,
                      title: 'High contrast',
                      subtitle: 'Maximise text-to-background contrast',
                      trailing: Switch(
                        value: state.highContrast,
                        activeColor: tokens.primary,
                        onChanged: state.setHighContrast,
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.palette_outlined,
                      title: 'Colour-blind mode',
                      subtitle: 'Blue/orange palette — safe for red-green CVD',
                      trailing: Switch(
                        value: state.colorBlindMode,
                        activeColor: tokens.primary,
                        onChanged: state.setColorBlindMode,
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.blur_off_rounded,
                      title: 'Reduce transparency',
                      subtitle: 'Replace frosted glass with solid backgrounds',
                      trailing: Switch(
                        value: state.reduceTransparency,
                        activeColor: tokens.primary,
                        onChanged: state.setReduceTransparency,
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.text_fields_rounded,
                      title: 'Text size',
                      subtitle: '${(state.textScale * 100).round()}%',
                      trailing: SizedBox(
                        width: 140,
                        child: Slider(
                          value: state.textScale,
                          min: 0.8,
                          max: 1.5,
                          divisions: 7,
                          activeColor: tokens.primary,
                          label: '${(state.textScale * 100).round()}%',
                          onChanged: (v) => state.setTextScale(v),
                        ),
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 24),

                    // ── API Keys ──
                    _SectionLabel(text: 'API Keys', tokens: tokens),
                    const SizedBox(height: 12),
                    _UserApiKeyModeTile(
                      client: client,
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 24),

                    // ── Navigation ──
                    _SectionLabel(text: 'More', tokens: tokens),
                    const SizedBox(height: 12),
                    if (memoryService != null) ...[
                      _SettingsTile(
                        icon: Icons.psychology_outlined,
                        title: 'Memory & Instructions',
                        subtitle: 'Personalise Sven\'s responses',
                        trailing: Icon(
                          Icons.chevron_right_rounded,
                          color: tokens.onSurface.withValues(alpha: 0.3),
                          size: 20,
                        ),
                        onTap: () {
                          Navigator.of(context).pop();
                          Navigator.of(context).push(
                            SvenPageRoute<void>(
                              builder: (_) => MemoryPage(
                                visualMode: state.visualMode,
                              ),
                            ),
                          );
                        },
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                      const SizedBox(height: 8),
                    ],
                    // ── Projects ──
                    if (projectService != null) ...[
                      _SettingsTile(
                        icon: Icons.folder_special_rounded,
                        title: 'Project Spaces',
                        subtitle: 'Group conversations by project',
                        trailing: Icon(
                          Icons.chevron_right_rounded,
                          color: tokens.onSurface.withValues(alpha: 0.3),
                          size: 20,
                        ),
                        onTap: () {
                          Navigator.of(context).pop();
                          showModalBottomSheet<void>(
                            context: context,
                            isScrollControlled: true,
                            useSafeArea: true,
                            builder: (_) => ProjectsSheet(
                              service: projectService!,
                              visualMode: state.visualMode,
                            ),
                          );
                        },
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                      const SizedBox(height: 8),
                    ],
                    _SettingsTile(
                      icon: Icons.check_circle_outline_rounded,
                      title: 'Approvals',
                      trailing: Icon(
                        Icons.chevron_right_rounded,
                        color: tokens.onSurface.withValues(alpha: 0.3),
                        size: 20,
                      ),
                      onTap: () {
                        Navigator.of(context).pop();
                        Navigator.of(context).push(
                          SvenPageRoute<void>(
                            builder: (_) => ApprovalsPage(client: client),
                          ),
                        );
                      },
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.notifications_outlined,
                      title: 'Notifications',
                      trailing: Icon(
                        Icons.chevron_right_rounded,
                        color: tokens.onSurface.withValues(alpha: 0.3),
                        size: 20,
                      ),
                      onTap: () {
                        Navigator.of(context).pop();
                        Navigator.of(context).push(
                          SvenPageRoute<void>(
                            builder: (_) => const NotificationsPage(),
                          ),
                        );
                      },
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.do_not_disturb_rounded,
                      title: 'Do Not Disturb',
                      subtitle: state.dndEnabled
                          ? 'On · ${state.dndScheduleLabel}'
                          : 'Off',
                      trailing: Switch.adaptive(
                        value: state.dndEnabled,
                        activeColor: tokens.primary,
                        onChanged: (v) => state.setDndEnabled(v),
                      ),
                      onTap: () async {
                        if (!state.dndEnabled) {
                          await state.setDndEnabled(true);
                          return;
                        }
                        // Show time picker for DND window
                        if (!context.mounted) return;
                        final startTime = await showTimePicker(
                          context: context,
                          initialTime: TimeOfDay(
                            hour: state.dndStartHour,
                            minute: state.dndStartMinute,
                          ),
                          helpText: 'DND starts at',
                        );
                        if (startTime == null || !context.mounted) return;
                        final endTime = await showTimePicker(
                          context: context,
                          initialTime: TimeOfDay(
                            hour: state.dndEndHour,
                            minute: state.dndEndMinute,
                          ),
                          helpText: 'DND ends at',
                        );
                        if (endTime == null) return;
                        await state.setDndSchedule(
                          startHour: startTime.hour,
                          startMinute: startTime.minute,
                          endHour: endTime.hour,
                          endMinute: endTime.minute,
                        );
                      },
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.volume_up_rounded,
                      title: 'Notification sound',
                      subtitle: state.notifSound == 'silent'
                          ? 'Silent'
                          : state.notifSound == 'subtle'
                              ? 'Subtle'
                              : 'Default',
                      trailing: DropdownButton<String>(
                        value: state.notifSound,
                        underline: const SizedBox.shrink(),
                        isDense: true,
                        items: const [
                          DropdownMenuItem(
                              value: 'default', child: Text('Default')),
                          DropdownMenuItem(
                              value: 'subtle', child: Text('Subtle')),
                          DropdownMenuItem(
                              value: 'silent', child: Text('Silent')),
                        ],
                        onChanged: (v) {
                          if (v != null) state.setNotifSound(v);
                        },
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    if (deviceService != null) ...[
                      const SizedBox(height: 8),
                      _SettingsTile(
                        icon: Icons.devices_other_rounded,
                        title: 'Devices',
                        subtitle: 'Mirrors, kiosks & sensors',
                        trailing: Icon(
                          Icons.chevron_right_rounded,
                          color: tokens.onSurface.withValues(alpha: 0.3),
                          size: 20,
                        ),
                        onTap: () {
                          Navigator.of(context).pop();
                          Navigator.of(context).push(
                            SvenPageRoute<void>(
                              builder: (_) => DeviceManagerPage(
                                deviceService: deviceService!,
                                visualMode: state.visualMode,
                              ),
                            ),
                          );
                        },
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                    ],
                    if (lockService != null) ...[
                      const SizedBox(height: 8),
                      _SettingsTile(
                        icon: Icons.lock_outline_rounded,
                        title: 'App Lock',
                        subtitle: lockService!.lockEnabled
                            ? 'On · ${lockService!.timeout.label}'
                            : 'Off',
                        trailing: Icon(
                          Icons.chevron_right_rounded,
                          color: tokens.onSurface.withValues(alpha: 0.3),
                          size: 20,
                        ),
                        onTap: () {
                          Navigator.of(context).pop();
                          Navigator.of(context).push(
                            SvenPageRoute<void>(
                              builder: (_) => _AppLockSettingsPage(
                                lockService: lockService!,
                                visualMode: state.visualMode,
                              ),
                            ),
                          );
                        },
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                    ],
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.privacy_tip_outlined,
                      title: 'Privacy & Data',
                      subtitle: 'Analytics consent, legal, data management',
                      trailing: Icon(
                        Icons.chevron_right_rounded,
                        color: tokens.onSurface.withValues(alpha: 0.3),
                        size: 20,
                      ),
                      onTap: () {
                        Navigator.of(context).pop();
                        Navigator.of(context).push(
                          SvenPageRoute<void>(
                            builder: (_) => PrivacyPage(
                              state: state,
                              visualMode: state.visualMode,
                              onClearData: () => onLogout(),
                              memoryService: memoryService,
                              authService: authService,
                            ),
                          ),
                        );
                      },
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 32),

                    // ── Server ──
                    _SectionLabel(text: 'Server', tokens: tokens),
                    const SizedBox(height: 12),
                    _ServerTile(
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 32),

                    // ── Account ──
                    _SectionLabel(text: 'Account', tokens: tokens),
                    const SizedBox(height: 12),

                    // User identity card
                    Container(
                      padding: const EdgeInsets.all(14),
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: cinematic
                            ? tokens.primary.withValues(alpha: 0.08)
                            : tokens.primary.withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: tokens.primary.withValues(alpha: 0.12),
                        ),
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 20,
                            backgroundColor:
                                tokens.primary.withValues(alpha: 0.15),
                            child: Text(
                              (state.username ?? '?')
                                  .substring(0, 1)
                                  .toUpperCase(),
                              style: TextStyle(
                                color: tokens.primary,
                                fontWeight: FontWeight.w700,
                                fontSize: 16,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  state.username ?? 'User',
                                  style: TextStyle(
                                    color: tokens.onSurface,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 15,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  state.deploymentMode ==
                                          DeploymentMode.personal
                                      ? 'Personal mode'
                                      : 'Multi-user mode',
                                  style: TextStyle(
                                    color:
                                        tokens.onSurface.withValues(alpha: 0.5),
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    // ── Change password ──
                    _SettingsTile(
                      icon: Icons.lock_reset_rounded,
                      title: 'Change password',
                      subtitle: 'Update your login password',
                      onTap: authService == null
                          ? null
                          : () {
                              Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => _ChangePasswordPage(
                                    authService: authService!,
                                    visualMode: state.visualMode,
                                  ),
                                ),
                              );
                            },
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),

                    // ── Two-factor authentication ──
                    _SettingsTile(
                      icon: Icons.shield_outlined,
                      title: 'Two-factor authentication',
                      subtitle: 'Manage 2FA for your account',
                      trailing: Icon(
                        Icons.chevron_right_rounded,
                        color: tokens.onSurface.withValues(alpha: 0.3),
                        size: 20,
                      ),
                      onTap: authService == null
                          ? null
                          : () => MfaSetupSheet.show(context, authService!),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),

                    // Sign out options (hidden in personal mode — auto-login handles it)
                    if (state.deploymentMode != DeploymentMode.personal) ...[
                      // ── Multi-account quick switch ──
                      if (authService != null) ...[
                        _SettingsTile(
                          icon: Icons.people_outlined,
                          title: 'Switch account',
                          subtitle: 'Switch between saved accounts',
                          trailing: Icon(
                            Icons.chevron_right_rounded,
                            color: tokens.onSurface.withValues(alpha: 0.3),
                            size: 20,
                          ),
                          onTap: () {
                            Navigator.of(context).pop();
                            showModalBottomSheet(
                              context: context,
                              isScrollControlled: true,
                              backgroundColor: Colors.transparent,
                              builder: (_) => AccountPickerSheet(
                                auth: authService!,
                                lockService: lockService ?? AppLockService(),
                                visualMode: state.visualMode,
                                onAccountSwitched: (result) {
                                  // The calling page should handle re-login
                                  // via its onLogout or state management
                                },
                                onAddAccount: () async {
                                  await onLogout();
                                },
                              ),
                            );
                          },
                          tokens: tokens,
                          cinematic: cinematic,
                        ),
                        const SizedBox(height: 8),
                        _SettingsTile(
                          icon: Icons.bookmark_add_outlined,
                          title: 'Keep me signed in',
                          subtitle: 'Save this account for quick switching',
                          onTap: () async {
                            final pin = await _showSetPinDialog(context, tokens);
                            if (context.mounted) {
                              try {
                                await authService!.linkCurrentAccount(
                                  pin: pin,
                                );
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        'Account saved${pin != null ? ' with PIN protection' : ''}',
                                      ),
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                  Navigator.of(context).pop();
                                }
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('Failed: $e'),
                                      behavior: SnackBarBehavior.floating,
                                      backgroundColor: Colors.red,
                                    ),
                                  );
                                }
                              }
                            }
                          },
                          tokens: tokens,
                          cinematic: cinematic,
                        ),
                        const SizedBox(height: 8),
                      ],
                      _SettingsTile(
                        icon: Icons.logout_rounded,
                        title: 'Sign out',
                        onTap: () async {
                          Navigator.of(context).pop();
                          await onLogout();
                        },
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                      const SizedBox(height: 8),
                      _SettingsTile(
                        icon: Icons.devices_rounded,
                        title: 'Sign out all devices',
                        subtitle: 'Ends all active sessions',
                        onTap: () async {
                          Navigator.of(context).pop();
                          await onLogoutAll();
                        },
                        tokens: tokens,
                        cinematic: cinematic,
                        destructive: true,
                      ),
                    ],

                    // ── Developer (debug builds only) ──────────────────────
                    if (kDebugMode) ...[
                      const SizedBox(height: 32),
                      _SectionLabel(text: 'Developer', tokens: tokens),
                      const SizedBox(height: 12),
                      _SettingsTile(
                        icon: Icons.science_rounded,
                        title: 'A/B Test Overrides',
                        subtitle: 'QA: override experiment variant assignments',
                        trailing: Icon(
                          Icons.chevron_right_rounded,
                          color: tokens.onSurface.withValues(alpha: 0.4),
                        ),
                        onTap: () {
                          Navigator.of(context).pop();
                          Navigator.of(context).push(
                            SvenPageRoute<void>(
                              builder: (_) => AbTestOverridePage(
                                service: sl<AbTestService>(),
                                visualMode: state.visualMode,
                              ),
                            ),
                          );
                        },
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                    ],
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Change-password page
// ═══════════════════════════════════════════════════════════════════════════

class _ChangePasswordPage extends StatefulWidget {
  const _ChangePasswordPage({
    required this.authService,
    required this.visualMode,
  });

  final AuthService authService;
  final VisualMode visualMode;

  @override
  State<_ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends State<_ChangePasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _currentCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _currentCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final err = await widget.authService.changePassword(
      currentPassword: _currentCtrl.text,
      newPassword: _newCtrl.text,
    );
    if (!mounted) return;
    setState(() => _saving = false);
    if (err != null) {
      setState(() => _error = err);
    } else {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Password changed successfully'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;

    return Scaffold(
      backgroundColor: cinematic ? tokens.scaffold : tokens.scaffold,
      appBar: _svenAppBar(
        context,
        'Change Password',
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded, color: tokens.onSurface),
          onPressed: () => Navigator.of(context).pop(),
        ),
        backgroundColor: cinematic ? tokens.card : tokens.surface,
        foregroundColor: tokens.onSurface,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 20),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Theme.of(context)
                          .colorScheme
                          .error
                          .withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: Theme.of(context)
                              .colorScheme
                              .error
                              .withValues(alpha: 0.4)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline,
                            size: 18,
                            color: Theme.of(context).colorScheme.error),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _error!,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                _PwField(
                  label: 'Current password',
                  controller: _currentCtrl,
                  obscure: _obscureCurrent,
                  onToggle: () =>
                      setState(() => _obscureCurrent = !_obscureCurrent),
                  tokens: tokens,
                  cinematic: cinematic,
                  validator: (v) =>
                      (v == null || v.isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 16),
                _PwField(
                  label: 'New password',
                  controller: _newCtrl,
                  obscure: _obscureNew,
                  onToggle: () => setState(() => _obscureNew = !_obscureNew),
                  tokens: tokens,
                  cinematic: cinematic,
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Required';
                    if (v.length < 8) return 'Minimum 8 characters';
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                _PwField(
                  label: 'Confirm new password',
                  controller: _confirmCtrl,
                  obscure: _obscureConfirm,
                  onToggle: () =>
                      setState(() => _obscureConfirm = !_obscureConfirm),
                  tokens: tokens,
                  cinematic: cinematic,
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Required';
                    if (v != _newCtrl.text) return 'Passwords do not match';
                    return null;
                  },
                ),
                const SizedBox(height: 32),
                FilledButton(
                  onPressed: _saving ? null : _submit,
                  style: FilledButton.styleFrom(
                    backgroundColor: tokens.primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Update password',
                          style: TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Small helper: password text field with show/hide toggle
class _PwField extends StatelessWidget {
  const _PwField({
    required this.label,
    required this.controller,
    required this.obscure,
    required this.onToggle,
    required this.tokens,
    required this.cinematic,
    this.validator,
  });

  final String label;
  final TextEditingController controller;
  final bool obscure;
  final VoidCallback onToggle;
  final SvenModeTokens tokens;
  final bool cinematic;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: obscure,
      validator: validator,
      autovalidateMode: AutovalidateMode.onUserInteraction,
      style: TextStyle(color: tokens.onSurface, fontSize: 15),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: tokens.onSurface.withValues(alpha: 0.55)),
        filled: true,
        fillColor:
            cinematic ? tokens.card : tokens.onSurface.withValues(alpha: 0.04),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: tokens.primary.withValues(alpha: 0.6)),
        ),
        suffixIcon: IconButton(
          icon: Icon(
            obscure ? Icons.visibility_off_rounded : Icons.visibility_rounded,
            size: 20,
            color: tokens.onSurface.withValues(alpha: 0.45),
          ),
          onPressed: onToggle,
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// App Lock settings page
// ═══════════════════════════════════════════════════════════════════════════

class _AppLockSettingsPage extends StatefulWidget {
  const _AppLockSettingsPage({
    required this.lockService,
    required this.visualMode,
  });

  final AppLockService lockService;
  final VisualMode visualMode;

  @override
  State<_AppLockSettingsPage> createState() => _AppLockSettingsPageState();
}

class _AppLockSettingsPageState extends State<_AppLockSettingsPage> {
  @override
  void initState() {
    super.initState();
    widget.lockService.addListener(_rebuild);
  }

  @override
  void dispose() {
    widget.lockService.removeListener(_rebuild);
    super.dispose();
  }

  void _rebuild() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;
    final lock = widget.lockService;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: _svenAppBar(
        context,
        'App Lock',
        backgroundColor: Colors.transparent,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          // Enable toggle
          _SettingsTile(
            icon: Icons.lock_outline_rounded,
            title: 'Enable App Lock',
            subtitle: 'Require biometric or PIN when resuming',
            trailing: Switch(
              value: lock.lockEnabled,
              activeColor: tokens.primary,
              onChanged: (v) => lock.setLockEnabled(v),
            ),
            tokens: tokens,
            cinematic: cinematic,
          ),
          if (lock.lockEnabled) ...[
            const SizedBox(height: 8),
            // Timeout picker
            _SettingsTile(
              icon: Icons.timer_outlined,
              title: 'Lock after',
              trailing: DropdownButton<AutoLockTimeout>(
                value: lock.timeout,
                underline: const SizedBox.shrink(),
                isDense: true,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: tokens.primary,
                      fontWeight: FontWeight.w600,
                    ),
                items: AutoLockTimeout.values
                    .map(
                        (t) => DropdownMenuItem(value: t, child: Text(t.label)))
                    .toList(),
                onChanged: (v) {
                  if (v != null) lock.setTimeout(v);
                },
              ),
              tokens: tokens,
              cinematic: cinematic,
            ),
            const SizedBox(height: 16),
            // Lock now button
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  lock.lockNow();
                  Navigator.of(context).pop();
                },
                icon: const Icon(Icons.lock_rounded, size: 18),
                label: const Text('Lock now'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: tokens.primary,
                  side:
                      BorderSide(color: tokens.primary.withValues(alpha: 0.4)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _UserApiKeyModeTile extends StatefulWidget {
  const _UserApiKeyModeTile({
    required this.client,
    required this.tokens,
    required this.cinematic,
  });

  final AuthenticatedClient client;
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  State<_UserApiKeyModeTile> createState() => _UserApiKeyModeTileState();
}

class _UserApiKeyModeTileState extends State<_UserApiKeyModeTile> {
  late final UserSettingsService _service;
  bool _loading = true;
  bool _saving = false;
  bool _allowPersonalOverride = true;
  bool _personalMode = false;
  int _configuredCount = 0;
  List<String> _allowedKeys = const [];

  @override
  void initState() {
    super.initState();
    _service = UserSettingsService(client: widget.client);
    _load();
  }

  Future<void> _load() async {
    try {
      final snapshot = await _service.fetchAll();
      if (!mounted) return;
      setState(() {
        _loading = false;
        _allowPersonalOverride = snapshot?.allowPersonalOverride ?? true;
        _personalMode = (snapshot?.mode ?? 'org_default') == 'personal';
        _allowedKeys = snapshot?.allowedKeys ?? const [];
        _configuredCount = snapshot?.rows.length ?? 0;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
      });
    }
  }

  Future<void> _setMode(bool personal) async {
    if (_saving) return;
    setState(() {
      _saving = true;
      _personalMode = personal;
    });
    final ok = await _service.setValue(
      'keys.mode',
      personal ? 'personal' : 'org_default',
    );
    if (!mounted) return;
    setState(() {
      _saving = false;
      if (!ok) {
        _personalMode = !personal;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final subtitle = _loading
        ? 'Loading key mode…'
        : !_allowPersonalOverride
            ? 'Disabled by admin policy'
            : _personalMode
                ? 'Using your personal API key refs'
                : 'Using organization default API key refs';

    return Column(
      children: [
        _SettingsTile(
          icon: Icons.vpn_key_rounded,
          title: 'Use personal API keys',
          subtitle: subtitle,
          trailing: Switch.adaptive(
            value: _personalMode,
            onChanged: (!_allowPersonalOverride || _loading || _saving)
                ? null
                : _setMode,
            activeColor: widget.tokens.primary,
          ),
          tokens: widget.tokens,
          cinematic: widget.cinematic,
        ),
        const SizedBox(height: 8),
        _SettingsTile(
          icon: Icons.settings_outlined,
          title: 'Manage personal key refs',
          subtitle: _loading
              ? 'Loading…'
              : 'Configured $_configuredCount / ${_allowedKeys.length} keys',
          trailing: Icon(
            Icons.chevron_right_rounded,
            color: widget.tokens.onSurface.withValues(alpha: 0.35),
            size: 20,
          ),
          onTap: _loading || !_allowPersonalOverride
              ? null
              : () async {
                  await Navigator.of(context).push(
                    SvenPageRoute<void>(
                      builder: (_) => _UserKeyRefsPage(
                        service: _service,
                        tokens: widget.tokens,
                        cinematic: widget.cinematic,
                      ),
                    ),
                  );
                  await _load();
                },
          tokens: widget.tokens,
          cinematic: widget.cinematic,
        ),
      ],
    );
  }
}

class _UserKeyRefsPage extends StatefulWidget {
  const _UserKeyRefsPage({
    required this.service,
    required this.tokens,
    required this.cinematic,
  });

  final UserSettingsService service;
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  State<_UserKeyRefsPage> createState() => _UserKeyRefsPageState();
}

class _UserKeyRefsPageState extends State<_UserKeyRefsPage> {
  bool _loading = true;
  bool _saving = false;
  List<String> _allowedKeys = const [];
  final Map<String, TextEditingController> _controllers = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    final snapshot = await widget.service.fetchAll();
    final rows = <String, dynamic>{};
    for (final row in snapshot?.rows ?? const <UserScopedSettingRow>[]) {
      rows[row.key] = row.value;
    }
    if (!mounted) return;
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    _controllers.clear();
    final keys = snapshot?.allowedKeys ?? const <String>[];
    for (final key in keys) {
      final value = rows[key];
      _controllers[key] = TextEditingController(text: value?.toString() ?? '');
    }
    setState(() {
      _allowedKeys = keys;
      _loading = false;
    });
  }

  Future<void> _save(String key) async {
    final value = _controllers[key]?.text.trim() ?? '';
    setState(() => _saving = true);
    final ok = value.isEmpty
        ? await widget.service.clearValue(key)
        : await widget.service.setValue(key, value);
    if (!mounted) return;
    setState(() => _saving = false);
    final snackBar = SnackBar(content: Text(ok ? 'Saved $key' : 'Failed to save $key'));
    ScaffoldMessenger.of(context).showSnackBar(snackBar);
  }

  @override
  Widget build(BuildContext context) {
    final tk = widget.tokens;
    return Scaffold(
      backgroundColor: tk.scaffold,
      appBar: _svenAppBar(context, 'Personal Key Refs'),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: _allowedKeys.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final key = _allowedKeys[index];
                final controller = _controllers[key]!;
                return Material(
                  color: widget.cinematic
                      ? Colors.white.withValues(alpha: 0.03)
                      : Colors.black.withValues(alpha: 0.02),
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          key,
                          style: TextStyle(
                            color: tk.onSurface,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: controller,
                          style: TextStyle(color: tk.onSurface, fontSize: 13),
                          decoration: InputDecoration(
                            hintText: 'env://MY_PERSONAL_KEY',
                            hintStyle: TextStyle(
                              color: tk.onSurface.withValues(alpha: 0.35),
                              fontSize: 12,
                            ),
                            filled: true,
                            fillColor: tk.surface.withValues(alpha: 0.35),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: BorderSide.none,
                            ),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            TextButton(
                              onPressed: _saving ? null : () => _save(key),
                              child: const Text('Save'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}

// ── Server picker tile ──

class _ServerTile extends StatefulWidget {
  const _ServerTile({required this.tokens, required this.cinematic});

  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  State<_ServerTile> createState() => _ServerTileState();
}

class _ServerTileState extends State<_ServerTile> {
  late String _currentServer;
  bool _editing = false;
  bool _discovering = false;
  String? _error;
  ServerDiscoveryResult? _result;
  final _controller = TextEditingController();

  @override
  void initState() {
    super.initState();
    _currentServer = ApiBaseService.currentSync();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _discover() async {
    final input = _controller.text.trim();
    if (input.isEmpty) return;
    setState(() {
      _discovering = true;
      _error = null;
      _result = null;
    });
    try {
      final result = await ServerDiscoveryService.discover(input);
      final url = await ServerDiscoveryService.applyServer(result);
      if (mounted) {
        setState(() {
          _result = result;
          _currentServer = url;
          _editing = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Connected to ${result.instanceName ?? Uri.tryParse(url)?.host ?? url}',
            ),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = e is StateError ? e.message : e.toString());
      }
    } finally {
      if (mounted) setState(() => _discovering = false);
    }
  }

  Future<void> _reset() async {
    await ServerDiscoveryService.resetToDefault();
    if (mounted) {
      setState(() {
        _currentServer = ApiBaseService.currentSync();
        _editing = false;
        _error = null;
        _result = null;
        _controller.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Reset to default server'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = widget.tokens;
    final cinematic = widget.cinematic;
    final serverHost = Uri.tryParse(_currentServer)?.host ?? _currentServer;

    if (!_editing) {
      return _SettingsTile(
        icon: Icons.dns_outlined,
        title: serverHost,
        subtitle: 'Tap to switch Sven server',
        trailing: Icon(
          Icons.chevron_right_rounded,
          color: tokens.onSurface.withValues(alpha: 0.3),
          size: 20,
        ),
        onTap: () => setState(() => _editing = true),
        tokens: tokens,
        cinematic: cinematic,
      );
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cinematic
            ? tokens.primary.withValues(alpha: 0.06)
            : tokens.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: tokens.primary.withValues(alpha: 0.12),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Connect to a Sven server',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            'Enter a domain or URL. Auto-discovery will find the gateway.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: tokens.onSurface.withValues(alpha: 0.5),
                ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  textInputAction: TextInputAction.go,
                  onSubmitted: (_) => _discover(),
                  autocorrect: false,
                  keyboardType: TextInputType.url,
                  style: TextStyle(
                    color: tokens.onSurface,
                    fontSize: 14,
                  ),
                  decoration: InputDecoration(
                    hintText: 'sven.systems',
                    hintStyle: TextStyle(
                      color: tokens.onSurface.withValues(alpha: 0.3),
                      fontSize: 14,
                    ),
                    prefixIcon: Icon(
                      Icons.language_rounded,
                      size: 18,
                      color: tokens.onSurface.withValues(alpha: 0.35),
                    ),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 12),
                    filled: true,
                    fillColor: tokens.onSurface.withValues(alpha: 0.04),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(
                        color: tokens.onSurface.withValues(alpha: 0.1),
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(
                        color: tokens.onSurface.withValues(alpha: 0.1),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(
                        color: tokens.primary.withValues(alpha: 0.5),
                        width: 1.5,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 42,
                child: FilledButton(
                  onPressed: _discovering ? null : _discover,
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: _discovering
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Connect'),
                ),
              ),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.error,
                  ),
            ),
          ],
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: () => setState(() {
                  _editing = false;
                  _error = null;
                }),
                child: const Text('Cancel'),
              ),
              TextButton.icon(
                onPressed: _reset,
                icon: const Icon(Icons.restore_rounded, size: 16),
                label: const Text('Reset to default'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.text, required this.tokens});
  final String text;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: TextStyle(
        color: tokens.onSurface.withValues(alpha: 0.35),
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.2,
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
    required this.tokens,
    required this.cinematic,
    this.destructive = false,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final SvenModeTokens tokens;
  final bool cinematic;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final color =
        destructive ? Theme.of(context).colorScheme.error : tokens.onSurface;

    return Material(
      color: cinematic
          ? Colors.white.withValues(alpha: 0.03)
          : Colors.black.withValues(alpha: 0.02),
      borderRadius: BorderRadius.circular(12),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Icon(icon, size: 20, color: color.withValues(alpha: 0.5)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: color,
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    if (subtitle != null)
                      Text(
                        subtitle!,
                        style: TextStyle(
                          color: color.withValues(alpha: 0.45),
                          fontSize: 12,
                        ),
                      ),
                  ],
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
        ),
      ),
    );
  }
}

class _SegmentedPill extends StatelessWidget {
  const _SegmentedPill({
    required this.value,
    required this.labelTrue,
    required this.labelFalse,
    required this.tokens,
    required this.cinematic,
    required this.onChanged,
  });

  final bool value;
  final String labelTrue;
  final String labelFalse;
  final SvenModeTokens tokens;
  final bool cinematic;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: cinematic
            ? Colors.white.withValues(alpha: 0.06)
            : Colors.black.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _segButton(labelTrue, value, () => onChanged(true)),
          _segButton(labelFalse, !value, () => onChanged(false)),
        ],
      ),
    );
  }

  Widget _segButton(String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? tokens.primary.withValues(alpha: 0.15) : null,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active
                ? tokens.primary
                : tokens.onSurface.withValues(alpha: 0.4),
            fontSize: 12,
            fontWeight: active ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ),
    );
  }
}

class _PersonalityOverrideTile extends StatefulWidget {
  const _PersonalityOverrideTile({
    required this.memoryService,
    required this.tokens,
    required this.cinematic,
  });

  final MemoryService memoryService;
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  State<_PersonalityOverrideTile> createState() =>
      _PersonalityOverrideTileState();
}

class _PersonalityOverrideTileState extends State<_PersonalityOverrideTile> {
  late final TextEditingController _ctrl;
  bool _editing = false;

  @override
  void initState() {
    super.initState();
    _ctrl =
        TextEditingController(text: widget.memoryService.personalityOverride);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _save() {
    widget.memoryService.setPersonalityOverride(_ctrl.text);
    setState(() => _editing = false);
  }

  @override
  Widget build(BuildContext context) {
    final tk = widget.tokens;

    return Material(
      color: widget.cinematic
          ? Colors.white.withValues(alpha: 0.03)
          : Colors.black.withValues(alpha: 0.02),
      borderRadius: BorderRadius.circular(12),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.edit_note_rounded,
                    size: 20, color: tk.onSurface.withValues(alpha: 0.5)),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Personality notes',
                    style: TextStyle(
                      color: tk.onSurface,
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    if (_editing) {
                      _save();
                    } else {
                      setState(() => _editing = true);
                    }
                  },
                  child: Text(
                    _editing ? 'Save' : 'Edit',
                    style: TextStyle(
                      color: tk.primary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_editing)
              TextField(
                controller: _ctrl,
                maxLines: 3,
                minLines: 2,
                maxLength: 300,
                style: TextStyle(color: tk.onSurface, fontSize: 13),
                decoration: InputDecoration(
                  hintText:
                      'e.g. "Always use metric units" or "Be extra concise"',
                  hintStyle: TextStyle(
                    color: tk.onSurface.withValues(alpha: 0.3),
                    fontSize: 12,
                  ),
                  filled: true,
                  fillColor: tk.surface.withValues(alpha: 0.4),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                ),
                onSubmitted: (_) => _save(),
              )
            else
              Text(
                widget.memoryService.personalityOverride.isEmpty
                    ? 'No custom personality notes set.'
                    : widget.memoryService.personalityOverride,
                style: TextStyle(
                  color: tk.onSurface.withValues(alpha: 0.45),
                  fontSize: 12,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Language preference tile
// ═══════════════════════════════════════════════════════════════════════════

class _LanguageTile extends StatelessWidget {
  const _LanguageTile({
    required this.memoryService,
    required this.tokens,
    required this.cinematic,
  });

  final MemoryService memoryService;
  final SvenModeTokens tokens;
  final bool cinematic;

  static const _languages = [
    'auto',
    'English',
    'Spanish',
    'French',
    'German',
    'Italian',
    'Portuguese',
    'Dutch',
    'Russian',
    'Japanese',
    'Chinese',
    'Korean',
    'Arabic',
  ];

  String _label(String lang) => lang == 'auto' ? 'Auto-detect' : lang;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: memoryService,
      builder: (_, __) {
        final current = memoryService.preferredLanguage;
        final detected = memoryService.detectedLanguage;
        return _SettingsTile(
          icon: Icons.translate_rounded,
          title: 'Response language',
          subtitle: current == 'auto'
              ? detected.isEmpty
                  ? 'Auto-detect'
                  : 'Auto-detect (detected: $detected)'
              : current,
          trailing: DropdownButton<String>(
            value: current,
            underline: const SizedBox.shrink(),
            isDense: true,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: tokens.primary,
                  fontWeight: FontWeight.w600,
                ),
            items: _languages
                .map(
                  (l) => DropdownMenuItem(
                    value: l,
                    child: Text(_label(l)),
                  ),
                )
                .toList(),
            onChanged: (v) {
              if (v != null) memoryService.setPreferredLanguage(v);
            },
          ),
          tokens: tokens,
          cinematic: cinematic,
        );
      },
    );
  }
}

/// Platform-adaptive app bar: [CupertinoNavigationBar] on iOS, [AppBar] elsewhere.
///
/// The return type is [PreferredSizeWidget] so it can be passed directly to
/// [Scaffold.appBar].
PreferredSizeWidget _svenAppBar(
  BuildContext context,
  String title, {
  Widget? leading,
  List<Widget>? actions,
  Color? backgroundColor,
  Color? foregroundColor,
}) {
  if (Platform.isIOS) {
    return CupertinoNavigationBar(
      middle: Text(title),
      leading: leading,
      trailing: actions != null && actions.isNotEmpty
          ? Row(mainAxisSize: MainAxisSize.min, children: actions)
          : null,
      backgroundColor: backgroundColor,
    );
  }
  return AppBar(
    leading: leading,
    title: Text(title),
    actions: actions,
    backgroundColor: backgroundColor,
    foregroundColor: foregroundColor,
  );
}

/// Prettify a TTS voice name for display.
/// Strips locale prefixes and hash suffixes to produce a readable label.
String _voiceDisplayName(String raw) {
  // e.g. "en-us-x-sfg#male_1-local" → "sfg male 1"
  var s = raw;
  // Remove locale prefix like "en-us-x-"
  final hashIdx = s.indexOf('#');
  if (hashIdx > 0) {
    s = s.substring(hashIdx + 1); // "male_1-local"
  } else {
    // Try stripping everything before the last dash-separated segment
    final parts = s.split('-');
    if (parts.length > 3) {
      s = parts.sublist(3).join('-');
    }
  }
  // Remove "-local" / "-network" suffix
  s = s.replaceAll('-local', '').replaceAll('-network', '');
  // Replace underscores with spaces
  s = s.replaceAll('_', ' ');
  // Capitalise first letter
  if (s.isNotEmpty) s = s[0].toUpperCase() + s.substring(1);
  return s.isEmpty ? raw : s;
}

/// Show a dialog to optionally set a PIN for the saved account.
/// Returns the PIN string if set, or null if skipped.
Future<String?> _showSetPinDialog(BuildContext context, SvenModeTokens tokens) async {
  final controller = TextEditingController();
  return showDialog<String?>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: tokens.surface,
      title: Text('Protect with PIN?', style: TextStyle(color: tokens.onSurface)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Set a 4-8 digit PIN to protect account switching. '
            'You can also use device biometrics (fingerprint/face) if App Lock is enabled.',
            style: TextStyle(
                color: tokens.onSurface.withValues(alpha: 0.6), fontSize: 13),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: controller,
            obscureText: true,
            keyboardType: TextInputType.number,
            maxLength: 8,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: InputDecoration(
              labelText: 'PIN (optional)',
              hintText: '4-8 digits',
              labelStyle: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.6)),
            ),
            style: TextStyle(
                color: tokens.onSurface, fontSize: 24, letterSpacing: 8),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, null),
          child: Text('Skip',
              style: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.6))),
        ),
        FilledButton(
          onPressed: () {
            final pin = controller.text;
            Navigator.pop(ctx, pin.length >= 4 ? pin : null);
          },
          child: const Text('Save'),
        ),
      ],
    ),
  );
}
