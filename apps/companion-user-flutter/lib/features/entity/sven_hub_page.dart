// ═══════════════════════════════════════════════════════════════════════════
// SvenHubPage — The futuristic 3-tab shell
//   ○ Canvas  → Sven's living avatar with full environment / aura
//   ○ Form    → Entity picker (Orion / Aria / Rex / Core)
//   ○ Chat    → Existing chat-home feed
// ═══════════════════════════════════════════════════════════════════════════

import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_models.dart';
import '../../app/authenticated_client.dart';
import '../../app/deep_link.dart';
import '../../app/sven_tokens.dart';
import '../../app/api_base_service.dart';
import '../home/daily_greeting.dart';
import '../home/streak_service.dart';
import '../home/quick_actions.dart';
import '../chat/chat_home_page.dart';
import '../chat/sync_service.dart';
import '../devices/device_control_page.dart';
import '../devices/device_presence_service.dart';
import '../devices/device_service.dart';
import '../memory/memory_service.dart';
import '../memory/sven_avatar.dart';
import '../chat/prompt_templates_service.dart';
import '../trading/trading_dashboard_page.dart';
import '../trading/trading_service.dart';
import '../trading/trading_sse_service.dart';
import 'custom_shape_spec.dart';
import 'shape_gen_service.dart';
import 'mirror_mode_screen.dart';

// ──────────────────────────────────────────────────────────────────────
// Hub tab definition
// ──────────────────────────────────────────────────────────────────────

enum _HubTab {
  canvas('CANVAS', Icons.blur_on_rounded),
  form('FORM', Icons.auto_awesome_rounded),
  chat('CHAT', Icons.chat_bubble_outline_rounded),
  devices('DEVICES', Icons.devices_rounded),
  trading('TRADING', Icons.show_chart_rounded);

  const _HubTab(this.label, this.icon);
  final String label;
  final IconData icon;
}

// ──────────────────────────────────────────────────────────────────────
// SvenHubPage widget
// ──────────────────────────────────────────────────────────────────────

class SvenHubPage extends StatefulWidget {
  const SvenHubPage({
    super.key,
    required this.visualMode,
    required this.motionLevel,
    required this.avatarMode,
    required this.onLogout,
    required this.client,
    this.onOpenSettings,
    this.memoryService,
    this.responseLength = ResponseLength.balanced,
    this.promptTemplatesService,
    this.archivedIds = const {},
    this.threadTags = const {},
    this.onToggleArchive,
    this.onSetTag,
    this.voicePersonality = VoicePersonality.friendly,
    this.onAvatarChanged,
    this.customShapeSpec,
    this.onCustomShapeChanged,
    this.deviceService,
    this.onQuickAction,
    this.syncService,
    this.tradingService,
    this.tradingSseService,
  });

  final VisualMode visualMode;
  final MotionLevel motionLevel;
  final AvatarMode avatarMode;
  final ValueChanged<AvatarMode>? onAvatarChanged;
  final CustomShapeSpec? customShapeSpec;
  final ValueChanged<CustomShapeSpec?>? onCustomShapeChanged;
  final VoidCallback onLogout;
  final VoidCallback? onOpenSettings;
  final AuthenticatedClient client;
  final MemoryService? memoryService;
  final ResponseLength responseLength;
  final PromptTemplatesService? promptTemplatesService;
  final Set<String> archivedIds;
  final Map<String, ConversationTag> threadTags;
  final ValueChanged<String>? onToggleArchive;
  final void Function(String id, ConversationTag? tag)? onSetTag;
  final VoicePersonality voicePersonality;
  final DeviceService? deviceService;
  final QuickActionCallback? onQuickAction;
  final SyncService? syncService;
  final TradingService? tradingService;
  final TradingSseService? tradingSseService;

  @override
  State<SvenHubPage> createState() => _SvenHubPageState();
}

