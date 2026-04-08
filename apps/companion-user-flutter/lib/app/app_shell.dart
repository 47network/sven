import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_models.dart';
import 'app_state.dart';
import 'authenticated_client.dart';
import 'desktop_window.dart';
import 'keyboard_nav.dart';
import 'performance_tracker.dart';
import 'providers.dart';
import 'service_locator.dart';
import 'sven_app_icon.dart';
import 'settings_sheet.dart';
import 'sven_page_route.dart';
import 'sven_tokens.dart';
import 'wake_word_status_indicator.dart';
import '../features/chat/chat_models.dart';
import '../features/chat/chat_service.dart';
import '../features/chat/chat_thread_page.dart';
import '../features/chat/messages_repository.dart';
import '../features/chat/prompt_templates_service.dart';
import '../features/chat/sync_service.dart';
import '../features/chat/voice_service.dart';
import '../features/entity/sven_hub_page.dart';
import '../features/home/feature_tooltip_service.dart';
import '../features/memory/memory_service.dart';
import '../features/onboarding/tutorial_service.dart';

class AppShell extends ConsumerStatefulWidget {
  const AppShell({
    super.key,
    required this.onLogout,
    required this.onLogoutAll,
  });

  final Future<void> Function() onLogout;
  final Future<void> Function() onLogoutAll;

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  @override
  void initState() {
    super.initState();
    // Wire up the system-tray "New Conversation" item on desktop.
    // addPostFrameCallback ensures [context] is mounted before we capture it.
    if (isDesktop) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          DesktopTrayManager.instance.initialize(
            onNewChat: () => _newChat(context),
          );
        }
      });
    }
  }

  @override
  void dispose() {
    if (isDesktop) DesktopTrayManager.instance.destroy();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appStateProvider);
    final client = ref.read(authenticatedClientProvider);
    final memoryService = ref.watch(memoryServiceProvider);
    final voiceService = ref.read(voiceServiceProvider);
    final tutorialService = ref.watch(tutorialServiceProvider);
    final tooltipService = ref.read(featureTooltipServiceProvider);
    final promptTemplatesService = ref.read(promptTemplatesServiceProvider);
    final deviceService = ref.read(deviceServiceProvider);

    final tokens = SvenTokens.forMode(state.visualMode);
    final cinematic = state.visualMode == VisualMode.cinematic;
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    state.setSystemReducedMotion(reduceMotion);

    return CallbackShortcuts(
      bindings: <ShortcutActivator, VoidCallback>{
        const SingleActivator(LogicalKeyboardKey.keyN, control: true): () =>
            _newChat(context),
        const SingleActivator(LogicalKeyboardKey.keyN, meta: true): () =>
            _newChat(context),
        const SingleActivator(LogicalKeyboardKey.keyK, control: true): () =>
            _showSettings(context),
        const SingleActivator(LogicalKeyboardKey.keyK, meta: true): () =>
            _showSettings(context),
        // "?" (Shift+/) shows the keyboard shortcuts help sheet
        const SingleActivator(LogicalKeyboardKey.slash, shift: true): () =>
            SvenKeyboardShortcutsHelp.show(
              context,
              backgroundColor: SvenTokens.forMode(state.visualMode).card,
            ),
      },
      child: Focus(
        autofocus: false,
        child: Scaffold(
          backgroundColor: tokens.scaffold,
          body: DecoratedBox(
            decoration: BoxDecoration(
              gradient: tokens.backgroundGradient,
            ),
            child: SafeArea(
              child: Column(
                children: [
                  // ── Custom title bar (desktop: drag-to-move + controls; mobile/web: zero-height) ──
                  const SvenTitleBar(),
                  if (state.performanceFallbackReason != null)
                    _PerformanceFallbackBanner(
                      reason: state.performanceFallbackReason!,
                    ),
                  // ── Premium header ──
                  SvenFocusRegion(
                    label: 'App header',
                    child: _SvenHeader(
                      tokens: tokens,
                      cinematic: cinematic,
                      onOpenSettings: () => _showSettings(context),
                      isLoading: false,
                      wakeWordStatus: state.wakeWordStatus,
                      wakeWordPhrase: state.wakeWordPhrase,
                    ),
                  ),
                  // ── Content (Hub: Canvas / Form / Chat) ──
                  Expanded(
                    child: SvenFocusRegion(
                      label: 'Main content',
                      autofocus: true,
                      child: _HomeReadyNotifier(
                        child: SvenHubPage(
                          visualMode: state.effectiveVisualMode,
                          motionLevel: state.effectiveMotionLevel,
                          avatarMode: state.avatarMode,
                          client: client,
                          memoryService: memoryService,
                          onLogout: () => widget.onLogout(),
                          onOpenSettings: () => _showSettings(context),
                          responseLength: state.responseLength,
                          promptTemplatesService: promptTemplatesService,
                          archivedIds: state.archivedIds,
                          threadTags: state.threadTags,
                          onToggleArchive: state.toggleArchive,
                          onSetTag: state.setThreadTag,
                          voicePersonality: state.voicePersonality,
                          onAvatarChanged: state.setAvatarMode,
                          customShapeSpec: state.customShapeSpec,
                          onCustomShapeChanged: state.setCustomShapeSpec,
                          deviceService: deviceService,
                          onQuickAction: (prefill) => _openNewChatWithDraft(
                            context,
                            prefill,
                          ),
                          syncService: ref.read(syncServiceProvider),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          // ── New chat FAB ──
          floatingActionButton: SvenFeatureTooltip(
            tip: FeatureTip.fabNewChat,
            service: tooltipService,
            message: 'Tap to start a new chat with Sven',
            preferBelow: false,
            child: _NewChatFab(
              tokens: tokens,
              cinematic: cinematic,
              visualMode: state.effectiveVisualMode,
              motionLevel: state.effectiveMotionLevel,
              client: client,
              voiceService: voiceService,
              state: state,
              promptTemplatesService: promptTemplatesService,
              memoryService: memoryService,
              tutorialService: tutorialService,
              syncService: ref.read(syncServiceProvider),
            ),
          ),
        ),
      ),
    );
  }

  void _openNewChatWithDraft(BuildContext context, String draft) {
    final state = ref.read(appStateProvider);
    final client = ref.read(authenticatedClientProvider);
    final voiceService = ref.read(voiceServiceProvider);
    final promptTemplatesService = ref.read(promptTemplatesServiceProvider);
    final memoryService = ref.read(memoryServiceProvider);
    final tutorialService = ref.read(tutorialServiceProvider);
    HapticFeedback.lightImpact();
    Navigator.of(context).push(
      SvenPageRoute<void>(
        builder: (_) => _NewChatPage(
          visualMode: state.effectiveVisualMode,
          motionLevel: state.effectiveMotionLevel,
          client: client,
          state: state,
          voiceService: voiceService,
          promptTemplatesService: promptTemplatesService,
          memoryService: memoryService,
          initialDraft: draft,
          tutorialService: tutorialService,
          syncService: ref.read(syncServiceProvider),
        ),
      ),
    );
  }

  void _newChat(BuildContext context) {
    final state = ref.read(appStateProvider);
    final client = ref.read(authenticatedClientProvider);
    final voiceService = ref.read(voiceServiceProvider);
    final promptTemplatesService = ref.read(promptTemplatesServiceProvider);
    final memoryService = ref.read(memoryServiceProvider);
    final tutorialService = ref.read(tutorialServiceProvider);
    HapticFeedback.lightImpact();
    Navigator.of(context).push(
      SvenPageRoute<void>(
        builder: (_) => _NewChatPage(
          visualMode: state.effectiveVisualMode,
          motionLevel: state.effectiveMotionLevel,
          client: client,
          state: state,
          voiceService: voiceService,
          promptTemplatesService: promptTemplatesService,
          memoryService: memoryService,
          tutorialService: tutorialService,
          syncService: ref.read(syncServiceProvider),
        ),
      ),
    );
  }

  void _showSettings(BuildContext context) {
    final state = ref.read(appStateProvider);
    final client = ref.read(authenticatedClientProvider);
    final authService = ref.read(authServiceProvider);
    final memoryService = ref.read(memoryServiceProvider);
    final lockService = ref.read(appLockServiceProvider);
    final voiceService = ref.read(voiceServiceProvider);
    final deviceService = ref.read(deviceServiceProvider);
    final projectService = ref.read(projectServiceProvider);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => SettingsSheet(
        state: state,
        client: client,
        authService: authService,
        onLogout: widget.onLogout,
        onLogoutAll: widget.onLogoutAll,
        memoryService: memoryService,
        lockService: lockService,
        voiceService: voiceService,
        deviceService: deviceService,
        projectService: projectService,
      ),
    );
  }
}

/// Premium header — brand mark + title + wake-word status + settings gear.
class _SvenHeader extends StatelessWidget {
  const _SvenHeader({
    required this.tokens,
    required this.cinematic,
    required this.onOpenSettings,
    required this.isLoading,
    required this.wakeWordStatus,
    required this.wakeWordPhrase,
  });

  final SvenModeTokens tokens;
  final bool cinematic;
  final VoidCallback onOpenSettings;
  final bool isLoading;
  final WakeWordStatus wakeWordStatus;
  final String wakeWordPhrase;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 8, 4),
      child: Row(
        children: [
          _SvenBrandIcon(size: 34, cinematic: cinematic, tokens: tokens),
          const SizedBox(width: 10),
          Text(
            'Sven',
            style: TextStyle(
              color: tokens.onSurface,
              fontSize: 20,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.5,
            ),
          ),
          if (isLoading) ...[
            const SizedBox(width: 10),
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                strokeWidth: 1.5,
                color: tokens.primary.withValues(alpha: 0.5),
              ),
            ),
          ],
          const SizedBox(width: 6),
          WakeWordStatusIndicator(
            status: wakeWordStatus,
            tokens: tokens,
            phrase: wakeWordPhrase,
          ),
          const Spacer(),
          // Settings
          IconButton(
            key: const Key('settings_icon_button'),
            icon: Icon(
              Icons.settings_outlined,
              color: tokens.onSurface.withValues(alpha: 0.5),
              size: 22,
            ),
            tooltip: 'Settings',
            onPressed: onOpenSettings,
          ),
        ],
      ),
    );
  }
}

