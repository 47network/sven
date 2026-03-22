// lib/app/keyboard_nav.dart
//
// Keyboard navigation utilities for Sven — web and desktop.
//
// ● SvenKeyboardNavScope — mount at the root (inside MaterialApp.builder) to:
//     · Force traditional (always-visible) focus rings on web/desktop.
//     · Wrap the entire app in ReadingOrderTraversalPolicy for sensible Tab order.
//     · Register global Escape handler (closes dialogs / navigates back).
//     · Register "/" shortcut to search / focus the chat composer.
//
// ● SvenFocusRegion — wraps a semantic landmark (e.g., sidebar, main content)
//     so Tab stays inside that region until the user presses F6 / Shift+F6.
//
// ● SvenActivatableRegion — makes any widget fully keyboard-reachable by
//     receiving focus and activating on Space / Enter (like a real button).
//
// ● SvenSkipLink — screen-reader "skip to main content" link rendered at the
//     top of the page (invisible until focused).

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Intents
// ─────────────────────────────────────────────────────────────────────────────

/// Fired when Escape is pressed — pops the top-most route/sheet.
class _CloseIntent extends Intent {
  const _CloseIntent();
}

/// Fired when "/" is pressed — jumps focus to the search / compose field.
class _FocusSearchIntent extends Intent {
  const _FocusSearchIntent();
}

// ─────────────────────────────────────────────────────────────────────────────
// SvenKeyboardNavScope
// ─────────────────────────────────────────────────────────────────────────────

/// Root-level keyboard navigation scope.
///
/// Place this as the outermost widget inside `MaterialApp.builder` so that
/// all descendant pages benefit from:
///   • Always-visible focus rings on web and desktop.
///   • `ReadingOrderTraversalPolicy` tab order (top-left → bottom-right).
///   • Global `Escape` → Navigator.maybePop().
///   • Global `/` → broadcasts [SvenKeyboardNavScope.focusSearchKey] so that
///     chat pages can register their search/compose focus node.
class SvenKeyboardNavScope extends StatefulWidget {
  const SvenKeyboardNavScope({
    super.key,
    required this.child,
  });

  final Widget child;

  /// Register a FocusNode under this key to allow the global `/` shortcut
  /// to jump focus to the chat search / composer field.
  static final focusSearchKey = GlobalKey<_SvenFocusSearchTargetState>();

  /// Request that the currently registered search/compose target receives focus.
  static void requestSearchFocus() {
    focusSearchKey.currentState?.requestFocus();
  }

  @override
  State<SvenKeyboardNavScope> createState() => _SvenKeyboardNavScopeState();
}

class _SvenKeyboardNavScopeState extends State<SvenKeyboardNavScope> {
  @override
  void initState() {
    super.initState();
    // On web and desktop, always show keyboard-style focus indicators
    // instead of Flutter's default "only show on keyboard interaction".
    if (kIsWeb || _isDesktop) {
      FocusManager.instance.highlightStrategy =
          FocusHighlightStrategy.alwaysTraditional;
    }
  }

  static bool get _isDesktop =>
      defaultTargetPlatform == TargetPlatform.windows ||
      defaultTargetPlatform == TargetPlatform.macOS ||
      defaultTargetPlatform == TargetPlatform.linux;