class _SvenHubPageState extends State<SvenHubPage>
    with TickerProviderStateMixin {
  _HubTab _tab = _HubTab.chat; // default to chat
  late final PageController _pageCtrl;
  late final AnimationController _glowCtrl;
  late final AnimationController _scanCtrl;
  DevicePresenceService? _presenceService;

  // Gateway URL for entity streaming and Mirror Mode
  static String get _gatewayUrl => ApiBaseService.currentSync();

  @override
  void initState() {
    super.initState();
    // Consume pending trading deep link if set.
    if (TradingDeepLink.pending) {
      TradingDeepLink.pending = false;
      _tab = _HubTab.trading;
    }
    _pageCtrl = PageController(initialPage: _tab.index);
    // Load persisted chat streak data
    unawaited(StreakService.instance.load());
    if (widget.deviceService != null) {
      _presenceService = DevicePresenceService(
        deviceService: widget.deviceService!,
        pollInterval: const Duration(seconds: 15),
      )..start();
    }
    _glowCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat(reverse: true);
    _scanCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4000),
    )..repeat();
  }

  @override
  void dispose() {
    _presenceService?.dispose();
    _pageCtrl.dispose();
    _glowCtrl.dispose();
    _scanCtrl.dispose();
    super.dispose();
  }

  void _switchTab(_HubTab tab) {
    if (tab == _tab) return;
    HapticFeedback.selectionClick();
    setState(() => _tab = tab);
    _pageCtrl.animateToPage(
      tab.index,
      duration: const Duration(milliseconds: 360),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E27), // Match ambient dark theme
      body: Column(
        children: [
          // ── Futuristic tab bar ──
          AnimatedBuilder(
            animation: Listenable.merge([_glowCtrl, _scanCtrl]),
            builder: (context, _) => _FuturisticTabBar(
              current: _tab,
              onChanged: _switchTab,
              tokens: tokens,
              glow: _glowCtrl.value,
              scan: _scanCtrl.value,
            ),
          ),

          // ── Page content ──
          Expanded(
            child: PageView(
              controller: _pageCtrl,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                // ─── TAB 0: CANVAS ───
                _CanvasView(
                  avatarMode: widget.avatarMode,
                  visualMode: widget.visualMode,
                  motionLevel: widget.motionLevel,
                  voicePersonality: widget.voicePersonality,
                  tokens: tokens,
                  customShapeSpec: widget.customShapeSpec,
                  memoryService: widget.memoryService,
                  onQuickAction: widget.onQuickAction,
                ),

                // ─── TAB 1: FORM ───
                _FormView(
                  avatarMode: widget.avatarMode,
                  visualMode: widget.visualMode,
                  motionLevel: widget.motionLevel,
                  voicePersonality: widget.voicePersonality,
                  onAvatarChanged: widget.onAvatarChanged,
                  tokens: tokens,
                  customShapeSpec: widget.customShapeSpec,
                  onCustomShapeChanged: widget.onCustomShapeChanged,
                  client: widget.client,
                ),

                // ─── TAB 2: CHAT ───
                ChatHomePage(
                  visualMode: widget.visualMode,
                  motionLevel: widget.motionLevel,
                  avatarMode: widget.avatarMode,
                  client: widget.client,
                  memoryService: widget.memoryService,
                  onLogout: widget.onLogout,
                  onOpenSettings: widget.onOpenSettings,
                  responseLength: widget.responseLength,
                  promptTemplatesService: widget.promptTemplatesService,
                  archivedIds: widget.archivedIds,
                  threadTags: widget.threadTags,
                  onToggleArchive: widget.onToggleArchive,
                  onSetTag: widget.onSetTag,
                  voicePersonality: widget.voicePersonality,
                  onAvatarChanged: widget.onAvatarChanged,
                  syncService: widget.syncService,
                ),

                // ─── TAB 3: DEVICES ───
                _DevicesView(
                  tokens: SvenTokens.forMode(widget.visualMode),
                  visualMode: widget.visualMode,
                  presenceService: _presenceService,
                  deviceService: widget.deviceService,
                ),

                // ─── TAB 4: TRADING ───
                if (widget.tradingService != null && widget.tradingSseService != null)
                  TradingDashboardPage(
                    tradingService: widget.tradingService!,
                    sseService: widget.tradingSseService!,
                    visualMode: widget.visualMode,
                  )
                else
                  const Center(child: Text('Trading unavailable')),
              ],
            ),
          ),
        ],
      ),
      // Mirror Mode floating action button
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (context) => MirrorModeScreen(
                gatewayUrl: _gatewayUrl,
                motionLevel: widget.motionLevel,
                entityChannelId: 'default',
              ),
            ),
          );
        },
        tooltip: 'Enter Mirror Mode (full-screen entity)',
        backgroundColor: const Color(0xFF6E40F5).withValues(alpha: 0.9),
        foregroundColor: Colors.white,
        elevation: 8,
        child: const Icon(Icons.blur_on_rounded),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// _FuturisticTabBar — neon pill-selector with scan-line & glow
// ═══════════════════════════════════════════════════════════════════════════

class _FuturisticTabBar extends StatelessWidget {
  const _FuturisticTabBar({
    required this.current,
    required this.onChanged,
    required this.tokens,
    required this.glow,
    required this.scan,
  });

