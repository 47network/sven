/// Desktop window management for Sven — Windows, macOS, Linux.
///
/// Provides:
///   – [DesktopWindowManager]  — hidden title bar, min size, graceful close
///   – [DesktopTrayManager]    — system-tray icon + context menu
///   – [SvenTitleBar]          — custom drag-to-move title bar widget
///
/// All public APIs are no-ops when [isDesktop] is false, so the file can be
/// imported unconditionally from main.dart and sven_user_app.dart without
/// affecting Android, iOS, or web builds.
///
/// Required icon assets (add after running `flutter create --platforms=...`):
///   assets/tray/tray_icon.ico   ← Windows
///   assets/tray/tray_icon.png   ← macOS / Linux
/// Register the directory in pubspec.yaml:  flutter.assets: [assets/tray/]
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:tray_manager/tray_manager.dart';
import 'package:window_manager/window_manager.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Platform guard
// ─────────────────────────────────────────────────────────────────────────────

/// True when the app is running as a native desktop application.
///
/// Uses [defaultTargetPlatform] (available on all platforms) instead of
/// [Platform.isWindows] (unavailable on web) so this getter is safe to call
/// from any compilation target.
bool get isDesktop =>
    !kIsWeb &&
    (defaultTargetPlatform == TargetPlatform.windows ||
        defaultTargetPlatform == TargetPlatform.macOS ||
        defaultTargetPlatform == TargetPlatform.linux);

// ─────────────────────────────────────────────────────────────────────────────
// Window manager
// ─────────────────────────────────────────────────────────────────────────────

/// Manages the native desktop window.
///
/// Call [initialize] once from [main], before [runApp], guarded by [isDesktop]:
///
/// ```dart
/// if (isDesktop) await DesktopWindowManager.instance.initialize();
/// ```
///
/// The manager hides the OS title bar (so [SvenTitleBar] can render its own),
/// sets an initial 1 080 × 720 window centred on screen, enforces a 480 × 600
/// minimum, and intercepts window-close events for graceful cleanup.
class DesktopWindowManager with WindowListener {
  DesktopWindowManager._();
  static final instance = DesktopWindowManager._();

  bool _initialised = false;

  /// Initialise the native window. Safe to call multiple times.
  Future<void> initialize() async {
    if (!isDesktop || _initialised) return;
    _initialised = true;

    await windowManager.ensureInitialized();

    const options = WindowOptions(
      size: Size(1080, 720),
      minimumSize: Size(480, 600),
      center: true,
      title: 'Sven',
      titleBarStyle: TitleBarStyle.hidden,
      backgroundColor: Colors.transparent,
      skipTaskbar: false,
    );

    await windowManager.waitUntilReadyToShow(options, () async {
      await windowManager.show();
      await windowManager.focus();
    });

    windowManager.addListener(this);

    // Intercept close so we can clean up tray before the process exits.
    await windowManager.setPreventClose(true);
  }

  /// Tear down; called automatically from [onWindowClose].
  Future<void> dispose() async {
    if (!isDesktop) return;
    windowManager.removeListener(this);
  }

  // ── WindowListener ──────────────────────────────────────────────────────

