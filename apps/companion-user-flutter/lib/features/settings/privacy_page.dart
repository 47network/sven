import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app/app_models.dart';
import '../../app/app_state.dart';
import '../../app/sven_tokens.dart';
import '../auth/auth_service.dart';
import '../memory/memory_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// PrivacyPage — analytics consent, legal links, and clear-all-data
// ═══════════════════════════════════════════════════════════════════════════

class PrivacyPage extends StatelessWidget {
  const PrivacyPage({
    super.key,
    required this.state,
    required this.visualMode,
    this.onClearData,
    this.memoryService,
    this.authService,
  });

  final AppState state;
  final VisualMode visualMode;

  /// Optional memory service for exporting user data.
  final MemoryService? memoryService;

  /// Optional auth service for account deletion.
  final AuthService? authService;

  /// Called after the user confirms "Clear all data" so the app can navigate
  /// back to the login / onboarding flow.
  final VoidCallback? onClearData;

  static const _privacyUrl = 'https://app.sven.example.com/privacy';
  static const _tosUrl = 'https://app.sven.example.com/terms';

  Future<void> _exportData(BuildContext context) async {
    final ms = memoryService;
    final payload = <String, dynamic>{
      'exported_at': DateTime.now().toIso8601String(),
      'app_version': '0.1.0',
      'user_name': ms?.userName ?? '',
      'facts': ms?.facts
              .map((f) => {
                    'content': f.content,
                    'category': f.category.name,
                    'created_at': f.createdAt.toIso8601String(),
                  })
              .toList() ??
          [],
      'custom_instructions': {
        'user_context': ms?.instructions.userContext ?? '',
        'response_style': ms?.instructions.responseStyle ?? '',
      },
      'personality_override': ms?.personalityOverride ?? '',
      'detected_language': ms?.detectedLanguage ?? '',
      'conversation_summaries': ms?.conversationSummaries
              .map((s) => {
                    'title': s.title,
                    'summary': s.summary,
                    'updated_at': s.updatedAt.toIso8601String(),
                    'topic_keywords': s.topicKeywords,
                  })
              .toList() ??
          [],
      'preferences': {
        'visual_mode': state.visualMode.name,
        'motion_level': state.motionLevel.name,
        'response_length': state.responseLength.name,
        'high_contrast': state.highContrast,
        'color_blind_mode': state.colorBlindMode,
        'reduce_transparency': state.reduceTransparency,
        'text_scale': state.textScale,
        'voice_personality': state.voicePersonality.name,
        'notif_sound': state.notifSound,
        'dnd_enabled': state.dndEnabled,
      },
    };
    final json = const JsonEncoder.withIndent('  ').convert(payload);
    await Share.share(json, subject: 'Sven data export');
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _confirmClearData(BuildContext context) async {
    final tokens = SvenTokens.forMode(visualMode);
    final cinematic = visualMode == VisualMode.cinematic;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: cinematic ? tokens.card : tokens.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Clear all data?',
          style: TextStyle(color: tokens.onSurface),
        ),
        content: Text(
          'This will erase all local preferences and sign you out. '
          'Your conversation history on the server is not affected.',
          style: TextStyle(color: tokens.onSurface.withValues(alpha: 0.7)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(
              'Cancel',
              style: TextStyle(color: tokens.onSurface.withValues(alpha: 0.6)),
            ),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Clear', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    onClearData?.call();
  }

  /// GDPR right-to-erasure: double-confirm, then call DELETE /v1/users/me.
  Future<void> _confirmDeleteAccount(BuildContext context) async {
    final tokens = SvenTokens.forMode(visualMode);
    final cinematic = visualMode == VisualMode.cinematic;

    // First confirm
    final step1 = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: cinematic ? tokens.card : tokens.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Delete account?',
            style: TextStyle(color: Theme.of(ctx).colorScheme.error)),
        content: Text(
          'This permanently deletes your account and all associated data '
          'from our servers. This action cannot be undone.',
          style: TextStyle(color: tokens.onSurface.withValues(alpha: 0.7)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel',
                style:
                    TextStyle(color: tokens.onSurface.withValues(alpha: 0.6))),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(ctx).colorScheme.error),
            onPressed: () => Navigator.pop(ctx, true),
            child:
                const Text('Continue', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (step1 != true || !context.mounted) return;

    // Second confirm
    final step2 = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: cinematic ? tokens.card : tokens.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Are you absolutely sure?',
            style: TextStyle(color: Theme.of(ctx).colorScheme.error)),
        content: Text(
          'Your account, messages, memory, and all server-side data will be '
          'permanently erased. There is no recovery option.',
          style: TextStyle(color: tokens.onSurface.withValues(alpha: 0.7)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel',
                style:
                    TextStyle(color: tokens.onSurface.withValues(alpha: 0.6))),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(ctx).colorScheme.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete my account',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (step2 != true || !context.mounted) return;

    try {
      await authService?.deleteAccount();
    } catch (_) {
      // Even on error, clear locally and sign out.
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    onClearData?.call();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(visualMode);
    final cinematic = visualMode == VisualMode.cinematic;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        backgroundColor: cinematic ? tokens.card : tokens.surface,
        title: Text(
          'Privacy & Data',
          style: TextStyle(
            color: tokens.onSurface,
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
        ),
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded, color: tokens.onSurface),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        children: [
          // ── Analytics ──
          _SectionHead(text: 'Analytics', tokens: tokens),
          const SizedBox(height: 10),
          _PrivacyTile(
            icon: Icons.bar_chart_rounded,
            title: 'Usage analytics',
            subtitle: 'Helps improve Sven · no personal data shared',
            tokens: tokens,
            cinematic: cinematic,
            trailing: Switch(
              value: state.analyticsConsent,
              activeThumbColor: tokens.primary,
              onChanged: state.setAnalyticsConsent,
            ),
          ),

          const SizedBox(height: 24),
          // ── Legal ──
          _SectionHead(text: 'Legal', tokens: tokens),
          const SizedBox(height: 10),
          _PrivacyTile(
            icon: Icons.privacy_tip_outlined,
            title: 'Privacy Policy',
            subtitle: 'How we handle your data',
            tokens: tokens,
            cinematic: cinematic,
            trailing: Icon(
              Icons.open_in_new_rounded,
              size: 16,
              color: tokens.onSurface.withValues(alpha: 0.35),
            ),
            onTap: () => _openUrl(_privacyUrl),
          ),
          const SizedBox(height: 8),
          _PrivacyTile(
            icon: Icons.description_outlined,
            title: 'Terms of Service',
            subtitle: 'Your agreement with us',
            tokens: tokens,
            cinematic: cinematic,
            trailing: Icon(
              Icons.open_in_new_rounded,
              size: 16,
              color: tokens.onSurface.withValues(alpha: 0.35),
            ),
            onTap: () => _openUrl(_tosUrl),
          ),

          const SizedBox(height: 24),
          // ── Danger zone ──
          _SectionHead(text: 'Data', tokens: tokens),
          const SizedBox(height: 10),
          _PrivacyTile(
            icon: Icons.download_outlined,
            title: 'Export all data',
            subtitle: 'Download memory, preferences and summaries as JSON',
            tokens: tokens,
            cinematic: cinematic,
            trailing: Icon(
              Icons.chevron_right_rounded,
              size: 16,
              color: tokens.onSurface.withValues(alpha: 0.35),
            ),
            onTap: () => _exportData(context),
          ),
          const SizedBox(height: 8),
          _PrivacyTile(
            icon: Icons.delete_forever_rounded,
            title: 'Clear all local data',
            subtitle: 'Removes preferences and signs you out',
            tokens: tokens,
            cinematic: cinematic,
            isDestructive: true,
            onTap: () => _confirmClearData(context),
          ),
          const SizedBox(height: 8),
          _PrivacyTile(
            icon: Icons.no_accounts_rounded,
            title: 'Delete account',
            subtitle:
                'Permanently erase your account and all server-side data (GDPR)',
            tokens: tokens,
            cinematic: cinematic,
            isDestructive: true,
            onTap: () => _confirmDeleteAccount(context),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }
}

// ── Internal widgets ────────────────────────────────────────────────────────

class _SectionHead extends StatelessWidget {
  const _SectionHead({required this.text, required this.tokens});
  final String text;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.1,
        color: tokens.onSurface.withValues(alpha: 0.4),
      ),
    );
  }
}

class _PrivacyTile extends StatelessWidget {
  const _PrivacyTile({
    required this.icon,
    required this.title,
    required this.tokens,
    required this.cinematic,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.isDestructive = false,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final SvenModeTokens tokens;
  final bool cinematic;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool isDestructive;

  @override
  Widget build(BuildContext context) {
    final color =
        isDestructive ? Theme.of(context).colorScheme.error : tokens.onSurface;

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
              Icon(icon, size: 20, color: color.withValues(alpha: 0.55)),
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