  final _HubTab current;
  final ValueChanged<_HubTab> onChanged;
  final SvenModeTokens tokens;
  final double glow;
  final double scan;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
      height: 46,
      child: CustomPaint(
        painter: _TabBarBgPainter(
          primary: tokens.primary,
          glow: glow,
          scan: scan,
          selectedIndex: current.index,
          tabCount: _HubTab.values.length,
        ),
        child: Row(
          children: _HubTab.values.map((tab) {
            final selected = tab == current;
            return Expanded(
              child: GestureDetector(
                onTap: () => onChanged(tab),
                behavior: HitTestBehavior.opaque,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 260),
                  curve: Curves.easeOutCubic,
                  margin:
                      const EdgeInsets.symmetric(horizontal: 3, vertical: 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    color: selected
                        ? tokens.primary.withValues(alpha: 0.16)
                        : Colors.transparent,
                    border: selected
                        ? Border.all(
                            color: tokens.primary.withValues(alpha: 0.45),
                            width: 1)
                        : null,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        tab.icon,
                        size: 15,
                        color: selected
                            ? tokens.primary
                            : tokens.onSurface.withValues(alpha: 0.38),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        tab.label,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight:
                              selected ? FontWeight.w700 : FontWeight.w500,
                          letterSpacing: 1.4,
                          color: selected
                              ? tokens.primary
                              : tokens.onSurface.withValues(alpha: 0.38),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}

// ── Background painter for the tab bar ──

class _TabBarBgPainter extends CustomPainter {
  const _TabBarBgPainter({
    required this.primary,
    required this.glow,
    required this.scan,
    required this.selectedIndex,
    required this.tabCount,
  });

  final Color primary;
  final double glow, scan;
  final int selectedIndex, tabCount;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      const Radius.circular(16),
    );

    // Outer frame
    canvas.drawRRect(
      rrect,
      Paint()
        ..color = primary.withValues(alpha: 0.06 + 0.03 * glow)
        ..style = PaintingStyle.fill,
    );
    canvas.drawRRect(
      rrect,
      Paint()
        ..color = primary.withValues(alpha: 0.12 + 0.06 * glow)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.8,
    );

    // Scan line sweeping across
    final scanX = scan * size.width;
    canvas.drawLine(
      Offset(scanX, 2),
      Offset(scanX, size.height - 2),
      Paint()
        ..color = primary.withValues(alpha: 0.06)
        ..strokeWidth = 1.0,
    );

    // Glow under selected tab
    final tabW = size.width / tabCount;
    final selCx = tabW * selectedIndex + tabW / 2;
    canvas.drawCircle(
      Offset(selCx, size.height),
      tabW * 0.6,
      Paint()
        ..shader = RadialGradient(
          colors: [
            primary.withValues(alpha: 0.10 + 0.06 * glow),
            Colors.transparent,
          ],
        ).createShader(Rect.fromCircle(
            center: Offset(selCx, size.height), radius: tabW * 0.6)),
    );

    // Corner brackets
    const bLen = 8.0;
    final bp = Paint()
      ..color = primary.withValues(alpha: 0.20 + 0.10 * glow)
      ..strokeWidth = 1.0
      ..strokeCap = StrokeCap.round;
    // Top-left
    canvas.drawLine(const Offset(3, 3), const Offset(3 + bLen, 3), bp);
    canvas.drawLine(const Offset(3, 3), const Offset(3, 3 + bLen), bp);
    // Top-right
    canvas.drawLine(
        Offset(size.width - 3, 3), Offset(size.width - 3 - bLen, 3), bp);
    canvas.drawLine(
        Offset(size.width - 3, 3), Offset(size.width - 3, 3 + bLen), bp);
    // Bottom-left
    canvas.drawLine(
        Offset(3, size.height - 3), Offset(3 + bLen, size.height - 3), bp);
    canvas.drawLine(
        Offset(3, size.height - 3), Offset(3, size.height - 3 - bLen), bp);
    // Bottom-right
    canvas.drawLine(Offset(size.width - 3, size.height - 3),
        Offset(size.width - 3 - bLen, size.height - 3), bp);
    canvas.drawLine(Offset(size.width - 3, size.height - 3),
        Offset(size.width - 3, size.height - 3 - bLen), bp);
  }

  @override
  bool shouldRepaint(_TabBarBgPainter o) =>
      o.glow != glow || o.scan != scan || o.selectedIndex != selectedIndex;
}

// ═══════════════════════════════════════════════════════════════════════════
// _CanvasView — Sven's living world (full-screen avatar with atmosphere)
// ═══════════════════════════════════════════════════════════════════════════

class _CanvasView extends StatefulWidget {
  const _CanvasView({
    required this.avatarMode,
    required this.visualMode,
    required this.motionLevel,
    required this.voicePersonality,
    required this.tokens,
    this.customShapeSpec,
    this.memoryService,
    this.onQuickAction,
  });

  final AvatarMode avatarMode;
  final VisualMode visualMode;
  final MotionLevel motionLevel;
  final VoicePersonality voicePersonality;
  final SvenModeTokens tokens;
  final CustomShapeSpec? customShapeSpec;
  final MemoryService? memoryService;
  final QuickActionCallback? onQuickAction;

  @override
  State<_CanvasView> createState() => _CanvasViewState();
}

class _CanvasViewState extends State<_CanvasView>
    with SingleTickerProviderStateMixin {
  late AnimationController _ambientCtrl;
  SvenMood _mood = SvenMood.idle;
  bool _greetingDismissed = false;

  @override
  void initState() {
    super.initState();
    _ambientCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 6000),
    )..repeat();
  }

  @override
  void dispose() {
    _ambientCtrl.dispose();
    super.dispose();
  }

  void _cycleMood() {
    HapticFeedback.lightImpact();
    const moods = SvenMood.values;
    setState(() {
      _mood = moods[(_mood.index + 1) % moods.length];
    });
  }

  @override
  Widget build(BuildContext context) {
    final tokens = widget.tokens;
    final accent = Color(widget.avatarMode.gradientArgb[1]);

    return AnimatedBuilder(
      animation: _ambientCtrl,
      builder: (context, child) {
        final t = _ambientCtrl.value;
        return Container(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: Alignment(
                math.sin(t * 2 * math.pi) * 0.15,
                math.cos(t * 2 * math.pi) * 0.10 - 0.2,
              ),
              radius: 1.1,
              colors: [
                accent.withValues(alpha: 0.06 + 0.03 * math.sin(t * math.pi)),
                Colors.transparent,
              ],
            ),
          ),
          child: child,
        );
      },
      child: Column(
        children: [
          const SizedBox(height: 16),

          // ── Daily greeting card ──
          if (!_greetingDismissed)
            DailyGreeting(
              visualMode: widget.visualMode,
              tokens: tokens,
              memoryService: widget.memoryService,
              streakService: StreakService.instance,
              onDismiss: () => setState(() => _greetingDismissed = true),
              onSuggestionTap: widget.onQuickAction,
            ),
          if (!_greetingDismissed) const SizedBox(height: 8),

          // ── Quick actions row ──
          if (widget.onQuickAction != null)
            QuickActionsBar(
              tokens: widget.tokens,
              visualMode: widget.visualMode,
              onAction: widget.onQuickAction!,
            ),
          if (widget.onQuickAction != null) const SizedBox(height: 8),

          // ── Status line ──
          _StatusLine(
            mood: _mood,
            avatarMode: widget.avatarMode,
            tokens: tokens,
          ),
          const SizedBox(height: 8),

          // ── Large avatar ──
          Expanded(
            child: Center(
              child: SvenAvatar(
                visualMode: widget.visualMode,
                motionLevel: widget.motionLevel,
                mood: _mood,
                size: 280,
                avatarMode: widget.avatarMode,
                customShapeSpec: widget.customShapeSpec,
              ),
            ),
          ),

          // ── Entity name ──
          Text(
            widget.avatarMode.entityName.toUpperCase(),
            style: TextStyle(
              color: tokens.onSurface,
              fontSize: 22,
              fontWeight: FontWeight.w800,
              letterSpacing: 4,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            widget.avatarMode.entityDescription,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: tokens.onSurface.withValues(alpha: 0.50),
              fontSize: 12,
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: 20),

          // ── Mood control strip ──
          _MoodStrip(
            current: _mood,
            onTap: _cycleMood,
            tokens: tokens,
            accent: accent,
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

// ── Mood label strip with neon indicator ──

class _MoodStrip extends StatelessWidget {
  const _MoodStrip({
    required this.current,
    required this.onTap,
    required this.tokens,
    required this.accent,
  });

  final SvenMood current;
  final VoidCallback onTap;
  final SvenModeTokens tokens;
  final Color accent;

  String get _moodLabel {
    switch (current) {
      case SvenMood.idle:
        return '◇  STANDBY';
      case SvenMood.thinking:
        return '⟳  PROCESSING';
      case SvenMood.listening:
        return '◉  LISTENING';
      case SvenMood.speaking:
        return '◈  SPEAKING';
      case SvenMood.happy:
        return '✦  HAPPY';
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 60),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(30),
          color: accent.withValues(alpha: 0.08),
          border: Border.all(
            color: accent.withValues(alpha: 0.30),
            width: 0.8,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: current == SvenMood.idle
                    ? tokens.onSurface.withValues(alpha: 0.35)
                    : accent,
                boxShadow: current != SvenMood.idle
                    ? [
                        BoxShadow(
                          color: accent.withValues(alpha: 0.50),
                          blurRadius: 6,
                        )
                      ]
                    : null,
              ),
            ),
            const SizedBox(width: 10),
            Text(
              _moodLabel,
              style: TextStyle(
                color: tokens.onSurface.withValues(alpha: 0.70),
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 2.0,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Futuristic status line (top of canvas) ──

class _StatusLine extends StatelessWidget {
  const _StatusLine({
    required this.mood,
    required this.avatarMode,
    required this.tokens,
  });

  final SvenMood mood;
  final AvatarMode avatarMode;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    final accent = Color(avatarMode.gradientArgb[1]);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Row(
        children: [
          // left: designation
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: accent.withValues(alpha: 0.25),
                width: 0.6,
              ),
            ),
            child: Text(
              'SVEN • ${avatarMode.label.toUpperCase()}',
              style: TextStyle(
                color: tokens.onSurface.withValues(alpha: 0.45),
                fontSize: 9,
                fontWeight: FontWeight.w600,
                letterSpacing: 1.6,
              ),
            ),
          ),
          const Spacer(),
          // right: system status dots
          ...[
            accent,
            accent.withValues(alpha: 0.60),
            accent.withValues(alpha: 0.30),
          ].map(
            (c) => Container(
              width: 5,
              height: 5,
              margin: const EdgeInsets.symmetric(horizontal: 2),
              decoration: BoxDecoration(shape: BoxShape.circle, color: c),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// _FormView — Inline entity picker (wraps SvenEntityPage content)
// ═══════════════════════════════════════════════════════════════════════════

class _FormView extends StatefulWidget {
  const _FormView({
    required this.avatarMode,
    required this.visualMode,
    required this.motionLevel,
    required this.voicePersonality,
    required this.onAvatarChanged,
    required this.tokens,
    this.customShapeSpec,
    this.onCustomShapeChanged,
    required this.client,
  });

  final AvatarMode avatarMode;
  final VisualMode visualMode;
  final MotionLevel motionLevel;
  final VoicePersonality voicePersonality;
  final ValueChanged<AvatarMode>? onAvatarChanged;
  final SvenModeTokens tokens;
  final CustomShapeSpec? customShapeSpec;
  final ValueChanged<CustomShapeSpec?>? onCustomShapeChanged;
  final AuthenticatedClient client;

  @override
  State<_FormView> createState() => _FormViewState();
}

class _FormViewState extends State<_FormView> {
  late AvatarMode _selected;
  final _shapeCtrl = TextEditingController();
  bool _generating = false;
  String? _genError;

  @override
  void initState() {
    super.initState();
    _selected = widget.avatarMode;
  }

  @override
  void dispose() {
    _shapeCtrl.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant _FormView old) {
    super.didUpdateWidget(old);
    if (old.avatarMode != widget.avatarMode) {
      _selected = widget.avatarMode;
    }
  }

  void _pick(AvatarMode mode) {
    HapticFeedback.selectionClick();
    setState(() => _selected = mode);
    widget.onAvatarChanged?.call(mode);
  }

  Future<void> _generateCustomShape() async {
    final desc = _shapeCtrl.text.trim();
    if (desc.isEmpty) return;
    setState(() {
      _generating = true;
      _genError = null;
    });
    try {
      final service = ShapeGenService(client: widget.client);
      final spec = await service.generate(desc);
      widget.onCustomShapeChanged?.call(spec);
      _pick(AvatarMode.custom);
      _shapeCtrl.clear();
    } catch (e) {
      setState(() => _genError = 'Generation failed — try again');
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  AvatarMode _svensChoice() {
    switch (widget.voicePersonality) {
      case VoicePersonality.friendly:
        return AvatarMode.human;
      case VoicePersonality.professional:
        return AvatarMode.robot;
      case VoicePersonality.casual:
        return AvatarMode.animal;
      case VoicePersonality.mentor:
        return AvatarMode.orb;
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = widget.tokens;
    final colors = _selected.gradientArgb.map((a) => Color(a)).toList();

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            colors[0].withValues(alpha: 0.6),
            colors[1].withValues(alpha: 0.08),
            Colors.transparent,
          ],
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        children: [
          // ── Hero avatar ──
          Center(
            child: SvenAvatar(
              visualMode: widget.visualMode,
              motionLevel: widget.motionLevel,
              mood: SvenMood.happy,
              size: 180,
              avatarMode: _selected,
              customShapeSpec: widget.customShapeSpec,
            ),
          ),
          const SizedBox(height: 14),

          // ── Entity name ──
          Center(
            child: Text(
              '${_selected.icon}  ${_selected.entityName}',
              style: TextStyle(
                color: tokens.onSurface,
                fontSize: 26,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.6,
              ),
            ),
          ),
          const SizedBox(height: 6),
          Center(
            child: Text(
              _selected.entityDescription,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: tokens.onSurface.withValues(alpha: 0.60),
                fontSize: 13,
                height: 1.45,
              ),
            ),
          ),
          const SizedBox(height: 10),

          // ── Trait chips ──
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 8,
            children: _selected.traits
                .map((t) => Chip(
                      label: Text(t,
                          style: TextStyle(
                              color: tokens.onSurface,
                              fontSize: 11,
                              fontWeight: FontWeight.w600)),
                      backgroundColor: colors[1].withValues(alpha: 0.18),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 0),
                      side:
                          BorderSide(color: colors[1].withValues(alpha: 0.40)),
                    ))
                .toList(),
          ),
          const SizedBox(height: 18),

          // ── Custom shape generator ──
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 4),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              color: tokens.primary.withValues(alpha: 0.04),
              border: Border.all(
                color: tokens.primary.withValues(alpha: 0.15),
                width: 0.7,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.auto_fix_high_rounded,
                        size: 14, color: tokens.primary.withValues(alpha: 0.7)),
                    const SizedBox(width: 6),
                    Text(
                      'SHAPE FROM IMAGINATION',
                      style: TextStyle(
                        color: tokens.onSurface.withValues(alpha: 0.55),
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.6,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  'Describe any form and Sven\'s AI will generate it.',
                  style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.40),
                    fontSize: 11.5,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _shapeCtrl,
                        enabled: !_generating,
                        style: TextStyle(
                          color: tokens.onSurface,
                          fontSize: 13,
                        ),
                        decoration: InputDecoration(
                          hintText: 'e.g. "neon dragon", "crystal wolf"...',
                          hintStyle: TextStyle(
                            color: tokens.onSurface.withValues(alpha: 0.25),
                            fontSize: 12,
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: BorderSide(
                              color: tokens.primary.withValues(alpha: 0.25),
                            ),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: BorderSide(
                              color: tokens.primary.withValues(alpha: 0.20),
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: BorderSide(
                              color: tokens.primary.withValues(alpha: 0.50),
                              width: 1.2,
                            ),
                          ),
                          filled: true,
                          fillColor: tokens.surface.withValues(alpha: 0.5),
                        ),
                        onSubmitted: (_) => _generateCustomShape(),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      height: 42,
                      width: 42,
                      child: _generating
                          ? Center(
                              child: SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: tokens.primary,
                                ),
                              ),
                            )
                          : IconButton(
                              onPressed: _generateCustomShape,
                              icon: Icon(Icons.bolt_rounded,
                                  color: tokens.primary, size: 20),
                              style: IconButton.styleFrom(
                                backgroundColor:
                                    tokens.primary.withValues(alpha: 0.12),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  side: BorderSide(
                                    color:
                                        tokens.primary.withValues(alpha: 0.30),
                                  ),
                                ),
                              ),
                            ),
                    ),
                  ],
                ),
                if (_genError != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    _genError!,
                    style: const TextStyle(
                      color: Color(0xFFEF4444),
                      fontSize: 11,
                    ),
                  ),
                ],
                // Show current custom shape info
                if (_selected == AvatarMode.custom &&
                    widget.customShapeSpec != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      color: Color(widget.customShapeSpec!.primaryArgb)
                          .withValues(alpha: 0.08),
                      border: Border.all(
                        color: Color(widget.customShapeSpec!.primaryArgb)
                            .withValues(alpha: 0.25),
                        width: 0.6,
                      ),
                    ),
                    child: Row(
                      children: [
                        Text(
                          widget.customShapeSpec!.icon,
                          style: const TextStyle(fontSize: 20),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.customShapeSpec!.name,
                                style: TextStyle(
                                  color: tokens.onSurface,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              Text(
                                widget.customShapeSpec!.description,
                                style: TextStyle(
                                  color:
                                      tokens.onSurface.withValues(alpha: 0.50),
                                  fontSize: 11,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),

          // ── "Let Sven choose" ──
          Center(
            child: OutlinedButton.icon(
              onPressed: () => _pick(_svensChoice()),
              icon: Icon(Icons.auto_awesome_rounded,
                  size: 15, color: tokens.primary),
              label: Text(
                'LET SVEN CHOOSE',
                style: TextStyle(
                  color: tokens.primary,
                  fontWeight: FontWeight.w600,
                  fontSize: 11,
                  letterSpacing: 1.2,
                ),
              ),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: tokens.primary.withValues(alpha: 0.45)),
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(30)),
              ),
            ),
          ),
          const SizedBox(height: 22),

          // ── Entity cards ──
          ...AvatarMode.values.map((mode) => _HubEntityCard(
                mode: mode,
                isSelected: _selected == mode,
                tokens: tokens,
                onTap: () => _pick(mode),
              )),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

// ── Entity selection card (futuristic variant) ──

class _HubEntityCard extends StatelessWidget {
  const _HubEntityCard({
    required this.mode,
    required this.isSelected,
    required this.tokens,
    required this.onTap,
  });

  final AvatarMode mode;
  final bool isSelected;
  final SvenModeTokens tokens;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final accent = Color(mode.gradientArgb[1]);

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOutCubic,
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isSelected
              ? accent.withValues(alpha: 0.14)
              : tokens.surface.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: isSelected
                ? accent.withValues(alpha: 0.65)
                : tokens.onSurface.withValues(alpha: 0.08),
            width: isSelected ? 1.2 : 0.6,
          ),
        ),
        child: Row(
          children: [
            // Icon badge
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.16),
                shape: BoxShape.circle,
                border: isSelected
                    ? Border.all(
                        color: accent.withValues(alpha: 0.40), width: 0.6)
                    : null,
              ),
              child: Center(
                child: Text(mode.icon, style: const TextStyle(fontSize: 20)),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    mode.entityName,
                    style: TextStyle(
                      color: tokens.onSurface,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    mode.entityDescription,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: tokens.onSurface.withValues(alpha: 0.50),
                      fontSize: 11,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Wrap(
                    spacing: 5,
                    children: mode.traits
                        .map((t) => Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: accent.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: accent.withValues(alpha: 0.20),
                                  width: 0.4,
                                ),
                              ),
                              child: Text(t,
                                  style: TextStyle(
                                      color: tokens.onSurface
                                          .withValues(alpha: 0.70),
                                      fontSize: 9,
                                      fontWeight: FontWeight.w500,
                                      letterSpacing: 0.3)),
                            ))
                        .toList(),
                  ),
                ],
              ),
            ),
            if (isSelected)
              Icon(Icons.check_circle_rounded, color: accent, size: 20),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// _DevicesView — Hub DEVICES tab showing live device status
// ═══════════════════════════════════════════════════════════════════════════

class _DevicesView extends StatelessWidget {
  const _DevicesView({
    required this.tokens,
    required this.visualMode,
    this.presenceService,
    this.deviceService,
  });

  final SvenModeTokens tokens;
  final VisualMode visualMode;
  final DevicePresenceService? presenceService;
  final DeviceService? deviceService;

  @override
  Widget build(BuildContext context) {
    if (presenceService == null || deviceService == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.devices_rounded,
                  size: 56, color: tokens.onSurface.withValues(alpha: 0.25)),
              const SizedBox(height: 16),
              Text(
                'Device control not available',
                style: TextStyle(
                    color: tokens.onSurface.withValues(alpha: 0.5),
                    fontSize: 14),
              ),
            ],
          ),
        ),
      );
    }

    return ValueListenableBuilder<DevicePresenceState>(
      valueListenable: presenceService!,
      builder: (context, state, _) {
        if (state.loading && state.devices.isEmpty) {
          return Center(
              child: CircularProgressIndicator(color: tokens.primary));
        }

        return RefreshIndicator(
          color: tokens.primary,
          onRefresh: () => presenceService!.refresh(),
          child: state.devices.isEmpty
              ? ListView(
                  children: [
                    SizedBox(height: MediaQuery.of(context).size.height * 0.3),
                    Center(
                      child: Column(
                        children: [
                          Icon(Icons.devices_other_rounded,
                              size: 64,
                              color: tokens.onSurface.withValues(alpha: 0.2)),
                          const SizedBox(height: 16),
                          Text('No devices registered',
                              style: TextStyle(
                                  color:
                                      tokens.onSurface.withValues(alpha: 0.5),
                                  fontSize: 15)),
                          const SizedBox(height: 8),
                          Text('Add a device from Settings → Devices',
                              style: TextStyle(
                                  color:
                                      tokens.onSurface.withValues(alpha: 0.35),
                                  fontSize: 12)),
                        ],
                      ),
                    ),
                  ],
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                  children: [
                    // ── Status summary ──
                    _DeviceStatusBar(state: state, tokens: tokens),
                    const SizedBox(height: 16),
                    // ── Device cards ──
                    ...state.devices.map((device) => _DeviceCard(
                          device: device,
                          tokens: tokens,
                          visualMode: visualMode,
                          deviceService: deviceService!,
                        )),
                    // ── Last refresh ──
                    if (state.lastRefresh != null) ...[
                      const SizedBox(height: 12),
                      Center(
                        child: Text(
                          'Updated ${_timeAgo(state.lastRefresh!)}',
                          style: TextStyle(
                              color: tokens.onSurface.withValues(alpha: 0.3),
                              fontSize: 11),
                        ),
                      ),
                    ],
                  ],
                ),
        );
      },
    );
  }