class _SvenBrandIcon extends StatelessWidget {
  const _SvenBrandIcon({
    required this.size,
    required this.cinematic,
    required this.tokens,
  });

  final double size;
  final bool cinematic;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * 0.3),
        boxShadow: [
          BoxShadow(
            color: tokens.primary.withValues(alpha: cinematic ? 0.22 : 0.14),
            blurRadius: cinematic ? 18 : 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: SvenAppIcon(size: size, borderRadius: size * 0.3),
    );
  }
}

/// New chat FAB — gradient circle.
class _NewChatFab extends StatelessWidget {
  const _NewChatFab({
    required this.tokens,
    required this.cinematic,
    required this.visualMode,
    required this.motionLevel,
    required this.client,
    required this.state,
    this.voiceService,
    this.promptTemplatesService,
    this.memoryService,
    this.tutorialService,
    this.syncService,
  });

  final SvenModeTokens tokens;
  final bool cinematic;
  final VisualMode visualMode;
  final MotionLevel motionLevel;
  final AuthenticatedClient client;
  final AppState state;
  final VoiceService? voiceService;
  final PromptTemplatesService? promptTemplatesService;
  final MemoryService? memoryService;
  final TutorialService? tutorialService;
  final SyncService? syncService;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: cinematic
              ? [tokens.primary, tokens.secondary]
              : [tokens.primary, tokens.primary.withValues(alpha: 0.8)],
        ),
        boxShadow: [
          BoxShadow(
            color: tokens.primary.withValues(alpha: cinematic ? 0.35 : 0.25),
            blurRadius: cinematic ? 20 : 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          key: const Key('new_chat_fab'),
          onTap: () {
            HapticFeedback.lightImpact();
            Navigator.of(context).push(
              SvenPageRoute<void>(
                builder: (_) => _NewChatPage(
                  visualMode: visualMode,
                  motionLevel: motionLevel,
                  client: client,
                  state: state,
                  voiceService: voiceService,
                  promptTemplatesService: promptTemplatesService,
                  memoryService: memoryService,
                  tutorialService: tutorialService,
                  syncService: syncService,
                ),
              ),
            );
          },
          onLongPress: () {
            HapticFeedback.mediumImpact();
            Navigator.of(context).push(
              SvenPageRoute<void>(
                builder: (_) => _NewChatPage(
                  visualMode: visualMode,
                  motionLevel: motionLevel,
                  client: client,
                  state: state,
                  voiceService: voiceService,
                  promptTemplatesService: promptTemplatesService,
                  memoryService: memoryService,
                  incognito: true,
                ),
              ),
            );
          },
          child: Icon(
            Icons.add_rounded,
            color: cinematic ? const Color(0xFF040712) : Colors.white,
            size: 28,
          ),
        ),
      ),
    );
  }
}