  @override
  Future<void> onWindowClose() async {
    if (!isDesktop) return;
    // Remove tray icon first, then let the window close for real.
    await DesktopTrayManager.instance.destroy();
    await windowManager.setPreventClose(false);
    await windowManager.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// System tray
// ─────────────────────────────────────────────────────────────────────────────

/// Manages the system-tray icon and context menu.
///
/// Call [initialize] from a widget's [State.initState] (via
/// [WidgetsBinding.addPostFrameCallback]) so a navigation callback can be
/// provided:
///
/// ```dart
/// DesktopTrayManager.instance.initialize(onNewChat: () => _newChat(context));
/// ```
class DesktopTrayManager with TrayListener {
  DesktopTrayManager._();
  static final instance = DesktopTrayManager._();

  VoidCallback? _onNewChat;

  /// Set up the tray icon, tooltip, and context menu.
  ///
  /// [onNewChat] is invoked when the user selects "New Conversation" from the
  /// tray context menu (the window is brought to foreground first).
  Future<void> initialize({VoidCallback? onNewChat}) async {
    if (!isDesktop) return;
    _onNewChat = onNewChat;
    trayManager.addListener(this);

    // Platform-appropriate icon path (must exist in assets/tray/ and be
    // declared under flutter.assets in pubspec.yaml).
    final iconPath = defaultTargetPlatform == TargetPlatform.windows
        ? 'assets/tray/tray_icon.ico'
        : 'assets/tray/tray_icon.png';

    try {
      await trayManager.setIcon(iconPath);
    } catch (_) {
      // Icon asset not yet present — add assets/tray/tray_icon.ico (Windows)
      // or assets/tray/tray_icon.png (macOS/Linux), then re-enable this path.
    }

    await trayManager.setToolTip('Sven');
    await _rebuildMenu();
  }

  /// Remove the tray icon. Called before the window closes.
  Future<void> destroy() async {
    if (!isDesktop) return;
    trayManager.removeListener(this);
    try {
      await trayManager.destroy();
    } catch (_) {}
  }

  Future<void> _rebuildMenu() async {
    final menu = Menu(
      items: [
        MenuItem(key: 'show', label: 'Show Sven'),
        MenuItem.separator(),
        MenuItem(key: 'new_chat', label: 'New Conversation'),
        MenuItem.separator(),
        MenuItem(key: 'quit', label: 'Quit Sven'),
      ],
    );
    await trayManager.setContextMenu(menu);
  }

  // ── TrayListener ────────────────────────────────────────────────────────

  @override
  void onTrayIconMouseDown() {
    if (isDesktop) windowManager.show();
  }

  @override
  void onTrayIconRightMouseDown() {
    if (isDesktop) trayManager.popUpContextMenu();
  }

  @override
  void onTrayMenuItemClick(MenuItem menuItem) {
    switch (menuItem.key) {
      case 'show':
        windowManager.show();
      case 'new_chat':
        windowManager.show();
        _onNewChat?.call();
      case 'quit':
        windowManager.setPreventClose(false);
        windowManager.close();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom title bar widget
// ─────────────────────────────────────────────────────────────────────────────

/// A custom drag-to-move title bar replacing the hidden OS title bar on desktop.
///
/// Returns [SizedBox.shrink] on Android, iOS, and web — safe to include
/// unconditionally in a widget tree.
///
/// Visual structure (desktop only):
///   [app icon  "Sven"]───────────────[─ □ ✕]
///    ← DragToMoveArea spans entire row →
class SvenTitleBar extends StatefulWidget {
  const SvenTitleBar({super.key});

  @override
  State<SvenTitleBar> createState() => _SvenTitleBarState();
}

class _SvenTitleBarState extends State<SvenTitleBar> with WindowListener {
  bool _isMaximised = false;

  @override
  void initState() {
    super.initState();
    if (isDesktop) {
      windowManager.addListener(this);
      _refreshMaxState();
    }
  }

  @override
  void dispose() {
    if (isDesktop) windowManager.removeListener(this);
    super.dispose();
  }

  Future<void> _refreshMaxState() async {
    if (!isDesktop) return;
    final max = await windowManager.isMaximized();
    if (mounted) setState(() => _isMaximised = max);
  }

  // ── WindowListener ──────────────────────────────────────────────────────

  @override
  void onWindowMaximize() => setState(() => _isMaximised = true);

  @override
  void onWindowUnmaximize() => setState(() => _isMaximised = false);

  // ── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (!isDesktop) return const SizedBox.shrink();

    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return SizedBox(
      height: 36,
      child: DragToMoveArea(
        child: ColoredBox(
          color: cs.surface.withAlpha((0.92 * 255).round()),
          child: Row(
            children: [
              const SizedBox(width: 12),
              // ── App identity ─────────────────────────────────────────────
              Expanded(
                child: Row(
                  children: [
                    Icon(Icons.auto_awesome_rounded,
                        size: 15, color: cs.primary),
                    const SizedBox(width: 6),
                    Text(
                      'Sven',
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: cs.onSurface,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.4,
                      ),
                    ),
                  ],
                ),
              ),
              // ── Window controls ──────────────────────────────────────────
              _TitleBarButton(
                tooltip: 'Minimise',
                icon: Icons.remove_rounded,
                onTap: () => windowManager.minimize(),
              ),
              _TitleBarButton(
                tooltip: _isMaximised ? 'Restore' : 'Maximise',
                icon: _isMaximised
                    ? Icons.filter_none_rounded
                    : Icons.crop_square_rounded,
                onTap: () => _isMaximised
                    ? windowManager.unmaximize()
                    : windowManager.maximize(),
              ),
              _TitleBarButton(
                tooltip: 'Close',
                icon: Icons.close_rounded,
                isClose: true,
                onTap: () => windowManager.close(),
              ),
              const SizedBox(width: 2),
            ],
          ),
        ),
      ),
    );
  }
}

/// A single window-control button (minimise / maximise / close).
class _TitleBarButton extends StatefulWidget {
  const _TitleBarButton({
    required this.tooltip,
    required this.icon,
    required this.onTap,
    this.isClose = false,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback onTap;
  final bool isClose;

  @override
  State<_TitleBarButton> createState() => _TitleBarButtonState();
}

class _TitleBarButtonState extends State<_TitleBarButton> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final hoverBg = widget.isClose
        ? Colors.red.shade700
        : cs.onSurface.withAlpha((0.1 * 255).round());
    final iconColor = (_hovered && widget.isClose)
        ? Colors.white
        : cs.onSurface.withAlpha((0.75 * 255).round());

    return Tooltip(
      message: widget.tooltip,
      preferBelow: true,
      child: MouseRegion(
        onEnter: (_) => setState(() => _hovered = true),
        onExit: (_) => setState(() => _hovered = false),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: widget.onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 100),
            width: 36,
            height: 36,
            color: _hovered ? hoverBg : Colors.transparent,
            child: Icon(widget.icon, size: 14, color: iconColor),
          ),
        ),
      ),
    );
  }
}