  static String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 10) return 'just now';
    if (diff.inSeconds < 60) return '${diff.inSeconds}s ago';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    return '${diff.inHours}h ago';
  }
}

// ── Status summary bar ──

class _DeviceStatusBar extends StatelessWidget {
  const _DeviceStatusBar({required this.state, required this.tokens});
  final DevicePresenceState state;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: tokens.card.withValues(alpha: 0.6),
        border: Border.all(
            color: tokens.primary.withValues(alpha: 0.15), width: 0.5),
      ),
      child: Row(
        children: [
          _StatusChip(
            label: '${state.onlineCount} Online',
            color: Colors.green,
            tokens: tokens,
          ),
          const SizedBox(width: 12),
          _StatusChip(
            label: '${state.offlineCount} Offline',
            color: Colors.grey,
            tokens: tokens,
          ),
          if (state.pairingCount > 0) ...[
            const SizedBox(width: 12),
            _StatusChip(
              label: '${state.pairingCount} Pairing',
              color: Colors.amber,
              tokens: tokens,
            ),
          ],
          const Spacer(),
          Text(
            '${state.totalCount} device${state.totalCount == 1 ? '' : 's'}',
            style: TextStyle(
                color: tokens.onSurface.withValues(alpha: 0.5), fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip(
      {required this.label, required this.color, required this.tokens});
  final String label;
  final Color color;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color,
            boxShadow: [
              BoxShadow(color: color.withValues(alpha: 0.4), blurRadius: 4)
            ],
          ),
        ),
        const SizedBox(width: 5),
        Text(label,
            style: TextStyle(
                color: tokens.onSurface.withValues(alpha: 0.7),
                fontSize: 12,
                fontWeight: FontWeight.w500)),
      ],
    );
  }
}