/// Full-screen new chat page — shows welcome + composer directly.
class _NewChatPage extends StatefulWidget {
  const _NewChatPage({
    required this.visualMode,
    required this.motionLevel,
    required this.client,
    required this.state,
    this.voiceService,
    this.promptTemplatesService,
    this.memoryService,
    this.incognito = false,
    this.initialDraft,
    this.tutorialService,
    this.syncService,
  });

  final VisualMode visualMode;
  final MotionLevel motionLevel;
  final AuthenticatedClient client;
  final AppState state;
  final VoiceService? voiceService;
  final PromptTemplatesService? promptTemplatesService;
  final MemoryService? memoryService;
  final bool incognito;
  final String? initialDraft;
  final TutorialService? tutorialService;
  final SyncService? syncService;

  @override
  State<_NewChatPage> createState() => _NewChatPageState();
}

class _NewChatPageState extends State<_NewChatPage> {
  VoidCallback? _exportFn;

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;
    final chatService = ChatService(
      client: widget.client,
      repo: sl<MessagesRepository>(),
    );
    final newThread = ChatThreadSummary(
      id: 'new-${DateTime.now().millisecondsSinceEpoch}',
      title: widget.incognito ? 'Incognito chat' : 'New chat',
      lastMessage: '',
      updatedAt: DateTime.now(),
    );

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Row(
          children: [
            if (widget.incognito)
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: tokens.onSurface.withValues(alpha: 0.10),
                ),
                child: Center(
                  child: Icon(
                    Icons.visibility_off_outlined,
                    size: 16,
                    color: tokens.onSurface.withValues(alpha: 0.60),
                  ),
                ),
              )
            else
              const SvenAppIcon(size: 28, borderRadius: 9),
            const SizedBox(width: 10),
            Text(
              widget.incognito ? 'Incognito chat' : 'New chat',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: widget.incognito
                    ? tokens.onSurface.withValues(alpha: 0.60)
                    : tokens.onSurface,
              ),
            ),
          ],
        ),
        actions: [
          if (!widget.incognito)
            IconButton(
              tooltip: 'Export conversation',
              icon: const Icon(Icons.ios_share_rounded),
              onPressed: _exportFn,
            ),
        ],
      ),
      body: DecoratedBox(
        decoration: BoxDecoration(gradient: tokens.backgroundGradient),
        child: ChatThreadPage(
          thread: newThread,
          chatService: chatService,
          showHeader: false,
          visualMode: widget.visualMode,
          motionLevel: widget.motionLevel,
          voiceService: widget.voiceService,
          incognito: widget.incognito,
          responseLength: widget.state.responseLength,
          promptTemplatesService: widget.promptTemplatesService,
          voicePersonality: widget.state.voicePersonality,
          memoryService: widget.memoryService,
          initialDraft: widget.initialDraft,
          tutorialService: widget.incognito ? null : widget.tutorialService,
          syncService: widget.incognito ? null : widget.syncService,
          onRegisterExport:
              widget.incognito ? null : (fn) => setState(() => _exportFn = fn),
        ),
      ),
    );
  }
}

/// Settings bottom sheet — replaces the old ugly Drawer.
class _PerformanceFallbackBanner extends StatelessWidget {
  const _PerformanceFallbackBanner({required this.reason});

  final String reason;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      label: 'Performance notice: $reason. Switched to classic mode.',
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        color: Theme.of(context).colorScheme.tertiaryContainer,
        child: Row(
          children: [
            Icon(
              Icons.battery_alert,
              size: 16,
              color: Theme.of(context).colorScheme.onTertiaryContainer,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                '$reason — switched to classic mode',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onTertiaryContainer,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HomeReadyNotifier extends StatefulWidget {
  const _HomeReadyNotifier({required this.child});

  final Widget child;

  @override
  State<_HomeReadyNotifier> createState() => _HomeReadyNotifierState();
}

class _HomeReadyNotifierState extends State<_HomeReadyNotifier> {
  bool _logged = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _markReady());
  }

  @override
  void didUpdateWidget(covariant _HomeReadyNotifier oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.child, widget.child)) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _markReady());
    }
  }

  void _markReady() {
    if (_logged) return;
    _logged = true;
    PerformanceTracker.markHomeReady();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