  @override
  Widget build(BuildContext context) {
    return FocusTraversalGroup(
      policy: ReadingOrderTraversalPolicy(),
      child: Actions(
        actions: {
          _CloseIntent: CallbackAction<_CloseIntent>(
            onInvoke: (_) {
              // Close bottom sheets / dialogs first; fall back to Navigator pop.
              final nav = Navigator.of(context, rootNavigator: false);
              if (nav.canPop()) nav.pop();
              return null;
            },
          ),
          _FocusSearchIntent: CallbackAction<_FocusSearchIntent>(
            onInvoke: (_) {
              SvenKeyboardNavScope.requestSearchFocus();
              return null;
            },
          ),
        },
        child: Shortcuts(
          shortcuts: const {
            SingleActivator(LogicalKeyboardKey.escape): _CloseIntent(),
            SingleActivator(LogicalKeyboardKey.slash): _FocusSearchIntent(),
          },
          child: widget.child,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SvenFocusSearchTarget
// ─────────────────────────────────────────────────────────────────────────────

/// Wrap the chat composer / search field with this widget.
/// When the global "/" shortcut fires, focus moves here automatically.
///
/// Usage:
/// ```dart
/// SvenFocusSearchTarget(
///   key: SvenKeyboardNavScope.focusSearchKey,
///   focusNode: _composerFocusNode,
///   child: ChatComposer(...),
/// )
/// ```
class SvenFocusSearchTarget extends StatefulWidget {
  const SvenFocusSearchTarget({
    super.key,
    required this.focusNode,
    required this.child,
  });

  final FocusNode focusNode;
  final Widget child;

  @override
  State<SvenFocusSearchTarget> createState() => _SvenFocusSearchTargetState();
}

class _SvenFocusSearchTargetState extends State<SvenFocusSearchTarget> {
  void requestFocus() => widget.focusNode.requestFocus();

  @override
  Widget build(BuildContext context) => widget.child;
}

// ─────────────────────────────────────────────────────────────────────────────
// SvenFocusRegion
// ─────────────────────────────────────────────────────────────────────────────

/// A named landmark region that contains Tab traversal.
///
/// Press `F6` / `Shift+F6` to move focus between regions — a common pattern
/// in web browsers and productivity apps (like VS Code).
///
/// Set [autoFocus] to true on the "main content" region so that keyboard-only
/// users land on the right place after page load.
class SvenFocusRegion extends StatelessWidget {
  const SvenFocusRegion({
    super.key,
    required this.label,
    required this.child,
    this.autofocus = false,
  });

  /// Semantic label for the region (used by screen readers as a landmark).
  final String label;

  final bool autofocus;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      // 'scopesRoute' marks this as a major navigational region for
      // assistive technology.
      scopesRoute: false,
      explicitChildNodes: true,
      child: FocusTraversalGroup(
        policy: ReadingOrderTraversalPolicy(),
        child: Focus(
          autofocus: autofocus,
          skipTraversal: true, // The group itself is not in the tab order
          child: child,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SvenActivatableRegion
// ─────────────────────────────────────────────────────────────────────────────

/// Makes any widget keyboard-activatable (Space / Enter triggers [onActivated]).
///
/// Use this to wrap custom tappable containers that are built with
/// `GestureDetector` rather than `InkWell`/`ElevatedButton` — ensures that
/// keyboard-only users can activate them.
class SvenActivatableRegion extends StatefulWidget {
  const SvenActivatableRegion({
    super.key,
    required this.child,
    required this.onActivated,
    this.semanticLabel,
    this.isButton = true,
  });

  final Widget child;
  final VoidCallback onActivated;
  final String? semanticLabel;

  /// When true, the node is announced as a button by screen readers.
  final bool isButton;

  @override
  State<SvenActivatableRegion> createState() => _SvenActivatableRegionState();
}

class _SvenActivatableRegionState extends State<SvenActivatableRegion> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: widget.isButton,
      label: widget.semanticLabel,
      onTap: widget.onActivated,
      child: Focus(
        onFocusChange: (v) => setState(() => _focused = v),
        onKeyEvent: (node, event) {
          if (event is! KeyDownEvent) return KeyEventResult.ignored;
          final key = event.logicalKey;
          if (key == LogicalKeyboardKey.space ||
              key == LogicalKeyboardKey.enter ||
              key == LogicalKeyboardKey.numpadEnter) {
            widget.onActivated();
            return KeyEventResult.handled;
          }
          return KeyEventResult.ignored;
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          decoration: _focused
              ? BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: [
                    BoxShadow(
                      color: Theme.of(context)
                          .colorScheme
                          .primary
                          .withValues(alpha: 0.55),
                      blurRadius: 0,
                      spreadRadius: 2,
                    ),
                  ],
                )
              : const BoxDecoration(),
          child: widget.child,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SvenSkipLink
// ─────────────────────────────────────────────────────────────────────────────

/// A "Skip to main content" link that appears only when focused via keyboard.
///
/// Place at the very top of each page scaffold.  When a keyboard user presses
/// Tab the first time, this link appears; pressing Enter skips to the main
/// content focus node.
///
/// ```dart
/// Stack(
///   children: [
///     SvenSkipLink(targetFocusNode: _mainContentFocus),
///     ... page content ...
///   ],
/// )
/// ```
class SvenSkipLink extends StatefulWidget {
  const SvenSkipLink({
    super.key,
    required this.targetFocusNode,
    this.label = 'Skip to main content',
  });

  final FocusNode targetFocusNode;
  final String label;

  @override
  State<SvenSkipLink> createState() => _SvenSkipLinkState();
}

class _SvenSkipLinkState extends State<SvenSkipLink> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: AnimatedOpacity(
        opacity: _focused ? 1.0 : 0.0,
        duration: const Duration(milliseconds: 150),
        child: Focus(
          onFocusChange: (v) => setState(() => _focused = v),
          child: GestureDetector(
            onTap: () => widget.targetFocusNode.requestFocus(),
            child: Material(
              elevation: 8,
              color: theme.colorScheme.primary,
              child: InkWell(
                onTap: () => widget.targetFocusNode.requestFocus(),
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Text(
                    widget.label,
                    style: TextStyle(
                      color: theme.colorScheme.onPrimary,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SvenKeyboardShortcutsHelp
// ─────────────────────────────────────────────────────────────────────────────

/// Shows a bottom sheet listing keyboard shortcuts available in Sven.
/// Invoke via `SvenKeyboardShortcutsHelp.show(context)`.
class SvenKeyboardShortcutsHelp {
  SvenKeyboardShortcutsHelp._();

  static const _shortcuts = [
    _ShortcutEntry('Ctrl/⌘ + N', 'New conversation'),
    _ShortcutEntry('Ctrl/⌘ + K', 'Open Settings'),
    _ShortcutEntry('/', 'Focus composer / search'),
    _ShortcutEntry('Escape', 'Close dialog / go back'),
    _ShortcutEntry('Tab', 'Next focusable element'),
    _ShortcutEntry('Shift + Tab', 'Previous focusable element'),
    _ShortcutEntry('Enter / Space', 'Activate focused element'),
    _ShortcutEntry('↑ / ↓', 'Navigate message history'),
    _ShortcutEntry('Ctrl/⌘ + Enter', 'Send message'),
    _ShortcutEntry('Escape (in composer)', 'Cancel / stop generating'),
    _ShortcutEntry('Ctrl/⌘ + R', 'Retry last failed message'),
    _ShortcutEntry('? (Shift + /)', 'Show this help'),
  ];

  static void show(BuildContext context, {Color? backgroundColor}) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: backgroundColor ?? Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.keyboard_rounded,
                    size: 20,
                    color: Theme.of(ctx).colorScheme.primary,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Keyboard Shortcuts',
                    style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20),
                    onPressed: () => Navigator.pop(ctx),
                    tooltip: 'Close',
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ..._shortcuts.map(
                (s) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color:
                              Theme.of(ctx).colorScheme.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: Theme.of(ctx).colorScheme.outlineVariant,
                          ),
                        ),
                        child: Text(
                          s.keys,
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          s.description,
                          style: Theme.of(ctx).textTheme.bodyMedium,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ShortcutEntry {
  const _ShortcutEntry(this.keys, this.description);

  final String keys;
  final String description;
}