// ── Individual device card ──

class _DeviceCard extends StatelessWidget {
  const _DeviceCard({
    required this.device,
    required this.tokens,
    required this.visualMode,
    required this.deviceService,
  });

  final Device device;
  final SvenModeTokens tokens;
  final VisualMode visualMode;
  final DeviceService deviceService;

  IconData get _typeIcon => switch (device.deviceType) {
        DeviceType.mirror => Icons.smart_screen_rounded,
        DeviceType.tablet => Icons.tablet_rounded,
        DeviceType.kiosk => Icons.tv_rounded,
        DeviceType.sensorHub => Icons.sensors_rounded,
      };

  @override
  Widget build(BuildContext context) {
    final statusColor = device.isOnline
        ? Colors.green
        : device.isPairing
            ? Colors.amber
            : Colors.grey;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () {
            HapticFeedback.selectionClick();
            Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => DeviceControlPage(
                deviceService: deviceService,
                device: device,
                visualMode: visualMode,
              ),
            ));
          },
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              color: tokens.card.withValues(alpha: 0.5),
              border: Border.all(
                  color: tokens.primary.withValues(alpha: 0.10), width: 0.5),
            ),
            child: Row(
              children: [
                // ── Type icon with status glow ──
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: statusColor.withValues(alpha: 0.12),
                    border: Border.all(
                        color: statusColor.withValues(alpha: 0.3), width: 1),
                  ),
                  child: Icon(_typeIcon, color: statusColor, size: 22),
                ),
                const SizedBox(width: 14),
                // ── Info ──
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        device.name,
                        style: TextStyle(
                          color: tokens.onSurface,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          Container(
                            width: 7,
                            height: 7,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: statusColor,
                            ),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            device.status.name.toUpperCase(),
                            style: TextStyle(
                              color: tokens.onSurface.withValues(alpha: 0.5),
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.8,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Text(
                            device.deviceType.label,
                            style: TextStyle(
                              color: tokens.onSurface.withValues(alpha: 0.4),
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
                      if (device.capabilities.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 4,
                          runSpacing: 4,
                          children: device.capabilities
                              .take(5)
                              .map((cap) => Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(6),
                                      color: tokens.primary
                                          .withValues(alpha: 0.08),
                                      border: Border.all(
                                          color: tokens.primary
                                              .withValues(alpha: 0.15),
                                          width: 0.4),
                                    ),
                                    child: Text(
                                      cap,
                                      style: TextStyle(
                                          color: tokens.onSurface
                                              .withValues(alpha: 0.6),
                                          fontSize: 9,
                                          fontWeight: FontWeight.w500),
                                    ),
                                  ))
                              .toList(),
                        ),
                      ],
                    ],
                  ),
                ),
                // ── Chevron ──
                Icon(Icons.chevron_right_rounded,
                    color: tokens.onSurface.withValues(alpha: 0.25), size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
